/** Formatos de marca.md §5: fechas DD/MM/AAAA, horas 24 h en la hora local del usuario. */
export function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

const SIN_DATO = "—";

/**
 * Una fecha sin hora ("2026-03-12", como la guarda la base) en DD/MM/AAAA.
 * Se lee como texto: una fecha de viaje no tiene zona horaria y no se corre
 * de día según quién la mire. Lo que falta o no es fecha, "—".
 */
export function formatearFecha(fecha: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : SIN_DATO;
}

/** Rango de fechas del viaje: `12/03/2026 → 15/03/2026` (marca.md §5). */
export function formatearRango(inicio: string | null | undefined, fin: string | null | undefined): string {
  if (!inicio && !fin) return SIN_DATO;
  return `${formatearFecha(inicio)} → ${formatearFecha(fin)}`;
}

/**
 * La hora de un vuelo tal como la dice el mail (es la hora del aeropuerto):
 * no se convierte a la hora del que mira. "9:05" → "09:05"; "14:35:00" →
 * "14:35"; un texto que no es hora se muestra tal cual.
 */
export function formatearHora(hora: string | null | undefined): string {
  if (!hora || !hora.trim()) return SIN_DATO;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora.trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : hora.trim();
}
