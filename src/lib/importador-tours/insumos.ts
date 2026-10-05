import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import * as XLSX from "xlsx";
import { leerFilasPaquetes } from "@/lib/importador-productos/importar";
import { parsearPaquetesPiloto, type PaquetePiloto } from "@/lib/importador-productos/paquetes-piloto";
import { parsearCategoriasTour, parsearTramosConProveedor, type CategoriaTour, type TramoConProveedor } from "./datos";
import type { DocumentoWord } from "./importar";
import { HOJA_TOURS } from "./rutas";
import { leerParrafosDocx } from "./word";

/**
 * Los archivos que lee la carga de los tours (spec M1-05 §2), desde la raíz
 * del repo: lo usan el script (`npm run importar:tours`) y los tests de
 * integración, para que lean exactamente lo mismo.
 */

export const RUTA_RUTAS = "Insumos/RutasenBus2020.xls";
export const RUTA_PAQUETES = "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls";
/** En este orden: el principal es el de Multi Destination. */
export const RUTAS_WORD = [
  "Insumos/Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx",
  "Insumos/Two Destination Tours 1 Jun 2026 - 31 Dec 2027.docx",
  "Insumos/One Destination Tours 1 Jun 2026 - 31 Dec 2027.docx",
  "Insumos/Unique Tours 1 Jun 2026 - 31 Dec 2027.docx",
];

export interface InsumosTours {
  filasRutas: string[][];
  words: DocumentoWord[];
  filasPaquetes: string[][];
  paquetesPiloto: PaquetePiloto[];
  tramosConProveedor: TramoConProveedor[];
  categoriasTour: CategoriaTour[];
  archivos: { rutas: string; paquetes: string };
}

function archivo(raiz: string, ruta: string): string {
  const absoluta = resolve(raiz, ruta);
  if (!existsSync(absoluta)) throw new Error(`No existe el archivo: ${absoluta}`);
  return absoluta;
}

/** true si están RutasenBus, el Excel de paquetes y el Word principal. */
export function hayInsumosTours(raiz: string): boolean {
  return [RUTA_RUTAS, RUTA_PAQUETES, RUTAS_WORD[0]].every((r) => existsSync(resolve(raiz, r)));
}

export function leerInsumosTours(raiz: string): InsumosTours {
  const libro = XLSX.read(readFileSync(archivo(raiz, RUTA_RUTAS)), { type: "buffer" });
  const hoja = libro.Sheets[HOJA_TOURS];
  if (!hoja) throw new Error(`RutasenBus no tiene la hoja "${HOJA_TOURS}".`);
  const filasRutas = XLSX.utils
    .sheet_to_json<unknown[]>(hoja, { header: 1, defval: "", raw: false })
    .map((f) => f.map((c) => String(c ?? "")));
  const words = RUTAS_WORD.filter((w) => existsSync(resolve(raiz, w))).map((w) => ({
    archivo: basename(w),
    parrafos: leerParrafosDocx(readFileSync(archivo(raiz, w))),
  }));
  if (words.length === 0) throw new Error("No encontré ningún Word de catálogo en Insumos/.");
  const texto = (ruta: string) => readFileSync(archivo(raiz, ruta), "utf-8");
  return {
    filasRutas,
    words,
    filasPaquetes: leerFilasPaquetes(archivo(raiz, RUTA_PAQUETES)),
    paquetesPiloto: parsearPaquetesPiloto(texto("data/paquetes-piloto.csv")),
    tramosConProveedor: parsearTramosConProveedor(texto("data/tramos-con-proveedor.csv")),
    categoriasTour: parsearCategoriasTour(texto("data/categorias-tour.csv")),
    archivos: { rutas: basename(RUTA_RUTAS), paquetes: basename(RUTA_PAQUETES) },
  };
}
