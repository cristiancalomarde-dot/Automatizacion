import type { SupabaseClient } from "@supabase/supabase-js";
import { aRevision } from "./consultas";
import { QUE_MAL } from "./medicion-prueba";
import { esIdDeReserva } from "./reglas";
import type { RevisionDePrueba } from "./tipos";

/**
 * Guardar la marca del owner sobre una reserva de prueba (spec M2-06 fila 13).
 * Corre en el servidor (la server action de la pantalla de detalle) con el
 * cliente de la SESIÓN: la RLS aplica (#1) y la base pone el autor
 * (`auth.uid()`, migración 0014) y rechaza una reserva real. Acá además se
 * rechaza antes de escribir, con un mensaje claro.
 */

export interface MarcaEntrada {
  reservaId: string;
  resultado: "bien" | "mal";
  queMal: string[];
  nota: string | null;
}

export type ResultadoMarca = { ok: true; revision: RevisionDePrueba } | { ok: false; error: string };

const MAX_NOTA = 2000;

export function validarMarca(e: MarcaEntrada): { ok: true; marca: MarcaEntrada } | { ok: false; error: string } {
  if (!esIdDeReserva(e?.reservaId ?? "")) return { ok: false, error: "La reserva no es válida." };
  if (e.resultado !== "bien" && e.resultado !== "mal") return { ok: false, error: "La marca es 'bien' o 'mal'." };
  const pedidos = Array.isArray(e.queMal) ? e.queMal : [];
  if (pedidos.some((q) => !(QUE_MAL as readonly string[]).includes(q))) return { ok: false, error: "Qué está mal: opción desconocida." };
  const queMal = e.resultado === "mal" ? QUE_MAL.filter((q) => pedidos.includes(q)) : [];
  if (e.resultado === "mal" && queMal.length === 0) return { ok: false, error: "Marcá al menos una cosa que esté mal." };
  const nota = typeof e.nota === "string" && e.nota.trim() ? e.nota.trim() : null;
  if (nota && nota.length > MAX_NOTA) return { ok: false, error: `La nota es muy larga (máximo ${MAX_NOTA} caracteres).` };
  return { ok: true, marca: { reservaId: e.reservaId, resultado: e.resultado, queMal: [...queMal], nota } };
}

export async function guardarMarca(cliente: SupabaseClient, entrada: MarcaEntrada): Promise<ResultadoMarca> {
  const v = validarMarca(entrada);
  if (!v.ok) return v;
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion?.user) return { ok: false, error: "Hay que iniciar sesión para marcar." };

  const { data: reserva, error: errorReserva } = await cliente.from("reserva").select("id,de_prueba").eq("id", v.marca.reservaId).maybeSingle();
  if (errorReserva) return { ok: false, error: `No se pudo leer la reserva: ${errorReserva.message}` };
  if (!reserva) return { ok: false, error: "La reserva no existe." };
  if (!reserva.de_prueba) return { ok: false, error: "Solo se marcan las reservas de prueba." };

  const { data, error } = await cliente
    .from("revision_prueba")
    .upsert(
      { reserva_id: v.marca.reservaId, resultado: v.marca.resultado, que_mal: v.marca.queMal, nota: v.marca.nota },
      { onConflict: "reserva_id" },
    )
    .select("reserva_id,resultado,que_mal,nota,updated_at,autor:autor_id(nombre,email)")
    .single();
  if (error) return { ok: false, error: `No se pudo guardar la marca: ${error.message}` };
  return { ok: true, revision: aRevision(data) };
}
