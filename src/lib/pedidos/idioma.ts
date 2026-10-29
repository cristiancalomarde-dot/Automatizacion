/**
 * El idioma de un pedido (spec M3-32, owner 2026-10-28): a los proveedores de Brasil (su `ciudad` en
 * el directorio está en `data/ciudades-portugues.csv`) el pedido les sale en portugués de Brasil; al
 * resto, en castellano, como siempre.
 *
 * Los textos que arma la app dentro del mail (fechas, noches, habitación, pick up, vuelo, pasajeros,
 * pendientes, el horario de M3-34) salen de esta tabla, uno por idioma: las funciones de formato la
 * reciben, la lógica es una sola. Son textos fijos, sin IA (#3). Lo interno (la pantalla, los avisos,
 * las tareas) no pasa por acá: sigue en castellano. Puro, sin archivos: se puede importar en el navegador.
 */
import { normalizarTexto } from "@/lib/catalogo/reglas";
import { TEXTOS } from "@/lib/textos";

export type Idioma = "es" | "pt";

export interface TextosDelPedido {
  meses: readonly string[];
  /** Las palabras del rango de fechas: "del 5 al 8 mar" / "de 5 a 8 mar". */
  rango: { desde: string; hasta: string };
  noches: (n: number) => string;
  alojamiento: string;
  habitacion: string;
  conDesayuno: string;
  /** Las habitaciones en palabras (las siglas DBL/SGL/TWIN/TPL no se traducen). */
  tipos: Readonly<Record<string, string>>;
  excursion: string;
  fecha: string;
  aCoordinar: string;
  estadia: (rango: string) => string;
  desde: string;
  hasta: string;
  servicio: string;
  regular: Readonly<Record<string, string>>;
  idioma: string;
  idiomas: Readonly<Record<string, string>>;
  conEntradas: string;
  puntoDeEncuentro: (punto: string) => string;
  pickUpYDropOff: string;
  alojamientoAConfirmar: string;
  traslado: { in: string; out: string; suelto: string };
  vueloPendiente: string;
  busOVueloPendiente: string;
  vuelo: {
    vuelo: string;
    sinNumero: string;
    sale: string;
    llega: string;
    llegada: string;
    salida: string;
    sinNumeroDeVuelo: string;
    horas: string;
  };
  bus: string;
  nocturno: string;
  horario: string;
  llegaEl: (fecha: string) => string;
  /** El paquete con traslados de Iguazú (M3-12). */
  lado: { argentino: string; brasileno: string };
  enIngles: string;
  cruce: (destino: "Brasil" | "Argentina") => string;
  pendiente: { alojamiento: string; vuelo: string; busOVuelo: string };
  pasajeros: string;
  pasajeroPrincipal: string;
  pax: { nacionalidad: string; nacimiento: string; pasaporte: string; pendiente: string; telefono: string };
  horarioExcursiones: (n: number) => string;
}

const ES: TextosDelPedido = {
  meses: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  rango: { desde: "del", hasta: "al" },
  noches: (n) => `${n} ${n === 1 ? "noche" : "noches"}`,
  alojamiento: "Alojamiento",
  habitacion: "Habitación",
  conDesayuno: "con desayuno",
  tipos: {},
  excursion: "Excursión",
  fecha: "Fecha",
  aCoordinar: "a coordinar",
  estadia: (rango) => `a coordinar (estadía ${rango})`,
  desde: "Desde",
  hasta: "Hasta",
  servicio: "Servicio",
  regular: {},
  idioma: "Idioma",
  idiomas: {},
  conEntradas: "Con entradas",
  puntoDeEncuentro: (punto) => `Punto de encuentro: ${punto} (el pasajero va directo)`,
  pickUpYDropOff: "Pick up y drop off",
  alojamientoAConfirmar: "alojamiento a confirmar",
  traslado: { in: "Traslado de llegada", out: "Traslado de salida", suelto: "Traslado" },
  vueloPendiente: "Vuelo pendiente",
  busOVueloPendiente: "Bus o vuelo pendiente",
  vuelo: { vuelo: "Vuelo", sinNumero: "Vuelo sin número", sale: "sale", llega: "llega", llegada: "Llegada", salida: "Salida", sinNumeroDeVuelo: "sin número de vuelo", horas: " hs" },
  bus: "Bus",
  nocturno: "nocturno",
  horario: "Horario",
  llegaEl: (fecha) => `llega el ${fecha}`,
  lado: { argentino: "Lado argentino", brasileno: "Lado brasileño" },
  enIngles: "en inglés",
  cruce: (destino) =>
    `Ese día cruzan: el drop off es en el hotel de ${destino}. Los pasajeros hacen check out y llevan el equipaje a la excursión (lo dejan en los lockers del parque nacional).`,
  pendiente: {
    alojamiento: "Les pasamos el alojamiento para el pick up apenas lo tengamos.",
    vuelo: "El vuelo todavía no lo tenemos: se lo pasamos apenas nos llegue.",
    busOVuelo: "Todavía no sabemos si llegan en bus o en vuelo: se lo pasamos apenas nos llegue.",
  },
  pasajeros: "Pasajeros",
  pasajeroPrincipal: "pasajero principal",
  pax: { nacionalidad: "Nacionalidad", nacimiento: "Fecha de nacimiento", pasaporte: "Pasaporte", pendiente: "pendiente", telefono: "Teléfono" },
  horarioExcursiones: TEXTOS.pedidoProveedor.horarioExcursiones,
};

