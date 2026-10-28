import type { Campo, DatoClave, FichaIA, FichaLectura, VueloIA } from "./esquema-ficha";
import { DATOS_CLAVE } from "./esquema-ficha";
import { normalizarBookingId } from "./booking-id";

/**
 * Los controles del código sobre lo que devolvió la IA (spec M2-02 filas 14,
 * 19, 21 y 27; `integraciones-ia.md`, "No confiar solo en la confianza de la
 * IA"). La confianza que la IA se pone suele ser optimista: si un control
 * falla, el dato queda dudoso aunque la IA diga 0,99.
 *
 * - Fechas a año-mes-día; una fecha que no existe queda vacía, confianza 0.
 * - El número de reserva y los números de vuelo tienen que aparecer escritos
 *   en el mail (asunto + cuerpo); si no, se descartan con una nota. Si se
 *   mandó un PDF, lo que no está en el cuerpo puede estar en el PDF: no se
 *   puede chequear y queda la confianza de la IA.
 * - Las fechas tienen que aparecer escritas (en cualquiera de los formatos de
 *   los mails); la cantidad de pasajeros, coincidir con la lista; las fechas
 *   de un producto, con sus noches.
 *
 * Las notas nunca llevan datos de pasajeros (solo números de reserva, de
 * vuelo y fechas).
 */

export const UMBRAL_CONFIANZA = 0.8;

const MESES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MESES_LARGOS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function anioDeDosCifras(yy: number): number {
  const limite = new Date().getUTCFullYear() + 5;
  return 2000 + yy <= limite ? 2000 + yy : 1900 + yy;
}

