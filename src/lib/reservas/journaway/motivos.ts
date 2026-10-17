/**
 * Los motivos de "para revisión" y las notas de las reservas de Journaway
 * (spec M2-09), en castellano llano para quien revisa. Sin datos de pasajeros:
 * solo códigos, nombres de tours y fechas.
 */

const lista = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

export const MOTIVOS_JOURNAWAY = {
  /** Fila 1. */
  codigoNoEsta: (codigo: string) => `El código ${codigo} no está en el catálogo`,
  codigoContradice: (codigos: string[], tours: string) => `El mail dice ${codigos.join(" + ")}, pero los tours dan ${tours}`,
  /** Fila 2. */
  tourNoReconocido: (nombre: string) => `No se reconoce el tour '${nombre}'`,
  sinTours: "El mail no dice qué tours se reservan",
  /** Fila 5. */
  sobran: (nombres: string[]) => `Estos tours no arman ningún paquete conocido: sobra ${lista(nombres.map((n) => `'${n}'`))}`,
  ningunPaquete: "Estos tours no arman ningún paquete conocido",
  variasCombinaciones: (opciones: string[]) => `Estos tours arman más de un paquete: pueden ser ${opciones.join(" o ")}`,
  /** Fila 6. */
  faltaDiaOverland: (dia: number) => `Falta el día ${dia} del Overland`,
  nochesFuera: (noches: number, opciones: Array<{ codigo: string; noches: number }>) =>
    `Son ${noches} noches en San Pedro: no es ${opciones.map((o) => `${o.codigo} (${o.noches} noches)`).join(" ni ")}`,
  sinNoches: "No se sabe cuántas noches hay en San Pedro (no hay vuelo a Calama, ni tours de San Pedro, ni N/D en el título)",
  faltaTour: (codigo: string, nombre: string, paquete: string) => `Falta ${nombre} (${codigo}) para ${paquete}`,
  sobraTour: (nombre: string, paquete: string) => `Sobra '${nombre}' para ${paquete}`,
  /** Fila 9. */
  paxDistinto: (pax: number, pasajeros: number) => `Pax dice ${pax} y hay ${pasajeros} pasajeros`,
} as const;

export const NOTAS_JOURNAWAY = {
  /** Fila 1 (owner 2026-10-12: SPAP05 y SPAP06 son el mismo tour para HI Travel). */
  codigoDeLaFamilia: (codigo: string, noches: number | null, segunTours: string) =>
    `El mail dice ${codigo}, pero ${noches === null ? "los tours dan" : `son ${noches} noches en San Pedro: sería`} ${segunTours}. ` +
    `Para HI Travel es el mismo tour: se usa ${codigo}`,
  /** Fila 7 (owner 2026-10-12): el título no manda a revisión. */
  tituloDistinto: (titulo: string, noches: number, codigo: string) =>
    `El título dice ${titulo}, pero los tours dan ${noches} noches en San Pedro: es ${codigo}`,
  /** Fila 14. */
  pasaportes: "Trae adjuntos: pasaportes (no se leen)",
  /** Fila 10. */
  todosLosHoteles: "Todos los hoteles los reserva Journaway",
  /** Fila 15. */
  soloLlegada: (otro: string) => `Solo la llegada: la salida va con ${otro}`,
} as const;
