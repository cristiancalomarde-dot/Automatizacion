/**
 * Guardar los borradores de pedido y las tareas de una reserva (spec M3-01
 * fila 11, migración 0018). El armado es puro (`armarPedidos`); esto lo lee de
 * la base, lo arma y lo guarda con `guardar_pedidos_armados`, que en una sola
 * transacción reemplaza los borradores que nadie editó, conserva los editados
 * y reemplaza las tareas. No manda nada (#4): solo deja borradores.
 *
 * Recibe el cliente que corresponda: la sesión de una persona del equipo
 * (M3-02, con RLS) o la service role (scripts de prueba).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { armarPedidos, porQueNoSeArma } from "./armar";
import {
  cargarCatalogoParaPedidos,
  cargarCategoriasTour,
  cargarDiasServicio,
  cargarExcursionesConEntrada,
  cargarHostelSegunHabitacion,
  cargarOpcionesPasajero,
  cargarProveedoresFichaCompleta,
  cargarAlojamientoSePideA,
  cargarBusesElChalten,
  cargarPuntosDeEncuentro,
  cargarReservaParaPedidos,
} from "./cargar";
import { cargarPlantilla } from "./plantilla";
import type { CategoriaTour } from "@/lib/importador-tours/datos";
import type { AlojamientoSePideA, BusElChalten, DiaDeServicio, ExcursionConEntrada, HostelSegunHabitacion, OpcionDelPasajero, ProveedorFichaCompleta, PuntoDeEncuentro, PedidoArmado, Plantilla, ResultadoArmado, TareaArmada, TipoTarea } from "./tipos";

export interface ConteoGuardado {
  insertados: number;
  conservados: number;
  reemplazados: number;
  tareas: number;
}

export type ResultadoGuardado = (Extract<ResultadoArmado, { ok: true }> & { guardado: ConteoGuardado }) | Extract<ResultadoArmado, { ok: false }>;

/** Una fila de `reserva_pedido` como la devuelve la base. */
export interface PedidoGuardado {
  id: string;
  reserva_id: string;
  casilla: string;
  destinatarios: string[];
  proveedor_ids: string[];
  proveedores: string[];
  partes: unknown[];
  asunto: string;
  cuerpo: string;
  firma: string;
  sin_destinatario: string | null;
  avisos: string[];
  estado: string;
  editado: boolean;
  de_prueba: boolean;
  created_at: string;
  updated_at: string;
  /** M3-03 (0019): los datos del envío. Opcionales para las filas armadas a mano en los tests. */
  enviando_desde?: string | null;
  enviado_en?: string | null;
  enviado_por?: string | null;
  enviado_por_nombre?: string | null;
  message_id?: string | null;
  motivo_fallo?: string | null;
  reenvios?: number;
  copia_en_enviados?: boolean | null;
  envio_prueba_en?: string | null;
  envio_prueba_por_nombre?: string | null;
  /** M3-09 (0023): lo escribió una persona del equipo (casilla "a-mano:<uuid>"). */
  a_mano?: boolean;
}

export interface TareaGuardada {
  id: string;
  reserva_id: string;
  tipo: TipoTarea;
  texto: string;
  detalle: Record<string, unknown>;
  orden: number;
  de_prueba: boolean;
}

function aFilaPedido(p: PedidoArmado) {
  return {
    casilla: p.casilla,
    destinatarios: p.destinatarios,
    proveedor_ids: p.proveedores.map((x) => x.id),
    proveedores: p.proveedores.map((x) => x.nombre),
    partes: p.partes.map((x) => ({ parte_id: x.parteId, producto_servicio_id: x.productoServicioId, producto: x.producto, fecha: x.fecha })),
    asunto: p.asunto,
    cuerpo: p.cuerpo,
    firma: p.firma,
    sin_destinatario: p.sinDestinatario,
    avisos: p.avisos,
  };
}

