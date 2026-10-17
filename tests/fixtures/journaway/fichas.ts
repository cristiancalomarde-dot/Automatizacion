import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FichaIA, FichaLectura, ProductoIA, VueloIA } from "@/lib/reservas/esquema-ficha";
import { limpiarFicha } from "@/lib/reservas/limpiar-ficha";
import { parsearMailDeTexto } from "@/lib/reservas/mail-de-texto";
import type { MailParaLeer } from "@/lib/reservas/preparar-mail";

/**
 * Los 4 mails de ejemplo de Journaway (spec M2-09 §3), anonimizados: los
 * textos de `mails/` y la ficha que devuelve la IA para cada uno (la forma
 * exacta de `FichaIA`, como la grabada de M2-02). Las variantes de la spec
 * se arman con `variante*` a partir de estas. Nunca llaman a la IA.
 */

export const MAILS_JOURNAWAY = {
  A: "a-iguazu-argentino",
  B: "b-iguazu-brasilero",
  C: "c-all-san-pedro",
  D: "d-spap05",
} as const;
export type LetraMail = keyof typeof MAILS_JOURNAWAY;

const DIR = join(__dirname, "mails");

export function textoJournaway(letra: LetraMail): string {
  return readFileSync(join(DIR, `${MAILS_JOURNAWAY[letra]}.txt`), "utf-8").replace(/\r\n?/g, "\n");
}

export function mailJournaway(letra: LetraMail, texto = textoJournaway(letra)): MailParaLeer {
  return parsearMailDeTexto(texto);
}

const c = <T>(valor: T, confianza = 1) => ({ valor, confianza });

function tour(nombre: string, fecha: string, pickUp: string | null = null): ProductoIA {
  return {
    nombre,
    codigo: null,
    fecha_inicio: fecha,
    fecha_fin: null,
    noches: null,
    habitacion: null,
    punto_recogida: pickUp,
    opcionales: [],
    confianza: 1,
  };
}

function vuelo(numero: string, origen: string, destino: string, salida: [string, string], llegada: [string, string], aerolinea = "LATAM Airlines Group"): VueloIA {
  return {
    numero,
    aerolinea,
    origen,
    destino,
    fecha_salida: salida[0],
    hora_salida: salida[1],
    fecha_llegada: llegada[0],
    hora_llegada: llegada[1],
    confianza: 1,
  };
}

const persona = (nombre: string, apellido: string, nacimiento: string) => ({
  nombre,
  apellido,
  nacionalidad: "Deutschland",
  fecha_nacimiento: nacimiento,
  confianza: 1,
});

function base(): Omit<FichaIA, "productos" | "pasajeros" | "vuelos" | "hoteles_agencia"> {
  return {
    tipo_mail: c("reserva_nueva" as const),
    agencia: c("Journaway"),
    numero_reserva: c<string | null>(null, 0),
    titulo_paquete: c<string | null>(null, 0),
    fecha_inicio: c<string | null>(null, 0),
    fecha_fin: c<string | null>(null, 0),
    pax: c<number | null>(2),
    todos_hoteles_agencia: c(false),
    pedidos_especiales: [],
    pdf_ilegible: false,
    aviso: null,
  };
}

const IGUAZU_PAX = [persona("Klara Katharina", "Ejemplo", "1978-03-09"), persona("Lenn", "Ejemplo", "2008-03-04")];

export const SAN_PEDRO = {
  astronomy: "San Pedro de Atacama: Astronomy Tour in the Atacama Desert",
  tatio: "San Pedro de Atacama: Tour to the Tatio Geysers",
  moon: "San Pedro de Atacama: Tour through the Moon Valley",
  saltFlats: "San Pedro de Atacama: Tour to the Quepiaco River, Monjes de la Pacana, and the Salt Flats",
  saltFlatsMinuscula: "San Pedro de Atacama: Tour to the Quepiaco River, Monjes de la Pacana, and the salt flats",
  rainbow: "San Pedro de Atacama: Tour to Rainbow Valley",
  redRocks: "San Pedro de Atacama: Full-Day Tour to the Red Rocks and Altiplano Lagoons",
  cejar: "San Pedro de Atacama: Tour to Laguna Cejar",
} as const;

export const OVERLAND = {
  dia1: "From San Pedro: Sol de Mañana Geysers, Licancabur Volcano & Laguna Colorada",
  dia2: "Siloli: Full-day tour to the Siloli Desert & the Black Lagoon",
  dia3: "Salar de Uyuni: Full-day tour to Uyuni",
} as const;

