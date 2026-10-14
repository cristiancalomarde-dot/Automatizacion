import { describe, expect, it } from "vitest";
import { fichaGrabada, mailDePrueba } from "./__fixtures__/cargar";
import type { FichaIA } from "./esquema-ficha";
import { fechaApareceEnTexto, limpiarFicha, normalizarFecha, numeroLimpio, UMBRAL_CONFIANZA } from "./limpiar-ficha";

// Spec M2-02 filas 14, 19, 21 y 27 (controles del código, no solo la confianza de la IA).

function contexto(nombreMail: string, extra: Partial<Parameters<typeof limpiarFicha>[1]> = {}) {
  const mail = mailDePrueba(nombreMail);
  return {
    agencia: "Kilroy",
    textoVerificable: `${mail.asunto ?? ""}\n${mail.cuerpoTexto ?? ""}`,
    seMandoPdf: false,
    adjuntosNoLeidos: [],
    ...extra,
  };
}

const ficha = (nombre: string) => fichaGrabada(nombre) as unknown as FichaIA;

describe("normalizarFecha — un solo formato (fila 14)", () => {
  it("los cinco formatos de los mails dan año-mes-día", () => {
    expect(normalizarFecha("06 Sep 2026")).toBe("2026-09-06");
    expect(normalizarFecha("01SEP26")).toBe("2026-09-01");
    expect(normalizarFecha("06.10.26")).toBe("2026-10-06");
    expect(normalizarFecha("14.06.2027")).toBe("2027-06-14");
    expect(normalizarFecha("30DEC03")).toBe("2003-12-30");
    expect(normalizarFecha("2026-10-07")).toBe("2026-10-07");
  });

  it("un año de dos cifras lejano en el futuro es del siglo pasado (nacimientos)", () => {
    expect(normalizarFecha("15MAR77")).toBe("1977-03-15");
  });

  it("una fecha que no existe o no se entiende queda vacía", () => {
    expect(normalizarFecha("31.02.2027")).toBeNull();
    expect(normalizarFecha("2027-02-31")).toBeNull();
    expect(normalizarFecha("mañana")).toBeNull();
    expect(normalizarFecha(null)).toBeNull();
  });
});

describe("numeroLimpio — número de reserva", () => {
  it("Kilroy y Jysk: país + dígitos, sin la sigla del vendedor", () => {
    expect(numeroLimpio("DK1564627/cafj", "Kilroy")).toBe("DK1564627");
    expect(numeroLimpio("DK1576836-26196085", "Kilroy")).toBe("DK1576836");
    expect(numeroLimpio("UK1586142/fagu", "Kilroy")).toBe("UK1586142");
    expect(numeroLimpio("DK1234567/abcd", "Jysk")).toBe("DK1234567");
  });
  it("TourRadar y Journaway: el número tal cual, sin espacios", () => {
    expect(numeroLimpio(" 1376833 ", "TourRadar")).toBe("1376833");
    expect(numeroLimpio(null, "Journaway")).toBeNull();
  });
});

describe("fechaApareceEnTexto", () => {
  it("encuentra la fecha escrita en cualquiera de los formatos de los mails", () => {
    expect(fechaApareceEnTexto("2026-09-06", "Start date: 06 Sep 2026")).toBe(true);
    expect(fechaApareceEnTexto("2026-09-01", "Arrival date: 01SEP26")).toBe(true);
    expect(fechaApareceEnTexto("2026-10-06", "Dates: 06.10.26 - 27.10.26")).toBe(true);
    expect(fechaApareceEnTexto("2027-06-14", "Date: 14.06.2027")).toBe(true);
  });
  it("no confunde una fecha con otra que la contiene", () => {
    expect(fechaApareceEnTexto("2026-10-06", "Date: 16.10.2026")).toBe(false);
    expect(fechaApareceEnTexto("2026-09-07", "Start date: 06 Sep 2026")).toBe(false);
  });
});

