import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { apartarBorrados, compararDirectorio, type ComparacionDirectorio, type ProveedorBorrado, type ProveedorEnBase } from "./cambios";
import { agruparProveedores, leerHojaContactos } from "./hoja";
import { resolverProveedor, type ConsultarIA, type RegistroProveedor } from "./resolver";

/**
 * Importador del directorio de proveedores (spec M1-03): lee la hoja
 * "Contactos hi" del Excel con SheetJS (del lado del servidor, stack.md),
 * carga/actualiza `proveedor` y registra la corrida en `importacion`.
 *
 * Recibe el cliente de Supabase ya creado con la service role (regla #2: la
 * clave sale de variables de entorno en quien lo llama, nunca de acá).
 *
 * Re-ejecutable (spec §3 #11): la clave de identidad es
 * `nombre_normalizado` + destino (guardado en `ciudad`); si ya existe, se
 * actualiza (mails/canal/aclaraciones/categoría) en vez de insertar otro.
 *
 * Desde M1-07, un proveedor que el owner movió de sección o renombró en el
 * Excel se reconoce y se actualiza (no se duplica; ver `cambios.ts`), y los
 * que se borraron con su OK (`data/proveedores-borrados.csv`) no vuelven.
 * Lo que está en la base y ya no en el Excel no se borra: se informa
 * (DECISIONS: "un proveedor que el owner saca del Excel no se borra solo").
 */

export const HOJA_CONTACTOS = "Contactos hi";
export const TIPO_CORRIDA = "proveedores";

export interface EstadisticasIA {
  llamadas: number;
  cortadasPorTecho: number;
  errores: number;
}

export interface ResumenImportacion {
  archivo: string;
  importacionId: string;
  filasDeProveedorLeidas: number;
  procesados: number;
  insertados: number;
  actualizados: number;
  conMail: number;
  whatsapp: number;
  sinMail: number;
  celdasAmbiguas: number;
  resueltasPorIA: number;
  mailsRechazadosIA: string[];
  ia: (EstadisticasIA & { configurada: boolean });
  /** Claves (nombre_normalizado + ciudad) de los proveedores de esta corrida. */
  claves: Array<{ nombre_normalizado: string; ciudad: string | null }>;
  /** Qué cambió respecto del directorio cargado (M1-07): altas, bajas, movidos, renombrados, contactos. */
  cambios: ComparacionDirectorio;
  /** Proveedores borrados con el OK del owner que volvieron a aparecer en el Excel (no se cargan). */
  borradosQueVolvieron: RegistroProveedor[];
}

export function leerFilasDelExcel(rutaArchivo: string): string[][] {
  const libro = XLSX.read(readFileSync(rutaArchivo), { type: "buffer" });
  const hoja = libro.Sheets[HOJA_CONTACTOS];
  if (!hoja) {
    throw new Error(`El archivo no tiene la hoja "${HOJA_CONTACTOS}".`);
  }
  return XLSX.utils.sheet_to_json<string[]>(hoja, { header: 1, defval: "", raw: false });
}

export function esSinMail(registro: Pick<RegistroProveedor, "mails" | "canal">): boolean {
  return registro.mails.length === 0 && registro.canal !== "whatsapp";
}

