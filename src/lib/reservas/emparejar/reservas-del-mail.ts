import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FilaLlamadaIA, RegistroLlamadasIA } from "@/lib/ia/registro-llamadas";
import { cargarProducto } from "@/lib/catalogo/consultas";
import type { DetalleProducto } from "@/lib/catalogo/tipos";
import { separarAvisosDeVuelo } from "../avisos-vuelo";
import type { FichaLectura, ProductoIA } from "../esquema-ficha";
import type { ResultadoLectura } from "../extraer";
import { armarJournaway, type DependenciasJournaway } from "../journaway/armar";
import { cargarCatalogoJournaway } from "../journaway/catalogo";
import { ARCHIVO_SENALES_JOURNAWAY, leerSenalesJournaway, verificarSenales } from "../journaway/senales";
import type { MailParaLeer } from "../preparar-mail";
import { crearReserva } from "../guardar";
import type { ComponenteEntrada, Reserva, ReservaComponente, ReservaEntrada } from "../tipos";
import type { LectorDeAgencia } from "./agencias";
import { cargarCatalogoParaEmparejar, type CatalogoParaEmparejar } from "./catalogo";
import { componentesDeLaReserva, PROVEEDOR_TRANSFER_PNT, saleDePuertoNatales } from "./componentes";
import { emparejarProducto, type ProponerProducto, type ResultadoEmparejado } from "./emparejar";
import { MOTIVOS_EMPAREJADO as M } from "./motivos";
import { ARCHIVO_PRODUCTOS_NO_CARGADOS, leerProductosNoCargados, type ProductoNoCargado } from "./productos-no-cargados";
import { motivosDeVuelos } from "./vuelos-requeridos";

/**
 * De la ficha de M2-02 a las reservas (spec M2-03 filas 8, 13 y 14): una
 * reserva por producto, con el mismo booking_id, cada una con su estado. Con
 * producto reconocido y sin motivos queda "recibida"; con uno o más motivos,
 * "para revisión" con todos. Solo las "reserva nueva" se emparejan del todo
 * (con IA, partes y vuelos); el resto queda para revisión.
 *
 * `armarReservas` no toca la base (sus dependencias se inyectan);
 * `crearReservasDelMail` las guarda (`crearReserva` de M2-01, que agrega la
 * entrada "creada" del historial con autor "el sistema") y registra cada
 * llamada a la IA con su reserva. Nunca escribe en el catálogo (fila 16).
 */

export interface DependenciasReservas {
  catalogo: CatalogoParaEmparejar;
  /** El detalle de un producto (`cargarProducto`, con los ajustes de M1-08). */
  detalle: (productoId: string) => Promise<DetalleProducto>;
  proponer?: ProponerProducto;
  proveedorTransferPNT: { id: string; nombre: string } | null;
  lectores?: Readonly<Record<string, LectorDeAgencia>>;
  /** Productos conocidos que todavía no están cargados (owner 2026-10-14). */
  noCargados?: readonly ProductoNoCargado[];
  /** M2-09: los paquetes armados de Journaway y sus señales. Sin esto, Journaway va por el camino general. */
  journaway?: DependenciasJournaway;
}

export type EntradaArmada = Omit<ReservaEntrada, "mailRecibidoId" | "dePrueba" | "motivosRevision"> & {
  motivosRevision: string[];
  productoId: string | null;
  componentes: ComponenteEntrada[];
};

export interface ReservaArmada {
  entrada: EntradaArmada;
  /** Las llamadas a la IA de esta reserva, para registrarlas con su id. */
  llamadas: FilaLlamadaIA[];
  costo: number;
  /**
   * Owner 2026-10-16: los vuelos que faltan ("Falta el vuelo…"), que ya no son
   * motivo de revisión. No se guardan (`avisos-vuelo.ts` los recalcula): van
   * para el reporte del modo prueba.
   */
  avisos: string[];
  /** El producto del mail del que sale esta reserva (null si el mail no trae ninguno). */
  productoIA: ProductoIA | null;
}

const textoAgencia = (p: Pick<ProductoIA, "nombre" | "codigo">) =>
  p.codigo && p.nombre ? `${p.nombre} (${p.codigo})` : (p.codigo ?? p.nombre);

