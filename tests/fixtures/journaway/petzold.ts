import { readFileSync } from "node:fs";
import { join } from "node:path";
import MailComposer from "nodemailer/lib/mail-composer";
import type { FichaIA, ProductoIA } from "@/lib/reservas/esquema-ficha";

/**
 * El mail "Program Booking / Client Petzold / ID 66688059968" (spec M3-30), la
 * primera reserva real de Journaway con los hoteles y las actividades como
 * IMÁGENES pegadas en el cuerpo (`cid:`). Anonimizado: el cliente y los
 * pasajeros son inventados; la estructura es la del mail real (sales@ uid
 * 16682): el texto, la imagen 1 bajo "hotels and night bus", las imágenes 2 y 3
 * bajo "activities", y los íconos de la firma por http (no se mandan). Las 3
 * imágenes son las reales (solo servicios, sin datos personales).
 *
 * `fichaIAPetzold` es lo que devuelve la IA al leer el mail con sus imágenes
 * (la forma exacta de `FichaIA`): nunca se llama a la IA en los tests (#4).
 */

const DIR = join(__dirname, "petzold-imagenes");

export const ID_PETZOLD = "66688059968";
export const ASUNTO_PETZOLD = `Program Booking / Client Beispiel/ ID ${ID_PETZOLD}`;
export const REMITENTE_PETZOLD = "Reservas Ejemplo von journaway GmbH <operations@journaway.com>";

export const IMAGENES_PETZOLD = [
  { archivo: "img1.png", cid: "image001.png@01DC4807.6B0C2D50" },
  { archivo: "img2.png", cid: "image002.png@01DC4807.6B0C2D50" },
  { archivo: "img3.png", cid: "image003.png@01DC4807.6B0C2D50" },
] as const;

export const imagenPetzold = (archivo: string) => new Uint8Array(readFileSync(join(DIR, archivo)));

const celda = (t: string) => `<td style="border:1px solid #ccc;padding:4px">${t}</td>`;
const fila = (...c: string[]) => `<tr>${c.map(celda).join("")}</tr>`;

/** El cuerpo HTML, con las imágenes donde estaban y la firma con íconos por http. */
export function htmlPetzold(): string {
  const [i1, i2, i3] = IMAGENES_PETZOLD;
  return `<html><head><style>p{margin:0}</style></head><body>
<p>Dear Partner,</p>
<p>please book as follows and as per agreed rates and cancellation conditions:</p>
<p><b>Booking information:</b><br>Trip Number: 65037<br>Dates: 17.05.27 - 07.06.27<br>Pax: 2<br>Rooms: 1 DBL</p>
<p>&nbsp;</p>
<p>-Please book the following hotels and night bus:</p>
<table>${fila("Night Bus Peru", "Agency: Double Seat nomeal", "31.05.2027", "01.06.2027")}</table>
<p><img width="455" height="292" src="cid:${i1.cid}" alt="image001.png"></p>
<p>FOC till 4 weeks prior arrival</p>
<p>&nbsp;</p>
<p>-Please book the following activities:</p>
<table>
${fila("Hi Travel Argentina Transfers Chile", "Shared Transport: CJC - Accom. San Pedro de Atacama", "22.05.2027", "22.05.2027")}
${fila("Hi Travel Argentina Transfers Chile", "Shared Transport: CJC - Accom. San Pedro de Atacama", "22.05.2027", "22.05.2027")}
</table>
<p><img width="456" height="867" src="cid:${i2.cid}" alt="image002.png"></p>
<p><img width="447" height="123" src="cid:${i3.cid}" alt="image003.png"></p>
<p>&nbsp;</p>
<p><b>Client reference:</b><br>Mr<br>Hans Beispiel<br>hans.beispiel@example.de<br>+49 151 0000007</p>
<p><b>Travellers:</b><br>Anrede: mr<br>Vorname: Hans<br>Nachname: Beispiel<br>Nationality: Deutschland<br>Geburtsdatum: 03.04.1961</p>
<p>Anrede: mrs<br>Vorname: Greta<br>Nachname: Muster<br>Nationality: Deutschland<br>Geburtsdatum: 20.02.1963</p>
<p>Let us know if you can confirm this booking and make sure to leave us the pick up times and vouchers for our clients.<br>Thanks in advance.</p>
<p>Kind regards,</p>
<table><tr>
<td><img src="https://cdn2.hubspot.net/hub/0000000/hubfs/avatar-ejemplo.png" width="80" height="80" alt="avatar"></td>
<td>Reservas Ejemplo<br>journaway - discover yourself<br>
<img src="https://cdn2.hubspot.net/hub/0000000/hubfs/phone_icon.png" width="12" height="12"> +49 30 0000000<br>
<img src="https://cdn2.hubspot.net/hub/0000000/hubfs/mail_icon.png" width="12" height="12"> operations@journaway.com</td>
</tr></table>
<img src="https://track.hubspot.com/__ptq.gif?a=0000000&amp;k=14" width="1" height="1" alt="">
</body></html>`;
}

