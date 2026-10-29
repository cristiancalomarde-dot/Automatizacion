import type { DetalleProducto } from "@/lib/catalogo/tipos";
import { TEXTOS } from "@/lib/textos";
import { esAvisoDeVuelo, separarAvisosDeVuelo } from "../avisos-vuelo";
import { saleDePuertoNatales } from "../emparejar/componentes";
import { DATO, MOTIVOS_EMPAREJADO as M } from "../emparejar/motivos";
import { motivosDeVuelos } from "../emparejar/vuelos-requeridos";
import { DATOS_CLAVE, type DatoClave, type FichaLectura, type VueloIA } from "../esquema-ficha";
import { MOTIVOS_INTERCAMBIO } from "../intercambio";
import type { EstadoReserva, VueloDeReserva } from "../tipos";
import { esFechaValida } from "./vuelos";

/**
 * Corregir vuelos y datos dudosos (spec M3-07 filas 4, 5 y 8), la parte pura:
 * qué motivos quedan y en qué estado queda la reserva. No toca la base: el
 * guardado está en `corregir.ts` (función `corregir_reserva`, 0022).
 *
 * Reusa lo del emparejado y de M3-05: los motivos de `motivos.ts`, los vuelos
 * que hacen falta (`motivosDeVuelos`) y la regla del owner 2026-10-16 (el
 * vuelo que falta es un aviso, no un motivo: `separarAvisosDeVuelo`).
 */

const R = TEXTOS.reserva.corregir.motivos;
const E = TEXTOS.reserva.corregir.errores;

export interface ReservaParaCorregir {
  estado: EstadoReserva;
  /** La agencia mandó una cancelación (al crearla o después). */
  cancelacion: boolean;
  motivos: string[];
  productoTexto: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  vuelos: VueloIA[];
  /** Tal como se guardan (uno por renglón). */
  pedidosEspeciales: string | null;
  sinTrasladoDe: "llegada" | "salida" | null;
  datosExtraidos: FichaLectura | null;
}

/** Fila 1: en cualquier estado salvo cerrada, descartada o cancelada por la agencia (null = se puede). */
export function porQueNoSeCorrige(r: Pick<ReservaParaCorregir, "estado" | "cancelacion">): string | null {
  if (r.estado === "cerrada") return R.cerrada;
  if (r.estado === "descartada") return R.descartada;
  if (r.cancelacion) return R.cancelada;
  return null;
}

// --- Los datos dudosos -----------------------------------------------------------------------

const PREFIJO_DUDOSOS = M.dudosos([]);
const POR_ETIQUETA = new Map<string, DatoClave>(DATOS_CLAVE.map((d) => [DATO[d], d]));

/** Los datos de un motivo "La IA no está segura de: …" (null si el motivo es otro). */
function datosDelMotivo(motivo: string): DatoClave[] | null {
  const texto = (motivo ?? "").trim();
  if (!texto.startsWith(PREFIJO_DUDOSOS)) return null;
  return texto
    .slice(PREFIJO_DUDOSOS.length)
    .split(", ")
    .map((e) => POR_ETIQUETA.get(e.trim()))
    .filter((d): d is DatoClave => !!d);
}

/** Fila 5: los datos que la IA marcó como dudosos, en el orden de `DATOS_CLAVE`. */
export function datosDudosos(motivos: readonly string[]): DatoClave[] {
  const todos = new Set(motivos.flatMap((m) => datosDelMotivo(m) ?? []));
  return DATOS_CLAVE.filter((d) => todos.has(d));
}

/** Saca esos datos de los motivos de dudosos; si un motivo se queda sin datos, se va. */
export function quitarDudosos(motivos: readonly string[], datos: readonly DatoClave[]): string[] {
  return motivos.flatMap((m) => {
    const del = datosDelMotivo(m);
    if (!del) return [m];
    const quedan = del.filter((d) => !datos.includes(d));
    return quedan.length ? [M.dudosos(quedan)] : [];
  });
}

