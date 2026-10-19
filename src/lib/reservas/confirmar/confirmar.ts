import "server-only";

/**
 * Confirmar el producto de una reserva "para revisión" (spec M3-05), en el
 * servidor y con el cliente de la SESIÓN de quien confirma (RLS, #1). No llama
 * a la IA (#3): lo que se aprende hace que la próxima vez tampoco haga falta.
 *
 * En orden:
 * 1. Sesión del equipo (@hitravel.com.ar); si no, nada (fila 8).
 * 2. Se lee la reserva y se controla que se pueda confirmar (para revisión,
 *    con motivo de producto, sin partes; Journaway queda afuera).
 * 3. Qué queda en la reserva (`decidir.ts`) con el detalle del producto
 *    (`cargarProducto`, como el emparejado) y qué se aprende.
 * 4. Si la equivalencia ya dice otro producto y la persona no dijo "Sí,
 *    cambiarlo", se devuelve la pregunta sin escribir nada (fila 5).
 * 5. Todo se guarda en una transacción (`confirmar_producto_reserva`, 0020),
 *    que vuelve a controlar que la reserva siga como se la leyó.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { quienEnvia } from "@/lib/pedidos/envio/enviar";
import { TEXTOS } from "@/lib/textos";
import { PROVEEDOR_TRANSFER_PNT } from "../emparejar/componentes";
import type { FichaLectura, VueloIA } from "../esquema-ficha";
import { esIdDeReserva } from "../reglas";
import type { EstadoReserva } from "../tipos";
import {
  cambiosDeLaEquivalencia,
  decidirConfirmacion,
  pedidoDeLaAgencia,
  planAprendizaje,
  porQueNoSeConfirma,
  type EquivalenciaGuardada,
  type ReservaParaConfirmar,
} from "./decidir";

const T = TEXTOS.reserva.confirmarProducto;
const R = T.motivos;

export interface EntradaConfirmar {
  reservaId: string;
  productoId: string;
  /** La persona contestó "Sí, cambiarlo" a "<agencia> ya tenía «…» como <otro>". */
  cambiarEquivalencia?: boolean;
}

export type ResultadoConfirmar =
  | { ok: true; estado: "recibida" | "para_revision"; codigo: string; agencia: string; aprendio: boolean }
  | { ok: false; error: string; sinSesion?: true; conflicto?: string };

const fallo = (motivo: string): ResultadoConfirmar => ({ ok: false, error: T.error(motivo) });

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST, se tipan al mapear */

const CAMPOS_RESERVA =
  "id,agencia,estado,de_prueba,motivos_revision,producto_id,sugerencia_producto_id,producto_texto_agencia," +
  "fecha_inicio,fecha_fin,vuelos,pedidos_especiales,sin_traslado_de,datos_extraidos";

function aReserva(r: any, cantidadPartes: number): ReservaParaConfirmar {
  return {
    id: r.id,
    agencia: r.agencia,
    estado: r.estado as EstadoReserva,
    dePrueba: Boolean(r.de_prueba),
    motivos: Array.isArray(r.motivos_revision) ? r.motivos_revision : [],
    productoId: r.producto_id ?? null,
    sugerenciaProductoId: r.sugerencia_producto_id ?? null,
    productoTextoAgencia: r.producto_texto_agencia ?? null,
    fechaInicio: r.fecha_inicio ?? null,
    fechaFin: r.fecha_fin ?? null,
    vuelos: (Array.isArray(r.vuelos) ? r.vuelos : []) as VueloIA[],
    pedidosEspeciales: r.pedidos_especiales ?? null,
    sinTrasladoDe: r.sin_traslado_de ?? null,
    datosExtraidos: (r.datos_extraidos ?? null) as FichaLectura | null,
    cantidadPartes,
  };
}

/** La traducción de un error de la base a un motivo en llano. */
function motivoDeError(e: { code?: string } | null): string {
  switch (e?.code) {
    case "HT409":
    case "HT410":
      return R.cambio;
    case "P0002":
      return R.noExiste;
    case "23505":
      return R.duplicada;
    case "23503":
      return R.productoNoExiste;
    default:
      return R.conexion;
  }
}

