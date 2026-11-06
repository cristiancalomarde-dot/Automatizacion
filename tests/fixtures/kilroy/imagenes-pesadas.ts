/**
 * M3-49: un mail de Kilroy como el de DK1595014 (2026-11-05): tres imágenes
 * pegadas en el cuerpo, una de 136.771 bytes bajo "Extra Requests" y dos fotos
 * de pasaporte de 3.386.877 y 3.707.515 bytes (juntas pasan los 5 MB).
 *
 * El texto y el HTML son los del mail real, con los nombres, mails, teléfonos,
 * fechas de nacimiento y la firma cambiados por inventados (#1), y el número
 * de reserva cambiado por uno de test. Las imágenes son falsas: un PNG con su
 * cabecera y relleno hasta el tamaño real. Se llaman todas "image.png" y
 * vienen en el orden en que las guardó la casilla (las pesadas primero).
 */
import type { AdjuntoEntrada } from "@/lib/reservas/tipos";

export const TAMANOS_KILROY_PESADO = { extra: 136_771, pasaporte1: 3_386_877, pasaporte2: 3_707_515 };

const CID = {
  extra: "fb2ae463-55cb-4e39-b4a8-178ea930e0d1",
  pasaporte1: "48684273-f020-4745-bf1c-71b78bcf94f6",
  pasaporte2: "aaecb0ad-17df-4f74-9d64-766b07b7fdea",
};

/** Un PNG de `ancho` × `alto` de exactamente `bytes` bytes (solo la cabecera importa). */
export function pngDeTamano(ancho: number, alto: number, bytes: number): Uint8Array {
  const b = new Uint8Array(bytes);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, ancho);
  new DataView(b.buffer).setUint32(20, alto);
  return b;
}

const ESTILO = "font-family: Aptos, Aptos_EmbeddedFont, Aptos_MSFontService, Calibri, Helvetica, sans-serif; font-size: 10pt; color: rgb(0, 0, 0);";
const div = (contenido: string, clase = true) => `<div${clase ? ' class="elementToProof"' : ""} style="${ESTILO}">\n${contenido}</div>`;
const img = (cid: string, bytes: number) => `<img style="max-width: 835px;" size="${bytes}" data-outlook-trace="F:1|T:1" src="cid:${cid}">`;

