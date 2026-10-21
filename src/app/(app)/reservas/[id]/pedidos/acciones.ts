"use server";

import type { EntradaAMano } from "@/lib/pedidos/a-mano";
import type { EdicionPedido } from "@/lib/pedidos/pantalla";
import {
  agregarPedidoAMano,
  buscarEnElDirectorio,
  guardarEdicionDePedido,
  pedirEnvioDePedidos,
  prepararPedidos,
  sacarPedidoAMano,
  type PedidoDeEnvio,
  type ResultadoAMano,
  type ResultadoBusqueda,
  type ResultadoSacar,
  type ResultadoEdicion,
  type ResultadoEnvio,
  type ResultadoPantalla,
} from "@/lib/pedidos/revision";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEXTOS } from "@/lib/textos";

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

/**
 * Confirmación del diálogo "Enviar N pedidos" (spec M3-03): manda por
 * operations@ (en modo prueba, solo a la casilla de prueba) con la sesión de
 * quien aprueba. El resultado viene por pedido.
 */
export async function enviarPedidos(entrada: PedidoDeEnvio): Promise<ResultadoEnvio> {
  try {
    return await pedirEnvioDePedidos(await createSupabaseServerClient(), entrada);
  } catch (e) {
    return { ok: false, error: motivo(e, "No se pudo hacer el envío. Mirá el estado de cada pedido antes de reintentar.") };
  }
}

/** M3-09: guarda un pedido escrito a mano (a un proveedor del directorio o a un mail). */
export async function agregarPedidoAManoDeLaReserva(entrada: EntradaAMano): Promise<ResultadoAMano> {
  try {
    return await agregarPedidoAMano(await createSupabaseServerClient(), entrada);
  } catch (e) {
    return { ok: false, error: TEXTOS.pedidos.aMano.noSeGuardo(motivo(e, "falló la conexión con la base. Probá de nuevo en un rato.")) };
  }
}

/** M3-09: saca un pedido a mano que todavía no se envió. */
export async function sacarPedidoAManoDeLaReserva(pedidoId: string): Promise<ResultadoSacar> {
  try {
    return await sacarPedidoAMano(await createSupabaseServerClient(), pedidoId);
  } catch (e) {
    return { ok: false, error: TEXTOS.pedidos.aMano.noSeSaco(motivo(e, "falló la conexión con la base.")) };
  }
}

/** M3-09: busca proveedores del directorio por nombre. */
export async function buscarProveedoresDelDirectorio(texto: string): Promise<ResultadoBusqueda> {
  try {
    return await buscarEnElDirectorio(await createSupabaseServerClient(), texto);
  } catch {
    return { ok: false, error: "No se pudo buscar en el directorio." };
  }
}