function iso(anio: number, mes: number, dia: number): string | null {
  if (!Number.isInteger(anio) || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Una fecha de los mails a año-mes-día: "2026-09-06", "06 Sep 2026",
 * "01SEP26", "06.10.26", "14.06.2027", "30DEC03". Null si no existe o no se
 * entiende.
 */
export function normalizarFecha(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const t = texto.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(t);
  if (m) return iso(m[3].length === 2 ? anioDeDosCifras(+m[3]) : +m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*(\d{2}|\d{4})$/.exec(t);
  if (m) {
    const nombre = m[2].toLowerCase();
    const mes = MESES.indexOf(nombre.slice(0, 3)) + 1;
    if (mes === 0 || (nombre.length > 3 && !MESES_LARGOS[mes - 1].startsWith(nombre))) return null;
    return iso(m[3].length === 2 ? anioDeDosCifras(+m[3]) : +m[3], mes, +m[1]);
  }
  return null;
}

/**
 * El número limpio: Kilroy y Jysk, país + dígitos; TourRadar, el primer
 * número del Booking Statement; Journaway, el "ID" de 11 dígitos del asunto.
 * Es la misma normalización con la que M2-04 busca el intercambio
 * (`booking-id.ts`).
 */
export function numeroLimpio(original: string | null, agencia: string): string | null {
  return normalizarBookingId(original, agencia);
}

const sinEspacios = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Un código (número de reserva o de vuelo) escrito en el texto, sin que sea parte de otro más largo. */
export function codigoApareceEnTexto(codigo: string, texto: string): boolean {
  const c = codigo.toLowerCase().replace(/\s+/g, "");
  if (!c) return false;
  // Entre los caracteres del código puede haber un espacio ("IB 1314" = "IB1314").
  const patron = [...c].map(escapar).join("\\s?");
  return new RegExp(`(?<![a-z0-9])${patron}(?![a-z0-9])`).test(texto.toLowerCase());
}

/** La fecha (año-mes-día) escrita en el texto en alguno de los formatos de los mails. */
export function fechaApareceEnTexto(fechaIso: string, texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso);
  if (!m) return false;
  // "10th November 2026", "3rd March 1999" (Adventure360, M3-13): el ordinal inglés no cuenta.
  const sinOrdinales = texto.replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1");
  const [yyyy, mm, dd] = [m[1], m[2], m[3]];
  const yy = yyyy.slice(2);
  const d = String(+dd);
  const mn = String(+mm);
  const mon = MESES[+mm - 1];
  const month = MESES_LARGOS[+mm - 1];
  const variantes = [
    `${dd}${mon}${yyyy}`,
    `${d}${mon}${yyyy}`,
    `${dd}${mon}${yy}`,
    `${dd}${month}${yyyy}`,
    `${d}${month}${yyyy}`,
    `${mon}${dd},${yyyy}`,
    `${mon}${d},${yyyy}`,
    `${month}${d},${yyyy}`,
    `${dd}.${mm}.${yyyy}`,
    `${dd}.${mm}.${yy}`,
    `${d}.${mn}.${yyyy}`,
    `${dd}/${mm}/${yyyy}`,
    `${dd}/${mm}/${yy}`,
    `${dd}-${mm}-${yyyy}`,
    `${yyyy}-${mm}-${dd}`,
  ];
  const t = sinEspacios(sinOrdinales);
  return variantes.some((v) => new RegExp(`(?<![0-9])${escapar(v)}(?![0-9])`).test(t));
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

/**
 * M3-26 (owner, 2026-10-28; DK1597924): Kilroy a veces escribe en "Extra Requests" solo el
 * aeropuerto, el día y la hora, sin número de vuelo:
 *   "Pax will be arriving at IGU airport at 20FEB2027 at 16:45"
 *   "Pax will be departing from IGR airport at 23FEB2027 at 13:30"
 * Reconocimiento fijo (sin IA, #3): cada renglón es un vuelo sin número de ese lado.
 */
const VUELO_SIN_NUMERO =
  /\b([Aa]rriving|[Dd]eparting)\s+(?:at|from|to|in|into)\s+([A-Z]{3})\s+[Aa]irport\s+(?:at|on)\s+(\d{1,2}\s*[A-Za-z]{3,9}\.?\s*\d{2,4})\s+(?:at\s+)?(\d{1,2})[:.](\d{2})\b/g;

export function vuelosSinNumeroDelTexto(texto: string): VueloIA[] {
  const vuelos: VueloIA[] = [];
  const vistos = new Set<string>();
  for (const m of texto.matchAll(VUELO_SIN_NUMERO)) {
    const fecha = normalizarFecha(m[3]);
    const h = Number(m[4]);
    if (!fecha || h > 23 || Number(m[5]) > 59) continue;
    const hora = `${String(h).padStart(2, "0")}:${m[5]}`;
    const llega = m[1].toLowerCase() === "arriving";
    const clave = `${llega}|${m[2]}|${fecha}|${hora}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const lado = { aeropuerto: m[2], fecha, hora };
    const nada = { aeropuerto: null, fecha: null, hora: null };
    const [sale, entra] = llega ? [nada, lado] : [lado, nada];
    vuelos.push({
      numero: null,
      aerolinea: null,
      origen: sale.aeropuerto,
      destino: entra.aeropuerto,
      fecha_salida: sale.fecha,
      hora_salida: sale.hora,
      fecha_llegada: entra.fecha,
      hora_llegada: entra.hora,
      confianza: 1,
    });
  }
  return vuelos;
}

/** Los vuelos sin número del texto que no están ya (mismo lado, con el mismo aeropuerto o el mismo día y hora). */
export function vuelosSinNumeroQueFaltan(existentes: readonly VueloIA[], texto: string): VueloIA[] {
  return vuelosSinNumeroDelTexto(texto).filter((n) => {
    const llega = !!n.destino;
    return !existentes.some((v) => {
      const aeropuerto = (llega ? v.destino : v.origen)?.trim().toUpperCase();
      const fecha = llega ? v.fecha_llegada : v.fecha_salida;
      const hora = llega ? v.hora_llegada : v.hora_salida;
      if (aeropuerto) return aeropuerto === (llega ? n.destino : n.origen);
      return fecha === (llega ? n.fecha_llegada : n.fecha_salida) && !!hora;
    });
  });
}

export interface ContextoLimpieza {
  /** La agencia reconocida por el remitente (`agencias.csv`). */
  agencia: string;
  /** Asunto + cuerpo original del mail: contra esto se chequea lo literal. */
  textoVerificable: string;
  /** Si se mandó un PDF: lo que no está en el cuerpo no se puede chequear. */
  seMandoPdf: boolean;
  adjuntosNoLeidos: string[];
}

export function limpiarFicha(
  ficha: FichaIA,
  ctx: ContextoLimpieza,
  meta: { version_instrucciones: string; modelo: string } = { version_instrucciones: "", modelo: "" },
): FichaLectura {
  const dudosos = new Set<DatoClave>();
  const notas: string[] = [];
  const texto = ctx.textoVerificable;

  /** Fecha de la IA → ISO. `true` si quedó bien; si no existía, la deja vacía y marca el dato. */
  const fechaLimpia = (valor: string | null, dato: DatoClave): { valor: string | null; ok: boolean } => {
    if (valor === null) return { valor: null, ok: true };
    const limpia = normalizarFecha(valor);
    if (!limpia) {
      dudosos.add(dato);
      notas.push(`Una fecha que devolvió la IA no existe ("${valor}"): se descartó.`);
      return { valor: null, ok: false };
    }
    if (!fechaApareceEnTexto(limpia, texto) && !ctx.seMandoPdf) {
      dudosos.add(dato);
      notas.push(`La fecha ${limpia} no aparece escrita en el mail.`);
    }
    return { valor: limpia, ok: true };
  };

  const campoFecha = (c: Campo<string | null>): Campo<string | null> => {
    const r = fechaLimpia(c.valor, "fechas");
    return r.ok ? { valor: r.valor, confianza: c.confianza } : { valor: null, confianza: 0 };
  };

  // Agencia: manda el remitente; si la IA dice otra, se avisa.
  if (ficha.agencia.valor !== null && ficha.agencia.valor !== ctx.agencia) {
    dudosos.add("agencia");
    notas.push(`La IA dice que el mail es de ${ficha.agencia.valor}, pero el remitente es de ${ctx.agencia}.`);
  }

  // Número de reserva (fila 19).
  let numero = {
    valor: ficha.numero_reserva.valor,
    limpio: numeroLimpio(ficha.numero_reserva.valor, ctx.agencia),
    confianza: ficha.numero_reserva.confianza,
  };
  // Cuenta como escrito si cada código del número (cada parte con dígitos:
  // "DK1564627" de "DK1564627/cafj"; "65643802533" y "62992" de
  // "ID … · Trip …") aparece en el asunto o en el cuerpo.
  const codigos = numero.valor?.match(/[A-Za-z0-9]*\d[A-Za-z0-9]*/g) ?? [];
  const escrito = codigos.length > 0 && codigos.every((c) => codigoApareceEnTexto(c, texto));
  if (numero.valor !== null && !escrito && !ctx.seMandoPdf) {
    notas.push(`El número de reserva ${numero.valor} no aparece en el mail: se descartó.`);
    numero = { valor: null, limpio: null, confianza: 0 };
    dudosos.add("numero_reserva");
  }

  const productos = ficha.productos.map((p) => {
    const fi = fechaLimpia(p.fecha_inicio, "fechas");
    const ff = fechaLimpia(p.fecha_fin, "fechas");
    let confianza = fi.ok && ff.ok ? p.confianza : 0;
    if (p.noches !== null && fi.valor && ff.valor && diasEntre(fi.valor, ff.valor) !== p.noches) {
      dudosos.add("fechas");
      notas.push(`Las fechas ${fi.valor} a ${ff.valor} no dan ${p.noches} noches.`);
    }
    if (!fi.ok || !ff.ok) confianza = 0;
    return { ...p, fecha_inicio: fi.valor, fecha_fin: ff.valor, confianza };
  });

  // HI Travel nunca es un pasajero (fila 13).
  const pasajeros = ficha.pasajeros
    .filter((p) => {
      const esHiTravel = /hitravel/i.test(`${p.nombre} ${p.apellido}`);
      if (esHiTravel) {
        dudosos.add("pasajeros");
        notas.push("Se sacó de los pasajeros una dirección de HI Travel.");
      }
      return !esHiTravel;
    })
    .map((p) => {
      const nacimiento = normalizarFecha(p.fecha_nacimiento);
      if (p.fecha_nacimiento !== null && !nacimiento) {
        dudosos.add("pasajeros");
        return { ...p, fecha_nacimiento: null, confianza: 0 };
      }
      return { ...p, fecha_nacimiento: nacimiento };
    });

  const vuelos = ficha.vuelos.map((v) => {
    let r = { ...v };
    if (v.numero !== null && !codigoApareceEnTexto(v.numero, texto) && !ctx.seMandoPdf) {
      notas.push(`El vuelo ${v.numero} no aparece en el mail: se descartó el número.`);
      dudosos.add("vuelos");
      r = { ...r, numero: null, confianza: 0 };
    }
    for (const k of ["fecha_salida", "fecha_llegada"] as const) {
      const f = fechaLimpia(v[k], "vuelos");
      r = { ...r, [k]: f.valor, ...(f.ok ? {} : { confianza: 0 }) };
    }
    return r;
  });
  // M3-26: lo que Kilroy escribe sin número de vuelo ("Pax will be arriving at IGU airport at …"), si la IA no lo trajo.
  vuelos.push(...vuelosSinNumeroQueFaltan(vuelos, texto));

  const hoteles_agencia = ficha.hoteles_agencia.map((h) => {
    const entrada = normalizarFecha(h.fecha_entrada);
    const salida = normalizarFecha(h.fecha_salida);
    const roto = (h.fecha_entrada !== null && !entrada) || (h.fecha_salida !== null && !salida);
    return { ...h, fecha_entrada: entrada, fecha_salida: salida, confianza: roto ? 0 : h.confianza };
  });

  const fecha_inicio = campoFecha(ficha.fecha_inicio);
  const fecha_fin = campoFecha(ficha.fecha_fin);

  // Pax contra la lista de nombres (fila 27). TourRadar nombra solo al pasajero
  // principal (el "CUSTOMER") más la cantidad (owner, 2026-10-13): 1 nombre con
  // pax ≥ 1 está bien; más nombres que pax, no.
  const soloElPrincipal = ctx.agencia === "TourRadar" && pasajeros.length === 1;
  if (
    ficha.pax.valor !== null &&
    pasajeros.length > 0 &&
    ficha.pax.valor !== pasajeros.length &&
    !(soloElPrincipal && ficha.pax.valor >= 1)
  ) {
    dudosos.add("pax");
    notas.push(`Dice ${ficha.pax.valor} pasajeros pero lista ${pasajeros.length}.`);
  }

  // Confianza baja de la IA (fila 21): un dato presente por debajo del umbral.
  const bajo = (c: number) => c < UMBRAL_CONFIANZA;
  if (ficha.agencia.valor !== null && bajo(ficha.agencia.confianza)) dudosos.add("agencia");
  if (numero.valor !== null && bajo(numero.confianza)) dudosos.add("numero_reserva");
  if (productos.some((p) => bajo(p.confianza))) dudosos.add("producto");
  if ([fecha_inicio, fecha_fin].some((c) => c.valor !== null && bajo(c.confianza))) dudosos.add("fechas");
  if (ficha.pax.valor !== null && bajo(ficha.pax.confianza)) dudosos.add("pax");
  if (pasajeros.some((p) => bajo(p.confianza))) dudosos.add("pasajeros");
  if (vuelos.some((v) => bajo(v.confianza))) dudosos.add("vuelos");

  return {
    tipo_mail: ficha.tipo_mail,
    agencia: { valor: ctx.agencia, confianza: 1 },
    numero_reserva: numero,
    titulo_paquete: ficha.titulo_paquete,
    productos,
    fecha_inicio,
    fecha_fin,
    pax: ficha.pax,
    pasajeros,
    vuelos,
    hoteles_agencia,
    todos_hoteles_agencia: ficha.todos_hoteles_agencia,
    pedidos_especiales: ficha.pedidos_especiales,
    aviso: ficha.aviso,
    adjuntos_no_leidos: ctx.adjuntosNoLeidos,
    datos_dudosos: DATOS_CLAVE.filter((d) => dudosos.has(d)),
    notas,
    version_instrucciones: meta.version_instrucciones,
    modelo: meta.modelo,
  };
}
