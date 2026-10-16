/**
 * Reservas sintéticas para los tests de pantalla de M2-05 (sin datos de
 * nadie: nombres, números y mails inventados).
 */
import { MOTIVOS_EMPAREJADO as ME } from "./emparejar/motivos";
import { MOTIVOS_INTERCAMBIO as MI } from "./intercambio";
import type { DetalleReserva, FilaReserva, MailDeReserva } from "./tipos";

export const IDS = {
  kilroy: "11111111-1111-4111-8111-111111111111",
  tour: "22222222-2222-4222-8222-222222222222",
  revision: "33333333-3333-4333-8333-333333333333",
  sinProducto: "44444444-4444-4444-8444-444444444444",
  dosMails: "55555555-5555-4555-8555-555555555555",
  vacia: "66666666-6666-4666-8666-666666666666",
} as const;

export const PRODUCTOS = {
  od019: { id: "aaaaaaaa-0000-4000-8000-000000000019", codigo: "OD019", nombre: "Iguazu Falls Combined" },
  chb31: { id: "aaaaaaaa-0000-4000-8000-000000000031", codigo: "CHB31", nombre: "Overland San Pedro de Atacama to Uyuni" },
  ch01: { id: "aaaaaaaa-0000-4000-8000-000000000101", codigo: "CH01", nombre: "San Pedro de Atacama" },
  bo01: { id: "aaaaaaaa-0000-4000-8000-000000000102", codigo: "BO01", nombre: "Uyuni Salt Flats" },
} as const;

export function mail(extra: Partial<MailDeReserva> = {}): MailDeReserva {
  return {
    id: "bbbbbbbb-0000-4000-8000-000000000001",
    remitente: "aarhus@kilroy.dk",
    remitenteNombre: "KILROY Aarhus",
    asunto: "DK1531608 - Iguazu Falls Combined - KILROY booking request",
    fecha: "2026-10-12T14:20:00.000Z",
    spam: false,
    cuerpo: "Dear HI Travel,\nPlease book Iguazu Falls Combined for 2 pax.\nBest regards",
    pdfs: [],
    ...extra,
  };
}

function fila(extra: Partial<FilaReserva> & Pick<FilaReserva, "id">): FilaReserva {
  return {
    estado: "recibida",
    agencia: "Kilroy",
    numero: "DK1531608",
    producto: PRODUCTOS.od019,
    fechaInicio: "2026-03-12",
    fechaFin: "2026-03-15",
    pax: 2,
    llego: "2026-10-12T14:20:00.000Z",
    motivos: [],
    posibleDuplicada: false,
    dePrueba: false,
    sinDatoLlegada: false,
    avisosVuelo: [],
    ...extra,
  };
}

export function detalle(extra: Partial<DetalleReserva> & Pick<DetalleReserva, "id">): DetalleReserva {
  return {
    ...fila(extra),
    productoTextoAgencia: "HI_ARGENTINA_OD019-677",
    duplicadaDeId: null,
    pasajeros: ["Ana Prueba", "Juan Ejemplo"],
    habitacion: "Doble",
    pedidosEspeciales: "Vegetariano",
    vuelos: [],
    partes: [],
    mails: [mail()],
    ...extra,
  };
}

/** La lista: 2 reales y 2 de prueba, en desorden de llegada. */
export const listaReservas: FilaReserva[] = [
  fila({ id: IDS.kilroy, llego: "2026-10-10T09:00:00.000Z" }),
  fila({
    id: IDS.revision,
    estado: "para_revision",
    motivos: [ME.faltaVuelo("in", null, "el traslado de OD019")],
    llego: "2026-10-13T11:00:00.000Z",
    dePrueba: true,
    numero: "DK1594100/maga",
  }),
  fila({
    id: IDS.sinProducto,
    estado: "para_revision",
    agencia: "TourRadar",
    numero: "1377598",
    producto: null,
    motivos: [MI.posibleDuplicada],
    posibleDuplicada: true,
    pax: 3,
    fechaInicio: "2026-11-01",
    fechaFin: "2026-11-08",
    llego: "2026-10-11T08:30:00.000Z",
    dePrueba: true,
  }),
  fila({
    id: IDS.tour,
    producto: PRODUCTOS.chb31,
    numero: "DK1562336",
    fechaInicio: "2026-04-02",
    fechaFin: "2026-04-09",
    pax: 1,
    llego: "2026-10-12T16:45:00.000Z",
  }),
];

