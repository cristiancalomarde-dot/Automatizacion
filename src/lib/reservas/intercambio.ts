import { normalizarNombre } from "./emparejar/emparejar";
import { MOTIVOS_EMPAREJADO as M } from "./emparejar/motivos";
import type { PasajeroIA, TipoMail, VueloIA } from "./esquema-ficha";
import type { EstadoReserva } from "./tipos";

/**
 * Mismo intercambio, no reserva nueva (spec M2-04): la decisión por pedido y
 * el armado de los cambios, sin base ni IA (verificación 1). El orquestador
 * (`procesar-mail.ts`) carga las candidatas y aplica lo que sale de acá.
 *
 * Nunca se descarta ni se junta nada por su cuenta: lo dudoso queda "para
 * revisión" o con la marca "posible duplicada" (#4). Los motivos no llevan
 * datos de pasajeros.
 */

export const MOTIVOS_INTERCAMBIO = {
  datosDistintos: "La agencia mandó datos distintos",
  cancelacion: "La agencia mandó una cancelación",
  cancelacionSinReserva: "Cancelación de una reserva que no está en el sistema",
  llegaronVuelos: "Llegaron vuelos en un mail nuevo: revisar",
  ambigua: (cantidad: number, bookingId: string) =>
    `No se sabe a cuál de las ${cantidad} reservas con la referencia ${bookingId} corresponde`,
  posibleDuplicada: "Posible duplicada: hay otra reserva de la misma agencia con el mismo producto, fecha de inicio y pax",
} as const;

/** Días hacia atrás (según cuándo entró la otra reserva) de la marca blanda. */
export const DIAS_MARCA_BLANDA = 60;

/** Lo que el intercambio necesita de una reserva que ya está en la base. */
export interface ReservaExistente {
  id: string;
  agencia: string;
  /** Normalizado (`booking-id.ts`). */
  booking_id: string | null;
  producto_id: string | null;
  producto_clave_agencia: string | null;
  producto_texto_agencia: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  pax: number | null;
  pasajeros: unknown[];
  vuelos: unknown[];
  habitacion: string | null;
  pedidos_especiales: string | null;
  estado: EstadoReserva;
  motivos_revision: string[];
  de_prueba: boolean;
  created_at: string;
}

/** Un pedido = un producto del mail (Kilroy "2 NEW BOOKINGS" da dos). */
export interface PedidoIntercambio {
  agencia: string;
  bookingId: string | null;
  productoId: string | null;
  claveAgencia: string | null;
  fechaInicio: string | null;
  pax: number | null;
  dePrueba: boolean;
}

export type DecisionIntercambio =
  | { tipo: "nueva"; mismaReferencia: string[] }
  | { tipo: "sumar_a"; reservaId: string }
  | { tipo: "revision_ambigua"; reservaIds: string[] }
  | { tipo: "nueva_posible_duplicada"; duplicadaDe: string; mismaReferencia: string[] };

/** El código de la agencia (minúsculas, sin espacios dobles ni sufijo `-677`) o, sin código, el nombre. */
export function claveProductoAgencia(p: { codigo: string | null; nombre: string | null }): string | null {
  if (p.codigo && p.codigo.trim()) return normalizarNombre(p.codigo).replace(/-\d+$/, "");
  if (p.nombre && p.nombre.trim()) return normalizarNombre(p.nombre);
  return null;
}

/** Mismo producto del catálogo si los dos emparejaron; si alguno no, el mismo código o nombre de la agencia. */
export function mismoProducto(
  p: Pick<PedidoIntercambio, "productoId" | "claveAgencia">,
  r: Pick<ReservaExistente, "producto_id" | "producto_clave_agencia">,
): boolean {
  if (p.productoId && r.producto_id) return p.productoId === r.producto_id;
  return !!p.claveAgencia && p.claveAgencia === r.producto_clave_agencia;
}

const porAntiguedad = (a: ReservaExistente, b: ReservaExistente) => a.created_at.localeCompare(b.created_at);

/**
 * Filas 3, 6, 7, 8 y 10. `existentes` puede traer de todo: acá se filtra por
 * agencia y por prueba/real, así que nunca se cruzan.
 */
