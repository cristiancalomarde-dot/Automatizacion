/**
 * El HTML de un mail como texto (M2-02). Sin dependencias de servidor: lo usa
 * la lectura con IA y la pantalla del mail original (M2-05), que lo muestra
 * siempre como texto, nunca como página.
 */

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  Uuml: "Ü",
  Ouml: "Ö",
  Auml: "Ä",
  szlig: "ß",
  oslash: "ø",
  Oslash: "Ø",
  aring: "å",
  Aring: "Å",
  aelig: "æ",
  AElig: "Æ",
  ccedil: "ç",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e] ?? m;
  });
}

/** El HTML de un mail como texto: renglones por `<br>`, párrafos y filas; celdas separadas por " | ". */
export function htmlATexto(html: string): string {
  const t = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/(td|th)\s*>\s*(?=<(td|th)\b)/gi, " | ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|tr|table|li|ul|ol|h[1-6]|blockquote|section|article|header|footer)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodificarEntidades(t)
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
