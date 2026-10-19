"use server";

import type { EdicionPedido } from "@/lib/pedidos/pantalla";
import {
  guardarEdicionDePedido,
  pedirEnvioDePedidos,
  prepararPedidos,
  type PedidoDeEnvio,
  type ResultadoEdicion,
  type ResultadoPantalla,
} from "@/lib/pedidos/revision";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Las acciones de la pantalla de pedidos (spec M3-02), con la sesión del
 * usuario (RLS, #1). Cada una vuelve a exigir una sesión del equipo. La
 * lógica vive en `src/lib/pedidos/`; acá solo se arma el cliente y se
 * traduce un error inesperado a un mensaje en llano.
 */

function motivo(e: unknown, porDefecto: string): string {
  const m = e instanceof Error ? e.message : "";
  // Los errores de lib/pedidos ya vienen en castellano ("No se pudo leer la reserva: …"): se deja la primera parte.
  return /^No se pud/.test(m) ? `${m.split(":")[0]}.` : porDefecto;
}

/** Arma y guarda los borradores (sin pisar los editados, salvo "Rearmar todo"). */
export async function armarPedidosDeLaReserva(reservaId: string, opciones: { reemplazarEditados?: boolean } = {}): Promise<ResultadoPantalla> {
  try {
    return await prepararPedidos(await createSupabaseServerClient(), reservaId, { reemplazarEditados: opciones.reemplazarEditados === true });
  } catch (e) {
    return { ok: false, error: motivo(e, "Falló la conexión con la base. Probá de nuevo en un rato.") };
  }
}

/** Guarda el asunto y el texto editados de un borrador. */
export async function guardarBorradorDePedido(entrada: EdicionPedido): Promise<ResultadoEdicion> {
  try {
    return await guardarEdicionDePedido(await createSupabaseServerClient(), entrada);
  } catch (e) {
    return { ok: false, error: motivo(e, "No se pudo guardar el pedido.") };
  }
}

/** Confirmación del diálogo "Enviar N pedidos". Todavía no manda nada: lo conecta M3-03. */
export async function enviarPedidos(entrada: PedidoDeEnvio): Promise<{ ok: false; error: string }> {
  try {
    return await pedirEnvioDePedidos(await createSupabaseServerClient(), entrada);
  } catch {
    return { ok: false, error: "No se pudo pedir el envío." };
  }
}