export function decidirPedido(
  pedido: PedidoIntercambio,
  existentes: ReservaExistente[],
  opciones: { ahora: Date; diasMarcaBlanda?: number },
): DecisionIntercambio {
  const mias = existentes
    .filter((r) => r.agencia === pedido.agencia && r.de_prueba === pedido.dePrueba)
    .sort(porAntiguedad);
  const misma = pedido.bookingId ? mias.filter((r) => r.booking_id === pedido.bookingId) : [];

  // Owner 2026-10-17: en Journaway el ID es del pasajero y no cambia. Otro tour con el mismo ID
  // es la misma reserva: se suma (no hay "otro producto = otra reserva"). El Trip Number no cuenta.
  if (pedido.agencia === "Journaway" && misma.length > 0) {
    if (misma.length === 1) return { tipo: "sumar_a", reservaId: misma[0].id };
    return { tipo: "revision_ambigua", reservaIds: misma.map((r) => r.id) };
  }

  if (misma.length > 0) {
    const tienePedido = !!(pedido.productoId || pedido.claveAgencia);
    if (tienePedido) {
      const igual = misma.find((r) => mismoProducto(pedido, r));
      if (igual) return { tipo: "sumar_a", reservaId: igual.id };
      return { tipo: "nueva", mismaReferencia: misma.map((r) => r.id) };
    }
    if (misma.length === 1) return { tipo: "sumar_a", reservaId: misma[0].id };
    return { tipo: "revision_ambigua", reservaIds: misma.map((r) => r.id) };
  }

  // Fila 8: la marca blanda, solo con producto, fecha de inicio y pax.
  if (pedido.fechaInicio && pedido.pax !== null && (pedido.productoId || pedido.claveAgencia)) {
    const desde = opciones.ahora.getTime() - (opciones.diasMarcaBlanda ?? DIAS_MARCA_BLANDA) * 86_400_000;
    const parecida = mias.find(
      (r) =>
        Date.parse(r.created_at) >= desde &&
        r.fecha_inicio === pedido.fechaInicio &&
        r.pax === pedido.pax &&
        mismoProducto(pedido, r) &&
        // Journaway: el ID es del pasajero; otro ID es otro pasajero, aunque coincidan tour, fecha y pax (owner 2026-10-17).
        !(pedido.agencia === "Journaway" && pedido.bookingId && r.booking_id && r.booking_id !== pedido.bookingId),
    );
    if (parecida) return { tipo: "nueva_posible_duplicada", duplicadaDe: parecida.id, mismaReferencia: [] };
  }
  return { tipo: "nueva", mismaReferencia: [] };
}

// --- Completar sin pisar (filas 3, 4, 5, 9 y 12) ------------------------------------------

/** Lo que trae el mail nuevo para la reserva a la que se suma. */
export interface DatosEntrantes {
  fechaInicio: string | null;
  fechaFin: string | null;
  pax: number | null;
  pasajeros: unknown[];
  vuelos: VueloIA[];
  habitacion: string | null;
  pedidosEspeciales: string | null;
  esCancelacion: boolean;
  /** La lectura de M2-02 dejó los vuelos como dato dudoso. */
  vuelosDudosos: boolean;
  /** Owner 2026-10-14: un estado de cuenta de cargo de TourRadar (con el monto, si se sabe). */
  cargoExtra?: MontoCargo | null;
}

export interface MontoCargo {
  importe: number | null;
  moneda: string | null;
}

/**
 * Owner 2026-10-14: un statement de cargo de TourRadar (no una cancelación)
 * es un cargo extra. La ficha de M2-02 no trae el monto: queda null.
 */
export function cargoExtraDelMail(m: { agencia: string; tipoMail: TipoMail | null; esCancelacion: boolean }): MontoCargo | null {
  if (m.agencia !== "TourRadar" || m.tipoMail !== "cambio_o_cargo" || m.esCancelacion) return null;
  return { importe: null, moneda: null };
}

export type CampoCompletable = "fecha_inicio" | "fecha_fin" | "pax" | "pasajeros" | "vuelos" | "habitacion" | "pedidos_especiales";

export interface DatoDistinto {
  campo: "fecha_inicio" | "fecha_fin" | "pax" | "vuelos";
  agencia: string;
  reserva: string;
  /** Para el historial: "La agencia mandó salida 12/03, la reserva dice 06/03". */
  texto: string;
}

export interface CambiosIntercambio {
  /** Solo los datos que estaban vacíos. */
  completar: Partial<Record<CampoCompletable, unknown>>;
  completados: CampoCompletable[];
  distintos: DatoDistinto[];
  /** El estado y los motivos con los que queda la reserva. */
  estado: EstadoReserva;
  motivos: string[];
  /** Fila 5: por qué pasó sola a recibida. */
  nota: string | null;
}

