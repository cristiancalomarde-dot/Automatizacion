/**
 * Ciudades de los Word de catálogo → destino de los paquetes (spec M1-05,
 * Anexo: "Normalizar ciudades del Word contra el destino de cada paquete").
 *
 * Los destinos son los de `data/paquetes-piloto.csv` (CHA, FTE, PNT, …) más
 * los puntos de paso de los buses que no tienen paquete (Calama, Río
 * Gallegos, Punta Arenas). Iguazú es un solo destino (IGR) para los dos
 * lados, como en los paquetes OD010A-D.
 *
 * Un nombre que no está acá no se adivina: el lector lo deja sin destino y
 * el armado manda el tour a revisión.
 */

const ALIAS: Array<[string, string]> = [
  ["el chalten", "CHA"],
  ["chalten", "CHA"],
  ["el calafate", "FTE"],
  ["calafate", "FTE"],
  ["puerto natales", "PNT"],
  ["natales", "PNT"],
  // El W Trek (CH10) es Torres del Paine; el paquete es de Puerto Natales.
  ["torres del paine", "PNT"],
  ["paine", "PNT"],
  ["pehoe", "PNT"],
  ["refugio", "PNT"],
  ["w trek", "PNT"],
  ["punta arenas", "PUQ"],
  ["buenos aires", "BUE"],
  ["puerto madryn", "PMY"],
  ["madryn", "PMY"],
  ["rio gallegos", "RGL"],
  ["rio galleos", "RGL"],
  ["ushuaia", "USH"],
  ["mendoza", "MDZ"],
  ["santiago de chile", "SCL"],
  ["santiago", "SCL"],
  ["valparaiso", "VLP"],
  ["calama", "CJC"],
  ["san pedro de atacama", "SPA"],
  ["san pedro", "SPA"],
  ["uyuni", "UYU"],
  ["salar de uyuni", "UYU"],
  ["la paz", "LPB"],
  ["rio de janeiro", "RIO"],
  ["rio", "RIO"],
  ["sao paulo", "SAO"],
  ["puerto iguazu", "IGR"],
  ["foz do iguazu", "IGR"],
  ["foz do iguacu", "IGR"],
  ["iguazu", "IGR"],
  ["foz", "IGR"],
];

/** Palabras que ganan a cualquier ciudad en un encabezado ("San Pedro to Uyuni Overland including:"). */
const PRIORIDAD: Array<[string, string]> = [["overland", "UYU"]];

export const NOMBRE_DESTINO: Record<string, string> = {
  CHA: "El Chaltén",
  FTE: "El Calafate",
  PNT: "Puerto Natales",
  PUQ: "Punta Arenas",
  BUE: "Buenos Aires",
  PMY: "Puerto Madryn",
  RGL: "Río Gallegos",
  USH: "Ushuaia",
  MDZ: "Mendoza",
  SCL: "Santiago de Chile",
  VLP: "Valparaíso",
  CJC: "Calama",
  SPA: "San Pedro de Atacama",
  UYU: "Uyuni",
  LPB: "La Paz",
  RIO: "Río de Janeiro",
  SAO: "São Paulo",
  IGR: "Iguazú",
};

export function nombreDestino(destino: string): string {
  return NOMBRE_DESTINO[destino] ?? destino;
}

/** Sin acentos, minúsculas, solo letras y números separados por un espacio, con un espacio en cada punta. */
export function normalizarTexto(texto: string): string {
  return ` ${texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

interface Aparicion {
  destino: string;
  posicion: number;
  largo: number;
}

/** Todas las ciudades que nombra el texto, en el orden en que aparecen (palabras enteras). */
export function ciudadesEnTexto(texto: string): Aparicion[] {
  const t = normalizarTexto(texto);
  const apariciones: Aparicion[] = [];
  for (const [alias, destino] of ALIAS) {
    let desde = 0;
    for (;;) {
      const i = t.indexOf(` ${alias} `, desde);
      if (i === -1) break;
      apariciones.push({ destino, posicion: i, largo: alias.length });
      desde = i + 1;
    }
  }
  // A igual posición gana el nombre más largo ("rio gallegos" antes que "rio");
  // un nombre metido dentro de otro más largo no cuenta.
  apariciones.sort((a, b) => a.posicion - b.posicion || b.largo - a.largo);
  const resultado: Aparicion[] = [];
  let finAnterior = -1;
  for (const a of apariciones) {
    if (a.posicion < finAnterior) continue;
    resultado.push(a);
    finAnterior = a.posicion + a.largo + 1;
  }
  return resultado;
}

/** La primera ciudad que nombra el texto (o null). */
export function primeraCiudad(texto: string): string | null {
  return ciudadesEnTexto(texto)[0]?.destino ?? null;
}

/** La última ciudad que nombra el texto (o null). */
export function ultimaCiudad(texto: string): string | null {
  const todas = ciudadesEnTexto(texto);
  return todas.length ? todas[todas.length - 1].destino : null;
}

/** El destino de un encabezado: primero las palabras con prioridad ("Overland"), después la primera ciudad. */
export function destinoDeEncabezado(texto: string): string | null {
  const t = normalizarTexto(texto);
  for (const [palabra, destino] of PRIORIDAD) if (t.includes(` ${palabra} `)) return destino;
  return primeraCiudad(texto);
}

/** true si el texto nombra ese destino. */
export function nombraDestino(texto: string, destino: string): boolean {
  return ciudadesEnTexto(texto).some((a) => a.destino === destino);
}
