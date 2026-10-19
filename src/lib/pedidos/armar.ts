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
  agruparPorOrden,
  esDeJournaway,
  estadoServicio,
  ladosDeUnTraslado,
  normalizarTexto,
  pasosDelTour,
  queEs,
  type Lado,
  type PasoConLlegada,
} from "@/lib/catalogo/reglas";
import type { DetalleProducto, ProveedorResumen, Servicio, TipoServicio } from "@/lib/catalogo/tipos";
import { TRANSFER_PNT } from "@/lib/reservas/emparejar/componentes";
import { lugarDelTraslado } from "@/lib/reservas/emparejar/vuelos-requeridos";
import { completar } from "./plantilla";
import {
  diasEntre,
  fechaCorta,
  nivelDeLaHabitacion,
  nombreDelPasajero,
  rangoCorto,
  renglonDelPasajero,
  sumarDias,
  tipoDeHabitacion,
} from "./formato";
import type {
  CatalogoParaPedidos,
  ParteCubierta,
  ParteParaPedidos,
  PedidoArmado,
  Plantilla,
  ReservaParaPedidos,
  ResultadoArmado,
  TareaArmada,
  VueloDeReserva,
} from "./tipos";

export const MENSAJES = {
  paraRevision: "Resolvé primero lo que está para revisión.",
  noRecibida: "Solo se arman pedidos de reservas recibidas.",
  sinMail: (proveedor: string) => `Falta el mail de ${proveedor}: completalo en el directorio de proveedores.`,
} as const;

/** Destinos que conservan sus traslados aunque estén en el medio del tour (M1-08). */
const IGUAZU = new Set(["IGR", "IGU"]);
const PRIVADO = /\b(privad[oa]|private)\b/i;
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
  seq: number;
  cubre: ParteCubierta;
  /** El pedido lleva los datos de los pasajeros (alojamiento y excursiones). */
  datosPax: boolean;
  avisos: string[];
  /** Lo que todavía falta y se le avisa al proveedor ("vuelo"). */
  pendientes: string[];
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
}

const PENDIENTE = {
  vuelo: "El vuelo todavía no lo tenemos: se lo pasamos apenas nos llegue.",
  busOVuelo: "Todavía no sabemos si llegan en bus o en vuelo: se lo pasamos apenas nos llegue.",
};

class Armado {
  readonly items: Item[] = [];
  readonly tareas: Array<TareaArmada & { fecha: string | null; seq: number }> = [];
  readonly avisos: string[] = [];
  private readonly whatsapp = new Map<string, { proveedor: ProveedorResumen; cosas: string[]; fecha: string | null; seq: number }>();
  private seq = 0;

  constructor(
    private readonly reserva: ReservaParaPedidos,
    private readonly catalogo: CatalogoParaPedidos,
  ) {}

  // --- Recorrido -----------------------------------------------------------------------

  recorrer(): void {
    const r = this.reserva;
    const principal = r.productoId ? this.catalogo.detalles.get(r.productoId) ?? null : null;
    if (r.partes.length === 0) {
      if (!principal) {
        this.tarea("revisar", "Revisar a mano: la reserva no tiene un producto del catálogo, no se pueden armar los pedidos.", {}, null);
        return;
      }
      if (principal.esTour) {
        this.tarea("revisar", `Revisar a mano: la reserva de ${principal.codigo} no tiene sus partes, no se pueden armar los pedidos.`, {}, null);
        return;
      }
      this.bloque({
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
      });
      return;
    }
    for (const parte of [...r.partes].sort((a, b) => a.orden - b.orden)) this.parte(parte);
  }

  private omitir(): Lado[] {
    return this.reserva.sinTrasladoDe === "salida" ? ["out"] : this.reserva.sinTrasladoDe === "llegada" ? ["in"] : [];
  }