export interface OpcionesCambios {
  /**
   * Fila 5 (owner 2026-10-16): los avisos "Falta el vuelo…" de la reserva con
   * una lista de vuelos (`avisosDeVuelo`, el control de M2-03). Sin función =
   * no se puede recalcular (no hay producto).
   */
  avisosVuelo?: (vuelos: VueloIA[]) => string[];
  /** Fecha del mail nuevo, para la nota. */
  fechaMail?: string | null;
}

/** Umbral de confianza de un vuelo (el de los datos clave de M2-02, `limpiar-ficha.ts`). */
const UMBRAL_VUELO = 0.8;
const ESTADOS_TOCABLES: EstadoReserva[] = ["recibida", "para_revision"];
const FALTA_VUELO = /^Falta el vuelo de /;

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const numeroVuelo = (v: Partial<VueloIA>) => (v.numero ?? "").toUpperCase().replace(/\s+/g, "");
const tramo = (v: Partial<VueloIA>) => (v.origen && v.destino ? `${v.origen.toUpperCase()}-${v.destino.toUpperCase()}` : null);
const nombreCompleto = (p: Partial<PasajeroIA>) => normalizarNombre(`${p.nombre ?? ""} ${p.apellido ?? ""}`);

const TEXTO_DISTINTO = {
  fecha_inicio: (a: string, r: string) => `La agencia mandó salida ${ddmm(a)}, la reserva dice ${ddmm(r)}`,
  fecha_fin: (a: string, r: string) => `La agencia mandó fin ${ddmm(a)}, la reserva dice ${ddmm(r)}`,
  pax: (a: string, r: string) => `La agencia mandó ${a} pasajeros, la reserva dice ${r}`,
};

/** Pasajeros: si no había, los del mail; si había, solo se llenan los datos vacíos (pasaporte) del mismo nombre. */
function completarPasajeros(antes: unknown[], nuevos: unknown[]): unknown[] | null {
  if (nuevos.length === 0) return null;
  if (antes.length === 0) return nuevos;
  let cambio = false;
  const resultado = (antes as Array<Partial<PasajeroIA>>).map((p) => {
    const otro = (nuevos as Array<Partial<PasajeroIA>>).find((x) => nombreCompleto(x) === nombreCompleto(p));
    if (!otro) return p;
    const r = { ...p };
    for (const k of ["nacionalidad", "fecha_nacimiento"] as const) {
      if (r[k] == null && otro[k] != null) {
        r[k] = otro[k];
        cambio = true;
      }
    }
    return r;
  });
  return cambio ? resultado : null;
}

/** Vuelos nuevos se suman; el mismo vuelo con otra fecha, u otro vuelo para el mismo tramo, es un dato distinto. */
function cruzarVuelos(antes: VueloIA[], nuevos: VueloIA[]): { agregados: VueloIA[]; distintos: DatoDistinto[] } {
  const agregados: VueloIA[] = [];
  const distintos: DatoDistinto[] = [];
  for (const v of nuevos) {
    const numero = numeroVuelo(v);
    if (!numero) continue;
    const mismo = [...antes, ...agregados].find((x) => numeroVuelo(x) === numero);
    if (mismo) {
      const k = (["fecha_salida", "fecha_llegada"] as const).find((c) => v[c] && mismo[c] && v[c] !== mismo[c]);
      if (k) {
        distintos.push({
          campo: "vuelos",
          agencia: `${numero} ${v[k]}`,
          reserva: `${numero} ${mismo[k]}`,
          texto: `La agencia mandó el vuelo ${numero} el ${ddmm(v[k]!)}, la reserva dice ${ddmm(mismo[k]!)}`,
        });
      }
      continue;
    }
    const otroDelTramo = tramo(v) ? antes.find((x) => numeroVuelo(x) && tramo(x) === tramo(v)) : undefined;
    if (otroDelTramo) {
      distintos.push({
        campo: "vuelos",
        agencia: numero,
        reserva: numeroVuelo(otroDelTramo),
        texto: `La agencia mandó el vuelo ${numero} (${tramo(v)}), la reserva tiene el ${numeroVuelo(otroDelTramo)}`,
      });
      continue;
    }
    agregados.push(v);
  }
  return { agregados, distintos };
}

