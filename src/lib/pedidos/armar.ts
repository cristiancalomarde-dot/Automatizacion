/**
 * Los borradores de pedido de una reserva (spec M3-01): una función pura, sin
 * base ni red ni IA (#3). Recibe la reserva, lo que hace falta del catálogo y
 * la plantilla, y devuelve:
 *
 * - `pedidos`: un borrador por casilla de proveedor (fila 1). Las partes que
 *   van al mismo mail (normalizado) van juntas, en orden de fecha. Un
 *   proveedor sin mail da un borrador sin destinatario con el motivo (fila 9).
 * - `tareas`: lo que no va por mail (fila 8): los buses que emite HI Travel,
 *   lo que se reserva a mano (Kupos, Plataforma10, Transvip), los proveedores
 *   de WhatsApp y lo que el catálogo no resuelve.
 * - `avisos`: lo que no se pidió y por qué (lo opcional, lo que reserva la
 *   agencia), para quien revisa.
 *
 * Qué se pide de cada paquete: un servicio por orden (la primera opción del
 * catálogo; si hay otras, el pedido lo avisa), el alojamiento del nivel que
 * dice la habitación, los traslados después de los ajustes del tour (M1-08) y
 * sin el lado que lleva otra reserva (`sin_traslado_de`). Nada de lo que
 * reserva la agencia (fila 7).
 */
import {
  AGENCIA_JOURNAWAY,
  agruparPorOrden,
  esDeJournaway,
  estadoServicio,
  ladosDeUnTraslado,
  NIVEL_TODOS,
  normalizarTexto,
  pasosDelTour,
  queEs,
  type Lado,
  type PasoConLlegada,
} from "@/lib/catalogo/reglas";
import type { ComponenteTour, DetalleProducto, ProveedorResumen, Servicio, TipoServicio } from "@/lib/catalogo/tipos";
import { NOMBRE_DESTINO, nombreDestino } from "@/lib/importador-tours/ciudades";
import { TRANSFER_PNT } from "@/lib/reservas/emparejar/componentes";
import { lugarDelTraslado } from "@/lib/reservas/emparejar/vuelos-requeridos";
import { llevaEntradas } from "./entradas";
import { avisosDeBlackout, avisosDeDiasDeBus, avisosDeFechaEspecial, tramoDeLaRuta, type ServicioConDia } from "./itinerario";
import { HOTEL_A_CONFIRMAR, fichasDePasajeros, lineaDeTour, llevaFichaCompleta, restriccionAlimentaria, type TourDeFicha } from "./ficha";
import { completar, completarAsunto } from "./plantilla";
import { renglonDelVuelo } from "./renglon-vuelo";
import {
  diasEntre,
  fechaCorta,
  fechasDelAsunto,
  nivelDeLaHabitacion,
  nombreDelPasajero,
  rangoCorto,
  renglonDelPasajero,
  sumarDias,
  habitacionDelOverland,
  habitacionDelPedido,
  habitacionSinTipo,
  alojamientoDelTrek,
  trekDeUnPax,
  TREK_A_CONFIRMAR,
  tipoDeHabitacion,
} from "./formato";
import type {
  BusElChalten,
  CatalogoParaPedidos,
  DiaDeServicio,
  OpcionDelPasajero,
  ParteCubierta,
  ParteParaPedidos,
  PedidoArmado,
  Plantilla,
  ReservaParaPedidos,
  ResultadoArmado,
  TareaArmada,
  TramoSePideA,
  VueloDeReserva,
} from "./tipos";

export const MENSAJES = {
  paraRevision: "Resolvé primero lo que está para revisión.",
  noRecibida: "Solo se arman pedidos de reservas recibidas.",
  sinMail: (proveedor: string) => `Falta el mail de ${proveedor}: completalo en el directorio de proveedores.`,
} as const;

/** Destinos que conservan sus traslados aunque estén en el medio del tour (M1-08). */
const IGUAZU = new Set(["IGR", "IGU"]);
/**
 * Combined de Iguazú que empiezan en Brasil (owner, 2026-10-19): el lado donde duermen primero va
 * el día 2 y el otro el día 3, el del cruce. El resto (OD010A/B/C, OD011) hace primero el argentino.
 */
const IGUAZU_EMPIEZA_EN_BRASIL = new Set(["OD010D"]);
/** Combined de Iguazú: el día del cruce la excursión incluye el cambio de hotel (owner, 2026-10-19). */
const IGUAZU_COMBINED = new Set(["OD010C", "OD010D"]);
/** El paquete receptivo de Cuenca del Plata que se vende (M3-12): el título lo dice siempre. */
const PAQUETE_105_PREMIUM = /\b105\s+Premium\b/i;
const PREMIUM = /\bpremium\b/i;
const PRIVADO = /\b(privad[oa]|private)\b/i;

/**
 * M3-28 (owner, 2026-10-28): los nombres como se escriben, aunque el Excel los traiga mal
 * ("Transvipp" → "Transvip"). Para las tareas, los textos y los avisos de los pedidos.
 */
function comoSeEscribe(texto: string): string {
  return texto.replace(/\bTransvipp\b/gi, "Transvip");
}
/** El servicio se hace en español (el Overland de Imperio Inca: "chofer de habla hispana, sin guía en inglés"). */
const EN_ESPANOL = /habla hispana|spanish[- ]speaking|sin gu[ií]a en ingl[eé]s/i;
/** Una excursión de varios días ("3 días en jeep", "3 days"). */
const VARIOS_DIAS = /\b([2-9])\s*(d[ií]as|days)\b/i;
const PIDE_TRASLADO = /transfer|traslado|pick ?up/i;
const CON_TRASLADOS = /\b(with|con|incl\.?|including)\s+(the\s+)?(transfers?|traslados?)\b/i;
const SIN_TRASLADOS = /\b(without|sin|no)\s+(the\s+)?(transfers?|traslados?)\b/i;
/** "Includes: Transfer in + Out, Excursion Cataratas Argentinas, Excursion Cataratas Brasileras" (el 105 de Cuenca del Plata). */
const INCLUYE_TRASLADOS = /Includes:\s*Transfer\s+in\s*\+\s*Out\s*,\s*(.+)$/im;

/** Un servicio que va en un pedido por mail. */
interface Item {
  proveedor: ProveedorResumen;
  tipo: TipoServicio;
  renglones: string[];
  fecha: string | null;
  /** M3-16: el último día del servicio, si dura más de uno (para las fechas del asunto). */
  hasta: string | null;
  seq: number;
  cubre: ParteCubierta;
  /** El pedido lleva los datos de los pasajeros (alojamiento y excursiones). */
  datosPax: boolean;
  avisos: string[];
  /** Lo que todavía falta y se le avisa al proveedor ("vuelo"). */
  pendientes: string[];
  /** La excursión como la lista el proveedor con ficha completa ("FECHAS Y TOURS"). */
  tour?: TourDeFicha;
}

/** Un paquete (o producto suelto) de la reserva, con sus fechas y su lugar en el tour. */
interface Bloque {
  codigo: string;
  destino: string | null;
  servicios: Servicio[];
  inicio: string | null;
  fin: string | null;
  parteId: string | null;
  pickUp: string | null;
  llegaEnBus: boolean;
  saleEnBus: boolean;
  omitir: Lado[];
  /** Los tours en que está, de afuera hacia adentro (5C01, CHB31); vacío si es suelto (M3-14). */
  tours: string[];
}

/** Los códigos de los tours que contienen el componente, de afuera hacia adentro (5C01 → CHB31). */
function cadenaDeTours(codigo: string, componentes: readonly ComponenteTour[], buscado: ComponenteTour): string[] | null {
  for (const c of componentes) {
    if (c === buscado) return [codigo];
    const adentro = c.producto?.esTour ? c.producto.componentes : null;
    const cadena = adentro?.length ? cadenaDeTours(c.producto!.codigo, adentro, buscado) : null;
    if (cadena) return [codigo, ...cadena];
  }
  return null;
}

/**
 * Dónde duerme el pasajero, para el pick up de las excursiones (owner, 2026-10-19): el hotel del
 * catálogo que la app pide (a confirmar: se pide en esta misma reserva) o el que reserva la agencia.
 */
interface Estadia {
  hotel: string;
  ciudad: string | null;
  desde: string;
  hasta: string;
  aConfirmar: boolean;
}

/** El alojamiento se pide con ese nivel: es el elegido o vale para todos (M3-23, Purmamarca en OD027). */
function vaConElNivel(s: Servicio, nivel: string | null | undefined): boolean {
  return s.nivel === NIVEL_TODOS || (nivel !== undefined && s.nivel === nivel);
}

const PENDIENTE = {
  alojamiento: "Les pasamos el alojamiento para el pick up apenas lo tengamos.",
  vuelo: "El vuelo todavía no lo tenemos: se lo pasamos apenas nos llegue.",
  busOVuelo: "Todavía no sabemos si llegan en bus o en vuelo: se lo pasamos apenas nos llegue.",
};

class Armado {
  readonly items: Item[] = [];
  readonly tareas: Array<TareaArmada & { fecha: string | null; seq: number }> = [];
  readonly avisos: string[] = [];
  /** M3-24: los avisos del itinerario con su fecha (para ordenarlos). */
  private readonly itinerario: Array<{ fecha: string | null; seq: number; texto: string }> = [];
  /** M3-24: los blackouts por parte (null = la salida de la reserva: van en todos los borradores). */
  private readonly blackouts = new Map<string | null, string[]>();
  private readonly whatsapp = new Map<string, { proveedor: ProveedorResumen; cosas: string[]; fecha: string | null; seq: number }>();
  private seq = 0;
  private estadias: Estadia[] = [];

  constructor(
    private readonly reserva: ReservaParaPedidos,
    private readonly catalogo: CatalogoParaPedidos,
  ) {}

  // --- Recorrido -----------------------------------------------------------------------

  recorrer(): void {
    const r = this.reserva;
    const principal = r.productoId ? this.catalogo.detalles.get(r.productoId) ?? null : null;
    // M3-24: la salida del producto vendido (tour o paquete suelto) contra sus blackouts.
    if (principal) this.blackout(null, principal.codigo, r.fechaInicio);
    if (r.partes.length === 0) {
      if (!principal) {
        this.tarea("revisar", "Revisar a mano: la reserva no tiene un producto del catálogo, no se pueden armar los pedidos.", {}, null);
        return;
      }
      if (principal.esTour) {
        this.tarea("revisar", `Revisar a mano: la reserva de ${principal.codigo} no tiene sus partes, no se pueden armar los pedidos.`, {}, null);
        return;
      }
      const b: Bloque = {
        codigo: principal.codigo,
        destino: principal.destino,
        servicios: principal.servicios,
        inicio: r.fechaInicio,
        fin: r.fechaFin,
        parteId: null,
        pickUp: null,
        llegaEnBus: false,
        saleEnBus: false,
        omitir: this.omitir(),
        tours: [],
      };
      this.estadias = this.estadiasDe([b]);
      this.bloque(b);
      return;
    }
    const partes = [...r.partes].sort((a, b) => a.orden - b.orden);
    // Primero dónde duerme en toda la reserva (el pick up de una excursión puede depender de otro paquete).
    this.estadias = this.estadiasDe(partes.map((p) => this.bloqueDeParte(p)).filter((b): b is Bloque => !!b));
    for (const parte of partes) this.parte(parte);
  }

