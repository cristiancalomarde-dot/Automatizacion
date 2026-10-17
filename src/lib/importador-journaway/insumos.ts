import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsearComposicion, parsearInternos, type FilaComposicion, type ProductoInterno } from "./composicion";
import { parsearNombres, type NombreJournaway } from "./nombres";
import { RUTA_PLANILLA_JOURNAWAY, abrirPlanillaJournaway, leerPlanillaJournaway, type FilaPlanilla } from "./planilla";
import { parsearProveedoresJournaway, type FilaProveedorJournaway } from "./proveedores";

/** Los archivos de datos del catálogo de Journaway (spec M2-08, Anexo técnico). */
export const ARCHIVOS_JOURNAWAY = {
  proveedores: "data/journaway-proveedores.csv",
  composicion: "data/journaway-composicion.csv",
  nombres: "data/journaway-nombres.csv",
  internos: "data/journaway-internos.csv",
} as const;

export interface InsumosJournaway {
  archivo: string;
  planilla: FilaPlanilla[];
  proveedores: FilaProveedorJournaway[];
  composicion: FilaComposicion[];
  internos: ProductoInterno[];
  nombres: NombreJournaway[];
}

export function hayPlanillaJournaway(raiz: string, ruta: string = RUTA_PLANILLA_JOURNAWAY): boolean {
  return existsSync(resolve(raiz, ruta));
}

/**
 * Lee y valida la planilla y los cuatro archivos. Cualquier error corta acá,
 * antes de abrir la base. `textos` reemplaza el contenido de un archivo de
 * `data/` (los tests prueban copias con un dato cambiado).
 */
export function leerInsumosJournaway(
  raiz: string,
  opciones: { rutaPlanilla?: string; textos?: Partial<Record<keyof typeof ARCHIVOS_JOURNAWAY, string>> } = {},
): InsumosJournaway {
  const rutaPlanilla = resolve(raiz, opciones.rutaPlanilla ?? RUTA_PLANILLA_JOURNAWAY);
  if (!existsSync(rutaPlanilla)) throw new Error(`No existe la planilla de Journaway: ${rutaPlanilla}`);
  const texto = (clave: keyof typeof ARCHIVOS_JOURNAWAY) =>
    opciones.textos?.[clave] ?? readFileSync(resolve(raiz, ARCHIVOS_JOURNAWAY[clave]), "utf-8");
  return {
    archivo: opciones.rutaPlanilla ?? RUTA_PLANILLA_JOURNAWAY,
    planilla: leerPlanillaJournaway(abrirPlanillaJournaway(rutaPlanilla)),
    proveedores: parsearProveedoresJournaway(texto("proveedores")),
    composicion: parsearComposicion(texto("composicion")),
    internos: parsearInternos(texto("internos")),
    nombres: parsearNombres(texto("nombres")),
  };
}
