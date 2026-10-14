/**
 * Reglas de las pantallas de reservas (spec M2-05): la frase de cada motivo
 * de revisión, el orden por llegada, el conteo real / de prueba y el cuerpo
 * del mail como texto. Sin base ni navegador: se prueban solas.
 */
import { TEXTOS } from "@/lib/textos";
import { htmlATexto } from "./html-a-texto";

const M = TEXTOS.reserva.motivos;

/**
 * La lista cerrada de motivos que se muestran. M2-01 a M2-04 guardan el
 * motivo como frase para el operativo (con datos como el código o el monto);
 * acá se reconoce a cuál de estos corresponde y se dice en voz de la app.
 */
export const CATEGORIAS_MOTIVO = [
  "lectura_fallida",
  "producto_no_cargado",
  "producto_no_seguro",
  "falta_vuelo",
  "referencia_ambigua",
  "posible_duplicada",
  "sin_producto",
  "sin_fecha_inicio",
  "elegir_variante",
  "datos_dudosos",
  "cancelacion",
  "cancelacion_sin_reserva",
  "cambio_o_cargo",
  "respuesta",
  "no_es_reserva",
  "cargo_extra",
  "datos_distintos",
  "llegaron_vuelos",
] as const;
export type CategoriaMotivo = (typeof CATEGORIAS_MOTIVO)[number] | "generico";

/**
 * Cómo se reconoce cada motivo guardado. El orden importa: "No se pudo
 * reconocer… (un código que no está en el catálogo)" es un producto no
 * seguro, no uno no cargado. Los textos de origen viven en
 * `emparejar/motivos.ts` e `intercambio.ts`; el test de `reglas.test.ts`
 * falla si alguno queda sin reconocer.
 */
const PATRONES: Array<[RegExp, (typeof CATEGORIAS_MOTIVO)[number]]> = [
  [/^No se pudo leer el mail/i, "lectura_fallida"],
  [/^No se pudo reconocer|^No se usó la IA|^La IA no respondió/i, "producto_no_seguro"],
  [/^El producto .* (no está en el catálogo|todavía no está cargado)/i, "producto_no_cargado"],
  [/^Falta el vuelo/i, "falta_vuelo"],
  [/^No se sabe a cuál de las/i, "referencia_ambigua"],
  [/^Posible duplicada/i, "posible_duplicada"],
  [/^El mail no dice qué producto/i, "sin_producto"],
  [/^El mail no trae la fecha de inicio/i, "sin_fecha_inicio"],
  [/^Elegir la variante de/i, "elegir_variante"],
  [/^La IA no está segura de/i, "datos_dudosos"],
  [/^Cancelación de una reserva que no está/i, "cancelacion_sin_reserva"],
  [/^El mail es una cancelación|^La agencia mandó una cancelación/i, "cancelacion"],
  [/^El mail es un cambio o un cargo/i, "cambio_o_cargo"],
  [/^El mail es una respuesta/i, "respuesta"],
  [/^El mail no parece una reserva/i, "no_es_reserva"],
  [/^TourRadar mandó un cargo extra/i, "cargo_extra"],
  [/^La agencia mandó datos distintos/i, "datos_distintos"],
  [/^Llegaron vuelos/i, "llegaron_vuelos"],
];

export function categoriaDeMotivo(motivo: string): CategoriaMotivo {
  const texto = (motivo ?? "").trim();
  if ((CATEGORIAS_MOTIVO as readonly string[]).includes(texto)) return texto as CategoriaMotivo;
  for (const [patron, categoria] of PATRONES) if (patron.test(texto)) return categoria;
  return "generico";
}

/** Lo que se muestra de un motivo: siempre una frase de la app, nunca el texto interno. */
export function fraseDeMotivo(motivo: string): string {
  const texto = (motivo ?? "").trim();
  const categoria = categoriaDeMotivo(texto);
  switch (categoria) {
    case "elegir_variante": {
      const codigo = /^Elegir la variante de (\S+)/i.exec(texto)?.[1];
      return codigo ? M.elegir_variante(codigo) : M.generico;
    }
    case "datos_dudosos": {
      const datos = /^La IA no está segura de:\s*(.+)$/i.exec(texto)?.[1];
      return M.datos_dudosos(datos ?? "algunos datos");
    }
    case "cargo_extra":
      return M.cargo_extra(/^TourRadar mandó un cargo extra \(([^)]+)\)/i.exec(texto)?.[1] ?? null);
    default: {
      const frase = M[categoria];
      return typeof frase === "string" ? frase : M.generico;
    }
  }
}

/** Las frases de una reserva, sin repetir (dos vuelos que faltan son un solo renglón). */
export function frasesDeMotivos(motivos: string[]): string[] {
  return [...new Set(motivos.map(fraseDeMotivo))];
}

/** La que llegó más recientemente, arriba. */
export function ordenarPorLlegada<T extends { llego: string }>(filas: T[]): T[] {
  return [...filas].sort((a, b) => Date.parse(b.llego) - Date.parse(a.llego));
}

export function contarReservas(filas: Array<{ dePrueba: boolean }>): { total: number; dePrueba: number } {
  return { total: filas.length, dePrueba: filas.filter((f) => f.dePrueba).length };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un id de reserva tiene formato uuid; cualquier otra cosa es un enlace mal copiado. */
export function esIdDeReserva(id: string): boolean {
  return UUID.test(id);
}

/**
 * El cuerpo del mail para mostrar: el texto plano si lo hay; si solo vino
 * HTML, sin etiquetas. Se muestra siempre como texto (#13).
 */
export function cuerpoComoTexto(mail: { cuerpoTexto: string | null; cuerpoHtml: string | null }): string {
  if (mail.cuerpoTexto && mail.cuerpoTexto.trim()) return mail.cuerpoTexto;
  return mail.cuerpoHtml ? htmlATexto(mail.cuerpoHtml) : "";
}
