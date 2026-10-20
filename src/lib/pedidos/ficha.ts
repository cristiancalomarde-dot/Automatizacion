/**
 * La ficha completa por pasajero (owner, 2026-10-19): los proveedores de
 * `data/proveedores-ficha-completa.csv` (hoy Horizonte Atacama) reciben de cada
 * pasajero nombre, pasaporte, teléfono, hotel, edad, nacionalidad, restricción
 * alimentaria e idioma, y las excursiones como "FECHAS Y TOURS". Cada dato sale
 * de la reserva; lo que falta va PENDIENTE, nunca se inventa (#1: estos datos
 * solo van en el pedido a ese proveedor, no se loguean). Puro, sin base.
 */
import { normalizarTexto } from "@/lib/catalogo/reglas";
import type { PasajeroDeReserva, ProveedorFichaCompleta } from "./tipos";

const clave = (nombre: string) => normalizarTexto(nombre).replace(/\s+/g, " ");

/** Si el proveedor está en la lista (por nombre, sin mayúsculas, acentos ni espacios de más). */
export function llevaFichaCompleta(lista: readonly ProveedorFichaCompleta[], proveedor: { nombre: string }): boolean {
  const suyo = clave(proveedor.nombre);
  return !!suyo && lista.some((f) => clave(f.proveedor) === suyo);
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const PENDIENTE = "PENDIENTE";

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** "2027-03-17" → "17.03.2027"; lo que no es una fecha, tal cual. */
export function fechaConPuntos(fecha: string): string {
  const m = fecha.match(ISO);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : fecha;
}

/** Los años cumplidos a esa fecha; null si alguna de las dos no es una fecha (un dato enmascarado). */
export function edadA(nacimiento: string | null | undefined, fecha: string | null): number | null {
  const n = texto(nacimiento)?.match(ISO);
  const f = fecha?.match(ISO);
  if (!n || !f) return null;
  let edad = Number(f[1]) - Number(n[1]);
  if (`${f[2]}${f[3]}` < `${n[2]}${n[3]}`) edad -= 1;
  return edad >= 0 ? edad : null;
}

/** Lo que dice de comida, dieta o alergias (vegetariano, vegano, celíaco, gluten, alergia, …). */
const COMIDA =
  /\b(vegetarian|vegan|veggie|cel[ií]ac|coeliac|gluten|alerg|allerg|intoleran|lactos|dairy|kosher|halal|pesc[ae]tarian|diet|food|comida|aliment|nuts?\b|man[ií](?![a-z])|mariscos|seafood|shellfish)/i;

/**
 * La restricción alimentaria que trae la reserva: las frases de los pedidos especiales y de las
 * notas que hablan de comida, dieta o alergias, tal como vinieron. Null si no dice nada.
 */
export function restriccionAlimentaria(textos: ReadonlyArray<string | null | undefined>): string | null {
  const frases = textos
    .flatMap((t) => (t ?? "").split(/[\n.;!?]+/))
    .map((f) => f.trim().replace(/[\s,:-]+$/, ""))
    .filter((f) => f && COMIDA.test(f));
  return frases.length ? [...new Set(frases)].join("; ") : null;
}

/** Lo que es igual para todos los pasajeros del pedido. */
export interface DatosDelPedido {
  /** Dónde se alojan (o "A CONFIRMAR"). */
  hotel: string;
  /** La fecha del primer tour del pedido, para la edad. */
  fecha: string | null;
  /** En mayúsculas ("INGLÉS"). */
  idioma: string;
  restriccion: string | null;
  /** El teléfono de contacto de la reserva, para el pasajero que no trae uno. */
  telefonoDeContacto: string | null;
}

/** El bloque de un pasajero; sin pasajero, el de uno que todavía no vino (todo PENDIENTE). */
export function fichaDelPasajero(p: PasajeroDeReserva | null, d: DatosDelPedido): string {
  const nombre = p ? [texto(p.nombre), texto(p.apellido)].filter(Boolean).join(" ") : "";
  const edad = p ? edadA(p.fecha_nacimiento, d.fecha) : null;
  return [
    `NOMBRE COMPLETO: ${nombre || PENDIENTE}`,
    `PASAPORTE: ${texto(p?.pasaporte) ?? PENDIENTE}`,
    `TELÉFONO: ${texto(p?.telefono) ?? d.telefonoDeContacto ?? PENDIENTE}`,
    `HOTEL: ${d.hotel}`,
    `EDAD: ${edad ?? PENDIENTE}`,
    `NACIONALIDAD: ${texto(p?.nacionalidad) ?? PENDIENTE}`,
    `RESTRICCIÓN ALIMENTARIA: ${d.restriccion ?? "NO INFORMADAS"}`,
    `IDIOMA: ${d.idioma}`,
  ].join("\n");
}

/**
 * Un bloque por pasajero con nombre y, si la agencia dice más pasajeros (pax) que nombres,
 * bloques PENDIENTE hasta completar la cantidad.
 */
export function fichasDePasajeros(pasajeros: readonly PasajeroDeReserva[], pax: number | null, d: DatosDelPedido): string {
  const conNombre = pasajeros.filter((p) => texto(p.nombre) || texto(p.apellido));
  const faltan = Math.max(0, (pax ?? 0) - conNombre.length);
  return [...conNombre.map((p) => fichaDelPasajero(p, d)), ...Array.from({ length: faltan }, () => fichaDelPasajero(null, d))].join("\n\n");
}

/** Una excursión como la lista Horizonte: "Tatio Geysers - 19.03.2027 - CON ENTRADAS". */
export interface TourDeFicha {
  nombre: string;
  fecha: string | null;
  /** De varios días: la última fecha. */
  hasta: string | null;
  privado: boolean;
  entradas: boolean;
  idioma: string;
  /** Dónde lo buscan (el hotel o el pick up de la agencia); null si no se sabe. */
  lugar: string | null;
}

export const HOTEL_A_CONFIRMAR = "A CONFIRMAR";

/** "Tatio Geysers - 19.03.2027 - CON ENTRADAS", con el pick up al final si los tours no salen todos del mismo lugar. */
export function lineaDeTour(t: TourDeFicha, conPickUp: boolean): string {
  const cuando = t.fecha ? (t.hasta && t.hasta !== t.fecha ? `${fechaConPuntos(t.fecha)} al ${fechaConPuntos(t.hasta)}` : fechaConPuntos(t.fecha)) : "a coordinar";
  return [
    `${t.nombre}${t.privado ? " (privado)" : ""} - ${cuando}`,
    t.entradas ? " - CON ENTRADAS" : "",
    conPickUp ? ` (pick up: ${t.lugar ?? "a confirmar"})` : "",
  ].join("");
}
