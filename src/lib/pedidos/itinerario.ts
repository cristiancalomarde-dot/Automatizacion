/**
 * Los avisos del itinerario (spec M3-24, owner 2026-10-26): problemas de fechas que conviene revisar
 * antes de pedir. Avisan, no frenan. Puro: sin base, sin red, sin IA (#3).
 *
 * - **Blackout del producto** (`data/blackouts.csv`): la salida del producto (o el inicio de su parte
 *   dentro de un tour) cae en un rango del Word, en un día de la semana en que no puede empezar, o en
 *   un rango relativo a la Pascua (Carnaval y Semana Santa siguen el año).
 * - **Fecha especial** (`data/fechas-especiales.csv`): una excursión o un traslado cae en Navidad, Año
 *   Nuevo, Carnaval o Semana Santa del destino; un bus, solo si sale el 25 dic o el 1 ene.
 * - **Días de un bus** (`data/dias-bus.csv`): el tramo sale solo algunos días de la semana o días
 *   pares / impares.
 * - **Salidas de un bus por fecha** (`data/salidas-bus.csv`, M3-27): el calendario de un tramo
 *   (Bariloche ↔ El Chaltén) entre dos fechas; fuera de lo cargado, avisa que hay que confirmar.
 *
 * Las fechas van como "AAAA-MM-DD". Los rangos fijos van como "MM-DD" (inclusive; pueden cruzar el
 * año: 12-27 → 01-03). Los relativos a la Pascua, como "P-52" … "P0" (días desde el domingo de Pascua
 * del año de la fecha).
 */
import { leerCsv } from "@/lib/importador-productos/csv";
import { NOMBRE_DESTINO, ciudadesEnTexto } from "@/lib/importador-tours/ciudades";
import { diasEntre, fechaCorta, rangoCorto, sumarDias } from "./formato";

export const ARCHIVO_BLACKOUTS = "data/blackouts.csv";
export const ARCHIVO_FECHAS_ESPECIALES = "data/fechas-especiales.csv";
export const ARCHIVO_DIAS_BUS = "data/dias-bus.csv";
export const ARCHIVO_SALIDAS_BUS = "data/salidas-bus.csv";

export interface Blackout {
  producto: string;
  tipo: "rango" | "dia_semana" | "feriado";
  desde: string;
  hasta: string;
  /** Días de la semana en que NO puede empezar (0 = domingo), solo en `dia_semana`. */
  dias: number[];
  motivo: string;
}

export interface FechaEspecial {
  feriado: string;
  /** Códigos de destino, o "*" (los destinos que ninguna otra fila de ese feriado nombra). */
  donde: string[] | "*";
  regla: "fija" | "pascua" | "nada";
  desde: string;
  hasta: string;
  /** El rango (fijo) en que un bus avisa; null si los buses no avisan por ese feriado. */
  busDesde: string | null;
  busHasta: string | null;
}

export type DiasQueSale = { tipo: "semana"; dias: number[] } | { tipo: "pares" } | { tipo: "impares" };

export interface DiasDeBus {
  origen: string;
  destino: string;
  /** null: sin días cargados (sale todos los días o todavía no se sabe): no avisa. */
  dias: DiasQueSale | null;
}

/** M3-27: qué días sale el bus entre `desde` y `hasta` (inclusive). */
export type ReglaDeSalidas = { tipo: "todos" } | { tipo: "dia_por_medio" } | { tipo: "fechas"; dias: number[] };

export interface SalidasDeBus {
  origen: string;
  destino: string;
  desde: string;
  hasta: string;
  regla: ReglaDeSalidas;
  /** A quién confirmar fuera de lo cargado. */
  proveedor: string;
}

export interface ReglasItinerario {
  blackouts: readonly Blackout[];
  fechasEspeciales: readonly FechaEspecial[];
  diasBus: readonly DiasDeBus[];
  /** M3-27: los calendarios por fecha (`data/salidas-bus.csv`). */
  salidasBus: readonly SalidasDeBus[];
}

export const SIN_REGLAS: ReglasItinerario = { blackouts: [], fechasEspeciales: [], diasBus: [], salidasBus: [] };

// --- Fechas -------------------------------------------------------------------------------------

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MES_DIA = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const PASCUA = /^P([+-]?\d{1,3})?$/;