export function mailKilroyPesado(referencia: string): { cuerpoTexto: string; cuerpoHtml: string; adjuntos: AdjuntoEntrada[] } {
  const cuerpoTexto = `NEW BOOKING

Tour name: Iguazu Falls Combined (2 nights in Brazil + 1 night in Argentina)
Sub-name: 4 Days
Type: Double Room - Hostel
Inclusion: Arrival and departure transfers, 2 nights double room in hostel in Foz do Iguazu, 1 nights accommodation in hostel double room in Puerto Iguazu (including breakfast), full day Iguazu Falls tour (Argentinean side), half day Iguazu Falls tour (Brazilian side)
Duration: 4 days
Tour code: HI_ARGENTINA_OD010D-677
Start city: Iguassu Falls
Start date: 02 Apr 2027
End city: Puerto Iguazu
End date: 05 Apr 2027
KILROY Reference.:${referencia}/test

Extra Requests (transfers etc):

[cid:${CID.extra}]

Passenger 1 Information
Last name: Prueba
First name: Ana Ensayo
Nationality: Denmark
Gender: female
Date of birth: 03MAR04
Email address: ana.prueba@example.com
Phone number: +45 11111111
Passport:
[cid:${CID.pasaporte1}]


Passenger 2 Information
Last name: Muestra
First name: Lea Ficticia
Nationality: Denmark
Gender: female
Date of birth: 21JUL04
Email address: lea.muestra@example.com
Phone number: +45 22222222
Passport:

[cid:${CID.pasaporte2}]



This is a firm booking.
Please reply with your confirmation as soon as possible on copenhagen@kilroy.dk
Your reply mail should include this message.
Best regards,

Asesora De Prueba
Travel Advisor
+45 00 00 00 00
asesora@example.com
`;

  const cuerpoHtml = `<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
<style type="text/css" style="display:none;"> P {margin-top:0;margin-bottom:0;} </style>
</head>
<body dir="ltr">
${[
  div("NEW BOOKING"),
  div("<br>\n"),
  div("Tour name: Iguazu Falls Combined (2 nights in Brazil + 1 night in Argentina)"),
  div("Sub-name: 4 Days"),
  div("Type: Double Room - Hostel"),
  div(
    "Inclusion: Arrival and departure transfers, 2 nights double room in hostel in Foz do Iguazu, 1 nights accommodation in hostel double room in Puerto Iguazu (including breakfast), full day Iguazu Falls tour (Argentinean side), half day Iguazu Falls tour (Brazilian\n side)",
  ),
  div("Duration: 4 days"),
  div("Tour code: HI_ARGENTINA_OD010D-677"),
  div("Start city: Iguassu Falls"),
  div("Start date: 02 Apr 2027"),
  div("End city: Puerto Iguazu"),
  div("End date: 05 Apr 2027"),
  div(`KILROY Reference.:${referencia}/test`),
  div("<br>\n"),
  div("Extra Requests (transfers etc):"),
  div("<br>\n"),
  div(img(CID.extra, TAMANOS_KILROY_PESADO.extra)),
  div("<br>\n"),
  div("Passenger 1 Information"),
  div("Last name: Prueba"),
  div("First name: Ana Ensayo"),
  div("Nationality: Denmark"),
  div("Gender: female"),
  div("Date of birth: 03MAR04"),
  div("Email address: ana.prueba@example.com"),
  div("Phone number: +45 11111111"),
  div("Passport:"),
  div(img(CID.pasaporte1, TAMANOS_KILROY_PESADO.pasaporte1)),
  div("<br>\n"),
  div("&nbsp;"),
  div("Passenger 2 Information"),
  div("Last name: Muestra"),
  div("First name: Lea Ficticia"),
  div("Nationality: Denmark"),
  div("Gender: female"),
  div("Date of birth: 21JUL04"),
  div("Email address: lea.muestra@example.com"),
  div("Phone number: +45 22222222"),
  div("Passport:"),
  div("<br>\n"),
  div(img(CID.pasaporte2, TAMANOS_KILROY_PESADO.pasaporte2)),
  div("<br>\n"),
  div("&nbsp;"),
  div("<br>\n"),
  div("This is a firm booking."),
  div("Please reply with your confirmation as soon as possible on copenhagen@kilroy.dk"),
  div("Your reply mail should include this message.", false),
].join("\n")}
<span style="font-family:arial;font-size:10pt;">Best regards,</span><br>
<br>
<table cellspacing="1" cellpadding="1" border="0" width="500" style="width:500px;">
<tbody>
<tr>
<td width="150" style="width:150px;padding:0px;" valign="top" colspan="1" rowspan="7"><img src="https://signaturepictures.blob.core.windows.net/signature-pictures/staff/prueba.jpg" border="0" alt="picture"></td>
<td width="350" height="6" valign="top" style="width: 350px;height:6px;padding:0px;" rowspan="1" colspan="1"></td>
</tr>
<tr><td width="350" height="20" valign="top" style="width: 350px;height:20px;font-family:arial;font-size:12pt;font-weight:bold;padding:0px;" rowspan="1" colspan="1">Asesora De Prueba</td></tr>
<tr><td width="350" height="23" valign="top" colspan="1" style="width: 350px;height:23px;font-family:arial;font-size:10pt;padding:0px;">Travel Advisor</td></tr>
<tr><td width="350" height="18" valign="top" colspan="1" style="width: 350px;height:18px;font-family:arial;font-size:8pt;padding:0px;color: #666666;"><img src="https://signaturepictures.blob.core.windows.net/signature-pictures/icons/phone.png" alt="Phone"> | <a href="tel:+45 00 00 00 00" style="color:#666666;text-decoration:none;">+45 00 00 00 00</a></td></tr>
<tr><td width="350" height="18" valign="top" colspan="1" style="width: 350px;height:18px;font-family:arial;font-size:8pt;padding:0px;color: #666666;"><img src="https://signaturepictures.blob.core.windows.net/signature-pictures/icons/email.png" alt="Email"> | <a href="mailto:asesora@example.com" style="color:#666666;text-decoration:none;">asesora@example.com</a></td></tr>
<tr><td width="500" valign="top" colspan="3" style="width:500px;font-family:arial;font-size:10pt;"><div style="height:3px;"></div></td></tr>
</tbody></table>
<table cellspacing="1" cellpadding="1" border="0" width="500" style="width:500px;margin-top:4px;">
<tbody>
<tr><td valign="top" colspan="1" style="font-family:arial;font-size:10pt;color:#000000;"><p><a href="https://www.facebook.com/kilroydenmark"><img src="https://signaturepictures.blob.core.windows.net/signature-pictures/img/fb-kilroy_5466ef07.png" border="0" alt="Facebook"></a><br></p></td><td valign="top" rowspan="1" colspan="1" style="font-family:arial;font-size:10pt;color:#000000;text-align:right;"><p><img src="https://signaturepictures.blob.core.windows.net/signature-pictures/logos/kilroy-o_d6250312.png" border="0" alt="KILROY"><br></p></td></tr>
</tbody></table></body>
</html>
`;

  // En el orden de la casilla: las dos pesadas primero.
  const adjuntos: AdjuntoEntrada[] = [
    { nombre: "image.png", tipo: "image/png", contenido: pngDeTamano(2480, 3508, TAMANOS_KILROY_PESADO.pasaporte1), cid: CID.pasaporte1 },
    { nombre: "image.png", tipo: "image/png", contenido: pngDeTamano(2480, 3508, TAMANOS_KILROY_PESADO.pasaporte2), cid: CID.pasaporte2 },
    { nombre: "image.png", tipo: "image/png", contenido: pngDeTamano(835, 300, TAMANOS_KILROY_PESADO.extra), cid: CID.extra },
  ];
  return { cuerpoTexto, cuerpoHtml, adjuntos };
}
