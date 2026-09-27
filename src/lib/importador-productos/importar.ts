import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import type { CorreccionAplicada, LineaDudosa } from "./bloque";
import { leerCodigosTourRadar } from "./codigos-tourradar";
import { planificarProductos, type InterpretarBloque, type NivelParaRevisar } from "./plan";
import { armarFilasServicio, crearIndiceProveedores, type FilaServicio } from "./proveedores";

/**
 * Importador de productos simples (spec M1-04): lee el bloque de Iguazú de la
 * hoja "Analisis a Mayo 2026" (SheetJS, del lado del servidor) y los códigos
 * TourRadar, y carga `producto`, `producto_servicio` y `codigo_externo`;
 * registra la corrida en `importacion`.
 *
 * Recibe el cliente de Supabase ya creado con la service role (regla #2: la
 * clave sale de variables de entorno en quien lo llama, nunca de acá).
 *
 * Re-ejecutable (spec §3 #12): la identidad es el código de producto; los
 * servicios se identifican por (producto, orden, prioridad) y los códigos
 * externos por (agencia, código). Una segunda corrida sobre el mismo archivo
 * no crea filas. Además:
 * - Si un bloque no se pudo interpretar ("para revisar"), sus servicios ya
 *   cargados NO se tocan (nunca se reemplazan datos buenos por nada).
 * - Un proveedor resuelto a mano (M1-06) no se pisa mientras el Excel siga
 *   escribiendo el mismo nombre que el importador no sabe emparejar.
 * - Nunca inserta en `proveedor` (spec §3 #7).
 */

export const HOJA_PAQUETES = "Analisis a Mayo 2026";
export const TIPO_CORRIDA = "productos-simples";
export const DESTINO_PILOTO = "IGR";
export const CODIGOS_PILOTO = ["OD010A", "OD010B", "OD010C", "OD010D", "OD011"];
export const AGENCIA_PROPIA = "HI Travel";
/** Partners que usan nuestros mismos códigos (confirmado por el owner, 2026-09-27). */
export const AGENCIAS_CON_NUESTRO_CODIGO = ["Kilroy"];
export const AGENCIA_TOURRADAR = "TourRadar";

export interface EstadisticasIA {
  llamadas: number;
  cortadasPorTecho: number;
  errores: number;
}

export interface ProveedorSinResolver {
  codigo: string;
  fila_excel: number | null;
  orden: number;
  prioridad: number;
  rol: "service_provider" | "booking_supplier";
  /** Nombre tal como lo escribe el Excel; null = el Excel no lo escribe. */
  nombre: string | null;
}

export interface ResumenProducto {
  codigo: string;
  nombre: string;
  origen: "reglas" | "ia" | "reglas+ia";
  bloqueParaRevisar: boolean;
  /** Servicios distintos (las opciones "/" de un servicio cuentan una vez). */
  servicios: number;
  /** Filas de producto_servicio (una por opción). */
  opciones: number;
  nivelesCargados: string[];
  nivelesNoOfrecidos: string[];
  nivelesParaRevisar: NivelParaRevisar[];
  lineasParaRevisar: LineaDudosa[];
  correcciones: CorreccionAplicada[];
}

export interface ResumenImportacionProductos {
  archivo: string;
  importacionId: string;
  destinoEncontrado: boolean;
  productos: ResumenProducto[];
  codigosNoEncontrados: string[];
  creados: { productos: number; servicios: number; codigos: number };
  productosActualizados: number;
  servicios: { creados: number; actualizados: number; sinCambios: number; eliminados: number };
  codigosExternos: { creados: number; actualizados: number; sinCambios: number };
  proveedoresSinResolver: ProveedorSinResolver[];
  /** Nombres distintos del Excel que no matchearon ningún proveedor, tal cual. */
  nombresSinResolver: string[];
  codigosTourRadarSinProducto: Array<{ codigo: string; nombre: string; nuestroCodigo: string }>;
  bloquesQueNecesitanIA: string[];
  lineasDescartadasPorIA: Array<{ codigo: string; fila: number; texto: string }>;
  filasParaRevisar: number;
  ia: EstadisticasIA & { configurada: boolean };
}

type FilaServicioDB = FilaServicio & { id: string };

const CAMPOS_SERVICIO: Array<keyof FilaServicio> = [
  "orden",
  "prioridad",
  "tipo_servicio",
  "nivel",
  "fila_excel",
  "descripcion",
  "service_provider_nombre",
  "booking_supplier_nombre",
  "service_provider_id",
  "booking_supplier_id",
  "proveedor_sin_resolver",
];

