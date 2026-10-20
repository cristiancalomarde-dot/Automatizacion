/**
 * Viajes terminados y administradoras (spec M3-08 filas 5 y 6). Funciones
 * puras: el servidor las usa para decidir qué trae la lista (un operador no
 * recibe las terminadas) y la pantalla, para separar la vista de terminadas.
 * Sin base ni red; la variable `ADMINS_EMAILS` la lee quien llama (#2).
 */

const ZONA_ARGENTINA = "America/Argentina/Buenos_Aires";

/** La fecha de hoy en Argentina, "AAAA-MM-DD" (el servidor de Vercel corre en UTC). */
export function hoyEnArgentina(ahora: Date = new Date()): string {
  // en-CA da "AAAA-MM-DD".
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_ARGENTINA, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

/** Terminó si su fin del viaje es anterior a hoy. Sin fecha de fin no se esconde: nunca se adivina. */
export function esTerminada(f: { fechaFin: string | null }, hoy: string): boolean {
  return f.fechaFin !== null && f.fechaFin < hoy;
}

/** Los mails de `ADMINS_EMAILS` (separados por coma), en minúscula. */
export function mailsAdministradoras(lista: string | undefined | null): string[] {
  return (lista ?? "")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
}

/** Si el mail de la sesión está entre las administradoras. Sin mail o sin lista, no. */
export function esAdministradora(email: string | null | undefined, lista: string | undefined | null): boolean {
  const mail = (email ?? "").trim().toLowerCase();
  return mail !== "" && mailsAdministradoras(lista).includes(mail);
}
