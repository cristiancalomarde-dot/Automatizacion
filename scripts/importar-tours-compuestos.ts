/**
 * Carga los 7 tours compuestos (spec M1-05) contra la base de Supabase
 * configurada en las variables de entorno, y deja el reporte para el owner.
 *
 *   npm run importar:tours
 *
 * - Códigos de cada tour: `Insumos/RutasenBus2020.xls`, hoja "Tours 2027".
 * - Itinerarios: los 4 Word de catálogo de `Insumos/` (primero el de Multi
 *   Destination).
 * - Noches de cada paquete vendido solo: el Excel de paquetes.
 * - Paquetes y su destino: `data/paquetes-piloto.csv` (ya cargados con
 *   `npm run importar:productos` y `npm run importar:paquetes`).
 * - Buses que reserva un proveedor: `data/tramos-con-proveedor.csv`.
 * - Categorías tour ↔ paquete: `data/categorias-tour.csv`.
 *
 * Es idempotente: una segunda corrida no agrega filas. Escribe
 * `docs/sdd/diagnosticos/M1-05-tours.md`.
 *
 * Variables de entorno (regla #2 — nunca en el código; en local se leen de
 * `.env.local`): NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. No usa
 * IA: lo que las reglas no leen queda para revisar (regla #3).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { importarToursCompuestos } from "@/lib/importador-tours/importar";
import { leerInsumosTours } from "@/lib/importador-tours/insumos";
import { reporteToursMarkdown } from "@/lib/importador-tours/reporte";

const REPORTE = "docs/sdd/diagnosticos/M1-05-tours.md";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

async function main() {
  const raiz = process.cwd();
  const envLocal = resolve(raiz, ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const insumos = leerInsumosTours(raiz);
  const admin = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const resumen = await importarToursCompuestos({ admin, ...insumos });

  const salida = resolve(raiz, REPORTE);
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(
    salida,
    reporteToursMarkdown(resumen, {
      fecha: new Date().toISOString().slice(0, 10),
      archivos: [insumos.archivos.rutas, ...insumos.words.map((w) => w.archivo), insumos.archivos.paquetes],
    }),
  );

  console.log(
    JSON.stringify(
      {
        importacionId: resumen.importacionId,
        tours: resumen.tours.map((t) => `${t.codigo}: ${t.estado}${t.motivos.length ? ` (${t.motivos.join("; ")})` : ""}`),
        creados: resumen.creados,
        actualizados: resumen.actualizados,
        eliminados: resumen.eliminados,
        filasParaRevisar: resumen.filasParaRevisar,
        reporte: REPORTE,
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
