/**
 * Lo que el código lee del cuerpo de un mail de Journaway, sin IA (spec M2-09
 * filas 9, 12, 13 y 14). Journaway escribe siempre con las mismas etiquetas:
 *
 * - "Trip Number: 62992" (solo los "Program Booking"): el número de viaje.
 * - "Client reference:": el contacto del pasajero principal (nombre, mail,
 *   teléfono). Si trae una dirección de HI Travel (operaciones3@…), se ignora.
 * - "Anrede: mr/mrs" antes de "Vorname" y "Nachname": Sr./Sra.
 * - "Attached you can find a copy of the travellers passports": trae pasaportes.
 * - "Rooms: 1 DBL" (M3-30, mail Petzold): las habitaciones, tal cual.
 *
 * No guarda nada ni escribe en la consola.
 */

export interface ContactoCliente {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
}

export type Tratamiento = "Sr." | "Sra.";

export interface DatosDelCuerpo {
  tripNumber: string | null;
  contacto: ContactoCliente | null;
  tratamientos: Array<{ nombre: string; apellido: string; tratamiento: Tratamiento | null }>;
  pasaportes: boolean;
  habitacion: string | null;
}

const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;
const TELEFONO = /^\+?[\d\s()/.-]{6,}$/;
const SALUDO = /^(mr|mrs|ms|miss|herr|frau|sr|sra)\.?$/i;
const SALUDO_ADELANTE = /^(mr|mrs|ms|miss|herr|frau|sr|sra)\.?\s+/i;
/** Lo que corta el bloque "Client reference": otra etiqueta conocida. */
const FIN_BLOQUE = /^(travellers|reisender|anrede|vorname|let us know|kind regards|thank|attached)\b/i;

function tratamientoDe(anrede: string): Tratamiento | null {
  const a = anrede.trim().toLowerCase().replace(/\.$/, "");
  if (["mr", "herr", "sr"].includes(a)) return "Sr.";
  if (["mrs", "ms", "miss", "frau", "sra"].includes(a)) return "Sra.";
  return null;
}

function contactoDe(lineas: string[]): ContactoCliente | null {
  let nombre: string | null = null;
  let email: string | null = null;
  let telefono: string | null = null;
  for (const linea of lineas) {
    if (!linea || SALUDO.test(linea)) continue;
    const mail = MAIL.exec(linea);
    if (mail) {
      // HI Travel nunca es el cliente (fila 13).
      if (!/@hitravel\./i.test(mail[0]) && !email) email = mail[0].toLowerCase();
      continue;
    }
    if (TELEFONO.test(linea)) {
      telefono ??= linea.replace(/\s+/g, " ").trim();
      continue;
    }
    nombre ??= linea.replace(SALUDO_ADELANTE, "").trim() || null;
  }
  return nombre || email || telefono ? { nombre, email, telefono } : null;
}

export function leerCuerpoJournaway(texto: string): DatosDelCuerpo {
  const lineas = texto.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/ /g, " ").trim());

  const trip = /^trip\s*number\s*:\s*(\d+)/i;
  const tripNumber = lineas.map((l) => trip.exec(l)?.[1]).find(Boolean) ?? null;

  let contacto: ContactoCliente | null = null;
  const inicio = lineas.findIndex((l) => /^client\s+reference\s*:?\s*$/i.test(l) || /^client\s+reference\s*:/i.test(l));
  if (inicio >= 0) {
    const enLaMisma = lineas[inicio].replace(/^client\s+reference\s*:?\s*/i, "");
    const bloque: string[] = enLaMisma ? [enLaMisma] : [];
    for (const l of lineas.slice(inicio + 1)) {
      if (FIN_BLOQUE.test(l)) break;
      bloque.push(l);
    }
    contacto = contactoDe(bloque);
  }

  const tratamientos: DatosDelCuerpo["tratamientos"] = [];
  let anrede: string | null = null;
  let vorname: string | null = null;
  for (const l of lineas) {
    const campo = /^(anrede|vorname|nachname)\s*:\s*(.*)$/i.exec(l);
    if (!campo) continue;
    const [, etiqueta, valor] = campo;
    const e = etiqueta.toLowerCase();
    if (e === "anrede") {
      anrede = valor;
      vorname = null;
    } else if (e === "vorname") vorname = valor.trim();
    else {
      tratamientos.push({ nombre: vorname ?? "", apellido: valor.trim(), tratamiento: anrede ? tratamientoDe(anrede) : null });
      anrede = null;
      vorname = null;
    }
  }

  const pasaportes = /cop(y|ies) of the (travel+ers'?|passengers'?) passports?|reisepass/i.test(texto);
  const rooms = lineas.map((l) => /^(?:rooms?|zimmer)\s*:\s*(.+)$/i.exec(l)?.[1]?.trim()).find(Boolean);
  const suelta = /\b\d+\s*x?\s*(?:DBL|TWN|SGL|TPL)\b/.exec(texto)?.[0];
  const habitacion = rooms ?? suelta?.replace(/\s+/g, " ") ?? null;
  return { tripNumber, contacto, tratamientos, pasaportes, habitacion };
}