  private parte(parte: ParteParaPedidos): void {
    if (parte.esTarea) {
      const ruta = parte.descripcionRuta ?? parte.textoAgencia ?? "bus";
      this.tarea("emitir_boleto", `Emitir boleto: ${ruta}${parte.fechaInicio ? `, ${fechaCorta(parte.fechaInicio)}` : ""}`, { parteId: parte.id, ruta }, parte.fechaInicio);
      return;
    }
    if (parte.tipo === "servicio") return this.parteServicio(parte);
    if (parte.tipo === "tramo_bus") {
      this.tarea("revisar", `Revisar a mano: ${parte.descripcionRuta ?? "un tramo de bus"} no dice quién lo reserva.`, { parteId: parte.id }, parte.fechaInicio);
      return;
    }
    if (!parte.productoId) {
      const que = parte.textoAgencia ?? parte.descripcionRuta ?? "una parte de la reserva";
      this.tarea("revisar", `Pedir a mano: "${que}" no se reconoció en el catálogo.`, { parteId: parte.id }, parte.fechaInicio);
      return;
    }
    const ubicado = this.ubicar(parte);
    if (!ubicado) {
      this.tarea("revisar", `Revisar a mano: no se encontró en el catálogo el producto de la parte ${parte.orden}.`, { parteId: parte.id }, parte.fechaInicio);
      return;
    }
    this.bloque({
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
    });
  }

