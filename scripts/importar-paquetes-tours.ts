/**
 * Carga los paquetes de un destino que forman los 7 tours (spec M1-04d)
 * contra la base de Supabase configurada en las variables de entorno, y deja
 * el reporte de cierre para el owner.
 *
 *   npm run importar:paquetes
 *   npm run importar:paquetes -- "<ruta al .xls de paquetes>"
 *
 * - Lista de paquetes: `data/paquetes-piloto.csv`, sin los 5 de Iguazú (los
 *   carga `npm run importar:productos` desde su archivo, M1-04; no cambian).
 * - Excel vigente: `Insumos/Construccion de Paquetes 2019 con 3 y 4
 *   estrellas.xls` (hoja "Analisis a Mayo 2026"); cada paquete se ubica por
 *   su código en toda la hoja.
 * - Niveles confirmados: `data/niveles-confirmados.csv`. Equivalencias: las
 *   de la base (`npm run importar:equivalencias`, por destino).
 * - Códigos TourRadar: `Insumos/Codigos Productos Tourradar.xlsx`.
 *
 * Antes de correrlo: `npm run importar:proveedores` (directorio al día) y
 * `npm run importar:equivalencias`. Es idempotente: una segunda corrida no
 * agrega filas. Escribe `docs/sdd/diagnosticos/M1-04d-carga.md`.
 *
 * Variables de entorno (regla #2 — nunca en el código; en local se leen de
 * `.env.local`): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y,
 * opcional, ANTHROPIC_API_KEY (sin clave, lo que no calza queda "para
 * revisar"; regla #3).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { mesActual } from "@/lib/ia/techo-gasto";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { crearConsultorIABloque } from "@/lib/importador-productos/ia-bloque";
import { CODIGOS_PILOTO, importarProductosSimples } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { leerServiciosCargados, reporteCargaMarkdown, resumirCarga } from "@/lib/importador-productos/reporte-carga";
import { otrosPuntosDeLaCarga, TIPO_CORRIDA_PAQUETES } from "@/lib/importador-productos/carga-paquetes";

const PAQUETES_POR_DEFECTO = "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls";
const CODIGOS_TR = "Insumos/Codigos Productos Tourradar.xlsx";
const LISTA = "data/paquetes-piloto.csv";
const NIVELES_CONFIRMADOS = "data/niveles-confirmados.csv";
const REPORTE = "docs/sdd/diagnosticos/M1-04d-carga.md";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

function archivo(ruta: string): string {
  const absoluta = resolve(process.cwd(), ruta);
  if (!existsSync(absoluta)) throw new Error(`No existe el archivo: ${absoluta}`);
  return absoluta;
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const rutaPaquetes = archivo(process.argv[2] ?? PAQUETES_POR_DEFECTO);
  const paquetes = parsearPaquetesPiloto(readFileSync(archivo(LISTA), "utf-8")).filter(
    (p) => !CODIGOS_PILOTO.includes(p.codigo),
  );
  const nivelesConfirmados = parsearNivelesConfirmados(readFileSync(archivo(NIVELES_CONFIRMADOS), "utf-8"));

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
    rutaCodigosTourRadar: existsSync(resolve(process.cwd(), CODIGOS_TR)) ? archivo(CODIGOS_TR) : null,
    interpretarIA: consultor?.interpretar ?? null,
    estadisticasIA: consultor?.estadisticas,
    nivelesConfirmados,
    paquetes,
    tipoCorrida: TIPO_CORRIDA_PAQUETES,
  });

  const carga = resumirCarga(await leerServiciosCargados(admin, paquetes.map((p) => p.codigo)));
  // Iguazú (M1-04) no se recarga acá, pero lo que le falta también es del piloto.
  const iguazu = resumirCarga(await leerServiciosCargados(admin, CODIGOS_PILOTO)).sinResolver.map(
    (s) => `Iguazú (cargado en M1-04) — ${s.codigo}${s.fila ? ` (fila ${s.fila})` : ""}: ${s.serviceProvider} → «${s.bookingSupplier ?? ""}». ${s.motivo}.`,
  );
  const salida = resolve(process.cwd(), REPORTE);
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(
    salida,
    reporteCargaMarkdown(carga, {
      fecha: new Date().toISOString().slice(0, 10),
      archivo: basename(rutaPaquetes),
      otrosPuntos: [...otrosPuntosDeLaCarga(resumen), ...iguazu],
    }),
  );

  console.log(
    JSON.stringify(
      {
        importacionId: resumen.importacionId,
        productos: resumen.productos.length,
        codigosNoEncontrados: resumen.codigosNoEncontrados,
        creados: resumen.creados,
        servicios: resumen.servicios,
        totales: carga.totales,
        sinResolver: carga.sinResolver.length,
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
