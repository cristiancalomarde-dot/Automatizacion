import type { SupabaseClient } from "@supabase/supabase-js";
import { leerCodigosTourRadar, type CodigoTourRadar } from "@/lib/importador-productos/codigos-tourradar";
import { leerCsv } from "@/lib/importador-productos/csv";
import { AGENCIA_TOURRADAR, guardarCodigoExterno } from "@/lib/importador-productos/importar";
import type { CodigoACargar } from "./codigos-kilroy";

/**
 * Números de tour de TourRadar validados por el owner que todavía no están en
 * `Insumos/Codigos Productos Tourradar.xlsx` (owner, 2026-10-14: 150146 →
 * AR09). `data/codigos-tourradar.csv` usa las mismas columnas que ese Excel
 * ("Codigo TR", "Nombre en Tourradar", "Nuestro Codigo") y el mismo lector;
 * se carga a `codigo_externo` con agencia TourRadar, sin re-correr el
 * importador de productos entero.
 *
 * Todo o nada: si una fila apunta a un código HI Travel que no existe, falla
 * con un mensaje claro y no escribe ninguna fila. Re-ejecutable.
 */

const ARCHIVO = "codigos-tourradar.csv";

export function leerCodigosTourRadarCsv(textoCsv: string): CodigoTourRadar[] {
  const registros = leerCsv(textoCsv);
  if (registros.length === 0) return [];
  const encabezado = Object.keys(registros[0]);
  return leerCodigosTourRadar([encabezado, ...registros.map((r) => encabezado.map((k) => r[k]))]);
}

export function planCargaCodigosTourRadar(filas: CodigoTourRadar[], idPorCodigo: Map<string, string>): CodigoACargar[] {
  for (const f of filas) {
    if (!idPorCodigo.has(f.nuestroCodigo)) {
      throw new Error(
        `${ARCHIVO}: el código HI Travel ${f.nuestroCodigo} no existe en el catálogo (TourRadar ${f.codigo}). No se cargó nada.`,
      );
    }
  }
  return filas.map((f) => ({
    productoId: idPorCodigo.get(f.nuestroCodigo)!,
    agencia: AGENCIA_TOURRADAR,
    codigo: f.codigo,
    nombre: f.nombre || null,
  }));
}

/** Carga el CSV en `codigo_externo` (identidad agencia + código). Con la service role. */
export async function importarCodigosTourRadarCsv(
  admin: SupabaseClient,
  textoCsv: string,
): Promise<{ creados: number; actualizados: number; sinCambios: number }> {
  const filas = leerCodigosTourRadarCsv(textoCsv);
  const { data, error } = await admin
    .from("producto")
    .select("id,codigo")
    .in("codigo", [...new Set(filas.map((f) => f.nuestroCodigo))]);
  if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
  const plan = planCargaCodigosTourRadar(filas, new Map((data ?? []).map((p) => [p.codigo as string, p.id as string])));

  const cuenta = { creados: 0, actualizados: 0, sinCambios: 0 };
  for (const c of plan) {
    const r = await guardarCodigoExterno(admin, c.productoId, c.agencia, c.codigo, c.nombre);
    if (r === "creado") cuenta.creados++;
    else if (r === "actualizado") cuenta.actualizados++;
    else cuenta.sinCambios++;
  }
  return cuenta;
}
