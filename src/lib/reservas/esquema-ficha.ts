/**
 * La ficha que devuelve la lectura de un mail con IA (spec M2-02 fila 5).
 *
 * - `FichaIA`: lo que devuelve la IA, con el esquema JSON estricto de
 *   `ESQUEMA_FICHA_IA` (va en `output_config.format`). Cada dato suelto es
 *   `{ valor, confianza }`; las listas llevan una confianza por elemento.
 * - `FichaLectura`: la ficha después de los controles del código
 *   (`limpiar-ficha.ts`): número limpio, fechas en año-mes-día, datos dudosos,
 *   notas y los adjuntos que no se leyeron.
 *
 * El validador no confía en que la API haya respetado el esquema: si falta
 * una confianza o sobra un campo, la respuesta se rechaza entera (fila 18).
 */

export const TIPOS_MAIL = [
  "reserva_nueva",
  "cancelacion",
  "cambio_o_cargo",
  "respuesta_intercambio",
  "no_es_reserva",
] as const;
export type TipoMail = (typeof TIPOS_MAIL)[number];

/** M3-13 (owner, 2026-10-22): Adventure360 (BRARCH26). */
export const AGENCIAS_PILOTO = ["Kilroy", "Jysk", "TourRadar", "Journaway", "Adventure360"] as const;

export interface Campo<T> {
  valor: T;
  /** De 0 a 1: qué tan claro está escrito el dato en el mail. */
  confianza: number;
}

export interface ProductoIA {
  nombre: string;
  codigo: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  noches: number | null;
  habitacion: string | null;
  punto_recogida: string | null;
  opcionales: string[];
  confianza: number;
}

export interface PasajeroIA {
  nombre: string;
  apellido: string;
  nacionalidad: string | null;
  fecha_nacimiento: string | null;
  confianza: number;
}

export interface VueloIA {
  numero: string | null;
  aerolinea: string | null;
  origen: string | null;
  destino: string | null;
  fecha_salida: string | null;
  hora_salida: string | null;
  fecha_llegada: string | null;
  hora_llegada: string | null;
  confianza: number;
}

export interface HotelAgenciaIA {
  nombre: string;
  fecha_entrada: string | null;
  fecha_salida: string | null;
  confianza: number;
}

export interface PedidoEspecialIA {
  texto: string;
  confianza: number;
}

export interface FichaIA {
  tipo_mail: Campo<TipoMail>;
  agencia: Campo<string | null>;
  numero_reserva: Campo<string | null>;
  titulo_paquete: Campo<string | null>;
  productos: ProductoIA[];
  fecha_inicio: Campo<string | null>;
  fecha_fin: Campo<string | null>;
  pax: Campo<number | null>;
  pasajeros: PasajeroIA[];
  vuelos: VueloIA[];
  hoteles_agencia: HotelAgenciaIA[];
  todos_hoteles_agencia: Campo<boolean>;
  pedidos_especiales: PedidoEspecialIA[];
  pdf_ilegible: boolean;
  aviso: string | null;
}

/** Los datos clave que pueden quedar dudosos (fila 21), en este orden. */
export const DATOS_CLAVE = [
  "agencia",
  "numero_reserva",
  "producto",
  "fechas",
  "pax",
  "pasajeros",
  "vuelos",
] as const;
export type DatoClave = (typeof DATOS_CLAVE)[number];

export interface FichaLectura extends Omit<FichaIA, "numero_reserva" | "pdf_ilegible"> {
  /** `valor` es el número tal como vino; `limpio`, el que se usa para buscar la reserva. */
  numero_reserva: { valor: string | null; limpio: string | null; confianza: number };
  /** Nombres de los adjuntos que no se mandaron a la IA (pasaportes, imágenes…). */
  adjuntos_no_leidos: string[];
  /** Datos clave por debajo del umbral o con un control del código fallido. */
  datos_dudosos: DatoClave[];
  /** Qué controles fallaron y qué se descartó (sin datos de pasajeros). */
  notas: string[];
  version_instrucciones: string;
  modelo: string;
}

// --- Esquema JSON para la API (estricto) ---------------------------------------------
//
// La API acepta hasta 16 parámetros con unión (nullable) por esquema y la
// ficha tiene más: en el esquema no hay uniones. Lo vacío viaja como "" (y
// como 0 en pax y noches) y `validarFichaIA` lo vuelve null.

