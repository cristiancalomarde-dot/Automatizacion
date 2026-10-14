/**
 * Carga `data/codigos-tourradar.csv` en `codigo_externo` con agencia
 * TourRadar (owner 2026-10-14: 150146 → AR09). Mismas columnas que
 * `Insumos/Codigos Productos Tourradar.xlsx`, sin re-correr el importador de
 * productos. Todo o nada: si una fila apunta a un código HI Travel que no
 * existe, falla con un mensaje claro y no escribe ninguna fila. Re-ejecutable.
 *
 *   npm run importar:codigos-tourradar
 *
 * Variables de entorno (regla #2, en local desde `.env.local`):
 * NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { importarCodigosTourRadarCsv } from "@/lib/reservas/emparejar/codigos-tourradar-csv";

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[v]) throw new Error(`Falta la variable de entorno ${v}.`);
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const r = await importarCodigosTourRadarCsv(admin, readFileSync(resolve(process.cwd(), "data", "codigos-tourradar.csv"), "utf-8"));
  console.log(`Códigos TourRadar: ${r.creados} creados, ${r.actualizados} actualizados, ${r.sinCambios} sin cambios.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Error inesperado.");
  process.exit(1);
});
