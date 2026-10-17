import { leerCsv } from "@/lib/importador-productos/csv";
import { requerirColumnas } from "./csv";

/**
 * Los nombres con que Journaway escribe cada producto (spec M2-08 §3 #8),
 * `data/journaway-nombres.csv`: código, nombre tal cual, origen (tarifario,
 * mail de ejemplo o planilla) y nota.
 *
 * Cada nombre se guarda en `codigo_externo` (agencia "Journaway") dos veces en
 * una misma fila: limpio en `codigo`, para buscarlo, y tal cual en
 * `nombre_externo`, para mostrarlo. La limpieza la reusa M2-09 para buscar los
 * tours sueltos que llegan en el mail.
 */

export const ORIGENES_NOMBRE = ["tarifario", "mail de ejemplo", "planilla"] as const;
export type OrigenNombre = (typeof ORIGENES_NOMBRE)[number];

export interface NombreJournaway {
  /** Fila del CSV (1 = encabezado). */
  fila: number;
  codigo: string;
  /** Tal cual lo escribe Journaway. */
  nombre: string;
  /** La forma para buscar (`limpiarNombreJournaway`). */
  limpio: string;
  origen: OrigenNombre;
}

/** "1) ", "6) " de la lista de actividades del mail. */
const NUMERACION = /^\s*\d+\s*[).]\s*/;
/**
 * "San Pedro de Atacama:", "From Foz do Iguaçu:", "Tour:", "Siloli:": hasta 6
 * palabras sin números y dos puntos. Con números no es un prefijo: "Package 1:
 * …" y "Package 2: …" son productos distintos.
 */
const PREFIJO = /^\s*(?:[^\s:\d]+\s+){0,5}[^\s:\d]+\s*:\s+/u;

/**
 * Un nombre de Journaway, listo para comparar: sin la numeración del mail, sin
 * los prefijos de lugar o tipo ("San Pedro de Atacama:", "From Foz do Iguaçu:",
 * "Tour:"), sin acentos ni mayúsculas, con los espacios colapsados y sin punto
 * final. No cambia palabras: dos nombres distintos siguen siendo distintos.
 */
export function limpiarNombreJournaway(nombre: string): string {
  let texto = nombre.replace(/\s+/gu, " ").replace(NUMERACION, "");
  for (let previo = ""; previo !== texto; ) {
    previo = texto;
    texto = texto.replace(PREFIJO, "");
  }
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.\s]+$/u, "")
    .trim();
}

const COLUMNAS = ["codigo", "nombre", "origen", "nota"];

export function parsearNombres(texto: string): NombreJournaway[] {
  requerirColumnas(texto, COLUMNAS, "Nombres de Journaway");
  const porLimpio = new Map<string, NombreJournaway>();
  const nombres: NombreJournaway[] = [];
  leerCsv(texto).forEach((r, i) => {
    const fila = i + 2;
    const codigo = (r.codigo ?? "").trim();
    if (!codigo) throw new Error(`Nombres de Journaway, fila ${fila}: falta el código.`);
    const nombre = (r.nombre ?? "").replace(/\s+/gu, " ").trim();
    if (!nombre) throw new Error(`Nombres de Journaway, fila ${fila}: falta el nombre.`);
    const origen = (r.origen ?? "").trim() as OrigenNombre;
    if (!ORIGENES_NOMBRE.includes(origen)) {
      throw new Error(`Nombres de Journaway, fila ${fila}: origen «${r.origen}» inválido (usar ${ORIGENES_NOMBRE.join(" | ")}).`);
    }
    const limpio = limpiarNombreJournaway(nombre);
    const anterior = porLimpio.get(limpio);
    if (anterior) {
      if (anterior.codigo === codigo) return; // el mismo nombre dos veces en un producto: una sola fila
      throw new Error(
        `Nombres de Journaway, fila ${fila}: «${limpio}» apunta a dos productos (${anterior.codigo}, fila ${anterior.fila}, y ${codigo}). No se cargó nada.`,
      );
    }
    const n: NombreJournaway = { fila, codigo, nombre, limpio, origen };
    porLimpio.set(limpio, n);
    nombres.push(n);
  });
  return nombres;
}
