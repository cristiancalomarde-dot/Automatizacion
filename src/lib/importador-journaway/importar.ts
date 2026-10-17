import type { SupabaseClient } from "@supabase/supabase-js";
import { crearIndiceProveedores } from "@/lib/importador-productos/proveedores";
import { AGENCIA_JOURNAWAY } from "@/lib/catalogo/reglas";
import type { InsumosJournaway } from "./insumos";
import { planificarJournaway, verificarOtroCatalogo, type PlanJournaway, type ProductoJournaway, type ServicioJournaway } from "./plan";

/**
 * Carga del catálogo de Journaway (spec M2-08 §3 #2-#10): escribe el plan en
 * `producto`, `producto_servicio`, `producto_servicio_noches`,
 * `producto_componente`, `tour_servicio_ajuste` y `codigo_externo` (agencia
 * "Journaway"), y registra la corrida en `importacion`.
 *
 * Recibe el cliente de Supabase ya creado con la service role (regla #2: la
 * clave la pone quien llama, desde variables de entorno). No usa IA (#3) y no
 * le escribe a nadie (#4).
 *
 * - Todo se valida antes de escribir: la planilla, los archivos de `data/`, y
 *   que ningún código de la planilla sea ya un producto de otro catálogo. Un
 *   producto es de Journaway si tiene algún `codigo_externo` de Journaway; al
 *   crearlo se le pone el primero enseguida.
 * - Idempotente: producto por código; servicios por (producto, orden,
 *   prioridad); noches por (producto, orden, noche desde); partes por
 *   (paquete, orden); ajustes por (paquete, parte, orden del servicio);
 *   nombres por (agencia, código). Una segunda corrida no crea filas. Lo que
 *   sobra se borra, pero solo de los productos de Journaway.
 * - Nunca inserta en `proveedor`. Los importadores de M1 no tocan estos
 *   productos (cada uno carga solo su lista de códigos).
 */

export const TIPO_CORRIDA_JOURNAWAY = "catalogo-journaway";

const CAMPOS_SERVICIO: Array<keyof ServicioJournaway> = [
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
  "sentido",
];

type Fila = Record<string, unknown>;

/** Columnas a leer de `producto_servicio` (como `string`: el select se arma, no es un literal). */
const COLUMNAS_SERVICIO: string = `id, producto_id, orden, prioridad, ${CAMPOS_SERVICIO.join(", ")}`;

function iguales(a: Fila, b: Fila, campos: readonly string[]): boolean {
  return campos.every((c) => (a[c] ?? null) === (b[c] ?? null));
}

interface Conteo {
  productos: number;
  servicios: number;
  noches: number;
  componentes: number;
  ajustes: number;
  codigos: number;
}

const cero = (): Conteo => ({ productos: 0, servicios: 0, noches: 0, componentes: 0, ajustes: 0, codigos: 0 });

/** Un proveedor del directorio, para el reporte (a quién se le pide cada cosa). */
export interface ProveedorDelReporte {
  id: string;
  nombre: string;
  mails: string[];
  canal: string | null;
}

export interface ResumenJournaway {
  importacionId: string;
  archivo: string;
  plan: PlanJournaway;
  creados: Conteo;
  actualizados: Conteo;
  eliminados: Conteo;
  /** Los proveedores del directorio a los que se pide algo, por id. */
  proveedores: Map<string, ProveedorDelReporte>;
  filasParaRevisar: number;
}

/** Lee filas crudas de PostgREST y las tipa (el select se arma como texto, no se infiere). */
async function leerTodo<T>(consulta: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, que: string): Promise<T[]> {
  const { data, error } = await consulta();
  if (error) throw new Error(`No se pudo leer ${que}: ${error.message}`);
  return (data ?? []) as T[];
}