function leerHoja(ruta: string, hoja: string | null): unknown[][] {
  const libro = XLSX.read(readFileSync(ruta), { type: "buffer" });
  const nombre = hoja ?? libro.SheetNames[0];
  const datos = libro.Sheets[nombre];
  if (!datos) throw new Error(`El archivo ${basename(ruta)} no tiene la hoja "${nombre}".`);
  return XLSX.utils.sheet_to_json<unknown[]>(datos, { header: 1, defval: "", raw: false });
}

export function leerFilasPaquetes(ruta: string): string[][] {
  return leerHoja(ruta, HOJA_PAQUETES).map((f) => f.map((c) => String(c ?? "")));
}

/** Conserva un proveedor puesto a mano si el Excel sigue diciendo lo mismo y el importador no lo sabe resolver. */
function conservarResolucionManual(nueva: FilaServicio, existente: FilaServicioDB | undefined): FilaServicio {
  if (!existente) return nueva;
  const fila = { ...nueva };
  if (
    fila.service_provider_id === null &&
    existente.service_provider_id !== null &&
    existente.service_provider_nombre === fila.service_provider_nombre
  ) {
    fila.service_provider_id = existente.service_provider_id;
  }
  if (
    fila.booking_supplier_id === null &&
    existente.booking_supplier_id !== null &&
    existente.booking_supplier_nombre === fila.booking_supplier_nombre
  ) {
    fila.booking_supplier_id = existente.booking_supplier_id;
  }
  fila.proveedor_sin_resolver = fila.service_provider_id === null || fila.booking_supplier_id === null;
  return fila;
}

function mismaFila(a: FilaServicio, b: FilaServicio): boolean {
  return CAMPOS_SERVICIO.every((campo) => (a[campo] ?? null) === (b[campo] ?? null));
}

