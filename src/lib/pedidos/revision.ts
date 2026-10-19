import "server-only";

/**
 * Lo que hacen las acciones de la pantalla de pedidos (spec M3-02), en el
 * servidor y con el cliente de la SESIÓN (RLS, #1): armar y guardar los
 * borradores (sin pisar los editados), guardar una edición y pedir el envío.
 *
 * Cada una exige primero una sesión del equipo (@hitravel.com.ar): sin ella no
 * lee ni escribe nada (fila 9). El armado lo hace `armarPedidos` (M3-01); acá
 * no hay lógica de armado. El envío (M3-03) vive en `envio/enviar.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esCorreoDelDominioPermitido, obtenerDominioPermitido } from "@/lib/auth/dominio";
import { esIdDeReserva } from "@/lib/reservas/reglas";
import { TEXTOS } from "@/lib/textos";
import { armarPedidos, porQueNoSeArma } from "./armar";
import { cargarCatalogoParaPedidos, cargarDiasServicio, cargarReservaParaPedidos } from "./cargar";
import { cargarPedidos, guardarPedidosArmados, type PedidoGuardado, type TareaGuardada } from "./guardar";
import { avisosDeLaPantalla, validarEdicion, type EdicionPedido } from "./pantalla";
import { cargarPlantilla } from "./plantilla";
import type { DiaDeServicio, Plantilla } from "./tipos";
import { enviarPedidosAprobados, type DependenciasEnvio, type PedidoDeEnvio, type ResultadoEnvio } from "./envio/enviar";

type Rechazo = { ok: false; error: string; sinSesion?: true };

const SIN_SESION: Rechazo = { ok: false, error: TEXTOS.pedidos.sinSesion, sinSesion: true };

/** El usuario de la sesión si es del equipo; null si no hay sesión o es de otro dominio. */
export async function usuarioDelEquipo(cliente: SupabaseClient): Promise<{ id: string; email: string } | null> {
  const { data } = await cliente.auth.getUser();
  const u = data?.user;
  if (!u?.email) return null;
  let dominio: string;
  try {
    dominio = obtenerDominioPermitido();
  } catch {
    return null;
  }
  return esCorreoDelDominioPermitido(u.email, dominio) ? { id: u.id, email: u.email } : null;
}

export interface PantallaPedidos {
  reserva: { id: string; numero: string | null; agencia: string };
  pedidos: PedidoGuardado[];
  tareas: TareaGuardada[];
  avisos: string[];
}

export type ResultadoPantalla = ({ ok: true } & PantallaPedidos) | Rechazo;

export interface OpcionesPreparar {
  /** "Rearmar todo": los editados también se reemplazan (la persona lo confirmó). */
  reemplazarEditados?: boolean;
  plantilla?: Plantilla;
  dias?: readonly DiaDeServicio[];
}

/**
 * Arma los pedidos de la reserva, los guarda (los editados se conservan, salvo
 * que se pida reemplazarlos) y devuelve lo guardado con las tareas y los
 * avisos. Una reserva que no está recibida no guarda nada.
 */
export async function prepararPedidos(cliente: SupabaseClient, reservaId: string, opciones: OpcionesPreparar = {}): Promise<ResultadoPantalla> {
  if (!(await usuarioDelEquipo(cliente))) return SIN_SESION;
  if (!esIdDeReserva(reservaId)) return { ok: false, error: "No existe la reserva." };

  const reserva = await cargarReservaParaPedidos(cliente, reservaId);
  if (!reserva) return { ok: false, error: "No existe la reserva." };
  const noSeArma = porQueNoSeArma(reserva.estado);
  if (noSeArma) return { ok: false, error: noSeArma };

  const plantilla = opciones.plantilla ?? cargarPlantilla();
  const dias = opciones.dias ?? cargarDiasServicio();
  const catalogo = await cargarCatalogoParaPedidos(cliente, reserva, dias);
  const armado = armarPedidos(reserva, catalogo, plantilla);
  if (!armado.ok) return armado;

  if (opciones.reemplazarEditados) {
    // Se desmarcan recién con el armado nuevo en la mano: si algo falla antes, los editados quedan como estaban.
    const { error } = await cliente
      .from("reserva_pedido")
      .update({ editado: false, editado_por: null, editado_en: null })
      .eq("reserva_id", reservaId)
      .eq("estado", "borrador")
      .eq("editado", true);
    if (error) throw new Error(`No se pudieron reemplazar los pedidos editados: ${error.message}`);
  }
  await guardarPedidosArmados(cliente, reservaId, armado);
  const guardados = await cargarPedidos(cliente, reservaId);

  return {
    ok: true,
    reserva: { id: reserva.id, numero: reserva.numero, agencia: reserva.agencia },
    pedidos: guardados.pedidos,
    tareas: guardados.tareas,
    avisos: avisosDeLaPantalla(reserva, armado),
  };
}

export type ResultadoEdicion = { ok: true; pedido: PedidoGuardado } | Rechazo;

/** Guarda el asunto y el texto editados: queda como borrador editado y el rearmado no lo pisa (fila 2). */
export async function guardarEdicionDePedido(cliente: SupabaseClient, entrada: EdicionPedido): Promise<ResultadoEdicion> {
  const usuario = await usuarioDelEquipo(cliente);
  if (!usuario) return SIN_SESION;
  const v = validarEdicion(entrada);
  if (!v.ok) return v;
  const { data, error } = await cliente
    .from("reserva_pedido")
    .update({ asunto: v.edicion.asunto, cuerpo: v.edicion.cuerpo, editado: true, editado_por: usuario.id, editado_en: new Date().toISOString() })
    .eq("id", v.edicion.pedidoId)
    .eq("estado", "borrador")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: `No se pudo guardar el pedido: ${error.message}` };
  if (!data) return { ok: false, error: "Ese pedido ya no está como borrador. Volvé a armar los pedidos." };
  return { ok: true, pedido: data as PedidoGuardado };
}

export type { EnvioHecho, PedidoDeEnvio, ResultadoEnvio, ResultadoPedido } from "./envio/enviar";

/**
 * Confirmación del diálogo "Enviar N pedidos" (M3-03): manda los pedidos por
 * operations@ (en modo prueba, solo a la casilla de prueba). Toda la lógica
 * está en `envio/enviar.ts`.
 */
export async function pedirEnvioDePedidos(cliente: SupabaseClient, entrada: PedidoDeEnvio, deps?: DependenciasEnvio): Promise<ResultadoEnvio> {
  return enviarPedidosAprobados(cliente, entrada, deps);
}