/** Cómo se dice un dato dudoso en pantalla ("cantidad de pasajeros"). */
export const etiquetaDeDato = (d: DatoClave) => DATO[d];

// --- Qué queda después de corregir ------------------------------------------------------------

export type Cambio =
  | { vuelos: VueloIA[] }
  | { revisado: DatoClave }
  | { fechas: { fechaInicio: string; fechaFin: string } }
  | { pax: number }
  /** M3-39: los motivos guardados que se marcaron como resueltos. */
  | { resueltos: string[] };

export interface Decision {
  estado: EstadoReserva;
  motivos: string[];
  /** Los vuelos que todavía faltan: avisos, no se guardan (`avisos-vuelo.ts`). */
  avisos: string[];
}

/** Lo que la base resuelve al corregir los vuelos (además de "vuelos" en los dudosos). */
const esMotivoDeVuelo = (m: string) => esAvisoDeVuelo(m) || m === MOTIVOS_INTERCAMBIO.llegaronVuelos;

function vuelosQueFaltan(
  r: ReservaParaCorregir,
  vuelos: VueloIA[],
  fechas: { fechaInicio: string | null; fechaFin: string | null },
  detalles: { principal: DetalleProducto | null; otros: DetalleProducto[] },
): { motivos: string[]; avisos: string[] } {
  // Como en el emparejado (M2-03 fila 13) y M3-05: solo una reserva nueva mira vuelos.
  const tipo = r.datosExtraidos?.tipo_mail?.valor ?? "reserva_nueva";
  if (tipo !== "reserva_nueva" || !detalles.principal) return { motivos: [], avisos: [] };
  const pedidos = r.pedidosEspeciales ? r.pedidosEspeciales.split("\n").filter((p) => p.trim()) : [];
  const finalPuertoNatales = saleDePuertoNatales({ vuelos, pedidos_especiales: pedidos.map((texto) => ({ texto, confianza: 1 })) });
  const producto = { nombre: r.productoTexto ?? "", opcionales: [], fecha_inicio: fechas.fechaInicio, fecha_fin: fechas.fechaFin };
  const omitir = r.sinTrasladoDe === "salida" ? (["out"] as const) : r.sinTrasladoDe === "llegada" ? (["in"] as const) : [];
  // El lado que lleva otra reserva del mismo pedido se omite solo en el principal (como `cargarAvisosDeVuelo`).
  const textos = [
    ...motivosDeVuelos(detalles.principal, { vuelos, pedidos, producto, finalPuertoNatales, omitir }),
    ...detalles.otros.flatMap((d) => motivosDeVuelos(d, { vuelos, pedidos, producto, finalPuertoNatales })),
  ];
  const separados = separarAvisosDeVuelo([...new Set(textos)]);
  return { motivos: separados.motivos, avisos: separados.avisos };
}

/**
 * Fila 4 y 5: después de corregir los vuelos se sacan "vuelos" de los
 * dudosos, los "Falta el vuelo" guardados como motivo y "Llegaron vuelos…
 * revisar", y se recalculan los vuelos que pide el producto (lo que falta es
 * aviso). "Está bien así" saca ese dato; corregir las fechas saca "fechas" (y
 * "no trae la fecha de inicio"); corregir el pax saca "pax"; "Marcar como
 * resuelto" (M3-39) saca esos motivos guardados. Si la reserva
 * está para revisión y no queda ningún motivo, pasa a recibida. En otro
 * estado, el estado y los motivos no cambian.
 */
