import * as XLSX from "xlsx";

/**
 * Lector de RutasenBus, hoja "Tours 2027" (spec M1-05 §2, "Códigos de cada
 * tour"). Cada tour tiene su código en la columna A; la fila de códigos está
 * justo arriba de su fila "Net Prices:", con el código de cada paquete encima
 * de su columna. Las columnas de bus no tienen código.
 *
 * Anotaciones que entiende (y nada más: lo demás queda "no reconocido"):
 * - "OD019 (menos 1 noche)" / "OD016 (mas 1 noche)": noches de más o de menos.
 * - "(esta incluido en CH10)": esa columna no es un componente propio.
 *
 * Las categorías del tour salen de la tabla de venta (el segundo "Net
 * Prices:" de la fila, a la derecha de la tabla de costos).
 */

export const HOJA_TOURS = "Tours 2027";

export interface ComponenteExcel {
  codigo: string;
  /** +1 = "(mas 1 noche)", -1 = "(menos 1 noche)", 0 = sin anotación. */
  ajusteNoches: number;
  columna: string;
  /** Lo que dice la fila "Net Prices:" en esa columna ("FTE + 1 Nt"). */
  encabezado: string;
  texto: string;
}

export interface TourExcel {
  codigo: string;
  /** Fila (1 = primera) de la fila de códigos. */
  fila: number;
  nombre: string;
  componentes: ComponenteExcel[];
  incluidos: Array<{ incluidoEn: string; columna: string; encabezado: string }>;
  noReconocidos: Array<{ columna: string; texto: string }>;
  /** Columnas sin código (los buses, según RutasenBus), con su encabezado. */
  columnasSinCodigo: Array<{ columna: string; encabezado: string }>;
  categorias: string[];
}

const CODIGO = /^([A-Z0-9]*[A-Z][A-Z0-9]*\d[A-Z0-9]*|\d[A-Z0-9]*[A-Z][A-Z0-9]*)$/;
const AJUSTE = /^\(\s*(menos|m[aá]s)\s+(\d+)\s+noches?\s*\)$/i;
const INCLUIDO_EN = /^\(\s*est[aá]\s+incluid[oa]\s+en\s+([A-Z0-9]+)\s*\)$/i;
const TOTAL = /^\s*(TOTAL|TTL)\s*$/i;

function celda(filas: string[][], f: number, c: number): string {
  return String(filas[f]?.[c] ?? "").trim();
}

/** "DBL Budget Hotel" → "Budget Hotel"; "Dorm Ensuite Hostel" → "Hostel"; "Hotel 3* DBL" → "Hotel 3*". */
export function normalizarCategoria(texto: string): string {
  const limpio = texto
    .replace(/\b(dorm|dbl|sgl|twin|tpl|ensuite|shared|private)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/hostel/i.test(limpio)) return "Hostel";
  if (/budget/i.test(limpio)) return "Budget Hotel";
  if (/4\s*\*/.test(limpio)) return "Hotel 4*";
  if (/3\s*\*/.test(limpio)) return "Hotel 3*";
  return limpio;
}

function leerCategorias(filas: string[][], filaNet: number): string[] {
  // La tabla de venta: el primer "Net Prices:" a la derecha de la columna B,
  // en la fila de "Net Prices:" o en la siguiente.
  for (const f of [filaNet, filaNet + 1]) {
    const fila = filas[f] ?? [];
    for (let c = 2; c < fila.length; c++) {
      if (!/^net prices:?$/i.test(celda(filas, f, c))) continue;
      const categorias: string[] = [];
      for (let r = f + 1; r < filas.length; r++) {
        const etiqueta = celda(filas, r, c);
        if (!etiqueta || /^\d/.test(etiqueta)) break;
        if (/^supplement/i.test(etiqueta)) continue;
        const categoria = normalizarCategoria(etiqueta);
        if (!categorias.includes(categoria)) categorias.push(categoria);
      }
      return categorias;
    }
  }
  return [];
}

export function leerTourRutas(filas: string[][], codigo: string): TourExcel | null {
  const filaTour = filas.findIndex((f) => celda([f], 0, 0) === codigo);
  if (filaTour === -1) return null;
  let filaNet = -1;
  for (let f = filaTour + 1; f <= filaTour + 3 && f < filas.length; f++) {
    if (/^net prices:?$/i.test(celda(filas, f, 1))) {
      filaNet = f;
      break;
    }
  }
  if (filaNet === -1) return null;
  const filaCodigos = filaNet - 1;

  // Las columnas del tour: desde C hasta la del total (sin incluirla).
  const net = filas[filaNet] ?? [];
  let finColumnas = net.length;
  for (let c = 2; c < net.length; c++) {
    if (TOTAL.test(celda(filas, filaNet, c))) {
      finColumnas = c;
      break;
    }
  }

  const tour: TourExcel = {
    codigo,
    fila: filaCodigos + 1,
    nombre: celda(filas, filaTour, 1),
    componentes: [],
    incluidos: [],
    noReconocidos: [],
    columnasSinCodigo: [],
    categorias: leerCategorias(filas, filaNet),
  };
  if (filaCodigos === filaTour) return tour; // sin fila de códigos

  for (let c = 2; c < finColumnas; c++) {
    const texto = celda(filas, filaCodigos, c);
    const columna = XLSX.utils.encode_col(c);
    const encabezado = celda(filas, filaNet, c);
    if (!texto) {
      if (encabezado) tour.columnasSinCodigo.push({ columna, encabezado });
      continue;
    }
    const incluido = INCLUIDO_EN.exec(texto);
    if (incluido) {
      tour.incluidos.push({ incluidoEn: incluido[1].toUpperCase(), columna, encabezado });
      continue;
    }
    const m = /^(\S+)\s*(.*)$/.exec(texto)!;
    const anotacion = m[2].trim();
    const ajuste = anotacion ? AJUSTE.exec(anotacion) : null;
    if (!CODIGO.test(m[1]) || (anotacion && !ajuste)) {
      tour.noReconocidos.push({ columna, texto });
      continue;
    }
    const n = ajuste ? Number(ajuste[2]) : 0;
    tour.componentes.push({
      codigo: m[1],
      ajusteNoches: ajuste && /^menos$/i.test(ajuste[1]) ? -n : n,
      columna,
      encabezado,
      texto,
    });
  }
  return tour;
}
