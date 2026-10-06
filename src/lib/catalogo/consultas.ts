/**
 * Consultas de lectura de las pantallas de Catálogo, Directorio y Pendientes
 * (spec M1-06, Anexo técnico: cadenas a, b y c). Reciben el cliente de
 * Supabase de la sesión del usuario: RLS deja leer solo a `authenticated`.
 *
 * Solo lectura (DECISIONS 2026-10-06): ninguna función de este archivo
 * escribe en el catálogo ni en el directorio.
 *
 * Cada función tira un error si la consulta falla, para que la pantalla
 * muestre su mensaje de error con "Reintentar" y nunca datos parciales (#12).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esPendiente, estadoServicio, proveedoresDeServicios } from "./reglas";
import type {
  Canal,
  CodigoExterno,
  ComponenteTour,
  DetalleProducto,
  DetalleProveedor,
  FilaCatalogo,
  FilaDirectorio,
  Pendiente,
  ProductoBase,
  ProveedorResumen,
  Servicio,
  TipoServicio,
} from "./tipos";

const CAMPOS_PROVEEDOR = "id,nombre,mails,canal,telefono";
const CAMPOS_SERVICIO =
  "id,producto_id,tipo_servicio,nivel,orden,prioridad,descripcion,opcional,reserva_manual," +
  "proveedor_sin_resolver,proveedor_para_revisar,proveedor_nota,fila_excel," +
  "service_provider_nombre,booking_supplier_nombre," +
  `sp:service_provider_id(${CAMPOS_PROVEEDOR}),bs:booking_supplier_id(${CAMPOS_PROVEEDOR})`;
const CAMPOS_PRODUCTO = "id,codigo,nombre,ciudades,destino,updated_at";

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST, se tipan al mapear */

function verificar<T>(respuesta: { data: T | null; error: { message: string } | null }): T {
  if (respuesta.error) throw new Error(respuesta.error.message);
  return respuesta.data as T;
}

function aProveedor(fila: any): ProveedorResumen | null {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    mails: fila.mails ?? [],
    canal: (fila.canal ?? null) as Canal,
    telefono: fila.telefono ?? null,
  };
}

function aServicio(fila: any): Servicio {
  return {
    id: fila.id,
    productoId: fila.producto_id,
    tipo: fila.tipo_servicio as TipoServicio,
    nivel: fila.nivel ?? null,
    orden: fila.orden ?? null,
    prioridad: fila.prioridad,
    descripcion: fila.descripcion ?? null,
    opcional: Boolean(fila.opcional),
    reservaManual: Boolean(fila.reserva_manual),
    sinResolver: Boolean(fila.proveedor_sin_resolver),
    paraRevisar: Boolean(fila.proveedor_para_revisar),
    nota: fila.proveedor_nota ?? null,
    filaExcel: fila.fila_excel ?? null,
    serviceProviderNombre: fila.service_provider_nombre ?? null,
    bookingSupplierNombre: fila.booking_supplier_nombre ?? null,
    serviceProvider: aProveedor(fila.sp),
    bookingSupplier: aProveedor(fila.bs),
  };
}

function aProducto(fila: any): ProductoBase {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    ciudades: fila.ciudades ?? [],
    destino: fila.destino ?? null,
    updatedAt: fila.updated_at,
  };
}

function aCodigoExterno(fila: any): CodigoExterno {
  return { agencia: fila.agencia, codigo: fila.codigo, nombreExterno: fila.nombre_externo ?? null };
}

function agruparPor<T>(items: T[], clave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of items) {
    const k = clave(item);
    const lista = mapa.get(k) ?? [];
    lista.push(item);
    mapa.set(k, lista);
  }
  return mapa;
}

// === (a)+(b) Catálogo ====================================================================

