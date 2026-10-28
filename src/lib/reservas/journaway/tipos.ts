import type { Lado } from "@/lib/catalogo/reglas";
import type { FilaLlamadaIA } from "@/lib/ia/registro-llamadas";
import type { OrigenEmparejado } from "../tipos";
import type { ProductoDeLista } from "../emparejar/catalogo";

/**
 * Los tipos del reconocedor de Journaway (spec M2-09). Journaway no manda
 * código: un paquete llega como una lista de tours sueltos con su fecha. El
 * reconocedor arma el paquete con esa lista, los hoteles Tayka o el título.
 */

/** Una parte de un paquete de Journaway (SPAP01…SPAP06), como quedó cargada en M2-08. */
export interface ParteDePaquete {
  /** Id de la fila de `producto_componente` (se guarda en la reserva). */
  productoComponenteId: string | null;
  orden: number;
  /** Día del paquete en que va (1 = el día de llegada). */
  dia: number;
  productoId: string;
  codigo: string;
  nombre: string;
  /** Un traslado (SPAT01, SPAT02): no figura en la lista de tours del mail. */
  esTraslado: boolean;
  /** Los lados que se piden del traslado en este paquete (después de los ajustes de M1-08). */
  lados: Lado[];
}

export interface PaqueteJournaway {
  productoId: string;
  codigo: string;
  nombre: string;
  partes: ParteDePaquete[];
}

/** Los paquetes armados de Journaway: los que tienen partes y un nombre de Journaway. */
export interface CatalogoJournaway {
  paquetes: PaqueteJournaway[];
}

/** Un tour de la lista del mail, ya reconocido (o no). */
export interface TourJournaway {
  /** Posición en el mail (0 = el primero). */
  indice: number;
  /** Tal cual lo escribe Journaway. */
  nombre: string;
  fecha: string | null;
  /** M3-30: la fecha de fin del renglón (un hotel, un bus nocturno); null si no la trae. */
  fechaFin?: string | null;
  /** "Pick up / Drop off" del tour, tal cual; null si el mail no lo trae. */
  pickUp: string | null;
  producto: ProductoDeLista | null;
  origen: OrigenEmparejado | null;
  confianza: number | null;
}

/** Una reserva que sale del mail: un paquete, un tour suelto, o lo que va para revisión. */
export interface ReservaJournaway {
  producto: ProductoDeLista | null;
  /** El paquete armado, si el producto es un paquete de Journaway. */
  paquete: PaqueteJournaway | null;
  /** Los tours del mail que van en esta reserva, en el orden del mail. */
  tours: TourJournaway[];
  motivos: string[];
  /** Avisos que no mandan a revisión ("Journaway lo llama half-day; es el full day"). */
  notas: string[];
  /** Fila 15: el lado del traslado que lleva otra reserva del mismo pedido (SPAP01 + SPAP03). */
  sinTrasladoDe: "salida" | null;
  /** Con qué paquete del mismo pedido va la salida ("SPAP03"), si `sinTrasladoDe` es "salida". */
  salidaCon: string | null;
  origen: OrigenEmparejado | null;
  confianza: number | null;
  /** Lo que darían los tours, cuando no se eligió (para quien revisa). */
  sugerencia: ProductoDeLista | null;
}

export interface ResultadoJournaway {
  reservas: ReservaJournaway[];
  llamadas: FilaLlamadaIA[];
  costo: number;
}
