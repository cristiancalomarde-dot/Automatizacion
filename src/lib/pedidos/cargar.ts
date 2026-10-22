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
import { normalizarTexto } from "@/lib/catalogo/reglas";
import type { Canal, DetalleProducto, ProveedorResumen } from "@/lib/catalogo/tipos";
import type { EstadoReserva, HotelDeLaAgencia, TipoComponenteReserva } from "@/lib/reservas/tipos";
import { leerCsv } from "@/lib/importador-productos/csv";
import type {
  CatalogoParaPedidos,
  DiaDeServicio,
  ExcursionConEntrada,
  HostelSegunHabitacion,
  OpcionDelPasajero,
  ParteParaPedidos,
  PasajeroDeReserva,
  ProveedorFichaCompleta,
  ReservaParaPedidos,
  VueloDeReserva,
} from "./tipos";

export const ARCHIVO_DIAS = join("data", "dias-servicio.csv");
export const ARCHIVO_ENTRADAS = join("data", "excursiones-con-entrada.csv");
export const ARCHIVO_FICHA_COMPLETA = join("data", "proveedores-ficha-completa.csv");
export const ARCHIVO_HOSTEL_SEGUN_HABITACION = join("data", "hostel-segun-habitacion.csv");
export const ARCHIVO_OPCIONES_PASAJERO = join("data", "opciones-pasajero.csv");

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST, se tipan al mapear */

function verificar<T>(r: { data: T | null; error: { message: string } | null }, que: string): T {
  if (r.error) throw new Error(`No se pudo leer ${que}: ${r.error.message}`);
  return r.data as T;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const lista = <T>(v: unknown): T[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as T[]) : []);

const CAMPOS_RESERVA =
  "id,estado,agencia,booking_id,booking_id_original,producto_id,otros_productos,fecha_inicio,fecha_fin,pax,pasajeros,vuelos," +
  "habitacion,pedidos_especiales,hoteles_agencia,sin_traslado_de,contacto_cliente,notas";
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
    notas: Array.isArray(r.notas) ? r.notas.filter((n: unknown): n is string => typeof n === "string" && !!n.trim()) : [],
    contactoCliente: r.contacto_cliente && typeof r.contacto_cliente === "object" ? { telefono: texto(r.contacto_cliente.telefono) } : null,
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
 * `data/proveedores-ficha-completa.csv`: proveedor,nota (owner, 2026-10-19). Cada fila nombra un
 * proveedor del directorio (se compara sin mayúsculas ni acentos) que pide la ficha completa por
 * pasajero (hoy Horizonte Atacama).
 */
export function leerProveedoresFichaCompleta(contenido: string): ProveedorFichaCompleta[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^proveedor,nota\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_FICHA_COMPLETA}: la primera fila tiene que ser "proveedor,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const proveedor = f.proveedor?.trim();
    if (!proveedor) throw new Error(`${ARCHIVO_FICHA_COMPLETA}, fila ${i + 2}: falta el nombre del proveedor.`);
    return { proveedor };
  });
}

export function cargarProveedoresFichaCompleta(raiz: string = process.cwd()): ProveedorFichaCompleta[] {
  return leerProveedoresFichaCompleta(readFileSync(join(raiz, ARCHIVO_FICHA_COMPLETA), "utf-8"));
}

/**
 * `data/hostel-segun-habitacion.csv`: destino,habitacion,orden,nota (M3-11, owner 2026-10-09/22).
 * `habitacion` es "dorm" o "privada"; `orden`, los nombres de los hostels separados por "|".
 */
export function leerHostelSegunHabitacion(contenido: string): HostelSegunHabitacion[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^destino,habitacion,orden\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_HOSTEL_SEGUN_HABITACION}: la primera fila tiene que ser "destino,habitacion,orden,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const destino = f.destino?.trim();
    const habitacion = f.habitacion?.trim().toLowerCase();
    const orden = (f.orden ?? "").split("|").map((x) => x.trim()).filter(Boolean);
    if (!destino || (habitacion !== "dorm" && habitacion !== "privada") || orden.length === 0) {
      throw new Error(`${ARCHIVO_HOSTEL_SEGUN_HABITACION}, fila ${i + 2}: hace falta el destino, la habitación ("dorm" o "privada") y al menos un hostel.`);
    }
    return { destino, habitacion, orden };
  });
}

