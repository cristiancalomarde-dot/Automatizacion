import type { DatoClave, TipoMail } from "../esquema-ficha";

/**
 * Los motivos de "para revisión" del emparejado (spec M2-03), en castellano
 * llano para quien revisa. Ninguno lleva datos de pasajeros: solo códigos,
 * nombres de productos, ciudades y aeropuertos.
 */

const confianza = (c: number) => c.toFixed(2).replace(".", ",");

const DATO: Record<DatoClave, string> = {
  agencia: "agencia",
  numero_reserva: "número de reserva",
  producto: "producto",
  fechas: "fechas",
  pax: "cantidad de pasajeros",
  pasajeros: "pasajeros",
  vuelos: "vuelos",
};

export const MOTIVOS_EMPAREJADO = {
  /** Fila 5: el mail trae un código de la agencia que no está cargado. */
  codigoNoCargado: (codigo: string, nombre: string | null) =>
    `El producto ${codigo}${nombre ? ` (${nombre})` : ""} no está en el catálogo`,
  /** Fila 6: la IA dice, con confianza, que no está en la lista. */
  noEstaEnCatalogo: (nombre: string) =>
    `El producto ${nombre} no está en el catálogo (no coincide con ningún producto cargado)`,
  /** Fila 4 y 6: la IA no llega al umbral (con su sugerencia, si la hubo). */
  noSeguro: (nombre: string, sugerencia?: { codigo: string; confianza: number }) =>
    `No se pudo reconocer con seguridad el producto ${nombre}` +
    (sugerencia ? ` (la IA sugiere ${sugerencia.codigo}, con confianza ${confianza(sugerencia.confianza)})` : ""),
  /** Fila 4: la IA respondió un código que no está en la lista: se descarta. */
  codigoFueraDeLista: (nombre: string) =>
    `No se pudo reconocer con seguridad el producto ${nombre} (la IA respondió un código que no está en el catálogo)`,
  /** Fila 4: las noches del tour propuesto no coinciden con las fechas del mail. */
  nochesNoCoinciden: (nombre: string, codigo: string, nochesTour: number, nochesMail: number) =>
    `No se pudo reconocer con seguridad el producto ${nombre}: la IA sugiere ${codigo}, que tiene ${nochesTour} noches, ` +
    `pero el mail pide ${nochesMail}`,
  /** Fila 7. */
  techo: "No se usó la IA: se llegó al techo de gasto del mes",
  iaNoRespondio: "La IA no respondió",
  iaInvalida: (nombre: string) => `No se pudo reconocer con seguridad el producto ${nombre} (la respuesta de la IA no se pudo usar)`,
  iaNoDisponible: (nombre: string) => `No se pudo reconocer el producto ${nombre} sin la IA`,
  /** Fila 13. */
  dudosos: (datos: DatoClave[]) => `La IA no está segura de: ${datos.map((d) => DATO[d]).join(", ")}`,
  tipoMail: {
    cancelacion: "El mail es una cancelación: la resuelve una persona",
    cambio_o_cargo: "El mail es un cambio o un cargo sobre una reserva: lo resuelve una persona",
    respuesta_intercambio: "El mail es una respuesta dentro de un intercambio: lo resuelve una persona",
    no_es_reserva: "El mail no parece una reserva",
  } satisfies Record<Exclude<TipoMail, "reserva_nueva">, string>,
  sinProducto: "El mail no dice qué producto se reserva",
  sinFechaInicio: "El mail no trae la fecha de inicio",
  /** La lectura de M2-02 no pudo dar una ficha. */
  lecturaFallida: (motivo: string) => `No se pudo leer el mail: ${motivo}`,
  /** Fila 11. */
  faltaVuelo: (lado: "in" | "out", lugar: { ciudad: string; codigos: string[] } | null, para: string) =>
    `Falta el vuelo de ${lado === "in" ? "llegada" : "salida"}${
      lugar ? ` ${lado === "in" ? "a" : "de"} ${lugar.ciudad} (${lugar.codigos.join(" o ")})` : ""
    } para ${para}`,
  /** Fila 12. */
  elegirVariante: (codigo: string) => `Elegir la variante de ${codigo} (con o sin traslados)`,
} as const;
