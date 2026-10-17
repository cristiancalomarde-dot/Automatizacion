/**
 * Carga el catálogo de Journaway (spec M2-08) contra la base de Supabase
 * configurada en las variables de entorno, y deja el reporte para el owner.
 *
 *   npm run importar:journaway
 *   npm run importar:journaway -- "<ruta a la planilla>" --reporte=<ruta del reporte>
 *
 * - Planilla del owner: `Insumos/Borrador productos Journaway.xlsx`, hoja
 *   "Productos Journaway" (los celestes son lo que Journaway pide).
 * - Datos: `data/journaway-proveedores.csv` (a quién se le pide cada uno),
 *   `data/journaway-composicion.csv` (los paquetes de San Pedro, parte por
 *   parte), `data/journaway-nombres.csv` (cómo los escribe Journaway) y
 *   `data/journaway-internos.csv` (el Overland privado UYUO01).
 * - Reporte: `docs/sdd/diagnosticos/M2-08-catalogo-journaway.md`.
 *
 * Antes de correrlo, la cadena de M1 al día: `importar:proveedores` (con el
 * Excel de proveedores actualizado) → `importar:equivalencias` →
 * `importar:productos` → `importar:paquetes` → `importar:tours`. Es
 * idempotente: una segunda corrida no agrega filas. Todo se valida antes de
 * escribir; si algo no cierra, no carga nada. No usa IA (#3) y no le escribe a
 * nadie (#4).
 *
 * Variables de entorno (regla #2 — nunca en el código; en local se leen de
 * `.env.local`): NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { importarCatalogoJournaway } from "@/lib/importador-journaway/importar";
import { leerInsumosJournaway } from "@/lib/importador-journaway/insumos";
import { reporteJournawayMarkdown } from "@/lib/importador-journaway/reporte";

const REPORTE_POR_DEFECTO = "docs/sdd/diagnosticos/M2-08-catalogo-journaway.md";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

async function main() {
  const raiz = process.cwd();
  const envLocal = resolve(raiz, ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const argumentos = process.argv.slice(2);
  const reporte = argumentos.find((a) => a.startsWith("--reporte="))?.slice("--reporte=".length) ?? REPORTE_POR_DEFECTO;
  const rutaPlanilla = argumentos.find((a) => !a.startsWith("--"));

  // Primero la planilla y los archivos: si algo no cierra, corta antes de abrir la base.
  const insumos = leerInsumosJournaway(raiz, rutaPlanilla ? { rutaPlanilla } : {});

  const admin = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const resumen = await importarCatalogoJournaway({ admin, insumos });

  const salida = resolve(raiz, reporte);
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(
    salida,
    reporteJournawayMarkdown({
      fecha: new Date().toISOString().slice(0, 10),
      plan: resumen.plan,
      proveedores: resumen.proveedores,
      filasProveedores: insumos.proveedores,
    }),
  );

  console.log(
    JSON.stringify(
      {
        importacion: resumen.importacionId,
        productos: resumen.plan.productos.length,
        creados: resumen.creados,
        actualizados: resumen.actualizados,
        eliminados: resumen.eliminados,
        productos_con_proveedor_faltante: resumen.filasParaRevisar,
        reporte,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