export async function cargarCatalogo(supabase: SupabaseClient): Promise<FilaCatalogo[]> {
  const [productos, servicios, componentes, codigos] = await Promise.all([
    supabase.from("producto").select(CAMPOS_PRODUCTO).order("codigo"),
    supabase.from("producto_servicio").select(CAMPOS_SERVICIO),
    supabase.from("producto_componente").select("producto_id,componente_producto_id"),
    supabase.from("codigo_externo").select("producto_id,agencia,codigo,nombre_externo"),
  ]);

  const filasProducto = verificar(productos) as any[];
  const serviciosPorProducto = agruparPor((verificar(servicios) as any[]).map(aServicio), (s) => s.productoId);
  const componentesPorTour = agruparPor(verificar(componentes) as any[], (c) => c.producto_id);
  const codigosPorProducto = agruparPor(verificar(codigos) as any[], (c) => c.producto_id);

  // Un tour suma los servicios de sus paquetes (y de los tours que contiene).
  const memo = new Map<string, Servicio[]>();
  function serviciosConComponentes(id: string, visitados: Set<string>): Servicio[] {
    if (memo.has(id)) return memo.get(id)!;
    if (visitados.has(id)) return [];
    visitados.add(id);
    const propios = serviciosPorProducto.get(id) ?? [];
    const deComponentes = (componentesPorTour.get(id) ?? [])
      .filter((c) => c.componente_producto_id)
      .flatMap((c) => serviciosConComponentes(c.componente_producto_id, visitados));
    const todos = [...propios, ...deComponentes];
    memo.set(id, todos);
    return todos;
  }

  return filasProducto.map((fila) => {
    const todos = serviciosConComponentes(fila.id, new Set());
    return {
      ...aProducto(fila),
      esTour: componentesPorTour.has(fila.id),
      codigosExternos: (codigosPorProducto.get(fila.id) ?? []).map(aCodigoExterno),
      cantidadProveedores: proveedoresDeServicios(todos).size,
      cantidadPendientes: todos.filter(esPendiente).length,
    };
  });
}

export async function cargarProducto(supabase: SupabaseClient, id: string): Promise<DetalleProducto> {
  const [producto, servicios, componentes, codigos] = await Promise.all([
    supabase.from("producto").select(CAMPOS_PRODUCTO).eq("id", id).maybeSingle(),
    supabase.from("producto_servicio").select(CAMPOS_SERVICIO).eq("producto_id", id),
    supabase
      .from("producto_componente")
      .select(
        `orden,tipo,dia_desde,noches,nocturno,transfer_in,transfer_out,descripcion_ruta,comp:componente_producto_id(${CAMPOS_PRODUCTO})`,
      )
      .eq("producto_id", id)
      .order("orden"),
    supabase.from("codigo_externo").select("producto_id,agencia,codigo,nombre_externo").eq("producto_id", id),
  ]);

  const filaProducto = verificar(producto);
  if (!filaProducto) throw new Error("Producto no encontrado.");
  const filasComponente = verificar(componentes) as any[];

  const idsComponentes = filasComponente.map((c) => c.comp?.id).filter(Boolean) as string[];
  let serviciosDeComponentes = new Map<string, Servicio[]>();
  let toursEntreComponentes = new Set<string>();
  if (idsComponentes.length > 0) {
    const [svc, sub] = await Promise.all([
      supabase.from("producto_servicio").select(CAMPOS_SERVICIO).in("producto_id", idsComponentes),
      supabase.from("producto_componente").select("producto_id").in("producto_id", idsComponentes),
    ]);
    serviciosDeComponentes = agruparPor((verificar(svc) as any[]).map(aServicio), (s) => s.productoId);
    toursEntreComponentes = new Set((verificar(sub) as any[]).map((c) => c.producto_id));
  }

  const listaComponentes: ComponenteTour[] = filasComponente.map((c) => ({
    orden: c.orden,
    tipo: c.tipo,
    diaDesde: c.dia_desde ?? null,
    noches: c.noches ?? null,
    nocturno: c.nocturno ?? null,
    transferIn: Boolean(c.transfer_in),
    transferOut: Boolean(c.transfer_out),
    descripcionRuta: c.descripcion_ruta ?? null,
    producto: c.comp
      ? {
          ...aProducto(c.comp),
          esTour: toursEntreComponentes.has(c.comp.id),
          servicios: serviciosDeComponentes.get(c.comp.id) ?? [],
        }
      : null,
  }));

  return {
    ...aProducto(filaProducto),
    esTour: listaComponentes.length > 0,
    codigosExternos: (verificar(codigos) as any[]).map(aCodigoExterno),
    servicios: (verificar(servicios) as any[]).map(aServicio),
    componentes: listaComponentes,
  };
}

// === (c) Directorio ===================================================================