export async function confirmarProducto(cliente: SupabaseClient, entrada: EntradaConfirmar): Promise<ResultadoConfirmar> {
  const persona = await quienEnvia(cliente);
  if (!persona) return { ok: false, error: T.error(R.sinSesion), sinSesion: true };
  if (!esIdDeReserva(entrada.reservaId)) return fallo(R.noExiste);
  if (!esIdDeReserva(entrada.productoId)) return fallo(R.productoNoExiste);

  const [leida, partes, prod] = await Promise.all([
    cliente.from("reserva").select(CAMPOS_RESERVA).eq("id", entrada.reservaId).maybeSingle(),
    cliente.from("reserva_componente").select("id", { count: "exact", head: true }).eq("reserva_id", entrada.reservaId),
    cliente.from("producto").select("id,codigo,nombre").eq("id", entrada.productoId).maybeSingle(),
  ]);
  if (leida.error || partes.error || prod.error) return fallo(R.conexion);
  if (!leida.data) return fallo(R.noExiste);
  const reserva = aReserva(leida.data, partes.count ?? 0);
  const noSe = porQueNoSeConfirma(reserva);
  if (noSe) return fallo(noSe);
  if (!prod.data) return fallo(R.productoNoExiste);
  const producto = prod.data as { id: string; codigo: string; nombre: string };

  const [detalle, pnt, equivalencias] = await Promise.all([
    cargarProducto(cliente, producto.id),
    cliente.from("proveedor").select("id,nombre").ilike("nombre", PROVEEDOR_TRANSFER_PNT).limit(1).maybeSingle(),
    cliente.from("codigo_externo").select("id,producto_id,agencia,codigo,nombre_externo").eq("agencia", reserva.agencia).range(0, 9999),
  ]);
  if (pnt.error || equivalencias.error) return fallo(R.conexion);

  const decision = decidirConfirmacion(reserva, producto, detalle, {
    proveedorTransferPNT: (pnt.data as { id: string; nombre: string } | null) ?? null,
  });
  const pedido = pedidoDeLaAgencia(reserva);
  const plan = planAprendizaje({
    agencia: reserva.agencia,
    dePrueba: reserva.dePrueba,
    pedido,
    productoId: producto.id,
    equivalencias: ((equivalencias.data ?? []) as any[]).map(
      (e): EquivalenciaGuardada => ({ id: e.id, productoId: e.producto_id, agencia: e.agencia, codigo: e.codigo, nombreExterno: e.nombre_externo ?? null }),
    ),
  });

  if (plan.tipo === "guardar" && plan.conflictos.length > 0 && !entrada.cambiarEquivalencia) {
    const otro = await cliente.from("producto").select("codigo").eq("id", plan.conflictos[0].productoId).maybeSingle();
    if (otro.error) return fallo(R.conexion);
    const texto = plan.nombreExterno && plan.codigo !== pedido.codigo ? plan.nombreExterno : plan.codigo;
    const pregunta = T.conflicto(reserva.agencia, texto, (otro.data as { codigo: string } | null)?.codigo ?? "otro producto");
    return { ok: false, error: pregunta, conflicto: pregunta };
  }

  const aprender =
    plan.tipo === "guardar"
      ? (() => {
          const cambios = cambiosDeLaEquivalencia(plan);
          return { codigo: plan.codigo, nombre_externo: plan.nombreExterno, reemplazar: cambios.reemplazar, quitar_nombre: cambios.quitarNombre };
        })()
      : null;

  const { data, error } = await cliente.rpc("confirmar_producto_reserva", {
    p_reserva: reserva.id,
    p_motivos_antes: reserva.motivos,
    p_producto: producto.id,
    p_origen: decision.origen,
    p_confianza: decision.confianza,
    p_motivos: decision.motivos,
    p_componentes: decision.componentes.map((c, i) => ({
      orden: i + 1,
      tipo: c.tipo,
      producto_id: c.productoId ?? null,
      producto_componente_id: c.productoComponenteId ?? null,
      descripcion_ruta: c.descripcionRuta ?? null,
      fecha_inicio: c.fechaInicio ?? null,
      fecha_fin: c.fechaFin ?? null,
      es_tarea: c.esTarea ?? false,
      producto_servicio_id: c.productoServicioId ?? null,
      proveedor_id: c.proveedorId ?? null,
    })),
    p_aprender: aprender,
    // El historial no lleva datos de pasajeros (#1): quién, qué código y si era la sugerencia de la IA.
    p_evento: { persona: persona.nombre, codigo: producto.codigo, producto_id: producto.id, sugerida: decision.sugerida },
  });
  if (error) return fallo(motivoDeError(error));
  const r = (data ?? {}) as { estado?: string; aprendio?: boolean };
  return {
    ok: true,
    estado: r.estado === "recibida" ? "recibida" : "para_revision",
    codigo: producto.codigo,
    agencia: reserva.agencia,
    aprendio: r.aprendio === true,
  };
}
