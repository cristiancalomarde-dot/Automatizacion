/**
 * Cómo se escriben las cosas en el pedido (spec M3-01 fila 3): fechas cortas
 * en español ("3 oct 2026"), la habitación, el nivel del alojamiento y los
 * datos de los pasajeros. Puro, sin base.
 */
import { normalizarTexto } from "@/lib/catalogo/reglas";
import { TEXTOS_DEL_PEDIDO, traducir, type Idioma } from "./idioma";
import type { PasajeroDeReserva } from "./tipos";

/** M3-32: los meses en el idioma del pedido (castellano si no se dice). */
const meses = (idioma: Idioma) => TEXTOS_DEL_PEDIDO[idioma].meses;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-03" → "3 oct 2026" (M3-32, en portugués "3 out 2026"). Lo que no es una fecha se devuelve tal cual. */
export function fechaCorta(fecha: string, idioma: Idioma = "es"): string {
  const m = fecha.match(ISO);
  if (!m) return fecha;
  return `${Number(m[3])} ${meses(idioma)[Number(m[2]) - 1]} ${m[1]}`;
}

/** M3-26: "2027-02-20" → "20 feb" (el día del vuelo, al lado de la fecha del servicio). */
export function diaYMes(fecha: string, idioma: Idioma = "es"): string {
  const m = fecha.match(ISO);
  if (!m) return fecha;
  return `${Number(m[3])} ${meses(idioma)[Number(m[2]) - 1]}`;
}

/**
 * "del 24 al 28 ene 2027" / "del 30 ene al 2 feb 2027" / "del 30 dic 2026 al 2 ene 2027". M3-32: en
 * portugués, "de 30 jan a 2 fev 2027".
 */
export function rangoCorto(desde: string, hasta: string, idioma: Idioma = "es"): string {
  const { desde: del, hasta: al } = TEXTOS_DEL_PEDIDO[idioma].rango;
  const a = desde.match(ISO);
  const b = hasta.match(ISO);
  if (!a || !b) return `${del} ${fechaCorta(desde, idioma)} ${al} ${fechaCorta(hasta, idioma)}`;
  if (a[1] !== b[1]) return `${del} ${fechaCorta(desde, idioma)} ${al} ${fechaCorta(hasta, idioma)}`;
  if (a[2] !== b[2]) return `${del} ${Number(a[3])} ${meses(idioma)[Number(a[2]) - 1]} ${al} ${fechaCorta(hasta, idioma)}`;
  return `${del} ${Number(a[3])} ${al} ${fechaCorta(hasta, idioma)}`;
}

/**
 * Las fechas del asunto (M3-16): del primer al último día, en corto ("5 al 10 mar 2027");
 * un solo día, esa fecha; sin fechas, "". Lo que no es una fecha se ignora.
 */
