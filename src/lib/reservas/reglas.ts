/**
 * Reglas de las pantallas de reservas (spec M2-05): la frase de cada motivo
 * de revisión, el orden por llegada, el conteo real / de prueba y el cuerpo
 * del mail como texto. Sin base ni navegador: se prueban solas.
 */
import { TEXTOS } from "@/lib/textos";
import { htmlATexto } from "./html-a-texto";

const M = TEXTOS.reserva.motivos;
const D = TEXTOS.reserva.detalleMotivo;

/**
 * La lista cerrada de motivos que se muestran. M2-01 a M2-04 guardan el
 * motivo como frase para el operativo (con datos como el código o el monto);
 * acá se reconoce a cuál de estos corresponde y se dice en voz de la app.
 */
export const CATEGORIAS_MOTIVO = [
  "lectura_fallida",
  "producto_no_cargado",
  "producto_existe_no_cargado",
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
  [/^El producto .* todavía no está cargado/i, "producto_existe_no_cargado"],
  [/^El producto .* no está en el catálogo/i, "producto_no_cargado"],
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

/** Un motivo en pantalla: la frase en llano y, si el motivo guardado lo trae, el detalle concreto. */
export interface MotivoEnPantalla {
  frase: string;
  detalle: string | null;
}

/** La frase de la categoría (sin detalle): siempre una frase de la app, nunca el texto interno. */
function fraseDeCategoria(texto: string, categoria: CategoriaMotivo): string {
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

/** Las lecturas fallidas de `preparar-mail.ts` (MOTIVOS), dichas sin jerga. */
const LECTURA: Array<[RegExp, string]> = [
  [/^remitente/i, D.lectura.remitente],
  [/presupuesto/i, D.tope],
  [/demasiado grande/i, D.lectura.grande],
  [/PDF/i, D.lectura.pdf],
  [/no respondió|formato|se cortó/i, D.lectura.fallo],
];

/**
 * El detalle concreto que trae el motivo guardado (los textos de origen
 * están en `emparejar/motivos.ts` e `intercambio.ts`). Si no se reconoce,
 * `null`: la frase va sola. Nunca muestra números de confianza.
 */
function detalleDeMotivo(texto: string, categoria: CategoriaMotivo): string | null {
  let m: RegExpExecArray | null;
  switch (categoria) {
    case "falta_vuelo":
      m = /^Falta el vuelo de (.+?) para (.+?)\.?$/i.exec(texto);
      return m ? D.vuelo(m[1], m[2]) : null;
    case "producto_existe_no_cargado":
      m = /^El producto (.+?) existe en el catálogo/i.exec(texto);
      return m ? D.esElProducto(m[1]) : null;
    case "producto_no_cargado":
      m = /^El producto (.+?) no está en el catálogo(?: \(no coincide con ningún producto cargado\))?$/i.exec(texto);
      return m ? D.comoLoPide(m[1]) : null;
    case "producto_no_seguro": {
      if (/^No se usó la IA/i.test(texto)) return D.tope;
      m = /^No se pudo reconocer con seguridad el producto (.+?): la IA sugiere (\S+), que tiene (\d+) noches, pero el mail pide (\d+)$/i.exec(texto);
      if (m) return `${D.comoLoPide(m[1])} ${D.podriaSerNoches(m[2], m[3], m[4])}`;
      m = /^No se pudo reconocer con seguridad el producto (.+?) \(la IA sugiere (\S+), con confianza [^)]*\)$/i.exec(texto);
      if (m) return `${D.comoLoPide(m[1])} ${D.podriaSer(m[2])}`;
      m =
        /^No se pudo reconocer con seguridad el producto (.+?)(?: \((?:la IA respondió|la respuesta de la IA)[^)]*\))?$/i.exec(texto) ??
        /^No se pudo reconocer el producto (.+) sin la IA$/i.exec(texto);
      return m ? D.comoLoPide(m[1]) : null;
    }
    case "referencia_ambigua":
      m = /^No se sabe a cuál de las (\d+) reservas con la referencia (\S+) corresponde/i.exec(texto);
      return m ? D.ambigua(m[1], m[2]) : null;
    case "lectura_fallida": {
      const causa = /^No se pudo leer el mail:\s*(.+)$/i.exec(texto)?.[1];
      if (!causa) return null;
      return LECTURA.find(([patron]) => patron.test(causa))?.[1] ?? null;
    }
    default:
      return null;
  }
}

