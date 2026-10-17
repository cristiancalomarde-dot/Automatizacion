import { leerCsv } from "@/lib/importador-productos/csv";
import type { TipoServicio } from "@/lib/importador-productos/linea";
import { entero, requerirColumnas } from "./csv";

/**
 * Los dos archivos de armado de Journaway (spec M2-08 §3 #5-#7):
 *
 * - `data/journaway-composicion.csv` (paquete, orden, dia, componente, lado,
 *   nota): cada paquete de San Pedro, parte por parte y día por día, como
 *   sale del tarifario. `lado` (`solo_llegada` | `solo_salida` | vacío) es lo
 *   ÚNICO que decide el lado de un traslado dentro del paquete: la regla de
 *   buses de M1-08 no se aplica (todo es el mismo destino, o el Overland
 *   arranca desde el hotel).
 * - `data/journaway-internos.csv` (codigo, nombre, destino, orden, tipo,
 *   que_es, descripcion, noche_desde, noches, lugar, nota): los productos que
 *   no están en la planilla porque son internos (el Overland privado UYUO01),
 *   con sus servicios. El proveedor de cada uno sale de
 *   `data/journaway-proveedores.csv`, como el resto.
 */

export const LADOS = ["solo_llegada", "solo_salida"] as const;
export type Lado = (typeof LADOS)[number];

export interface FilaComposicion {
  fila: number;
  paquete: string;
  orden: number;
  dia: number;
  componente: string;
  lado: Lado | null;
}

const COLUMNAS_COMPOSICION = ["paquete", "orden", "dia", "componente", "lado", "nota"];

export function parsearComposicion(texto: string): FilaComposicion[] {
  requerirColumnas(texto, COLUMNAS_COMPOSICION, "Composición de Journaway");
  const vistos = new Map<string, number>();
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const paquete = (r.paquete ?? "").trim();
    const componente = (r.componente ?? "").trim();
    if (!paquete || !componente) throw new Error(`Composición de Journaway, fila ${fila}: falta el paquete o el componente.`);
    const orden = entero(r.orden);
    if (orden === null) throw new Error(`Composición de Journaway, fila ${fila}: orden «${r.orden}» inválido.`);
    const dia = entero(r.dia);
    if (dia === null) throw new Error(`Composición de Journaway, fila ${fila}: día «${r.dia}» inválido (1 o más).`);
    const ladoTexto = (r.lado ?? "").trim();
    if (ladoTexto && !LADOS.includes(ladoTexto as Lado)) {
      throw new Error(`Composición de Journaway, fila ${fila}: lado «${ladoTexto}» inválido (usar ${LADOS.join(" | ")} o vacío).`);
    }
    const clave = `${paquete}|${orden}`;
    const anterior = vistos.get(clave);
    if (anterior !== undefined) throw new Error(`Composición de Journaway, fila ${fila}: ${paquete} ya tiene el orden ${orden} (fila ${anterior}).`);
    vistos.set(clave, fila);
    return { fila, paquete, orden, dia, componente, lado: (ladoTexto || null) as Lado | null };
  });
}

const TIPOS: TipoServicio[] = ["alojamiento", "excursion", "traslado", "bus", "crucero", "otro"];

export interface ServicioInterno {
  orden: number;
  tipo: TipoServicio;
  /** Qué es, en corto (va en `service_provider_nombre`; en un alojamiento, el hotel). */
  queEs: string;
  descripcion: string;
  noches: { nocheDesde: number; noches: number; lugar: string | null } | null;
}

export interface ProductoInterno {
  codigo: string;
  nombre: string;
  destino: string;
  servicios: ServicioInterno[];
}

const COLUMNAS_INTERNOS = ["codigo", "nombre", "destino", "orden", "tipo", "que_es", "descripcion", "noche_desde", "noches", "lugar", "nota"];

export function parsearInternos(texto: string): ProductoInterno[] {
  requerirColumnas(texto, COLUMNAS_INTERNOS, "Productos internos de Journaway");
  const productos = new Map<string, ProductoInterno>();
  leerCsv(texto).forEach((r, i) => {
    const fila = i + 2;
    const error = (m: string) => new Error(`Productos internos de Journaway, fila ${fila}: ${m}`);
    const codigo = (r.codigo ?? "").trim();
    const nombre = (r.nombre ?? "").trim();
    const destino = (r.destino ?? "").trim();
    if (!codigo || !nombre || !destino) throw error("falta el código, el nombre o el destino.");
    const orden = entero(r.orden);
    if (orden === null) throw error(`orden «${r.orden}» inválido.`);
    const tipo = (r.tipo ?? "").trim() as TipoServicio;
    if (!TIPOS.includes(tipo)) throw error(`tipo «${r.tipo}» inválido (usar ${TIPOS.join(" | ")}).`);
    const queEs = (r.que_es ?? "").trim();
    // Un salto de línea dentro de la celda vale igual con LF o CRLF (checkout en Windows).
    const descripcion = (r.descripcion ?? "").replace(/\r\n?/g, "\n").trim();
    if (!queEs || !descripcion) throw error("falta que_es o la descripción.");
    const desde = (r.noche_desde ?? "").trim();
    const cuantas = (r.noches ?? "").trim();
    let noches: ServicioInterno["noches"] = null;
    if (desde || cuantas) {
      const d = entero(desde);
      const n = entero(cuantas);
      if (d === null || n === null) throw error("noche_desde y noches van juntas, como números de 1 en adelante.");
      noches = { nocheDesde: d, noches: n, lugar: (r.lugar ?? "").trim() || null };
    }
    const producto = productos.get(codigo) ?? { codigo, nombre, destino, servicios: [] };
    if (producto.nombre !== nombre || producto.destino !== destino) throw error(`${codigo} tiene otro nombre o destino en una fila anterior.`);
    if (producto.servicios.some((s) => s.orden === orden)) throw error(`${codigo} ya tiene el orden ${orden}.`);
    producto.servicios.push({ orden, tipo, queEs, descripcion, noches });
    productos.set(codigo, producto);
  });
  return [...productos.values()].map((p) => ({ ...p, servicios: [...p.servicios].sort((a, b) => a.orden - b.orden) }));
}
