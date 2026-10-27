import "server-only";

/**
 * El bloque "Revisar antes de pedir" del detalle de una reserva (spec M3-24 fila 5): los avisos del
 * itinerario calculados con el mismo recorrido que el armado (`itinerarioDeLaReserva`), en el
 * servidor y con el cliente de la SESIÓN (RLS, #1). No arma ni guarda nada, no llama a la IA (#3) y
 * no manda nada (#4). Las reglas salen de `data/blackouts.csv`, `data/fechas-especiales.csv` y
 * `data/dias-bus.csv`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esIdDeReserva } from "@/lib/reservas/reglas";
import type { EstadoReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { itinerarioDeLaReserva } from "./armar";
import {
  cargarBusesElChalten,
  cargarCatalogoParaPedidos,
  cargarCategoriasTour,
  cargarDiasServicio,
  cargarPuntosDeEncuentro,
  cargarReglasItinerario,
  cargarReservaParaPedidos,
} from "./cargar";
import type { ReglasItinerario } from "./itinerario";
import { usuarioDelEquipo } from "./revision";

/** Los estados en que todavía se pide: después, el aviso ya no sirve. */
const ESTADOS_CON_AVISO: ReadonlySet<EstadoReserva> = new Set(["recibida", "para_revision", "pedido_a_proveedor"]);

export type ResultadoItinerario = { ok: true; avisos: string[] } | { ok: false; error: string; sinSesion?: true };

export async function avisosDelItinerarioDeLaReserva(
  cliente: SupabaseClient,
  reservaId: string,
  opciones: { itinerario?: ReglasItinerario } = {},
): Promise<ResultadoItinerario> {
  if (!(await usuarioDelEquipo(cliente))) return { ok: false, error: TEXTOS.pedidos.sinSesion, sinSesion: true };
  if (!esIdDeReserva(reservaId)) return { ok: false, error: "No existe la reserva." };
  const reserva = await cargarReservaParaPedidos(cliente, reservaId);
  if (!reserva) return { ok: false, error: "No existe la reserva." };
  if (!ESTADOS_CON_AVISO.has(reserva.estado) || !reserva.productoId) return { ok: true, avisos: [] };
  // Solo lo que mueve las fechas de los servicios (días, buses de El Chaltén, categorías del tour).
  const catalogo = await cargarCatalogoParaPedidos(
    cliente,
    reserva,
    cargarDiasServicio(),
    [],
    [],
    [],
    [],
    cargarCategoriasTour(),
    cargarPuntosDeEncuentro(),
    cargarBusesElChalten(),
    [],
  );
  return { ok: true, avisos: itinerarioDeLaReserva(reserva, { ...catalogo, itinerario: opciones.itinerario ?? cargarReglasItinerario() }) };
}