export function decidirCorreccion(
  r: ReservaParaCorregir,
  cambio: Cambio,
  detalles: { principal: DetalleProducto | null; otros: DetalleProducto[] },
): Decision {
  const vuelos = "vuelos" in cambio ? cambio.vuelos : r.vuelos;
  const fechas = "fechas" in cambio ? cambio.fechas : { fechaInicio: r.fechaInicio, fechaFin: r.fechaFin };
  const faltan = vuelosQueFaltan(r, vuelos, fechas, detalles);
  if (r.estado !== "para_revision") return { estado: r.estado, motivos: r.motivos, avisos: faltan.avisos };

  let motivos = [...r.motivos];
  if ("vuelos" in cambio) {
    motivos = quitarDudosos(motivos, ["vuelos"]).filter((m) => !esMotivoDeVuelo(m));
    motivos.push(...faltan.motivos);
  } else if ("revisado" in cambio) {
    motivos = quitarDudosos(motivos, [cambio.revisado]);
  } else if ("fechas" in cambio) {
    motivos = quitarDudosos(motivos, ["fechas"]).filter((m) => m !== M.sinFechaInicio);
  } else if ("resueltos" in cambio) {
    motivos = motivos.filter((m) => !cambio.resueltos.includes(m));
  } else {
    motivos = quitarDudosos(motivos, ["pax"]);
  }
  motivos = [...new Set(motivos)];
  return { estado: motivos.length ? "para_revision" : "recibida", motivos, avisos: faltan.avisos };
}

// --- Validación de fechas y pax (fila 5) --------------------------------------------------------

export function validarFechas(inicio: string, fin: string): string | null {
  if (!inicio?.trim() || !fin?.trim()) return E.faltaFecha;
  if (!esFechaValida(inicio.trim()) || !esFechaValida(fin.trim())) return E.fecha;
  return fin.trim() < inicio.trim() ? E.fechasOrden : null;
}

export function validarPax(pax: number): string | null {
  return Number.isInteger(pax) && pax >= 1 && pax <= 99 ? null : E.pax;
}

// --- Fila 8: la versión que vio la pantalla -----------------------------------------------------

export interface DatosDeVersion {
  estado: EstadoReserva;
  motivos: readonly string[];
  vuelos: readonly VueloDeReserva[];
  fechaInicio: string | null;
  fechaFin: string | null;
  pax: number | null;
  notas: readonly string[];
}

/**
 * Lo que la pantalla vio de la reserva, en un texto: si cuando se guarda la
 * reserva ya no da lo mismo, alguien la cambió mientras tanto y no se pisa.
 * La pantalla lo arma con el detalle (`cargarReserva`) y el servidor con la
 * fila recién leída, mapeada igual.
 */
export function versionParaCorregir(d: DatosDeVersion): string {
  return JSON.stringify([
    d.estado,
    [...d.motivos],
    d.vuelos.map((v) => [v.numero, v.aerolinea, v.origen, v.destino, v.fechaSalida, v.horaSalida, v.fechaLlegada, v.horaLlegada]),
    d.fechaInicio,
    d.fechaFin,
    d.pax,
    [...d.notas],
  ]);
}

// --- Owner 2026-10-20: las fechas de un tour con partes ------------------------------------------

export type CambioDeFechas = { tipo: "nada" } | { tipo: "correr"; dias: number } | { tipo: "duracion"; nochesAntes: number; nochesDespues: number };

const DIA_MS = 86_400_000;
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS);

/**
 * Regla del owner (2026-10-20): "si el vendedor cambia la fecha de comienzo
 * del tour, sí; si está agregando noches extra, ojo". Si inicio y fin se
 * mueven los mismos días, las partes del tour se corren esos días (lo hace la
 * base en la misma transacción, 0022); si cambia la duración, no se corren y
 * se avisa. Sin las dos fechas de antes no hay con qué comparar.
 */
export function comoCambianLasFechas(
  antes: { fechaInicio: string | null; fechaFin: string | null },
  despues: { fechaInicio: string; fechaFin: string },
): CambioDeFechas {
  if (!antes.fechaInicio || !antes.fechaFin) return { tipo: "nada" };
  const corrioInicio = diasEntre(antes.fechaInicio, despues.fechaInicio);
  const corrioFin = diasEntre(antes.fechaFin, despues.fechaFin);
  if (corrioInicio === corrioFin) return corrioInicio === 0 ? { tipo: "nada" } : { tipo: "correr", dias: corrioInicio };
  return { tipo: "duracion", nochesAntes: diasEntre(antes.fechaInicio, antes.fechaFin), nochesDespues: diasEntre(despues.fechaInicio, despues.fechaFin) };
}