/** La ficha de la IA para cada mail de ejemplo (lo que devuelve con las instrucciones v3). */
export function fichaIAJournaway(letra: LetraMail): FichaIA {
  switch (letra) {
    case "A":
      return {
        ...base(),
        productos: [tour("From Foz do Iguaçu: Half-day tour to the Argentinean side of Iguazú Falls", "2027-06-14", "Hotel Rafain Centro")],
        fecha_inicio: c<string | null>("2027-06-14"),
        fecha_fin: c<string | null>("2027-06-14"),
        pasajeros: IGUAZU_PAX,
        vuelos: [],
        hoteles_agencia: [],
      };
    case "B":
      return {
        ...base(),
        productos: [tour("Half-day tour to the Brazilian Iguazú Falls", "2027-06-13", "Hotel Rafain Centro")],
        fecha_inicio: c<string | null>("2027-06-13"),
        fecha_fin: c<string | null>("2027-06-13"),
        pasajeros: IGUAZU_PAX,
        vuelos: [],
        hoteles_agencia: [],
      };
    case "C":
      return {
        ...base(),
        numero_reserva: c<string | null>("Trip 62992"),
        titulo_paquete: c<string | null>("Package All San Pedro de Atacama 8 Days - Transport + Activities"),
        productos: [
          tour(SAN_PEDRO.astronomy, "2027-03-16"),
          tour(SAN_PEDRO.tatio, "2027-03-17"),
          tour(SAN_PEDRO.moon, "2027-03-17"),
          tour(SAN_PEDRO.saltFlats, "2027-03-18"),
          tour(SAN_PEDRO.rainbow, "2027-03-19"),
          tour(SAN_PEDRO.redRocks, "2027-03-20"),
          tour(SAN_PEDRO.cejar, "2027-03-21"),
        ],
        fecha_inicio: c<string | null>("2027-03-16"),
        fecha_fin: c<string | null>("2027-03-23"),
        pasajeros: [persona("Ines", "Probe", "1974-01-29"), persona("Sara", "Muster", "1985-05-26")],
        vuelos: [
          vuelo("LA156", "SCL", "CJC", ["2027-03-16", "15:33"], ["2027-03-16", "17:41"]),
          vuelo("LA377", "CJC", "SCL", ["2027-03-23", "20:39"], ["2027-03-23", "22:43"]),
        ],
        hoteles_agencia: [],
        todos_hoteles_agencia: c(true),
      };
    case "D": {
      const hotel = (nombre: string, entrada: string, salida: string) => ({ nombre, fecha_entrada: entrada, fecha_salida: salida, confianza: 1 });
      return {
        ...base(),
        titulo_paquete: c<string | null>("Package Hi Travel: Package San Pedro de Atacama + Uyuni Salt Flats 7 Days - Transport + Accom. + Activities"),
        productos: [
          tour(SAN_PEDRO.astronomy, "2026-10-11", "Our Habitas Atacama"),
          tour(SAN_PEDRO.moon, "2026-10-12", "Our Habitas Atacama"),
          tour(SAN_PEDRO.saltFlatsMinuscula, "2026-10-13", "Our Habitas Atacama"),
          tour(SAN_PEDRO.tatio, "2026-10-14", "Our Habitas Atacama"),
          tour(OVERLAND.dia1, "2026-10-15", "Tayka del Desierto Hotel"),
          tour(OVERLAND.dia2, "2026-10-16", "Tayka del Sal Hotel"),
          tour(OVERLAND.dia3, "2026-10-17", "Tayka del Sal Hotel"),
        ],
        fecha_inicio: c<string | null>("2026-10-06"),
        fecha_fin: c<string | null>("2026-10-27"),
        pasajeros: [persona("Karl", "Mustermann", "1977-04-03"), persona("Erika", "Beispiel", "1970-02-20")],
        vuelos: [
          vuelo("IB1314", "MUC", "MAD", ["2026-10-06", "19:45"], ["2026-10-06", "22:35"], "Iberia"),
          vuelo("LA5404", "MAD", "SCL", ["2026-10-06", "23:59"], ["2026-10-07", "08:25"]),
          vuelo("LA148", "SCL", "CJC", ["2026-10-11", "14:01"], ["2026-10-11", "16:11"]),
          vuelo("LA2277", "CUZ", "LIM", ["2026-10-26", "18:45"], ["2026-10-26", "20:25"]),
          vuelo("LA2484", "LIM", "MAD", ["2026-10-26", "23:00"], ["2026-10-27", "16:20"]),
          vuelo("IB1315", "MAD", "MUC", ["2026-10-27", "20:00"], ["2026-10-27", "22:40"], "Iberia"),
        ],
        hoteles_agencia: [
          hotel("Hub Providencia", "2026-10-07", "2026-10-09"),
          hotel("Fauna Hotel", "2026-10-09", "2026-10-11"),
          hotel("Our Habitas Atacama", "2026-10-11", "2026-10-15"),
          hotel("MET Hotel", "2026-10-18", "2026-10-19"),
          hotel("Sonesta Posadas del Inca Lake Titicaca - Puno", "2026-10-19", "2026-10-20"),
          hotel("Night Bus Peru", "2026-10-20", "2026-10-21"),
          hotel("Hotel Viza", "2026-10-21", "2026-10-23"),
          hotel("Saska Boutique", "2026-10-23", "2026-10-26"),
        ],
      };
    }
  }
}