const texto = { type: "string" } as const;
const VACIO = 'Vacío ("") si el mail no lo escribe.';
const textoONulo = { type: "string", description: VACIO } as const;
const fecha = (descripcion: string) => ({ type: "string", description: `${descripcion} ${VACIO}` });
const confianza = { type: "number", description: "De 0 a 1." } as const;

function objeto(properties: Record<string, unknown>, description?: string) {
  return {
    type: "object",
    ...(description ? { description } : {}),
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  } as const;
}

const campo = (valor: unknown, description?: string) => objeto({ valor, confianza }, description);

export const ESQUEMA_FICHA_IA = objeto({
  tipo_mail: campo({ type: "string", enum: [...TIPOS_MAIL] }),
  agencia: campo({ type: "string", enum: [...AGENCIAS_PILOTO, ""] }),
  numero_reserva: campo(textoONulo, `El número de reserva de la agencia, copiado tal cual (con barras o guiones). ${VACIO}`),
  titulo_paquete: campo(textoONulo, `El título del paquete si el mail lo nombra aparte de los tours. ${VACIO}`),
  productos: {
    type: "array",
    description: "Cada producto, tour o excursión que se pide, en el orden del mail.",
    items: objeto({
      nombre: texto,
      codigo: textoONulo,
      fecha_inicio: fecha("Año-mes-día."),
      fecha_fin: fecha("Año-mes-día."),
      noches: { type: "integer", description: "Solo si el mail escribe la cantidad de noches; 0 si no." },
      habitacion: textoONulo,
      punto_recogida: textoONulo,
      opcionales: { type: "array", items: texto },
      confianza,
    }),
  },
  fecha_inicio: campo(fecha("Inicio del viaje, año-mes-día.")),
  fecha_fin: campo(fecha("Fin del viaje, año-mes-día.")),
  pax: campo({ type: "integer" }, "Cantidad de pasajeros; 0 si el mail no la escribe."),
  pasajeros: {
    type: "array",
    items: objeto({
      nombre: texto,
      apellido: texto,
      nacionalidad: textoONulo,
      fecha_nacimiento: fecha("Año-mes-día."),
      confianza,
    }),
  },
  vuelos: {
    type: "array",
    description: "Cada tramo de vuelo.",
    items: objeto({
      numero: textoONulo,
      aerolinea: textoONulo,
      origen: { ...textoONulo, description: `Código IATA del aeropuerto si está escrito. ${VACIO}` },
      destino: { ...textoONulo, description: `Código IATA del aeropuerto si está escrito. ${VACIO}` },
      fecha_salida: fecha("Año-mes-día."),
      hora_salida: textoONulo,
      fecha_llegada: fecha("Año-mes-día."),
      hora_llegada: textoONulo,
      confianza,
    }),
  },
  hoteles_agencia: {
    type: "array",
    description: "Hoteles que reserva la agencia (no HI Travel).",
    items: objeto({ nombre: texto, fecha_entrada: fecha("Año-mes-día."), fecha_salida: fecha("Año-mes-día."), confianza }),
  },
  todos_hoteles_agencia: campo({ type: "boolean" }, "True si el mail dice que la agencia reserva todos los hoteles."),
  pedidos_especiales: { type: "array", items: objeto({ texto, confianza }) },
  pdf_ilegible: { type: "boolean" },
  aviso: textoONulo,
});

// --- Validador ---------------------------------------------------------------------

type Resultado = { ok: true; ficha: FichaIA } | { ok: false; error: string };

class Invalida extends Error {}

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

function claves(x: Record<string, unknown>, esperadas: string[], donde: string) {
  for (const k of Object.keys(x)) if (!esperadas.includes(k)) throw new Invalida(`${donde}: campo de más "${k}"`);
  for (const k of esperadas) if (!(k in x)) throw new Invalida(`${donde}: falta "${k}"`);
}

function conf(x: unknown, donde: string): void {
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 1) {
    throw new Invalida(`${donde}: falta la confianza o no está entre 0 y 1`);
  }
}

