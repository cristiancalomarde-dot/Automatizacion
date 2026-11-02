/**
 * De un solo uso (spec M3-44 #3, owner 2026-11-01): el proveedor "Tangoinn Bed & Brewery IGR" (IGUAZU) del
 * directorio pasa a llamarse "Beer Hostel" (nombre y nombre_normalizado; mismo registro, mismos mails).
 *
 *   npm run renombrar:beer-hostel              # solo muestra qué cambiaría (no escribe)
 *   npm run renombrar:beer-hostel -- --aplicar # lo renombra
 *
 * Después, `npm run importar:equivalencias` (data/equivalencias-proveedores.csv ya apunta a "Beer Hostel").
 * Usa la base configurada en `.env.local` (como los importadores): lo corre el owner (#4).
 * Variables de entorno (#2): NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BEER_HOSTEL, renombrarProveedor } from "@/lib/importador-proveedores/renombrar";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  const aplicar = process.argv.slice(2).includes("--aplicar");

  const cliente = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const r = await renombrarProveedor(cliente, BEER_HOSTEL, { aplicar });
  const donde = `${BEER_HOSTEL.ciudad ?? "sin ciudad"}`;
  switch (r.estado) {
    case "no_esta":
      console.log(`No hay ningún proveedor "${BEER_HOSTEL.de}" ni "${BEER_HOSTEL.a}" en ${donde}: no hay nada que renombrar.`);
      return;
    case "ya_estaba":
      console.log(`El proveedor de ${donde} ya se llama "${BEER_HOSTEL.a}" (id ${r.id}): no hay nada que cambiar.`);
      return;
    default:
      console.log(`Proveedor ${r.id} (${donde}):`);
      console.log(`  nombre:             "${r.antes!.nombre}" → "${r.despues.nombre}"`);
      console.log(`  nombre_normalizado: "${r.antes!.nombre_normalizado}" → "${r.despues.nombre_normalizado}"`);
      console.log(
        r.estado === "renombrado"
          ? "\nRenombrado. Ahora: npm run importar:equivalencias"
          : "\nNo se cambió nada. Para renombrarlo: npm run renombrar:beer-hostel -- --aplicar",
      );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