/** Guarda lo armado (la base vuelve a chequear que la reserva esté recibida). */
export async function guardarPedidosArmados(
  cliente: SupabaseClient,
  reservaId: string,
  armado: { pedidos: PedidoArmado[]; tareas: TareaArmada[] },
): Promise<ConteoGuardado> {
  const { data, error } = await cliente.rpc("guardar_pedidos_armados", {
    p_reserva: reservaId,
    p_pedidos: armado.pedidos.map(aFilaPedido),
    p_tareas: armado.tareas.map((t) => ({ tipo: t.tipo, texto: t.texto, detalle: t.detalle })),
  });
  if (error) throw new Error(`No se pudieron guardar los pedidos: ${error.message}`);
  return data as ConteoGuardado;
}

export interface OpcionesArmado {
  plantilla?: Plantilla;
  dias?: readonly DiaDeServicio[];
  entradas?: readonly ExcursionConEntrada[];
  fichaCompleta?: readonly ProveedorFichaCompleta[];
  hostelSegunHabitacion?: readonly HostelSegunHabitacion[];
  /** M3-13: las opciones del pasajero (por defecto, las de data/opciones-pasajero.csv). */
  opcionesPasajero?: readonly OpcionDelPasajero[];
  /** M3-14: las categorías tour ↔ paquete (por defecto, las de data/categorias-tour.csv). */
  categoriasTour?: readonly CategoriaTour[];
  /** M3-15: los puntos de encuentro (por defecto, los de data/puntos-de-encuentro.csv). */
  puntosDeEncuentro?: readonly PuntoDeEncuentro[];
  /** M3-20: los buses de El Chaltén (por defecto, los de data/buses-el-chalten.csv). */
  busesElChalten?: readonly BusElChalten[];
  /** M3-22: a quién se le pide el alojamiento (por defecto, data/alojamiento-se-pide-a.csv). */
  alojamientoSePideA?: readonly AlojamientoSePideA[];
}

/** Lee la reserva y el catálogo, arma los borradores y los guarda. Una reserva que no está recibida no guarda nada. */
export async function armarYGuardarPedidos(cliente: SupabaseClient, reservaId: string, opciones: OpcionesArmado = {}): Promise<ResultadoGuardado> {
  const reserva = await cargarReservaParaPedidos(cliente, reservaId);
  if (!reserva) return { ok: false, error: "No existe la reserva." };
  const plantilla = opciones.plantilla ?? cargarPlantilla();
  const dias = opciones.dias ?? cargarDiasServicio();
  // Para revisión o ya pedida: no se lee el catálogo ni se guarda nada.
  const noSeArma = porQueNoSeArma(reserva.estado);
  if (noSeArma) return { ok: false, error: noSeArma };
  const catalogo = await cargarCatalogoParaPedidos(
    cliente,
    reserva,
    dias,
    opciones.entradas ?? cargarExcursionesConEntrada(),
    opciones.fichaCompleta ?? cargarProveedoresFichaCompleta(),
    opciones.hostelSegunHabitacion ?? cargarHostelSegunHabitacion(),
    opciones.opcionesPasajero ?? cargarOpcionesPasajero(),
    opciones.categoriasTour ?? cargarCategoriasTour(),
    opciones.puntosDeEncuentro ?? cargarPuntosDeEncuentro(),
    opciones.busesElChalten ?? cargarBusesElChalten(),
    opciones.alojamientoSePideA ?? cargarAlojamientoSePideA(),
  );
  const armado = armarPedidos(reserva, catalogo, plantilla);
  if (!armado.ok) return armado;
  const guardado = await guardarPedidosArmados(cliente, reservaId, armado);
  return { ...armado, guardado };
}

/** Los borradores y las tareas guardados de una reserva. */
export async function cargarPedidos(cliente: SupabaseClient, reservaId: string): Promise<{ pedidos: PedidoGuardado[]; tareas: TareaGuardada[] }> {
  const [pedidos, tareas] = await Promise.all([
    cliente.from("reserva_pedido").select("*").eq("reserva_id", reservaId).order("created_at"),
    cliente.from("reserva_tarea").select("*").eq("reserva_id", reservaId).order("orden"),
  ]);
  if (pedidos.error) throw new Error(`No se pudieron leer los pedidos: ${pedidos.error.message}`);
  if (tareas.error) throw new Error(`No se pudieron leer las tareas: ${tareas.error.message}`);
  return { pedidos: (pedidos.data ?? []) as PedidoGuardado[], tareas: (tareas.data ?? []) as TareaGuardada[] };
}