/** Chequea el tipo y devuelve el valor, con lo vacío ("", o 0 en un entero) como null. */
function tipoValor(v: unknown, tipo: string, donde: string, nulo: boolean): unknown {
  if (nulo && (v === null || v === "" || (tipo === "integer" && v === 0))) return null;
  const ok = tipo === "integer" ? Number.isInteger(v) : typeof v === tipo;
  if (!ok) throw new Invalida(`${donde}: tipo inválido`);
  return v;
}

function validarCampo(x: unknown, donde: string, tipo: string, nulo: boolean, enumeracion?: readonly string[]) {
  if (!esObjeto(x)) throw new Invalida(`${donde}: no es { valor, confianza }`);
  claves(x, ["valor", "confianza"], donde);
  conf(x.confianza, donde);
  x.valor = tipoValor(x.valor, tipo, donde, nulo);
  if (enumeracion && x.valor !== null && !enumeracion.includes(x.valor as string)) {
    throw new Invalida(`${donde}: valor desconocido`);
  }
}

function validarLista(
  x: unknown,
  donde: string,
  campos: Record<string, { tipo: string; nulo?: boolean; lista?: boolean }>,
) {
  if (!Array.isArray(x)) throw new Invalida(`${donde}: no es una lista`);
  x.forEach((el, i) => {
    const aqui = `${donde}[${i}]`;
    if (!esObjeto(el)) throw new Invalida(`${aqui}: no es un objeto`);
    claves(el, [...Object.keys(campos), "confianza"], aqui);
    conf(el.confianza, aqui);
    for (const [k, def] of Object.entries(campos)) {
      if (def.lista) {
        if (!Array.isArray(el[k]) || !(el[k] as unknown[]).every((s) => typeof s === "string")) {
          throw new Invalida(`${aqui}.${k}: no es una lista de textos`);
        }
      } else el[k] = tipoValor(el[k], def.tipo, `${aqui}.${k}`, def.nulo ?? false);
    }
  });
}

const T = { tipo: "string" };
const TN = { tipo: "string", nulo: true };

export function validarFichaIA(respuesta: unknown): Resultado {
  try {
    // Sobre una copia: lo vacío ("" / 0) se vuelve null sin tocar la respuesta original.
    const x: unknown = structuredClone(respuesta);
    if (!esObjeto(x)) throw new Invalida("la respuesta no es un objeto");
    claves(x, Object.keys(ESQUEMA_FICHA_IA.properties), "ficha");
    validarCampo(x.tipo_mail, "tipo_mail", "string", false, TIPOS_MAIL);
    validarCampo(x.agencia, "agencia", "string", true, AGENCIAS_PILOTO);
    validarCampo(x.numero_reserva, "numero_reserva", "string", true);
    validarCampo(x.titulo_paquete, "titulo_paquete", "string", true);
    validarCampo(x.fecha_inicio, "fecha_inicio", "string", true);
    validarCampo(x.fecha_fin, "fecha_fin", "string", true);
    validarCampo(x.pax, "pax", "integer", true);
    validarCampo(x.todos_hoteles_agencia, "todos_hoteles_agencia", "boolean", false);
    validarLista(x.productos, "productos", {
      nombre: T,
      codigo: TN,
      fecha_inicio: TN,
      fecha_fin: TN,
      noches: { tipo: "integer", nulo: true },
      habitacion: TN,
      punto_recogida: TN,
      opcionales: { tipo: "string", lista: true },
    });
    validarLista(x.pasajeros, "pasajeros", { nombre: T, apellido: T, nacionalidad: TN, fecha_nacimiento: TN });
    validarLista(x.vuelos, "vuelos", {
      numero: TN,
      aerolinea: TN,
      origen: TN,
      destino: TN,
      fecha_salida: TN,
      hora_salida: TN,
      fecha_llegada: TN,
      hora_llegada: TN,
    });
    validarLista(x.hoteles_agencia, "hoteles_agencia", { nombre: T, fecha_entrada: TN, fecha_salida: TN });
    validarLista(x.pedidos_especiales, "pedidos_especiales", { texto: T });
    tipoValor(x.pdf_ilegible, "boolean", "pdf_ilegible", false);
    x.aviso = tipoValor(x.aviso, "string", "aviso", true);
    return { ok: true, ficha: x as unknown as FichaIA };
  } catch (e) {
    if (e instanceof Invalida) return { ok: false, error: e.message };
    throw e;
  }
}