const PT: TextosDelPedido = {
  meses: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  rango: { desde: "de", hasta: "a" },
  noches: (n) => `${n} ${n === 1 ? "noite" : "noites"}`,
  alojamiento: "Hospedagem",
  habitacion: "Quarto",
  conDesayuno: "com café da manhã",
  tipos: { "dorm compartido": "quarto compartilhado (dorm)", "dorm compartido (viajan juntos)": "quarto compartilhado (dorm, viajam juntos)" },
  excursion: "Passeio",
  fecha: "Data",
  aCoordinar: "a combinar",
  estadia: (rango) => `a combinar (estadia ${rango})`,
  desde: "De",
  hasta: "Até",
  servicio: "Serviço",
  regular: { privado: "privativo" },
  idioma: "Idioma",
  idiomas: { español: "espanhol", inglés: "inglês" },
  conEntradas: "Com ingressos",
  puntoDeEncuentro: (punto) => `Ponto de encontro: ${punto} (o passageiro vai direto)`,
  pickUpYDropOff: "Pick up e drop off",
  alojamientoAConfirmar: "hospedagem a confirmar",
  traslado: { in: "Transfer de chegada", out: "Transfer de saída", suelto: "Transfer" },
  vueloPendiente: "Voo a confirmar",
  busOVueloPendiente: "Ônibus ou voo a confirmar",
  vuelo: { vuelo: "Voo", sinNumero: "Voo sem número", sale: "sai", llega: "chega", llegada: "Chegada", salida: "Saída", sinNumeroDeVuelo: "sem número de voo", horas: "" },
  bus: "Ônibus",
  nocturno: "noturno",
  horario: "Horário",
  llegaEl: (fecha) => `chega em ${fecha}`,
  lado: { argentino: "Lado argentino", brasileno: "Lado brasileiro" },
  enIngles: "em inglês",
  cruce: (destino) =>
    `Nesse dia eles cruzam a fronteira: o drop off é no hotel ${destino === "Brasil" ? "do Brasil" : "da Argentina"}. Os passageiros fazem o check-out e levam a bagagem no passeio (deixam nos armários do parque nacional).`,
  pendiente: {
    alojamiento: "Passamos a hospedagem para o pick up assim que a tivermos.",
    vuelo: "Ainda não temos o voo: passamos para vocês assim que chegar.",
    busOVuelo: "Ainda não sabemos se chegam de ônibus ou de avião: passamos para vocês assim que soubermos.",
  },
  pasajeros: "Passageiros",
  pasajeroPrincipal: "passageiro principal",
  pax: { nacionalidad: "Nacionalidade", nacimiento: "Data de nascimento", pasaporte: "Passaporte", pendiente: "pendente", telefono: "Telefone" },
  horarioExcursiones: (n) =>
    n <= 0 ? "" : n === 1 ? "Vocês podem nos confirmar o horário do passeio, por favor?" : "Vocês podem nos confirmar o horário dos passeios, por favor?",
};

export const TEXTOS_DEL_PEDIDO: Readonly<Record<Idioma, TextosDelPedido>> = { es: ES, pt: PT };

/** Un texto de la tabla en ese idioma; si no tiene traducción, el de castellano tal cual. */
export const traducir = (mapa: Readonly<Record<string, string>>, texto: string): string => mapa[texto] ?? texto;

/**
 * El idioma de un proveedor por su ciudad del directorio: portugués si está en la lista (sin
 * mayúsculas ni acentos: "Foz do Iguaçu" = "FOZ DO IGUAZU"); sin ciudad o sin lista, castellano.
 */
export function idiomaDeLaCiudad(ciudad: string | null | undefined, ciudades: readonly { ciudad: string }[] | undefined): Idioma {
  const c = normalizarTexto(ciudad ?? "").replace(/\s+/g, " ").trim();
  if (!c || !ciudades?.length) return "es";
  return ciudades.some((x) => normalizarTexto(x.ciudad).replace(/\s+/g, " ").trim() === c) ? "pt" : "es";
}