  private omitir(): Lado[] {
    return this.reserva.sinTrasladoDe === "salida" ? ["out"] : this.reserva.sinTrasladoDe === "llegada" ? ["in"] : [];
  }

  private parte(parte: ParteParaPedidos): void {
    if (parte.esTarea) {
      const ruta = parte.descripcionRuta ?? parte.textoAgencia ?? "bus";
      if (this.tramoAProveedor(parte, ruta)) return;
      this.tarea("emitir_boleto", `Emitir boleto: ${ruta}${parte.fechaInicio ? `, ${fechaCorta(parte.fechaInicio)}` : ""}`, { parteId: parte.id, ruta }, parte.fechaInicio);
      this.avisosDelItinerario([{ tipo: "bus", nombre: ruta, fecha: parte.fechaInicio, destino: null }]);
      return;
    }
    if (parte.tipo === "servicio") return this.parteServicio(parte);
    if (parte.tipo === "tramo_bus") {
      this.tarea("revisar", `Revisar a mano: ${parte.descripcionRuta ?? "un tramo de bus"} no dice quién lo reserva.`, { parteId: parte.id }, parte.fechaInicio);
      if (parte.descripcionRuta) this.avisosDelItinerario([{ tipo: "bus", nombre: parte.descripcionRuta, fecha: parte.fechaInicio, destino: null }]);
      return;
    }
    if (!parte.productoId) {
      const que = parte.textoAgencia ?? parte.descripcionRuta ?? "una parte de la reserva";
      this.tarea("revisar", `Pedir a mano: "${que}" no se reconoció en el catálogo.`, { parteId: parte.id }, parte.fechaInicio);
      return;
    }
    const b = this.bloqueDeParte(parte);
    if (!b) {
      this.tarea("revisar", `Revisar a mano: no se encontró en el catálogo el producto de la parte ${parte.orden}.`, { parteId: parte.id }, parte.fechaInicio);
      return;
    }
    // M3-24: el inicio de la parte contra los blackouts de su producto (OD013 dentro de AR09, SPAE05 dentro de SPAP02).
    this.blackout(b.parteId, b.codigo, b.inicio);
    this.bloque(b);
  }

  /** El paquete de una parte con producto del catálogo; null si la parte no es eso o no se encuentra. */
  private bloqueDeParte(parte: ParteParaPedidos): Bloque | null {
    if (parte.esTarea || parte.tipo === "servicio" || parte.tipo === "tramo_bus" || !parte.productoId) return null;
    const ubicado = this.ubicar(parte);
    if (!ubicado) return null;
    return {
      codigo: ubicado.producto.codigo,
      destino: ubicado.producto.destino,
      servicios: ubicado.servicios,
      inicio: parte.fechaInicio,
      fin: parte.fechaFin,
      parteId: parte.id,
      pickUp: parte.pickUp,
      llegaEnBus: ubicado.llegaEnBus,
      saleEnBus: ubicado.saleEnBus,
      omitir: ubicado.dePrincipal ? this.omitir() : [],
      tours: ubicado.tours,
    };
  }

  /** Dónde está el producto de una parte: dentro del tour (con sus ajustes) o suelto. */
  private ubicar(parte: ParteParaPedidos):
    | { producto: { codigo: string; destino: string | null }; servicios: Servicio[]; llegaEnBus: boolean; saleEnBus: boolean; dePrincipal: boolean; tours: string[] }
    | null {
    const r = this.reserva;
    const tours = [r.productoId, ...r.otrosProductos]
      .map((id) => (id ? this.catalogo.detalles.get(id) : undefined))
      .filter((d): d is DetalleProducto => !!d && d.esTour);
    const buscar = (porComponente: boolean) => {
      for (const tour of tours) {
        const pasos = pasosDelTour(tour.componentes, tour.servicios);
        const paso = pasos.find((p) =>
          porComponente ? !!parte.productoComponenteId && p.componente.id === parte.productoComponenteId : p.componente.producto?.id === parte.productoId,
        );
        if (paso) return { tour, paso };
      }
      return null;
    };
    const hallado = buscar(true) ?? buscar(false);
    if (hallado) {
      const { tour, paso } = hallado;
      const prod = paso.componente.producto!;
      // Los paquetes de Journaway no llevan la regla de buses (M2-08): el lado sale de sus ajustes.
      const conBuses = !esDeJournaway(tour) && !IGUAZU.has(prod.destino ?? "");
      return {
        producto: prod,
        servicios: prod.servicios,
        llegaEnBus: conBuses && (paso as PasoConLlegada).llegaEnBus,
        saleEnBus: conBuses && (paso as PasoConLlegada).saleEnBus,
        dePrincipal: tour.id === r.productoId,
        tours: cadenaDeTours(tour.codigo, tour.componentes, paso.componente) ?? [tour.codigo],
      };
    }
    const suelto = this.catalogo.detalles.get(parte.productoId!);
    if (!suelto || suelto.esTour) return null;
    return { producto: suelto, servicios: suelto.servicios, llegaEnBus: false, saleEnBus: false, dePrincipal: suelto.id === r.productoId, tours: [] };
  }

  /** Una parte "servicio" del tour: el bus que reserva Imperio Inca, el transfer al aeropuerto PNT. */
  private parteServicio(parte: ParteParaPedidos): void {
    const proveedor = parte.proveedorId ? this.catalogo.proveedores.get(parte.proveedorId) ?? null : null;
    const que = parte.descripcionRuta ?? "un servicio del tour";
    if (!proveedor) {
      this.tarea("revisar", `Pedir a mano: ${que}${parte.fechaInicio ? `, ${fechaCorta(parte.fechaInicio)}` : ""} (no tiene proveedor en el directorio).`, { parteId: parte.id }, parte.fechaInicio);
      return;
    }
    const cubre: ParteCubierta = { parteId: parte.id, productoServicioId: parte.productoServicioId, producto: null, fecha: parte.fechaInicio };
    if (que === TRANSFER_PNT) {
      const t = this.traslado("out", que, parte.fechaInicio, ["PNT"], false);
      const renglones = [`Traslado de salida: ${que}`, `Fecha: ${t.fecha ? fechaCorta(t.fecha) : "a confirmar"}`, t.dato];
      const avisos = this.avisosDelItinerario([{ tipo: "traslado", nombre: que, fecha: t.fecha, destino: "PNT" }]);
      this.agregar(proveedor, "traslado", renglones, t.fecha, cubre, false, avisos, t.pendientes, undefined, null);
      return;
    }
    const nocturno = !!parte.fechaInicio && !!parte.fechaFin && parte.fechaFin > parte.fechaInicio;
    const renglones = [`Bus: ${que}`, `Fecha: ${parte.fechaInicio ? fechaCorta(parte.fechaInicio) : "a confirmar"}${nocturno ? " (nocturno)" : ""}`];
    const avisos = this.avisosDelItinerario([{ tipo: "bus", nombre: que, fecha: parte.fechaInicio, destino: null }]);
    this.agregar(proveedor, "bus", renglones, parte.fechaInicio, cubre, false, avisos, []);
  }

  /**
   * M3-25 (owner, 2026-10-27): el bus del tour que emitiría HI Travel, si `data/tramos-se-piden-a.csv` dice que
   * en este tour se le pide a un proveedor (Bariloche – El Chaltén de AR10 a Chalten Travel), va en el pedido a
   * ese proveedor, con su fecha y, si la regla está escrita en ese sentido, su horario. La regla vale en los dos
   * sentidos. Si el proveedor no está en el directorio, queda la tarea de siempre, con un aviso. True si se pidió.
   */
  private tramoAProveedor(parte: ParteParaPedidos, ruta: string): boolean {
    const tours = new Set(
      [this.reserva.productoId, ...this.reserva.otrosProductos].map((id) => (id ? this.catalogo.detalles.get(id)?.codigo : undefined)).filter(Boolean),
    );
    const puntas = (r: string) => r.replace(/^\s*bus\s+/i, "").split(/\s+[–-]\s+/).map(normalizarTexto);
    const [a, b] = puntas(ruta);
    if (!a || !b) return false;
    const reglas = (this.catalogo.tramosSePidenA ?? []).filter((t) => tours.has(t.tour));
    const mismoSentido = (t: TramoSePideA) => puntas(t.ruta)[0] === a && puntas(t.ruta)[1] === b;
    const regla = reglas.find(mismoSentido) ?? reglas.find((t) => puntas(t.ruta)[0] === b && puntas(t.ruta)[1] === a);
    if (!regla) return false;
    const proveedor = regla.proveedorDelDirectorio;
    if (!proveedor) {
      this.avisos.push(`"${regla.proveedor}" no está en el directorio de proveedores: el bus ${ruta} queda como boleto para emitir. Revisalo antes de enviar.`);
      return false;
    }
    const horario = mismoSentido(regla) ? regla.horario : undefined;
    const llega = parte.fechaFin && parte.fechaInicio && parte.fechaFin > parte.fechaInicio ? parte.fechaFin : null;
    const cuando = parte.fechaInicio ? fechaCorta(parte.fechaInicio) : "a confirmar";
    const fecha = horario ? `Fecha: ${cuando} · Horario: ${horario}${llega ? ` (llega el ${fechaCorta(llega)})` : ""}` : `Fecha: ${cuando}${llega ? " (nocturno)" : ""}`;
    const avisos = this.avisosDelItinerario([{ tipo: "bus", nombre: ruta, fecha: parte.fechaInicio, destino: null }]);
    const cubre: ParteCubierta = { parteId: parte.id, productoServicioId: null, producto: null, fecha: parte.fechaInicio };
    this.agregar(proveedor, "bus", [`Bus: ${ruta}`, fecha], parte.fechaInicio, cubre, false, avisos, []);
    return true;
  }

  // --- Un paquete -------------------------------------------------------------------------

