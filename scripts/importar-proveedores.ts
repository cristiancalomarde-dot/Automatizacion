/**
 * Corre el importador del directorio de proveedores (spec M1-03) contra la
 * base de Supabase configurada en las variables de entorno.
 *
 *   npm run importar:proveedores                      # usa Insumos/Proveedores Hi Travel 2026 para IA.xlsx
 *   npm run importar:proveedores -- "<ruta al .xlsx>"
 *
 * Variables de entorno (regla #2 — nunca en el código; en local se leen de
 * `.env.local`): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y,
 * opcional, ANTHROPIC_API_KEY. Sin ANTHROPIC_API_KEY las celdas ambiguas
 * quedan "sin mail" (nunca se inventa un mail) y la corrida lo deja
 * registrado en `importacion.detalle.ia.configurada = false`.
 *
 * No es una pantalla ni un endpoint público: lo corre el equipo de
 * construcción (spec §5, m1-catalogo-y-proveedores.md §2).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { mesActual } from "@/lib/ia/techo-gasto";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { crearConsultorIAMailAmbiguo } from "@/lib/importador-proveedores/ia-mail-ambiguo";
import { importarProveedores } from "@/lib/importador-proveedores/importar";

const ARCHIVO_POR_DEFECTO = "Insumos/Proveedores Hi Travel 2026 para IA.xlsx";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const rutaArchivo = resolve(process.cwd(), process.argv[2] ?? ARCHIVO_POR_DEFECTO);
  if (!existsSync(rutaArchivo)) throw new Error(`No existe el archivo: ${rutaArchivo}`);

  const admin = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const consultor = process.env.ANTHROPIC_API_KEY
    ? crearConsultorIAMailAmbiguo({
        cliente: new Anthropic(),
        registro: crearRegistroUsoIASupabase(admin),
        mes: mesActual(),
        avisar: (mensaje) => console.warn(`AVISO techo de IA: ${mensaje}`),
      })
    : null;
  if (!consultor) {
    console.warn("ANTHROPIC_API_KEY no configurada: las celdas ambiguas quedan \"sin mail\".");
  }

  const resumen = await importarProveedores({
    admin,
    rutaArchivo,
    consultarIA: consultor?.consultar ?? null,
    estadisticasIA: consultor?.estadisticas,
  });

  const { claves, ...paraMostrar } = resumen;
  console.log(JSON.stringify({ ...paraMostrar, claves: claves.length }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
