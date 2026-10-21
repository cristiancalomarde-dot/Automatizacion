/**
 * El borrador con que arranca un pedido a mano (spec M3-09 fila 3), de la
 * misma plantilla que los armados (`data/plantillas/pedido-proveedor.md`).
 * Puro, pero importa `plantilla.ts` (que lee archivos): solo servidor y tests.
 */
import { nombreDelPasajero } from "./formato";
import { completar } from "./plantilla";
import type { BorradorAMano, DatosParaAMano } from "./a-mano";
import type { Plantilla } from "./tipos";

/** El lugar del espacio en blanco: no puede aparecer en la plantilla (es un carácter de control). */
const ESPACIO = "\u0000";

/**
 * El borrador con que arranca un pedido a mano (fila 3): el asunto de la
 * plantilla con el pasajero principal, el pax y la referencia (sin producto:
 * el pedido no es de un producto del catálogo); el cuerpo de la plantilla con
 * un espacio en blanco donde van los servicios, la cantidad de pasajeros y el
 * cierre; la firma de siempre.
 */
export function borradorAMano(reserva: DatosParaAMano, plantilla: Plantilla): BorradorAMano {
  const principal = reserva.pasajeros.map(nombreDelPasajero).find(Boolean) ?? "sin nombre";
  const pax = reserva.pax ?? (reserva.pasajeros.length || null);
  const asunto = completar(plantilla.asunto, {
    pasajero: principal,
    pax: String(pax ?? "?"),
    producto: "",
    referencia: reserva.numero?.trim() ? ` · Ref. ${reserva.numero.trim()}` : "",
  })
    // Sin producto, el separador que lo rodeaba sobra.
    .split(/\s*·\s*/)
    .filter(Boolean)
    .join(" · ");
  const cuerpo = completar(plantilla.cuerpo, {
    servicios: ESPACIO,
    pasajeros: `Pasajeros: ${pax ?? "a confirmar"}`,
    pendientes: "",
  }).replace(ESPACIO, "");
  return { asunto, cuerpo, firma: plantilla.firma };
}