export function fechasDelAsunto(fechas: ReadonlyArray<string | null | undefined>, idioma: Idioma = "es"): string {
  const dias = fechas.filter((f): f is string => !!f && ISO.test(f)).sort();
  if (dias.length === 0) return "";
  const [desde, hasta] = [dias[0], dias[dias.length - 1]];
  const del = TEXTOS_DEL_PEDIDO[idioma].rango.desde;
  return desde === hasta ? fechaCorta(desde, idioma) : rangoCorto(desde, hasta, idioma).slice(del.length + 1);
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

/** M3-19: el W Trek cuando no se puede saber cuál de las tres opciones es. */
export const TREK_A_CONFIRMAR = "a confirmar (Refugio Dorm a compartir / Tent DBL / Tent SGL)";

/**
 * El alojamiento en el W Trek (M3-19, owner 2026-10-23): Refugio Dorm a compartir, Tent DBL o Tent
 * SGL. Si la habitación menciona la carpa, manda esa parte ("Double Room - Hostel and W-Trek Tent"
 * → Tent DBL); la carpa sin decir de cuántos va por los pax (M3-21): 2 pax → Tent DBL. Doble sin
 * carpa ni refugio es carpa (la única opción privada del trek). Tent SGL solo si la reserva lo pide
 * para el trek (M3-21: es mucho más caro que el Refugio Dorm; un single que no menciona el trek queda
 * a confirmar). Si no se puede saber, "a confirmar" con las tres opciones.
 */
export function alojamientoDelTrek(habitacion: string | null, pax: number | null = null): string {
  if (!habitacion?.trim()) return TREK_A_CONFIRMAR;
  const h = normalizarTexto(habitacion);
  const doble = /\b(double|doble|dbl|matrimonial|twin)\b/.test(h);
  const single = /\b(single|sgl|individual|simple)\b/.test(h);
  if (/\b(tent|carpa)\b/.test(h)) return doble ? "Tent DBL" : single ? "Tent SGL" : pax === 2 ? "Tent DBL" : TREK_A_CONFIRMAR;
  if (/dorm|refugio|shared|compartid/.test(h)) return "Refugio Dorm a compartir";
  if (doble) return "Tent DBL";
  return TREK_A_CONFIRMAR;
}

/**
 * M3-21: el W Trek quedó a confirmar y es de 1 pax (por la reserva o porque la habitación es
 * single): el aviso dice que Tent SGL es mucho más caro que el Refugio Dorm.
 */
export function trekDeUnPax(habitacion: string | null, pax: number | null): boolean {
  return pax === 1 || /\b(single|sgl|individual|simple)\b/.test(normalizarTexto(habitacion ?? ""));
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

/**
 * El renglón de habitación del pedido de alojamiento (M3-18, owner 2026-10-23): la habitación
 * Standard y con desayuno, para que no haya upgrades que no pedimos ("Double Room - Hostel" →
 * "DBL Standard con desayuno"). M3-21: sin tipo, en un hotel va por los pax (2 → DBL, 1 → SGL; si
 * no, "Standard con desayuno (tipo a confirmar)") y en un hostel queda a confirmar (dorm / DBL /
 * SGL); "2 SGLs" → "2 SGL". Solo para el texto del pedido: para decidir se sigue usando
 * `tipoDeHabitacion`.
 */
export function habitacionDelPedido(habitacion: string | null, contexto: ContextoDeHabitacion = { pax: null, hostel: false }, idioma: Idioma = "es"): string {
  // M3-35: en los alojamientos que no ofrecen desayuno, ninguna variante lo dice. M3-32: en el idioma del pedido.
  const t = TEXTOS_DEL_PEDIDO[idioma];
  const con = contexto.desayuno === false ? "" : ` ${t.conDesayuno}`;
  const coma = contexto.desayuno === false ? "" : `, ${t.conDesayuno}`;
  const varias = variasHabitaciones(habitacion);
  if (varias) return `${varias} Standard${con}`;
  if (habitacionSinTipo(habitacion)) {
    if (contexto.hostel) return `a confirmar (dorm / DBL / SGL)${coma}`;
    if (contexto.pax === 2) return `DBL Standard${con}`;
    if (contexto.pax === 1) return `SGL Standard${con}`;
    return `Standard${con} (tipo a confirmar)`;
  }
  const tipo = tipoDeHabitacion(habitacion)!;
  return SIGLA[tipo] ? `${SIGLA[tipo]} Standard${con}` : `${traducir(t.tipos, tipo)}${coma}`;
}

/**
 * Para decidir la habitación sin tipo (M3-21): cuántos pax y si el alojamiento es un hostel.
 * M3-35: `desayuno: false` si el alojamiento no lo ofrece (sin decirlo, con desayuno).
 */
export interface ContextoDeHabitacion {
  pax: number | null;
  hostel: boolean;
  desayuno?: boolean;
}

/**
 * M3-35: la clave para reconocer un alojamiento por su nombre: sin mayúsculas ni acentos, sin las
 * palabras que cambian entre el catálogo y la lista ("Hostel", "Hostal", "Foz"), cada palabra en
 * singular y en cualquier orden ("Backpacker San Pedro Hostel" = "San Pedro Backpackers"). Vacía si
 * no queda nada (un "Hostel" suelto no es ningún alojamiento).
 */
function claveDelAlojamiento(nombre: string): string {
  return normalizarTexto(nombre)
    .split(/[^a-z0-9]+/)
    .filter((p) => p && !/^(hostel|hostal|foz)$/.test(p))
    .map((p) => (p.length > 3 ? p.replace(/s$/, "") : p))
    .sort()
    .join(" ");
}

/** M3-35: el alojamiento está en `data/alojamientos-sin-desayuno.csv` (con las variantes del nombre). */
export function sinDesayuno(alojamiento: string | null, lista: readonly { alojamiento: string }[] = []): boolean {
  const clave = claveDelAlojamiento(alojamiento ?? "");
  return !!clave && lista.some((f) => claveDelAlojamiento(f.alojamiento) === clave);
}

/** M3-21: la habitación no dice el tipo: vacía o solo el nivel ("Budget Hotel", "Hotel 3*", "Hostel"). */
export function habitacionSinTipo(habitacion: string | null): boolean {
  const tipo = tipoDeHabitacion(habitacion);
  if (!tipo) return true;
  const h = normalizarTexto(tipo).replace(/\s+/g, " ");
  return /^(budget( hotel)?|hotel( \d ?(\*|estrellas|stars?))?|\d ?(\*|estrellas|stars?)( hotel)?|hostel)$/.test(h);
}

const SIGLA: Record<string, string> = { doble: "DBL", twin: "TWIN", single: "SGL", triple: "TPL" };

/** "2 SGLs" / "2 single rooms" → "2 SGL" (M3-21: lo que la reserva dice explícito manda). */
function variasHabitaciones(habitacion: string | null): string | null {
  const base = normalizarTexto((habitacion ?? "").split(/\s+-\s+/)[0]);
  const m = base.match(/^(\d+)\s*x?\s*(single|sgl|double|doble|dbl|twin|triple|tpl)s?\b/);
  if (!m || Number(m[1]) < 2) return null;
  const sigla: Record<string, string> = { single: "SGL", sgl: "SGL", double: "DBL", doble: "DBL", dbl: "DBL", twin: "TWIN", triple: "TPL", tpl: "TPL" };
  return `${Number(m[1])} ${sigla[m[2]]}`;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function nombreDelPasajero(p: PasajeroDeReserva): string {
  return [texto(p.nombre), texto(p.apellido)].filter(Boolean).join(" ");
}

/** "PAX 1: Ana Gómez · Nacionalidad: Denmark · …", solo con lo que vino. Null si no hay ni el nombre. M3-32: en el idioma del pedido. */
export function renglonDelPasajero(p: PasajeroDeReserva, i: number, idioma: Idioma = "es"): string | null {
  const nombre = nombreDelPasajero(p);
  if (!nombre) return null;
  const t = TEXTOS_DEL_PEDIDO[idioma].pax;
  const datos = [
    `PAX ${i + 1}: ${[texto(p.tratamiento), nombre].filter(Boolean).join(" ")}`,
    texto(p.nacionalidad) && `${t.nacionalidad}: ${texto(p.nacionalidad)}`,
    texto(p.fecha_nacimiento) && `${t.nacimiento}: ${fechaDeNacimiento(texto(p.fecha_nacimiento)!)}`,
    // Siempre con lugar para el pasaporte, aunque llegue después (owner, 2026-10-20).
    `${t.pasaporte}: ${texto(p.pasaporte) ?? t.pendiente}`,
    texto(p.telefono) && `${t.telefono}: ${texto(p.telefono)}`,
  ].filter(Boolean);
  return datos.join(" · ");
}
