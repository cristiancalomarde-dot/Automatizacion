import { leerCsv } from "@/lib/importador-productos/csv";
import { primeraCiudad, ultimaCiudad } from "./ciudades";
import { normalizarCategoria } from "./rutas";
import { leerIncluidos, type ItemIncluido } from "./word";

/**
 * Los dos archivos de datos de M1-05 (spec §3 #6 y #8, "Datos, no código"):
 * los completa el owner sin tocar el programa.
 *
 * - `data/tramos-con-proveedor.csv` (tour, ruta, booking_supplier, nota y,
 *   opcional, ambos_sentidos si/no): los
 *   buses que reserva un proveedor y que, por eso, van como servicio propio
 *   del tour y no como `tramo_bus`. La ruta se escribe "Bus A – B"; vale en
 *   los dos sentidos (BOCHI04R hace el mismo bus al revés).
 * - `data/categorias-tour.csv` (tour, categoria_tour, componente,
 *   categoria_paquete, nota): qué categoría del paquete corresponde a una
 *   categoría del tour cuando no es la misma.
 *
 * - `data/transfers-tour.csv` (M1-07): excepciones a la regla de transfers.
 *
 * - `data/incluidos-tour.csv` (M3-46; tour, incluye, nota): reemplaza lo que
 *   incluye el Word de un tour cuando no cuenta la secuencia real (BR18 dice
 *   "4 nights in Salvador" y un bus "round trip"). Cada fila es un renglón,
 *   escrito como en el Word, en el orden del viaje. Sin fila, manda el Word.
 *
 * Una fila incompleta o una ruta que no se entiende es un error explícito.
 */

export interface TramoConProveedor {
  tour: string;
  desde: string;
  hasta: string;
  /** La ruta como la escribió el owner ("Bus Uyuni – La Paz"). */
  ruta: string;
  bookingSupplier: string;
  /** `ambos_sentidos=si`: el proveedor hace el bus en los dos sentidos (no hace falta confirmarlo). */
  ambosSentidos: boolean;
  /** Columna opcional `alternativa`: otra forma de hacer el mismo tramo, que se elige con la reserva (M1-07, ARCH33). */
  alternativa?: string;
  /** Columna opcional `en_la_tarea` (M3-48): cómo se nombra el tramo en la tarea, con terminales y dónde se compra. */
  enLaTarea?: string;
  nota?: string;
}

/**
 * `data/transfers-tour.csv` (spec M1-07 §3 #4): excepciones a la regla de
 * transfers, por tour y componente. `si`/`no` pisa la regla; vacío la deja.
 */
export interface ExcepcionTransfer {
  tour: string;
  codigo: string;
  transferIn: boolean | null;
  transferOut: boolean | null;
  nota?: string;
}

/** Lo que incluye un tour según `data/incluidos-tour.csv` (M3-46), en el orden del viaje. */
export interface IncluidoTour {
  tour: string;
  items: ItemIncluido[];
}

export interface CategoriaTour {
  tour: string;
  categoriaTour: string;
  componente: string;
  categoriaPaquete: string;
}

function requerir(columnas: string[], texto: string, archivo: string) {
  const encabezado = texto.replace(/^﻿/, "").split(/\r?\n/)[0].split(",").map((c) => c.trim());
  const faltan = columnas.filter((c) => !encabezado.includes(c));
  if (faltan.length) throw new Error(`${archivo}: faltan las columnas ${faltan.join(", ")}.`);
}

export function parsearTramosConProveedor(texto: string): TramoConProveedor[] {
  requerir(["tour", "ruta", "booking_supplier"], texto, "tramos-con-proveedor.csv");
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const tour = (r.tour ?? "").trim();
    const ruta = (r.ruta ?? "").trim();
    const bookingSupplier = (r.booking_supplier ?? "").trim();
    if (!tour || !ruta || !bookingSupplier) {
      throw new Error(`tramos-con-proveedor.csv, fila ${fila}: faltan tour, ruta o booking_supplier.`);
    }
    const partes = ruta.replace(/^\s*bus\s+/i, "").split(/\s+[–-]\s+/);
    const desde = partes.length === 2 ? ultimaCiudad(partes[0]) : null;
    const hasta = partes.length === 2 ? primeraCiudad(partes[1]) : null;
    if (!desde || !hasta) {
      throw new Error(`tramos-con-proveedor.csv, fila ${fila}: no entiendo la ruta "${ruta}" (escribila "Bus A – B").`);
    }
    const sentidos = (r.ambos_sentidos ?? "").trim().toLowerCase();
    if (!["", "si", "sí", "no"].includes(sentidos)) {
      throw new Error(`tramos-con-proveedor.csv, fila ${fila}: ambos_sentidos tiene que ser si o no (dice "${r.ambos_sentidos}").`);
    }
    const alternativa = (r.alternativa ?? "").trim() || undefined;
    const enLaTarea = (r.en_la_tarea ?? "").trim() || undefined;
    return {
      tour,
      desde,
      hasta,
      ruta,
      bookingSupplier,
      ambosSentidos: sentidos === "si" || sentidos === "sí",
      ...(alternativa ? { alternativa } : {}),
      ...(enLaTarea ? { enLaTarea } : {}),
      nota: (r.nota ?? "").trim() || undefined,
    };
  });
}

