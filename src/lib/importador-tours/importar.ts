import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENCIA_PROPIA } from "@/lib/importador-productos/importar";
import type { PaquetePiloto } from "@/lib/importador-productos/paquetes-piloto";
import { crearIndiceProveedores, resolverProveedor } from "@/lib/importador-productos/proveedores";
import { armarTour, type ComponenteArmado, type PaqueteConocido, type ServicioPropio, type TourArmado } from "./armado";
import { verificarCategorias, type CategoriaFaltante } from "./categorias";
import type { CategoriaTour, TramoConProveedor } from "./datos";
import { nochesBasePaquete } from "./noches-base";
import { leerTourRutas, type TourExcel } from "./rutas";
import { leerItinerario, type ItinerarioWord } from "./word";

/**
 * Carga de los 7 tours compuestos (spec M1-05): arma cada tour (`armado.ts`)
 * y lo guarda en `producto` (+ su código HI Travel en `codigo_externo`),
 * `producto_componente` (la secuencia, con noches, día de inicio y bus
 * nocturno) y `producto_servicio` (los buses que reserva un proveedor, como
 * servicio propio del tour). Registra la corrida en `importacion`.
 *
 * Recibe el cliente de Supabase ya creado con la service role (regla #2: la
 * clave la pone quien llama, desde variables de entorno).
 *
 * Idempotente (spec §3 #11): el tour se identifica por su código; los
 * componentes por (tour, orden) y los servicios propios por (tour, orden,
 * prioridad). Una segunda corrida no crea filas. Además:
 * - Un tour que quedó "para revisar" no toca lo que ya tenía cargado (nunca
 *   se reemplazan datos buenos por nada, como en M1-04). En la primera carga
 *   queda con 0 componentes.
 * - No toca los productos simples (los paquetes): solo los lee.
 * - Nunca crea proveedores.
 */

export const TIPO_CORRIDA_TOURS = "tours-compuestos";
/** Los 7 tours top-seller del MVP (spec M1-05 §1). */
export const TOURS_PILOTO = ["CHB31", "BOCHI04R", "ARCH31", "ARCH33", "AR09", "BRARCH26", "5C01"];

export interface DocumentoWord {
  archivo: string;
  parrafos: string[];
}

export interface ServicioPropioCargado extends ServicioPropio {
  bookingSupplierId: string | null;
  sinResolver: boolean;
  reservaManual: boolean;
}

export interface ResumenTour {
  codigo: string;
  nombre: string;
  noches: number | null;
  estado: "armado" | "para_revisar";
  motivos: string[];
  notas: string[];
  componentes: Array<ComponenteArmado & { nombreComponente: string | null }>;
  serviciosPropios: ServicioPropioCargado[];
  ciudades: string[];
  categorias: string[];
  categoriasFaltantes: CategoriaFaltante[];
  wordArchivo: string | null;
  filaRutas: number | null;
  /** Columnas de RutasenBus sin código (sus buses), para contrastar con el Word. */
  columnasSinCodigo: Array<{ columna: string; encabezado: string }>;
  /** Días del itinerario que el Word no escribe como "DAY N:". */
  diasSinEncabezado: number[];
}

export interface ResumenImportacionTours {
  importacionId: string;
  tours: ResumenTour[];
  nochesBase: Record<string, number | null>;
  creados: { productos: number; componentes: number; servicios: number; codigos: number };
  actualizados: { productos: number; componentes: number; servicios: number };
  eliminados: { componentes: number; servicios: number };
  filasParaRevisar: number;
}

const CAMPOS_COMPONENTE = [
  "tipo",
  "componente_producto_id",
  "descripcion_ruta",
  "transfer_in",
  "transfer_out",
  "noches",
  "dia_desde",
  "nocturno",
] as const;
const CAMPOS_SERVICIO = [
  "tipo_servicio",
  "nivel",
  "fila_excel",
  "descripcion",
  "service_provider_nombre",
  "booking_supplier_nombre",
  "service_provider_id",
  "booking_supplier_id",
  "proveedor_sin_resolver",
  "proveedor_para_revisar",
  "proveedor_nota",
  "opcional",
  "reserva_manual",
] as const;

type Fila = Record<string, unknown>;

