import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENCIA_JOURNAWAY } from "@/lib/catalogo/reglas";
import { parsearNombres } from "./nombres";

/**
 * M3-30: suma a `codigo_externo` (agencia Journaway) los nombres de
 * `data/journaway-nombres.csv` que la base todavía no tiene (los de Petzold en
 * alemán), sin tener que volver a correr toda la carga de M2-08. Solo agrega:
 * un nombre que ya está (para el mismo u otro producto) no se toca, y un
 * código que no está en el catálogo se informa y no se carga. No usa IA (#3)
 * ni le escribe a nadie (#4). Sin `aplicar`, solo dice qué sumaría.
 */

export interface ResultadoNombres {
  /** Los que faltan (y se sumaron, si `aplicar`). */
  sumados: Array<{ codigo: string; nombre: string }>;
  /** Ya estaban, pero apuntan a otro producto: no se tocan. */
  enOtroProducto: Array<{ codigo: string; nombre: string }>;
  /** Su producto no está en la base. */
  sinProducto: Array<{ codigo: string; nombre: string }>;
}

export async function sumarNombresJournaway(
  admin: SupabaseClient,
  opciones: { aplicar: boolean; raiz?: string },
): Promise<ResultadoNombres> {
  const nombres = parsearNombres(readFileSync(join(opciones.raiz ?? process.cwd(), "data", "journaway-nombres.csv"), "utf-8"));
  const codigos = [...new Set(nombres.map((n) => n.codigo))];
  const { data: productos, error: e1 } = await admin.from("producto").select("id, codigo").in("codigo", codigos);
  if (e1) throw new Error(`No se pudieron leer los productos: ${e1.message}`);
  const idDe = new Map((productos ?? []).map((p) => [p.codigo as string, p.id as string]));
  const { data: existentes, error: e2 } = await admin
    .from("codigo_externo")
    .select("codigo, producto_id")
    .eq("agencia", AGENCIA_JOURNAWAY)
    .in(
      "codigo",
      nombres.map((n) => n.limpio),
    );
  if (e2) throw new Error(`No se pudieron leer los nombres de Journaway: ${e2.message}`);
  const yaEsta = new Map((existentes ?? []).map((c) => [c.codigo as string, c.producto_id as string]));

  const r: ResultadoNombres = { sumados: [], enOtroProducto: [], sinProducto: [] };
  const filas: Array<{ producto_id: string; agencia: string; codigo: string; nombre_externo: string }> = [];
  for (const n of nombres) {
    const productoId = idDe.get(n.codigo);
    const actual = yaEsta.get(n.limpio);
    if (!productoId) r.sinProducto.push({ codigo: n.codigo, nombre: n.nombre });
    else if (actual && actual !== productoId) r.enOtroProducto.push({ codigo: n.codigo, nombre: n.nombre });
    else if (!actual) {
      r.sumados.push({ codigo: n.codigo, nombre: n.nombre });
      filas.push({ producto_id: productoId, agencia: AGENCIA_JOURNAWAY, codigo: n.limpio, nombre_externo: n.nombre });
    }
  }
  if (opciones.aplicar && filas.length) {
    const { error } = await admin.from("codigo_externo").insert(filas);
    if (error) throw new Error(`No se pudieron sumar los nombres de Journaway: ${error.message}`);
  }
  return r;
}
