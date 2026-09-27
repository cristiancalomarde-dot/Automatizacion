import type { SupabaseClient } from "@supabase/supabase-js";
import { limpiarNombre, normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { leerCsv } from "./csv";

/**
 * Equivalencias de proveedores (spec M1-04b §3 #1-#2): los nombres con que el
 * Excel de paquetes escribe a un proveedor ("Cuenca del Plana", "Taroba",
 * "Beer"…) → el `proveedor` del directorio (M1-03). La lista la decide y la
 * revisa el owner (`data/equivalencias-proveedores.csv`); el sistema no
 * empareja por parecido.
 *
 * - `proveedor_en_directorio` se compara contra `proveedor.nombre` TAL CUAL
 *   (sin normalizar: es el nombre que el owner copió del directorio). Si no
 *   existe, o existe más de uno, la carga falla entera con un mensaje claro:
 *   nunca crea un proveedor ni ignora la fila.
 * - `estado`: `confirmado` | `para_revisar`. Un alias `para_revisar` puede no
 *   traer proveedor (ej. Tetris); uno `confirmado` siempre trae.
 * - La carga es idempotente: la identidad es el alias normalizado (misma
 *   normalización que `proveedor.nombre_normalizado`).
 */

export const ESTADOS_ALIAS = ["confirmado", "para_revisar"] as const;
export type EstadoAlias = (typeof ESTADOS_ALIAS)[number];

const COLUMNAS = ["nombre_en_excel", "proveedor_en_directorio", "estado", "nota"] as const;

export interface FilaEquivalencia {
  /** Fila del CSV (1 = encabezado), para los mensajes de error. */
  fila: number;
  alias: string;
  alias_normalizado: string;
  proveedor_en_directorio: string | null;
  estado: EstadoAlias;
  nota: string | null;
}

/** Lo que se guarda en `proveedor_alias` (y lo que usa el importador para emparejar). */
export interface AliasProveedor {
  alias: string;
  alias_normalizado: string;
  proveedor_id: string | null;
  estado: EstadoAlias;
  nota: string | null;
}

function vacioANull(texto: string | undefined): string | null {
  const limpio = limpiarNombre(texto ?? "");
  return limpio === "" ? null : limpio;
}

export function parsearEquivalencias(texto: string): FilaEquivalencia[] {
  const registros = leerCsv(texto);
  const encabezado = texto.replace(/^﻿/, "").split(/\r?\n/)[0].split(",").map((c) => c.trim());
  const faltantes = COLUMNAS.filter((c) => !encabezado.includes(c));
  if (faltantes.length) {
    throw new Error(`Equivalencias: faltan columnas en el encabezado: ${faltantes.join(", ")}.`);
  }

  const vistos = new Map<string, number>();
  return registros.map((r, i) => {
    const fila = i + 2;
    const alias = vacioANull(r.nombre_en_excel);
    if (!alias) throw new Error(`Equivalencias, fila ${fila}: falta nombre_en_excel.`);
    const estado = (r.estado ?? "").trim() as EstadoAlias;
    if (!ESTADOS_ALIAS.includes(estado)) {
      throw new Error(`Equivalencias, fila ${fila}: estado "${r.estado}" inválido (usar ${ESTADOS_ALIAS.join(" | ")}).`);
    }
    // El nombre del directorio va tal cual (puede tener espacios propios, ej. "(Natalia )").
    const proveedor = (r.proveedor_en_directorio ?? "").trim() === "" ? null : r.proveedor_en_directorio;
    if (estado === "confirmado" && proveedor === null) {
      throw new Error(`Equivalencias, fila ${fila}: "${alias}" está confirmado pero no dice a qué proveedor.`);
    }
    const alias_normalizado = normalizarNombre(alias);
    const anterior = vistos.get(alias_normalizado);
    if (anterior !== undefined) {
      throw new Error(`Equivalencias, fila ${fila}: alias "${alias}" repetido (ya está en la fila ${anterior}).`);
    }
    vistos.set(alias_normalizado, fila);
    return { fila, alias, alias_normalizado, proveedor_en_directorio: proveedor, estado, nota: vacioANull(r.nota) };
  });
}

/** Resuelve cada fila contra el directorio. Falla (sin cargar nada) si algún proveedor no existe o es ambiguo. */
export function resolverEquivalencias(
  filas: FilaEquivalencia[],
  directorio: Array<{ id: string; nombre: string }>,
): AliasProveedor[] {
  const porNombre = new Map<string, string[]>();
  for (const p of directorio) porNombre.set(p.nombre, [...(porNombre.get(p.nombre) ?? []), p.id]);

  const errores: string[] = [];
  const alias = filas.map((f) => {
    let proveedor_id: string | null = null;
    if (f.proveedor_en_directorio !== null) {
      const ids = porNombre.get(f.proveedor_en_directorio) ?? [];
      if (ids.length === 0) {
        errores.push(`fila ${f.fila}: "${f.proveedor_en_directorio}" (para "${f.alias}") no existe en el directorio de proveedores`);
      } else if (ids.length > 1) {
        errores.push(`fila ${f.fila}: hay más de un proveedor llamado "${f.proveedor_en_directorio}"`);
      } else {
        proveedor_id = ids[0];
      }
    }
    return { alias: f.alias, alias_normalizado: f.alias_normalizado, proveedor_id, estado: f.estado, nota: f.nota };
  });
  if (errores.length) {
    throw new Error(`Equivalencias: no se cargó nada. ${errores.join("; ")}.`);
  }
  return alias;
}

export interface ResumenCargaEquivalencias {
  total: number;
  creados: number;
  actualizados: number;
  sinCambios: number;
}

/**
 * Carga la lista en `proveedor_alias` (cliente con service role; la clave la
 * pone quien llama, regla #2). Valida todo antes de escribir. Nunca inserta
 * en `proveedor`.
 */
export async function cargarEquivalencias(opciones: {
  admin: SupabaseClient;
  textoCsv: string;
}): Promise<ResumenCargaEquivalencias> {
  const { admin } = opciones;
  const filas = parsearEquivalencias(opciones.textoCsv);

  const nombres = [...new Set(filas.map((f) => f.proveedor_en_directorio).filter((n): n is string => n !== null))];
  const { data: directorio, error } = nombres.length
    ? await admin.from("proveedor").select("id, nombre").in("nombre", nombres)
    : { data: [], error: null };
  if (error) throw new Error(`No se pudo leer proveedor: ${error.message}`);
  const alias = resolverEquivalencias(filas, directorio ?? []);

  const { data: actuales, error: errorActuales } = await admin
    .from("proveedor_alias")
    .select("id, alias, alias_normalizado, proveedor_id, estado, nota")
    .in(
      "alias_normalizado",
      alias.map((a) => a.alias_normalizado),
    );
  if (errorActuales) throw new Error(`No se pudo leer proveedor_alias: ${errorActuales.message}`);
  const porAlias = new Map((actuales ?? []).map((a) => [a.alias_normalizado as string, a]));

  const resumen: ResumenCargaEquivalencias = { total: alias.length, creados: 0, actualizados: 0, sinCambios: 0 };
  const ahora = new Date().toISOString();
  for (const a of alias) {
    const actual = porAlias.get(a.alias_normalizado);
    if (!actual) {
      const { error: e } = await admin.from("proveedor_alias").insert(a);
      if (e) throw new Error(`No se pudo insertar el alias "${a.alias}": ${e.message}`);
      resumen.creados++;
    } else if (
      actual.alias !== a.alias ||
      actual.proveedor_id !== a.proveedor_id ||
      actual.estado !== a.estado ||
      (actual.nota ?? null) !== a.nota
    ) {
      const { error: e } = await admin
        .from("proveedor_alias")
        .update({ ...a, updated_at: ahora })
        .eq("id", actual.id);
      if (e) throw new Error(`No se pudo actualizar el alias "${a.alias}": ${e.message}`);
      resumen.actualizados++;
    } else {
      resumen.sinCambios++;
    }
  }
  return resumen;
}