const CAMPOS_DIRECTORIO = "id,nombre,mails,canal,telefono,aclaraciones,ciudad";

function aFilaProveedor(fila: any): Omit<FilaDirectorio, "cantidadProductos"> {
  return {
    id: fila.id,
    nombre: fila.nombre,
    mails: fila.mails ?? [],
    canal: (fila.canal ?? null) as Canal,
    telefono: fila.telefono ?? null,
    aclaraciones: fila.aclaraciones ?? null,
    ciudad: fila.ciudad ?? null,
  };
}

export async function cargarDirectorio(supabase: SupabaseClient): Promise<FilaDirectorio[]> {
  const [proveedores, servicios] = await Promise.all([
    supabase.from("proveedor").select(CAMPOS_DIRECTORIO).order("nombre"),
    supabase.from("producto_servicio").select("producto_id,service_provider_id,booking_supplier_id"),
  ]);

  const productosPorProveedor = new Map<string, Set<string>>();
  for (const s of verificar(servicios) as any[]) {
    for (const proveedorId of [s.service_provider_id, s.booking_supplier_id]) {
      if (!proveedorId) continue;
      const set = productosPorProveedor.get(proveedorId) ?? new Set<string>();
      set.add(s.producto_id);
      productosPorProveedor.set(proveedorId, set);
    }
  }

  return (verificar(proveedores) as any[]).map((fila) => ({
    ...aFilaProveedor(fila),
    cantidadProductos: productosPorProveedor.get(fila.id)?.size ?? 0,
  }));
}

export async function cargarProveedor(supabase: SupabaseClient, id: string): Promise<DetalleProveedor> {
  const [proveedor, servicios] = await Promise.all([
    supabase.from("proveedor").select(CAMPOS_DIRECTORIO).eq("id", id).maybeSingle(),
    supabase
      .from("producto_servicio")
      .select("service_provider_id,booking_supplier_id,producto:producto_id(id,codigo,nombre)")
      .or(`service_provider_id.eq.${id},booking_supplier_id.eq.${id}`),
  ]);

  const fila = verificar(proveedor);
  if (!fila) throw new Error("Proveedor no encontrado.");

  const porProducto = new Map<string, DetalleProveedor["productos"][number]>();
  for (const s of verificar(servicios) as any[]) {
    const esBooking = s.booking_supplier_id === id;
    const esService = s.service_provider_id === id;
    const previo = porProducto.get(s.producto.id);
    const rolPrevio = previo?.rol;
    const rol =
      (esBooking && esService) ||
      (rolPrevio === "booking_supplier" && esService) ||
      (rolPrevio === "service_provider" && esBooking) ||
      rolPrevio === "ambos"
        ? "ambos"
        : esBooking
          ? "booking_supplier"
          : "service_provider";
    porProducto.set(s.producto.id, { id: s.producto.id, codigo: s.producto.codigo, nombre: s.producto.nombre, rol });
  }

  return {
    ...aFilaProveedor(fila),
    productos: [...porProducto.values()].sort((a, b) => a.codigo.localeCompare(b.codigo)),
  };
}

// === Pendientes (#18) =====================================================================

export async function cargarPendientes(supabase: SupabaseClient): Promise<Pendiente[]> {
  const respuesta = await supabase
    .from("producto_servicio")
    .select(`${CAMPOS_SERVICIO},producto:producto_id(id,codigo,nombre)`);
  const filas = verificar(respuesta) as any[];

  return filas
    .map((fila) => ({ fila, servicio: aServicio(fila) }))
    .filter(({ servicio }) => esPendiente(servicio))
    .map(({ fila, servicio }) => ({
      servicioId: servicio.id,
      producto: { id: fila.producto.id, codigo: fila.producto.codigo, nombre: fila.producto.nombre },
      servicio: servicio.descripcion ?? servicio.serviceProviderNombre ?? "",
      proveedorNombre: servicio.bookingSupplier?.nombre ?? servicio.bookingSupplierNombre,
      proveedorId: servicio.bookingSupplier?.id ?? null,
      motivo: estadoServicio(servicio).motivo ?? "",
      filaExcel: servicio.filaExcel,
    }))
    .sort((a, b) => a.producto.codigo.localeCompare(b.producto.codigo) || (a.filaExcel ?? 0) - (b.filaExcel ?? 0));
}
