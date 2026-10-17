/** Corta con un mensaje claro si el encabezado de un CSV de `data/` no trae todas las columnas. */
export function requerirColumnas(texto: string, columnas: string[], archivo: string): void {
  const encabezado = texto.replace(/^﻿/, "").split(/\r?\n/)[0].split(",").map((c) => c.trim());
  const faltan = columnas.filter((c) => !encabezado.includes(c));
  if (faltan.length) throw new Error(`${archivo}: faltan las columnas ${faltan.join(", ")}.`);
}

/** Un número entero de una celda, o null si no es un entero mayor o igual a `minimo`. */
export function entero(texto: string | undefined, minimo = 1): number | null {
  const t = (texto ?? "").trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= minimo ? n : null;
}
