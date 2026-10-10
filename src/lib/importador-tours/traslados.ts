import { buscarServicio, type ServicioBuscable } from "@/lib/importador-productos/a-pedido";
import { leerCsv } from "@/lib/importador-productos/csv";
import type { SentidoTraslado } from "@/lib/importador-productos/sentido";
import { nombreDestino } from "./ciudades";
import type { TourArmado } from "./armado";

/**
 * Los traslados de cada paquete según cómo se llega en el tour (spec M1-08
 * §3 #2-#4). Es puro: recibe la secuencia del tour y los servicios de cada
 * paquete y devuelve, por servicio, cómo queda en ese tour. Lo que no figura
 * se pide tal cual.
 *
 * **Regla general (owner, 2026-10-10).** Dentro de un tour, entre un paquete
 * y el siguiente siempre se viaja por tierra (un bus del tour, un bus que
 * emite HI Travel o el bus del propio paquete): por eso
 * - al paquete al que se llega en bus no se le pide el traslado de llegada;
 * - al paquete del que se sale en bus no se le pide el de salida;
 * - uno de ida y vuelta queda solo del lado que corresponde
 *   (`solo_llegada` / `solo_salida`), o se anula si no queda ninguno;
 * - uno sin sentido deducido (Remis Mendoza) se anula solo si ningún lado
 *   hace falta; en una punta del tour se deja entero (no se adivina);
 * - el primer paquete conserva la llegada y el último la salida.
 * Solo mira los servicios de tipo traslado (los buses del paquete son la
 * conexión, no se tocan). Iguazú (IGR) conserva los suyos aunque esté en el
 * medio (docs/arquitectura/modelo-de-datos.md); ahí el traslado viene dentro
 * del 105 Premium y lo cambia una excepción.
 *
 * **Excepciones** (`data/traslados-tour.csv`: tour, paquete, servicio,
 * acción, texto, nota): pisan la regla en ese tour y ese servicio. Si una
 * fila nombra un tour, un paquete del tour o un servicio que no existe, se
 * corta con un mensaje claro antes de escribir nada.
 *
 * Un tour dentro de otro (CHB31 en 5C01) se mira desplegado: sus paquetes son
 * pasos del tour de afuera, y el ajuste vale para el de afuera.
 */

export const ACCIONES_AJUSTE = ["anular", "solo_llegada", "solo_salida", "reemplazar", "invertir"] as const;
export type AccionAjuste = (typeof ACCIONES_AJUSTE)[number];

export interface ExcepcionTraslado {
  tour: string;
  paquete: string;
  servicio: string;
  accion: AccionAjuste;
  texto?: string;
  nota?: string;
}

export interface ServicioDePaquete extends ServicioBuscable {
  sentido: SentidoTraslado | null;
}

export interface PaqueteEnTour {
  codigo: string;
  destino: string;
}

export interface AjusteTraslado {
  tour: string;
  paquete: string;
  orden: number;
  accion: AccionAjuste;
  /** Texto nuevo (reemplazar; opcional en las demás acciones). */
  texto: string | null;
  /** Por qué ("llega en bus desde Iguazú", o la nota del owner). */
  motivo: string;
  origen: "regla" | "excepcion";
  /** El servicio tal como lo escribe el Excel (para los reportes). */
  servicio: string;
  sentido: SentidoTraslado | null;
}

const ARCHIVO = "traslados-tour.csv";
const DESTINOS_CON_TRANSFER = new Set(["IGR", "IGU"]);

export function parsearTrasladosTour(texto: string): ExcepcionTraslado[] {
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const tour = (r.tour ?? "").trim().toUpperCase();
    const paquete = (r.paquete ?? "").trim().toUpperCase();
    const servicio = (r.servicio ?? "").trim();
    if (!tour || !paquete || !servicio) throw new Error(`${ARCHIVO}, fila ${fila}: faltan tour, paquete o servicio.`);
    const accion = (r.accion ?? "").trim() as AccionAjuste;
    if (!ACCIONES_AJUSTE.includes(accion)) {
      throw new Error(`${ARCHIVO}, fila ${fila}: la acción tiene que ser ${ACCIONES_AJUSTE.join(", ")} (dice "${r.accion ?? ""}").`);
    }
    const nuevo = (r.texto ?? "").trim();
    if (accion === "reemplazar" && !nuevo) throw new Error(`${ARCHIVO}, fila ${fila}: un reemplazo necesita el texto nuevo.`);
    const nota = (r.nota ?? "").trim();
    return { tour, paquete, servicio, accion, ...(nuevo ? { texto: nuevo } : {}), ...(nota ? { nota } : {}) };
  });
}

