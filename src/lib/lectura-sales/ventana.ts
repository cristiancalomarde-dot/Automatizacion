/**
 * La ventana de lectura (spec M2-07 #9): los mails de los últimos 7 días. Así
 * una corrida que falló (o un día sin cron) se recupera en la siguiente.
 */

export const DIAS_VENTANA = 7;

export function inicioDeLaVentana(ahora: Date, dias: number = DIAS_VENTANA): Date {
  if (!Number.isInteger(dias) || dias < 1 || dias > 60) throw new Error("Los días de la ventana van de 1 a 60.");
  return new Date(ahora.getTime() - dias * 86_400_000);
}

export function dentroDeLaVentana(fecha: Date, ahora: Date, dias: number = DIAS_VENTANA): boolean {
  return fecha.getTime() >= inicioDeLaVentana(ahora, dias).getTime();
}

/**
 * Desde cuándo se lee: la ventana, pero nunca antes de la fecha de arranque
 * (`LECTURA_SALES_DESDE`). Así lo que llegó antes de prender la lectura, que el
 * equipo ya está gestionando, no entra (owner, 2026-10-17).
 */
export function desdeCuandoLeer(ahora: Date, dias: number = DIAS_VENTANA, arranque: Date | null = null): Date {
  const ventana = inicioDeLaVentana(ahora, dias);
  return arranque && arranque.getTime() > ventana.getTime() ? arranque : ventana;
}