function base(ficha: FichaLectura | null, agencia: string): Omit<EntradaArmada, "estado"> {
  return {
    agencia,
    bookingId: ficha?.numero_reserva.limpio ?? null,
    productoId: null,
    productoTextoAgencia: null,
    fechaInicio: ficha?.fecha_inicio.valor ?? null,
    fechaFin: ficha?.fecha_fin.valor ?? null,
    pax: ficha?.pax.valor && ficha.pax.valor > 0 ? ficha.pax.valor : null,
    pasajeros: ficha?.pasajeros ?? [],
    vuelos: ficha?.vuelos ?? [],
    habitacion: null,
    pedidosEspeciales: ficha?.pedidos_especiales.length ? ficha.pedidos_especiales.map((p) => p.texto).join("\n") : null,
    motivosRevision: [],
    datosExtraidos: ficha,
    origenEmparejado: null,
    confianzaEmparejado: null,
    sugerenciaProductoId: null,
    componentes: [],
  };
}

function cerrar(entrada: Omit<EntradaArmada, "estado">): EntradaArmada {
  const motivos = [...new Set(entrada.motivosRevision)];
  return { ...entrada, motivosRevision: motivos, estado: motivos.length ? "para_revision" : "recibida" };
}

const ddmmaaaa = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * TourRadar (owner 2026-10-16): un número de reserva es UNA reserva. El
 * estado de cuenta puede listar, además del tour, noches de hotel u otros
 * extras (1363612: "Hotel La Aldea 4*"): van dentro de la misma reserva, como
 * pedidos especiales. El tour es el que empieza en la fecha de inicio del
 * statement (si no, el primero). Kilroy no cambia: un mail con varias
 * reservas del mismo número se parte por producto.
 */
function productosDelMail(ficha: FichaLectura, agencia: string): { productos: ProductoIA[]; extras: ProductoIA[] } {
  if (agencia !== "TourRadar" || ficha.productos.length < 2) return { productos: ficha.productos, extras: [] };
  const inicio = ficha.fecha_inicio.valor;
  const principal = ficha.productos.find((p) => !!inicio && p.fecha_inicio === inicio) ?? ficha.productos[0];
  return { productos: [principal], extras: ficha.productos.filter((p) => p !== principal) };
}

/** "También en el estado de cuenta: Hotel La Aldea 4* (SGL, 1 noche, 10/10/2026 al 11/10/2026)". */
function textoDeExtra(p: ProductoIA): string {
  const fechas =
    p.fecha_inicio && p.fecha_fin
      ? `${ddmmaaaa(p.fecha_inicio)} al ${ddmmaaaa(p.fecha_fin)}`
      : p.fecha_inicio
        ? `desde ${ddmmaaaa(p.fecha_inicio)}`
        : null;
  const noches = p.noches ? `${p.noches} ${p.noches === 1 ? "noche" : "noches"}` : null;
  const detalle = [p.habitacion, noches, fechas].filter(Boolean).join(", ");
  return `También en el estado de cuenta: ${p.nombre}${detalle ? ` (${detalle})` : ""}`;
}

/**
 * M2-09: Journaway manda una lista de tours sueltos. El reconocedor de
 * `journaway/` arma los paquetes y `armarJournaway` las reservas; acá se
 * cierran con los mismos campos que las demás agencias.
 */
async function armarDeJournaway(ficha: FichaLectura, deps: DependenciasReservas, mail: MailParaLeer | null): Promise<ReservaArmada[]> {
  const { piezas, llamadas, costo } = await armarJournaway(
    ficha,
    { catalogo: deps.catalogo, journaway: deps.journaway!, detalle: deps.detalle, proponer: deps.proponer },
    mail,
  );
  return piezas.map((p, i) => {
    const entrada = base(ficha, "Journaway");
    Object.assign(entrada, {
      productoId: p.productoId,
      origenEmparejado: p.origenEmparejado,
      confianzaEmparejado: p.confianzaEmparejado,
      sugerenciaProductoId: p.sugerenciaProductoId,
      productoTextoAgencia: p.productoTextoAgencia,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      pasajeros: p.pasajeros,
      pedidosEspeciales: p.pedidosEspeciales,
      componentes: p.componentes,
      motivosRevision: p.motivos,
      tripNumber: p.tripNumber,
      hotelesAgencia: p.hotelesAgencia,
      contactoCliente: p.contactoCliente,
      notas: p.notas,
      sinTrasladoDe: p.sinTrasladoDe,
    });
    // Las llamadas a la IA (propuesta de un tour) son del mail: van con la primera reserva.
    return { entrada: cerrar(entrada), llamadas: i === 0 ? llamadas : [], costo: i === 0 ? costo : 0, avisos: p.avisos, productoIA: p.productoIA };
  });
}

