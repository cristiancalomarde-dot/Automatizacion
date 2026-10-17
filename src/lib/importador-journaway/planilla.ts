import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

/**
 * La planilla de productos de Journaway que completó el owner (spec M2-08
 * §3 #1): `Insumos/Borrador productos Journaway.xlsx`, hoja "Productos
 * Journaway". Una fila por producto. Lo que Journaway pide de verdad está en
 * celeste (relleno `DCE6F2` en la columna del código); lo que no tiene color
 * solo llega dentro de un paquete y su código es interno.
 *
 * Solo lee. Si falta la hoja o alguna columna que se usa, corta con un mensaje
 * claro (antes de que el importador escriba nada).
 */

export const RUTA_PLANILLA_JOURNAWAY = "Insumos/Borrador productos Journaway.xlsx";
export const HOJA_JOURNAWAY = "Productos Journaway";
export const COLOR_CELESTE = "DCE6F2";

export interface FilaPlanilla {
  /** Fila de la hoja (1 = encabezado). */
  fila: number;
  codigo: string;
  /** "Traslado", "Excursión", "Paquete", "Tour compuesto", "Bus", "Trekking", "Alojamiento". */
  tipo: string;
  destino: string;
  nombreTarifario: string;
  nombreMail: string;
  incluye: string;
  proveedorSugerido: string;
  origenProveedor: string;
  /** PROVEEDOR CONFIRMADO: "ok" = el sugerido. */
  confirmado: string;
  comentario: string;
  /** Lo que Journaway pide de verdad (el owner pidió que ponga el código en cada reserva). */
  celeste: boolean;
}

/** Abre la planilla con sus estilos (los colores de la columna del código). */
export function abrirPlanillaJournaway(ruta: string): XLSX.WorkBook {
  return XLSX.read(readFileSync(ruta), { type: "buffer", cellStyles: true });
}

type Campo = Exclude<keyof FilaPlanilla, "fila" | "celeste">;

/** Cada campo y cómo empieza su encabezado (sin acentos ni mayúsculas). */
const COLUMNAS: Array<{ campo: Campo; encabezado: string; nombre: string; opcional?: boolean }> = [
  { campo: "codigo", encabezado: "codigo", nombre: "Código sugerido" },
  { campo: "tipo", encabezado: "tipo", nombre: "Tipo" },
  { campo: "destino", encabezado: "destino", nombre: "Destino" },
  { campo: "nombreTarifario", encabezado: "nombre en el tarifario", nombre: "Nombre en el tarifario de Journaway" },
  { campo: "nombreMail", encabezado: "nombre como llega en los mails", nombre: "Nombre como llega en los mails de Journaway" },
  { campo: "incluye", encabezado: "que incluye", nombre: "Qué incluye", opcional: true },
  { campo: "proveedorSugerido", encabezado: "proveedor sugerido", nombre: "Proveedor sugerido" },
  { campo: "origenProveedor", encabezado: "de donde sale el proveedor", nombre: "De dónde sale el proveedor", opcional: true },
  { campo: "confirmado", encabezado: "proveedor confirmado", nombre: "PROVEEDOR CONFIRMADO" },
  { campo: "comentario", encabezado: "comentario del owner", nombre: "Comentario del owner" },
];

function normal(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function limpio(texto: unknown): string {
  return String(texto ?? "").replace(/\s+/gu, " ").trim();
}

export function leerPlanillaJournaway(libro: XLSX.WorkBook): FilaPlanilla[] {
  const hoja = libro.Sheets[HOJA_JOURNAWAY];
  if (!hoja) throw new Error(`La planilla de Journaway no tiene la hoja «${HOJA_JOURNAWAY}». No se cargó nada.`);
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: "", raw: false, blankrows: true });
  const encabezado = (filas[0] ?? []).map(normal);
  const indice = new Map<Campo, number>();
  for (const c of COLUMNAS) {
    const i = encabezado.findIndex((e) => e.startsWith(c.encabezado));
    if (i === -1 && !c.opcional) {
      throw new Error(`La planilla de Journaway: falta la columna «${c.nombre}» en la hoja «${HOJA_JOURNAWAY}». No se cargó nada.`);
    }
    if (i !== -1) indice.set(c.campo, i);
  }
  const columnaCodigo = indice.get("codigo")!;
  const vistos = new Map<string, number>();
  const resultado: FilaPlanilla[] = [];
  filas.slice(1).forEach((celdas, k) => {
    const fila = k + 2;
    const codigo = limpio(celdas[columnaCodigo]);
    if (!codigo) return;
    const anterior = vistos.get(codigo);
    if (anterior !== undefined) throw new Error(`La planilla de Journaway: el código ${codigo} está repetido (filas ${anterior} y ${fila}).`);
    vistos.set(codigo, fila);
    const celda = hoja[XLSX.utils.encode_cell({ r: fila - 1, c: columnaCodigo })] as { s?: { fgColor?: { rgb?: string } } } | undefined;
    const color = (celda?.s?.fgColor?.rgb ?? "").toUpperCase();
    const valores = Object.fromEntries(COLUMNAS.map((c) => [c.campo, indice.has(c.campo) ? limpio(celdas[indice.get(c.campo)!]) : ""])) as Record<Campo, string>;
    resultado.push({ fila, ...valores, codigo, celeste: color.endsWith(COLOR_CELESTE) });
  });
  return resultado;
}

/** Ciudad (como la escribe la planilla, sin acentos) → código de destino del catálogo. */
const DESTINOS: Array<[string, string]> = [
  ["san pedro de atacama", "SPA"],
  ["uyuni", "UYU"],
  ["iguazu", "IGR"],
  ["punta arenas", "PUQ"],
  ["puerto natales", "PNT"],
  ["torres del paine", "PNT"],
  ["el calafate", "FTE"],
  ["el chalten", "CHA"],
  ["ushuaia", "USH"],
  ["isla de pascua", "IPC"],
];

/** Código de destino → ciudad, para los paquetes armados (como los tours de M1). */
export const CIUDAD_DE_DESTINO: Record<string, string> = {
  SPA: "San Pedro de Atacama",
  UYU: "Uyuni",
  IGR: "Iguazú",
  PUQ: "Punta Arenas",
  PNT: "Puerto Natales",
  FTE: "El Calafate",
  CHA: "El Chaltén",
  USH: "Ushuaia",
  IPC: "Isla de Pascua",
};

/**
 * "Punta Arenas / Ushuaia" → destino PUQ (la primera ciudad) y ciudades PUQ y
 * USH. Separan "/" y "+". Una ciudad que no se conoce corta: no se adivina.
 */
export function destinoDeLaPlanilla(texto: string): { destino: string; ciudades: string[] } {
  const partes = texto.split(/[/+]/).map(normal).filter(Boolean);
  const codigos = partes.map((p) => {
    const encontrado = DESTINOS.find(([ciudad]) => p === ciudad);
    if (!encontrado) throw new Error(`La planilla de Journaway: no se conoce el destino «${texto}». No se cargó nada.`);
    return encontrado[1];
  });
  if (codigos.length === 0) throw new Error(`La planilla de Journaway: falta el destino. No se cargó nada.`);
  return { destino: codigos[0], ciudades: [...new Set(codigos)] };
}
