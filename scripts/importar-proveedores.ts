/**
 * Corre el importador del directorio de proveedores (spec M1-03) contra la
 * base de Supabase configurada en las variables de entorno.
 *
 *   npm run importar:proveedores                      # usa Insumos/Proveedores Hi Travel 2026 para IA.xlsx
 *   npm run importar:proveedores -- "<ruta al .xlsx>"
 *   npm run importar:proveedores -- --reporte=docs/sdd/diagnosticos/M1-07-recarga.md
 *
 * Con `--reporte=<ruta>` deja el reporte para el owner de qué cambió en el
 * directorio (altas, bajas, cambios de contacto) y lo que no cierra (M1-07).
 * "Qué cambió" es de esa corrida: una segunda corrida con el mismo Excel ya no
 * tiene cambios (las bajas y lo que no cierra sí se recalculan siempre). Los
 * cambios de cada corrida quedan en `importacion.detalle.cambios`.
 * Lee `data/proveedores-borrados.csv`: los borrados con el OK del owner no
 * vuelven aunque el Excel los traiga (se avisan).
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { mesActual } from "@/lib/ia/techo-gasto";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { crearConsultorIAMailAmbiguo } from "@/lib/importador-proveedores/ia-mail-ambiguo";
import { parsearProveedoresBorrados } from "@/lib/importador-proveedores/cambios";
import { importarProveedores } from "@/lib/importador-proveedores/importar";
import { reporteRecargaMarkdown } from "@/lib/importador-proveedores/reporte-recarga";
import type { RegistroProveedor } from "@/lib/importador-proveedores/resolver";

const ARCHIVO_POR_DEFECTO = "Insumos/Proveedores Hi Travel 2026 para IA.xlsx";
const BORRADOS = "data/proveedores-borrados.csv";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const argumentos = process.argv.slice(2);
  const reporte = argumentos.find((a) => a.startsWith("--reporte="))?.slice("--reporte=".length) ?? null;
  const posicional = argumentos.find((a) => !a.startsWith("--"));
  const rutaArchivo = resolve(process.cwd(), posicional ?? ARCHIVO_POR_DEFECTO);
  if (!existsSync(rutaArchivo)) throw new Error(`No existe el archivo: ${rutaArchivo}`);

  const borrados = existsSync(resolve(process.cwd(), BORRADOS))
    ? parsearProveedoresBorrados(readFileSync(resolve(process.cwd(), BORRADOS), "utf-8"))
    : [];

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
    borrados,
  });

  if (reporte) {
    const { data: directorio, error } = await admin
      .from("proveedor")
      .select("id, nombre, nombre_normalizado, ciudad, mails, canal, aclaraciones")
      .range(0, 9999);
    if (error) throw new Error(`No se pudo leer el directorio: ${error.message}`);
    const { data: servicios, error: errorServicios } = await admin
      .from("producto_servicio")
      .select("service_provider_id, booking_supplier_id, producto:producto_id(codigo)")
      .range(0, 99999);
    if (errorServicios) throw new Error(`No se pudo leer los servicios: ${errorServicios.message}`);
    const enUso = new Map<string, string[]>();
    for (const s of (servicios ?? []) as unknown as Array<{ service_provider_id: string | null; booking_supplier_id: string | null; producto: { codigo: string } }>) {
      for (const id of [s.service_provider_id, s.booking_supplier_id]) {
        if (!id) continue;
        const lista = enUso.get(id) ?? [];
        if (!lista.includes(s.producto.codigo)) lista.push(s.producto.codigo);
        enUso.set(id, lista.sort());
      }
    }
    const salida = resolve(process.cwd(), reporte);
    mkdirSync(dirname(salida), { recursive: true });
    writeFileSync(
      salida,
      reporteRecargaMarkdown({
        fecha: new Date().toISOString().slice(0, 10),
        archivo: basename(rutaArchivo),
        resumen: { procesados: resumen.procesados, insertados: resumen.insertados, actualizados: resumen.actualizados },
        cambios: resumen.cambios,
        borrados,
        borradosQueVolvieron: resumen.borradosQueVolvieron,
        directorio: (directorio ?? []) as Array<RegistroProveedor & { id: string }>,
        enUso,
      }),
    );
  }

  const { claves, cambios, ...paraMostrar } = resumen;
  console.log(
    JSON.stringify(
      {
        ...paraMostrar,
        claves: claves.length,
        cambios: {
          altas: cambios.altas.length,
          bajas: cambios.bajas.length,
          movidos: cambios.movidos.length,
          renombrados: cambios.renombrados.length,
          contactos: cambios.cambiosContacto.length,
        },
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