describe("limpiarFicha", () => {
  it("Kilroy OD010D: número limpio, fechas y nacimientos en ISO, sin dudosos (fila 6)", () => {
    const f = limpiarFicha(ficha("kilroy-od010d"), contexto("kilroy-od010d"));
    expect(f.agencia).toEqual({ valor: "Kilroy", confianza: 1 });
    expect(f.numero_reserva).toEqual({ valor: "DK1564627/cafj", limpio: "DK1564627", confianza: 1 });
    expect(f.productos[0]).toMatchObject({ codigo: "HI_ARGENTINA_OD010D-677", fecha_inicio: "2026-09-06", fecha_fin: "2026-09-09" });
    expect(f.pasajeros[0].fecha_nacimiento).toBe("2003-12-30");
    expect(f.datos_dudosos).toEqual([]);
  });

  it("Rio Starter: número original con guion, limpio sin la orden (fila 8)", () => {
    const f = limpiarFicha(ficha("kilroy-rio-starter"), contexto("kilroy-rio-starter"));
    expect(f.numero_reserva.valor).toBe("DK1576836-26196085");
    expect(f.numero_reserva.limpio).toBe("DK1576836");
    expect(f.productos[0]).toMatchObject({ fecha_inicio: "2026-09-01", fecha_fin: "2026-09-04", noches: 3 });
    expect(f.datos_dudosos).toEqual([]);
  });

  it("una fecha imposible que devuelve la IA queda vacía con confianza 0 y es dudosa (fila 14)", () => {
    const x = ficha("kilroy-od010d");
    x.fecha_fin = { valor: "31.02.2027", confianza: 0.99 };
    const f = limpiarFicha(x, contexto("kilroy-od010d"));
    expect(f.fecha_fin).toEqual({ valor: null, confianza: 0 });
    expect(f.datos_dudosos).toContain("fechas");
  });

  it("número de reserva que no aparece en el mail → vacío, confianza 0 y nota (fila 19)", () => {
    const x = ficha("kilroy-od010d");
    x.numero_reserva = { valor: "DK9999999", confianza: 0.99 };
    const f = limpiarFicha(x, contexto("kilroy-od010d"));
    expect(f.numero_reserva).toEqual({ valor: null, limpio: null, confianza: 0 });
    expect(f.notas.join(" ")).toMatch(/no aparece en el mail/);
    expect(f.datos_dudosos).toContain("numero_reserva");
  });

  it("vuelo inventado → número vacío, confianza 0 y nota (fila 19)", () => {
    const x = ficha("journaway-spap05");
    x.vuelos[0] = { ...x.vuelos[0], numero: "LA9999" };
    const f = limpiarFicha(x, contexto("journaway-spap05", { agencia: "Journaway" }));
    expect(f.vuelos[0]).toMatchObject({ numero: null, confianza: 0 });
    expect(f.notas.join(" ")).toMatch(/LA9999.*no aparece en el mail/);
    expect(f.datos_dudosos).toContain("vuelos");
  });

  it("con un PDF, lo que no está en el cuerpo no se puede chequear: queda la confianza de la IA", () => {
    const f = limpiarFicha(ficha("tourradar-1376833"), {
      agencia: "TourRadar",
      textoVerificable: "Booking Statement",
      seMandoPdf: true,
      adjuntosNoLeidos: [],
    });
    expect(f.numero_reserva).toEqual({ valor: "1376833", limpio: "1376833", confianza: 1 });
    expect(f.productos[0].fecha_fin).toBeNull();
    expect(f.vuelos).toEqual([]);
    expect(f.datos_dudosos).toEqual([]);
  });

  it("fechas con confianza 0,5 → 'fechas' en la lista de dudosos (fila 21)", () => {
    const x = ficha("kilroy-od010d");
    x.fecha_inicio = { valor: "2026-09-06", confianza: 0.5 };
    expect(UMBRAL_CONFIANZA).toBe(0.8);
    expect(limpiarFicha(x, contexto("kilroy-od010d")).datos_dudosos).toEqual(["fechas"]);
  });

  it("fecha que no está escrita en el mail → dudosa aunque la IA diga 0,99 (fila 27)", () => {
    const x = ficha("kilroy-od010d");
    x.productos[0] = { ...x.productos[0], fecha_inicio: "2026-09-07", confianza: 0.99 };
    const f = limpiarFicha(x, contexto("kilroy-od010d"));
    expect(f.datos_dudosos).toContain("fechas");
    expect(f.notas.join(" ")).toMatch(/2026-09-07/);
  });

  it("pax 3 con 2 nombres → pax dudoso (fila 27)", () => {
    const x = ficha("kilroy-od010d");
    x.pax = { valor: 3, confianza: 0.99 };
    expect(limpiarFicha(x, contexto("kilroy-od010d")).datos_dudosos).toContain("pax");
  });

  it("las noches de un producto no coinciden con sus fechas → fechas dudosas (fila 27)", () => {
    const x = ficha("kilroy-rio-starter");
    x.productos[0] = { ...x.productos[0], noches: 4 };
    expect(limpiarFicha(x, contexto("kilroy-rio-starter")).datos_dudosos).toContain("fechas");
  });

  it("un pasajero de hitravel.com.ar se saca de la lista (fila 13)", () => {
    const x = ficha("journaway-iguazu-arg");
    x.pasajeros.push({ nombre: "operaciones3@hitravel.com.ar", apellido: "", nacionalidad: null, fecha_nacimiento: null, confianza: 0.6 });
    const f = limpiarFicha(x, contexto("journaway-iguazu-arg", { agencia: "Journaway" }));
    expect(f.pasajeros).toHaveLength(2);
    expect(JSON.stringify(f.pasajeros)).not.toMatch(/hitravel/);
    expect(f.datos_dudosos).toContain("pasajeros");
  });

  it("la agencia es la del remitente; si la IA dice otra, queda dudosa", () => {
    const x = ficha("kilroy-od010d");
    x.agencia = { valor: "TourRadar", confianza: 1 };
    const f = limpiarFicha(x, contexto("kilroy-od010d"));
    expect(f.agencia.valor).toBe("Kilroy");
    expect(f.datos_dudosos).toContain("agencia");
  });
});

