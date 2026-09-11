"use client";

import { createBrowserClient } from "@supabase/ssr";
import { obtenerAnonKeySupabase, obtenerUrlSupabase } from "./env";

/**
 * Cliente de Supabase para componentes de cliente (botón de login, botón de
 * salir). Usa la clave "anon" — segura de exponer, la protección real la da
 * RLS en la base.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(obtenerUrlSupabase(), obtenerAnonKeySupabase());
}
