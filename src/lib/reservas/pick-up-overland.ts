/**
 * M3-41 (owner, 2026-10-29, Journaway Petzold, SPAP05): el pick up del Overland San Pedro → Uyuni
 * (UYUO01) es el hotel de San Pedro de Atacama que reserva Journaway y nos confirma (suele ser Don
 * Raul u Our Habitas Atacama), NUNCA un hotel Tayka: esos son las noches del Overland. Journaway
 * manda "Pick up / Drop off: Tayka del Desierto Hotel" en el renglón del Overland; eso se guarda tal
 * cual en la reserva, pero no se usa como pick up. Nunca se inventa: si la reserva no trae el hotel
 * de San Pedro, queda a confirmar.
 */

const TAYKA = /\btayka\b/i;

/** El texto nombra un hotel del Overland (Tayka del Desierto, Tayka del Sal / de Sal): no es un pick up. */
export function esHotelDelOverland(texto: string | null | undefined): boolean {
  return !!texto && TAYKA.test(texto);
}

/** "hotel en San Pedro de Atacama a confirmar (lo informa Journaway)". */
export function hotelEnSanPedroAConfirmar(agencia: string | null | undefined): string {
  return `hotel en San Pedro de Atacama a confirmar (lo informa ${agencia?.trim() || "la agencia"})`;
}

/** Un pick up de otra parte de la reserva (una excursión o traslado en San Pedro) con su fecha. */
export interface PickUpConFecha {
  pickUp: string | null | undefined;
  fecha: string | null | undefined;
}

/** Un hotel que reserva la agencia, con sus noches. */
export interface HotelConNoches {
  nombre: string;
  desde: string | null | undefined;
  hasta: string | null | undefined;
}

/**
 * El hotel de San Pedro de donde sale el Overland que arranca `inicio`: el pick up que manda la
 * agencia para lo de San Pedro (el último hasta ese día) o, si no, el hotel de la agencia que deja
 * ese día (la noche anterior al Overland). null si la reserva no lo trae.
 */
export function hotelEnSanPedro(
  inicio: string | null | undefined,
  pickUps: readonly PickUpConFecha[],
  hoteles: readonly HotelConNoches[] = [],
): string | null {
  const validos = pickUps
    .filter((p) => !!p.pickUp?.trim() && !esHotelDelOverland(p.pickUp) && (!inicio || !p.fecha || p.fecha <= inicio))
    .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
  const ultimo = validos[validos.length - 1];
  if (ultimo) return ultimo.pickUp!.trim();
  const noche = inicio ? hoteles.find((h) => h.hasta === inicio && !esHotelDelOverland(h.nombre)) : undefined;
  return noche?.nombre ?? null;
}

/** Lo mínimo de una parte del detalle para corregir el pick up del Overland. */
interface ParteConPickUp {
  producto: { nombre: string } | null;
  descripcion: string | null;
  fechaInicio: string | null;
  pickUp?: string | null;
}

const OVERLAND = /\boverland\b/i;

/**
 * Las partes como se muestran en el detalle (M3-41 #3): el Overland que duerme en los Tayka no
 * muestra el Tayka como pick up sino el hotel de San Pedro (o "a confirmar"). Solo para mostrar:
 * en la base queda lo que mandó la agencia.
 */
export function partesConElPickUpDelOverland<T extends ParteConPickUp>(
  partes: readonly T[],
  hoteles: readonly HotelConNoches[] = [],
  agencia: string | null = null,
): T[] {
  const nombre = (p: ParteConPickUp) => p.producto?.nombre ?? p.descripcion ?? "";
  return partes.map((p) => {
    if (!OVERLAND.test(nombre(p)) || !(esHotelDelOverland(p.pickUp) || esHotelDelOverland(nombre(p)))) return p;
    const otras = partes.filter((x) => x !== p).map((x) => ({ pickUp: x.pickUp, fecha: x.fechaInicio }));
    return { ...p, pickUp: hotelEnSanPedro(p.fechaInicio, otras, hoteles) ?? hotelEnSanPedroAConfirmar(agencia) };
  });
}