export function armarCambios(existente: ReservaExistente, entrante: DatosEntrantes, opciones: OpcionesCambios): CambiosIntercambio {
  const completar: CambiosIntercambio["completar"] = {};
  const completados: CampoCompletable[] = [];
  const distintos: DatoDistinto[] = [];
  const poner = (campo: CampoCompletable, valor: unknown) => {
    completar[campo] = valor;
    completados.push(campo);
  };

  // Fechas y pax: si estaban vacíos se completan; si no, un valor distinto se anota y no pisa (fila 4).
  const simples = [
    ["fecha_inicio", entrante.fechaInicio, existente.fecha_inicio],
    ["fecha_fin", entrante.fechaFin, existente.fecha_fin],
    ["pax", entrante.pax, existente.pax],
  ] as const;
  for (const [campo, nuevo, actual] of simples) {
    if (nuevo === null || nuevo === undefined) continue;
    if (actual === null || actual === undefined) poner(campo, nuevo);
    else if (nuevo !== actual) {
      const [a, r] = [String(nuevo), String(actual)];
      distintos.push({ campo, agencia: a, reserva: r, texto: TEXTO_DISTINTO[campo](a, r) });
    }
  }

  const pasajeros = completarPasajeros(existente.pasajeros ?? [], entrante.pasajeros);
  if (pasajeros) poner("pasajeros", pasajeros);

  const vuelosAntes = (existente.vuelos ?? []) as VueloIA[];
  const cruce = cruzarVuelos(vuelosAntes, entrante.vuelos);
  distintos.push(...cruce.distintos);
  if (cruce.agregados.length) poner("vuelos", [...vuelosAntes, ...cruce.agregados]);

  if (!existente.habitacion && entrante.habitacion) poner("habitacion", entrante.habitacion);
  if (!existente.pedidos_especiales && entrante.pedidosEspeciales) poner("pedidos_especiales", entrante.pedidosEspeciales);

  // Fila 12: el estado solo se toca en recibida o para revisión.
  if (!ESTADOS_TOCABLES.includes(existente.estado)) {
    return { completar, completados, distintos, estado: existente.estado, motivos: existente.motivos_revision, nota: null };
  }

  // Owner 2026-10-16: el vuelo que falta ya no es motivo de revisión sino un aviso que se
  // calcula. Las reservas de antes del cambio pueden traerlo guardado: se saca.
  const esperabaVuelos =
    existente.motivos_revision.some((m) => FALTA_VUELO.test(m)) || (opciones.avisosVuelo?.(vuelosAntes).length ?? 0) > 0;
  const motivos = existente.motivos_revision.filter((m) => !FALTA_VUELO.test(m));
  const sumar = (m: string) => {
    if (!motivos.includes(m)) motivos.push(m);
  };
  if (distintos.length) sumar(MOTIVOS_INTERCAMBIO.datosDistintos);
  if (entrante.esCancelacion) sumar(MOTIVOS_INTERCAMBIO.cancelacion);
  // Owner 2026-10-14: un cargo implica un servicio nuevo (tour extra, upgrade a SGL, hotel mejor).
  if (entrante.cargoExtra) sumar(M.cargoExtra(entrante.cargoExtra));

  // Fila 5 (owner 2026-10-16): los vuelos que llegan a una reserva que los esperaba se suman y
  // el aviso se va solo (se recalcula con los vuelos guardados). Solo si la lectura dudó de
  // los vuelos pasa a revisión, para que alguien los mire.
  let nota: string | null = null;
  if (cruce.agregados.length && esperabaVuelos) {
    const confiables = !entrante.vuelosDudosos && cruce.agregados.every((v) => v.confianza >= UMBRAL_VUELO);
    if (!confiables) sumar(MOTIVOS_INTERCAMBIO.llegaronVuelos);
    const fecha = opciones.fechaMail ? ` (mail del ${ddmm(new Date(opciones.fechaMail).toISOString())})` : "";
    const faltan = opciones.avisosVuelo?.([...vuelosAntes, ...cruce.agregados]) ?? [];
    nota = faltan.length ? `Llegaron vuelos${fecha}. Todavía falta: ${faltan.join("; ")}` : `Llegaron los vuelos${fecha}`;
  }

  return { completar, completados, distintos, estado: motivos.length ? "para_revision" : "recibida", motivos, nota };
}
