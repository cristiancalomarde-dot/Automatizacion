/**
 * Qué carpetas se leen (spec M2-07 #2 y #3): Inbox y Spam. El nombre real de
 * Spam se descubre en el servidor: primero la marcada `\Junk` por el servidor
 * (no la que imapflow adivina por el nombre); si no hay, la que tenga "spam"
 * o "junk" en el nombre. Promociones, Trash, Sent y Drafts no se leen.
 */

export interface CarpetaListada {
  path: string;
  /** Atributos de LIST tal cual los manda el servidor (`\Junk`, `\Noselect`…). */
  atributos: string[];
}

const NO_ABRIBLES = new Set(["\\noselect", "\\nonexistent"]);
const abrible = (c: CarpetaListada) => !c.atributos.some((a) => NO_ABRIBLES.has(a.toLowerCase()));

export function carpetaInbox(carpetas: readonly CarpetaListada[]): string {
  return carpetas.find((c) => c.path.toUpperCase() === "INBOX")?.path ?? "INBOX";
}

export function carpetaSpam(carpetas: readonly CarpetaListada[]): string | null {
  const candidatas = carpetas.filter(abrible).filter((c) => c.path.toUpperCase() !== "INBOX");
  const marcada = candidatas.find((c) => c.atributos.some((a) => a.toLowerCase() === "\\junk"));
  if (marcada) return marcada.path;
  return candidatas.find((c) => /spam|junk/i.test(c.path))?.path ?? null;
}