const sinAcentos = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** "mar" / "mié" / "mie" / "sab" → 0-6 (0 = domingo); null si no es un día. */
function diaDeLaSemana(texto: string): number | null {
  const i = DIAS_CORTOS.findIndex((d) => sinAcentos(d) === sinAcentos(texto));
  return i >= 0 ? i : null;
}

function diaSemana(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

/** El domingo de Pascua del año (computus de Meeus/Jones/Butcher), "AAAA-MM-DD". */
export function pascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const desplazamiento = (p: string) => Number(p.slice(1) || "0");

/**
 * El rango concreto (desde, hasta) que contiene la fecha, o null. Fijo: el del año de la fecha (si
 * cruza el año, el que empieza el año anterior o termina el siguiente). Pascua: el del año de la fecha.
 */
function rangoQueContiene(fecha: string, regla: "fija" | "pascua", desde: string, hasta: string): { desde: string; hasta: string } | null {
  const anio = Number(fecha.slice(0, 4));
  if (regla === "pascua") {
    const p = pascua(anio);
    const r = { desde: sumarDias(p, desplazamiento(desde)), hasta: sumarDias(p, desplazamiento(hasta)) };
    return r.desde <= fecha && fecha <= r.hasta ? r : null;
  }
  const md = fecha.slice(5);
  if (desde <= hasta) return desde <= md && md <= hasta ? { desde: `${anio}-${desde}`, hasta: `${anio}-${hasta}` } : null;
  if (md >= desde) return { desde: `${anio}-${desde}`, hasta: `${anio + 1}-${hasta}` };
  if (md <= hasta) return { desde: `${anio - 1}-${desde}`, hasta: `${anio}-${hasta}` };
  return null;
}

const fechaLarga = (fecha: string) => `${DIAS[diaSemana(fecha)]} ${fechaCorta(fecha)}`;
const rango = (r: { desde: string; hasta: string }) => (r.desde === r.hasta ? `el ${fechaCorta(r.desde)}` : rangoCorto(r.desde, r.hasta));

// --- Avisos -------------------------------------------------------------------------------------

/** Los blackouts del producto en los que cae su salida (o el inicio de su parte). */
export function avisosDeBlackout(reglas: ReglasItinerario, producto: string, fecha: string | null): string[] {
  if (!fecha || !ISO.test(fecha)) return [];
  const avisos: string[] = [];
  for (const b of reglas.blackouts.filter((x) => x.producto === producto)) {
    if (b.tipo === "dia_semana") {
      if (b.dias.includes(diaSemana(fecha))) avisos.push(`${producto} empieza un ${DIAS[diaSemana(fecha)]} (${fechaCorta(fecha)}): ${b.motivo}.`);
      continue;
    }
    const r = rangoQueContiene(fecha, b.tipo === "feriado" ? "pascua" : "fija", b.desde, b.hasta);
    if (r) avisos.push(`${producto} empieza el ${fechaLarga(fecha)}, dentro de su blackout (${b.motivo}: ${rango(r)}).`);
  }
  return avisos;
}

export interface ServicioConDia {
  tipo: "excursion" | "traslado" | "bus";
  nombre: string;
  fecha: string | null;
  /** El destino del paquete (el de salida, en un bus). */
  destino: string | null;
}

/** Las filas que valen para el destino: las que lo nombran o, si ninguna, las de "*". */
function filasDelDestino(reglas: ReglasItinerario, feriado: string, destino: string | null): FechaEspecial[] {
  const delFeriado = reglas.fechasEspeciales.filter((f) => f.feriado === feriado);
  const propias = destino ? delFeriado.filter((f) => f.donde !== "*" && f.donde.includes(destino)) : [];
  return propias.length ? propias : delFeriado.filter((f) => f.donde === "*");
}

/** Navidad, Año Nuevo, Carnaval o Semana Santa del destino en que cae el servicio. */
export function avisosDeFechaEspecial(reglas: ReglasItinerario, s: ServicioConDia): string[] {
  if (!s.fecha || !ISO.test(s.fecha)) return [];
  const avisos: string[] = [];
  for (const feriado of [...new Set(reglas.fechasEspeciales.map((f) => f.feriado))]) {
    for (const f of filasDelDestino(reglas, feriado, s.destino)) {
      if (f.regla === "nada") continue;
      if (s.tipo === "bus") {
        if (f.busDesde && f.busHasta && rangoQueContiene(s.fecha, "fija", f.busDesde, f.busHasta)) {
          avisos.push(`El bus ${s.nombre} sale ${fechaLarga(s.fecha)}, ${feriado}: confirmá que sale.`);
        }
        continue;
      }
      if (rangoQueContiene(s.fecha, f.regla, f.desde, f.hasta)) {
        const donde = s.destino ? ` (${NOMBRE_DESTINO[s.destino] ?? s.destino})` : "";
        avisos.push(`${s.nombre}${donde} cae ${fechaLarga(s.fecha)}, ${feriado}: confirmá con el proveedor que opera.`);
      }
    }
  }
  return [...new Set(avisos)];
}

/** El origen y el destino de un tramo ("Bus Río Gallegos – Ushuaia", "Bus Punta Arenas to Ushuaia"). */
export function tramoDeLaRuta(ruta: string): { origen: string; destino: string } | null {
  const ciudades = ciudadesEnTexto(ruta);
  if (ciudades.length < 2) return null;
  return { origen: ciudades[0].destino, destino: ciudades[ciudades.length - 1].destino };
}

function textoDeDias(d: DiasQueSale): string {
  if (d.tipo === "pares") return "los días pares";
  if (d.tipo === "impares") return "los días impares";
  return [...d.dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => DIAS_CORTOS[x]).join("/");
}

function saleEseDia(d: DiasQueSale, fecha: string): boolean {
  const dia = Number(fecha.slice(8, 10));
  if (d.tipo === "pares") return dia % 2 === 0;
  if (d.tipo === "impares") return dia % 2 === 1;
  return d.dias.includes(diaSemana(fecha));
}

/** M3-27: la fila del calendario sale ese día (la fecha ya cae entre desde y hasta). */
function saleSegunLaFila(fila: SalidasDeBus, fecha: string): boolean {
  if (fila.regla.tipo === "todos") return true;
  if (fila.regla.tipo === "dia_por_medio") return diasEntre(fila.desde, fecha) % 2 === 0;
  return fila.regla.dias.includes(Number(fecha.slice(8, 10)));
}

const filasDelTramo = (reglas: ReglasItinerario, origen: string, destino: string) =>
  reglas.salidasBus.filter((f) => f.origen === origen && f.destino === destino);

/** M3-27: las fechas en que sale el tramo según `data/salidas-bus.csv`, ordenadas. */
export function salidasDelBus(reglas: ReglasItinerario, origen: string, destino: string): string[] {
  const fechas = new Set<string>();
  for (const fila of filasDelTramo(reglas, origen, destino)) {
    for (let f = fila.desde; f <= fila.hasta; f = sumarDias(f, 1)) if (saleSegunLaFila(fila, f)) fechas.add(f);
  }
  return [...fechas].sort();
}

/** "3, 6, 9 nov" / "30 nov, 2, 3 dic": los días juntos por mes, sin el año. */
function diasPorMes(fechas: string[]): string {
  const grupos: { mes: string; dias: number[] }[] = [];
  for (const f of fechas) {
    const mes = fechaCorta(f).split(" ")[1];
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.dias.push(Number(f.slice(8, 10)));
    else grupos.push({ mes, dias: [Number(f.slice(8, 10))] });
  }
  return grupos.map((g) => `${g.dias.join(", ")} ${g.mes}`).join(", ");
}

const fechaConDiaCorto = (fecha: string) => `${DIAS_CORTOS[diaSemana(fecha)]} ${fechaCorta(fecha)}`;

/** M3-27: el tramo con calendario por fecha cae un día sin salida, o fuera de lo cargado. */
function avisosDeSalidasDeBus(reglas: ReglasItinerario, tramo: { origen: string; destino: string }, fecha: string): string[] {
  const filas = filasDelTramo(reglas, tramo.origen, tramo.destino);
  if (!filas.length) return [];
  const nombre = (c: string) => NOMBRE_DESTINO[c] ?? c;
  const fila = filas.find((f) => f.desde <= fecha && fecha <= f.hasta);
  if (!fila) {
    // El par se nombra como en su primera fila del CSV, sea cual sea el sentido.
    const par =
      reglas.salidasBus.find(
        (f) => (f.origen === tramo.origen && f.destino === tramo.destino) || (f.origen === tramo.destino && f.destino === tramo.origen),
      ) ?? filas[0];
    return [`Calendario del bus ${nombre(par.origen)} ↔ ${nombre(par.destino)} sin cargar para el ${fechaConDiaCorto(fecha)}: confirmar con ${filas[0].proveedor}.`];
  }
  if (saleSegunLaFila(fila, fecha)) return [];
  const siguientes = salidasDelBus(reglas, tramo.origen, tramo.destino).filter((f) => f > fecha);
  const cuales = siguientes.length ? ` (sale ${diasPorMes(siguientes.slice(0, 3))}${siguientes.length > 3 ? "…" : ""})` : "";
  return [`El bus ${nombre(tramo.origen)} → ${nombre(tramo.destino)} cae el ${fechaConDiaCorto(fecha)} y ese día no sale${cuales}.`];
}

/** El tramo de bus cae un día en que no sale, según `data/dias-bus.csv` y `data/salidas-bus.csv` (M3-27). */
export function avisosDeDiasDeBus(reglas: ReglasItinerario, bus: { ruta: string; fecha: string | null }): string[] {
  if (!bus.fecha || !ISO.test(bus.fecha)) return [];
  const tramo = tramoDeLaRuta(bus.ruta);
  if (!tramo) return [];
  const porFecha = avisosDeSalidasDeBus(reglas, tramo, bus.fecha);
  const regla = reglas.diasBus.find((r) => r.origen === tramo.origen && r.destino === tramo.destino);
  if (!regla?.dias || saleEseDia(regla.dias, bus.fecha)) return porFecha;
  const nombre = (c: string) => NOMBRE_DESTINO[c] ?? c;
  return [`El bus ${nombre(tramo.origen)} → ${nombre(tramo.destino)} cae ${fechaLarga(bus.fecha)}; según la planilla sale ${textoDeDias(regla.dias)}.`, ...porFecha];
}

// --- Lectura de los CSV -------------------------------------------------------------------------

function cabecera(contenido: string, archivo: string, esperada: string): void {
  const primera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!primera.startsWith(esperada)) throw new Error(`${archivo}: la primera fila tiene que ser "${esperada},nota".`);
}

