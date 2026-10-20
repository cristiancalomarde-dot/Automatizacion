/**
 * Cómo se llama cada persona del equipo en la app (spec M3-06). Sin base ni
 * red: se puede importar desde el navegador.
 *
 * - `nombreVisible`: el nombre para la firma, si no el nombre de la cuenta,
 *   si no lo previo a la @ (igual que `nombre_de_usuario` de la migración 0021).
 * - `normalizarNombreParaLaFirma`: lo que se guarda en `usuario.nombre_firma`.
 *   Vacío (o igual al nombre de Google) es null: la firma sigue al nombre de
 *   la cuenta, como en M3-03.
 */
import { TEXTOS } from "@/lib/textos";

/** Igual que el check de `usuario.nombre_firma` (0021). */
export const MAX_NOMBRE_FIRMA = 80;

export interface UsuarioConNombre {
  nombre_firma?: string | null;
  nombre?: string | null;
  email?: string | null;
}

const lleno = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function nombreVisible(u: UsuarioConNombre | null | undefined): string | null {
  if (!u) return null;
  return lleno(u.nombre_firma) ?? lleno(u.nombre) ?? lleno((u.email ?? "").split("@")[0]);
}

export type NombreNormalizado = { ok: true; valor: string | null } | { ok: false; error: string };

export function normalizarNombreParaLaFirma(texto: unknown, nombreGoogle?: string | null): NombreNormalizado {
  const limpio = typeof texto === "string" ? texto.replace(/\s+/g, " ").trim() : "";
  if (!limpio) return { ok: true, valor: null };
  if (limpio.length > MAX_NOMBRE_FIRMA) return { ok: false, error: TEXTOS.miFirma.motivos.largo };
  if (nombreGoogle && limpio === nombreGoogle.replace(/\s+/g, " ").trim()) return { ok: true, valor: null };
  return { ok: true, valor: limpio };
}
