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
import { parsearCategoriasTour, type CategoriaTour } from "@/lib/importador-tours/datos";
import {
  ARCHIVO_BLACKOUTS,
  ARCHIVO_DIAS_BUS,
  ARCHIVO_FECHAS_ESPECIALES,
  ARCHIVO_SALIDAS_BUS,
  leerBlackouts,
  leerDiasDeBus,
  leerFechasEspeciales,
  leerSalidasDeBus,
  type ReglasItinerario,
} from "./itinerario";
import type {
  AlojamientoSePideA,
  AlojamientoSinDesayuno,
  BusElChalten,
  CatalogoParaPedidos,
  CiudadEnPortugues,
  DiaDeServicio,
  ExcursionConEntrada,
  HostelSegunHabitacion,
  OpcionDelPasajero,
  ParteParaPedidos,
  PasajeroDeReserva,
  ProveedorFichaCompleta,
  PuntoDeEncuentro,
  ReservaParaPedidos,
  TramoSePideA,
  VueloDeReserva,
} from "./tipos";

export const ARCHIVO_DIAS = join("data", "dias-servicio.csv");
export const ARCHIVO_ENTRADAS = join("data", "excursiones-con-entrada.csv");
export const ARCHIVO_FICHA_COMPLETA = join("data", "proveedores-ficha-completa.csv");
export const ARCHIVO_HOSTEL_SEGUN_HABITACION = join("data", "hostel-segun-habitacion.csv");
export const ARCHIVO_OPCIONES_PASAJERO = join("data", "opciones-pasajero.csv");
export const ARCHIVO_CATEGORIAS_TOUR = join("data", "categorias-tour.csv");
export const ARCHIVO_PUNTOS_DE_ENCUENTRO = join("data", "puntos-de-encuentro.csv");
export const ARCHIVO_BUSES_EL_CHALTEN = join("data", "buses-el-chalten.csv");
export const ARCHIVO_ALOJAMIENTO_SE_PIDE_A = join("data", "alojamiento-se-pide-a.csv");
export const ARCHIVO_TRAMOS_SE_PIDEN_A = join("data", "tramos-se-piden-a.csv");
export const ARCHIVO_ALOJAMIENTOS_SIN_DESAYUNO = join("data", "alojamientos-sin-desayuno.csv");
export const ARCHIVO_CIUDADES_PORTUGUES = join("data", "ciudades-portugues.csv");

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

/**
 * `data/dias-servicio.csv`: codigo,orden,dia,servicio,momento,nota (el día de un servicio dentro de
 * su paquete). `servicio` (M3-15) da el día a una excursión por su nombre cuando el renglón del
 * catálogo junta varias ("Bodegas half Day and Alta Montaña"); `momento` dice cuándo ese día
 * ("por la tarde"). `tour` (M3-23) limita la regla a ese tour, donde reemplaza a la general del
 * mismo servicio. Sigue leyendo el formato de antes (codigo,orden,dia,nota).
 */
export function leerDiasServicio(contenido: string): DiaDeServicio[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^codigo,orden,dia\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_DIAS}: la primera fila tiene que ser "codigo,orden,dia,servicio,momento,tour,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const codigo = f.codigo?.trim();
    const o = Number(f.orden?.trim());
    const d = Number(f.dia?.trim());
    if (!codigo || !Number.isInteger(o) || !Number.isInteger(d) || d < 1) {
      throw new Error(`${ARCHIVO_DIAS}, fila ${i + 2}: hace falta código, orden y día (un número desde 1).`);
    }
    const servicio = f.servicio?.trim();
    const momento = f.momento?.trim();
    const tour = f.tour?.trim();
    return { codigo, orden: o, dia: d, ...(servicio ? { servicio } : {}), ...(momento ? { momento } : {}), ...(tour ? { tour } : {}) };
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
 * `data/alojamiento-se-pide-a.csv`: destino,alojamiento,proveedor,nota (M3-22, owner 2026-10-23). El
 * alojamiento (su nombre en el catálogo) de ese destino se le pide al proveedor (su nombre en el directorio).
 */