/** La ficha después de los controles del código (`limpiarFicha`), con el texto del mail. */
export function fichaLecturaDe(ficha: FichaIA, texto: string, adjuntosNoLeidos: string[] = []): FichaLectura {
  const mail = parsearMailDeTexto(texto);
  return limpiarFicha(
    ficha,
    { agencia: "Journaway", textoVerificable: `${mail.asunto ?? ""}\n${mail.cuerpoTexto ?? ""}`, seMandoPdf: false, adjuntosNoLeidos },
    { version_instrucciones: "lectura-mail.v3", modelo: "modelo-grabado" },
  );
}

/** Un mail de ejemplo listo para el reconocedor: texto, mail y ficha limpia. */
export function casoJournaway(letra: LetraMail) {
  const texto = textoJournaway(letra);
  return { texto, mail: mailJournaway(letra, texto), ficha: fichaLecturaDe(fichaIAJournaway(letra), texto) };
}

// --- Variantes de la spec (§3) ------------------------------------------------------------

export interface Variante {
  texto: string;
  ficha: FichaIA;
}

/** Saca de la ficha y del texto los tours cuyo nombre contiene `parte`. */
export function sinTour(v: Variante, parte: string): Variante {
  return {
    texto: v.texto
      .split("\n")
      .filter((l) => !l.includes(parte))
      .join("\n"),
    ficha: { ...v.ficha, productos: v.ficha.productos.filter((p) => !p.nombre.includes(parte)) },
  };
}

export function original(letra: LetraMail): Variante {
  return { texto: textoJournaway(letra), ficha: fichaIAJournaway(letra) };
}

/** Agrega un código al cuerpo (como lo pondría Journaway si se lo pedimos). */
export function conCodigo(v: Variante, codigo: string): Variante {
  return { ...v, texto: v.texto.replace("Booking information:", `Booking information:\nHI Travel code: ${codigo}`) };
}

/** Corre los días del Overland (y sus fechas en el texto) `dias` días. */
export function overlandCorrido(v: Variante, dias: number): Variante {
  const mover = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  };
  const aTexto = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  let texto = v.texto;
  const productos = v.ficha.productos.map((p) => {
    if (!Object.values(OVERLAND).includes(p.nombre as never) || !p.fecha_inicio) return p;
    const nueva = mover(p.fecha_inicio);
    return { ...p, fecha_inicio: nueva };
  });
  // Del último al primero, para no pisar una fecha ya movida.
  for (const p of [...v.ficha.productos].reverse()) {
    if (!Object.values(OVERLAND).includes(p.nombre as never) || !p.fecha_inicio) continue;
    const i = texto.indexOf(p.nombre);
    const desde = texto.indexOf("Date: ", i);
    texto = `${texto.slice(0, desde)}Date: ${aTexto(mover(p.fecha_inicio))}${texto.slice(desde + 16)}`;
  }
  return { texto, ficha: { ...v.ficha, productos } };
}

export function conTitulo(v: Variante, titulo: string): Variante {
  const anterior = v.ficha.titulo_paquete.valor ?? "";
  return {
    texto: anterior ? v.texto.replace(anterior.replace(/^Package Hi Travel: /, ""), titulo) : v.texto,
    ficha: { ...v.ficha, titulo_paquete: { valor: titulo, confianza: 1 } },
  };
}

export function conPax(v: Variante, pax: number): Variante {
  return { texto: v.texto.replace(/^Pax: \d+$/m, `Pax: ${pax}`), ficha: { ...v.ficha, pax: { valor: pax, confianza: 1 } } };
}

export function sinVuelo(v: Variante, numero: string): Variante {
  const sacado = v.ficha.vuelos.find((x) => x.numero === numero);
  // Sin ese renglón, el fin del viaje que salía del vuelo ya no está escrito en el mail.
  const finDelVuelo = sacado && [sacado.fecha_salida, sacado.fecha_llegada].includes(v.ficha.fecha_fin.valor);
  return {
    texto: v.texto
      .split("\n")
      .filter((l) => !l.includes(numero))
      .join("\n"),
    ficha: {
      ...v.ficha,
      vuelos: v.ficha.vuelos.filter((x) => x.numero !== numero),
      ...(finDelVuelo ? { fecha_fin: { valor: null, confianza: 0 } } : {}),
    },
  };
}

export function lecturaDeVariante(v: Variante, adjuntosNoLeidos: string[] = []) {
  return { texto: v.texto, mail: parsearMailDeTexto(v.texto), ficha: fichaLecturaDe(v.ficha, v.texto, adjuntosNoLeidos) };
}