  /** Dónde está el producto de una parte: dentro del tour (con sus ajustes) o suelto. */
  private ubicar(parte: ParteParaPedidos):
    | { producto: { codigo: string; destino: string | null }; servicios: Servicio[]; llegaEnBus: boolean; saleEnBus: boolean; dePrincipal: boolean }
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
      };
    }
    const suelto = this.catalogo.detalles.get(parte.productoId!);
    if (!suelto || suelto.esTour) return null;
    return { producto: suelto, servicios: suelto.servicios, llegaEnBus: false, saleEnBus: false, dePrincipal: suelto.id === r.productoId };
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
      this.agregar(proveedor, "traslado", renglones, t.fecha, cubre, false, [], t.pendientes);
      return;
    }
    const nocturno = !!parte.fechaInicio && !!parte.fechaFin && parte.fechaFin > parte.fechaInicio;
    const renglones = [`Bus: ${que}`, `Fecha: ${parte.fechaInicio ? fechaCorta(parte.fechaInicio) : "a confirmar"}${nocturno ? " (nocturno)" : ""}`];
    this.agregar(proveedor, "bus", renglones, parte.fechaInicio, cubre, false, [], []);
  }

  // --- Un paquete -------------------------------------------------------------------------

  private bloque(b: Bloque): void {
    const nivel = nivelDeLaHabitacion(this.reserva.habitacion);
    const grupos = agruparPorOrden(b.servicios);
    const alojamientos = grupos.filter((g) => g[0].tipo === "alojamiento" && g[0].ajusteTour?.accion !== "anular");
    const niveles = new Set(alojamientos.map((g) => g[0].nivel));
    let nivelElegido: string | null | undefined = undefined;
    if (niveles.size === 1) nivelElegido = [...niveles][0];
    else if (nivel && niveles.has(nivel)) nivelElegido = nivel;
    else if (alojamientos.length > 0) {
      const hab = this.reserva.habitacion ? `la habitación "${this.reserva.habitacion}"` : "la reserva";
      this.tarea(
        "revisar",
        `Elegir el hotel de ${b.codigo}: ${hab} no dice el nivel de alojamiento (${[...niveles].filter(Boolean).join(", ")}). Pedilo a mano.`,
        { parteId: b.parteId, producto: b.codigo },
        b.inicio,
      );
    }

    for (const grupo of grupos) {
      const s = grupo[0];
      if (s.ajusteTour?.accion === "anular") continue;
      if (s.tipo === "alojamiento" && (nivelElegido === undefined || s.nivel !== nivelElegido)) continue;
      const nombre = this.nombre(s);
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
      const otras = grupo.slice(1).map((x) => this.nombre(x)).filter((x) => x && x !== nombre);
      const avisoOpciones = otras.length ? [`${nombre}: se tomó la primera opción del catálogo (otras: ${otras.join(", ")}).`] : [];
      this.servicio(b, s, avisoOpciones);
    }
  }

  private nombre(s: Servicio): string {
    if (s.ajusteTour?.accion === "reemplazar" && s.ajusteTour.texto) return s.ajusteTour.texto;
    return queEs(s) || s.serviceProviderNombre || s.descripcion || "servicio";
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
  private servicio(b: Bloque, s: Servicio, avisos: string[]): void {
    const nombre = this.nombre(s);
    const tramos = s.tramosNoches?.length ? s.tramosNoches : [null];
    for (const tramo of tramos) {
      const desde = b.inicio && tramo ? sumarDias(b.inicio, tramo.nocheDesde - 1) : b.inicio;
      const hasta = b.inicio && tramo ? sumarDias(b.inicio, tramo.nocheDesde - 1 + tramo.noches) : b.fin;
      const armados = this.renglones(b, s, nombre, desde, hasta);
      for (const a of armados) this.destino(b, s, nombre, a, avisos);
    }
  }

  /** A quién va: mail, WhatsApp, a mano o sin proveedor. */
  private destino(b: Bloque, s: Servicio, nombre: string, a: Renglones, avisos: string[]): void {
    const cuando = a.resumen;
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
      previo.cosas.push(`${nombre}${cuando ? `, ${cuando}` : ""}`);
      this.whatsapp.set(proveedor.id, previo);
      return;
    }
    const cubre: ParteCubierta = { parteId: b.parteId, productoServicioId: s.id, producto: b.codigo, fecha: a.fecha };
    this.agregar(proveedor, s.tipo, a.renglones, a.fecha, cubre, a.datosPax, [...avisos, ...a.avisos], a.pendientes);
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
  ): void {
    this.items.push({ proveedor, tipo, renglones, fecha, seq: this.seq++, cubre, datosPax, avisos, pendientes });
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
      case "crucero":
        return [this.excursion(b, s, nombre, desde, hasta)];
      case "bus":
        return [this.bus(b, s, nombre)];
      default:
        return [this.otro(nombre, desde, hasta)];
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
    if (hab) renglones.push(`Habitación: ${hab}`);
    return { renglones, fecha: desde, resumen: desde && hasta ? `IN ${fechaCorta(desde)}, OUT ${fechaCorta(hasta)}` : "", queParaTarea: hotel, datosPax: true, avisos, pendientes: [] };
  }

  private fechaDeExcursion(b: Bloque, s: Servicio, desde: string | null, hasta: string | null): string | null {
    if (s.tramosNoches?.length && desde) return desde;
    if (b.inicio && b.fin && b.inicio === b.fin) return b.inicio;
    const dia = this.catalogo.dias.find((d) => d.codigo === b.codigo && d.orden === s.orden)?.dia;
    if (dia && b.inicio) return sumarDias(b.inicio, dia - 1);
    return desde && hasta && desde === hasta ? desde : null;
  }

  private excursion(b: Bloque, s: Servicio, nombre: string, desde: string | null, hasta: string | null): Renglones {
    const regular = PRIVADO.test(`${s.descripcion ?? ""} ${nombre}`) ? "privado" : "regular";
    const incluye = (s.descripcion ?? "").match(INCLUYE_TRASLADOS);
    if (incluye) return this.paqueteConTraslados(b, nombre, incluye[1], regular);

    const fecha = this.fechaDeExcursion(b, s, desde, hasta);
    const renglones = [`Excursión: ${nombre}`];
    const avisos: string[] = [];
    if (fecha) renglones.push(`Fecha: ${fechaCorta(fecha)}`);
    else {
      renglones.push(desde && hasta ? `Fecha: a coordinar (estadía ${rangoCorto(desde, hasta)})` : "Fecha: a coordinar");
      avisos.push(`Falta la fecha de ${nombre}: completala antes de enviar.`);
    }
    renglones.push(`Servicio: ${regular} · Idioma: inglés`);
    if (b.pickUp) renglones.push(`Pick up: ${b.pickUp}`);
    return { renglones, fecha: fecha ?? desde, resumen: fecha ? fechaCorta(fecha) : "fecha a coordinar", queParaTarea: nombre, datosPax: true, avisos, pendientes: [] };
  }

  /**
   * El paquete receptivo de Iguazú (105 Premium de Cuenca del Plata): traslado de
   * llegada el primer día, cada excursión en los días siguientes y traslado de
   * salida el último día, como se pide hoy a mano.
   */
  private paqueteConTraslados(b: Bloque, nombre: string, lista: string, regular: string): Renglones {
    const titulo = nombre.replace(/^Paquete\s+Rece?pti?vo\s+/i, "Paquete ");
    const codigos = IGUAZU.has(b.destino ?? "") ? ["IGR", "IGU"] : (lugarDelTraslado("", b.destino)?.codigos ?? []);
    const renglones = [titulo];
    const pendientes: string[] = [];
    const llegada = this.traslado("in", "", b.inicio, codigos, IGUAZU.has(b.destino ?? ""));
    if (!b.omitir.includes("in")) {
      renglones.push(`TRF IN, ${regular}: ${b.inicio ? fechaCorta(llegada.fecha ?? b.inicio) : "a confirmar"} · ${llegada.dato}`);
      pendientes.push(...llegada.pendientes);
    }
    const excursiones = lista
      .split(/\s*,\s*/)
      .map((e) => e.replace(/^Excursi[oó]n\s+/i, "").trim())
      .filter(Boolean);
    excursiones.forEach((e, i) => {
      const lado = /argentin/i.test(e) ? "Lado argentino" : /brasil/i.test(e) ? "Lado brasileño" : e;
      const fecha = b.inicio ? sumarDias(b.inicio, i + 1) : null;
      renglones.push(`${lado}, ${regular} en inglés: ${fecha ? fechaCorta(fecha) : "a coordinar"}`);
    });
    const salida = this.traslado("out", "", b.fin, codigos, IGUAZU.has(b.destino ?? ""));
    if (!b.omitir.includes("out")) {
      renglones.push(`TRF OUT, ${regular}: ${b.fin ? fechaCorta(salida.fecha ?? b.fin) : "a confirmar"} · ${salida.dato}`);
      pendientes.push(...salida.pendientes);
    }
    if (b.pickUp) renglones.push(`Pick up: ${b.pickUp}`);
    return { renglones, fecha: b.inicio, resumen: b.inicio && b.fin ? rangoCorto(b.inicio, b.fin) : "", queParaTarea: titulo, datosPax: true, avisos: [], pendientes };
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
    return lados
      .filter((l) => !b.omitir.includes(l))
      .filter((l) => !(l === "in" && b.llegaEnBus) && !(l === "out" && b.saleEnBus))
      .map((l) => this.unTraslado(b, s, nombre, l, l === "in" ? desde : hasta));
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

  /** El vuelo del traslado (o "vuelo pendiente"; en Iguazú, "bus o vuelo pendiente"). */
  private traslado(lado: Lado, _nombre: string, fecha: string | null, codigos: string[], iguazu: boolean) {
    const vuelo = buscarVuelo(this.reserva.vuelos, lado, codigos, fecha);
    if (vuelo) {
      const aeropuerto = (lado === "in" ? vuelo.destino : vuelo.origen)?.toUpperCase();
      const hora = lado === "in" ? vuelo.hora_llegada : vuelo.hora_salida;
      const dia = (lado === "in" ? vuelo.fecha_llegada : vuelo.fecha_salida) ?? fecha;
      const dato = `Vuelo: ${vuelo.numero}${aeropuerto ? ` (${aeropuerto})` : ""} ${lado === "in" ? "llegada" : "salida"}${hora ? ` ${hora} hs` : ""}`;
      return { dato, fecha: dia, pendientes: [] as string[] };
    }
    return iguazu
      ? { dato: "Bus o vuelo pendiente", fecha, pendientes: [PENDIENTE.busOVuelo] }
      : { dato: "Vuelo pendiente", fecha, pendientes: [PENDIENTE.vuelo] };
  }

  private bus(b: Bloque, s: Servicio, nombre: string): Renglones {
    const dia = (s.descripcion ?? "").match(/d[ií]a (\d+) del (tour|overland)/i);
    const fecha = dia && b.inicio ? sumarDias(b.inicio, Number(dia[1]) - 1) : b.fin;
    const nocturno = /nocturno|overnight|night bus/i.test(s.descripcion ?? "");
    const renglones = [`Bus: ${nombre}`, `Fecha: ${fecha ? fechaCorta(fecha) : "a confirmar"}${nocturno ? " (nocturno)" : ""}`];
    return { renglones, fecha, resumen: fecha ? fechaCorta(fecha) : "", queParaTarea: nombre, datosPax: false, avisos: [], pendientes: [] };
  }

  private otro(nombre: string, desde: string | null, hasta: string | null): Renglones {
    const renglones = [nombre];
    if (desde && hasta && desde !== hasta) renglones.push(`Desde: ${fechaCorta(desde)} · Hasta: ${fechaCorta(hasta)}`);
    else renglones.push(`Fecha: ${desde ? fechaCorta(desde) : "a confirmar"}`);
    return { renglones, fecha: desde, resumen: desde && hasta ? rangoCorto(desde, hasta) : desde ? fechaCorta(desde) : "", queParaTarea: nombre, datosPax: true, avisos: [], pendientes: [] };
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
      .map(({ tipo, texto, detalle }) => ({ tipo, texto, detalle }));
  }
}