  /** El nivel de alojamiento que se pide del paquete; undefined si no se puede elegir. */
  private nivelElegido(b: Bloque): { nivel: string | null | undefined; niveles: Set<string | null>; hayAlojamiento: boolean } {
    // M3-23: un alojamiento de "Todos los niveles" (Purmamarca) se pide siempre: no es un nivel para elegir.
    const alojamientos = agruparPorOrden(b.servicios).filter(
      (g) => g[0].tipo === "alojamiento" && g[0].ajusteTour?.accion !== "anular" && g[0].nivel !== NIVEL_TODOS,
    );
    const niveles = new Set(alojamientos.map((g) => g[0].nivel));
    const nivel = this.nivelEnElTour(b, nivelDeLaHabitacion(this.reserva.habitacion), niveles);
    const elegido = niveles.size === 1 ? [...niveles][0] : nivel && niveles.has(nivel) ? nivel : undefined;
    return { nivel: elegido, niveles, hayAlojamiento: alojamientos.length > 0 };
  }

  /**
   * En un tour, el nivel del paquete que corresponde a la categoría vendida (M3-14, owner
   * 2026-10-22): la equivalencia de data/categorias-tour.csv (tour, categoría, componente) si
   * existe; si no, la misma si el paquete la tiene; si no y es Budget Hotel, el Hotel 3*. Un tour de
   * adentro (CHB31 en 5C01) primero traduce la categoría del de afuera. Un paquete suelto no cambia.
   */
  private nivelEnElTour(b: Bloque, categoria: string | null, niveles: Set<string | null>): string | null {
    if (!categoria || b.tours.length === 0) return categoria;
    const equivalencias = this.catalogo.categoriasTour ?? [];
    const equivalente = (tour: string, cat: string, componente: string) =>
      equivalencias.find((e) => e.tour === tour && e.categoriaTour === cat && e.componente === componente)?.categoriaPaquete;
    let cat = categoria;
    const cadena = [...b.tours, b.codigo];
    for (let i = 0; i < cadena.length - 2; i++) cat = equivalente(cadena[i], cat, cadena[i + 1]) ?? cat;
    const delArchivo = equivalente(cadena[cadena.length - 2], cat, b.codigo);
    if (delArchivo) return delArchivo;
    if (niveles.has(cat)) return cat;
    return cat === "Budget Hotel" ? "Hotel 3*" : cat;
  }

  /**
   * Las noches de la reserva con su hotel: el que reserva la agencia (confirmado) y la primera
   * opción del catálogo que pide la app (a confirmar), aunque vaya por WhatsApp o a otro proveedor.
   */
  private estadiasDe(bloques: Bloque[]): Estadia[] {
    const estadias: Estadia[] = this.reserva.hotelesAgencia
      .filter((h) => h.desde && h.hasta)
      .map((h) => ({ hotel: h.nombre, ciudad: null, desde: h.desde!, hasta: h.hasta!, aConfirmar: false }));
    for (const b of bloques) {
      const { nivel } = this.nivelElegido(b);
      for (const grupo of agruparPorOrden(b.servicios)) {
        const [s] = this.opcionesDe(b, grupo).opciones;
        if (s.tipo !== "alojamiento" || s.ajusteTour?.accion === "anular" || !vaConElNivel(s, nivel)) continue;
        if (s.opcional || s.aPedido === "a_pedido" || this.loReservaLaAgencia(s)) continue;
        for (const tramo of s.tramosNoches?.length ? s.tramosNoches : [null]) {
          const desde = b.inicio && tramo ? sumarDias(b.inicio, tramo.nocheDesde - 1) : b.inicio;
          const hasta = b.inicio && tramo ? sumarDias(b.inicio, tramo.nocheDesde - 1 + tramo.noches) : b.fin;
          if (!desde || !hasta) continue;
          // El tramo dice dónde duerme: en Iguazú de qué lado (M3-12: "Foz do Iguaçu (lado brasileño)" → "Foz do
          // Iguaçu"); M3-23: en OD027, Salta o Purmamarca.
          const lugar = tramo?.lugar?.replace(/\s*\(.*\)\s*$/, "").trim();
          const ciudad = lugar || (b.destino ? (NOMBRE_DESTINO[b.destino] ?? null) : null);
          estadias.push({ hotel: s.serviceProviderNombre ?? queEs(s), ciudad, desde, hasta, aConfirmar: true });
        }
      }
    }
    return estadias;
  }

  private bloque(b: Bloque): void {
    const grupos = agruparPorOrden(b.servicios);
    const { nivel: nivelElegido, niveles, hayAlojamiento } = this.nivelElegido(b);
    if (nivelElegido === undefined && hayAlojamiento) {
      const hab = this.reserva.habitacion ? `la habitación "${this.reserva.habitacion}"` : "la reserva";
      this.tarea(
        "revisar",
        `Elegir el hotel de ${b.codigo}: ${hab} no dice el nivel de alojamiento (${[...niveles].filter(Boolean).join(", ")}). Pedilo a mano.`,
        { parteId: b.parteId, producto: b.codigo },
        b.inicio,
      );
    }

    for (const grupoDelExcel of grupos) {
      const { opciones: grupo, segunHabitacion, segunPasajero } = this.opcionesDe(b, grupoDelExcel);
      const s = grupo[0];
      if (s.ajusteTour?.accion === "anular") continue;
      if (s.tipo === "alojamiento" && !vaConElNivel(s, nivelElegido)) continue;
      // Lo que eligió el pasajero (M3-13): el servicio se pide con el nombre de la regla.
      const elecciones = this.eleccionesDe(b, s.orden);
      const nombre = elecciones.find((r) => (r.accion === "elegir" && segunPasajero) || r.accion === "renombrar")?.servicio ?? this.nombre(s);
      if (s.opcional) {
        this.avisos.push(`No se pidió "${nombre}" (${b.codigo}) porque es opcional: agregalo si el pasajero lo compró.`);
        continue;
      }
      if (s.aPedido === "a_pedido" && !(s.tipo === "traslado" && PIDE_TRASLADO.test(this.reserva.pedidosEspeciales ?? ""))) {
        this.avisos.push(`No se pidió "${nombre}" (${b.codigo}): va solo a pedido del pasajero o del vendedor.`);
        continue;
      }
      if (s.tipo === "alojamiento" && this.loReservaLaAgencia(s)) {
        this.avisos.push(`No se pide "${nombre}": lo reserva la agencia.`);
        continue;
      }
      // Las opciones del Excel comparten la descripción ("City Tour / Bike Tour"): las nombra su opción.
      const otras = grupo
        .slice(1)
        .map((x) => (segunPasajero ? (x.serviceProviderNombre ?? this.nombre(x)) : this.nombre(x)))
        .filter((x) => x && x !== nombre);
      const elegida = segunPasajero
        ? "lo eligió el pasajero"
        : segunHabitacion
          ? "se eligió según la habitación"
          : "se tomó la primera opción del catálogo";
      const avisoOpciones = otras.length ? [`${nombre}: ${elegida} (otras: ${otras.join(", ")}).`] : [];
      this.servicio(b, s, avisoOpciones, nombre);
      for (const r of elecciones.filter((x) => x.accion === "agregar")) this.agregarElegido(b, s, r);
    }
  }

