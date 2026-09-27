/**
 * Clasificación de la celda "Mail/web" de la hoja "Contactos hi" (spec M1-03,
 * Anexo técnico "Reglas simples antes que IA", en ese orden):
 *
 * 1. Vacía o `#ERROR!` → `vacia` (no hay dato; no se llama a la IA).
 * 2. Contiene mail(s) válidos → `mail`, con TODOS los mails de la celda.
 * 3. Sin mail pero con "wpp"/"wsp"/"whatsapp" → `whatsapp`, sin mail.
 * 4. Sin mail pero con un link/dominio web → `web`, sin mail (nunca se arma
 *    un mail a partir del link).
 * 5. Cualquier otro texto → `ambigua` (candidata al respaldo de IA). Incluye
 *    celdas con "@" que no forman un mail válido (ej. un dominio truncado):
 *    no se "completan" por regla.
 *
 * Función pura: no decide qué se guarda en `aclaraciones`; eso lo hace el
 * armado del registro con el texto original de la celda.
 */

export type TipoCeldaMail = "vacia" | "mail" | "whatsapp" | "web" | "ambigua";

export interface ResultadoCeldaMail {
  tipo: TipoCeldaMail;
  /** Mails encontrados literalmente en la celda, en minúsculas y sin repetir. */
  mails: string[];
}

// Un mail: parte local + "@" + dominio con al menos un punto y un TLD de letras.
const PATRON_MAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const PATRON_WHATSAPP = /wpp|wsp|whats\s?app/i;
const PATRON_WEB =
  /https?:\/\/|www\.|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|travel|tur|ar|cl|br|uy|bo|pe|py)\b/i;

export function extraerMails(texto: string): string[] {
  const encontrados = texto.match(PATRON_MAIL) ?? [];
  const unicos: string[] = [];
  for (const crudo of encontrados) {
    const mail = crudo.toLowerCase().replace(/^[._%+-]+/, "");
    if (!unicos.includes(mail)) unicos.push(mail);
  }
  return unicos;
}

export function esCeldaVacia(texto: string | null | undefined): boolean {
  const limpio = (texto ?? "").trim();
  return limpio === "" || limpio.toUpperCase() === "#ERROR!";
}

export function clasificarCeldaMail(texto: string | null | undefined): ResultadoCeldaMail {
  if (esCeldaVacia(texto)) return { tipo: "vacia", mails: [] };
  const valor = String(texto);

  const mails = extraerMails(valor);
  if (mails.length > 0) return { tipo: "mail", mails };

  if (PATRON_WHATSAPP.test(valor)) return { tipo: "whatsapp", mails: [] };
  if (PATRON_WEB.test(valor)) return { tipo: "web", mails: [] };

  return { tipo: "ambigua", mails: [] };
}