/** La parte de texto del mail (como la arma el programa de Journaway): sin las imágenes. */
export function textoPlanoPetzold(): string {
  return [
    "Dear Partner,",
    "please book as follows and as per agreed rates and cancellation conditions:",
    "Booking information:",
    "Trip Number: 65037",
    "Dates: 17.05.27 - 07.06.27",
    "Pax: 2",
    "Rooms: 1 DBL",
    "",
    "-Please book the following hotels and night bus:",
    "Night Bus Peru Agency: Double Seat nomeal 31.05.2027 01.06.2027",
    "FOC till 4 weeks prior arrival",
    "",
    "-Please book the following activities:",
    "Hi Travel Argentina Transfers Chile Shared Transport: CJC - Accom. San Pedro de Atacama 22.05.2027 22.05.2027",
    "Hi Travel Argentina Transfers Chile Shared Transport: CJC - Accom. San Pedro de Atacama 22.05.2027 22.05.2027",
    "",
    "Client reference:",
    "Mr",
    "Hans Beispiel",
    "hans.beispiel@example.de",
    "+49 151 0000007",
    "Travellers:",
    "Anrede: mr",
    "Vorname: Hans",
    "Nachname: Beispiel",
    "Nationality: Deutschland",
    "Geburtsdatum: 03.04.1961",
    "",
    "Anrede: mrs",
    "Vorname: Greta",
    "Nachname: Muster",
    "Nationality: Deutschland",
    "Geburtsdatum: 20.02.1963",
    "",
    "Let us know if you can confirm this booking and make sure to leave us the pick up times and vouchers for our clients.",
    "Kind regards,",
    "Reservas Ejemplo",
  ].join("\n");
}

/** El .eml completo (multipart/related con las 3 imágenes `cid:`), como lo baja la casilla. */
export async function emlPetzold(opciones: { messageId?: string; fecha?: Date } = {}): Promise<Buffer> {
  const composer = new MailComposer({
    from: REMITENTE_PETZOLD,
    to: "sales@hitravel.com.ar",
    subject: ASUNTO_PETZOLD,
    date: opciones.fecha ?? new Date("2026-10-28T11:34:00Z"),
    messageId: opciones.messageId ?? "<petzold-ejemplo@journaway.test>",
    text: textoPlanoPetzold(),
    html: htmlPetzold(),
    attachments: IMAGENES_PETZOLD.map((i) => ({
      filename: i.cid.split("@")[0],
      content: Buffer.from(imagenPetzold(i.archivo)),
      contentType: "image/png",
      cid: i.cid,
    })),
  });
  return composer.compile().build();
}

// --- La ficha que devuelve la IA ------------------------------------------------------------

function renglon(nombre: string, desde: string, hasta: string, habitacion: string | null = null): ProductoIA {
  return {
    nombre,
    codigo: null,
    fecha_inicio: desde,
    fecha_fin: hasta,
    noches: null,
    habitacion,
    punto_recogida: null,
    opcionales: [],
    confianza: 1,
  };
}

export const ACTIVIDADES_PETZOLD = {
  astronomie: "San Pedro de Atacama: Astronomie-Tour in der Atacama-Wüste",
  mondtal: "San Pedro de Atacama: Tour durch das Mondtal",
  quepiaco: "San Pedro de Atacama: Tour zum Fluss Quepiaco, Monjes de la Pacana & den Salzwüsten",
  tatio: "San Pedro de Atacama: Tour zu den Tatio-Geysiren",
  dia1: "Ab San Pedro: Sol de Mañana Geysire, Licancabur Vulkan & Laguna Colorada",
  dia2: "Siloli: Ganztägige Tour in die Siloli Wüste & zur schwarzen Lagune",
  dia3: "Salar de Uyuni: Ganztägige Tour nach Uyuni",
} as const;

const A = ACTIVIDADES_PETZOLD;
const persona = (nombre: string, apellido: string, nacimiento: string) => ({
  nombre,
  apellido,
  nacionalidad: "Deutschland",
  fecha_nacimiento: nacimiento,
  confianza: 1,
});

/** Lo que lee la IA del texto y de las 3 imágenes: una fila por pax en las actividades de San Pedro. */
export function fichaIAPetzold(): FichaIA {
  const c = <T>(valor: T, confianza = 1) => ({ valor, confianza });
  const dosVeces = (nombre: string, fecha: string) => [renglon(nombre, fecha, fecha), renglon(nombre, fecha, fecha)];
  return {
    tipo_mail: c("reserva_nueva" as const),
    agencia: c("Journaway"),
    numero_reserva: c<string | null>(`ID ${ID_PETZOLD} · Trip 65037`),
    titulo_paquete: c<string | null>(null, 0),
    fecha_inicio: c<string | null>("2027-05-17"),
    fecha_fin: c<string | null>("2027-06-07"),
    pax: c<number | null>(2),
    productos: [
      renglon("Night Bus Peru", "2027-05-31", "2027-06-01", "Double Seat nomeal"),
      renglon("Tayka del Desierto Hotel", "2027-05-26", "2027-05-27", "Standard Room fullboard DR"),
      renglon("Tayka del Sal Hotel", "2027-05-27", "2027-05-28", "Standard Room fullboard DR"),
      renglon("Night Bus Uyuni – La Paz", "2027-05-28", "2027-05-29", "Private Cabin nomeal DR"),
      ...dosVeces("Shared Transport: CJC - Accom. San Pedro de Atacama", "2027-05-22"),
      ...dosVeces(A.astronomie, "2027-05-22"),
      ...dosVeces(A.mondtal, "2027-05-23"),
      ...dosVeces(A.quepiaco, "2027-05-24"),
      ...dosVeces(A.tatio, "2027-05-25"),
      renglon(A.dia1, "2027-05-26", "2027-05-26"),
      renglon(A.dia2, "2027-05-27", "2027-05-27"),
      renglon(A.dia3, "2027-05-28", "2027-05-28"),
    ],
    pasajeros: [persona("Hans", "Beispiel", "1961-04-03"), persona("Greta", "Muster", "1963-02-20")],
    vuelos: [],
    hoteles_agencia: [],
    todos_hoteles_agencia: c(false),
    pedidos_especiales: [],
    pdf_ilegible: false,
    aviso: null,
  };
}
