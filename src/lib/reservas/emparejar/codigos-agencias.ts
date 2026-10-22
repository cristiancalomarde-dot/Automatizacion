import type { SupabaseClient } from "@supabase/supabase-js";
import { leerCsv } from "@/lib/importador-productos/csv";
import { guardarCodigoExterno } from "@/lib/importador-productos/importar";
import type { CodigoACargar } from "./codigos-kilroy";
import { normalizarNombre } from "./emparejar";

/**
 * Cómo nombra cada agencia nuestros productos, para las agencias que no son
 * Kilroy ni TourRadar (spec M3-13 fila 2): `data/codigos-agencias.csv`
 * (agencia, código de la agencia, nombre de la agencia, nuestro código, nota).
 * Se carga a `codigo_externo` con la agencia de cada fila, como los códigos de
 * Kilroy y TourRadar.
 *
 * Una agencia que no manda código (Adventure360: "Tour: Rio de Janeiro to
 * Santiago") se empareja por el nombre (paso 2 de `emparejar.ts`); su fila va
 * sin código y el código guardado es el nombre normalizado, como lo que se
 * aprende al confirmar un producto (M3-05).
 *
 * Todo o nada: si una fila apunta a un código HI Travel que no existe, la
 * carga falla con un mensaje claro y no escribe ninguna fila. Re-ejecutable.
 */

const ARCHIVO = "codigos-agencias.csv";

export interface FilaCodigoAgencia {
  fila: number;
  agencia: string;
  /** El código tal como lo manda la agencia o, si no manda, el nombre normalizado. */
  codigoAgencia: string;
  nombreAgencia: string | null;
  codigoHiTravel: string;
  nota: string;
}

export function leerCodigosAgencias(textoCsv: string): FilaCodigoAgencia[] {
  const vistos = new Map<string, number>();
  return leerCsv(textoCsv).map((f, i) => {
    const fila = i + 2; // 1 = encabezado
    const agencia = (f.agencia ?? "").trim();
    const nombreAgencia = (f.nombre_agencia ?? "").trim() || null;
    const codigoHiTravel = (f.codigo_hi_travel ?? "").trim();
    if (!agencia) throw new Error(`${ARCHIVO} fila ${fila}: falta la agencia.`);
    if (!codigoHiTravel) throw new Error(`${ARCHIVO} fila ${fila}: falta el código HI Travel.`);
    const codigoAgencia = (f.codigo_agencia ?? "").trim() || (nombreAgencia ? normalizarNombre(nombreAgencia) : "");
    if (!codigoAgencia) throw new Error(`${ARCHIVO} fila ${fila}: falta el código o el nombre que usa la agencia.`);
    const clave = `${agencia}|${codigoAgencia}`;
    const anterior = vistos.get(clave);
    if (anterior) throw new Error(`${ARCHIVO} fila ${fila}: ${agencia} ${codigoAgencia} ya figura en la fila ${anterior}.`);
    vistos.set(clave, fila);
    return { fila, agencia, codigoAgencia, nombreAgencia, codigoHiTravel, nota: (f.nota ?? "").trim() };
  });
}

/** Arma lo que se va a escribir; si algún código HI Travel no existe, falla sin escribir nada. */
export function planCargaCodigosAgencias(filas: FilaCodigoAgencia[], idPorCodigo: Map<string, string>): CodigoACargar[] {
  for (const f of filas) {
    if (!idPorCodigo.has(f.codigoHiTravel)) {
      throw new Error(
        `${ARCHIVO} fila ${f.fila}: el código HI Travel ${f.codigoHiTravel} no existe en el catálogo (${f.agencia} ${f.nombreAgencia ?? f.codigoAgencia}). No se cargó nada.`,
      );
    }
  }
  return filas.map((f) => ({ productoId: idPorCodigo.get(f.codigoHiTravel)!, agencia: f.agencia, codigo: f.codigoAgencia, nombre: f.nombreAgencia }));
}

/** Carga el CSV en `codigo_externo` (identidad agencia + código). Con la service role. */
export async function importarCodigosAgencias(
  admin: SupabaseClient,
  textoCsv: string,
): Promise<{ creados: number; actualizados: number; sinCambios: number }> {
  const filas = leerCodigosAgencias(textoCsv);
  const { data, error } = await admin
    .from("producto")
    .select("id,codigo")
    .in("codigo", [...new Set(filas.map((f) => f.codigoHiTravel))]);
  if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
  const plan = planCargaCodigosAgencias(filas, new Map((data ?? []).map((p) => [p.codigo as string, p.id as string])));

  const cuenta = { creados: 0, actualizados: 0, sinCambios: 0 };
  for (const c of plan) {
    const r = await guardarCodigoExterno(admin, c.productoId, c.agencia, c.codigo, c.nombre);
    if (r === "creado") cuenta.creados++;
    else if (r === "actualizado") cuenta.actualizados++;
    else cuenta.sinCambios++;
  }
  return cuenta;
}