export async function armarReservas(
  lectura: FichaLectura | ResultadoLectura,
  deps: DependenciasReservas,
  opciones: { agencia?: string; mail?: MailParaLeer | null } = {},
): Promise<ReservaArmada[]> {
  if ("estado" in lectura && lectura.estado === "para_revision") {
    const entrada = base(null, opciones.agencia ?? "desconocida");
    entrada.motivosRevision = [M.lecturaFallida(lectura.motivo)];
    return [{ entrada: cerrar(entrada), llamadas: [], costo: 0, avisos: [], productoIA: null }];
  }
  const ficha: FichaLectura = "estado" in lectura ? lectura.ficha : lectura;
  const agencia = ficha.agencia.valor ?? opciones.agencia ?? "desconocida";
  const tipo = ficha.tipo_mail.valor;
  const dudosos = ficha.datos_dudosos.length ? [M.dudosos(ficha.datos_dudosos)] : [];

  if (ficha.productos.length === 0) {
    const entrada = base(ficha, agencia);
    entrada.motivosRevision = [tipo === "reserva_nueva" ? M.sinProducto : M.tipoMail[tipo], ...dudosos];
    return [{ entrada: cerrar(entrada), llamadas: [], costo: 0, avisos: [], productoIA: null }];
  }

  if (agencia === "Journaway" && deps.journaway) return armarDeJournaway(ficha, deps, opciones.mail ?? null);

  const { productos, extras } = productosDelMail(ficha, agencia);
  const armadas: ReservaArmada[] = [];
  for (const p of productos) {
    const entrada = base(ficha, agencia);
    if (extras.length) {
      entrada.pedidosEspeciales = [entrada.pedidosEspeciales, ...extras.map(textoDeExtra)].filter(Boolean).join("\n");
    }
    entrada.productoTextoAgencia = textoAgencia(p);
    entrada.fechaInicio = p.fecha_inicio ?? (productos.length === 1 ? entrada.fechaInicio : null);
    entrada.fechaFin = p.fecha_fin ?? (productos.length === 1 ? entrada.fechaFin : null);
    entrada.habitacion = p.habitacion;
    const pedido = { nombre: p.nombre, codigo: p.codigo, fechaInicio: p.fecha_inicio, fechaFin: p.fecha_fin };

    // Fila 13: lo que no es una reserva nueva no gasta IA ni arma partes (pasos 1 y 2 sí, son gratis).
    const r: ResultadoEmparejado = await emparejarProducto(pedido, {
      agencia,
      catalogo: deps.catalogo,
      proponer: tipo === "reserva_nueva" ? deps.proponer : undefined,
      lectores: deps.lectores,
      noCargados: deps.noCargados,
    });

    const motivos: string[] = [];
    let avisos: string[] = [];
    if (tipo !== "reserva_nueva") {
      motivos.push(M.tipoMail[tipo]);
    } else if (!r.producto) {
      motivos.push(r.motivo!);
    }
    if (r.producto) {
      entrada.productoId = r.producto.id;
      entrada.origenEmparejado = r.origen;
      entrada.confianzaEmparejado = r.confianza;
    }
    entrada.sugerenciaProductoId = r.sugerencia?.producto.id ?? null;

    if (r.producto && tipo === "reserva_nueva") {
      const detalle = await deps.detalle(r.producto.id);
      const finalPuertoNatales = saleDePuertoNatales(ficha);
      entrada.componentes = componentesDeLaReserva(detalle, entrada.fechaInicio ?? null, {
        finalPuertoNatales,
        proveedorTransferPNT: deps.proveedorTransferPNT,
      });
      // Owner 2026-10-16: el vuelo que falta es un aviso; solo "elegir la variante" queda como motivo.
      const vuelos = separarAvisosDeVuelo(
        motivosDeVuelos(detalle, {
          vuelos: ficha.vuelos,
          pedidos: ficha.pedidos_especiales.map((x) => x.texto),
          producto: { ...p, fecha_inicio: entrada.fechaInicio ?? null, fecha_fin: entrada.fechaFin ?? null },
          finalPuertoNatales,
        }),
      );
      motivos.push(...vuelos.motivos);
      avisos = vuelos.avisos;
      if (!entrada.fechaInicio) motivos.push(M.sinFechaInicio);
    }
    entrada.motivosRevision = [...motivos, ...dudosos];
    armadas.push({ entrada: cerrar(entrada), llamadas: r.llamada ? [r.llamada] : [], costo: r.costo, avisos, productoIA: p });
  }
  return armadas;
}

