/**
 * Carga `data/codigos-kilroy.csv` en `codigo_externo` con agencia Kilroy
 * (spec M2-03 fila 2). Todo o nada: si una fila apunta a un código HI Travel
 * que no existe, falla con un mensaje claro y no escribe ninguna fila.
 * Re-ejecutable.
 *
 *   npm run importar:codigos-kilroy
 *
 * Variables de entorno (regla #2, en local desde `.env.local`):
 * NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { importarCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[v]) throw new Error(`Falta la variable de entorno ${v}.`);
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const r = await importarCodigosKilroy(admin, readFileSync(resolve(process.cwd(), "data", "codigos-kilroy.csv"), "utf-8"));
  console.log(`Códigos Kilroy: ${r.creados} creados, ${r.actualizados} actualizados, ${r.sinCambios} sin cambios.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Error inesperado.");
  process.exit(1);
});
