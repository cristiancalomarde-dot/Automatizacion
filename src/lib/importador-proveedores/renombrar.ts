import type { SupabaseClient } from "@supabase/supabase-js";
import { limpiarNombre, normalizarNombre } from "./nombre";

/**
 * Un proveedor del directorio que cambió de nombre y el Excel todavía no lo dice (M3-44: "Tangoinn Bed &
 * Brewery IGR" → "Beer Hostel", owner 2026-11-01). Renombra `nombre` y `nombre_normalizado` del mismo
 * registro (mismo id: los servicios y los alias que lo apuntan siguen apuntándolo). En seco no escribe.
 */
export interface Renombre {
  de: string;
  ciudad: string | null;
  a: string;
}

export interface ResultadoRenombre {
  /** renombrado (escrito) · por_renombrar (en seco) · ya_estaba (ya tiene el nombre nuevo) · no_esta. */
  estado: "renombrado" | "por_renombrar" | "ya_estaba" | "no_esta";
  id: string | null;
  antes: { nombre: string; nombre_normalizado: string } | null;
  despues: { nombre: string; nombre_normalizado: string };
}

async function buscar(admin: SupabaseClient, nombre: string, ciudad: string | null): Promise<Array<{ id: string; nombre: string; nombre_normalizado: string }>> {
  const consulta = admin.from("proveedor").select("id, nombre, nombre_normalizado").eq("nombre_normalizado", normalizarNombre(nombre));
  const { data, error } = await (ciudad === null ? consulta.is("ciudad", null) : consulta.eq("ciudad", ciudad));
  if (error) throw new Error(`No se pudo leer proveedor: ${error.message}`);
  return data ?? [];
}

export async function renombrarProveedor(admin: SupabaseClient, r: Renombre, opciones: { aplicar: boolean }): Promise<ResultadoRenombre> {
  const despues = { nombre: limpiarNombre(r.a), nombre_normalizado: normalizarNombre(r.a) };
  const viejos = await buscar(admin, r.de, r.ciudad);
  const nuevos = await buscar(admin, r.a, r.ciudad);
  if (viejos.length > 1) throw new Error(`Hay ${viejos.length} proveedores "${r.de}" en ${r.ciudad ?? "sin ciudad"}: no se puede elegir uno.`);
  if (viejos.length === 0) return { estado: nuevos.length ? "ya_estaba" : "no_esta", id: nuevos[0]?.id ?? null, antes: null, despues };
  const [viejo] = viejos;
  if (nuevos.length) {
    throw new Error(`Ya hay un proveedor "${r.a}" en ${r.ciudad ?? "sin ciudad"} además de "${r.de}": renombrarlo lo duplicaría. Revisalo a mano.`);
  }
  const antes = { nombre: viejo.nombre, nombre_normalizado: viejo.nombre_normalizado };
  if (!opciones.aplicar) return { estado: "por_renombrar", id: viejo.id, antes, despues };
  const { error } = await admin
    .from("proveedor")
    .update({ ...despues, updated_at: new Date().toISOString() })
    .eq("id", viejo.id);
  if (error) throw new Error(`No se pudo renombrar "${r.de}": ${error.message}`);
  return { estado: "renombrado", id: viejo.id, antes, despues };
}

/** M3-44 (owner, 2026-11-01): el hostel de Puerto Iguazú se llama Beer Hostel. */
export const BEER_HOSTEL: Renombre = { de: "Tangoinn Bed & Brewery IGR", ciudad: "IGUAZU", a: "Beer Hostel" };
