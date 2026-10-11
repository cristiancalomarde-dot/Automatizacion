import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { leerCsv } from "./csv";

/**
 * Servicios del paquete vendido solo que no se piden siempre (spec M1-08 §3
 * #6), desde `data/servicios-a-pedido.csv` (paquete, servicio, marca, nota) a
 * `producto_servicio.a_pedido` / `a_pedido_nota` (migración 0009):
 *
 * - `a_pedido`: lo pide el pax o el vendedor (OD017: el traslado de llegada, M1-09).
 * - `segun_reserva`: depende de la variante que se venda (OD019: Remis
 *   Mendoza solo si el paquete es CON traslados; elegir la variante es M2).
 *
 * No se borran: la pantalla los muestra con la marca. `servicio` es el nombre
 * del servicio tal como lo escribe el Excel o un pedazo de su línea; tiene que
 * nombrar exactamente un servicio del paquete. Si no, se corta antes de
 * escribir (nunca se marca algo que no existe).
 */

export const MARCAS_A_PEDIDO = ["a_pedido", "segun_reserva"] as const;
export type MarcaAPedido = (typeof MARCAS_A_PEDIDO)[number];

export interface FilaAPedido {
  paquete: string;
  servicio: string;
  marca: MarcaAPedido;
  nota?: string;
}

/** Lo mínimo de un servicio de paquete para encontrarlo por su texto. */
export interface ServicioBuscable {
  orden: number;
  prioridad: number;
  tipo: string;
  serviceProviderNombre: string | null;
  descripcion: string | null;
}

/**
 * El `orden` del único servicio del paquete que nombra `texto`: por su nombre
 * (Service Provider, igual) o porque su línea del Excel lo contiene. Lo usan
 * también las excepciones de traslados por tour (M1-08 §3 #3).
 */
export function buscarServicio(servicios: ServicioBuscable[], texto: string, paquete: string, archivo = "servicios-a-pedido.csv"): number {
  const clave = normalizarNombre(texto);
  const exactos = new Set(
    servicios.filter((s) => s.serviceProviderNombre && normalizarNombre(s.serviceProviderNombre) === clave).map((s) => s.orden),
  );
  const ordenes =
    exactos.size > 0
      ? exactos
      : new Set(servicios.filter((s) => normalizarNombre(s.descripcion ?? "").includes(clave)).map((s) => s.orden));
  if (ordenes.size === 0) {
    throw new Error(`${archivo}: ${paquete} no tiene el servicio "${texto}" (¿está cargado el paquete? ¿el texto es el del Excel?).`);
  }
  if (ordenes.size > 1) {
    throw new Error(`${archivo}: en ${paquete}, "${texto}" nombra más de un servicio (órdenes ${[...ordenes].join(", ")}); escribí más del texto.`);
  }
  return [...ordenes][0];
}

export function parsearServiciosAPedido(texto: string): FilaAPedido[] {
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const paquete = (r.paquete ?? "").trim().toUpperCase();
    const servicio = (r.servicio ?? "").trim();
    if (!paquete || !servicio) throw new Error(`servicios-a-pedido.csv, fila ${fila}: faltan paquete o servicio.`);
    const marca = (r.marca ?? "").trim() as MarcaAPedido;
    if (!MARCAS_A_PEDIDO.includes(marca)) {
      throw new Error(`servicios-a-pedido.csv, fila ${fila}: la marca tiene que ser ${MARCAS_A_PEDIDO.join(" o ")} (dice "${r.marca ?? ""}").`);
    }
    const nota = (r.nota ?? "").trim();
    return { paquete, servicio, marca, ...(nota ? { nota } : {}) };
  });
}

export interface MarcaDeServicio {
  orden: number;
  marca: MarcaAPedido;
  nota: string | null;
}

export function planAPedido(paquete: string, filas: FilaAPedido[], servicios: ServicioBuscable[]): MarcaDeServicio[] {
  return filas
    .filter((f) => f.paquete === paquete)
    .map((f) => ({ orden: buscarServicio(servicios, f.servicio, paquete), marca: f.marca, nota: f.nota ?? null }));
}

