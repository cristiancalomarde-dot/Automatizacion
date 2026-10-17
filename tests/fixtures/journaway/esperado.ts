import type { MailEsperado } from "@/lib/reservas/journaway/comparar";

/**
 * Lo que tiene que dar el modo prueba con los 4 mails reales de Journaway
 * (spec M2-09 §3, la tabla "Los 4 mails de ejemplo"). Es la vara de la pieza:
 * `npm run probar:mails -- --journaway` compara contra esto y deja cada
 * diferencia en `docs/sdd/diagnosticos/M2-09-journaway.md`.
 *
 * Los nombres de los pasajeros son los de la spec. El número de viaje de C es
 * el Trip Number: el booking_id de Journaway es el ID del asunto (owner,
 * 2026-10-13), y las copias .docx no traen asunto, así que queda vacío.
 */

const IGUAZU_PAX = ["Carolyn Katharina Gallien", "Bennet Lenn Gallien"];
const C_PAX = ["Brit Sumfleth", "Sarah Kirmse"];

export const ESPERADO_JOURNAWAY: MailEsperado[] = [
  {
    letra: "A",
    titulo: "Iguazu Fall Argentina Side",
    archivo: "Iguazu Fall Argentina Side",
    reservas: [
      {
        producto: "IGRE01",
        estado: "recibida",
        tripNumber: null,
        pax: 2,
        pasajeros: IGUAZU_PAX,
        partes: [{ codigo: "IGRE01", fecha: "2027-06-14", pickUp: "Hotel Rafain Centro" }],
        vuelos: [],
        hoteles: 0,
        notas: ["Journaway lo llama half-day; es el full day"],
      },
    ],
  },
  {
    letra: "B",
    titulo: "Iguazu Falls Brazilian Side",
    archivo: "Iguazu Falls Brazilian Side",
    reservas: [
      {
        producto: "IGRE02",
        estado: "recibida",
        tripNumber: null,
        pax: 2,
        pasajeros: IGUAZU_PAX,
        partes: [{ codigo: "IGRE02", fecha: "2027-06-13", pickUp: "Hotel Rafain Centro" }],
        vuelos: [],
        hoteles: 0,
      },
    ],
  },
  {
    letra: "C",
    titulo: "All San Pedro 4 days mas San Pedro Extension",
    archivo: "All San Pedro 4 days mas San Pedro Extension",
    reservas: [
      {
        producto: "SPAP01",
        estado: "recibida",
        tripNumber: "62992",
        pax: 2,
        pasajeros: C_PAX,
        partes: [
          { codigo: "SPAT01", fecha: "2027-03-16", pickUp: null },
          { codigo: "SPAE01", fecha: "2027-03-16", pickUp: null },
          { codigo: "SPAE02", fecha: "2027-03-19", pickUp: null },
          { codigo: "SPAE03", fecha: "2027-03-17", pickUp: null },
          { codigo: "SPAE04", fecha: "2027-03-17", pickUp: null },
        ],
        vuelos: ["LA156", "LA377"],
        trasladoLlegada: { vuelo: "LA156", fecha: "2027-03-16", hora: "17:41" },
        hoteles: 0,
      },
      {
        producto: "SPAP03",
        estado: "recibida",
        tripNumber: "62992",
        pax: 2,
        pasajeros: C_PAX,
        partes: [
          { codigo: "SPAE07", fecha: "2027-03-21", pickUp: null },
          { codigo: "SPAE06", fecha: "2027-03-20", pickUp: null },
          { codigo: "SPAE05", fecha: "2027-03-18", pickUp: null },
          { codigo: "SPAT01", fecha: "2027-03-23", pickUp: null },
        ],
        vuelos: ["LA156", "LA377"],
        trasladoSalida: { vuelo: "LA377", fecha: "2027-03-23", hora: "20:39" },
        hoteles: 0,
      },
    ],
  },
  {
    letra: "D",
    titulo: "San Pedro de Atacama and Uyuni Salt Flats in Tayka Hotels 7N8D",
    archivo: "Tayka Hotels 7N8D",
    reservas: [
      {
        producto: "SPAP05",
        estado: "recibida",
        tripNumber: null,
        pax: 2,
        pasajeros: ["Kai Sacher", "Jeannette Tschorba"],
        partes: [
          { codigo: "SPAT01", fecha: "2026-10-11", pickUp: null },
          { codigo: "SPAE01", fecha: "2026-10-11", pickUp: "Our Habitas Atacama" },
          { codigo: "SPAE03", fecha: "2026-10-12", pickUp: "Our Habitas Atacama" },
          { codigo: "SPAE05", fecha: "2026-10-13", pickUp: "Our Habitas Atacama" },
          { codigo: "SPAE04", fecha: "2026-10-14", pickUp: "Our Habitas Atacama" },
          { codigo: "SPAT02", fecha: "2026-10-15", pickUp: null },
          { codigo: "UYUO01", fecha: "2026-10-15", pickUp: "Tayka del Desierto Hotel / Tayka del Sal Hotel" },
        ],
        vuelos: ["IB1314", "LA5404", "LA148", "LA2277", "LA2484", "IB1315"],
        trasladoLlegada: { vuelo: "LA148", fecha: "2026-10-11", hora: "16:11" },
        hoteles: 8,
      },
    ],
  },
];
