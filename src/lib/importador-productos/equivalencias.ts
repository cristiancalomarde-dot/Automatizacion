import type { SupabaseClient } from "@supabase/supabase-js";
import { limpiarNombre, normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { leerCsv } from "./csv";
import { elegirPorDestino, type CandidatoProveedor } from "./destinos";

/**
 * Equivalencias de proveedores (spec M1-04b §3 #1-#2; M1-04d §3 #2-#4): los
 * nombres con que el Excel de paquetes escribe a un proveedor ("Cuenca del
 * Plana", "Taroba", "Beer"…) → el `proveedor` del directorio (M1-03). La
 * lista la decide y la revisa el owner (`data/equivalencias-proveedores.csv`);
 * el sistema no empareja por parecido.
 *
 * Formato (M1-04d): `destino, nombre_en_excel, proveedor_en_directorio, modo,
 * estado, nota`.
 * - `destino`: el alias solo aplica a los paquetes de ese destino (según
 *   `data/paquetes-piloto.csv`). Ej. "Nacional Inn" es el de Foz en IGR y el
 *   de Copacabana en RIO.
 * - `modo`:
 *   - `alias`: el nombre corresponde a ese proveedor del directorio.
 *   - `por_service_provider`: el Booking Supplier es un grupo sin central
 *     (Tremun, Dazzler); el proveedor se busca por el nombre del hotel, con
 *     las filas `alias` del mismo destino. Sin proveedor propio.
 *   - `manual`: no es un proveedor al que se le escribe (Kupos.cl). Sin
 *     proveedor.
 * - `proveedor_en_directorio` se compara contra `proveedor.nombre` TAL CUAL
 *   (sin normalizar: es el nombre que el owner copió del directorio). Si no
 *   existe, la carga falla entera con un mensaje claro. Si hay más de uno con
 *   ese nombre, se elige el de la ciudad del destino (`elegirPorDestino`); si
 *   igual no queda uno, la carga falla. Nunca crea un proveedor ni ignora la
 *   fila.
 * - `estado`: `confirmado` | `para_revisar`. Un alias `para_revisar` puede no
 *   traer proveedor (ej. Tetris); uno `confirmado` de modo `alias` siempre trae.
 * - La carga es idempotente: la identidad es (destino, alias normalizado),
 *   con la misma normalización que `proveedor.nombre_normalizado`.
 */

export const ESTADOS_ALIAS = ["confirmado", "para_revisar"] as const;
export type EstadoAlias = (typeof ESTADOS_ALIAS)[number];
export const MODOS_ALIAS = ["alias", "por_service_provider", "manual"] as const;
export type ModoAlias = (typeof MODOS_ALIAS)[number];

const COLUMNAS = ["destino", "nombre_en_excel", "proveedor_en_directorio", "modo", "estado", "nota"] as const;

export interface FilaEquivalencia {
  /** Fila del CSV (1 = encabezado), para los mensajes de error. */
  fila: number;
  destino: string;
  alias: string;
  alias_normalizado: string;
  proveedor_en_directorio: string | null;
  modo: ModoAlias;
  estado: EstadoAlias;
  nota: string | null;
}

/** Lo que se guarda en `proveedor_alias` (y lo que usa el importador para emparejar). */
export interface AliasProveedor {
  destino: string;
  alias: string;
  alias_normalizado: string;
  proveedor_id: string | null;
  modo: ModoAlias;
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
    const destino = vacioANull(r.destino);
    if (!destino) throw new Error(`Equivalencias, fila ${fila}: falta el destino.`);
    const alias = vacioANull(r.nombre_en_excel);
    if (!alias) throw new Error(`Equivalencias, fila ${fila}: falta nombre_en_excel.`);
    const modo = (r.modo ?? "").trim() as ModoAlias;
    if (!MODOS_ALIAS.includes(modo)) {
      throw new Error(`Equivalencias, fila ${fila}: modo "${r.modo}" inválido (usar ${MODOS_ALIAS.join(" | ")}).`);
    }
    const estado = (r.estado ?? "").trim() as EstadoAlias;
    if (!ESTADOS_ALIAS.includes(estado)) {
      throw new Error(`Equivalencias, fila ${fila}: estado "${r.estado}" inválido (usar ${ESTADOS_ALIAS.join(" | ")}).`);
    }
    // El nombre del directorio va tal cual (puede tener espacios propios, ej. "(Natalia )").
    const proveedor = (r.proveedor_en_directorio ?? "").trim() === "" ? null : r.proveedor_en_directorio;
    if (modo === "alias" && estado === "confirmado" && proveedor === null) {
      throw new Error(`Equivalencias, fila ${fila}: "${alias}" está confirmado pero no dice a qué proveedor.`);
    }
    if (modo !== "alias" && proveedor !== null) {
      throw new Error(
        `Equivalencias, fila ${fila}: "${alias}" es modo ${modo}: no lleva proveedor_en_directorio (el proveedor sale del hotel, o no hay).`,
      );
    }
    const alias_normalizado = normalizarNombre(alias);
    const clave = `${destino}|${alias_normalizado}`;
    const anterior = vistos.get(clave);
    if (anterior !== undefined) {
      throw new Error(`Equivalencias, fila ${fila}: alias "${alias}" repetido en ${destino} (ya está en la fila ${anterior}).`);
    }
    vistos.set(clave, fila);
    return { fila, destino, alias, alias_normalizado, proveedor_en_directorio: proveedor, modo, estado, nota: vacioANull(r.nota) };
  });
}