export function leerAlojamientoSePideA(contenido: string): AlojamientoSePideA[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^destino,alojamiento,proveedor\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_ALOJAMIENTO_SE_PIDE_A}: la primera fila tiene que ser "destino,alojamiento,proveedor,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const destino = f.destino?.trim().toUpperCase();
    const alojamiento = f.alojamiento?.trim();
    const proveedor = f.proveedor?.trim();
    if (!destino || !alojamiento || !proveedor) {
      throw new Error(`${ARCHIVO_ALOJAMIENTO_SE_PIDE_A}, fila ${i + 2}: hace falta el destino, el alojamiento y el proveedor.`);
    }
    return { destino, alojamiento, proveedor };
  });
}

export function cargarAlojamientoSePideA(raiz: string = process.cwd()): AlojamientoSePideA[] {
  return leerAlojamientoSePideA(readFileSync(join(raiz, ARCHIVO_ALOJAMIENTO_SE_PIDE_A), "utf-8"));
}

/**
 * `data/alojamientos-sin-desayuno.csv`: alojamiento,nota (M3-35, owner 2026-10-28). Los alojamientos
 * (su nombre en el catálogo) que no ofrecen desayuno. El owner suma filas editando el CSV.
 */
export function leerAlojamientosSinDesayuno(contenido: string): AlojamientoSinDesayuno[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^alojamiento,nota\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_ALOJAMIENTOS_SIN_DESAYUNO}: la primera fila tiene que ser "alojamiento,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const alojamiento = f.alojamiento?.trim();
    if (!alojamiento) throw new Error(`${ARCHIVO_ALOJAMIENTOS_SIN_DESAYUNO}, fila ${i + 2}: hace falta el alojamiento.`);
    return { alojamiento, nota: f.nota?.trim() || null };
  });
}

export function cargarAlojamientosSinDesayuno(raiz: string = process.cwd()): AlojamientoSinDesayuno[] {
  return leerAlojamientosSinDesayuno(readFileSync(join(raiz, ARCHIVO_ALOJAMIENTOS_SIN_DESAYUNO), "utf-8"));
}

/**
 * `data/ciudades-portugues.csv`: ciudad,nota (M3-32, owner 2026-10-28). Las ciudades de Brasil del
 * directorio de proveedores: a esos proveedores el pedido les sale en portugués. El owner suma filas
 * editando el CSV.
 */
export function leerCiudadesPortugues(contenido: string): CiudadEnPortugues[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^ciudad,nota\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_CIUDADES_PORTUGUES}: la primera fila tiene que ser "ciudad,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const ciudad = f.ciudad?.trim();
    if (!ciudad) throw new Error(`${ARCHIVO_CIUDADES_PORTUGUES}, fila ${i + 2}: hace falta la ciudad.`);
    return { ciudad, nota: f.nota?.trim() || null };
  });
}

export function cargarCiudadesPortugues(raiz: string = process.cwd()): CiudadEnPortugues[] {
  return leerCiudadesPortugues(readFileSync(join(raiz, ARCHIVO_CIUDADES_PORTUGUES), "utf-8"));
}

/**
 * `data/tramos-se-piden-a.csv`: tour,ruta,proveedor,horario,nota (M3-25, owner 2026-10-27). El bus `ruta`
 * ("A – B") del tour, que si no emite HI Travel (tarea), se le pide al proveedor (su nombre en el directorio),
 * con su hora de salida en ese sentido (opcional).
 */
export function leerTramosSePidenA(contenido: string): TramoSePideA[] {
  const cabecera = contenido.replace(/^\uFEFF/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^tour,ruta,proveedor\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_TRAMOS_SE_PIDEN_A}: la primera fila tiene que ser "tour,ruta,proveedor,horario,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const tour = f.tour?.trim();
    const ruta = f.ruta?.trim();
    const proveedor = f.proveedor?.trim();
    if (!tour || !ruta || !proveedor || ruta.split(/\s+[–-]\s+/).length !== 2) {
      throw new Error(`${ARCHIVO_TRAMOS_SE_PIDEN_A}, fila ${i + 2}: hace falta el tour, la ruta ("A – B") y el proveedor.`);
    }
    const horario = f.horario?.trim();
    return { tour, ruta, proveedor, ...(horario ? { horario } : {}) };
  });
}