function dias(texto: string): number[] | null {
  const partes = texto.split(/[\s/]+/).filter(Boolean);
  const numeros = partes.map(diaDeLaSemana);
  return partes.length && numeros.every((n) => n !== null) ? (numeros as number[]) : null;
}

/** `data/blackouts.csv`: producto,tipo,desde,hasta,motivo,nota. */
export function leerBlackouts(contenido: string): Blackout[] {
  cabecera(contenido, ARCHIVO_BLACKOUTS, "producto,tipo,desde,hasta,motivo");
  return leerCsv(contenido).map((f, i) => {
    const producto = f.producto?.trim() ?? "";
    const tipo = f.tipo?.trim() ?? "";
    const desde = f.desde?.trim() ?? "";
    const hasta = f.hasta?.trim() ?? "";
    const motivo = f.motivo?.trim() ?? "";
    const error = () =>
      new Error(
        `${ARCHIVO_BLACKOUTS}, fila ${i + 2}: hace falta el producto, el motivo y un tipo válido (rango: desde y hasta como 04-01; feriado: como P-52 y P0; dia_semana: los días en "desde", como "mar" o "dom mar").`,
      );
    if (!producto || !motivo) throw error();
    if (tipo === "dia_semana") {
      const lista = dias(desde);
      if (!lista) throw error();
      return { producto, tipo, desde, hasta: "", dias: lista, motivo };
    }
    if (tipo === "rango" && MES_DIA.test(desde) && MES_DIA.test(hasta)) return { producto, tipo, desde, hasta, dias: [], motivo };
    if (tipo === "feriado" && PASCUA.test(desde) && PASCUA.test(hasta) && desplazamiento(desde) <= desplazamiento(hasta)) {
      return { producto, tipo, desde, hasta, dias: [], motivo };
    }
    throw error();
  });
}