/**
 * Crea las reservas del mail en la base y registra cada llamada a la IA con su
 * reserva. Una reserva que no se pudo crear corta (el error sube); las
 * llamadas ya hechas se registran igual, sin reserva.
 */
export async function crearReservasDelMail(
  lectura: FichaLectura | ResultadoLectura,
  opciones: {
    admin: SupabaseClient;
    mailRecibidoId: string;
    agencia: string;
    deps: DependenciasReservas;
    llamadas?: RegistroLlamadasIA;
    dePrueba?: boolean;
  },
): Promise<Array<{ reserva: Reserva; componentes: ReservaComponente[]; costo: number }>> {
  const armadas = await armarReservas(lectura, opciones.deps, { agencia: opciones.agencia });
  const creadas: Array<{ reserva: Reserva; componentes: ReservaComponente[]; costo: number }> = [];
  const pendientes = armadas.flatMap((a) => a.llamadas);
  try {
    for (const a of armadas) {
      const { reserva, componentes } = await crearReserva(
        { ...a.entrada, mailRecibidoId: opciones.mailRecibidoId, dePrueba: opciones.dePrueba ?? false },
        opciones.admin,
      );
      for (const l of a.llamadas) {
        await opciones.llamadas?.registrar({ ...l, reservaId: reserva.id, dePrueba: opciones.dePrueba ?? l.dePrueba });
        pendientes.splice(pendientes.indexOf(l), 1);
      }
      creadas.push({ reserva, componentes, costo: a.costo });
    }
  } finally {
    for (const l of pendientes) await opciones.llamadas?.registrar({ ...l, reservaId: null });
  }
  return creadas;
}

/**
 * Las dependencias reales: el catálogo de la base, el detalle de cada
 * producto con la misma lectura que la pantalla (`cargarProducto`) y el
 * proveedor del transfer al aeropuerto PNT (Patagonia Planet, DECISIONS
 * 2026-10-06), y los productos conocidos que todavía no están cargados
 * (`data/productos-no-cargados.csv`). Solo lectura.
 */
export async function cargarDependenciasReservas(
  admin: SupabaseClient,
  proponer?: ProponerProducto,
): Promise<DependenciasReservas> {
  const [catalogo, proveedor] = await Promise.all([
    cargarCatalogoParaEmparejar(admin),
    admin.from("proveedor").select("id,nombre").ilike("nombre", PROVEEDOR_TRANSFER_PNT).limit(1).maybeSingle(),
  ]);
  if (proveedor.error) throw new Error(`No se pudo leer el proveedor del transfer a PNT: ${proveedor.error.message}`);
  const detalle = (id: string) => cargarProducto(admin, id);
  // M2-09: las señales de Journaway se validan contra el catálogo antes de usar nada (un código que no existe frena).
  const senales = leerSenalesJournaway(readFileSync(join(process.cwd(), "data", ARCHIVO_SENALES_JOURNAWAY), "utf-8"));
  verificarSenales(senales, catalogo);
  return {
    catalogo,
    detalle,
    journaway: { catalogo: await cargarCatalogoJournaway(catalogo, detalle), senales },
    proponer,
    proveedorTransferPNT: (proveedor.data as { id: string; nombre: string } | null) ?? null,
    noCargados: leerProductosNoCargados(readFileSync(join(process.cwd(), "data", ARCHIVO_PRODUCTOS_NO_CARGADOS), "utf-8")),
  };
}
