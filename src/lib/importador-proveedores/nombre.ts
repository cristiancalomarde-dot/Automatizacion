/**
 * Normalización del nombre de un proveedor (spec M1-03 §3 #3,
 * docs/arquitectura/modelo-de-datos.md: `proveedor.nombre_normalizado`).
 *
 * La forma canónica es: sin espacios al borde, espacios internos colapsados a
 * uno, todo en minúsculas. Es la clave (junto con el destino) que usa el
 * importador para decidir si dos filas son "el mismo proveedor". No toca la
 * ortografía ni la puntuación: dos nombres realmente distintos no se fusionan.
 */
export function normalizarNombre(nombre: string): string {
  return limpiarNombre(nombre).toLowerCase();
}

/** Nombre para mostrar: recortado y con espacios colapsados, mayúsculas tal cual. */
export function limpiarNombre(nombre: string): string {
  return nombre.replace(/\s+/g, " ").trim();
}
