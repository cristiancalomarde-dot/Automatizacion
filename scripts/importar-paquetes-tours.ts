/**
 * Carga los paquetes de un destino que forman los 7 tours (spec M1-04d)
 * contra la base de Supabase configurada en las variables de entorno, y deja
 * el reporte de cierre para el owner.
 *
 *   npm run importar:paquetes
 *   npm run importar:paquetes -- "<ruta al .xls de paquetes>"
 *   npm run importar:paquetes -- --codigos ODBR15,COMPBR04            (M3-46: solo esos)
 *   npm run importar:paquetes -- --codigos ODBR15,COMPBR04 --en-seco  (M3-46: qué haría, sin escribir)
 *
 * Con `--codigos` solo se tocan esos paquetes: sus códigos TourRadar, sus noches y
 * sus marcas "a pedido" también. Con `--codigos` o `--en-seco` no se reescribe el
 * reporte de `docs/` (es del catálogo entero): el resultado sale por pantalla. En
 * seco no se llama a la IA (cada llamada escribe en `uso_ia`), aunque haya clave,
 * y el cliente es `fetchSoloLectura` + `clienteEnSeco`.
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
 * Después carga `data/noches-servicio.csv` (M1-07): en qué noches del paquete
 * va cada servicio (CH10: alojamiento noche 1 y 6, W Trek noches 2 a 5; M1-08:
 * OD010D noches 1-2 en Foz y 3 en Puerto Iguazú), y `data/servicios-a-pedido.csv`
 * (M1-08): los servicios que no se piden siempre (salida de OD016, Remis de OD019).
 *
 * M3-10: `data/renglones-agregados.csv` suma al final de un bloque los renglones
 * que el owner todavía no escribió en el Excel (el Fitz Camp opcional de AR34).
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
import { refDelProyecto } from "@/lib/entorno/base-de-pruebas";
import { mesActual } from "@/lib/ia/techo-gasto";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { crearConsultorIABloque } from "@/lib/importador-productos/ia-bloque";
import { CODIGOS_PILOTO } from "@/lib/importador-productos/importar";
import { parsearNochesServicio } from "@/lib/importador-productos/noches-servicio";
import { parsearServiciosAPedido } from "@/lib/importador-productos/a-pedido";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { parsearRenglonesAgregados } from "@/lib/importador-productos/renglones-agregados";
import { leerServiciosCargados, reporteCargaMarkdown, resumirCarga } from "@/lib/importador-productos/reporte-carga";
import { correrCargaPaquetes, leerOpcionesCarga, otrosPuntosDeLaCarga } from "@/lib/importador-productos/carga-paquetes";
import { clienteEnSeco, fetchSoloLectura, resumirEscrituras } from "@/lib/importador-productos/solo-lectura";

const PAQUETES_POR_DEFECTO = "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls";
const CODIGOS_TR = "Insumos/Codigos Productos Tourradar.xlsx";
const LISTA = "data/paquetes-piloto.csv";
const NIVELES_CONFIRMADOS = "data/niveles-confirmados.csv";
const NOCHES_SERVICIO = "data/noches-servicio.csv";
const A_PEDIDO = "data/servicios-a-pedido.csv";
const RENGLONES_AGREGADOS = "data/renglones-agregados.csv";
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
  const opciones = leerOpcionesCarga(process.argv.slice(2));
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const rutaPaquetes = archivo(opciones.posicionales[0] ?? PAQUETES_POR_DEFECTO);
  const paquetes = parsearPaquetesPiloto(readFileSync(archivo(LISTA), "utf-8")).filter(
    (p) => !CODIGOS_PILOTO.includes(p.codigo),
  );
  const nivelesConfirmados = parsearNivelesConfirmados(readFileSync(archivo(NIVELES_CONFIRMADOS), "utf-8"));
  const renglonesAgregados = existsSync(resolve(process.cwd(), RENGLONES_AGREGADOS))
    ? parsearRenglonesAgregados(readFileSync(archivo(RENGLONES_AGREGADOS), "utf-8"))
    : [];
  const ajenos = renglonesAgregados.filter((r) => !paquetes.some((p) => p.codigo === r.paquete)).map((r) => r.paquete);
  if (ajenos.length) throw new Error(`${RENGLONES_AGREGADOS}: ${[...new Set(ajenos)].join(", ")} no está en ${LISTA}. No se cargó nada.`);

  const conexion = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(opciones.enSeco ? { global: { fetch: fetchSoloLectura() } } : {}),
  });
  const seco = opciones.enSeco ? clienteEnSeco(conexion) : null;
  const admin = seco?.cliente ?? conexion;

  const consultor = process.env.ANTHROPIC_API_KEY && !opciones.enSeco
    ? crearConsultorIABloque({
        cliente: new Anthropic(),
        registro: crearRegistroUsoIASupabase(admin),
        mes: mesActual(),
        avisar: (mensaje) => console.warn(`AVISO techo de IA: ${mensaje}`),
      })
    : null;
  if (!consultor && !opciones.enSeco) {
    console.warn("ANTHROPIC_API_KEY no configurada: lo que no calza con las reglas queda \"para revisar\".");
  }

  const { resumen, paquetes: elegidos, noches, aPedido, sinComprobar } = await correrCargaPaquetes({
    admin,
    rutaPaquetes,
    rutaCodigosTourRadar: existsSync(resolve(process.cwd(), CODIGOS_TR)) ? archivo(CODIGOS_TR) : null,
    interpretarIA: consultor?.interpretar ?? null,
    estadisticasIA: consultor?.estadisticas,
    nivelesConfirmados,
    paquetes,
    renglonesAgregados,
    nochesServicio: existsSync(resolve(process.cwd(), NOCHES_SERVICIO))
      ? parsearNochesServicio(readFileSync(archivo(NOCHES_SERVICIO), "utf-8"))
      : null,
    aPedido: existsSync(resolve(process.cwd(), A_PEDIDO))
      ? parsearServiciosAPedido(readFileSync(archivo(A_PEDIDO), "utf-8"))
      : null,
    codigos: opciones.codigos,
    enSeco: opciones.enSeco,
  });

  if (seco) {
    console.log(
      JSON.stringify(
        {
          enSeco: "no se escribió nada ni se llamó a la IA: esto es lo que haría",
          base: refDelProyecto(process.env.NEXT_PUBLIC_SUPABASE_URL),
          haria: resumirEscrituras(seco.escrituras),
          ia: resumen.ia,
          productos: resumen.productos.map((p) => `${p.codigo}: ${p.servicios} servicios, niveles ${p.nivelesCargados.join(", ") || "ninguno"}`),
          codigosNoEncontrados: resumen.codigosNoEncontrados,
          creados: resumen.creados,
          servicios: resumen.servicios,
          proveedoresSinResolver: resumen.nombresSinResolver,
          otrosPuntos: otrosPuntosDeLaCarga(resumen),
          nochesPorServicio: noches,
          serviciosAPedido: aPedido,
          sinComprobar: sinComprobar.length ? `Noches y marcas de ${sinComprobar.join(", ")}: el paquete todavía no está en la base.` : [],
        },
        null,
        2,
      ),
    );
    return;
  }

  const carga = resumirCarga(await leerServiciosCargados(admin, elegidos.map((p) => p.codigo)));
  if (opciones.codigos) {
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
          otrosPuntos: otrosPuntosDeLaCarga(resumen),
          nochesPorServicio: noches,
          serviciosAPedido: aPedido,
        },
        null,
        2,
      ),
    );
    return;
  }
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
        nochesPorServicio: noches,
        serviciosAPedido: aPedido,
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
