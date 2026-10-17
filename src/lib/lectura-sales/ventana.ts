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
