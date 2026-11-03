import type { SupabaseClient } from "@supabase/supabase-js";
import { leerCsv } from "@/lib/importador-productos/csv";
import { guardarCodigoExterno } from "@/lib/importador-productos/importar";

/**
 * Los códigos Kilroy que no siguen la regla del envoltorio (spec M2-03 fila
 * 2): `data/codigos-kilroy.csv` (código Kilroy completo, nuestro código,
 * nombre Kilroy, nota). Se cargan a `codigo_externo` con agencia Kilroy.
 *
 * Todo o nada: si una fila apunta a un código HI Travel que no existe, la
 * carga falla con un mensaje claro y no escribe ninguna fila.
 *
 * M3-46: salvo que la fila diga `pendiente_de_carga=si` (BR18, antes de M3-47):
 * mientras el producto no esté cargado, esa fila queda afuera y se informa;
 * cuando esté, se carga como cualquier otra.
 */

export const AGENCIA_KILROY = "Kilroy";
const ARCHIVO = "codigos-kilroy.csv";

export interface FilaCodigoKilroy {
  fila: number;
  codigoKilroy: string;
  codigoHiTravel: string;
  nombreKilroy: string | null;
  nota: string;
  /** Columna `pendiente_de_carga`: el producto todavía no está en el catálogo (no corta la carga). */
  pendienteDeCarga: boolean;
}

export function leerCodigosKilroy(textoCsv: string): FilaCodigoKilroy[] {
  const vistos = new Map<string, number>();
  return leerCsv(textoCsv).map((f, i) => {
    const fila = i + 2; // 1 = encabezado
    const codigoKilroy = (f.codigo_kilroy ?? "").trim();
    const codigoHiTravel = (f.codigo_hi_travel ?? "").trim();
    if (!codigoKilroy) throw new Error(`${ARCHIVO} fila ${fila}: falta el código Kilroy.`);
    if (!codigoHiTravel) throw new Error(`${ARCHIVO} fila ${fila}: falta el código HI Travel.`);
    const anterior = vistos.get(codigoKilroy);
    if (anterior) throw new Error(`${ARCHIVO} fila ${fila}: el código ${codigoKilroy} ya figura en la fila ${anterior}.`);
    vistos.set(codigoKilroy, fila);
    const pendiente = (f.pendiente_de_carga ?? "").trim().toLowerCase();
    if (!["", "si", "sí", "no"].includes(pendiente)) {
      throw new Error(`${ARCHIVO} fila ${fila}: pendiente_de_carga tiene que ser si, no o vacío (dice "${f.pendiente_de_carga}").`);
    }
    return {
      fila,
      codigoKilroy,
      codigoHiTravel,
      nombreKilroy: (f.nombre_kilroy ?? "").trim() || null,
      nota: (f.nota ?? "").trim(),
      pendienteDeCarga: pendiente === "si" || pendiente === "sí",
    };
  });
}

export interface CodigoACargar {
  productoId: string;
  agencia: string;
  codigo: string;
  nombre: string | null;
}

/** Arma lo que se va a escribir; si algún código HI Travel no existe, falla sin escribir nada. */
export function planCargaCodigosKilroy(filas: FilaCodigoKilroy[], idPorCodigo: Map<string, string>): CodigoACargar[] {
  for (const f of filas) {
    if (!idPorCodigo.has(f.codigoHiTravel) && !f.pendienteDeCarga) {
      throw new Error(
        `${ARCHIVO} fila ${f.fila}: el código HI Travel ${f.codigoHiTravel} no existe en el catálogo (${f.codigoKilroy}). No se cargó nada.`,
      );
    }
  }
  return filas.filter((f) => idPorCodigo.has(f.codigoHiTravel)).map((f) => ({
    productoId: idPorCodigo.get(f.codigoHiTravel)!,
    agencia: AGENCIA_KILROY,
    codigo: f.codigoKilroy,
    nombre: f.nombreKilroy,
  }));
}

/**
 * Carga el CSV en `codigo_externo` (re-ejecutable: identidad agencia +
 * código, como el importador de productos). Con la service role.
 */
export async function importarCodigosKilroy(
  admin: SupabaseClient,
  textoCsv: string,
): Promise<{ creados: number; actualizados: number; sinCambios: number; pendientes: string[] }> {
  const filas = leerCodigosKilroy(textoCsv);
  const { data, error } = await admin
    .from("producto")
    .select("id,codigo")
    .in("codigo", [...new Set(filas.map((f) => f.codigoHiTravel))]);
  if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
  const idPorCodigo = new Map((data ?? []).map((p) => [p.codigo as string, p.id as string]));
  const plan = planCargaCodigosKilroy(filas, idPorCodigo);

  const pendientes = filas.filter((f) => !idPorCodigo.has(f.codigoHiTravel)).map((f) => f.codigoKilroy);
  const cuenta = { creados: 0, actualizados: 0, sinCambios: 0, pendientes };
  for (const c of plan) {
    const r = await guardarCodigoExterno(admin, c.productoId, c.agencia, c.codigo, c.nombre);
    if (r === "creado") cuenta.creados++;
    else if (r === "actualizado") cuenta.actualizados++;
    else cuenta.sinCambios++;
  }
  return cuenta;
}
