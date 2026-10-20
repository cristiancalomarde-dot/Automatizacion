/**
 * Cómo se escriben las cosas en el pedido (spec M3-01 fila 3): fechas cortas
 * en español ("3 oct 2026"), la habitación, el nivel del alojamiento y los
 * datos de los pasajeros. Puro, sin base.
 */
import { normalizarTexto } from "@/lib/catalogo/reglas";
import type { PasajeroDeReserva } from "./tipos";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-03" → "3 oct 2026". Lo que no es una fecha se devuelve tal cual. */
export function fechaCorta(fecha: string): string {
  const m = fecha.match(ISO);
  if (!m) return fecha;
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

/** "del 24 al 28 ene 2027" / "del 30 ene al 2 feb 2027" / "del 30 dic 2026 al 2 ene 2027". */
export function rangoCorto(desde: string, hasta: string): string {
  const a = desde.match(ISO);
  const b = hasta.match(ISO);
  if (!a || !b) return `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
  if (a[1] !== b[1]) return `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
  if (a[2] !== b[2]) return `del ${Number(a[3])} ${MESES[Number(a[2]) - 1]} al ${fechaCorta(hasta)}`;
  return `del ${Number(a[3])} al ${fechaCorta(hasta)}`;
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

/** "1990-05-17" → "17/05/1990"; lo demás tal cual (un dato enmascarado, por ejemplo). */
export function fechaDeNacimiento(fecha: string): string {
  const m = fecha.match(ISO);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

/** El nivel de alojamiento que dice la habitación de la agencia ("Double Room - Hostel" → "Hostel"). */
export function nivelDeLaHabitacion(habitacion: string | null): string | null {
  if (!habitacion) return null;
  const h = normalizarTexto(habitacion);
  if (/\b4\s*(\*|estrellas|stars?)/.test(h)) return "Hotel 4*";
  if (/\b3\s*(\*|estrellas|stars?)/.test(h)) return "Hotel 3*";
  if (/budget/.test(h)) return "Budget Hotel";
  if (/hostel|dorm/.test(h)) return "Hostel";
  return null;
}

/**
 * La habitación en el Overland (owner, 2026-10-19): dorm a compartir, DBL o SGL con baño compartido.
 * Null si no vino.
 */
export function habitacionDelOverland(habitacion: string | null): string | null {
  if (!habitacion?.trim()) return null;
  const h = normalizarTexto(habitacion.split(/\s+-\s+/)[0]);
  if (/dorm/.test(h)) return "dorm compartido";
  if (/\b(double|doble|dbl|matrimonial|twin)\b/.test(h)) return "DBL con baño compartido";
  if (/\b(single|sgl|individual|simple)\b/.test(h)) return "SGL con baño compartido";
  return tipoDeHabitacion(habitacion);
}

/** El tipo de habitación en español ("Double Room - Hostel" → "doble"). Null si no vino. */
export function tipoDeHabitacion(habitacion: string | null): string | null {
  if (!habitacion?.trim()) return null;
  const base = habitacion.split(/\s+-\s+/)[0].trim();
  const h = normalizarTexto(base);
  if (/dorm/.test(h)) return /travel+ing together|juntos/.test(h) ? "dorm compartido (viajan juntos)" : "dorm compartido";
  if (/\b(double|doble|dbl|matrimonial)\b/.test(h)) return "doble";
  if (/\btwin\b/.test(h)) return "twin";
  if (/\b(single|sgl|individual|simple)\b/.test(h)) return "single";
  if (/\b(triple|tpl)\b/.test(h)) return "triple";
  return base;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function nombreDelPasajero(p: PasajeroDeReserva): string {
  return [texto(p.nombre), texto(p.apellido)].filter(Boolean).join(" ");
}

/** "PAX 1: Ana Gómez · Nacionalidad: Denmark · …", solo con lo que vino. Null si no hay ni el nombre. */
export function renglonDelPasajero(p: PasajeroDeReserva, i: number): string | null {
  const nombre = nombreDelPasajero(p);
  if (!nombre) return null;
  const datos = [
    `PAX ${i + 1}: ${[texto(p.tratamiento), nombre].filter(Boolean).join(" ")}`,
    texto(p.nacionalidad) && `Nacionalidad: ${texto(p.nacionalidad)}`,
    texto(p.fecha_nacimiento) && `Fecha de nacimiento: ${fechaDeNacimiento(texto(p.fecha_nacimiento)!)}`,
    // Siempre con lugar para el pasaporte, aunque llegue después (owner, 2026-10-20).
    `Pasaporte: ${texto(p.pasaporte) ?? "pendiente"}`,
    texto(p.telefono) && `Teléfono: ${texto(p.telefono)}`,
  ].filter(Boolean);
  return datos.join(" · ");
}
