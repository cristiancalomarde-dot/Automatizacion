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
import { esCancelacion, esIdDeReserva } from "@/lib/reservas/reglas";
import type { EstadoReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { validarPedidoAMano, type BorradorAMano, type EntradaAMano } from "./a-mano";
import { borradorAMano } from "./a-mano-borrador";
import { armarPedidos, porQueNoSeArma } from "./armar";
import {
  cargarCatalogoParaPedidos,
  cargarCategoriasTour,
  cargarDiasServicio,
  cargarExcursionesConEntrada,
  cargarHostelSegunHabitacion,
  cargarOpcionesPasajero,
  cargarProveedoresFichaCompleta,
  cargarReservaParaPedidos,
} from "./cargar";
import { cargarPedidos, guardarPedidosArmados, type PedidoGuardado, type TareaGuardada } from "./guardar";
import { avisosDeLaPantalla, loQuePidioLaAgencia, validarEdicion, type EdicionPedido, type LoQuePidio } from "./pantalla";
import { cargarPlantilla } from "./plantilla";
import type { CategoriaTour } from "@/lib/importador-tours/datos";
import type { DiaDeServicio, ExcursionConEntrada, HostelSegunHabitacion, OpcionDelPasajero, ProveedorFichaCompleta, Plantilla } from "./tipos";
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
  /** M3-09: el estado de la reserva (los pedidos a mano se agregan en recibida o pedido a proveedor). */
  estadoReserva?: EstadoReserva;
  pedidos: PedidoGuardado[];
  tareas: TareaGuardada[];
  avisos: string[];
  /** Owner 2026-10-20: lo que pidió la agencia y las notas de la reserva, para revisar antes de enviar (null si nada). */
  pidio?: LoQuePidio | null;
  /** M3-09: el borrador con que arranca un pedido a mano; null si en esta reserva no se agregan (cancelada). */
  aMano?: BorradorAMano | null;
}

export type ResultadoPantalla = ({ ok: true } & PantallaPedidos) | Rechazo;

export interface OpcionesPreparar {
  /** "Rearmar todo": los editados también se reemplazan (la persona lo confirmó). */
  reemplazarEditados?: boolean;
  plantilla?: Plantilla;
  dias?: readonly DiaDeServicio[];
  entradas?: readonly ExcursionConEntrada[];
  fichaCompleta?: readonly ProveedorFichaCompleta[];
  hostelSegunHabitacion?: readonly HostelSegunHabitacion[];
  /** M3-13: las opciones del pasajero (por defecto, las de data/opciones-pasajero.csv). */
  opcionesPasajero?: readonly OpcionDelPasajero[];
  /** M3-14: las categorías tour ↔ paquete (por defecto, las de data/categorias-tour.csv). */
  categoriasTour?: readonly CategoriaTour[];
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
  const catalogo = await cargarCatalogoParaPedidos(
    cliente,
    reserva,
    dias,
    opciones.entradas ?? cargarExcursionesConEntrada(),
    opciones.fichaCompleta ?? cargarProveedoresFichaCompleta(),
    opciones.hostelSegunHabitacion ?? cargarHostelSegunHabitacion(),
    opciones.opcionesPasajero ?? cargarOpcionesPasajero(),
    opciones.categoriasTour ?? cargarCategoriasTour(),
  );
  const armado = armarPedidos(reserva, catalogo, plantilla);
  if (!armado.ok) return armado;

  if (opciones.reemplazarEditados) {
    // Se desmarcan recién con el armado nuevo en la mano: si algo falla antes, los editados quedan como estaban.
    const { error } = await cliente
      .from("reserva_pedido")
      .update({ editado: false, editado_por: null, editado_en: null })
      .eq("reserva_id", reservaId)
      .eq("estado", "borrador")
      .eq("editado", true)
      // M3-09: un pedido a mano no lo reemplaza ningún armado.
      .eq("a_mano", false);
    if (error) throw new Error(`No se pudieron reemplazar los pedidos editados: ${error.message}`);
  }
  await guardarPedidosArmados(cliente, reservaId, armado);
  const [guardados, seAgregan] = await Promise.all([cargarPedidos(cliente, reservaId), seAgreganAMano(cliente, reservaId, reserva.estado)]);

  return {
    ok: true,
    reserva: { id: reserva.id, numero: reserva.numero, agencia: reserva.agencia },
    estadoReserva: reserva.estado,
    pedidos: guardados.pedidos,
    tareas: guardados.tareas,
    avisos: avisosDeLaPantalla(reserva, armado),
    pidio: loQuePidioLaAgencia(reserva),
    aMano: seAgregan ? borradorAMano(reserva, plantilla) : null,
  };
}

// --- Pedidos a mano (spec M3-09) -----------------------------------------------------------------

const A = TEXTOS.pedidos.aMano;

/**
 * Fila 1: se agregan pedidos a mano en una reserva recibida o pedida a
 * proveedor, que no sea una cancelación (por sus motivos o por un mail de
 * cancelación que se le sumó). La base vuelve a chequear el estado.
 */
