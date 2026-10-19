/**
 * Lo que el armado de pedidos (M3-01) lee de la base: la reserva con sus
 * partes y el catálogo que hace falta (el detalle de cada producto con la
 * misma lectura que la pantalla, `cargarProducto`, con los ajustes de M1-08).
 * Solo lectura. Recibe el cliente que corresponda (la sesión del equipo o la
 * service role en los scripts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarProducto } from "@/lib/catalogo/consultas";
import type { Canal, DetalleProducto, ProveedorResumen } from "@/lib/catalogo/tipos";
import type { EstadoReserva, HotelDeLaAgencia, TipoComponenteReserva } from "@/lib/reservas/tipos";
import { leerCsv } from "@/lib/importador-productos/csv";
import type {
  CatalogoParaPedidos,
  DiaDeServicio,
  ExcursionConEntrada,
  ParteParaPedidos,
  PasajeroDeReserva,
  ReservaParaPedidos,
  VueloDeReserva,
} from "./tipos";

export const ARCHIVO_DIAS = join("data", "dias-servicio.csv");
export const ARCHIVO_ENTRADAS = join("data", "excursiones-con-entrada.csv");

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST, se tipan al mapear */

function verificar<T>(r: { data: T | null; error: { message: string } | null }, que: string): T {
  if (r.error) throw new Error(`No se pudo leer ${que}: ${r.error.message}`);
  return r.data as T;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const lista = <T>(v: unknown): T[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as T[]) : []);

const CAMPOS_RESERVA =
  "id,estado,agencia,booking_id,booking_id_original,producto_id,otros_productos,fecha_inicio,fecha_fin,pax,pasajeros,vuelos," +
  "habitacion,pedidos_especiales,hoteles_agencia,sin_traslado_de";
const CAMPOS_PARTE =
  "id,orden,tipo,producto_id,producto_componente_id,descripcion_ruta,texto_agencia,fecha_inicio,fecha_fin,es_tarea,producto_servicio_id,proveedor_id,pick_up";

export function aParte(c: any): ParteParaPedidos {
  return {
    id: c.id,
    orden: c.orden,
    tipo: c.tipo as TipoComponenteReserva,
    productoId: c.producto_id ?? null,
    productoComponenteId: c.producto_componente_id ?? null,
    descripcionRuta: texto(c.descripcion_ruta),
    textoAgencia: texto(c.texto_agencia),
    fechaInicio: c.fecha_inicio ?? null,
    fechaFin: c.fecha_fin ?? null,
    esTarea: Boolean(c.es_tarea),
    productoServicioId: c.producto_servicio_id ?? null,
    proveedorId: c.proveedor_id ?? null,
    pickUp: texto(c.pick_up),
  };
}

/** La reserva con sus partes, lista para `armarPedidos`. Null si no existe. */
export async function cargarReservaParaPedidos(cliente: SupabaseClient, id: string): Promise<ReservaParaPedidos | null> {
  const r = verificar(await cliente.from("reserva").select(CAMPOS_RESERVA).eq("id", id).maybeSingle(), "la reserva") as any;
  if (!r) return null;
  const partes = verificar(await cliente.from("reserva_componente").select(CAMPOS_PARTE).eq("reserva_id", id).order("orden"), "las partes de la reserva") as any[];
  return {
    id: r.id,
    estado: r.estado as EstadoReserva,
    agencia: r.agencia,
    numero: texto(r.booking_id_original) ?? texto(r.booking_id),
    productoId: r.producto_id ?? null,
    otrosProductos: Array.isArray(r.otros_productos) ? r.otros_productos : [],
    fechaInicio: r.fecha_inicio ?? null,
    fechaFin: r.fecha_fin ?? null,
    pax: typeof r.pax === "number" ? r.pax : null,
    pasajeros: lista<PasajeroDeReserva>(r.pasajeros),
    vuelos: lista<VueloDeReserva>(r.vuelos),
    habitacion: texto(r.habitacion),
    pedidosEspeciales: texto(r.pedidos_especiales),
    hotelesAgencia: lista<HotelDeLaAgencia>(r.hoteles_agencia).filter((h) => texto(h.nombre)),
    sinTrasladoDe: r.sin_traslado_de ?? null,
    partes: partes.map(aParte),
  };
}