function siNo(valor: string | undefined, columna: string, fila: number): boolean | null {
  const v = (valor ?? "").trim().toLowerCase();
  if (v === "") return null;
  if (v === "si" || v === "sí") return true;
  if (v === "no") return false;
  throw new Error(`transfers-tour.csv, fila ${fila}: ${columna} tiene que ser si, no o vacío (dice "${valor}").`);
}

export function parsearTransfersTour(texto: string): ExcepcionTransfer[] {
  requerir(["tour", "codigo", "transfer_in", "transfer_out"], texto, "transfers-tour.csv");
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const tour = (r.tour ?? "").trim();
    const codigo = (r.codigo ?? "").trim().toUpperCase();
    if (!tour || !codigo) throw new Error(`transfers-tour.csv, fila ${fila}: faltan tour o codigo.`);
    const transferIn = siNo(r.transfer_in, "transfer_in", fila);
    const transferOut = siNo(r.transfer_out, "transfer_out", fila);
    if (transferIn === null && transferOut === null) {
      throw new Error(`transfers-tour.csv, fila ${fila}: no cambia nada (transfer_in y transfer_out vacíos).`);
    }
    return { tour, codigo, transferIn, transferOut, nota: (r.nota ?? "").trim() || undefined };
  });
}

export function parsearIncluidosTour(texto: string): IncluidoTour[] {
  requerir(["tour", "incluye"], texto, "incluidos-tour.csv");
  const porTour = new Map<string, ItemIncluido[]>();
  leerCsv(texto).forEach((r, i) => {
    const fila = i + 2;
    const tour = (r.tour ?? "").trim();
    const incluye = (r.incluye ?? "").trim();
    if (!tour || !incluye) throw new Error(`incluidos-tour.csv, fila ${fila}: faltan tour o incluye.`);
    const [item] = leerIncluidos([incluye]);
    if (!item) {
      throw new Error(`incluidos-tour.csv, fila ${fila}: no entiendo "${incluye}" (escribilo "3 nights accommodation in X" o "Bus from A to B").`);
    }
    if (item.tipo === "estadia" && !item.destino) {
      throw new Error(`incluidos-tour.csv, fila ${fila}: no sé en qué destino es "${incluye}".`);
    }
    if (item.tipo === "bus" && (!item.desde || !item.hasta)) {
      throw new Error(`incluidos-tour.csv, fila ${fila}: no sé entre qué ciudades va "${incluye}".`);
    }
    porTour.set(tour, [...(porTour.get(tour) ?? []), item]);
  });
  return [...porTour.entries()].map(([tour, items]) => ({ tour, items }));
}

export function parsearCategoriasTour(texto: string): CategoriaTour[] {
  requerir(["tour", "categoria_tour", "componente", "categoria_paquete"], texto, "categorias-tour.csv");
  return leerCsv(texto).map((r, i) => {
    const valores = [r.tour, r.categoria_tour, r.componente, r.categoria_paquete].map((v) => (v ?? "").trim());
    if (valores.some((v) => !v)) throw new Error(`categorias-tour.csv, fila ${i + 2}: falta un dato.`);
    const [tour, categoriaTour, componente, categoriaPaquete] = valores;
    return {
      tour,
      categoriaTour: normalizarCategoria(categoriaTour),
      componente,
      categoriaPaquete: normalizarCategoria(categoriaPaquete),
    };
  });
}

/** true si el bus va entre esos dos destinos (en cualquier sentido). */
export function mismaRuta(t: Pick<TramoConProveedor, "desde" | "hasta">, a: string | null, b: string | null): boolean {
  return (t.desde === a && t.hasta === b) || (t.desde === b && t.hasta === a);
}