/** Lo que se muestra de un motivo: la frase de la app y el detalle concreto, si lo hay. */
export function motivoEnPantalla(motivo: string): MotivoEnPantalla {
  const texto = (motivo ?? "").trim();
  const categoria = categoriaDeMotivo(texto);
  return { frase: fraseDeCategoria(texto, categoria), detalle: detalleDeMotivo(texto, categoria) };
}

/** El motivo en un solo texto: la frase y, si hay, el detalle. */
export function fraseDeMotivo(motivo: string): string {
  const { frase, detalle } = motivoEnPantalla(motivo);
  return detalle ? `${frase} ${detalle}` : frase;
}

/** Los motivos de una reserva, sin repetir renglones iguales (cada vuelo que falta tiene el suyo). */
export function frasesDeMotivos(motivos: string[]): MotivoEnPantalla[] {
  const vistos = new Set<string>();
  const salida: MotivoEnPantalla[] = [];
  for (const m of motivos.map(motivoEnPantalla)) {
    const clave = `${m.frase}\u0000${m.detalle ?? ""}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(m);
  }
  return salida;
}

/** La que llegó más recientemente, arriba. */
export function ordenarPorLlegada<T extends { llego: string }>(filas: T[]): T[] {
  return [...filas].sort((a, b) => Date.parse(b.llego) - Date.parse(a.llego));
}

/**
 * El orden de trabajo de la lista (owner, 2026-10-15): primero las "para
 * revisión"; dentro de cada grupo, el viaje que empieza antes arriba (sin
 * fecha, al final); a igual fecha, la que llegó más recientemente.
 */
export function ordenarParaTrabajar<T extends { estado: string; fechaInicio: string | null; llego: string }>(filas: T[]): T[] {
  const grupo = (f: T) => (f.estado === "para_revision" ? 0 : 1);
  return [...filas].sort(
    (a, b) =>
      grupo(a) - grupo(b) ||
      (a.fechaInicio ?? "9999-99-99").localeCompare(b.fechaInicio ?? "9999-99-99") ||
      Date.parse(b.llego) - Date.parse(a.llego),
  );
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

/**
 * Owner 2026-10-16: una reserva cuyo mail es una cancelación tiene que decirlo
 * de forma evidente (en la lista y en el título del detalle). Por sus motivos:
 * la cancelación de una reserva que no estaba, o la que se sumó a una que sí.
 * Si la reserva ya no estaba en un estado tocable, lo dice su historial
 * (`consultas.ts`).
 */
export function esCancelacion(motivos: readonly string[]): boolean {
  return motivos.some((m) => {
    const c = categoriaDeMotivo(m);
    return c === "cancelacion" || c === "cancelacion_sin_reserva";
  });
}

/**
 * Owner 2026-10-16: la columna del pasajero principal con la cantidad
 * ("Juan Perez x 3"). La cantidad es el pax de la reserva o, si falta, los
 * nombres que trae. Sin nombre, solo la cantidad; sin nada, null.
 */
export function pasajeroYCantidad(f: { pasajeros: readonly string[]; pax: number | null }): string | null {
  const principal = f.pasajeros[0]?.trim() || null;
  const cantidad = f.pax ?? (f.pasajeros.length || null);
  if (principal) return cantidad ? `${principal} x ${cantidad}` : principal;
  return cantidad ? String(cantidad) : null;
}

/** Para comparar en la búsqueda: sin mayúsculas, sin acentos y con los espacios simples. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Owner 2026-10-16: la caja de búsqueda de la lista. Coincide si el texto está
 * en el nombre de algún pasajero o en el número de reserva de la agencia, sin
 * distinguir mayúsculas ni acentos. Vacío = todas.
 */
export function coincideBusqueda(f: { pasajeros: readonly string[]; numero: string | null }, texto: string): boolean {
  const q = normalizarBusqueda(texto);
  if (!q) return true;
  return [...f.pasajeros, f.numero ?? ""].some((x) => normalizarBusqueda(x).includes(q));
}
