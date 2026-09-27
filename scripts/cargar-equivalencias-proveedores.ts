/**
 * Carga la lista de equivalencias de proveedores revisada por el owner
 * (spec M1-04b) en `proveedor_alias`, contra la base de Supabase configurada
 * en las variables de entorno.
 *
 *   npm run importar:equivalencias
 *   npm run importar:equivalencias -- "<ruta a otro CSV>"
 *
 * Por defecto usa `data/equivalencias-proveedores.csv`. Es idempotente
 * (cargarla dos veces no duplica filas). Si una fila nombra un proveedor que
 * no existe en el directorio, falla sin cargar nada (no crea el proveedor).
 * Después de cambiar la lista, re-correr `npm run importar:productos`.
 *
 * Variables de entorno (regla #2 — nunca en el código; en local se leen de
 * `.env.local`): NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cargarEquivalencias } from "@/lib/importador-productos/equivalencias";

const CSV_POR_DEFECTO = "data/equivalencias-proveedores.csv";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const ruta = resolve(process.cwd(), process.argv[2] ?? CSV_POR_DEFECTO);
  if (!existsSync(ruta)) throw new Error(`No existe el archivo: ${ruta}`);

  const admin = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const resumen = await cargarEquivalencias({ admin, textoCsv: readFileSync(ruta, "utf-8") });
  console.log(JSON.stringify(resumen, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
