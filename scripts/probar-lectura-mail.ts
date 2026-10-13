/**
 * Lee UN mail de ejemplo con la IA de verdad e imprime la ficha y el costo
 * (spec M2-02 fila 24).
 *
 *   npm run probar:lectura -- <archivo .txt | .html | .pdf> [--remitente=<mail>] [--asunto=<texto>]
 *                             [--modelo=<id>] [--mostrar-pasajeros]
 *
 * Formato de los archivos: ver `scripts/mail-de-archivo.ts`. Gasta dinero
 * real: pasa por el techo del mes (`uso_ia`, regla #3) y queda en
 * `ia_llamada`. Los nombres y nacimientos de los pasajeros salen tapados
 * salvo con `--mostrar-pasajeros` (`docs/arquitectura/secretos.md`).
 *
 * Variables de entorno (regla #2, en local desde `.env.local`):
 * ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { mesActual } from "@/lib/ia/techo-gasto";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { mailDeArchivo } from "./mail-de-archivo";

function argumento(nombre: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${nombre}=`));
  return a ? a.slice(nombre.length + 3) : undefined;
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  const archivo = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!archivo) throw new Error("Uso: npm run probar:lectura -- <archivo> [--remitente=...] [--asunto=...]");
  for (const v of ["ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[v]) throw new Error(`Falta la variable de entorno ${v}.`);
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const mail = mailDeArchivo(resolve(archivo), { remitente: argumento("remitente"), asunto: argumento("asunto") });
  const lectura = await leerMailConIA(mail, {
    cliente: new Anthropic(),
    registro: crearRegistroUsoIASupabase(admin),
    llamadas: crearRegistroLlamadasSupabase(admin),
    mes: mesActual(),
    modelo: argumento("modelo"),
  });

  if (lectura.estado === "leido" && !process.argv.includes("--mostrar-pasajeros")) {
    lectura.ficha.pasajeros = lectura.ficha.pasajeros.map((p) => ({
      ...p,
      nombre: "(tapado)",
      apellido: "(tapado)",
      fecha_nacimiento: p.fecha_nacimiento ? "(tapado)" : null,
    }));
  }
  console.log(JSON.stringify(lectura, null, 2));
  console.log(`Costo: US$ ${lectura.costo.toFixed(4)}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Error inesperado.");
  process.exit(1);
});