export async function importarProductosSimples(opciones: {
  admin: SupabaseClient;
  rutaPaquetes: string;
  /** null = no cargar códigos TourRadar en esta corrida. */
  rutaCodigosTourRadar: string | null;
  interpretarIA: InterpretarBloque | null;
  estadisticasIA?: () => EstadisticasIA;
  destino?: string;
  codigos?: string[];
}): Promise<ResumenImportacionProductos> {
  const { admin } = opciones;
  const destino = opciones.destino ?? DESTINO_PILOTO;
  const codigos = opciones.codigos ?? CODIGOS_PILOTO;

  const plan = await planificarProductos({
    filas: leerFilasPaquetes(opciones.rutaPaquetes),
    destino,
    codigos,
    interpretarIA: opciones.interpretarIA,
  });
  const codigosTR = opciones.rutaCodigosTourRadar
    ? leerCodigosTourRadar(leerHoja(opciones.rutaCodigosTourRadar, null))
    : [];

  // Directorio de proveedores (M1-03) para el emparejado. Solo se lee.
  const { data: proveedores, error: errorProveedores } = await admin
    .from("proveedor")
    .select("id, nombre_normalizado")
    .range(0, 9999);
  if (errorProveedores) throw new Error(`No se pudo leer proveedor: ${errorProveedores.message}`);
  const indice = crearIndiceProveedores(proveedores ?? []);

  const ahora = new Date().toISOString();
  const creados = { productos: 0, servicios: 0, codigos: 0 };
  let productosActualizados = 0;
  const servicios = { creados: 0, actualizados: 0, sinCambios: 0, eliminados: 0 };
  const codigosExternos = { creados: 0, actualizados: 0, sinCambios: 0 };
  const proveedoresSinResolver: ProveedorSinResolver[] = [];
  const resumenProductos: ResumenProducto[] = [];
  const idPorCodigo = new Map<string, string>();

  async function guardarCodigoExterno(productoId: string, agencia: string, codigo: string, nombre: string | null) {
    const { data, error } = await admin
      .from("codigo_externo")
      .select("id, producto_id, nombre_externo")
      .eq("agencia", agencia)
      .eq("codigo", codigo)
      .maybeSingle();
    if (error) throw new Error(`No se pudo leer codigo_externo: ${error.message}`);
    if (!data) {
      const { error: e } = await admin
        .from("codigo_externo")
        .insert({ producto_id: productoId, agencia, codigo, nombre_externo: nombre });
      if (e) throw new Error(`No se pudo insertar codigo_externo ${agencia} ${codigo}: ${e.message}`);
      codigosExternos.creados++;
    } else if (data.producto_id !== productoId || (data.nombre_externo ?? null) !== nombre) {
      const { error: e } = await admin
        .from("codigo_externo")
        .update({ producto_id: productoId, nombre_externo: nombre, updated_at: ahora })
        .eq("id", data.id);
      if (e) throw new Error(`No se pudo actualizar codigo_externo ${agencia} ${codigo}: ${e.message}`);
      codigosExternos.actualizados++;
    } else {
      codigosExternos.sinCambios++;
    }
  }

  for (const producto of plan.productos) {
    // --- producto (identidad: código) ---
    const { data: existente, error: errorLectura } = await admin
      .from("producto")
      .select("id")
      .eq("codigo", producto.codigo)
      .maybeSingle();
    if (errorLectura) throw new Error(`No se pudo leer producto: ${errorLectura.message}`);
    const datosProducto = { nombre: producto.nombre, destino: producto.destino, ciudades: producto.ciudades };
    let productoId: string;
    if (existente) {
      productoId = existente.id;
      const { error } = await admin
        .from("producto")
        .update({ ...datosProducto, updated_at: ahora })
        .eq("id", productoId);
      if (error) throw new Error(`No se pudo actualizar el producto ${producto.codigo}: ${error.message}`);
      productosActualizados++;
    } else {
      const { data, error } = await admin
        .from("producto")
        .insert({ codigo: producto.codigo, ...datosProducto })
        .select("id")
        .single();
      if (error) throw new Error(`No se pudo insertar el producto ${producto.codigo}: ${error.message}`);
      productoId = data.id;
      creados.productos++;
    }
    idPorCodigo.set(producto.codigo, productoId);

    // --- servicios (identidad: producto + orden + prioridad) ---
    let filas: FilaServicio[] = [];
    if (!producto.bloqueParaRevisar) {
      const { data: actuales, error } = await admin
        .from("producto_servicio")
        .select(`id, ${CAMPOS_SERVICIO.join(", ")}`)
        .eq("producto_id", productoId)
        .not("orden", "is", null);
      if (error) throw new Error(`No se pudo leer producto_servicio: ${error.message}`);
      const porClave = new Map(
        ((actuales ?? []) as unknown as FilaServicioDB[]).map((f) => [`${f.orden}:${f.prioridad}`, f]),
      );

      filas = armarFilasServicio(producto.servicios, indice).map((f) =>
        conservarResolucionManual(f, porClave.get(`${f.orden}:${f.prioridad}`)),
      );
      for (const fila of filas) {
        const clave = `${fila.orden}:${fila.prioridad}`;
        const actual = porClave.get(clave);
        porClave.delete(clave);
        if (!actual) {
          const { error: e } = await admin.from("producto_servicio").insert({ producto_id: productoId, ...fila });
          if (e) throw new Error(`No se pudo insertar un servicio de ${producto.codigo}: ${e.message}`);
          servicios.creados++;
        } else if (!mismaFila(fila, actual)) {
          const { error: e } = await admin
            .from("producto_servicio")
            .update({ ...fila, updated_at: ahora })
            .eq("id", actual.id);
          if (e) throw new Error(`No se pudo actualizar un servicio de ${producto.codigo}: ${e.message}`);
          servicios.actualizados++;
        } else {
          servicios.sinCambios++;
        }
      }
      // Servicios que el Excel ya no trae (solo los que cargó este importador: `orden` no nulo).
      const sobrantes = [...porClave.values()].map((f) => f.id);
      if (sobrantes.length) {
        const { error: e } = await admin.from("producto_servicio").delete().in("id", sobrantes);
        if (e) throw new Error(`No se pudieron borrar servicios viejos de ${producto.codigo}: ${e.message}`);
        servicios.eliminados += sobrantes.length;
      }

      for (const f of filas) {
        if (f.service_provider_id === null) {
          proveedoresSinResolver.push({
            codigo: producto.codigo,
            fila_excel: f.fila_excel,
            orden: f.orden,
            prioridad: f.prioridad,
            rol: "service_provider",
            nombre: f.service_provider_nombre,
          });
        }
        if (f.booking_supplier_id === null) {
          proveedoresSinResolver.push({
            codigo: producto.codigo,
            fila_excel: f.fila_excel,
            orden: f.orden,
            prioridad: f.prioridad,
            rol: "booking_supplier",
            nombre: f.booking_supplier_nombre,
          });
        }
      }
    }

    // --- códigos externos: el propio y los partners que usan nuestro código ---
    for (const agencia of [AGENCIA_PROPIA, ...AGENCIAS_CON_NUESTRO_CODIGO]) {
      await guardarCodigoExterno(productoId, agencia, producto.codigo, null);
    }

    resumenProductos.push({
      codigo: producto.codigo,
      nombre: producto.nombre,
      origen: producto.origen,
      bloqueParaRevisar: producto.bloqueParaRevisar,
      servicios: new Set(filas.map((f) => f.orden)).size,
      opciones: filas.length,
      nivelesCargados: [...new Set(filas.map((f) => f.nivel).filter((n): n is string => n !== null))],
      nivelesNoOfrecidos: producto.nivelesNoOfrecidos,
      nivelesParaRevisar: producto.nivelesParaRevisar,
      lineasParaRevisar: producto.lineasParaRevisar,
      correcciones: producto.correcciones,
    });
  }

  // --- códigos TourRadar (del archivo aparte), con su nombre tal cual ---
  const codigosTourRadarSinProducto: ResumenImportacionProductos["codigosTourRadarSinProducto"] = [];
  if (codigosTR.length) {
    const faltantes = [...new Set(codigosTR.map((c) => c.nuestroCodigo))].filter((c) => !idPorCodigo.has(c));
    if (faltantes.length) {
      const { data, error } = await admin.from("producto").select("id, codigo").in("codigo", faltantes);
      if (error) throw new Error(`No se pudo leer producto: ${error.message}`);
      for (const p of data ?? []) idPorCodigo.set(p.codigo, p.id);
    }
    for (const c of codigosTR) {
      const productoId = idPorCodigo.get(c.nuestroCodigo);
      if (!productoId) {
        codigosTourRadarSinProducto.push(c); // se reporta, no se inventa el producto
        continue;
      }
      await guardarCodigoExterno(productoId, AGENCIA_TOURRADAR, c.codigo, c.nombre);
    }
  }
  creados.servicios = servicios.creados;
  creados.codigos = codigosExternos.creados;

  const nombresSinResolver = [
    ...new Set(proveedoresSinResolver.map((p) => p.nombre).filter((n): n is string => n !== null)),
  ].sort((a, b) => a.localeCompare(b));
  const serviciosSinResolver = new Set(proveedoresSinResolver.map((p) => `${p.codigo}:${p.orden}:${p.prioridad}`)).size;
  const filasParaRevisar =
    serviciosSinResolver +
    resumenProductos.reduce(
      (n, p) => n + p.lineasParaRevisar.length + p.nivelesParaRevisar.length + (p.bloqueParaRevisar ? 1 : 0),
      0,
    ) +
    codigosTourRadarSinProducto.length;

  const ia = {
    configurada: opciones.interpretarIA !== null,
    ...(opciones.estadisticasIA?.() ?? { llamadas: 0, cortadasPorTecho: 0, errores: 0 }),
  };
  const archivo = basename(opciones.rutaPaquetes);

  const { data: importacion, error: errorImportacion } = await admin
    .from("importacion")
    .insert({
      archivo,
      tipo_corrida: TIPO_CORRIDA,
      filas_cargadas: creados.productos + creados.servicios + creados.codigos,
      filas_para_revisar: filasParaRevisar,
      detalle: {
        hoja: HOJA_PAQUETES,
        destino,
        codigos_pedidos: codigos,
        archivo_codigos_tourradar: opciones.rutaCodigosTourRadar ? basename(opciones.rutaCodigosTourRadar) : null,
        destino_encontrado: plan.destinoEncontrado,
        codigos_no_encontrados: plan.codigosNoEncontrados,
        productos: { procesados: plan.productos.length, creados: creados.productos, actualizados: productosActualizados },
        servicios: {
          creados: servicios.creados,
          actualizados: servicios.actualizados,
          sin_cambios: servicios.sinCambios,
          eliminados: servicios.eliminados,
        },
        codigos_externos: {
          creados: codigosExternos.creados,
          actualizados: codigosExternos.actualizados,
          sin_cambios: codigosExternos.sinCambios,
        },
        por_producto: resumenProductos,
        proveedores_sin_resolver: proveedoresSinResolver,
        nombres_sin_resolver: nombresSinResolver,
        codigos_tourradar_sin_producto: codigosTourRadarSinProducto,
        bloques_que_necesitan_ia: plan.bloquesQueNecesitanIA,
        lineas_descartadas_por_ia: plan.lineasDescartadasPorIA,
        ia,
      },
    })
    .select("id")
    .single();
  if (errorImportacion) {
    throw new Error(`No se pudo registrar la importación: ${errorImportacion.message}`);
  }

  return {
    archivo,
    importacionId: importacion.id,
    destinoEncontrado: plan.destinoEncontrado,
    productos: resumenProductos,
    codigosNoEncontrados: plan.codigosNoEncontrados,
    creados,
    productosActualizados,
    servicios,
    codigosExternos,
    proveedoresSinResolver,
    nombresSinResolver,
    codigosTourRadarSinProducto,
    bloquesQueNecesitanIA: plan.bloquesQueNecesitanIA,
    lineasDescartadasPorIA: plan.lineasDescartadasPorIA,
    filasParaRevisar,
    ia,
  };
}
