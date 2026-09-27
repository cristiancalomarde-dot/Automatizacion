import { limpiarNombre } from "@/lib/importador-proveedores/nombre";
import { clasificarLinea, nivelDeAlojamiento, type ServicioLeido } from "./linea";

/**
 * Ubicación de los bloques de producto dentro de la hoja "Analisis a Mayo
 * 2026" y lectura de su sección 1 (spec M1-04 §3 #1, #2, #9, #10).
 *
 * Estructura real de la hoja (reglas de "Readme AI" + inspección del archivo):
 * - Los destinos se apilan hacia abajo: cada uno arranca en una fila cuya
 *   columna A trae el código del destino ("IGR", "MDZ", "USH"…).
 * - En la fila de encabezado del destino, cada producto es un bloque de
 *   columnas lado a lado. El código del producto aparece en la primera
 *   columna del bloque (sección 1: construcción + costos) y otra vez en la
 *   columna del resumen (sección 3) con el nombre comercial.
 * - La sección 1 es la columna del código, desde el encabezado hasta la
 *   primera celda "Paquete(s) …" (donde empieza la sección 2, cálculo de
 *   costos). Las columnas de números a su derecha son costos: no se leen.
 */

/** Filas de la hoja como las devuelve SheetJS (`header: 1`), índices 0-based. */
export type Filas = string[][];

export interface RangoDestino {
  /** Fila (0-based) del encabezado del destino. */
  desde: number;
  /** Primera fila (0-based) que ya no es de este destino. */
  hasta: number;
}

export interface BloqueProducto {
  codigo: string;
  nombre: string;
  destino: string;
  /** Columna (0-based) de la sección 1. */
  columna: number;
  /** Primera columna (0-based) que ya no es de la sección 1 de este bloque. */
  columnaFin: number;
  /** Columna (0-based) del resumen (sección 3), donde el código aparece otra vez; null si no aparece. */
  columnaResumen: number | null;
}

export interface LineaDudosa {
  /** Fila del Excel, 1-based. */
  fila: number;
  texto: string;
  motivo: string;
}

export interface NivelSinProveedor {
  fila: number;
  texto: string;
  nivel: string;
}

export interface CorreccionAplicada {
  fila: number;
  texto: string;
  correccion: string;
}

export interface LecturaSeccion1 {
  servicios: ServicioLeido[];
  /** Correcciones de tipeo que aplicaron las reglas (ej. "7" por "/"), para el reporte. */
  correcciones: CorreccionAplicada[];
  dudosas: LineaDudosa[];
  /** Líneas que son solo la etiqueta de un nivel ("Budget Hotel"), sin proveedor identificable. */
  nivelesSinProveedor: NivelSinProveedor[];
  /** Fila (0-based) donde empieza la sección 2 ("Paquete(s) …"); null si no se encontró. */
  filaFin: number | null;
  /** `false` = el bloque no calza con la estructura esperada (columnas corridas, etc.). */
  estructuraOk: boolean;
}

const CODIGO_DESTINO = /^[A-Z]{3}$/;
const CODIGO_PRODUCTO = /(?<![A-Za-z0-9])[A-Z]{2}\d{3}[A-Z0-9]*(?![A-Za-z0-9])/g;
/** Ancho de la sección 1: texto + netos + agency net + markup (la sección 3 arranca 4 columnas después). */
const ANCHO_SECCION_1 = 4;
const FILAS_MAXIMAS_BLOQUE = 40;

function celda(filas: Filas, fila: number, col: number): string {
  return String(filas[fila]?.[col] ?? "");
}

