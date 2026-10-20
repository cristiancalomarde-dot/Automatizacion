/**
 * El orden y los filtros de la lista de reservas (spec M3-08): "Ordenar por",
 * estado (todas las vigentes juntas, salvo descartadas), agencia, fechas del
 * viaje y, solo para administradoras, la vista "Viajes terminados". Se
 * combinan con el buscador y el responsable (M3-06) y se recuerdan por
 * persona en el navegador. Sin base ni red.
 *
 * Que un operador no reciba las terminadas lo decide el servidor
 * (`cargar-lista.ts`); acá solo se separa lo que llegó.
 */
import { ESTADOS_RESERVA, type EstadoReserva } from "@/lib/reservas/tipos";
import { esTerminada } from "./terminadas";

export type OrdenLista = "inicio" | "fin" | "llegada";
export type FiltroFechas = "todas" | "7" | "30" | "mes";
export type FiltroEstado = "todas" | EstadoReserva;
export type VistaLista = "vigentes" | "terminadas";

export interface EleccionLista {
  orden: OrdenLista;
  /** "todas" o el nombre de la agencia. */
  agencia: string;
  fechas: FiltroFechas;
  /** "AAAA-MM" cuando `fechas` es "mes". */
  mes: string;
  estado: FiltroEstado;
  vista: VistaLista;
}

export const ELECCION_INICIAL: EleccionLista = {
  orden: "inicio",
  agencia: "todas",
  fechas: "todas",
  mes: "",
  estado: "todas",
  vista: "vigentes",
};

export const ORDENES: readonly OrdenLista[] = ["inicio", "fin", "llegada"];
export const FILTROS_FECHAS: readonly FiltroFechas[] = ["todas", "7", "30", "mes"];

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface FilaFiltrable {
  estado: string;
  agencia: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  llego: string;
}

/** "AAAA-MM-DD" más n días (en UTC, sin horas: solo calendario). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function pasaEstado(f: FilaFiltrable, estado: FiltroEstado): boolean {
  return estado === "todas" ? f.estado !== "descartada" : f.estado === estado;
}

function pasaFechas(f: FilaFiltrable, e: EleccionLista, hoy: string): boolean {
  if (e.fechas === "todas") return true;
  if (e.fechas === "mes") {
    if (!MES.test(e.mes)) return true;
    // Viaja en el mes si alguno de sus días cae en él (los viajes que cruzan de mes cuentan en los dos).
    const desde = f.fechaInicio ?? f.fechaFin;
    const hasta = f.fechaFin ?? f.fechaInicio;
    if (!desde || !hasta) return false;
    return desde <= `${e.mes}-31` && hasta >= `${e.mes}-01`;
  }
  // "Arrancan en los próximos N días", hoy incluido.
  const inicio = f.fechaInicio;
  return inicio !== null && inicio >= hoy && inicio <= sumarDias(hoy, Number(e.fechas));
}

const SIN_FECHA = "9999-99-99";

function comparar<T extends FilaFiltrable>(orden: OrdenLista): (a: T, b: T) => number {
  const llegada = (a: T, b: T) => (Date.parse(b.llego) || 0) - (Date.parse(a.llego) || 0);
  if (orden === "llegada") return llegada;
  const campo = orden === "inicio" ? "fechaInicio" : "fechaFin";
  // Las sin fecha, al final.
  return (a, b) => (a[campo] ?? SIN_FECHA).localeCompare(b[campo] ?? SIN_FECHA) || llegada(a, b);
}

/** Terminadas: por fin del viaje, las más recientes primero (para las liquidaciones). */
function compararTerminadas<T extends FilaFiltrable>(a: T, b: T): number {
  return (b.fechaFin ?? "").localeCompare(a.fechaFin ?? "") || (Date.parse(b.llego) || 0) - (Date.parse(a.llego) || 0);
}

/** Las filas que pasan la elección, en su orden. */
export function filtrarYOrdenar<T extends FilaFiltrable>(filas: readonly T[], e: EleccionLista, hoy: string): T[] {
  const terminadas = e.vista === "terminadas";
  return filas
    .filter(
      (f) =>
        esTerminada(f, hoy) === terminadas &&
        pasaEstado(f, e.estado) &&
        (e.agencia === "todas" || f.agencia === e.agencia) &&
        pasaFechas(f, e, hoy),
    )
    .sort(terminadas ? compararTerminadas : comparar(e.orden));
}

/** Si hay algún filtro puesto (el orden no es un filtro): para "Limpiar filtros". */
export function hayFiltros(e: EleccionLista): boolean {
  return (
    e.agencia !== ELECCION_INICIAL.agencia ||
    e.fechas !== ELECCION_INICIAL.fechas ||
    e.estado !== ELECCION_INICIAL.estado ||
    e.vista !== ELECCION_INICIAL.vista
  );
}

/** La clave del navegador: una por persona (como el filtro de responsable de M3-06). */
export const claveEleccionLista = (yo: string | null): string => `hi-travel.reservas.lista.${yo ?? "sin-sesion"}`;

/** Lo guardado, campo por campo: lo que ya no es una opción vuelve a lo inicial. */
export function eleccionGuardada(valor: string | null, opciones: { agencias: readonly string[]; esAdmin: boolean }): EleccionLista {
  let crudo: Record<string, unknown> = {};
  try {
    const leido: unknown = valor ? JSON.parse(valor) : {};
    if (leido && typeof leido === "object") crudo = leido as Record<string, unknown>;
  } catch {
    return { ...ELECCION_INICIAL };
  }
  const elegir = <V extends string>(v: unknown, validos: readonly V[], inicial: V): V =>
    typeof v === "string" && (validos as readonly string[]).includes(v) ? (v as V) : inicial;

  const mes = typeof crudo.mes === "string" && MES.test(crudo.mes) ? crudo.mes : ELECCION_INICIAL.mes;
  let fechas = elegir(crudo.fechas, FILTROS_FECHAS, ELECCION_INICIAL.fechas);
  if (fechas === "mes" && !mes) fechas = ELECCION_INICIAL.fechas;
  return {
    orden: elegir(crudo.orden, ORDENES, ELECCION_INICIAL.orden),
    agencia: elegir(crudo.agencia, ["todas", ...opciones.agencias], ELECCION_INICIAL.agencia),
    fechas,
    mes,
    estado: elegir(crudo.estado, ["todas", ...ESTADOS_RESERVA] as FiltroEstado[], ELECCION_INICIAL.estado),
    vista: opciones.esAdmin ? elegir(crudo.vista, ["vigentes", "terminadas"] as VistaLista[], ELECCION_INICIAL.vista) : ELECCION_INICIAL.vista,
  };
}
