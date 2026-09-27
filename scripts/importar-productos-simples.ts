/**
 * Corre el importador de productos simples piloto de Iguazú (spec M1-04)
 * contra la base de Supabase configurada en las variables de entorno.
 *
 *   npm run importar:productos
 *   npm run importar:productos -- "<ruta al .xlsm de paquetes>" "<ruta al .xlsx de códigos TourRadar>"
 *
 * Por defecto usa los archivos de `Insumos/` (hoja "Analisis a Mayo 2026" y
 * "Codigos Productos Tourradar.xlsx").
 *
 * Variables de entorno (regla #2 — nunca en el código; en local se leen de
 * `.env.local`): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y,
 * opcional, ANTHROPIC_API_KEY. Sin ANTHROPIC_API_KEY los bloques/líneas que
 * no calzan con las reglas quedan "para revisar" (nunca se inventa un dato) y
 * la corrida lo deja registrado en `importacion.detalle.ia.configurada = false`.
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
import { crearConsultorIABloque } from "@/lib/importador-productos/ia-bloque";
import { importarProductosSimples } from "@/lib/importador-productos/importar";

const PAQUETES_POR_DEFECTO = "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas para IA.xlsm";
const CODIGOS_TR_POR_DEFECTO = "Insumos/Codigos Productos Tourradar.xlsx";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

function archivo(argumento: string | undefined, porDefecto: string): string {
  const ruta = resolve(process.cwd(), argumento ?? porDefecto);
  if (!existsSync(ruta)) throw new Error(`No existe el archivo: ${ruta}`);
  return ruta;
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const rutaPaquetes = archivo(process.argv[2], PAQUETES_POR_DEFECTO);
  const rutaCodigosTourRadar = archivo(process.argv[3], CODIGOS_TR_POR_DEFECTO);

  const admin = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const consultor = process.env.ANTHROPIC_API_KEY
    ? crearConsultorIABloque({
        cliente: new Anthropic(),
        registro: crearRegistroUsoIASupabase(admin),
        mes: mesActual(),
        avisar: (mensaje) => console.warn(`AVISO techo de IA: ${mensaje}`),
      })
    : null;
  if (!consultor) {
    console.warn("ANTHROPIC_API_KEY no configurada: lo que no calza con las reglas queda \"para revisar\".");
  }

  const resumen = await importarProductosSimples({
    admin,
    rutaPaquetes,
    rutaCodigosTourRadar,
    interpretarIA: consultor?.interpretar ?? null,
    estadisticasIA: consultor?.estadisticas,
  });

  console.log(JSON.stringify(resumen, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