function iguales(a: Fila, b: Fila, campos: readonly string[]): boolean {
  return campos.every((c) => (a[c] ?? null) === (b[c] ?? null));
}

function diasFaltantes(word: ItinerarioWord | null): number[] {
  if (!word || word.dias.length === 0) return [];
  const hay = new Set(word.dias.map((d) => d.numero));
  const ultimo = Math.max(...hay);
  return Array.from({ length: ultimo }, (_, k) => k + 1).filter((n) => !hay.has(n));
}

/** Arma primero los tours que otros incluyen (CHB31 antes que 5C01). */
function ordenarPorAnidado(codigos: string[], excel: Map<string, TourExcel | null>): string[] {
  const pendientes = [...codigos];
  const orden: string[] = [];
  while (pendientes.length) {
    const listo = pendientes.findIndex((c) =>
      (excel.get(c)?.componentes ?? []).every((x) => !pendientes.includes(x.codigo) || x.codigo === c),
    );
    // Un ciclo (no debería pasar) se arma igual y queda para revisar.
    const [codigo] = pendientes.splice(listo === -1 ? 0 : listo, 1);
    orden.push(codigo);
  }
  return orden;
}

export async function importarToursCompuestos(opciones: {
  admin: SupabaseClient;
  filasRutas: string[][];
  words: DocumentoWord[];
  filasPaquetes: string[][];
  paquetesPiloto: PaquetePiloto[];
  tramosConProveedor: TramoConProveedor[];
  categoriasTour: CategoriaTour[];
  archivos: { rutas: string; paquetes: string };
  tours?: string[];
}): Promise<ResumenImportacionTours> {
  const { admin } = opciones;
  const codigosTour = opciones.tours ?? TOURS_PILOTO;
  const ahora = new Date().toISOString();

  // --- paquetes cargados (M1-04 / M1-04d): solo se leen ---
  const nochesBase: Record<string, number | null> = {};
  for (const p of opciones.paquetesPiloto) nochesBase[p.codigo] = nochesBasePaquete(opciones.filasPaquetes, p.codigo);
  const { data: productos, error: errorProductos } = await admin
    .from("producto")
    .select("id, codigo, nombre")
    .in("codigo", [...opciones.paquetesPiloto.map((p) => p.codigo), ...codigosTour]);
  if (errorProductos) throw new Error(`No se pudo leer producto: ${errorProductos.message}`);
  const productoPorCodigo = new Map((productos ?? []).map((p) => [p.codigo as string, p as { id: string; nombre: string }]));
  const paquetes = new Map<string, PaqueteConocido>();
  for (const p of opciones.paquetesPiloto) {
    const cargado = productoPorCodigo.get(p.codigo);
    if (cargado) paquetes.set(p.codigo, { ...p, nochesBase: nochesBase[p.codigo], nombre: cargado.nombre });
  }

  // --- armado (puro) ---
  const excelPorTour = new Map(codigosTour.map((c) => [c, leerTourRutas(opciones.filasRutas, c)]));
  const wordPorTour = new Map<string, { word: ItinerarioWord; archivo: string } | null>();
  for (const c of codigosTour) {
    let encontrado: { word: ItinerarioWord; archivo: string } | null = null;
    for (const doc of opciones.words) {
      const word = leerItinerario(doc.parrafos, c);
      if (word) {
        encontrado = { word, archivo: doc.archivo };
        break;
      }
    }
    wordPorTour.set(c, encontrado);
  }
  const armados = new Map<string, TourArmado>();
  for (const codigo of ordenarPorAnidado(codigosTour, excelPorTour)) {
    armados.set(
      codigo,
      armarTour({
        codigo,
        excel: excelPorTour.get(codigo) ?? null,
        word: wordPorTour.get(codigo)?.word ?? null,
        paquetes,
        codigosTour: new Set(codigosTour),
        tours: armados,
        tramosConProveedor: opciones.tramosConProveedor,
      }),
    );
  }

  // --- proveedores (para los buses con proveedor): solo se leen ---
  const { data: proveedores, error: errorProveedores } = await admin
    .from("proveedor")
    .select("id, nombre_normalizado, ciudad, mails, canal, telefono")
    .range(0, 9999);
  if (errorProveedores) throw new Error(`No se pudo leer proveedor: ${errorProveedores.message}`);
  const { data: alias, error: errorAlias } = await admin
    .from("proveedor_alias")
    .select("destino, alias_normalizado, proveedor_id, modo, estado, nota")
    .range(0, 9999);
  if (errorAlias) throw new Error(`No se pudo leer proveedor_alias: ${errorAlias.message}`);
  const indice = crearIndiceProveedores(proveedores ?? [], alias ?? []);

  // --- niveles de alojamiento de cada paquete (para las categorías) ---
  const idsPaquetes = [...paquetes.keys()].map((c) => productoPorCodigo.get(c)!.id);
  const { data: niveles, error: errorNiveles } = await admin
    .from("producto_servicio")
    .select("producto_id, nivel")
    .in("producto_id", idsPaquetes)
    .eq("tipo_servicio", "alojamiento")
    .not("nivel", "is", null);
  if (errorNiveles) throw new Error(`No se pudo leer los niveles: ${errorNiveles.message}`);
  const nivelesPorId = new Map<string, Set<string>>();
  for (const n of niveles ?? []) {
    nivelesPorId.set(n.producto_id, (nivelesPorId.get(n.producto_id) ?? new Set()).add(n.nivel as string));
  }

  const creados = { productos: 0, componentes: 0, servicios: 0, codigos: 0 };
  const actualizados = { productos: 0, componentes: 0, servicios: 0 };
  const eliminados = { componentes: 0, servicios: 0 };

  // --- 1. el producto de cada tour (también los que quedan para revisar) ---
  for (const codigo of codigosTour) {
    const t = armados.get(codigo)!;
    const existente = productoPorCodigo.get(codigo);
    const datos: Fila = { nombre: t.nombre };
    if (t.estado === "armado") datos.ciudades = t.ciudades;
    if (!existente) {
      const { data, error } = await admin
        .from("producto")
        .insert({ codigo, ...datos, ciudades: t.estado === "armado" ? t.ciudades : [] })
        .select("id, nombre")
        .single();
      if (error) throw new Error(`No se pudo insertar el tour ${codigo}: ${error.message}`);
      productoPorCodigo.set(codigo, data);
      creados.productos++;
    } else {
      const { data: actual, error } = await admin.from("producto").select("nombre, ciudades").eq("id", existente.id).single();
      if (error) throw new Error(`No se pudo leer el tour ${codigo}: ${error.message}`);
      const mismas = JSON.stringify(actual.ciudades ?? []) === JSON.stringify(datos.ciudades ?? actual.ciudades ?? []);
      if (actual.nombre !== datos.nombre || !mismas) {
        const { error: e } = await admin.from("producto").update({ ...datos, updated_at: ahora }).eq("id", existente.id);
        if (e) throw new Error(`No se pudo actualizar el tour ${codigo}: ${e.message}`);
        actualizados.productos++;
      }
    }
    const productoId = productoPorCodigo.get(codigo)!.id;
    const { data: ce, error: errorCe } = await admin
      .from("codigo_externo")
      .select("id, producto_id")
      .eq("agencia", AGENCIA_PROPIA)
      .eq("codigo", codigo)
      .maybeSingle();
    if (errorCe) throw new Error(`No se pudo leer codigo_externo: ${errorCe.message}`);
    if (!ce) {
      const { error: e } = await admin.from("codigo_externo").insert({ producto_id: productoId, agencia: AGENCIA_PROPIA, codigo });
      if (e) throw new Error(`No se pudo insertar el código de ${codigo}: ${e.message}`);
      creados.codigos++;
    } else if (ce.producto_id !== productoId) {
      throw new Error(`El código ${codigo} (HI Travel) ya apunta a otro producto: revisalo a mano.`);
    }
  }

  // --- 2. componentes y servicios propios de los tours armados ---
  const resumenes: ResumenTour[] = [];
  for (const codigo of codigosTour) {
    const t = armados.get(codigo)!;
    const productoId = productoPorCodigo.get(codigo)!.id;
    const excel = excelPorTour.get(codigo) ?? null;
    const resumen: ResumenTour = {
      codigo,
      nombre: t.nombre,
      noches: t.noches,
      estado: t.estado,
      motivos: t.estado === "para_revisar" ? t.motivos : [],
      notas: t.notas,
      componentes: [],
      serviciosPropios: [],
      ciudades: t.estado === "armado" ? t.ciudades : [],
      categorias: excel?.categorias ?? [],
      categoriasFaltantes: [],
      wordArchivo: wordPorTour.get(codigo)?.archivo ?? null,
      filaRutas: excel?.fila ?? null,
      columnasSinCodigo: excel?.columnasSinCodigo ?? [],
      diasSinEncabezado: diasFaltantes(wordPorTour.get(codigo)?.word ?? null),
    };
    resumenes.push(resumen);
    if (t.estado !== "armado") continue;

    // componentes (identidad: tour + orden)
    const { data: actuales, error } = await admin
      .from("producto_componente")
      .select(`id, orden, ${CAMPOS_COMPONENTE.join(", ")}`)
      .eq("producto_id", productoId);
    if (error) throw new Error(`No se pudo leer los componentes de ${codigo}: ${error.message}`);
    const porOrden = new Map(((actuales ?? []) as unknown as Fila[]).map((f) => [f.orden as number, f]));
    for (const c of t.componentes) {
      const fila: Fila = {
        tipo: c.tipo,
        componente_producto_id: c.codigo ? productoPorCodigo.get(c.codigo)!.id : null,
        descripcion_ruta: c.descripcionRuta,
        transfer_in: c.transferIn,
        transfer_out: c.transferOut,
        noches: c.noches,
        dia_desde: c.diaDesde,
        nocturno: c.nocturno,
      };
      const actual = porOrden.get(c.orden);
      porOrden.delete(c.orden);
      if (!actual) {
        const { error: e } = await admin.from("producto_componente").insert({ producto_id: productoId, orden: c.orden, ...fila });
        if (e) throw new Error(`No se pudo insertar el componente ${c.orden} de ${codigo}: ${e.message}`);
        creados.componentes++;
      } else if (!iguales(fila, actual, CAMPOS_COMPONENTE)) {
        const { error: e } = await admin
          .from("producto_componente")
          .update({ ...fila, updated_at: ahora })
          .eq("id", actual.id as string);
        if (e) throw new Error(`No se pudo actualizar el componente ${c.orden} de ${codigo}: ${e.message}`);
        actualizados.componentes++;
      }
      resumen.componentes.push({ ...c, nombreComponente: c.codigo ? productoPorCodigo.get(c.codigo)!.nombre : null });
    }
    const sobrantes = [...porOrden.values()].map((f) => f.id as string);
    if (sobrantes.length) {
      const { error: e } = await admin.from("producto_componente").delete().in("id", sobrantes);
      if (e) throw new Error(`No se pudieron borrar componentes viejos de ${codigo}: ${e.message}`);
      eliminados.componentes += sobrantes.length;
    }

    // servicios propios (identidad: tour + orden + prioridad)
    const { data: servicios, error: errorServicios } = await admin
      .from("producto_servicio")
      .select(`id, orden, prioridad, ${CAMPOS_SERVICIO.join(", ")}`)
      .eq("producto_id", productoId)
      .not("orden", "is", null);
    if (errorServicios) throw new Error(`No se pudo leer los servicios de ${codigo}: ${errorServicios.message}`);
    const porClave = new Map(((servicios ?? []) as unknown as Fila[]).map((f) => [`${f.orden}:${f.prioridad}`, f]));
    for (const [k, s] of t.serviciosPropios.entries()) {
      const bs = resolverProveedor(s.bookingSupplier, indice, { destino: s.desde });
      const fila: Fila = {
        tipo_servicio: "bus",
        nivel: null,
        fila_excel: null,
        descripcion: `Bus ${s.sentido} (${s.nocturno ? "nocturno" : "diurno"}, sale el día ${s.diaDesde} del tour). Booking Supplier: ${s.bookingSupplier}`,
        service_provider_nombre: s.ruta,
        booking_supplier_nombre: s.bookingSupplier,
        service_provider_id: null,
        booking_supplier_id: bs.id,
        proveedor_sin_resolver: bs.id === null && !bs.manual,
        proveedor_para_revisar: bs.paraRevisar,
        proveedor_nota: bs.nota,
        opcional: false,
        reserva_manual: bs.manual === true,
      };
      const clave = `${k + 1}:1`;
      const actual = porClave.get(clave);
      porClave.delete(clave);
      if (!actual) {
        const { error: e } = await admin
          .from("producto_servicio")
          .insert({ producto_id: productoId, orden: k + 1, prioridad: 1, ...fila });
        if (e) throw new Error(`No se pudo insertar el servicio ${s.ruta} de ${codigo}: ${e.message}`);
        creados.servicios++;
      } else if (!iguales(fila, actual, CAMPOS_SERVICIO)) {
        const { error: e } = await admin
          .from("producto_servicio")
          .update({ ...fila, updated_at: ahora })
          .eq("id", actual.id as string);
        if (e) throw new Error(`No se pudo actualizar el servicio ${s.ruta} de ${codigo}: ${e.message}`);
        actualizados.servicios++;
      }
      resumen.serviciosPropios.push({
        ...s,
        bookingSupplierId: bs.id,
        sinResolver: fila.proveedor_sin_resolver as boolean,
        reservaManual: bs.manual === true,
      });
    }
    const sobrantesServicio = [...porClave.values()].map((f) => f.id as string);
    if (sobrantesServicio.length) {
      const { error: e } = await admin.from("producto_servicio").delete().in("id", sobrantesServicio);
      if (e) throw new Error(`No se pudieron borrar servicios viejos de ${codigo}: ${e.message}`);
      eliminados.servicios += sobrantesServicio.length;
    }

    // categorías tour ↔ paquete (se informan; el tour se carga igual)
    resumen.categoriasFaltantes = verificarCategorias(
      codigo,
      resumen.categorias,
      t.componentes
        .filter((c) => c.tipo === "paquete")
        .map((c) => ({
          codigo: c.codigo!,
          categorias: c.esTour
            ? (excelPorTour.get(c.codigo!)?.categorias ?? [])
            : [...(nivelesPorId.get(productoPorCodigo.get(c.codigo!)!.id) ?? [])],
        })),
      opciones.categoriasTour,
    );
  }

  const filasParaRevisar =
    resumenes.filter((r) => r.estado === "para_revisar").length +
    resumenes.reduce((n, r) => n + r.categoriasFaltantes.length + r.serviciosPropios.filter((s) => s.sinResolver).length, 0);

  const { data: importacion, error: errorImportacion } = await admin
    .from("importacion")
    .insert({
      archivo: opciones.archivos.rutas,
      tipo_corrida: TIPO_CORRIDA_TOURS,
      filas_cargadas: creados.productos + creados.componentes + creados.servicios + creados.codigos,
      filas_para_revisar: filasParaRevisar,
      detalle: {
        archivos: { rutas: opciones.archivos.rutas, paquetes: opciones.archivos.paquetes, words: opciones.words.map((w) => w.archivo) },
        tours: resumenes.map((r) => ({
          codigo: r.codigo,
          estado: r.estado,
          noches: r.noches,
          motivos: r.motivos,
          notas: r.notas,
          componentes: r.componentes.map((c) => ({
            orden: c.orden,
            tipo: c.tipo,
            codigo: c.codigo,
            ruta: c.descripcionRuta,
            noches: c.noches,
            dia_desde: c.diaDesde,
            nocturno: c.nocturno,
            transfer_in: c.transferIn,
            transfer_out: c.transferOut,
          })),
          servicios_propios: r.serviciosPropios.map((s) => ({ ruta: s.sentido, booking_supplier: s.bookingSupplier, dia: s.diaDesde, nocturno: s.nocturno, sin_resolver: s.sinResolver })),
          categorias: r.categorias,
          categorias_faltantes: r.categoriasFaltantes,
        })),
        noches_base: nochesBase,
        creados,
        actualizados,
        eliminados,
      },
    })
    .select("id")
    .single();
  if (errorImportacion) throw new Error(`No se pudo registrar la importación: ${errorImportacion.message}`);

  return { importacionId: importacion.id, tours: resumenes, nochesBase, creados, actualizados, eliminados, filasParaRevisar };
}