export const reservaKilroy = detalle({ id: IDS.kilroy });

export const reservaTour = detalle({
  id: IDS.tour,
  producto: PRODUCTOS.chb31,
  numero: "DK1562336",
  partes: [
    { orden: 1, tipo: "paquete", producto: PRODUCTOS.ch01, descripcion: null, fechaInicio: "2026-04-02", fechaFin: "2026-04-05", esTarea: false },
    { orden: 2, tipo: "tramo_bus", producto: null, descripcion: "San Pedro de Atacama → Uyuni", fechaInicio: "2026-04-05", fechaFin: null, esTarea: true },
    { orden: 3, tipo: "paquete", producto: PRODUCTOS.bo01, descripcion: null, fechaInicio: null, fechaFin: null, esTarea: false },
  ],
  vuelos: [
    {
      numero: "LA8020",
      aerolinea: "LATAM",
      origen: "SCL",
      destino: "CJC",
      fechaSalida: "2026-04-02",
      horaSalida: "12:10",
      fechaLlegada: "2026-04-02",
      horaLlegada: "14:35",
    },
  ],
});

export const reservaRevision = detalle({
  id: IDS.revision,
  estado: "para_revision",
  dePrueba: true,
  motivos: [
    ME.faltaVuelo("in", { ciudad: "Puerto Iguazú", codigos: ["IGR"] }, "el traslado de OD019"),
    ME.noSeguro("Iguazu", { codigo: "OD010A", confianza: 0.62 }),
    "codigo_nuevo_sin_frase",
  ],
});

export const reservaSinProducto = detalle({
  id: IDS.sinProducto,
  estado: "para_revision",
  agencia: "TourRadar",
  producto: null,
  productoTextoAgencia: "Iguazu Falls on a Shoestring (3N)",
  motivos: [MI.posibleDuplicada],
  posibleDuplicada: true,
  duplicadaDeId: IDS.kilroy,
  mails: [
    mail({
      remitente: "explore@mail.tourradar.com",
      remitenteNombre: "TourRadar",
      asunto: "New booking 1377598",
      spam: true,
      pdfs: [{ nombre: "Booking 1377598.pdf", ruta: "bbbbbbbb-0000-4000-8000-000000000001/Booking 1377598.pdf" }],
    }),
  ],
});

export const reservaDosMails = detalle({
  id: IDS.dosMails,
  mails: [
    mail({ id: "bbbbbbbb-0000-4000-8000-000000000010", asunto: "NEW BOOKING DK1562336", cuerpo: "Primer mail de la reserva" }),
    mail({
      id: "bbbbbbbb-0000-4000-8000-000000000011",
      asunto: "NEW FLIGHT: DK1562336",
      fecha: "2026-10-14T09:05:00.000Z",
      cuerpo: "Segundo mail con los vuelos",
    }),
  ],
});

/** Una reserva que no se pudo leer: todo lo que falta. */
export const reservaVacia = detalle({
  id: IDS.vacia,
  estado: "para_revision",
  numero: null,
  producto: null,
  productoTextoAgencia: null,
  fechaInicio: null,
  fechaFin: null,
  pax: null,
  pasajeros: [],
  habitacion: null,
  pedidosEspeciales: null,
  motivos: [ME.lecturaFallida("la IA no respondió")],
  mails: [mail({ asunto: null, cuerpo: "", remitenteNombre: null, fecha: null })],
});

export const cuerpoPeligroso =
  'Hola <script>alert("x")</script>\n<img src="http://tracker.test/pixel.png">\n<a href="http://phishing.test">Confirmar</a>';
