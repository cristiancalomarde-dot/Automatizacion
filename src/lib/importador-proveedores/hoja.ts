import { limpiarNombre, normalizarNombre } from "./nombre";

/**
 * Lectura de la hoja "Contactos hi" del Excel de proveedores (spec M1-03 §2 y
 * §3 #1-#3). Trabaja sobre la hoja ya convertida a filas de texto (una fila =
 * un array de celdas), así se puede probar sin el archivo real.
 *
 * Formato real de la hoja (columnas A-F):
 *   A: categoría (Hotel, Hostel, ...) — o el destino, si el encabezado dice "DESTINO"
 *   B: estrellas (el encabezado de esta columna dice "CATEGORIAS")
 *   C: PROVEEDOR · D: Mail/web · E: Aclaraciones · F: Nro para el voucher (no se carga)
 *
 * Tipos de fila:
 *   - fila-bloque: solo la col A con texto. Si es EXCURSIONES / TRANSFER /
 *     TRANSFER|EXCURSION es un sub-bloque de categoría dentro del destino
 *     actual; si no, es un destino nuevo. Un rótulo sin letras ("<<") abre un
 *     bloque SIN destino (no se inventa cuál es).
 *   - encabezado: col C = "PROVEEDOR".
 *   - proveedor: col C con texto.
 *   - continuación: col C vacía pero con Mail/web o Aclaraciones → se suma al
 *     proveedor de la fila de arriba (no se descarta ni se crea uno sin nombre).
 */

export interface FilaProveedor {
  /** Número de fila en el Excel (1-based), para trazabilidad. */
  filaExcel: number;
  destino: string | null;
  categoria: string | null;
  estrellas: string | null;
  nombre: string;
  /** Celdas "Mail/web" crudas (más de una si hubo filas de continuación). */
  celdasMailWeb: string[];
  /** Texto de la columna "Aclaraciones", tal cual (recortado). */
  aclaraciones: string[];
}

export interface ProveedorAgrupado {
  destino: string | null;
  nombre: string;
  nombreNormalizado: string;
  categorias: string[];
  estrellas: string[];
  celdasMailWeb: string[];
  aclaraciones: string[];
  filasExcel: number[];
}

const COL = { categoria: 0, estrellas: 1, proveedor: 2, mailWeb: 3, aclaraciones: 4, voucher: 5 };

const PATRON_SUBBLOQUE_CATEGORIA =
  /^(excursion(es)?|transfer(s|es)?|traslados?)(\s*[|/]\s*(excursion(es)?|transfer(s|es)?|traslados?))*$/i;

function celda(fila: readonly unknown[] | undefined, indice: number): string {
  const valor = fila?.[indice];
  return valor === undefined || valor === null ? "" : String(valor).trim();
}

function normalizarDestino(texto: string): string | null {
  const limpio = limpiarNombre(texto).toUpperCase();
  return /\p{L}/u.test(limpio) ? limpio : null;
}

function agregarSinRepetir(lista: string[], valor: string | null) {
  if (valor && !lista.includes(valor)) lista.push(valor);
}

export function leerHojaContactos(filas: readonly (readonly unknown[])[]): FilaProveedor[] {
  const resultado: FilaProveedor[] = [];
  let destino: string | null = null;
  let categoriaBloque: string | null = null;
  let colAEsDestino = false;

  filas.forEach((fila, indice) => {
    const a = celda(fila, COL.categoria);
    const b = celda(fila, COL.estrellas);
    const c = celda(fila, COL.proveedor);
    const d = celda(fila, COL.mailWeb);
    const e = celda(fila, COL.aclaraciones);
    const f = celda(fila, COL.voucher);

    if (!a && !b && !c && !d && !e && !f) return;

    // Encabezado del bloque.
    if (c.toUpperCase() === "PROVEEDOR") {
      colAEsDestino = a.toUpperCase() === "DESTINO";
      return;
    }

    // Fila-bloque: destino o sub-bloque de categoría.
    if (a && !b && !c && !d && !e && !f) {
      const rotulo = limpiarNombre(a);
      if (PATRON_SUBBLOQUE_CATEGORIA.test(rotulo)) {
        categoriaBloque = rotulo;
      } else {
        destino = normalizarDestino(rotulo);
        categoriaBloque = null;
        colAEsDestino = false;
      }
      return;
    }

    // Continuación: sin nombre de proveedor, pero con datos de contacto.
    if (!c) {
      const anterior = resultado.at(-1);
      if (anterior && (d || e)) {
        if (d) anterior.celdasMailWeb.push(d);
        if (e) anterior.aclaraciones.push(e);
      }
      return;
    }

    let categoria: string | null;
    if (colAEsDestino) {
      categoria = a && normalizarDestino(a) !== destino ? limpiarNombre(a) : categoriaBloque;
    } else {
      categoria = a ? limpiarNombre(a) : categoriaBloque;
    }

    resultado.push({
      filaExcel: indice + 1,
      destino,
      categoria,
      estrellas: b && b !== "0" ? b : null,
      nombre: limpiarNombre(c),
      celdasMailWeb: d ? [d] : [],
      aclaraciones: e ? [e] : [],
    });
  });

  return resultado;
}

/**
 * Une las filas que son "el mismo proveedor": mismo nombre normalizado dentro
 * del mismo destino (Anexo técnico, "Normalización de nombre"). Filas en
 * destinos distintos quedan separadas a propósito (§5, fuera de alcance).
 */
export function agruparProveedores(filas: readonly FilaProveedor[]): ProveedorAgrupado[] {
  const grupos = new Map<string, ProveedorAgrupado>();

  for (const fila of filas) {
    const nombreNormalizado = normalizarNombre(fila.nombre);
    const clave = `${fila.destino ?? ""}\u0000${nombreNormalizado}`;
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = {
        destino: fila.destino,
        nombre: fila.nombre,
        nombreNormalizado,
        categorias: [],
        estrellas: [],
        celdasMailWeb: [],
        aclaraciones: [],
        filasExcel: [],
      };
      grupos.set(clave, grupo);
    }
    agregarSinRepetir(grupo.categorias, fila.categoria);
    agregarSinRepetir(grupo.estrellas, fila.estrellas);
    fila.celdasMailWeb.forEach((valor) => agregarSinRepetir(grupo.celdasMailWeb, valor));
    fila.aclaraciones.forEach((valor) => agregarSinRepetir(grupo.aclaraciones, valor));
    grupo.filasExcel.push(fila.filaExcel);
  }

  return [...grupos.values()];
}