export async function importarProveedores(opciones: {
  admin: SupabaseClient;
  rutaArchivo: string;
  consultarIA: ConsultarIA | null;
  estadisticasIA?: () => EstadisticasIA;
  /** data/proveedores-borrados.csv (M1-07). */
  borrados?: ProveedorBorrado[];
}): Promise<ResumenImportacion> {
  const { admin } = opciones;
  const filas = leerHojaContactos(leerFilasDelExcel(opciones.rutaArchivo));
  const grupos = agruparProveedores(filas);

  // Resolución celda por celda (secuencial: las llamadas de IA pasan una a
  // una por el techo de gasto).
  let celdasAmbiguas = 0;
  let resueltasPorIA = 0;
  const mailsRechazadosIA: string[] = [];
  const todos: RegistroProveedor[] = [];
  for (const grupo of grupos) {
    const r = await resolverProveedor(grupo, opciones.consultarIA);
    todos.push(r.registro);
    celdasAmbiguas += r.celdasAmbiguas;
    resueltasPorIA += r.resueltasPorIA;
    mailsRechazadosIA.push(...r.mailsRechazadosIA);
  }

  const { quedan: registros, vueltos: borradosQueVolvieron } = apartarBorrados(todos, opciones.borrados ?? []);

  // Proveedores ya cargados, para decidir insertar vs. actualizar (y qué cambió).
  const { data: existentes, error: errorLectura } = await admin
    .from("proveedor")
    .select("id, nombre, nombre_normalizado, ciudad, mails, canal, aclaraciones")
    .range(0, 9999);
  if (errorLectura) throw new Error(`No se pudo leer proveedor: ${errorLectura.message}`);
  const cambios = compararDirectorio(registros, (existentes ?? []) as ProveedorEnBase[]);

  const ahora = new Date().toISOString();
  const aActualizar: Array<RegistroProveedor & { id: string; updated_at: string }> = [];
  const aInsertar: RegistroProveedor[] = [];
  registros.forEach((registro, i) => {
    const id = cambios.idDe[i];
    if (id) aActualizar.push({ ...registro, id, updated_at: ahora });
    else aInsertar.push(registro);
  });

  if (aActualizar.length) {
    const { error } = await admin.from("proveedor").upsert(aActualizar, { onConflict: "id" });
    if (error) throw new Error(`No se pudieron actualizar proveedores: ${error.message}`);
  }
  if (aInsertar.length) {
    const { error } = await admin.from("proveedor").insert(aInsertar);
    if (error) throw new Error(`No se pudieron insertar proveedores: ${error.message}`);
  }

  const conMail = registros.filter((r) => r.mails.length > 0).length;
  const whatsapp = registros.filter((r) => r.mails.length === 0 && r.canal === "whatsapp").length;
  const sinMail = registros.filter(esSinMail).length;
  const ia = {
    configurada: opciones.consultarIA !== null,
    ...(opciones.estadisticasIA?.() ?? { llamadas: 0, cortadasPorTecho: 0, errores: 0 }),
  };
  const archivo = basename(opciones.rutaArchivo);

  const { data: importacion, error: errorImportacion } = await admin
    .from("importacion")
    .insert({
      archivo,
      tipo_corrida: TIPO_CORRIDA,
      filas_cargadas: registros.length,
      filas_para_revisar: sinMail,
      detalle: {
        hoja: HOJA_CONTACTOS,
        filas_de_proveedor_leidas: filas.length,
        proveedores_procesados: registros.length,
        insertados: aInsertar.length,
        actualizados: aActualizar.length,
        con_mail: conMail,
        whatsapp,
        sin_mail: sinMail,
        celdas_ambiguas: celdasAmbiguas,
        resueltas_por_ia: resueltasPorIA,
        mails_rechazados_ia: mailsRechazadosIA,
        ia,
        cambios: {
          altas: cambios.altas.map((a) => ({ nombre: a.nombre, ciudad: a.ciudad })),
          bajas: cambios.bajas.map((b) => ({ id: b.id, nombre: b.nombre, ciudad: b.ciudad })),
          movidos: cambios.movidos,
          renombrados: cambios.renombrados,
          contactos: cambios.cambiosContacto,
        },
        borrados_que_volvieron: borradosQueVolvieron.map((r) => ({ nombre: r.nombre, ciudad: r.ciudad })),
      },
    })
    .select("id")
    .single();
  if (errorImportacion) {
    throw new Error(`No se pudo registrar la importación: ${errorImportacion.message}`);
  }

  return {
    archivo,
    importacionId: importacion.id,
    filasDeProveedorLeidas: filas.length,
    procesados: registros.length,
    insertados: aInsertar.length,
    actualizados: aActualizar.length,
    conMail,
    whatsapp,
    sinMail,
    celdasAmbiguas,
    resueltasPorIA,
    mailsRechazadosIA,
    ia,
    claves: registros.map((r) => ({ nombre_normalizado: r.nombre_normalizado, ciudad: r.ciudad })),
    cambios,
    borradosQueVolvieron,
  };
}
