import { leerCsv } from "@/lib/importador-productos/csv";
import { normalizarNombre } from "./emparejar";

/**
 * Productos que existen en el catálogo de HI Travel pero todavía no están
 * cargados en el sistema (owner, 2026-10-14 y 2026-10-16, roadmap M2 §3): ARCH33EXP,
 * ARBR23, ARUY01 y OD014. Viven en `data/productos-no-cargados.csv`, una fila por
 * código o nombre de agencia que los nombra (codigo, nombre, agencia,
 * codigo_agencia, nombre_agencia, nota).
 *
 * No van a `codigo_externo` (no hay producto al que apuntar): el emparejado
 * los reconoce con `===` (el nombre, después de normalizar) y deja la reserva
 * "para revisión" sin preguntarle a la IA. Cuando se cargue el producto, sus
 * filas salen de acá y pasan a los códigos de la agencia.
 */

export const ARCHIVO_PRODUCTOS_NO_CARGADOS = "productos-no-cargados.csv";
const ARCHIVO = ARCHIVO_PRODUCTOS_NO_CARGADOS;

export interface ProductoNoCargado {
  fila: number;
  /** Nuestro código (ARCH33EXP). */
  codigo: string;
  nombre: string;
  agencia: string;
  /** El código tal como lo escribe la agencia (completo: `HI_TRAVEL_ARCH_EXP-677`, `150104`). */
  codigoAgencia: string | null;
  /** El nombre tal como lo escribe la agencia (se compara normalizado). */
  nombreAgencia: string | null;
}

export function leerProductosNoCargados(textoCsv: string): ProductoNoCargado[] {
  const vistos = new Map<string, number>();
  return leerCsv(textoCsv).map((f, i) => {
    const fila = i + 2; // 1 = encabezado
    const codigo = (f.codigo ?? "").trim();
    const agencia = (f.agencia ?? "").trim();
    const codigoAgencia = (f.codigo_agencia ?? "").trim() || null;
    const nombreAgencia = (f.nombre_agencia ?? "").trim() || null;
    if (!codigo) throw new Error(`${ARCHIVO} fila ${fila}: falta el código HI Travel.`);
    if (!agencia) throw new Error(`${ARCHIVO} fila ${fila}: falta la agencia.`);
    if (!codigoAgencia && !nombreAgencia) throw new Error(`${ARCHIVO} fila ${fila}: falta el código o el nombre de la agencia.`);
    for (const [clave, texto] of [
      [codigoAgencia && `c|${agencia}|${codigoAgencia}`, `el código ${codigoAgencia}`],
      [nombreAgencia && `n|${agencia}|${normalizarNombre(nombreAgencia)}`, `el nombre ${nombreAgencia}`],
    ] as const) {
      if (!clave) continue;
      const anterior = vistos.get(clave);
      if (anterior) throw new Error(`${ARCHIVO} fila ${fila}: ${texto} de ${agencia} ya figura en la fila ${anterior}.`);
      vistos.set(clave, fila);
    }
    return { fila, codigo, nombre: (f.nombre ?? "").trim() || codigo, agencia, codigoAgencia, nombreAgencia };
  });
}

/** El producto no cargado de ESA agencia con alguno de esos códigos (exactos) o ese nombre (normalizado). */
export function buscarNoCargado(
  lista: readonly ProductoNoCargado[],
  agencia: string,
  pedido: { codigos: string[]; nombre: string | null },
): ProductoNoCargado | null {
  const deLaAgencia = lista.filter((p) => p.agencia === agencia);
  for (const codigo of pedido.codigos) {
    const p = deLaAgencia.find((x) => x.codigoAgencia === codigo);
    if (p) return p;
  }
  const nombre = pedido.nombre ? normalizarNombre(pedido.nombre) : "";
  if (!nombre) return null;
  return deLaAgencia.find((x) => x.nombreAgencia && normalizarNombre(x.nombreAgencia) === nombre) ?? null;
}