export type ProveedorDelDirectorio = CandidatoProveedor & { nombre: string };

/** Resuelve cada fila contra el directorio. Falla (sin cargar nada) si algún proveedor no existe o es ambiguo. */
export function resolverEquivalencias(filas: FilaEquivalencia[], directorio: ProveedorDelDirectorio[]): AliasProveedor[] {
  const porNombre = new Map<string, ProveedorDelDirectorio[]>();
  for (const p of directorio) porNombre.set(p.nombre, [...(porNombre.get(p.nombre) ?? []), p]);

  const errores: string[] = [];
  const alias = filas.map((f) => {
    let proveedor_id: string | null = null;
    if (f.proveedor_en_directorio !== null) {
      const candidatos = porNombre.get(f.proveedor_en_directorio) ?? [];
      const { elegido } = elegirPorDestino(candidatos, f.destino);
      if (candidatos.length === 0) {
        errores.push(`fila ${f.fila}: "${f.proveedor_en_directorio}" (para "${f.alias}") no existe en el directorio de proveedores`);
      } else if (!elegido) {
        errores.push(
          `fila ${f.fila}: hay más de un proveedor llamado "${f.proveedor_en_directorio}" (${candidatos
            .map((p) => p.ciudad ?? "sin ciudad")
            .join(", ")}) y no se puede elegir uno para ${f.destino}`,
        );
      } else {
        proveedor_id = elegido.id;
      }
    }
    return {
      destino: f.destino,
      alias: f.alias,
      alias_normalizado: f.alias_normalizado,
      proveedor_id,
      modo: f.modo,
      estado: f.estado,
      nota: f.nota,
    };
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
    ? await admin.from("proveedor").select("id, nombre, ciudad, mails, canal, telefono").in("nombre", nombres)
    : { data: [], error: null };
  if (error) throw new Error(`No se pudo leer proveedor: ${error.message}`);
  const alias = resolverEquivalencias(filas, (directorio ?? []) as ProveedorDelDirectorio[]);

  const { data: actuales, error: errorActuales } = await admin
    .from("proveedor_alias")
    .select("id, destino, alias, alias_normalizado, proveedor_id, modo, estado, nota")
    .in(
      "alias_normalizado",
      [...new Set(alias.map((a) => a.alias_normalizado))],
    );
  if (errorActuales) throw new Error(`No se pudo leer proveedor_alias: ${errorActuales.message}`);
  const porClave = new Map((actuales ?? []).map((a) => [`${a.destino}|${a.alias_normalizado}`, a]));

  const resumen: ResumenCargaEquivalencias = { total: alias.length, creados: 0, actualizados: 0, sinCambios: 0 };
  const ahora = new Date().toISOString();
  for (const a of alias) {
    const actual = porClave.get(`${a.destino}|${a.alias_normalizado}`);
    if (!actual) {
      const { error: e } = await admin.from("proveedor_alias").insert(a);
      if (e) throw new Error(`No se pudo insertar el alias "${a.alias}" (${a.destino}): ${e.message}`);
      resumen.creados++;
    } else if (
      actual.alias !== a.alias ||
      actual.proveedor_id !== a.proveedor_id ||
      actual.modo !== a.modo ||
      actual.estado !== a.estado ||
      (actual.nota ?? null) !== a.nota
    ) {
      const { error: e } = await admin
        .from("proveedor_alias")
        .update({ ...a, updated_at: ahora })
        .eq("id", actual.id);
      if (e) throw new Error(`No se pudo actualizar el alias "${a.alias}" (${a.destino}): ${e.message}`);
      resumen.actualizados++;
    } else {
      resumen.sinCambios++;
    }
  }
  return resumen;
}
