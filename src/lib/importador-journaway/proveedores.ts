import { leerCsv } from "@/lib/importador-productos/csv";
import { resolverProveedor, type IndiceProveedores } from "@/lib/importador-productos/proveedores";
import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { entero, requerirColumnas } from "./csv";

/**
 * A quién se le pide cada producto de Journaway (spec M2-08 §3 #3 y #4),
 * `data/journaway-proveedores.csv`: código, proveedor, prioridad, modo y nota.
 *
 * - `proveedor`: el nombre como está en el directorio (o el sistema, si es
 *   `manual`). Traduce el texto libre de la planilla ("Lado Argentino Premium
 *   (Cuenca del Plata)", "Plataforma10 (si no hay lugar…)").
 * - `prioridad`: 1 = la primera opción; 2 = la alternativa (BUS02 y BUS03:
 *   Plataforma10 y, si no hay lugar, Patagonia Planet).
 * - `modo`: `alias` (se busca en el directorio) o `manual` (no se le escribe a
 *   nadie: Plataforma10, Transvip, Kupos; queda como tarea, como en M1).
 * - `nota`: de dónde sale el dato (planilla, owner, tarifario).
 *
 * La búsqueda es la de M1 (nombre exacto normalizado, equivalencias y
 * desempate por destino). Un nombre que no está queda "sin resolver"; nunca
 * se crea un proveedor.
 */

export const MODOS_JOURNAWAY = ["alias", "manual"] as const;
export type ModoJournaway = (typeof MODOS_JOURNAWAY)[number];

export interface FilaProveedorJournaway {
  fila: number;
  codigo: string;
  proveedor: string;
  prioridad: number;
  modo: ModoJournaway;
  nota: string | null;
}

const COLUMNAS = ["codigo", "proveedor", "prioridad", "modo", "nota"];

export function parsearProveedoresJournaway(texto: string): FilaProveedorJournaway[] {
  requerirColumnas(texto, COLUMNAS, "Proveedores de Journaway");
  const vistos = new Map<string, number>();
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const codigo = (r.codigo ?? "").trim();
    if (!codigo) throw new Error(`Proveedores de Journaway, fila ${fila}: falta el código.`);
    const proveedor = (r.proveedor ?? "").replace(/\s+/gu, " ").trim();
    if (!proveedor) throw new Error(`Proveedores de Journaway, fila ${fila}: falta el proveedor de ${codigo}.`);
    const prioridad = entero(r.prioridad);
    if (prioridad === null) throw new Error(`Proveedores de Journaway, fila ${fila}: prioridad «${r.prioridad}» inválida (1, 2…).`);
    const modo = (r.modo ?? "").trim() as ModoJournaway;
    if (!MODOS_JOURNAWAY.includes(modo)) {
      throw new Error(`Proveedores de Journaway, fila ${fila}: modo «${r.modo}» inválido (usar ${MODOS_JOURNAWAY.join(" | ")}).`);
    }
    const clave = `${codigo}|${prioridad}`;
    const anterior = vistos.get(clave);
    if (anterior !== undefined) {
      throw new Error(`Proveedores de Journaway, fila ${fila}: ${codigo} ya tiene la prioridad ${prioridad} (fila ${anterior}).`);
    }
    vistos.set(clave, fila);
    const nota = (r.nota ?? "").trim();
    return { fila, codigo, proveedor, prioridad, modo, nota: nota || null };
  });
}

/** Una opción de proveedor de un producto, ya buscada en el directorio. */
export interface OpcionProveedor {
  prioridad: number;
  /** Como lo nombra el archivo (o la planilla, si el owner lo cambió). */
  proveedorNombre: string;
  proveedorId: string | null;
  manual: boolean;
  sinResolver: boolean;
  /** Se resolvió con una equivalencia que el owner todavía tiene que confirmar. */
  paraRevisar: boolean;
  /** El motivo para mostrar, si hay uno propio (si no, la pantalla dice "no está en el directorio"). */
  nota: string | null;
  /** El CONFIRMADO de la planilla no es "ok" ni el proveedor del archivo. */
  cambioEnPlanilla: boolean;
}

function sinAcentos(texto: string): string {
  return normalizarNombre(texto).normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Las opciones de proveedor de un producto. Si el owner cambió el CONFIRMADO
 * de la planilla (no dice "ok" ni el proveedor de la primera opción del
 * archivo), el producto queda con una sola opción "sin resolver" con lo que
 * dice la planilla: no se le pide al de antes hasta actualizar el archivo.
 */
export function resolverProveedoresDeProducto(opciones: {
  codigo: string;
  destino: string | null;
  /** Columna PROVEEDOR CONFIRMADO de la planilla; vacío o "ok" = el sugerido. */
  confirmado: string;
  filas: FilaProveedorJournaway[];
  indice: IndiceProveedores;
}): OpcionProveedor[] {
  const { codigo, destino, indice } = opciones;
  const filas = opciones.filas.filter((f) => f.codigo === codigo).sort((a, b) => a.prioridad - b.prioridad);
  if (filas.length === 0) {
    throw new Error(`Proveedores de Journaway: ${codigo} no tiene proveedor en la lista. No se cargó nada.`);
  }
  const confirmado = opciones.confirmado.replace(/\s+/gu, " ").trim();
  if (confirmado && sinAcentos(confirmado) !== "ok" && sinAcentos(confirmado) !== sinAcentos(filas[0].proveedor)) {
    return [
      {
        prioridad: 1,
        proveedorNombre: confirmado,
        proveedorId: null,
        manual: false,
        sinResolver: true,
        paraRevisar: false,
        nota: `Cambió en la planilla: ahora dice «${confirmado}» y la carga tenía «${filas[0].proveedor}». Hay que revisarlo antes de pedirlo.`,
        cambioEnPlanilla: true,
      },
    ];
  }
  return filas.map((f) => {
    if (f.modo === "manual") {
      return { prioridad: f.prioridad, proveedorNombre: f.proveedor, proveedorId: null, manual: true, sinResolver: false, paraRevisar: false, nota: null, cambioEnPlanilla: false };
    }
    const r = resolverProveedor(f.proveedor, indice, { destino });
    return {
      prioridad: f.prioridad,
      proveedorNombre: f.proveedor,
      proveedorId: r.id,
      manual: r.manual === true,
      sinResolver: r.id === null && r.manual !== true,
      paraRevisar: r.paraRevisar,
      nota: r.nota,
      cambioEnPlanilla: false,
    };
  });
}
