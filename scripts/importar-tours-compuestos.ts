/**
 * Carga los 7 tours compuestos (spec M1-05) contra la base de Supabase
 * configurada en las variables de entorno, y deja el reporte para el owner.
 *
 *   npm run importar:tours
 *   npm run importar:tours -- --codigos BR18            (M3-46: solo esos tours)
 *   npm run importar:tours -- --codigos BR18 --en-seco  (M3-46: qué haría, sin escribir)
 *
 * Con `--codigos` o `--en-seco` no se reescriben los reportes de `docs/` (son
 * del catálogo entero): el resultado sale por pantalla. En seco, el cliente es
 * `fetchSoloLectura` + `clienteEnSeco`: lee la base y no escribe en ninguna tabla.
 * Lee la base tal como está: un paquete todavía sin cargar da "falta el paquete".
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
import { refDelProyecto } from "@/lib/entorno/base-de-pruebas";
import { leerOpcionesCarga } from "@/lib/importador-productos/carga-paquetes";
import { clienteEnSeco, fetchSoloLectura, resumirEscrituras } from "@/lib/importador-productos/solo-lectura";
import { importarToursCompuestos } from "@/lib/importador-tours/importar";
import { leerInsumosTours, toursDesconocidos } from "@/lib/importador-tours/insumos";
import { reporteToursMarkdown } from "@/lib/importador-tours/reporte";
import { reporteTrasladosMarkdown } from "@/lib/importador-tours/reporte-traslados";

const REPORTE = "docs/sdd/diagnosticos/M1-05-tours.md";
const REPORTE_TRASLADOS = "docs/sdd/diagnosticos/M1-08-traslados.md";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

async function main() {
  const opciones = leerOpcionesCarga(process.argv.slice(2));
  if (opciones.posicionales.length) throw new Error(`No entiendo ${opciones.posicionales.join(" ")}. Las opciones son --codigos y --en-seco.`);
  const raiz = process.cwd();
  const envLocal = resolve(raiz, ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const insumos = leerInsumosTours(raiz);
  if (opciones.codigos) {
    const desconocidos = toursDesconocidos(insumos, opciones.codigos);
    if (desconocidos.length) throw new Error(`${desconocidos.join(", ")} no está ni en RutasenBus ni en los Word. No se cargó nada.`);
  }
  const conexion = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(opciones.enSeco ? { global: { fetch: fetchSoloLectura() } } : {}),
  });
  const seco = opciones.enSeco ? clienteEnSeco(conexion) : null;
  const resumen = await importarToursCompuestos({
    admin: seco?.cliente ?? conexion,
    ...insumos,
    ...(opciones.codigos ? { tours: opciones.codigos } : {}),
  });

  const conReportes = !opciones.enSeco && !opciones.codigos;
  if (conReportes) {
    const salida = resolve(raiz, REPORTE);
    mkdirSync(dirname(salida), { recursive: true });
    writeFileSync(
      salida,
      reporteToursMarkdown(resumen, {
        fecha: new Date().toISOString().slice(0, 10),
        archivos: [insumos.archivos.rutas, ...insumos.words.map((w) => w.archivo), insumos.archivos.paquetes],
      }),
    );

    writeFileSync(
      resolve(raiz, REPORTE_TRASLADOS),
      reporteTrasladosMarkdown(
        { tours: resumen.tours.filter((t) => t.estado === "armado"), sinSentido: resumen.trasladosSinSentido },
        { fecha: new Date().toISOString().slice(0, 10) },
      ),
    );
  }

  console.log(
    JSON.stringify(
      {
        ...(seco
          ? {
              enSeco: "no se escribió nada: esto es lo que haría",
              base: refDelProyecto(process.env.NEXT_PUBLIC_SUPABASE_URL),
              haria: resumirEscrituras(seco.escrituras),
              detalle: resumen.tours.map((t) => ({
                codigo: t.codigo,
                componentes: t.componentes.map((c) => `${c.orden} ${c.codigo ?? c.descripcionRuta} día ${c.diaDesde}${c.noches ? `, ${c.noches} n` : ""}`),
                buses: t.serviciosPropios.map((s) => `${s.sentido} día ${s.diaDesde}, ${s.bookingSupplier}${s.reservaManual ? " (a mano)" : ""}`),
              })),
            }
          : { importacionId: resumen.importacionId }),
        tours: resumen.tours.map((t) => `${t.codigo}: ${t.estado}${t.motivos.length ? ` (${t.motivos.join("; ")})` : ""}`),
        creados: resumen.creados,
        actualizados: resumen.actualizados,
        eliminados: resumen.eliminados,
        filasParaRevisar: resumen.filasParaRevisar,
        trasladosSinSentido: resumen.trasladosSinSentido.length,
        ...(conReportes ? { reporte: REPORTE, reporteTraslados: REPORTE_TRASLADOS } : {}),
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