export interface ResumenAPedido {
  marcados: number;
  desmarcados: number;
}

/**
 * Carga las marcas. Primero arma y controla todos los paquetes; si uno no
 * cierra, no escribe nada. Un servicio que tenía marca y ya no está en el
 * archivo la pierde (vuelve a "se pide siempre").
 */
export async function cargarServiciosAPedido(opciones: { admin: SupabaseClient; filas: FilaAPedido[] }): Promise<ResumenAPedido> {
  const { admin, filas } = opciones;
  const codigos = [...new Set(filas.map((f) => f.paquete))];
  const resumen: ResumenAPedido = { marcados: 0, desmarcados: 0 };

  const { data: productos, error } = codigos.length
    ? await admin.from("producto").select("id, codigo").in("codigo", codigos)
    : { data: [], error: null };
  if (error) throw new Error(`No se pudo leer producto: ${error.message}`);
  const idDe = new Map((productos ?? []).map((p) => [p.codigo as string, p.id as string]));
  const faltan = codigos.filter((c) => !idDe.has(c));
  if (faltan.length) throw new Error(`servicios-a-pedido.csv: no están cargados ${faltan.join(", ")}.`);

  const deseadas = new Map<string, MarcaDeServicio>();
  for (const codigo of codigos) {
    const { data, error: e } = await admin
      .from("producto_servicio")
      .select("orden, prioridad, tipo_servicio, service_provider_nombre, descripcion")
      .eq("producto_id", idDe.get(codigo)!)
      .not("orden", "is", null);
    if (e) throw new Error(`No se pudo leer los servicios de ${codigo}: ${e.message}`);
    const servicios = (data ?? []).map((s) => ({
      orden: s.orden as number,
      prioridad: s.prioridad as number,
      tipo: s.tipo_servicio as string,
      serviceProviderNombre: (s.service_provider_nombre as string | null) ?? null,
      descripcion: (s.descripcion as string | null) ?? null,
    }));
    for (const m of planAPedido(codigo, filas, servicios)) deseadas.set(`${idDe.get(codigo)}:${m.orden}`, m);
  }

  const { data: marcados, error: em } = await admin
    .from("producto_servicio")
    .select("id, producto_id, orden, a_pedido, a_pedido_nota")
    .not("a_pedido", "is", null);
  if (em) throw new Error(`No se pudo leer las marcas actuales: ${em.message}`);
  const ahora = new Date().toISOString();
  for (const s of marcados ?? []) {
    if (deseadas.has(`${s.producto_id}:${s.orden}`)) continue;
    const { error: e } = await admin.from("producto_servicio").update({ a_pedido: null, a_pedido_nota: null, updated_at: ahora }).eq("id", s.id);
    if (e) throw new Error(`No se pudo quitar una marca: ${e.message}`);
    resumen.desmarcados++;
  }
  for (const [clave, m] of deseadas) {
    const [productoId, orden] = clave.split(":");
    const { data: actuales, error: ea } = await admin
      .from("producto_servicio")
      .select("id, a_pedido, a_pedido_nota")
      .eq("producto_id", productoId)
      .eq("orden", Number(orden));
    if (ea) throw new Error(`No se pudo leer un servicio a marcar: ${ea.message}`);
    const cambian = (actuales ?? []).filter((s) => s.a_pedido !== m.marca || (s.a_pedido_nota ?? null) !== m.nota).map((s) => s.id);
    if (cambian.length === 0) continue;
    const { error: e } = await admin
      .from("producto_servicio")
      .update({ a_pedido: m.marca, a_pedido_nota: m.nota, updated_at: ahora })
      .in("id", cambian);
    if (e) throw new Error(`No se pudo marcar un servicio: ${e.message}`);
    resumen.marcados += cambian.length;
  }
  return resumen;
}