interface Renglones {
  renglones: string[];
  fecha: string | null;
  /** La fecha (y el vuelo) en una línea, para las tareas. */
  resumen: string;
  queParaTarea: string;
  datosPax: boolean;
  avisos: string[];
  pendientes: string[];
}

/** El vuelo que llega (o sale) de uno de esos aeropuertos, el del día del traslado primero. */
export function buscarVuelo(vuelos: readonly VueloDeReserva[], lado: Lado, codigos: string[], fecha: string | null): VueloDeReserva | null {
  const candidatos = vuelos.filter((v) => {
    if (!v.numero) return false;
    const aeropuerto = (lado === "in" ? v.destino : v.origen)?.trim().toUpperCase() ?? null;
    const dia = lado === "in" ? v.fecha_llegada : v.fecha_salida;
    if (aeropuerto && codigos.length) return codigos.includes(aeropuerto);
    return !!fecha && dia === fecha;
  });
  const delDia = candidatos.find((v) => (lado === "in" ? v.fecha_llegada : v.fecha_salida) === fecha);
  return delDia ?? candidatos[0] ?? null;
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
    pax: String(reserva.pax ?? (reserva.pasajeros.length || "?")),
    producto: codigos.join(" + ") || "sin producto",
    referencia: reserva.numero?.trim() ? ` · Ref. ${reserva.numero.trim()}` : "",
  };
}