export function cargarHostelSegunHabitacion(raiz: string = process.cwd()): HostelSegunHabitacion[] {
  return leerHostelSegunHabitacion(readFileSync(join(raiz, ARCHIVO_HOSTEL_SEGUN_HABITACION), "utf-8"));
}

/**
 * `data/opciones-pasajero.csv`: codigo,orden,eleccion,accion,servicio,proveedor,nota (M3-13, owner
 * 2026-10-22). `accion` es "elegir", "renombrar" o "agregar"; "agregar" lleva el proveedor (su
 * nombre en el directorio).
 */
export function leerOpcionesPasajero(contenido: string): OpcionDelPasajero[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^codigo,orden,eleccion,accion,servicio,proveedor\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_OPCIONES_PASAJERO}: la primera fila tiene que ser "codigo,orden,eleccion,accion,servicio,proveedor,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const fila = `${ARCHIVO_OPCIONES_PASAJERO}, fila ${i + 2}`;
    const codigo = f.codigo?.trim();
    const orden = Number(f.orden?.trim());
    const eleccion = f.eleccion?.trim();
    const accion = f.accion?.trim().toLowerCase();
    const servicio = f.servicio?.trim();
    const proveedor = f.proveedor?.trim() || null;
    if (!codigo || !Number.isInteger(orden) || !eleccion || !servicio || (accion !== "elegir" && accion !== "renombrar" && accion !== "agregar")) {
      throw new Error(`${fila}: hace falta el código, el orden (un número), la elección, la acción ("elegir", "renombrar" o "agregar") y el servicio.`);
    }
    if (accion === "agregar" && !proveedor) throw new Error(`${fila}: "agregar" necesita el proveedor.`);
    return { codigo, orden, eleccion, accion, servicio, proveedor };
  });
}

export function cargarOpcionesPasajero(raiz: string = process.cwd()): OpcionDelPasajero[] {
  return leerOpcionesPasajero(readFileSync(join(raiz, ARCHIVO_OPCIONES_PASAJERO), "utf-8"));
}

/** Las reglas con su proveedor del directorio (por nombre, sin mayúsculas ni acentos); null si no está. */
export function conProveedores(reglas: readonly OpcionDelPasajero[], proveedores: readonly ProveedorResumen[]): OpcionDelPasajero[] {
  return reglas.map((r) =>
    r.proveedor ? { ...r, proveedorDelDirectorio: proveedores.find((p) => normalizarTexto(p.nombre) === normalizarTexto(r.proveedor!)) ?? null } : r,
  );
}

/** Los proveedores de las reglas que tocan a estos productos, del directorio (una consulta por nombre). */
async function proveedoresDeOpciones(cliente: SupabaseClient, reglas: readonly OpcionDelPasajero[], codigos: Set<string>): Promise<OpcionDelPasajero[]> {
  const propias = reglas.filter((r) => codigos.has(r.codigo));
  const nombres = [...new Set(propias.map((r) => r.proveedor).filter((x): x is string => !!x))];
  const encontrados: ProveedorResumen[] = [];
  for (const nombre of nombres) {
    // Sin comodines: el nombre exacto, sin mayúsculas.
    const patron = nombre.replace(/[\\%_]/g, (c) => `\\${c}`);
    const filas = verificar(await cliente.from("proveedor").select("id,nombre,mails,canal,telefono").ilike("nombre", patron), "los proveedores") as any[];
    for (const f of filas) {
      encontrados.push({ id: f.id, nombre: f.nombre, mails: f.mails ?? [], canal: (f.canal ?? null) as Canal, telefono: f.telefono ?? null });
    }
  }
  return conProveedores(propias, encontrados);
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
  fichaCompleta: readonly ProveedorFichaCompleta[] = [],
  hostelSegunHabitacion: readonly HostelSegunHabitacion[] = [],
  opcionesPasajero: readonly OpcionDelPasajero[] = [],
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
  // M3-13: las opciones del pasajero de estos paquetes (sueltos o dentro de un tour), con su proveedor.
  const codigos = new Set([...detalles.values()].flatMap((d) => [d.codigo, ...d.componentes.map((c) => c.producto?.codigo ?? "")]));
  const opciones = opcionesPasajero.length ? await proveedoresDeOpciones(cliente, opcionesPasajero, codigos) : [];
  return { detalles, proveedores, dias, entradas, fichaCompleta, hostelSegunHabitacion, opcionesPasajero: opciones };
}