  /**
   * Las reglas de `data/opciones-pasajero.csv` (M3-13) de ese servicio del paquete cuya elección
   * está en los pedidos especiales de la reserva ("Choice of tour in Mendoza: rafting"), de
   * cualquier agencia.
   */
  private eleccionesDe(b: Bloque, orden: number | null): OpcionDelPasajero[] {
    const pedidos = normalizarTexto(this.reserva.pedidosEspeciales ?? "");
    if (!pedidos || orden === null) return [];
    return (this.catalogo.opcionesPasajero ?? []).filter((r) => {
      if (r.codigo !== b.codigo || r.orden !== orden) return false;
      const palabra = normalizarTexto(r.eleccion).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<![a-z0-9])${palabra}(?![a-z0-9])`).test(pedidos);
    });
  }

  /** "agregar": el servicio que eligió el pasajero, a su proveedor, con las fechas del que reemplaza. */
  private agregarElegido(b: Bloque, s: Servicio, r: OpcionDelPasajero): void {
    if (!r.proveedorDelDirectorio) {
      this.tarea(
        "revisar",
        `Pedir a mano: ${r.servicio} (${b.codigo}): el pasajero eligió ${r.eleccion}, pero ${r.proveedor} no está en el directorio de proveedores.`,
        { producto: b.codigo, servicioId: s.id },
        b.inicio,
      );
      return;
    }
    const elegido: Servicio = {
      ...s,
      descripcion: `${s.tipo === "excursion" ? "Excursion: " : ""}${r.servicio}. Booking Supplier: ${r.proveedor}`,
      serviceProviderNombre: r.servicio,
      bookingSupplierNombre: r.proveedor,
      bookingSupplier: r.proveedorDelDirectorio,
      reservaManual: false,
    };
    this.servicio(b, elegido, [], r.servicio);
  }

  /**
   * Las opciones de un servicio en el orden en que se ofrecen (M3-11): las de un alojamiento del
   * destino de una regla de `data/hostel-segun-habitacion.csv` van en el orden de la regla según
   * la habitación (dorm o privada), sin las que la regla no nombra. Sin regla, sin habitación o si
   * ninguna opción coincide, el orden del Excel. Antes que eso, la opción que eligió el pasajero
   * (M3-13, `data/opciones-pasajero.csv`, acción "elegir") va primera.
   */
  private opcionesDe(b: Bloque, grupo: Servicio[]): { opciones: Servicio[]; segunHabitacion: boolean; segunPasajero?: boolean } {
    // M3-13: la opción que eligió el pasajero ("bike" → Bike Tour) va primero; si no está en el catálogo, se avisa.
    const elegida = this.eleccionesDe(b, grupo[0].orden).find((r) => r.accion === "elegir");
    if (elegida) {
      const i = grupo.findIndex((s) => normalizarTexto(s.serviceProviderNombre ?? queEs(s)) === normalizarTexto(elegida.servicio));
      if (i >= 0) return { opciones: [grupo[i], ...grupo.filter((_, j) => j !== i)], segunHabitacion: false, segunPasajero: true };
      this.avisos.push(`El pasajero eligió ${elegida.eleccion}, pero ${b.codigo} no tiene la opción ${elegida.servicio} en el catálogo: se pidió la primera opción.`);
    }
    const comoEnElExcel = { opciones: grupo, segunHabitacion: false };
    if (grupo[0].tipo !== "alojamiento" || !b.destino) return comoEnElExcel;
    const hab = normalizarTexto(tipoDeHabitacion(this.reserva.habitacion) ?? "");
    const clase = hab.startsWith("dorm") ? "dorm" : ["doble", "twin", "single", "triple"].includes(hab) ? "privada" : null;
    const regla = clase && (this.catalogo.hostelSegunHabitacion ?? []).find((r) => r.destino === b.destino && r.habitacion === clase);
    if (!regla) return comoEnElExcel;
    const nombreDe = (s: Servicio) => normalizarTexto(s.serviceProviderNombre ?? queEs(s));
    const opciones = regla.orden.flatMap((n) => grupo.filter((s) => nombreDe(s) === normalizarTexto(n)));
    return opciones.length ? { opciones, segunHabitacion: true } : comoEnElExcel;
  }

  private nombre(s: Servicio): string {
    if (s.ajusteTour?.accion === "reemplazar" && s.ajusteTour.texto) return s.ajusteTour.texto;
    return nombreLimpio(queEs(s)) || s.serviceProviderNombre || nombreLimpio(s.descripcion ?? "") || "servicio";
  }

  private loReservaLaAgencia(s: Servicio): boolean {
    const hotel = normalizarTexto(s.serviceProviderNombre ?? queEs(s));
    if (!hotel) return false;
    return this.reserva.hotelesAgencia.some((h) => {
      const suyo = normalizarTexto(h.nombre);
      return !!suyo && (suyo.includes(hotel) || hotel.includes(suyo));
    });
  }

  /** Un servicio elegido: va a un pedido, a una tarea o a WhatsApp. */
  private servicio(b: Bloque, delCatalogo: Servicio, avisosDelServicio: string[], nombreElegido?: string): void {
    const { s, avisos } = this.seLePideA(b, delCatalogo, avisosDelServicio);
    const nombre = nombreElegido ?? this.nombre(s);
    const tramos = s.tramosNoches?.length ? s.tramosNoches : [null];
    for (const tramo of tramos) {
      const desde = b.inicio && tramo ? sumarDias(b.inicio, tramo.nocheDesde - 1) : b.inicio;
      const hasta = b.inicio && tramo ? sumarDias(b.inicio, tramo.nocheDesde - 1 + tramo.noches) : b.fin;
      const armados = this.renglones(b, s, nombre, desde, hasta);
      for (const a of armados) this.destino(b, s, nombre, a, avisos);
    }
  }

  /**
   * M3-22 (owner, 2026-10-23): un alojamiento con regla en `data/alojamiento-se-pide-a.csv` (Factoria en
   * Puerto Natales) se le pide al proveedor de la regla, no al Booking Supplier del Excel (Vértice). Si
   * ese proveedor no está en el directorio, queda como en el catálogo, con un aviso.
   */
  private seLePideA(b: Bloque, s: Servicio, avisos: string[]): { s: Servicio; avisos: string[] } {
    if (s.tipo !== "alojamiento" || !b.destino) return { s, avisos };
    const hotel = normalizarTexto(s.serviceProviderNombre ?? queEs(s));
    const regla = (this.catalogo.alojamientoSePideA ?? []).find((r) => r.destino === b.destino && normalizarTexto(r.alojamiento) === hotel);
    if (!regla) return { s, avisos };
    const proveedor = regla.proveedorDelDirectorio;
    if (!proveedor) {
      const hoy = s.bookingSupplier?.nombre ?? s.bookingSupplierNombre ?? "el proveedor del catálogo";
      return {
        s,
        avisos: [
          ...avisos,
          `"${regla.proveedor}" no está en el directorio de proveedores: el pedido de ${regla.alojamiento} sale a ${hoy}, como en el catálogo. Revisalo antes de enviar.`,
        ],
      };
    }
    return { s: { ...s, bookingSupplier: proveedor, bookingSupplierNombre: proveedor.nombre }, avisos };
  }

  /** A quién va: mail, WhatsApp, a mano o sin proveedor. */
  private destino(b: Bloque, s: Servicio, nombre: string, a: Renglones, avisosPrevios: string[]): void {
    const cuando = a.resumen;
    // M3-24: las fechas especiales y los días de los buses de lo que se pide (vaya por mail, WhatsApp o a mano).
    const avisos = [...avisosPrevios, ...this.avisosDelItinerario(this.conDia(b, s, nombre, a))];
    if (s.reservaManual) {
      const donde = s.bookingSupplierNombre ?? s.bookingSupplier?.nombre ?? "su sistema";
      if (s.tipo === "bus") {
        this.tarea("emitir_boleto", `Emitir boleto: ${nombre}${cuando ? `, ${cuando}` : ""}`, { producto: b.codigo, servicioId: s.id }, a.fecha);
      } else {
        this.tarea("reservar_a_mano", `Reservar a mano en ${donde}: ${a.queParaTarea}${cuando ? `, ${cuando}` : ""}`, { producto: b.codigo, servicioId: s.id }, a.fecha);
      }
      return;
    }
    const proveedor = s.bookingSupplier;
    if (!proveedor) {
      const motivo = estadoServicio(s).motivo ?? "no tiene proveedor en el catálogo";
      this.tarea("revisar", `Pedir a mano: ${nombre} (${b.codigo})${cuando ? `, ${cuando}` : ""}. ${motivo}`, { producto: b.codigo, servicioId: s.id }, a.fecha);
      return;
    }
    if (proveedor.canal === "whatsapp") {
      const previo = this.whatsapp.get(proveedor.id) ?? { proveedor, cosas: [], fecha: a.fecha, seq: this.seq++ };
      // Con la habitación en el alojamiento (owner, 2026-10-19): "San Pedro Backpackers (dorm compartido)".
      previo.cosas.push(`${s.tipo === "alojamiento" ? a.queParaTarea : nombre}${cuando ? `, ${cuando}` : ""}`);
      this.whatsapp.set(proveedor.id, previo);
      return;
    }
    const cubre: ParteCubierta = { parteId: b.parteId, productoServicioId: s.id, producto: b.codigo, fecha: a.fecha };
    this.agregar(proveedor, s.tipo, a.renglones, a.fecha, cubre, a.datosPax, [...avisos, ...a.avisos], a.pendientes, a.tour, a.hasta ?? null);
  }

  private agregar(
    proveedor: ProveedorResumen,
    tipo: TipoServicio,
    renglones: string[],
    fecha: string | null,
    cubre: ParteCubierta,
    datosPax: boolean,
    avisos: string[],
    pendientes: string[],
    tour?: TourDeFicha,
    hasta: string | null = null,
  ): void {
    this.items.push({ proveedor, tipo, renglones, fecha, hasta, seq: this.seq++, cubre, datosPax, avisos, pendientes, tour });
  }

  private tarea(tipo: TareaArmada["tipo"], texto: string, detalle: Record<string, unknown>, fecha: string | null): void {
    this.tareas.push({ tipo, texto, detalle, fecha, seq: this.seq++ });
  }

  // --- El texto de cada servicio ----------------------------------------------------------

  private renglones(b: Bloque, s: Servicio, nombre: string, desde: string | null, hasta: string | null): Renglones[] {
    switch (s.tipo) {
      case "alojamiento":
        return [this.alojamiento(s, desde, hasta)];
      case "traslado":
        return this.traslados(b, s, nombre, desde, hasta);
      case "excursion":
      case "crucero": {
        // M3-15: si el renglón junta excursiones con su propio día (data/dias-servicio.csv por nombre), van separadas.
        const porNombre = this.diasPorNombre(b, s, nombre);
        return porNombre.length
          ? porNombre.map((d) => this.excursion(b, s, d.servicio!, desde, hasta, d))
          : [this.excursion(b, s, nombre, desde, hasta)];
      }
      case "bus":
        return [this.bus(b, s, nombre)];
      default: {
        // M3-20: el round trip de AR34 (data/buses-el-chalten.csv) sale en dos renglones, ida y vuelta.
        const buses = this.busesElChalten(b, s);
        return buses.length
          ? buses.map((r) => this.busElChalten(b, nombre, r, r.tramo === "ida" ? desde : hasta))
          : [this.otro(b, nombre, desde, hasta)];
      }
    }
  }

  private alojamiento(s: Servicio, desde: string | null, hasta: string | null): Renglones {
    const hotel = s.serviceProviderNombre ?? queEs(s);
    const renglones = [`Alojamiento: ${hotel}`];
    const avisos: string[] = [];
    if (desde && hasta) {
      const noches = diasEntre(desde, hasta);
      renglones.push(`IN: ${fechaCorta(desde)}`, `OUT: ${fechaCorta(hasta)} (${noches} ${noches === 1 ? "noche" : "noches"})`);
    } else {
      renglones.push("IN / OUT: a confirmar");
      avisos.push(`Faltan las fechas de ${hotel}: completalas antes de enviar.`);
    }
    const hab = tipoDeHabitacion(this.reserva.habitacion);
    // M3-18: Standard y con desayuno (sin upgrades que no pedimos). M3-21: sin tipo, en un hotel va por
    // los pax (2 → DBL, 1 → SGL) y en un hostel a confirmar, con un aviso para revisarlo con el vendedor.
    // Hostel = el nivel del servicio en el catálogo o, si no tiene, el que dice la habitación.
    const pax = this.paxDeLaReserva();
    const hostel = normalizarTexto(s.nivel ?? nivelDeLaHabitacion(this.reserva.habitacion) ?? "") === "hostel";
    renglones.push(`Habitación: ${habitacionDelPedido(this.reserva.habitacion, { pax, hostel })}`);
    if (habitacionSinTipo(this.reserva.habitacion)) {
      if (hostel) avisos.push(`La reserva no dice si en ${hotel} es dorm, DBL o SGL: completalo antes de enviar y revisalo con el vendedor.`);
      else if (pax === 1 || pax === 2) avisos.push(`La reserva no dice el tipo de habitación: va ${pax === 2 ? "DBL" : "SGL"} por ${pax} pax. Revisalo con el vendedor.`);
      else avisos.push(`Falta el tipo de habitación de ${hotel}: completalo antes de enviar.`);
    }
    return { renglones, fecha: desde, hasta: desde ? hasta : null, resumen: desde && hasta ? `IN ${fechaCorta(desde)}, OUT ${fechaCorta(hasta)}` : "", queParaTarea: hab ? `${hotel} (${hab})` : hotel, datosPax: true, avisos, pendientes: [] };
  }

  /**
   * Las reglas de `data/dias-servicio.csv` con nombre de excursión (M3-15) de ese servicio del
   * paquete cuyo nombre está en el del renglón ("Bodegas half Day and Alta Montaña" → Bodegas half
   * Day y Alta Montaña; "Rafting" → Rafting), en orden de día. Vacío si ninguna lo nombra.
   */
  private diasPorNombre(b: Bloque, s: Servicio, nombre: string): DiaDeServicio[] {
    const texto = normalizarTexto(nombre);
    return this.reglasDeDias(b, s)
      .filter((d) => d.servicio && texto.includes(normalizarTexto(d.servicio)))
      .sort((x, y) => x.dia - y.dia);
  }

  /**
   * Las reglas de `data/dias-servicio.csv` de ese servicio del componente. M3-23: si el componente
   * está dentro de un tour con reglas propias para ese servicio (columna `tour`), valen esas; si
   * no, las generales.
   */
  private reglasDeDias(b: Bloque, s: Servicio): DiaDeServicio[] {
    const delServicio = this.catalogo.dias.filter((d) => d.codigo === b.codigo && d.orden === s.orden);
    const delTour = delServicio.filter((d) => d.tour && b.tours.includes(d.tour));
    return delTour.length ? delTour : delServicio.filter((d) => !d.tour);
  }

  private fechaDeExcursion(b: Bloque, s: Servicio, desde: string | null, hasta: string | null, diaFijo?: DiaDeServicio): string | null {
    if (s.tramosNoches?.length && desde) return desde;
    if (b.inicio && b.fin && b.inicio === b.fin) return b.inicio;
    const dia = diaFijo?.dia;
    if (dia && b.inicio) return this.diaDeLaEstadia(b, dia);
    return desde && hasta && desde === hasta ? desde : null;
  }

  /** La regla de `data/dias-servicio.csv` sin nombre de excursión para ese servicio del componente. */
  private diaDelServicio(b: Bloque, s: Servicio): DiaDeServicio | undefined {
    return this.reglasDeDias(b, s).find((d) => !d.servicio);
  }

  /**
   * El día N de la estadía en ese componente (el 1 es el de llegada). M3-17: si la estadía es más
   * corta (el día cae en la salida o después), no se inventa: null, y queda "a coordinar".
   */
  private diaDeLaEstadia(b: Bloque, dia: number): string | null {
    if (!b.inicio) return null;
    const fecha = sumarDias(b.inicio, dia - 1);
    return b.fin && fecha >= b.fin && dia > 1 ? null : fecha;
  }

  /** M3-15: la excursión sin pick up, con su punto de encuentro (`data/puntos-de-encuentro.csv`). */
  private puntoDeEncuentro(b: Bloque, s: Servicio, nombre: string): string | null {
    const texto = normalizarTexto(nombre);
    return (this.catalogo.puntosDeEncuentro ?? []).find((p) => p.codigo === b.codigo && p.orden === s.orden && normalizarTexto(p.servicio) === texto)?.punto ?? null;
  }

  private excursion(b: Bloque, s: Servicio, nombre: string, desde: string | null, hasta: string | null, diaFijo?: DiaDeServicio): Renglones {
    const regular = PRIVADO.test(`${s.descripcion ?? ""} ${nombre}`) ? "privado" : "regular";
    const incluye = (s.descripcion ?? "").match(INCLUYE_TRASLADOS);
    if (incluye) return this.paqueteConTraslados(b, s, nombre, incluye[1], regular, `${s.descripcion ?? ""} ${nombre}`);

    const idioma = EN_ESPANOL.test(s.descripcion ?? "") ? "español" : "inglés";
    const renglones = [`Excursión: ${nombre}`];
    const avisos: string[] = [];
    // De varios días (el Overland de 3 días): va con sus fechas de punta a punta.
    const variosDias = VARIOS_DIAS.test(s.descripcion ?? "") && !!desde && !!hasta && desde !== hasta;
    const regla = diaFijo ?? this.diaDelServicio(b, s);
    const fecha = variosDias ? null : this.fechaDeExcursion(b, s, desde, hasta, regla);
    const momento = fecha && regla?.momento ? `, ${regla.momento}` : "";
    if (variosDias) renglones.push(`Desde: ${fechaCorta(desde!)} · Hasta: ${fechaCorta(hasta!)}`);
    else if (fecha) renglones.push(`Fecha: ${fechaCorta(fecha)}${momento}`);
    else {
      renglones.push(desde && hasta ? `Fecha: a coordinar (estadía ${rangoCorto(desde, hasta)})` : "Fecha: a coordinar");
      avisos.push(`Falta la fecha de ${nombre}: completala antes de enviar.`);
    }
    // Solo Journaway: las excursiones de la lista van con las entradas a los parques (owner, 2026-10-19).
    const entradas = this.esDeJournaway() && llevaEntradas(this.catalogo.entradas ?? [], b.codigo, `${nombre} ${s.descripcion ?? ""}`);
    renglones.push(`Servicio: ${regular} · Idioma: ${idioma}${entradas ? " · Con entradas" : ""}`);
    const punto = this.puntoDeEncuentro(b, s, nombre);
    // M3-25 (owner, 2026-10-27): la excursión "sin transfer" (el Beagle de OD022, "no transfer to port") no lleva pick up.
    const sinTraslado = SIN_TRASLADOS.test(`${nombre} ${s.descripcion ?? ""}`);
    const pickUp: { renglon: string | null; pendientes: string[]; lugar: string | null } = punto
      ? { renglon: `Punto de encuentro: ${punto} (el pasajero va directo)`, pendientes: [], lugar: punto }
      : sinTraslado
        ? { renglon: null, pendientes: [], lugar: null }
        : this.pickUp(b, variosDias ? desde : (fecha ?? desde), !variosDias);
    if (pickUp.renglon) renglones.push(pickUp.renglon);
    const resumen = variosDias ? rangoCorto(desde!, hasta!) : fecha ? `${fechaCorta(fecha)}${momento}` : "fecha a coordinar";
    const tour: TourDeFicha = {
      nombre,
      fecha: variosDias ? desde : fecha,
      hasta: variosDias ? hasta : null,
      privado: regular === "privado",
      entradas,
      idioma,
      lugar: pickUp.lugar,
    };
    return { renglones, fecha: fecha ?? desde, hasta: variosDias ? hasta : null, resumen, queParaTarea: nombre, datosPax: true, avisos, pendientes: pickUp.pendientes, tour };
  }

  private esDeJournaway(): boolean {
    return normalizarTexto(this.reserva.agencia ?? "") === normalizarTexto(AGENCIA_JOURNAWAY);
  }

  /**
   * Dónde buscan al pasajero (owner, 2026-10-19): el pick up que manda la agencia; si no, el hotel
   * de la reserva de esa noche o, si ese día es el OUT, el de la noche anterior ("· hotel a
   * confirmar" si se pide en esta misma reserva); si no se sabe, "alojamiento a confirmar" y se le
   * avisa al proveedor que se lo pasamos. Nunca se inventa.
   */
  private pickUp(b: Bloque, fecha: string | null, dropOff = false): { renglon: string; pendientes: string[]; lugar: string | null } {
    if (b.pickUp) return { renglon: `Pick up: ${b.pickUp}`, pendientes: [], lugar: b.pickUp };
    // M3-23: excursión de un día el día que cambia de alojamiento (Salta → Purmamarca en OD027): lo buscan donde
    // durmió la noche anterior y lo dejan en el de esa noche.
    const sale = dropOff && fecha ? this.estadias.find((x) => x.hasta === fecha) : undefined;
    const entra = dropOff && fecha ? this.estadias.find((x) => x.desde === fecha) : undefined;
    if (sale && entra && sale.hotel !== entra.hotel) {
      const donde = (x: Estadia) => `${x.hotel}${x.ciudad ? ` (${x.ciudad})` : ""}${x.aConfirmar ? " · hotel a confirmar" : ""}`;
      return { renglon: `Pick up: ${donde(sale)} · Drop off: ${donde(entra)}`, pendientes: [], lugar: `${sale.hotel}${sale.aConfirmar ? " (a confirmar)" : ""}` };
    }
    const e = this.estadiaDe(fecha);
    // Excursión de un día: la dejan en el mismo alojamiento si esa noche sigue ahí (owner, 2026-10-20).
    const sigueAhi = !!e && !!fecha && e.desde <= fecha && fecha < e.hasta;
    if (!e) return { renglon: `${dropOff ? "Pick up y drop off" : "Pick up"}: alojamiento a confirmar`, pendientes: [PENDIENTE.alojamiento], lugar: null };
    return {
      renglon: `${dropOff && sigueAhi ? "Pick up y drop off" : "Pick up"}: ${e.hotel}${e.ciudad ? ` (${e.ciudad})` : ""}${e.aConfirmar ? " · hotel a confirmar" : ""}`,
      pendientes: [],
      lugar: `${e.hotel}${e.aConfirmar ? " (a confirmar)" : ""}`,
    };
  }

  /** El alojamiento de esa noche o, si ese día es el OUT, el de la noche anterior. */
  private estadiaDe(fecha: string | null): Estadia | undefined {
    return fecha
      ? (this.estadias.find((x) => x.desde <= fecha && fecha < x.hasta) ?? this.estadias.find((x) => x.hasta === fecha))
      : undefined;
  }

  /**
   * El paquete receptivo de Iguazú (105 Premium de Cuenca del Plata): traslado de
   * llegada el primer día, cada excursión en los días siguientes y traslado de
   * salida el último día, como se pide hoy a mano.
   */
  private paqueteConTraslados(b: Bloque, s: Servicio, nombre: string, lista: string, regular: string, texto: string): Renglones {
    // El 105 Premium se pide como Premium, no como regular (owner, 2026-10-22, M3-12).
    const premium = PREMIUM.test(texto);
    // M3-28 (owner, 2026-10-28): en el Premium los transfers no aclaran "regular" (se pide un paquete Premium).
    const tipoTraslado = premium && regular === "regular" ? "" : `, ${regular}`;
    const sinReceptivo = nombre.replace(/^Paquete\s+Rece?pti?vo\s+/i, "Paquete ");
    const titulo =
      PAQUETE_105_PREMIUM.test(texto) && !/Paquete 105 Premium/i.test(sinReceptivo) ? `Paquete 105 Premium (${sinReceptivo})` : sinReceptivo;
    const codigos = IGUAZU.has(b.destino ?? "") ? ["IGR", "IGU"] : (lugarDelTraslado("", b.destino)?.codigos ?? []);
    const renglones = [titulo];
    const pendientes: string[] = [];
    // El hotel de cada renglón (M3-12): pick up = la noche anterior, drop off = la noche de ese día.
    // Si la agencia mandó un pick up, va solo ese, al final (como antes).
    const hotel = (fecha: string | null): string => {
      const e = this.estadiaDe(fecha);
      if (!e) {
        if (!pendientes.includes(PENDIENTE.alojamiento)) pendientes.push(PENDIENTE.alojamiento);
        return "alojamiento a confirmar";
      }
      return `${e.hotel}${e.ciudad ? ` (${e.ciudad})` : ""}${e.aConfirmar ? " · hotel a confirmar" : ""}`;
    };
    const conHotel = (renglon: string, partes: Array<[string, string | null]>): string =>
      b.pickUp ? renglon : [renglon, ...partes.map(([que, fecha]) => `${que}: ${hotel(fecha)}`)].join(" · ");
    const nocheAnterior = (fecha: string | null) => (fecha ? sumarDias(fecha, -1) : null);
    const llegada = this.traslado("in", "", b.inicio, codigos, IGUAZU.has(b.destino ?? ""));
    // M3-24: cada traslado y excursión del paquete con su día, para los avisos del itinerario.
    const conDia: ServicioConDia[] = [];
    if (!b.omitir.includes("in")) {
      conDia.push({ tipo: "traslado", nombre: `TRF IN (${titulo})`, fecha: llegada.fecha ?? b.inicio, destino: b.destino });
      renglones.push(
        conHotel(`TRF IN${tipoTraslado}: ${b.inicio ? fechaCorta(llegada.fecha ?? b.inicio) : "a confirmar"} · ${llegada.dato}`, [["Drop off", b.inicio]]),
      );
      pendientes.push(...llegada.pendientes);
    }
    const excursiones = lista
      .split(/\s*,\s*/)
      .map((e) => e.replace(/^Excursi[oó]n\s+/i, "").trim())
      .filter(Boolean);
    if (IGUAZU_EMPIEZA_EN_BRASIL.has(b.codigo ?? "")) {
      const brasil = (e: string) => (/brasil/i.test(e) ? 0 : 1);
      excursiones.sort((x, y) => brasil(x) - brasil(y));
    }
    const avisos: string[] = [];
    excursiones.forEach((e, i) => {
      const lado = /argentin/i.test(e) ? "Lado argentino" : /brasil/i.test(e) ? "Lado brasileño" : e;
      // M3-17: el día de cada lado sale de data/dias-servicio.csv (por nombre); sin regla, uno tras otro desde el día 2.
      const regla = this.reglasDeDias(b, s).find((d) => d.servicio && normalizarTexto(e).includes(normalizarTexto(d.servicio)));
      const fecha = regla ? this.diaDeLaEstadia(b, regla.dia) : b.inicio ? sumarDias(b.inicio, i + 1) : null;
      if (regla && b.inicio && !fecha) avisos.push(`Falta la fecha del ${lado.toLowerCase()}: completala antes de enviar.`);
      conDia.push({ tipo: "excursion", nombre: `${lado} (${titulo})`, fecha, destino: b.destino });
      const mismoHotel = !fecha || this.estadiaDe(nocheAnterior(fecha)) === this.estadiaDe(fecha);
      renglones.push(
        conHotel(
          `${lado}, ${premium ? "Premium, en inglés" : `${regular} en inglés`}: ${fecha ? fechaCorta(fecha) : "a coordinar"}`,
          mismoHotel ? [["Pick up y drop off", fecha]] : [["Pick up", nocheAnterior(fecha)], ["Drop off", fecha]],
        ),
      );
      if (IGUAZU_COMBINED.has(b.codigo ?? "") && i === 1 && excursiones.length > 1) {
        const destino = /brasil/i.test(e) ? "Brasil" : "Argentina";
        renglones.push(
          `Ese día cruzan: el drop off es en el hotel de ${destino}. Los pasajeros hacen check out y llevan el equipaje a la excursión (lo dejan en los lockers del parque nacional).`,
        );
      }
    });
    const salida = this.traslado("out", "", b.fin, codigos, IGUAZU.has(b.destino ?? ""));
    if (!b.omitir.includes("out")) {
      conDia.push({ tipo: "traslado", nombre: `TRF OUT (${titulo})`, fecha: salida.fecha ?? b.fin, destino: b.destino });
      renglones.push(
        conHotel(`TRF OUT${tipoTraslado}: ${b.fin ? fechaCorta(salida.fecha ?? b.fin) : "a confirmar"} · ${salida.dato}`, [["Pick up", nocheAnterior(b.fin)]]),
      );
      pendientes.push(...salida.pendientes);
    }
    if (b.pickUp) renglones.push(`Pick up: ${b.pickUp}`);
    return { renglones, fecha: b.inicio, hasta: b.inicio ? b.fin : null, resumen: b.inicio && b.fin ? rangoCorto(b.inicio, b.fin) : "", queParaTarea: titulo, datosPax: true, avisos, pendientes, conDia };
  }

  private traslados(b: Bloque, s: Servicio, nombre: string, desde: string | null, hasta: string | null): Renglones[] {
    let lados: Lado[];
    if (s.aPedido === "segun_reserva" && !s.ajusteTour) {
      // Depende de la variante vendida (OD019 CON o SIN traslados), como el control de vuelos de M2-03.
      const textoMail = this.reserva.pedidosEspeciales ?? "";
      if (SIN_TRASLADOS.test(textoMail)) return [];
      if (!CON_TRASLADOS.test(textoMail)) {
        this.tarea("revisar", `Elegir la variante de ${b.codigo}: ¿con o sin ${nombre}? Si va, pedilo a mano.`, { producto: b.codigo, servicioId: s.id }, desde);
        return [];
      }
      lados = s.sentido === "llegada" ? ["in"] : s.sentido === "salida" ? ["out"] : ["in", "out"];
    } else {
      lados = ladosDeUnTraslado(s).quedan;
      if (lados.length === 0 && (s.sentido === "sin_sentido" || !s.sentido)) {
        // Sin sentido deducido: de un día, un solo traslado ese día; si no, ida y vuelta.
        if (desde && hasta && desde !== hasta) lados = ["in", "out"];
        else return [this.unTraslado(b, s, nombre, null, desde)];
      }
    }
    const quedan = lados.filter((l) => !b.omitir.includes(l)).filter((l) => !(l === "in" && b.llegaEnBus) && !(l === "out" && b.saleEnBus));
    const deUnLado = quedan.length === 1 ? this.nombreDeUnLado(b, s, nombre, quedan[0]) : nombre;
    return quedan.map((l) => this.unTraslado(b, s, deUnLado, l, l === "in" ? desde : hasta));
  }

  /**
   * M3-25 (owner, 2026-10-27, OD027 y OD022 en AR10): un traslado de ida y vuelta del que se pide un solo lado
   * (llega o sigue en bus) no puede decir el round trip ("Transfer SLA - Accommodation - SLA"). Va el texto del
   * ajuste del tour si lo tiene; si no, el lado con el nombre de la ciudad (M3-28, owner 2026-10-28):
   * "Transfer in Aeropuerto Salta - Alojamiento" o "Transfer out Alojamiento en Ushuaia - Aeropuerto Ushuaia".
   * La ciudad sale de los códigos del renglón (SLA, USH) o, si no nombra ninguna (EZE o AEP), del destino del
   * paquete; sin ciudad, "Aeropuerto - Alojamiento". Un reemplazo (Iguazú) ya trae su propio texto.
   */
  private nombreDeUnLado(b: Bloque, s: Servicio, nombre: string, lado: Lado): string {
    if (s.sentido !== "ida_y_vuelta" || s.ajusteTour?.accion === "reemplazar") return nombre;
    if (s.ajusteTour?.texto) return s.ajusteTour.texto;
    const enElTexto = `${s.descripcion ?? ""} ${nombre}`.match(/\b[A-Z]{3}\b/g) ?? [];
    const codigo = enElTexto.find((c) => NOMBRE_DESTINO[c]) ?? b.destino;
    const ciudad = codigo ? (NOMBRE_DESTINO[codigo] ?? null) : null;
    const en = (prefijo: string) => (ciudad ? `${prefijo}${ciudad}` : "");
    return lado === "in" ? `Transfer in Aeropuerto${en(" ")} - Alojamiento` : `Transfer out Alojamiento${en(" en ")} - Aeropuerto${en(" ")}`;
  }

  private unTraslado(b: Bloque, s: Servicio, nombre: string, lado: Lado | null, fecha: string | null): Renglones {
    const iguazu = IGUAZU.has(b.destino ?? "");
    const texto = s.ajusteTour?.texto ?? s.descripcion ?? nombre;
    const codigos = iguazu ? ["IGR", "IGU"] : (lugarDelTraslado(texto, b.destino)?.codigos ?? []);
    const titulo = lado === "in" ? "Traslado de llegada" : lado === "out" ? "Traslado de salida" : "Traslado";
    const renglones = [`${titulo}: ${nombre}`];
    if (!lado) {
      renglones.push(`Fecha: ${fecha ? fechaCorta(fecha) : "a confirmar"}`);
      return { renglones, fecha, resumen: fecha ? fechaCorta(fecha) : "", queParaTarea: `${titulo.toLowerCase()} ${nombre}`, datosPax: false, avisos: [], pendientes: [] };
    }
    // M3-20: el "Transfer El Calafate Airport to El Chalten" de OD033 no es traslado: es el bus regular.
    const bus = this.busesElChalten(b, s).find((r) => r.tramo === (lado === "in" ? "ida" : "vuelta"));
    if (bus) return this.busElChalten(b, nombre, bus, fecha);
    const t = this.traslado(lado, nombre, fecha, codigos, iguazu);
    renglones.push(`Fecha: ${t.fecha ? fechaCorta(t.fecha) : "a confirmar"}`, t.dato);
    if (b.pickUp && lado === "in") renglones.push(`Destino: ${b.pickUp}`);
    return {
      renglones,
      fecha: t.fecha,
      resumen: `${t.fecha ? fechaCorta(t.fecha) : "fecha a confirmar"} · ${t.dato}`,
      queParaTarea: `${titulo.toLowerCase()} ${nombre}`,
      datosPax: false,
      avisos: [],
      pendientes: t.pendientes,
    };
  }

  /**
   * El vuelo del traslado (o "vuelo pendiente"; en Iguazú, "bus o vuelo pendiente"). M3-26: el vuelo
   * completo (sale y llega) o, sin número, el lado que trajo el mail ("Llegada: … (sin número de vuelo)").
   */
  private traslado(lado: Lado, _nombre: string, fecha: string | null, codigos: string[], iguazu: boolean) {
    const vuelo = buscarVuelo(this.reserva.vuelos, lado, codigos, fecha);
    if (vuelo) {
      const hora = lado === "in" ? vuelo.hora_llegada : vuelo.hora_salida;
      const dia = (lado === "in" ? vuelo.fecha_llegada : vuelo.fecha_salida) ?? fecha;
      return { dato: renglonDelVuelo(vuelo), fecha: dia, pendientes: [] as string[], hora: hora ?? null };
    }
    return iguazu
      ? { dato: "Bus o vuelo pendiente", fecha, pendientes: [PENDIENTE.busOVuelo], hora: null }
      : { dato: "Vuelo pendiente", fecha, pendientes: [PENDIENTE.vuelo], hora: null };
  }

  /** Las reglas de `data/buses-el-chalten.csv` (M3-20) de ese servicio del paquete, ida primero. */
  private busesElChalten(b: Bloque, s: Servicio): BusElChalten[] {
    return (this.catalogo.busesElChalten ?? [])
      .filter((r) => r.codigo === b.codigo && r.orden === s.orden)
      .sort((x, y) => (x.tramo === y.tramo ? 0 : x.tramo === "ida" ? -1 : 1));
  }

  /**
   * M3-20 (owner, 2026-10-23): el bus regular aeropuerto FTE → El Chaltén (con el vuelo, o el
   * pendiente) o El Chaltén → El Calafate, con su horario. La fecha es el día de la regla o, sin
   * él, la del servicio. Si el vuelo llega después de la hora límite, un aviso interno.
   */
  private busElChalten(b: Bloque, nombre: string, r: BusElChalten, fechaDelServicio: string | null): Renglones {
    const base = r.dia && b.inicio ? sumarDias(b.inicio, r.dia - 1) : fechaDelServicio;
    const titulo = r.renglon ?? `Bus: ${nombre}`;
    const que = r.renglon ?? nombre;
    const conHorario = (fecha: string | null) => `Fecha: ${fecha ? fechaCorta(fecha) : "a confirmar"} · Horario: ${r.horario}`;
    if (r.tramo === "vuelta") {
      return { renglones: [titulo, conHorario(base)], fecha: base, resumen: base ? `${fechaCorta(base)} · ${r.horario}` : "", queParaTarea: que, datosPax: false, avisos: [], pendientes: [], esBus: true, ruta: que };
    }
    const t = this.traslado("in", nombre, base, r.aeropuerto ? [r.aeropuerto] : [], false);
    const tarde = !!r.aviso && !!r.vueloDespuesDe && !!t.hora && minutosDelDia(t.hora) > minutosDelDia(r.vueloDespuesDe);
    return {
      renglones: [titulo, conHorario(t.fecha), t.dato],
      fecha: t.fecha,
      resumen: `${t.fecha ? fechaCorta(t.fecha) : "fecha a confirmar"} · ${t.dato}`,
      queParaTarea: que,
      datosPax: false,
      avisos: tarde ? [r.aviso!] : [],
      pendientes: t.pendientes,
      esBus: true,
      ruta: que,
    };
  }

  private bus(b: Bloque, s: Servicio, nombre: string): Renglones {
    const dia = (s.descripcion ?? "").match(/d[ií]a (\d+) del (tour|overland)/i);
    const fecha = dia && b.inicio ? sumarDias(b.inicio, Number(dia[1]) - 1) : b.fin;
    // M3-20: la vuelta El Chaltén → El Calafate (data/buses-el-chalten.csv) lleva su horario.
    const regla = this.busesElChalten(b, s)[0];
    if (regla) return this.busElChalten(b, nombre, regla, fecha);
    const nocturno = /nocturno|overnight|night bus/i.test(s.descripcion ?? "");
    const renglones = [`Bus: ${nombre}`, `Fecha: ${fecha ? fechaCorta(fecha) : "a confirmar"}${nocturno ? " (nocturno)" : ""}`];
    return { renglones, fecha, resumen: fecha ? fechaCorta(fecha) : "", queParaTarea: nombre, datosPax: false, avisos: [], pendientes: [], esBus: true, ruta: nombre };
  }

  /** Los pax de la reserva: `pax` o, si no vino, la cantidad de pasajeros (M3-21). */
  private paxDeLaReserva(): number | null {
    return this.reserva.pax ?? (this.reserva.pasajeros.length || null);
  }

  private otro(b: Bloque, nombre: string, desde: string | null, hasta: string | null): Renglones {
    const renglones = [nombre];
    const pendientes: string[] = [];
    if (desde && hasta && desde !== hasta) renglones.push(`Desde: ${fechaCorta(desde)} · Hasta: ${fechaCorta(hasta)}`);
    else renglones.push(`Fecha: ${desde ? fechaCorta(desde) : "a confirmar"}`);
    const avisos: string[] = [];
    if (/\bw[\s-]?trek\b/i.test(nombre)) {
      // M3-19 (owner, 2026-10-23): el tipo de alojamiento en el trek.
      // M3-21: la carpa sin cantidad va por los pax; con 1 pax no se asume Tent SGL (mucho más caro).
      const pax = this.paxDeLaReserva();
      const trek = alojamientoDelTrek(this.reserva.habitacion, pax);
      renglones.push(`Alojamiento en el trek: ${trek}`);
      if (trek === TREK_A_CONFIRMAR) {
        avisos.push(
          trekDeUnPax(this.reserva.habitacion, pax)
            ? `Falta el tipo de alojamiento del ${nombre} (1 pax): Tent SGL es mucho más caro que el Refugio Dorm; revisalo con el vendedor.`
            : `Falta el tipo de alojamiento del ${nombre}: completalo antes de enviar.`,
        );
      }
    }
    if (/overland/i.test(nombre)) {
      // El Overland de Imperio Inca que vendemos es tour regular, no el privado de Journaway (owner, 2026-10-19).
      renglones.push("Servicio: tour regular");
      const hab = habitacionDelOverland(this.reserva.habitacion);
      if (hab) renglones.push(`Habitación: ${hab}`);
      // Lo buscan donde durmió la noche anterior al inicio, como a las excursiones (owner, 2026-10-19).
      const pickUp = this.pickUp(b, desde);
      renglones.push(pickUp.renglon);
      pendientes.push(...pickUp.pendientes);
    }
    return { renglones, fecha: desde, hasta: desde ? hasta : null, resumen: desde && hasta ? rangoCorto(desde, hasta) : desde ? fechaCorta(desde) : "", queParaTarea: nombre, datosPax: true, avisos, pendientes };
  }

  // --- Avisos del itinerario (M3-24) -------------------------------------------------------------

  /** Los blackouts del producto en que cae su salida (o el inicio de su parte), una vez cada uno. */
  private blackout(parteId: string | null, codigo: string, fecha: string | null): void {
    const reglas = this.catalogo.itinerario;
    if (!reglas) return;
    const avisos = avisosDeBlackout(reglas, codigo, fecha);
    if (!avisos.length) return;
    const yaEstan = new Set(this.itinerario.map((x) => x.texto));
    const nuevos = avisos.filter((a) => !yaEstan.has(a));
    for (const texto of nuevos) this.itinerario.push({ fecha, seq: this.seq++, texto });
    this.blackouts.set(parteId, [...(this.blackouts.get(parteId) ?? []), ...nuevos]);
  }

  /** Los blackouts que van en un borrador: los de la salida y los de las partes que cubre. */
  blackoutsDe(parteIds: ReadonlyArray<string | null>): string[] {
    return [...(this.blackouts.get(null) ?? []), ...parteIds.flatMap((id) => (id ? (this.blackouts.get(id) ?? []) : []))];
  }

  /** Los servicios con día de lo que se pide: las excursiones con su fecha, los traslados y los buses. */
  private conDia(b: Bloque, s: Servicio, nombre: string, a: Renglones): ServicioConDia[] {
    if (a.conDia) return a.conDia.map((x) => ({ ...x, destino: x.destino ?? b.destino }));
    if (a.esBus || s.tipo === "bus") return [{ tipo: "bus", nombre: a.ruta ?? nombre, fecha: a.fecha, destino: null }];
    // La excursión sin fecha ("a coordinar") no se mira: su `fecha` es el inicio de la estadía.
    // Con el nombre de la excursión del renglón (M3-15: "Bodegas half Day and Alta Montaña" sale en dos, cada una con el suyo).
    if (s.tipo === "excursion" || s.tipo === "crucero") return a.tour ? [{ tipo: "excursion", nombre: a.tour.nombre, fecha: a.tour.fecha, destino: b.destino }] : [];
    if (s.tipo === "traslado") return [{ tipo: "traslado", nombre, fecha: a.fecha, destino: b.destino }];
    return [];
  }

  /**
   * Los avisos de fecha especial y de días de bus de esos servicios: los guarda para el bloque
   * "Revisar antes de pedir" y los devuelve para el borrador. Un bus se mira por su ciudad de salida.
   */
  private avisosDelItinerario(servicios: ServicioConDia[]): string[] {
    const reglas = this.catalogo.itinerario;
    if (!reglas) return [];
    const avisos: string[] = [];
    for (const s of servicios) {
      if (!s.fecha) continue;
      const nuevos =
        s.tipo === "bus"
          ? (() => {
              const tramo = tramoDeLaRuta(s.nombre);
              const ruta = tramo ? `${nombreDestino(tramo.origen)} → ${nombreDestino(tramo.destino)}` : s.nombre;
              return [
                ...avisosDeFechaEspecial(reglas, { ...s, nombre: ruta, destino: tramo?.origen ?? s.destino }),
                ...avisosDeDiasDeBus(reglas, { ruta: s.nombre, fecha: s.fecha }),
              ];
            })()
          : avisosDeFechaEspecial(reglas, s);
      for (const texto of nuevos) {
        if (!this.itinerario.some((x) => x.texto === texto)) this.itinerario.push({ fecha: s.fecha, seq: this.seq++, texto });
        if (!avisos.includes(texto)) avisos.push(texto);
      }
    }
    return avisos;
  }

  /** Los avisos del itinerario en orden de fecha. */
  textosDelItinerario(): string[] {
    return [...this.itinerario].sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999") || a.seq - b.seq).map((x) => x.texto);
  }

  // --- Salida -------------------------------------------------------------------------------

  tareasFinales(): TareaArmada[] {
    for (const { proveedor, cosas, fecha, seq } of this.whatsapp.values()) {
      const tel = proveedor.telefono ? ` (${proveedor.telefono})` : "";
      this.tareas.push({
        tipo: "whatsapp",
        texto: `Contactar por WhatsApp a ${proveedor.nombre}${tel}: ${cosas.join("; ")}`,
        detalle: { proveedorId: proveedor.id, servicios: cosas },
        fecha,
        seq,
      });
    }
    return [...this.tareas]
      .sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999") || a.seq - b.seq)
      .map(({ tipo, texto, detalle }) => ({ tipo, texto: comoSeEscribe(texto), detalle }));
  }
}

interface Renglones {
  renglones: string[];
  fecha: string | null;
  /** M3-16: el último día, si el servicio dura más de uno. */
  hasta?: string | null;
  /** La fecha (y el vuelo) en una línea, para las tareas. */
  resumen: string;
  queParaTarea: string;
  datosPax: boolean;
  avisos: string[];
  pendientes: string[];
  tour?: TourDeFicha;
  /** M3-24: es un bus (el regular de El Chaltén) y su ruta, para los avisos del itinerario. */
  esBus?: boolean;
  ruta?: string;
  /** M3-24: los servicios con día que junta el renglón (el paquete con traslados de Iguazú). */
  conDia?: ServicioConDia[];
}

/** "18:30" (o "18:30:00") → los minutos desde la medianoche; NaN si no es una hora. */
function minutosDelDia(hora: string): number {
  const m = hora.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/**
 * El vuelo que llega (o sale) de uno de esos aeropuertos, el del día del traslado primero. M3-26: un vuelo
 * sin número sirve si trae el aeropuerto y la hora del lado del traslado (lo mismo que `hayVuelo`).
 */
export function buscarVuelo(vuelos: readonly VueloDeReserva[], lado: Lado, codigos: string[], fecha: string | null): VueloDeReserva | null {
  const candidatos = vuelos.filter((v) => {
    const aeropuerto = (lado === "in" ? v.destino : v.origen)?.trim().toUpperCase() || null;
    const hora = lado === "in" ? v.hora_llegada : v.hora_salida;
    if (!v.numero?.trim() && !(aeropuerto && hora?.trim())) return false;
    const dia = lado === "in" ? v.fecha_llegada : v.fecha_salida;
    if (aeropuerto && codigos.length) return codigos.includes(aeropuerto);
    return !!fecha && dia === fecha;
  });
  const delDia = candidatos.find((v) => (lado === "in" ? v.fecha_llegada : v.fecha_salida) === fecha);
  return delDia ?? candidatos[0] ?? null;
}

/**
 * El nombre de un servicio para el mail: sin "Booking Supplier: …" (con sus
 * variantes mal escritas), sin el prefijo de tipo ni signos sueltos al final.
 */
export function nombreLimpio(texto: string): string {
  return texto
    .split("\n")[0]
    .split(/[.:]?\s*Book\w*\s+Sup+lier\b/i)[0]
    .replace(/^(Optional\s*:?\s*)?(Excursions?|Excursión)\s*[.:]\s*/i, "")
    .replace(/^Optional\s*:?\s*/i, "")
    .replace(/[\s/.:,;-]+$/, "")
    .trim();
}

// --- Agrupar por casilla ------------------------------------------------------------------------

const normalizarMail = (m: string) => m.trim().toLowerCase();

interface Grupo {
  casilla: string;
  destinatarios: string[];
  items: Item[];
  sinDestinatario: string | null;
}

/** Los ítems por casilla: dos proveedores que comparten un mail van en el mismo pedido. */
function agruparPorCasilla(items: Item[]): Grupo[] {
  const padre = new Map<string, string>();
  const raiz = (x: string): string => {
    const p = padre.get(x) ?? x;
    if (p === x) return x;
    const r = raiz(p);
    padre.set(x, r);
    return r;
  };
  const unir = (a: string, b: string) => padre.set(raiz(a), raiz(b));
  for (const it of items) {
    const mails = it.proveedor.mails.map(normalizarMail).filter(Boolean);
    if (mails.length === 0) continue;
    for (const m of mails) if (!padre.has(m)) padre.set(m, m);
    for (const m of mails.slice(1)) unir(mails[0], m);
  }
  const grupos = new Map<string, Grupo>();
  for (const it of items) {
    const mails = [...new Set(it.proveedor.mails.map(normalizarMail).filter(Boolean))];
    const clave = mails.length ? `mail:${raiz(mails[0])}` : `sin-mail:${it.proveedor.id}`;
    const g = grupos.get(clave) ?? {
      casilla: "",
      destinatarios: [],
      items: [],
      sinDestinatario: mails.length ? null : MENSAJES.sinMail(it.proveedor.nombre),
    };
    for (const m of mails) if (!g.destinatarios.includes(m)) g.destinatarios.push(m);
    g.items.push(it);
    grupos.set(clave, g);
  }
  for (const [clave, g] of grupos) g.casilla = g.destinatarios.length ? [...g.destinatarios].sort().join(",") : clave;
  return [...grupos.values()];
}

const porFecha = (a: Item, b: Item) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999") || a.seq - b.seq;

// --- El texto del pedido ------------------------------------------------------------------------

/** Los servicios del pedido, numerados si son más de uno. */
function textoDeServicios(items: Item[]): string {
  const numerar = items.length > 1;
  return items.map((it, i) => (numerar ? [`${i + 1}) ${it.renglones[0]}`, ...it.renglones.slice(1)] : it.renglones).join("\n")).join("\n\n");
}

/**
 * El pedido a un proveedor de ficha completa (Horizonte Atacama, owner 2026-10-19), como lo
 * mandaba el equipo a mano: un bloque por pasajero y después "FECHAS Y TOURS", una línea por
 * excursión con "- CON ENTRADAS" en las que la llevan. El hotel va en cada pasajero; si los tours
 * no salen todos del mismo lugar, cada línea dice su pick up. Lo que no es una excursión va
 * después, como siempre. Los datos van en {{servicios}} y {{pasajeros}} queda vacío.
 */
function conFichaCompleta(reserva: ReservaParaPedidos, items: Item[]): { servicios: string; pasajeros: string } {
  const tours = items.filter((it) => it.tour).map((it) => it.tour!);
  const otros = items.filter((it) => !it.tour);
  const lugares = [...new Set(tours.map((t) => t.lugar ?? HOTEL_A_CONFIRMAR))];
  const idiomas = [...new Set(tours.map((t) => t.idioma.toUpperCase()))];
  const fecha = tours.map((t) => t.fecha).find(Boolean) ?? items.map((it) => it.fecha).find(Boolean) ?? null;
  const fichas = fichasDePasajeros(reserva.pasajeros, reserva.pax, {
    hotel: lugares.join(" / ") || HOTEL_A_CONFIRMAR,
    fecha,
    idioma: idiomas.join(" / ") || "INGLÉS",
    restriccion: restriccionAlimentaria([reserva.pedidosEspeciales, ...(reserva.notas ?? [])]),
    telefonoDeContacto: reserva.contactoCliente?.telefono?.trim() || null,
  });
  const partes = [fichas];
  if (tours.length) partes.push(["FECHAS Y TOURS:", ...tours.map((t) => lineaDeTour(t, lugares.length > 1))].join("\n"));
  if (otros.length) partes.push(textoDeServicios(otros));
  return { servicios: partes.filter(Boolean).join("\n\n"), pasajeros: "" };
}

function bloquePasajeros(reserva: ReservaParaPedidos, conDatos: boolean): string {
  const pax = reserva.pax ?? (reserva.pasajeros.length || null);
  const cantidad = `Pasajeros: ${pax ?? "a confirmar"}`;
  const principal = reserva.pasajeros.map(nombreDelPasajero).find(Boolean);
  if (!conDatos) return principal ? `${cantidad} (pasajero principal: ${principal})` : cantidad;
  const renglones = reserva.pasajeros.map(renglonDelPasajero).filter((r): r is string => !!r);
  return [cantidad, ...renglones].join("\n");
}

function asuntoYReferencia(reserva: ReservaParaPedidos, catalogo: CatalogoParaPedidos) {
  const principal = reserva.pasajeros.map(nombreDelPasajero).find(Boolean) ?? "sin nombre";
  const codigos = [reserva.productoId, ...reserva.otrosProductos]
    .map((id) => (id ? catalogo.detalles.get(id)?.codigo : undefined))
    .filter((c): c is string => !!c);
  return {
    pasajero: principal,
    // M3-28: "x N" con los pax de la reserva; sin cantidad, el asunto va sin "x N" (y con aviso).
    pax: String(reserva.pax ?? (reserva.pasajeros.length || "")),
    producto: codigos.join(" + ") || "sin producto",
    referencia: reserva.numero?.trim() ? ` · Ref. ${reserva.numero.trim()}` : "",
  };
}

/** Por qué no se arman pedidos para una reserva en ese estado (fila 10); null si se puede. */
export function porQueNoSeArma(estado: ReservaParaPedidos["estado"]): string | null {
  if (estado === "para_revision") return MENSAJES.paraRevision;
  // M3-03: una reserva ya pedida se vuelve a armar para completar lo que quedó sin enviar (lo enviado se conserva).
  if (estado !== "recibida" && estado !== "pedido_a_proveedor") return MENSAJES.noRecibida;
  return null;
}

export function armarPedidos(reserva: ReservaParaPedidos, catalogo: CatalogoParaPedidos, plantilla: Plantilla): ResultadoArmado {
  const noSeArma = porQueNoSeArma(reserva.estado);
  if (noSeArma) return { ok: false, error: noSeArma };

  const armado = new Armado(reserva, catalogo);
  armado.recorrer();
  const datosAsunto = asuntoYReferencia(reserva, catalogo);
  const avisos = [...armado.avisos];
  if (datosAsunto.pasajero === "sin nombre") avisos.push("La reserva no trae el nombre del pasajero principal: completalo en el asunto y el texto.");
  if (!datosAsunto.pax) avisos.push('La reserva no trae la cantidad de pasajeros: completala en el asunto ("x N") y en el texto.');

  const pedidos: PedidoArmado[] = agruparPorCasilla(armado.items)
    .map((g) => ({ ...g, items: [...g.items].sort(porFecha) }))
    .sort((a, b) => porFecha(a.items[0], b.items[0]))
    .map((g) => {
      const ficha = g.items.some((it) => llevaFichaCompleta(catalogo.fichaCompleta ?? [], it.proveedor));
      const { servicios, pasajeros } = ficha
        ? conFichaCompleta(reserva, g.items)
        : { servicios: textoDeServicios(g.items), pasajeros: bloquePasajeros(reserva, g.items.some((it) => it.datosPax)) };
      const pendientes = [...new Set(g.items.flatMap((it) => it.pendientes))].join("\n");
      const proveedores = [...new Map(g.items.map((it) => [it.proveedor.id, { id: it.proveedor.id, nombre: it.proveedor.nombre }])).values()];
      return {
        casilla: g.casilla,
        destinatarios: g.destinatarios,
        proveedores,
        partes: g.items.map((it) => it.cubre),
        // M3-16: las fechas son las de los servicios de ESTE pedido, no las de toda la reserva.
        asunto: completarAsunto(plantilla.asunto, { ...datosAsunto, fechas: fechasDelAsunto(g.items.flatMap((it) => [it.fecha, it.hasta])) }),
        cuerpo: comoSeEscribe(
          completar(plantilla.cuerpo, {
            servicios,
            pasajeros,
            pendientes,
          }),
        ),
        firma: plantilla.firma,
        sinDestinatario: g.sinDestinatario,
        // M3-24: los blackouts de la salida y de las partes que cubre, antes que los avisos de cada servicio.
        avisos: [...new Set([...armado.blackoutsDe(g.items.map((it) => it.cubre.parteId)), ...g.items.flatMap((it) => it.avisos)].map(comoSeEscribe))],
      };
    });

  return { ok: true, pedidos, tareas: armado.tareasFinales(), avisos: [...new Set(avisos.map(comoSeEscribe))], itinerario: armado.textosDelItinerario() };
}

/**
 * M3-24: los avisos del itinerario de una reserva ("Revisar antes de pedir", arriba del detalle), con
 * el mismo recorrido que el armado pero sin armar ni guardar nada y en cualquier estado (una reserva
 * para revisión también los muestra). Sin las reglas o sin producto, ninguno.
 */
export function itinerarioDeLaReserva(reserva: ReservaParaPedidos, catalogo: CatalogoParaPedidos): string[] {
  if (!catalogo.itinerario) return [];
  const armado = new Armado(reserva, catalogo);
  armado.recorrer();
  return armado.textosDelItinerario();
}

