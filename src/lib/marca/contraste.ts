/**
 * Contraste WCAG 2.x entre dos colores hex (marca.md §1: todo texto sobre su
 * fondo ≥ 4.5:1). Lo usa el test de tokens de `globals.css` (spec M1-06 #13).
 */

function luminancia(hex: string): number {
  const limpio = hex.replace("#", "");
  const canales = [0, 2, 4].map((i) => parseInt(limpio.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Lee las custom properties `--x: #hex;` de una hoja de estilos, en minúscula. */
export function leerTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, nombre, valor] of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[nombre] = valor.toLowerCase();
  }
  return tokens;
}