export function cargarTramosSePidenA(raiz: string = process.cwd()): TramoSePideA[] {
  return leerTramosSePidenA(readFileSync(join(raiz, ARCHIVO_TRAMOS_SE_PIDEN_A), "utf-8"));
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

/**
 * `data/puntos-de-encuentro.csv`: codigo,orden,servicio,punto,nota (M3-15, owner 2026-10-22). La
 * excursión `servicio` del servicio `orden` del paquete `codigo` no tiene pick up: el pasajero va
 * directo al `punto`.
 */
export function leerPuntosDeEncuentro(contenido: string): PuntoDeEncuentro[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^codigo,orden,servicio,punto\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_PUNTOS_DE_ENCUENTRO}: la primera fila tiene que ser "codigo,orden,servicio,punto,nota".`);
  }
  return leerCsv(contenido).map((f, i) => {
    const codigo = f.codigo?.trim();
    const orden = Number(f.orden?.trim());
    const servicio = f.servicio?.trim();
    const punto = f.punto?.trim();
    if (!codigo || !Number.isInteger(orden) || !servicio || !punto) {
      throw new Error(`${ARCHIVO_PUNTOS_DE_ENCUENTRO}, fila ${i + 2}: hace falta el código, el orden (un número), el servicio y el punto de encuentro.`);
    }
    return { codigo, orden, servicio, punto };
  });
}

export function cargarPuntosDeEncuentro(raiz: string = process.cwd()): PuntoDeEncuentro[] {
  return leerPuntosDeEncuentro(readFileSync(join(raiz, ARCHIVO_PUNTOS_DE_ENCUENTRO), "utf-8"));
}

/**
 * `data/buses-el-chalten.csv`: codigo,orden,tramo,dia,aeropuerto,renglon,horario,vuelo_despues_de,aviso,nota
 * (M3-20, owner 2026-10-23). El bus regular aeropuerto FTE → El Chaltén (ida) y El Chaltén → El
 * Calafate (vuelta) de ese servicio del paquete, con su horario y la hora límite del vuelo.
 */
export function leerBusesElChalten(contenido: string): BusElChalten[] {
  const cabecera = contenido.replace(/^﻿/, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^codigo,orden,tramo,dia,aeropuerto,renglon,horario,vuelo_despues_de,aviso\b/.test(cabecera)) {
    throw new Error(`${ARCHIVO_BUSES_EL_CHALTEN}: la primera fila tiene que ser "codigo,orden,tramo,dia,aeropuerto,renglon,horario,vuelo_despues_de,aviso,nota".`);
  }
  const opcional = (x: string | undefined) => x?.trim() || null;
  return leerCsv(contenido).map((f, i) => {
    const codigo = f.codigo?.trim();
    const orden = Number(f.orden?.trim() || "x");
    const tramo = f.tramo?.trim();
    const dia = f.dia?.trim() ? Number(f.dia.trim()) : null;
    const horario = f.horario?.trim();
    const vueloDespuesDe = opcional(f.vuelo_despues_de);
    const diaValido = dia === null || (Number.isInteger(dia) && dia > 0);
    const horaValida = !vueloDespuesDe || /^\d{1,2}:\d{2}$/.test(vueloDespuesDe);
    if (!codigo || !Number.isInteger(orden) || (tramo !== "ida" && tramo !== "vuelta") || !horario || !diaValido || !horaValida) {
      throw new Error(
        `${ARCHIVO_BUSES_EL_CHALTEN}, fila ${i + 2}: hace falta el código, el orden (un número), el tramo (ida o vuelta) y el horario; el día va como número y la hora límite como 17:00.`,
      );
    }
    return { codigo, orden, tramo, dia, aeropuerto: opcional(f.aeropuerto)?.toUpperCase() ?? null, renglon: opcional(f.renglon), horario, vueloDespuesDe, aviso: opcional(f.aviso) };
  });
}

export function cargarBusesElChalten(raiz: string = process.cwd()): BusElChalten[] {
  return leerBusesElChalten(readFileSync(join(raiz, ARCHIVO_BUSES_EL_CHALTEN), "utf-8"));
}

/**
 * `data/categorias-tour.csv`: tour,categoria_tour,componente,categoria_paquete,nota (M1-05; al armar,
 * M3-14). La misma lectura que el importador de tours (categorías normalizadas).
 */
export function cargarCategoriasTour(raiz: string = process.cwd()): CategoriaTour[] {
  return parsearCategoriasTour(readFileSync(join(raiz, ARCHIVO_CATEGORIAS_TOUR), "utf-8"));
}

/** Las reglas con su proveedor del directorio (por nombre, sin mayúsculas ni acentos); null si no está. */
export function conProveedores(reglas: readonly OpcionDelPasajero[], proveedores: readonly ProveedorResumen[]): OpcionDelPasajero[] {
  return reglas.map((r) =>
    r.proveedor ? { ...r, proveedorDelDirectorio: proveedores.find((p) => normalizarTexto(p.nombre) === normalizarTexto(r.proveedor!)) ?? null } : r,
  );
}

/** M3-22: las reglas de alojamiento con su proveedor del directorio (por nombre, sin mayúsculas ni acentos); null si no está. */
export function conProveedorDelAlojamiento(reglas: readonly AlojamientoSePideA[], proveedores: readonly ProveedorResumen[]): AlojamientoSePideA[] {
  return reglas.map((r) => ({ ...r, proveedorDelDirectorio: proveedores.find((p) => normalizarTexto(p.nombre) === normalizarTexto(r.proveedor)) ?? null }));
}

/** M3-25: las reglas de los tramos de bus con su proveedor del directorio (por nombre, sin mayúsculas ni acentos); null si no está. */
export function conProveedorDelTramo(reglas: readonly TramoSePideA[], proveedores: readonly ProveedorResumen[]): TramoSePideA[] {
  return reglas.map((r) => ({ ...r, proveedorDelDirectorio: proveedores.find((p) => normalizarTexto(p.nombre) === normalizarTexto(r.proveedor)) ?? null }));
}

/** Los proveedores de las reglas que tocan a estos productos, del directorio (una consulta por nombre). */
async function proveedoresDeOpciones(cliente: SupabaseClient, reglas: readonly OpcionDelPasajero[], codigos: Set<string>): Promise<OpcionDelPasajero[]> {
  const propias = reglas.filter((r) => codigos.has(r.codigo));
  const nombres = [...new Set(propias.map((r) => r.proveedor).filter((x): x is string => !!x))];
  return conProveedores(propias, await proveedoresPorNombre(cliente, nombres));
}

/** M3-22: las reglas de alojamiento de los destinos de estos productos, con su proveedor del directorio. */
async function proveedoresDeAlojamientos(cliente: SupabaseClient, reglas: readonly AlojamientoSePideA[], destinos: Set<string>): Promise<AlojamientoSePideA[]> {
  const propias = reglas.filter((r) => destinos.has(r.destino));
  return conProveedorDelAlojamiento(propias, await proveedoresPorNombre(cliente, [...new Set(propias.map((r) => r.proveedor))]));
}

/** Los proveedores del directorio con esos nombres (una consulta por nombre). */
async function proveedoresPorNombre(cliente: SupabaseClient, nombres: readonly string[]): Promise<ProveedorResumen[]> {
  const encontrados: ProveedorResumen[] = [];
  for (const nombre of nombres) {
    // Sin comodines: el nombre exacto, sin mayúsculas.
    const patron = nombre.replace(/[\\%_]/g, (c) => `\\${c}`);
    const filas = verificar(await cliente.from("proveedor").select("id,nombre,mails,canal,telefono,ciudad").ilike("nombre", patron), "los proveedores") as any[];
    for (const f of filas) {
      encontrados.push({ id: f.id, nombre: f.nombre, mails: f.mails ?? [], canal: (f.canal ?? null) as Canal, telefono: f.telefono ?? null, ciudad: f.ciudad ?? null });
    }
  }
  return encontrados;
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
  categoriasTour: readonly CategoriaTour[] = [],
  puntosDeEncuentro: readonly PuntoDeEncuentro[] = [],
  busesElChalten: readonly BusElChalten[] = [],
  alojamientoSePideA: readonly AlojamientoSePideA[] = [],
  tramosSePidenA: readonly TramoSePideA[] = [],
): Promise<CatalogoParaPedidos> {
  const ids = [...new Set([reserva.productoId, ...reserva.otrosProductos, ...reserva.partes.map((p) => p.productoId)].filter((x): x is string => !!x))];
  const detalles = new Map<string, DetalleProducto>(await Promise.all(ids.map(async (id) => [id, await cargarProducto(cliente, id)] as const)));
  const idsProveedores = [...new Set(reserva.partes.map((p) => p.proveedorId).filter((x): x is string => !!x))];
  const proveedores = new Map<string, ProveedorResumen>();
  if (idsProveedores.length) {
    const filas = verificar(await cliente.from("proveedor").select("id,nombre,mails,canal,telefono,ciudad").in("id", idsProveedores), "los proveedores") as any[];
    for (const f of filas) {
      proveedores.set(f.id, { id: f.id, nombre: f.nombre, mails: f.mails ?? [], canal: (f.canal ?? null) as Canal, telefono: f.telefono ?? null, ciudad: f.ciudad ?? null });
    }
  }
  // M3-13: las opciones del pasajero de estos paquetes (sueltos o dentro de un tour), con su proveedor.
  const codigos = new Set([...detalles.values()].flatMap((d) => [d.codigo, ...d.componentes.map((c) => c.producto?.codigo ?? "")]));
  const opciones = opcionesPasajero.length ? await proveedoresDeOpciones(cliente, opcionesPasajero, codigos) : [];
  // M3-22: a quién se le pide el alojamiento (Factoria a Factoria), solo de los destinos de estos productos.
  const destinos = new Set([...detalles.values()].flatMap((d) => [d.destino ?? "", ...d.componentes.map((c) => c.producto?.destino ?? "")]).filter(Boolean));
  const alojamientos = alojamientoSePideA.length ? await proveedoresDeAlojamientos(cliente, alojamientoSePideA, destinos) : [];
  // M3-25: los buses de estos tours que se le piden a un proveedor (Bariloche – El Chaltén de AR10 a Chalten Travel).
  const tramosPropios = tramosSePidenA.filter((t) => codigos.has(t.tour));
  const tramos = tramosPropios.length ? conProveedorDelTramo(tramosPropios, await proveedoresPorNombre(cliente, [...new Set(tramosPropios.map((t) => t.proveedor))])) : [];
  return {
    detalles,
    proveedores,
    dias,
    entradas,
    fichaCompleta,
    hostelSegunHabitacion,
    opcionesPasajero: opciones,
    categoriasTour,
    puntosDeEncuentro,
    busesElChalten,
    alojamientoSePideA: alojamientos,
    tramosSePidenA: tramos,
  };
}

/**
 * M3-24: las reglas de los avisos del itinerario (`data/blackouts.csv`, `data/fechas-especiales.csv` y
 * `data/dias-bus.csv`; M3-27: `data/salidas-bus.csv`), leídas al armar: cambiar una regla no pide recargar el catálogo.
 */
export function cargarReglasItinerario(raiz: string = process.cwd()): ReglasItinerario {
  const leer = (archivo: string) => readFileSync(join(raiz, archivo), "utf-8");
  return {
    blackouts: leerBlackouts(leer(ARCHIVO_BLACKOUTS)),
    fechasEspeciales: leerFechasEspeciales(leer(ARCHIVO_FECHAS_ESPECIALES)),
    diasBus: leerDiasDeBus(leer(ARCHIVO_DIAS_BUS)),
    salidasBus: leerSalidasDeBus(leer(ARCHIVO_SALIDAS_BUS)),
  };
}