/** Cada excepción nombra un tour que se está cargando (y que quedó armado). */
export function validarExcepcionesTraslado(excepciones: ExcepcionTraslado[], toursArmados: string[]): void {
  const desconocidos = [...new Set(excepciones.map((x) => x.tour).filter((t) => !toursArmados.includes(t)))];
  if (desconocidos.length) {
    throw new Error(
      `${ARCHIVO}: no conozco el tour ${desconocidos.join(", ")} (o quedó para revisar). Los tours armados son ${toursArmados.join(", ")}. Corregí la fila; no se cargó nada.`,
    );
  }
}

/** Los paquetes de un tour, en orden, con los de un tour anidado desplegados (CHB31 dentro de 5C01). */
export function secuenciaDePaquetes(
  tour: TourArmado,
  tours: Map<string, TourArmado>,
  destinoDe: (codigo: string) => string,
): PaqueteEnTour[] {
  if (tour.estado !== "armado") return [];
  return tour.componentes
    .filter((c) => c.tipo === "paquete" && c.codigo)
    .flatMap((c) => {
      const anidado = c.esTour ? tours.get(c.codigo!) : undefined;
      if (anidado && anidado.estado === "armado") return secuenciaDePaquetes(anidado, tours, destinoDe);
      return [{ codigo: c.codigo!, destino: destinoDe(c.codigo!) }];
    });
}

function textoCorto(s: ServicioBuscable): string {
  return (s.descripcion ?? s.serviceProviderNombre ?? "").split("\n")[0];
}

export function ajustesDeTraslados(entrada: {
  tour: string;
  secuencia: PaqueteEnTour[];
  servicios: Map<string, ServicioDePaquete[]>;
  excepciones: ExcepcionTraslado[];
}): AjusteTraslado[] {
  const { tour, secuencia, servicios } = entrada;
  const porClave = new Map<string, AjusteTraslado>();
  const n = secuencia.length;

  // --- regla general ---
  secuencia.forEach((p, i) => {
    if (DESTINOS_CON_TRANSFER.has(p.destino)) return;
    const llega = i > 0 ? `llega en bus desde ${nombreDestino(secuencia[i - 1].destino)}` : null;
    const sale = i < n - 1 ? `sale en bus a ${nombreDestino(secuencia[i + 1].destino)}` : null;
    const vistos = new Set<number>();
    for (const s of [...(servicios.get(p.codigo) ?? [])].sort((a, b) => a.orden - b.orden || a.prioridad - b.prioridad)) {
      if (s.tipo !== "traslado" || vistos.has(s.orden)) continue;
      vistos.add(s.orden);
      let accion: AccionAjuste | null = null;
      let motivo = "";
      const ambos = [llega, sale].filter(Boolean).join(" y ");
      switch (s.sentido) {
        case "llegada":
          if (llega) [accion, motivo] = ["anular", llega];
          break;
        case "salida":
          if (sale) [accion, motivo] = ["anular", sale];
          break;
        case "ida_y_vuelta":
          if (llega && sale) [accion, motivo] = ["anular", ambos];
          else if (sale) [accion, motivo] = ["solo_llegada", `${sale}: solo se pide la llegada`];
          else if (llega) [accion, motivo] = ["solo_salida", `${llega}: solo se pide la salida`];
          break;
        default:
          // sin sentido deducido: solo se anula si no hace falta ningún lado
          if (llega && sale) [accion, motivo] = ["anular", ambos];
      }
      if (!accion) continue;
      porClave.set(`${p.codigo}:${s.orden}`, {
        tour,
        paquete: p.codigo,
        orden: s.orden,
        accion,
        texto: null,
        motivo,
        origen: "regla",
        servicio: textoCorto(s),
        sentido: s.sentido,
      });
    }
  });

  // --- excepciones (pisan la regla) ---
  for (const x of entrada.excepciones.filter((e) => e.tour === tour)) {
    if (!secuencia.some((p) => p.codigo === x.paquete)) {
      throw new Error(
        `${ARCHIVO}: el tour ${tour} no tiene el paquete ${x.paquete} (tiene ${secuencia.map((p) => p.codigo).join(", ")}). Corregí la fila; no se cargó nada.`,
      );
    }
    const delPaquete = servicios.get(x.paquete) ?? [];
    const orden = buscarServicio(delPaquete, x.servicio, x.paquete, ARCHIVO);
    const s = delPaquete.find((y) => y.orden === orden)!;
    porClave.set(`${x.paquete}:${orden}`, {
      tour,
      paquete: x.paquete,
      orden,
      accion: x.accion,
      texto: x.texto ?? null,
      motivo: x.nota ?? "excepción del owner (data/traslados-tour.csv)",
      origen: "excepcion",
      servicio: textoCorto(s),
      sentido: s.sentido,
    });
  }

  const posicion = new Map(secuencia.map((p, i) => [p.codigo, i]));
  return [...porClave.values()].sort((a, b) => posicion.get(a.paquete)! - posicion.get(b.paquete)! || a.orden - b.orden);
}