/** `data/fechas-especiales.csv`: feriado,donde,regla,desde,hasta,bus_desde,bus_hasta,nota. */
export function leerFechasEspeciales(contenido: string): FechaEspecial[] {
  cabecera(contenido, ARCHIVO_FECHAS_ESPECIALES, "feriado,donde,regla,desde,hasta,bus_desde,bus_hasta");
  return leerCsv(contenido).map((f, i) => {
    const feriado = f.feriado?.trim() ?? "";
    const dondeTexto = f.donde?.trim() ?? "";
    const regla = f.regla?.trim() ?? "";
    const desde = f.desde?.trim() ?? "";
    const hasta = f.hasta?.trim() ?? "";
    const busDesde = f.bus_desde?.trim() || null;
    const busHasta = f.bus_hasta?.trim() || null;
    const error = () =>
      new Error(
        `${ARCHIVO_FECHAS_ESPECIALES}, fila ${i + 2}: hace falta el feriado, dónde ("*" o códigos de destino) y una regla válida (fija: 12-24 y 12-25; pascua: P-48 y P-47; nada). El rango de los buses va como 12-25.`,
      );
    const donde: string[] | "*" = dondeTexto === "*" ? "*" : dondeTexto.split(/\s+/).filter(Boolean).map((x) => x.toUpperCase());
    if (!feriado || (donde !== "*" && donde.length === 0)) throw error();
    if ((busDesde || busHasta) && !(busDesde && busHasta && MES_DIA.test(busDesde) && MES_DIA.test(busHasta))) throw error();
    const fila = { feriado, donde, desde, hasta, busDesde, busHasta };
    if (regla === "nada") return { ...fila, regla };
    if (regla === "fija" && MES_DIA.test(desde) && MES_DIA.test(hasta)) return { ...fila, regla };
    if (regla === "pascua" && PASCUA.test(desde) && PASCUA.test(hasta) && desplazamiento(desde) <= desplazamiento(hasta)) return { ...fila, regla };
    throw error();
  });
}

