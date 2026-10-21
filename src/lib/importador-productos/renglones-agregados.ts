import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { leerCsv } from "./csv";
import { clasificarLinea, type ServicioLeido } from "./linea";

/**
 * Renglones que todavía no están en el bloque del Excel de paquetes y se
 * cargan como si estuvieran (spec M3-10, respuesta 2 del owner del
 * 2026-10-21: el Fitz Camp opcional de AR34). Viven en
 * `data/renglones-agregados.csv` (paquete, renglon, nota): el renglón se
 * escribe igual que en el Excel y se lee con las mismas reglas (`linea.ts`);
 * `nota` es el registro de la decisión y no se usa.
 *
 * Van al final del bloque (no corren el orden de los servicios que ya
 * estaban) y sin fila del Excel. Si el owner ya agregó el renglón al Excel, no
 * se duplica: se avisa para sacarlo del archivo.
 */

export const ARCHIVO_RENGLONES_AGREGADOS = "renglones-agregados.csv";

export interface RenglonAgregado {
  paquete: string;
  renglon: string;
}

export function parsearRenglonesAgregados(texto: string): RenglonAgregado[] {
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const paquete = (r.paquete ?? "").trim().toUpperCase();
    const renglon = (r.renglon ?? "").trim();
    if (!paquete || !renglon) throw new Error(`${ARCHIVO_RENGLONES_AGREGADOS}, fila ${fila}: faltan paquete o renglon.`);
    if (clasificarLinea(renglon).clase !== "servicio") {
      throw new Error(
        `${ARCHIVO_RENGLONES_AGREGADOS}, fila ${fila}: no entiendo el renglón "${renglon}" (escribilo como en el Excel: "Tipo: Servicio. Booking Supplier: Proveedor").`,
      );
    }
    return { paquete, renglon };
  });
}

/**
 * Los servicios de un paquete con sus renglones agregados al final. Devuelve
 * también los renglones que el bloque ya trae (para avisar).
 */
export function sumarRenglonesAgregados(
  codigo: string,
  servicios: ServicioLeido[],
  agregados: readonly RenglonAgregado[],
): { servicios: ServicioLeido[]; yaEnElExcel: string[] } {
  const propios = agregados.filter((a) => a.paquete === codigo);
  if (propios.length === 0) return { servicios, yaEnElExcel: [] };
  const lineas = new Set(servicios.map((s) => normalizarNombre(s.descripcion.split("\n")[0])));
  const nuevos: ServicioLeido[] = [];
  const yaEnElExcel: string[] = [];
  for (const a of propios) {
    if (lineas.has(normalizarNombre(a.renglon))) {
      yaEnElExcel.push(a.renglon);
      continue;
    }
    const leida = clasificarLinea(a.renglon);
    if (leida.clase !== "servicio") continue; // ya controlado al leer el archivo
    for (const s of leida.servicios) nuevos.push({ ...s, descripcion: a.renglon, fila: 0 });
  }
  return { servicios: [...servicios, ...nuevos], yaEnElExcel };
}