/** `data/dias-servicio.csv`: codigo,orden,dia,nota (el día de un servicio dentro de su paquete). */
export function leerDiasServicio(contenido: string): DiaDeServicio[] {
  const filas = contenido.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  const [cabecera, ...resto] = filas;
  if (!cabecera || !/^codigo,orden,dia\b/.test(cabecera.trim())) {
    throw new Error(`${ARCHIVO_DIAS}: la primera fila tiene que ser "codigo,orden,dia,nota".`);
  }
  return resto.map((l, i) => {
    const [codigo, orden, dia] = l.split(",").map((x) => x.trim());
    const o = Number(orden);
    const d = Number(dia);
    if (!codigo || !Number.isInteger(o) || !Number.isInteger(d) || d < 1) {
      throw new Error(`${ARCHIVO_DIAS}, fila ${i + 2}: hace falta código, orden y día (un número desde 1).`);
    }
    return { codigo, orden: o, dia: d };
  });
}

export function cargarDiasServicio(raiz: string = process.cwd()): DiaDeServicio[] {
  return leerDiasServicio(readFileSync(join(raiz, ARCHIVO_DIAS), "utf-8"));
}

/**
 * `data/excursiones-con-entrada.csv`: codigo,patron,estado,nota (owner, 2026-10-19). Cada fila
 * nombra una excursión por su código de producto o por una parte de su nombre; estado "si" se
 * aplica (en las reservas de Journaway se pide con entradas) y "revisar" queda para confirmar.
 */
export function leerExcursionesConEntrada(contenido: string): ExcursionConEntrada[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^codigo,patron,estado\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_ENTRADAS}: la primera fila tiene que ser "codigo,patron,estado,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const codigo = f.codigo?.trim() || null;
    const patron = f.patron?.trim() || null;
    const estado = f.estado?.trim().toLowerCase();
    if ((!codigo && !patron) || (estado !== "si" && estado !== "revisar")) {
      throw new Error(`${ARCHIVO_ENTRADAS}, fila ${i + 2}: hace falta un código o un patrón, y el estado "si" o "revisar".`);
    }
    return { codigo, patron, estado };
  });
}

export function cargarExcursionesConEntrada(raiz: string = process.cwd()): ExcursionConEntrada[] {
  return leerExcursionesConEntrada(readFileSync(join(raiz, ARCHIVO_ENTRADAS), "utf-8"));
}

/**
 * El catálogo que necesita una reserva: el detalle del producto, de los otros
 * productos y de cada parte (una vez cada uno), y los proveedores de las partes
 * de tipo servicio. Si algo no se puede leer, falla: nunca se arma a medias.
 */
export async function cargarCatalogoParaPedidos(
  cliente: SupabaseClient,
  reserva: ReservaParaPedidos,
  dias: readonly DiaDeServicio[],
  entradas: readonly ExcursionConEntrada[] = [],
): Promise<CatalogoParaPedidos> {
  const ids = [...new Set([reserva.productoId, ...reserva.otrosProductos, ...reserva.partes.map((p) => p.productoId)].filter((x): x is string => !!x))];
  const detalles = new Map<string, DetalleProducto>(await Promise.all(ids.map(async (id) => [id, await cargarProducto(cliente, id)] as const)));
  const idsProveedores = [...new Set(reserva.partes.map((p) => p.proveedorId).filter((x): x is string => !!x))];
  const proveedores = new Map<string, ProveedorResumen>();
  if (idsProveedores.length) {
    const filas = verificar(await cliente.from("proveedor").select("id,nombre,mails,canal,telefono").in("id", idsProveedores), "los proveedores") as any[];
    for (const f of filas) {
      proveedores.set(f.id, { id: f.id, nombre: f.nombre, mails: f.mails ?? [], canal: (f.canal ?? null) as Canal, telefono: f.telefono ?? null });
    }
  }
  return { detalles, proveedores, dias, entradas };
}