function reCodigo(codigo: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${codigo}(?![A-Za-z0-9])`);
}

export function ubicarDestino(filas: Filas, codigoDestino: string): RangoDestino | null {
  const desde = filas.findIndex((f) => celda([f], 0, 0).trim() === codigoDestino);
  if (desde === -1) return null;
  let hasta = filas.length;
  for (let r = desde + 1; r < filas.length; r++) {
    if (CODIGO_DESTINO.test(celda(filas, r, 0).trim())) {
      hasta = r;
      break;
    }
  }
  return { desde, hasta };
}

export function ubicarBloques(
  filas: Filas,
  rango: RangoDestino,
  codigos: string[],
): { bloques: BloqueProducto[]; noEncontrados: string[] } {
  const encabezado = filas[rango.desde] ?? [];
  const destino = celda(filas, rango.desde, 0).trim();
  const bloques: BloqueProducto[] = [];
  const noEncontrados: string[] = [];

  for (const codigo of codigos) {
    const re = reCodigo(codigo);
    const columnas = encabezado.map((_, c) => c).filter((c) => c > 0 && re.test(celda(filas, rango.desde, c)));
    if (columnas.length === 0) {
      noEncontrados.push(codigo);
      continue;
    }
    const columna = columnas[0];
    const textoNombre = celda(filas, rango.desde, columnas[columnas.length - 1]);
    const nombre = limpiarNombre(textoNombre.replace(re, " "));

    // La sección 1 ocupa ANCHO_SECCION_1 columnas, o menos si antes aparece OTRO código en el encabezado.
    let columnaFin = columna + ANCHO_SECCION_1;
    for (let c = columna + 1; c < columnaFin; c++) {
      const otros = (celda(filas, rango.desde, c).match(CODIGO_PRODUCTO) ?? []).filter((x) => x !== codigo);
      if (otros.length) {
        columnaFin = c;
        break;
      }
    }
    const ultima = columnas[columnas.length - 1];
    bloques.push({ codigo, nombre, destino, columna, columnaFin, columnaResumen: ultima > columna ? ultima : null });
  }

  bloques.sort((a, b) => a.columna - b.columna);
  return { bloques, noEncontrados };
}

export function leerSeccion1(filas: Filas, bloque: BloqueProducto, rango: RangoDestino): LecturaSeccion1 {
  const servicios: ServicioLeido[] = [];
  const dudosas: LineaDudosa[] = [];
  const nivelesSinProveedor: NivelSinProveedor[] = [];
  const correcciones: CorreccionAplicada[] = [];
  let filaFin: number | null = null;
  let ultimaLinea: ServicioLeido[] = [];

  for (let r = rango.desde + 1; r < rango.hasta; r++) {
    const texto = limpiarNombre(celda(filas, r, bloque.columna));
    const linea = clasificarLinea(texto);
    if (linea.clase === "fin_seccion") {
      filaFin = r;
      break;
    }
    if (linea.clase === "servicio") {
      ultimaLinea = linea.servicios.map((s) => ({ ...s, fila: r + 1, descripcion: texto }));
      servicios.push(...ultimaLinea);
      for (const correccion of linea.correcciones) correcciones.push({ fila: r + 1, texto, correccion });
    } else if (linea.clase === "incluye") {
      if (ultimaLinea.length === 0) {
        dudosas.push({ fila: r + 1, texto, motivo: "\"Includes\" sin servicio anterior" });
      } else {
        for (const s of ultimaLinea) s.descripcion = `${s.descripcion}\n${linea.texto}`;
      }
    } else if (linea.clase === "nivel_sin_proveedor") {
      nivelesSinProveedor.push({ fila: r + 1, texto, nivel: linea.nivel });
    } else if (linea.clase === "dudosa") {
      dudosas.push({ fila: r + 1, texto, motivo: linea.motivo });
    }
  }

  return {
    servicios,
    correcciones,
    dudosas,
    nivelesSinProveedor,
    filaFin,
    estructuraOk: filaFin !== null && servicios.length > 0,
  };
}

/**
 * Niveles de alojamiento que nombra la columna de resumen (sección 3) del
 * bloque, en filas de habitación ("Budget Hotel DBL", "Hotel La Aldea 4*
 * SGL"). Solo se usa para CONTROLAR que cada nivel ofrecido tenga su línea
 * con proveedor en la sección 1; del resumen no se carga ningún dato.
 */
export function nivelesDelResumen(
  filas: Filas,
  bloque: BloqueProducto,
  rango: RangoDestino,
  hastaFila: number | null,
): string[] {
  if (bloque.columnaResumen === null) return [];
  const niveles = new Set<string>();
  const hasta = Math.min(rango.hasta, hastaFila ?? rango.hasta);
  for (let r = rango.desde + 1; r < hasta; r++) {
    const texto = limpiarNombre(celda(filas, r, bloque.columnaResumen));
    if (!/\b(dbl|sgl|dorm)\b/i.test(texto) || /supplement/i.test(texto)) continue;
    const nivel = nivelDeAlojamiento(texto);
    if (nivel) niveles.add(nivel);
  }
  return [...niveles];
}

function letraColumna(c: number): string {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * La sección 1 del bloque como texto, para pedirle a la IA que la interprete
 * (spec §3 #10). Incluye todas las columnas del bloque (por si el cuerpo quedó
 * corrido) y omite las celdas puramente numéricas (costos: no hacen falta).
 */
export function textoDelBloque(filas: Filas, bloque: BloqueProducto, rango: RangoDestino): string {
  const lineas: string[] = [];
  const hasta = Math.min(rango.hasta, rango.desde + FILAS_MAXIMAS_BLOQUE);
  for (let r = rango.desde; r < hasta; r++) {
    const celdas: string[] = [];
    let fin = false;
    for (let c = bloque.columna; c < bloque.columnaFin; c++) {
      const texto = limpiarNombre(celda(filas, r, c));
      if (!texto || /^[-\d\s.,$%]+$/.test(texto)) continue;
      if (r > rango.desde && clasificarLinea(texto).clase === "fin_seccion") fin = true;
      celdas.push(`${letraColumna(c)}${r + 1}: ${texto}`);
    }
    if (fin) break;
    if (celdas.length) lineas.push(celdas.join(" | "));
  }
  return lineas.join("\n");
}
