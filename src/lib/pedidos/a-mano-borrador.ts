/**
 * El borrador con que arranca un pedido a mano (spec M3-09 fila 3), de la
 * misma plantilla que los armados (`data/plantillas/pedido-proveedor.md`).
 * Puro, pero importa `plantilla.ts` (que lee archivos): solo servidor y tests.
 */
import { fechasDelAsunto, nombreDelPasajero } from "./formato";
import { TEXTOS_DEL_PEDIDO, type Idioma } from "./idioma";
import { completar, completarAsunto } from "./plantilla";
import type { BorradorAMano, DatosParaAMano } from "./a-mano";
import type { Plantilla } from "./tipos";

/** El lugar del espacio en blanco: no puede aparecer en la plantilla (es un carácter de control). */
const ESPACIO = "\u0000";

/**
 * El borrador con que arranca un pedido a mano (fila 3): el asunto de la
 * plantilla con el pasajero principal y las fechas de la reserva si las hay
 * (M3-16; sin producto: el pedido no es de un producto del catálogo); el cuerpo de la plantilla con
 * un espacio en blanco donde van los servicios, la cantidad de pasajeros y el
 * cierre; la firma de siempre.
 */
export function borradorAMano(reserva: DatosParaAMano, plantilla: Plantilla, idioma: Idioma = "es"): BorradorAMano {
  const principal = reserva.pasajeros.map(nombreDelPasajero).find(Boolean) ?? "sin nombre";
  const pax = reserva.pax ?? (reserva.pasajeros.length || null);
  // Sin producto (o sin fechas), el separador que lo rodeaba no queda colgando.
  const asunto = completarAsunto(plantilla.asunto, {
    pasajero: principal,
    fechas: fechasDelAsunto([reserva.fechaInicio, reserva.fechaFin], idioma),
    // M3-28: sin cantidad, el asunto va sin "x N".
    pax: pax ? String(pax) : "",
    producto: "",
    referencia: reserva.numero?.trim() ? ` · Ref. ${reserva.numero.trim()}` : "",
  });
  const cuerpo = completar(plantilla.cuerpo, {
    servicios: ESPACIO,
    // M3-34: el pedido a mano no sabe qué se pide; el renglón del horario no sale.
    horario: "",
    // M3-32: con la plantilla pt (proveedor de Brasil), en portugués.
    pasajeros: `${TEXTOS_DEL_PEDIDO[idioma].pasajeros}: ${pax ?? "a confirmar"}`,
    pendientes: "",
  }).replace(ESPACIO, "");
  return { asunto, cuerpo, firma: plantilla.firma };
}