export async function importarCatalogoJournaway(opciones: { admin: SupabaseClient; insumos: InsumosJournaway }): Promise<ResumenJournaway> {
  const { admin, insumos } = opciones;
  const ahora = new Date().toISOString();

  // --- directorio y equivalencias: solo se leen ---
  const directorio = await leerTodo<{ id: string; nombre: string; nombre_normalizado: string; ciudad: string | null; mails: string[] | null; canal: string | null; telefono: string | null }>(
    () => admin.from("proveedor").select("id, nombre, nombre_normalizado, ciudad, mails, canal, telefono").range(0, 9999),
    "proveedor",
  );
  const alias = await leerTodo<{ destino: string; alias_normalizado: string; proveedor_id: string | null; modo: "alias" | "por_service_provider" | "manual"; estado: "confirmado" | "para_revisar"; nota: string | null }>(
    () => admin.from("proveedor_alias").select("destino, alias_normalizado, proveedor_id, modo, estado, nota").range(0, 9999),
    "proveedor_alias",
  );
  const indice = crearIndiceProveedores(directorio, alias);

  // --- no pisar productos de otro catálogo (lo primero: un código ajeno no se planifica) ---
  const codigos = [...new Set([...insumos.planilla.map((f) => f.codigo), ...insumos.internos.map((p) => p.codigo)])];
  const existentes = await leerTodo<{ id: string; codigo: string; nombre: string; destino: string | null; ciudades: string[] | null }>(
    () => admin.from("producto").select("id, codigo, nombre, destino, ciudades").in("codigo", codigos),
    "producto",
  );
  const idsExistentes = existentes.map((p) => p.id);
  const codigosJw = idsExistentes.length
    ? await leerTodo<{ id: string; producto_id: string; codigo: string; nombre_externo: string | null }>(
        () => admin.from("codigo_externo").select("id, producto_id, codigo, nombre_externo").eq("agencia", AGENCIA_JOURNAWAY).in("producto_id", idsExistentes).range(0, 9999),
        "codigo_externo",
      )
    : [];
  const deJournaway = new Set(codigosJw.map((c) => c.producto_id));
  verificarOtroCatalogo(codigos, existentes.map((p) => ({ codigo: p.codigo, deJournaway: deJournaway.has(p.id) })));

  // --- el plan (puro): todo lo demás que no cierra corta acá ---
  const plan = planificarJournaway({ ...insumos, indice });

  const creados = cero();
  const actualizados = cero();
  const eliminados = cero();

  async function guardarCodigo(productoId: string, codigo: string, nombreExterno: string | null): Promise<void> {
    const { data, error } = await admin
      .from("codigo_externo")
      .select("id, producto_id, nombre_externo")
      .eq("agencia", AGENCIA_JOURNAWAY)
      .eq("codigo", codigo)
      .maybeSingle();
    if (error) throw new Error(`No se pudo leer codigo_externo: ${error.message}`);
    if (!data) {
      const { error: e } = await admin.from("codigo_externo").insert({ producto_id: productoId, agencia: AGENCIA_JOURNAWAY, codigo, nombre_externo: nombreExterno });
      if (e) throw new Error(`No se pudo guardar el nombre «${codigo}» de Journaway: ${e.message}`);
      creados.codigos++;
    } else if (data.producto_id !== productoId || (data.nombre_externo ?? null) !== nombreExterno) {
      const { error: e } = await admin
        .from("codigo_externo")
        .update({ producto_id: productoId, nombre_externo: nombreExterno, updated_at: ahora })
        .eq("id", data.id);
      if (e) throw new Error(`No se pudo actualizar el nombre «${codigo}» de Journaway: ${e.message}`);
      actualizados.codigos++;
    }
  }

  // --- 1. productos (simples e internos primero: los armados los usan) ---
  const idDe = new Map(existentes.map((p) => [p.codigo, p.id]));
  const actualPorCodigo = new Map(existentes.map((p) => [p.codigo, p]));
  for (const p of plan.productos) {
    const datos = { nombre: p.nombre, destino: p.destino, ciudades: p.ciudades };
    const actual = actualPorCodigo.get(p.codigo);
    if (!actual) {
      const { data, error } = await admin.from("producto").insert({ codigo: p.codigo, ...datos }).select("id").single();
      if (error) throw new Error(`No se pudo insertar el producto ${p.codigo}: ${error.message}`);
      idDe.set(p.codigo, data.id);
      creados.productos++;
      // Enseguida su primer código de Journaway: así una corrida cortada a la mitad no lo deja "de otro catálogo".
      await guardarCodigo(data.id, p.codigos[0].codigo, p.codigos[0].nombreExterno);
    } else if (actual.nombre !== datos.nombre || actual.destino !== datos.destino || JSON.stringify(actual.ciudades ?? []) !== JSON.stringify(datos.ciudades)) {
      const { error } = await admin.from("producto").update({ ...datos, updated_at: ahora }).eq("id", actual.id);
      if (error) throw new Error(`No se pudo actualizar el producto ${p.codigo}: ${error.message}`);
      actualizados.productos++;
    }
  }
  const ids = plan.productos.map((p) => idDe.get(p.codigo)!);

  // --- lo que ya está cargado de esos productos (una lectura por tabla) ---
  const [servicios, noches, componentes, ajustes, nombres] = await Promise.all([
    leerTodo<Fila>(() => admin.from("producto_servicio").select(COLUMNAS_SERVICIO).in("producto_id", ids).range(0, 9999), "producto_servicio"),
    leerTodo<Fila>(() => admin.from("producto_servicio_noches").select("id, producto_id, orden, noche_desde, noches, lugar, nota").in("producto_id", ids).range(0, 9999), "producto_servicio_noches"),
    leerTodo<Fila>(() => admin.from("producto_componente").select("id, producto_id, orden, tipo, componente_producto_id, descripcion_ruta, transfer_in, transfer_out, noches, dia_desde, nocturno").in("producto_id", ids).range(0, 9999), "producto_componente"),
    leerTodo<Fila>(() => admin.from("tour_servicio_ajuste").select("id, tour_id, paquete_id, orden, accion, texto, motivo, origen").in("tour_id", ids).range(0, 9999), "tour_servicio_ajuste"),
    leerTodo<Fila>(() => admin.from("codigo_externo").select("id, producto_id, codigo").eq("agencia", AGENCIA_JOURNAWAY).in("producto_id", ids).range(0, 9999), "codigo_externo"),
  ]);
  const de = (filas: Fila[], campo: string, id: string) => filas.filter((f) => f[campo] === id);

  /** Inserta, actualiza o borra las filas de una tabla para un producto. */
  async function sincronizar(opcionesTabla: {
    tabla: string;
    que: keyof Conteo;
    actuales: Fila[];
    clave: (f: Fila) => string;
    nuevas: Fila[];
    campos: readonly string[];
    fijo: Fila;
    codigo: string;
  }): Promise<void> {
    const { tabla, que, clave, campos, fijo, codigo } = opcionesTabla;
    const porClave = new Map(opcionesTabla.actuales.map((f) => [clave(f), f]));
    for (const nueva of opcionesTabla.nuevas) {
      const k = clave(nueva);
      const actual = porClave.get(k);
      porClave.delete(k);
      if (!actual) {
        const { error } = await admin.from(tabla).insert({ ...fijo, ...nueva });
        if (error) throw new Error(`No se pudo guardar en ${tabla} (${codigo}): ${error.message}`);
        creados[que]++;
      } else if (!iguales(nueva, actual, campos)) {
        const { error } = await admin.from(tabla).update({ ...nueva, updated_at: ahora }).eq("id", actual.id as string);
        if (error) throw new Error(`No se pudo actualizar ${tabla} (${codigo}): ${error.message}`);
        actualizados[que]++;
      }
    }
    const sobrantes = [...porClave.values()].map((f) => f.id as string);
    if (sobrantes.length) {
      const { error } = await admin.from(tabla).delete().in("id", sobrantes);
      if (error) throw new Error(`No se pudo borrar lo que sobra en ${tabla} (${codigo}): ${error.message}`);
      eliminados[que] += sobrantes.length;
    }
  }

  // --- 2. servicios, noches, partes, ajustes y nombres de cada producto ---
  for (const p of plan.productos) {
    const id = idDe.get(p.codigo)!;
    await sincronizar({
      tabla: "producto_servicio",
      que: "servicios",
      actuales: de(servicios, "producto_id", id),
      clave: (f) => `${f.orden}:${f.prioridad}`,
      nuevas: p.servicios.map((s) => ({ ...s })),
      campos: CAMPOS_SERVICIO,
      fijo: { producto_id: id },
      codigo: p.codigo,
    });
    await sincronizar({
      tabla: "producto_servicio_noches",
      que: "noches",
      actuales: de(noches, "producto_id", id),
      clave: (f) => `${f.orden}:${f.noche_desde}`,
      nuevas: p.noches.map((n) => ({ orden: n.orden, noche_desde: n.nocheDesde, noches: n.noches, lugar: n.lugar, nota: null })),
      campos: ["noches", "lugar", "nota"],
      fijo: { producto_id: id },
      codigo: p.codigo,
    });
    await sincronizar({
      tabla: "producto_componente",
      que: "componentes",
      actuales: de(componentes, "producto_id", id),
      clave: (f) => String(f.orden),
      nuevas: p.componentes.map((c) => ({
        orden: c.orden,
        tipo: "paquete",
        componente_producto_id: idDe.get(c.codigo)!,
        descripcion_ruta: null,
        transfer_in: false,
        transfer_out: false,
        noches: null,
        dia_desde: c.dia,
        nocturno: null,
      })),
      campos: ["tipo", "componente_producto_id", "descripcion_ruta", "transfer_in", "transfer_out", "noches", "dia_desde", "nocturno"],
      fijo: { producto_id: id },
      codigo: p.codigo,
    });
    await sincronizar({
      tabla: "tour_servicio_ajuste",
      que: "ajustes",
      actuales: de(ajustes, "tour_id", id),
      clave: (f) => `${f.paquete_id}:${f.orden}`,
      nuevas: p.ajustes.map((a) => ({ paquete_id: idDe.get(a.paquete)!, orden: a.orden, accion: a.accion, texto: null, motivo: a.motivo, origen: "excepcion" })),
      campos: ["accion", "texto", "motivo", "origen"],
      fijo: { tour_id: id },
      codigo: p.codigo,
    });

    // nombres (agencia + código): los del plan se guardan; los de Journaway que este producto ya no lleva se borran
    for (const c of p.codigos) await guardarCodigo(id, c.codigo, c.nombreExterno);
    const quedan = new Set(p.codigos.map((c) => c.codigo));
    const sobran = de(nombres, "producto_id", id).filter((f) => !quedan.has(f.codigo as string)).map((f) => f.id as string);
    if (sobran.length) {
      const { error } = await admin.from("codigo_externo").delete().in("id", sobran).eq("producto_id", id);
      if (error) throw new Error(`No se pudo borrar nombres viejos de ${p.codigo}: ${error.message}`);
      eliminados.codigos += sobran.length;
    }
  }

  // --- 3. la corrida ---
  const proveedores = new Map<string, ProveedorDelReporte>();
  const porId = new Map(directorio.map((d) => [d.id, d]));
  for (const s of plan.productos.flatMap((p) => p.servicios)) {
    const d = s.booking_supplier_id ? porId.get(s.booking_supplier_id) : undefined;
    if (d) proveedores.set(d.id, { id: d.id, nombre: d.nombre.trim(), mails: d.mails ?? [], canal: d.canal });
  }
  const sinResolver = plan.productos.flatMap((p) => p.servicios.filter((s) => s.proveedor_sin_resolver).map((s) => ({ codigo: p.codigo, orden: s.orden, prioridad: s.prioridad, proveedor: s.booking_supplier_nombre, nota: s.proveedor_nota })));
  const filasParaRevisar = new Set(sinResolver.map((s) => s.codigo)).size;
  const total = (c: Conteo) => c.productos + c.servicios + c.noches + c.componentes + c.ajustes + c.codigos;

  const { data: importacion, error } = await admin
    .from("importacion")
    .insert({
      archivo: insumos.archivo,
      tipo_corrida: TIPO_CORRIDA_JOURNAWAY,
      filas_cargadas: total(creados),
      filas_para_revisar: filasParaRevisar,
      detalle: {
        productos: plan.productos.map((p) => resumenProducto(p)),
        sin_resolver: sinResolver,
        creados,
        actualizados,
        eliminados,
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo registrar la importación: ${error.message}`);

  return { importacionId: importacion.id, archivo: insumos.archivo, plan, creados, actualizados, eliminados, proveedores, filasParaRevisar };
}

function resumenProducto(p: ProductoJournaway) {
  return {
    codigo: p.codigo,
    celeste: p.celeste,
    interno: p.interno,
    fila_planilla: p.filaPlanilla,
    comentario: p.comentario,
    partes: p.componentes.map((c) => `${c.codigo} d${c.dia}`),
    proveedores: p.opciones.map((o) => ({ prioridad: o.prioridad, proveedor: o.proveedorNombre, manual: o.manual, sin_resolver: o.sinResolver, cambio_en_planilla: o.cambioEnPlanilla })),
    nombres: p.codigos.length,
  };
}
