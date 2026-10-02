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

function soloLetrasYNumeros(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * En el Excel vigente (.xls, spec M1-04c) la sección 2 no siempre empieza con
 * "Paquete(s) …": a veces su título repite el código del bloque ("Buenos
 * Aires, Tango City OD018") o solo el nombre del paquete ("Mendoza Mountains
 * and Wineries"). Cualquiera de los dos también cierra la sección 1.
 */
function esTituloDeSeccion2(texto: string, bloque: BloqueProducto): boolean {
  if (!texto) return false;
  if (reCodigo(bloque.codigo).test(texto)) return true;
  const nombre = soloLetrasYNumeros(bloque.nombre);
  return nombre.length > 0 && soloLetrasYNumeros(texto) === nombre;
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
    if (linea.clase === "fin_seccion" || esTituloDeSeccion2(texto, bloque)) {
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

// ---------------------------------------------------------------------------
// Excel vigente (.xls, spec M1-04c): ubicar cada paquete por su código en
// toda la hoja, no solo en la fila de encabezado de su destino.
// ---------------------------------------------------------------------------

export interface PaqueteAUbicar {
  codigo: string;
  /** Destino según la lista de paquetes (data/paquetes-piloto.csv). */
  destino: string;
}

export interface BloqueUbicado {
  bloque: BloqueProducto;
  /** Desde la fila del título del bloque hasta el próximo destino (columna A). */
  rango: RangoDestino;
  /** Celda del título del bloque ("B480"). */
  celda: string;
  /** Destino que dice la columna A en la fila del título; null si no dice ninguno. */
  destinoExcel: string | null;
}

export interface AparicionCodigo {
  celda: string;
  texto: string;
}

export interface CodigoNoUbicado {
  codigo: string;
  motivo: string;
  /** Celdas donde aparece el código (si aparece). */
  apariciones: AparicionCodigo[];
  /** Texto de alrededor de la primera aparición, para que el owner ubique de qué se trata. */
  contexto: AparicionCodigo[];
}

export interface CodigoDuplicado {
  codigo: string;
  celdaUsada: string;
  /** Títulos de otros bloques con el mismo código. */
  otrasCeldas: string[];
}

export const MOTIVO_CODIGO_AUSENTE = "el código no aparece en la hoja";
export const MOTIVO_CODIGO_SIN_TITULO =
  "aparece solo el código, sin el nombre del paquete: no parece el título de un bloque";

function referencia(fila: number, col: number): string {
  return `${letraColumna(col)}${fila + 1}`;
}

/** El texto de la celda sin el código: si queda algo con letras, la celda es un título con nombre. */
function nombreSinCodigo(texto: string, re: RegExp): string {
  return limpiarNombre(texto.replace(new RegExp(re.source, "g"), " "));
}

function tieneNombre(texto: string, re: RegExp): boolean {
  return /\p{L}/u.test(nombreSinCodigo(texto, re));
}

function esNumero(texto: string): boolean {
  return /^[-\d\s.,$%]+$/.test(texto);
}

/** Apariciones del mismo bloque: columnas de la sección 1 + resumen, dentro de las filas del bloque. */
function mismoBloque(titulo: { r: number; c: number }, otra: { r: number; c: number }): boolean {
  return (
    otra.c >= titulo.c &&
    otra.c < titulo.c + 2 * ANCHO_SECCION_1 &&
    otra.r >= titulo.r &&
    otra.r < titulo.r + FILAS_MAXIMAS_BLOQUE
  );
}

export function ubicarBloquesEnHoja(
  filas: Filas,
  paquetes: PaqueteAUbicar[],
): { ubicados: BloqueUbicado[]; noUbicados: CodigoNoUbicado[]; duplicados: CodigoDuplicado[] } {
  const ubicados: BloqueUbicado[] = [];
  const noUbicados: CodigoNoUbicado[] = [];
  const duplicados: CodigoDuplicado[] = [];

  for (const { codigo, destino } of paquetes) {
    const re = reCodigo(codigo);
    const apariciones: Array<{ r: number; c: number; texto: string }> = [];
    filas.forEach((fila, r) =>
      fila.forEach((_, c) => {
        const texto = celda(filas, r, c);
        if (re.test(texto)) apariciones.push({ r, c, texto: limpiarNombre(texto) });
      }),
    );
    if (apariciones.length === 0) {
      noUbicados.push({ codigo, motivo: MOTIVO_CODIGO_AUSENTE, apariciones: [], contexto: [] });
      continue;
    }

    const titulos = apariciones.filter((a) => tieneNombre(a.texto, re));
    if (titulos.length === 0) {
      const [primera] = apariciones;
      const contexto: AparicionCodigo[] = [];
      for (let r = Math.max(0, primera.r - 1); r <= primera.r + 1; r++) {
        for (let c = Math.max(0, primera.c - 2); c < primera.c; c++) {
          const texto = limpiarNombre(celda(filas, r, c));
          if (texto && !esNumero(texto) && !re.test(texto)) contexto.push({ celda: referencia(r, c), texto });
        }
      }
      noUbicados.push({
        codigo,
        motivo: MOTIVO_CODIGO_SIN_TITULO,
        apariciones: apariciones.map((a) => ({ celda: referencia(a.r, a.c), texto: a.texto })),
        contexto,
      });
      continue;
    }

    const titulo = titulos[0];
    const delBloque = apariciones.filter((a) => mismoBloque(titulo, a));
    const otros = titulos.filter((a) => !mismoBloque(titulo, a));
    if (otros.length) {
      duplicados.push({
        codigo,
        celdaUsada: referencia(titulo.r, titulo.c),
        otrasCeldas: otros.map((a) => referencia(a.r, a.c)),
      });
    }

    // Resumen (sección 3): la primera aparición a la derecha del título. Si
    // trae solo el código, el nombre y la tabla están en la celda de su izquierda.
    const resumen = delBloque.filter((a) => a.c > titulo.c).sort((a, b) => a.r - b.r || a.c - b.c)[0];
    let columnaResumen: number | null = null;
    let textoNombre = titulo.texto;
    if (resumen) {
      columnaResumen = resumen.c;
      if (tieneNombre(resumen.texto, re)) {
        textoNombre = resumen.texto;
      } else {
        const izquierda = limpiarNombre(celda(filas, resumen.r, resumen.c - 1));
        if (resumen.c - 1 > titulo.c && izquierda && !esNumero(izquierda)) {
          columnaResumen = resumen.c - 1;
          textoNombre = izquierda;
        }
      }
    }

    let columnaFin = titulo.c + ANCHO_SECCION_1;
    for (let c = titulo.c + 1; c < columnaFin; c++) {
      const otrosCodigos = (celda(filas, titulo.r, c).match(CODIGO_PRODUCTO) ?? []).filter((x) => x !== codigo);
      if (otrosCodigos.length) {
        columnaFin = c;
        break;
      }
    }

    let hasta = filas.length;
    for (let r = titulo.r + 1; r < filas.length; r++) {
      if (CODIGO_DESTINO.test(celda(filas, r, 0).trim())) {
        hasta = r;
        break;
      }
    }
    const columnaA = celda(filas, titulo.r, 0).trim();

    ubicados.push({
      bloque: {
        codigo,
        nombre: nombreSinCodigo(textoNombre, re),
        destino,
        columna: titulo.c,
        columnaFin,
        columnaResumen,
      },
      rango: { desde: titulo.r, hasta },
      celda: referencia(titulo.r, titulo.c),
      destinoExcel: CODIGO_DESTINO.test(columnaA) ? columnaA : null,
    });
  }

  return { ubicados, noUbicados, duplicados };
}

/**
 * De los niveles que nombra la tabla de precios del resumen, los que tienen
 * un precio de verdad en la columna de al lado (no "-", 0 ni vacío). Un nivel
 * con precio pero sin línea "Accommodation … Booking Supplier" es una
 * contradicción para confirmar; uno sin precio es un nivel vacante (como el
 * Budget Hotel de OD010A). Spec M1-04c §3 #5.
 */
export function nivelesConPrecioEnResumen(
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
    const precio = Number(limpiarNombre(celda(filas, r, bloque.columnaResumen + 1)).replace(/[,$\s]/g, ""));
    if (nivel && Number.isFinite(precio) && precio > 0) niveles.add(nivel);
  }
  return [...niveles];
}