/** Por qué no se arman pedidos para una reserva en ese estado (fila 10); null si se puede. */
export function porQueNoSeArma(estado: ReservaParaPedidos["estado"]): string | null {
  if (estado === "para_revision") return MENSAJES.paraRevision;
  if (estado !== "recibida") return MENSAJES.noRecibida;
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

  const pedidos: PedidoArmado[] = agruparPorCasilla(armado.items)
    .map((g) => ({ ...g, items: [...g.items].sort(porFecha) }))
    .sort((a, b) => porFecha(a.items[0], b.items[0]))
    .map((g) => {
      const numerar = g.items.length > 1;
      const servicios = g.items.map((it, i) => (numerar ? [`${i + 1}) ${it.renglones[0]}`, ...it.renglones.slice(1)] : it.renglones).join("\n")).join("\n\n");
      const pendientes = [...new Set(g.items.flatMap((it) => it.pendientes))].join("\n");
      const proveedores = [...new Map(g.items.map((it) => [it.proveedor.id, { id: it.proveedor.id, nombre: it.proveedor.nombre }])).values()];
      return {
        casilla: g.casilla,
        destinatarios: g.destinatarios,
        proveedores,
        partes: g.items.map((it) => it.cubre),
        asunto: completar(plantilla.asunto, datosAsunto),
        cuerpo: completar(plantilla.cuerpo, {
          servicios,
          pasajeros: bloquePasajeros(reserva, g.items.some((it) => it.datosPax)),
          pendientes,
        }),
        firma: plantilla.firma,
        sinDestinatario: g.sinDestinatario,
        avisos: [...new Set(g.items.flatMap((it) => it.avisos))],
      };
    });

  return { ok: true, pedidos, tareas: armado.tareasFinales(), avisos: [...new Set(avisos)] };
}