describe("pax contra la lista: TourRadar nombra solo al pasajero principal (owner, 2026-10-13)", () => {
  const pasajero = (n: number) => ({ nombre: `P${n}`, apellido: "Prueba", nacionalidad: null, fecha_nacimiento: null, confianza: 1 });
  const conPax = (agencia: string, pax: number, nombres: number) => {
    const x = ficha(agencia === "TourRadar" ? "tourradar-1376833" : "kilroy-od010d");
    x.pax = { valor: pax, confianza: 1 };
    x.pasajeros = Array.from({ length: nombres }, (_, i) => pasajero(i + 1));
    return limpiarFicha(x, { agencia, textoVerificable: "", seMandoPdf: true, adjuntosNoLeidos: [] }).datos_dudosos;
  };

  it("TourRadar con 1 nombre y pax 2 → pax no es dudoso", () => {
    expect(conPax("TourRadar", 2, 1)).not.toContain("pax");
  });
  it("Kilroy con 1 nombre y pax 2 → pax dudoso", () => {
    expect(conPax("Kilroy", 2, 1)).toContain("pax");
  });
  it("TourRadar con 3 nombres y pax 2 → pax dudoso", () => {
    expect(conPax("TourRadar", 2, 3)).toContain("pax");
  });
});

describe("número de reserva de Journaway: el ID del asunto (owner, 2026-10-13)", () => {
  const ASUNTO = "de-DE Activity Booking / Client Inventado / ID 65699999999";
  const CUERPO = "Dear Team,\nplease book as follows\nTour: Tour inventado\nDate: 14.06.2027\nPax: 2";
  const fichaJournaway = (numero: string) => {
    const x = ficha("journaway-iguazu-arg");
    x.numero_reserva = { valor: numero, confianza: 1 };
    x.productos = [];
    x.pasajeros = [];
    x.fecha_inicio = { valor: null, confianza: 0 };
    return x;
  };
  const ctx = (asunto: string) => ({
    agencia: "Journaway",
    textoVerificable: `${asunto}\n${CUERPO}`,
    seMandoPdf: false,
    adjuntosNoLeidos: [],
  });

  it("número limpio = el ID de 11 dígitos; el Trip Number queda solo en el original", () => {
    expect(numeroLimpio("ID 65643802533 · Trip 62992", "Journaway")).toBe("65643802533");
    expect(numeroLimpio("ID 65676257628", "Journaway")).toBe("65676257628");
    expect(numeroLimpio("65676257628", "Journaway")).toBe("65676257628");
    expect(numeroLimpio("Trip 62992", "Journaway")).toBeNull();
  });

  it("un número que está solo en el asunto no se descarta", () => {
    const f = limpiarFicha(fichaJournaway("ID 65699999999"), ctx(ASUNTO));
    expect(f.numero_reserva).toEqual({ valor: "ID 65699999999", limpio: "65699999999", confianza: 1 });
    expect(f.datos_dudosos).not.toContain("numero_reserva");
  });

  it("con el Trip Number del cuerpo como referencia, también vale", () => {
    const f = limpiarFicha(fichaJournaway("ID 65699999999 · Trip 62992"), {
      ...ctx(ASUNTO),
      textoVerificable: `${ASUNTO}\n${CUERPO}\nTrip Number: 62992`,
    });
    expect(f.numero_reserva.limpio).toBe("65699999999");
  });

  it("un número que no está ni en el asunto ni en el cuerpo se descarta", () => {
    const f = limpiarFicha(fichaJournaway("ID 65611111111"), ctx(ASUNTO));
    expect(f.numero_reserva).toEqual({ valor: null, limpio: null, confianza: 0 });
    expect(f.datos_dudosos).toContain("numero_reserva");
    const g = limpiarFicha(fichaJournaway("ID 65699999999 · Trip 99999"), ctx(ASUNTO));
    expect(g.numero_reserva.valor).toBeNull();
  });
});