/** `data/dias-bus.csv`: origen,destino,dias,nota. `dias`: "lun mié vie", "pares", "impares" o vacío. */
export function leerDiasDeBus(contenido: string): DiasDeBus[] {
  cabecera(contenido, ARCHIVO_DIAS_BUS, "origen,destino,dias");
  return leerCsv(contenido).map((f, i) => {
    const origen = f.origen?.trim().toUpperCase() ?? "";
    const destino = f.destino?.trim().toUpperCase() ?? "";
    const texto = sinAcentos(f.dias ?? "");
    const error = () =>
      new Error(`${ARCHIVO_DIAS_BUS}, fila ${i + 2}: hace falta el origen y el destino (códigos); los días van como "lun mié vie", "pares", "impares" o vacíos.`);
    if (!origen || !destino) throw error();
    if (!texto) return { origen, destino, dias: null };
    if (texto === "pares" || texto === "impares") return { origen, destino, dias: { tipo: texto } };
    const lista = dias(texto);
    if (!lista) throw error();
    return { origen, destino, dias: { tipo: "semana", dias: lista } };
  });
}

/**
 * M3-27 — `data/salidas-bus.csv`: origen,destino,desde,hasta,regla,proveedor,nota. `desde`/`hasta`
 * como 2026-11-01 (inclusive). `regla`: "todos los días", "día por medio" (contando desde `desde`) o
 * los días del mes en que sale ("3 6 9 12").
 */
export function leerSalidasDeBus(contenido: string): SalidasDeBus[] {
  cabecera(contenido, ARCHIVO_SALIDAS_BUS, "origen,destino,desde,hasta,regla,proveedor");
  return leerCsv(contenido).map((f, i) => {
    const origen = f.origen?.trim().toUpperCase() ?? "";
    const destino = f.destino?.trim().toUpperCase() ?? "";
    const desde = f.desde?.trim() ?? "";
    const hasta = f.hasta?.trim() ?? "";
    const texto = sinAcentos(f.regla ?? "");
    const proveedor = f.proveedor?.trim() ?? "";
    const error = () =>
      new Error(
        `${ARCHIVO_SALIDAS_BUS}, fila ${i + 2}: hace falta el origen y el destino (códigos), el proveedor, desde y hasta como 2026-11-01 (desde antes que hasta) y una regla válida ("todos los días", "día por medio" o los días del mes, como "3 6 9 12").`,
      );
    if (!origen || !destino || !proveedor || !ISO.test(desde) || !ISO.test(hasta) || desde > hasta) throw error();
    const fila = { origen, destino, desde, hasta, proveedor };
    if (texto === "todos los dias" || texto === "todos") return { ...fila, regla: { tipo: "todos" } };
    if (texto === "dia por medio") return { ...fila, regla: { tipo: "dia_por_medio" } };
    const numeros = texto.split(/[\s,]+/).filter(Boolean);
    if (!numeros.length || !numeros.every((n) => /^\d{1,2}$/.test(n) && Number(n) >= 1 && Number(n) <= 31)) throw error();
    return { ...fila, regla: { tipo: "fechas", dias: numeros.map(Number) } };
  });
}