async function seAgreganAMano(cliente: SupabaseClient, reservaId: string, estado: EstadoReserva): Promise<boolean> {
  if (estado !== "recibida" && estado !== "pedido_a_proveedor") return false;
  const [motivos, cancelada] = await Promise.all([
    cliente.from("reserva").select("motivos_revision").eq("id", reservaId).maybeSingle(),
    cliente
      .from("evento_reserva")
      .select("id", { count: "exact", head: true })
      .eq("reserva_id", reservaId)
      .eq("tipo", "mail_agregado")
      .contains("detalle", { cancelacion: true }),
  ]);
  if (motivos.error) throw new Error(`No se pudo leer la reserva: ${motivos.error.message}`);
  if (cancelada.error) throw new Error(`No se pudo leer el historial de la reserva: ${cancelada.error.message}`);
  const lista = Array.isArray(motivos.data?.motivos_revision) ? (motivos.data.motivos_revision as string[]) : [];
  return (cancelada.count ?? 0) === 0 && !esCancelacion(lista);
}

export type ResultadoAMano = { ok: true; pedido: PedidoGuardado } | Rechazo;

function motivoAMano(code: string | undefined, mensaje: string): Rechazo {
  switch (code) {
    case "HT401":
      return SIN_SESION;
    case "HT403":
      return { ok: false, error: A.noSeGuardo("tu cuenta no está dada de alta en el equipo.") };
    case "HT404":
      return { ok: false, error: A.proveedorInvalido };
    case "HT423":
      return { ok: false, error: A.noSeAgrega };
    case "22023":
      return { ok: false, error: A.mailInvalido };
    default:
      return { ok: false, error: A.noSeGuardo(mensaje) };
  }
}

/**
 * Fila 4: guarda un pedido escrito a mano como un pedido más de la reserva
 * ("A mano", casilla propia). El texto inicial y la firma salen de la
 * plantilla (en el servidor); el nombre del proveedor lo pone la base.
 */
export async function agregarPedidoAMano(cliente: SupabaseClient, entrada: EntradaAMano, opciones: { plantilla?: Plantilla } = {}): Promise<ResultadoAMano> {
  if (!(await usuarioDelEquipo(cliente))) return SIN_SESION;
  if (!entrada || typeof entrada.reservaId !== "string" || !esIdDeReserva(entrada.reservaId)) return { ok: false, error: "No existe la reserva." };

  const reserva = await cargarReservaParaPedidos(cliente, entrada.reservaId);
  if (!reserva) return { ok: false, error: "No existe la reserva." };
  if (!(await seAgreganAMano(cliente, reserva.id, reserva.estado))) return { ok: false, error: A.noSeAgrega };

  const plantilla = opciones.plantilla ?? cargarPlantilla();
  const v = validarPedidoAMano(entrada, borradorAMano(reserva, plantilla));
  if (!v.ok) return v;

  const { data, error } = await cliente.rpc("agregar_pedido_a_mano", {
    p_reserva: v.pedido.reservaId,
    p_proveedor: v.pedido.proveedorId,
    p_destinatarios: v.pedido.mails,
    p_asunto: v.pedido.asunto,
    p_cuerpo: v.pedido.cuerpo,
    p_firma: plantilla.firma,
  });
  if (error) return motivoAMano(error.code, error.message);
  return { ok: true, pedido: data as PedidoGuardado };
}

export type ResultadoSacar = { ok: true; pedidoId: string } | Rechazo;

/** Fila 8: saca un pedido a mano que no se envió (la base rechaza uno enviado o enviándose). */
export async function sacarPedidoAMano(cliente: SupabaseClient, pedidoId: string): Promise<ResultadoSacar> {
  if (!(await usuarioDelEquipo(cliente))) return SIN_SESION;
  if (typeof pedidoId !== "string" || !esIdDeReserva(pedidoId)) return { ok: false, error: "El pedido no es válido." };
  const { error } = await cliente.rpc("sacar_pedido_a_mano", { p_pedido: pedidoId });
  if (!error) return { ok: true, pedidoId };
  if (error.code === "HT401") return SIN_SESION;
  if (error.code === "HT409") return { ok: false, error: A.noSeSaca };
  if (error.code === "HT404") return { ok: false, error: A.noSeSaco("ese pedido ya no está.") };
  return { ok: false, error: A.noSeSaco(error.message) };
}

export interface ProveedorEncontrado {
  id: string;
  nombre: string;
  ciudad: string | null;
  mails: string[];
}

export type ResultadoBusqueda = { ok: true; proveedores: ProveedorEncontrado[] } | Rechazo;

const MAX_RESULTADOS = 8;

/** Fila 2: los proveedores del directorio cuyo nombre contiene lo escrito (desde 2 letras). */
export async function buscarEnElDirectorio(cliente: SupabaseClient, texto: string): Promise<ResultadoBusqueda> {
  if (!(await usuarioDelEquipo(cliente))) return SIN_SESION;
  const q = typeof texto === "string" ? texto.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  if (q.length < 2) return { ok: true, proveedores: [] };
  // Los comodines de LIKE que escriba la persona se buscan como texto.
  const patron = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await cliente.from("proveedor").select("id,nombre,ciudad,mails").ilike("nombre", patron).order("nombre").limit(MAX_RESULTADOS);
  if (error) return { ok: false, error: `No se pudo buscar en el directorio: ${error.message}` };
  return {
    ok: true,
    proveedores: ((data ?? []) as Array<{ id: string; nombre: string; ciudad: string | null; mails: string[] | null }>).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      ciudad: p.ciudad ?? null,
      mails: (p.mails ?? []).filter((m) => typeof m === "string" && !!m.trim()),
    })),
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
