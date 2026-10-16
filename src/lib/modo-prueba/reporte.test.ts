import { describe, expect, it } from "vitest";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { armarReporteMail, nombreDelReporte, nombreVisible, sinDatosPersonales, type ResultadoParaReporte } from "./reporte";

// Spec M2-06 filas 11 y 12: un reporte por mail, en llano, sin datos personales
// (de los pasajeros, solo la cantidad y el apellido). Datos inventados.

function ficha(): FichaLectura {
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "Kilroy", confianza: 1 },
    numero_reserva: { valor: "DK0000042/abcd", limpio: "DK0000042", confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [
      {
        nombre: "Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days",
        codigo: "HI_ARGENTINA_OVERLAND_7DAYS-677",
        fecha_inicio: "2027-01-18",
        fecha_fin: "2027-01-24",
        noches: 6,
        habitacion: "Double Room - Hostel",
        punto_recogida: null,
        opcionales: [],
        confianza: 1,
      },
    ],
    fecha_inicio: { valor: "2027-01-18", confianza: 1 },
    fecha_fin: { valor: "2027-01-24", confianza: 1 },
    pax: { valor: 2, confianza: 1 },
    pasajeros: [
      { nombre: "Pepe", apellido: "Inventado", nacionalidad: "Denmark", fecha_nacimiento: "1999-01-01", confianza: 1 },
      { nombre: "Lola", apellido: "Ficticia", nacionalidad: "Denmark", fecha_nacimiento: "2000-02-02", confianza: 1 },
    ],
    vuelos: [],
    hoteles_agencia: [],
    todos_hoteles_agencia: { valor: false, confianza: 0 },
    pedidos_especiales: [
      { texto: "Llamar a pepe.inventado@example.com o al +45 12 34 56 78 por el traslado; nacido 01JAN99; pasaporte AB1234567", confianza: 0.9 },
    ],
    aviso: null,
    adjuntos_no_leidos: [],
    datos_dudosos: [],
    notas: [],
    version_instrucciones: "lectura-mail.v2",
    modelo: "modelo-de-prueba",
  };
}

function resultado(c: Partial<ResultadoParaReporte> = {}): ResultadoParaReporte {
  return {
    archivo: "kilroy-inventado.eml",
    estado: "procesado",
    agencia: "Kilroy",
    lectura: { estado: "leido", ficha: ficha() },
    costo: 0.0234,
    reservas: [
      {
        accion: "nueva",
        bookingId: "DK0000042",
        bookingIdOriginal: "DK0000042/abcd",
        productoTexto: "Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days (HI_ARGENTINA_OVERLAND_7DAYS-677)",
        producto: { codigo: "CHB31", nombre: "Overland San Pedro de Atacama to Uyuni, end in La Paz" },
        origenEmparejado: "codigo",
        confianzaEmparejado: 1,
        sugerencia: null,
        fechaInicio: "2027-01-18",
        fechaFin: "2027-01-24",
        pax: 2,
        estado: "para_revision",
        motivos: ["Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030"],
        partes: 4,
      },
    ],
    ...c,
  };
}

describe("armarReporteMail", () => {
  it("dice qué entendió, con qué producto lo emparejó y por qué, y en qué estado quedó", () => {
    const md = armarReporteMail(resultado());
    expect(md).toContain("# kilroy-inventado.eml");
    expect(md).toContain("Kilroy");
    expect(md).toContain("DK0000042/abcd");
    expect(md).toContain("Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days");
    expect(md).toContain("18/01/2027 al 24/01/2027");
    expect(md).toContain("2 pasajeros");
    expect(md).toContain("Inventado, Ficticia");
    expect(md).toContain("**CHB31**");
    expect(md).toContain("por el código exacto que mandó la agencia");
    expect(md).toContain("Para revisión");
    expect(md).toContain("Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030");
    expect(md).toContain("Sin vuelos en el mail");
    expect(md).toContain("US$ 0,0234");
  });

  it("fila 12: no expone mail, teléfono, fecha de nacimiento, pasaporte ni nombres de pila", () => {
    const md = armarReporteMail(resultado());
    for (const prohibido of ["pepe.inventado@example.com", "+45 12 34 56 78", "12 34 56 78", "01JAN99", "1999-01-01", "AB1234567", "Pepe", "Lola"]) {
      expect(md).not.toContain(prohibido);
    }
    expect(md).toContain("[mail]");
    expect(md).toContain("[teléfono]");
  });

  it("emparejado por nombre y por propuesta de la IA, con su confianza", () => {
    const porNombre = resultado();
    porNombre.reservas[0] = { ...porNombre.reservas[0], origenEmparejado: "nombre", confianzaEmparejado: 1 };
    expect(armarReporteMail(porNombre)).toContain("por el nombre que usa la agencia");
    const porIA = resultado();
    porIA.reservas[0] = { ...porIA.reservas[0], origenEmparejado: "ia", confianzaEmparejado: 0.93 };
    expect(armarReporteMail(porIA)).toContain("por propuesta de la IA, con confianza 0,93");
    const sinProducto = resultado();
    sinProducto.reservas[0] = {
      ...sinProducto.reservas[0],
      producto: null,
      origenEmparejado: null,
      confianzaEmparejado: null,
      sugerencia: { codigo: "AR09", nombre: "Patagonia Adventure Tour", confianza: 0.8 },
    };
    const md = armarReporteMail(sinProducto);
    expect(md).toContain("No se emparejó con ningún producto");
    expect(md).toContain("La IA sugirió **AR09** Patagonia Adventure Tour (confianza 0,80)");
  });

  it("owner 2026-10-16: el vuelo que falta va como aviso, no como motivo de revisión", () => {
    const r = resultado();
    r.reservas[0] = {
      ...r.reservas[0],
      estado: "recibida",
      motivos: [],
      avisos: ["Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030"],
    };
    const md = armarReporteMail(r);
    expect(md).toContain("- **Falta dato de llegada (no la manda a revisión):** Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030");
    expect(md).not.toContain("Por qué quedó en revisión");
  });

  it("owner 2026-10-16: Iguazú sin vuelo ni bus va bajo la misma marca 'falta dato de llegada'", () => {
    const r = resultado();
    const iguazu = "Falta el vuelo o bus de llegada a Iguazú: pasárselo a Cuenca del Plata cuando llegue.";
    r.reservas[0] = { ...r.reservas[0], estado: "recibida", motivos: [], avisos: [iguazu] };
    expect(armarReporteMail(r)).toContain(`- **Falta dato de llegada (no la manda a revisión):** ${iguazu}`);
  });

  it("un mail que se sumó a una reserva que ya existía: no creó otra", () => {
    const r = resultado();
    r.reservas[0] = { ...r.reservas[0], accion: "sumada" };
    expect(armarReporteMail(r)).toContain("No creó una reserva nueva: se sumó al historial de la reserva DK0000042/abcd");
  });

  it("un mail salteado dice por qué, sin el asunto (puede traer nombres)", () => {
    const md = armarReporteMail({
      archivo: "Kilroy-INBOX-1.eml",
      estado: "salteado",
      agencia: "Kilroy",
      motivo: "Es una respuesta o un reenvío, y su número no es de una reserva cargada",
      numerosAsunto: ["UK0000099"],
      costo: 0,
      reservas: [],
    });
    expect(md).toContain("No se leyó con IA");
    expect(md).toContain("Es una respuesta o un reenvío, y su número no es de una reserva cargada");
    expect(md).toContain("UK0000099");
    expect(md).toContain("US$ 0,0000");
  });

  it("varias reservas de un mail: una sección por reserva", () => {
    const r = resultado();
    r.reservas = [r.reservas[0], { ...r.reservas[0], producto: { codigo: "OD010D", nombre: "Iguazú" } }, { ...r.reservas[0], producto: null }];
    const md = armarReporteMail(r);
    expect(md).toContain("Salieron 3 reservas");
    expect(md.match(/^### Reserva \d/gm)).toHaveLength(3);
  });

  it("no procesado por el tope de la corrida: sin inventar datos", () => {
    const md = armarReporteMail({ archivo: "x.pdf", estado: "no_procesado", agencia: "TourRadar", motivo: "No procesado: tope de la corrida (US$ 2)", costo: 0, reservas: [] });
    expect(md).toContain("No procesado: tope de la corrida (US$ 2)");
    expect(md).not.toContain("Qué entendió");
  });
});

describe("sinDatosPersonales y nombreDelReporte", () => {
  it("borra mails, teléfonos, fechas de nacimiento estilo Kilroy y pasaportes", () => {
    expect(sinDatosPersonales("a@b.com, +54 9 11 5555-1234, 05AUG06, Passport: X1234567, vuelo LA800 el 12/01")).toBe(
      "[mail], [teléfono], [fecha], Passport: [documento], vuelo LA800 el 12/01",
    );
  });

  it("el nombre del reporte no lleva las notas del owner del nombre del PDF (pueden traer el nombre del pasajero)", () => {
    expect(nombreDelReporte("1# Booking Statement 1377598 - 25372219 - vendorbill Ejemplo Reserva de TR Juan Perez.pdf")).toBe(
      "Booking Statement 1377598 - 25372219 - vendorbill.md",
    );
    expect(nombreDelReporte("Reserva de Cliente Kilroy Copenagiue varias.docx")).toBe("Reserva de Cliente Kilroy Copenagiue varias.md");
    expect(nombreDelReporte("Kilroy-INBOX-15933.eml")).toBe("Kilroy-INBOX-15933.md");
  });
});

describe("nombreVisible", () => {
  it("el título del reporte de un PDF no lleva las notas del owner (pueden traer el nombre del pasajero)", () => {
    const md = armarReporteMail({
      archivo: "1# Booking Statement 0000042 - 00000042 - vendorbill Ejemplo Reserva de TR Juan Perez Original.pdf",
      estado: "salteado",
      agencia: "TourRadar",
      motivo: "x",
      costo: 0,
      reservas: [],
    });
    expect(md.split("\n")[0]).toBe("# Booking Statement 0000042 - 00000042 - vendorbill.pdf");
    expect(md).not.toContain("Juan");
    expect(nombreVisible("Reserva de Cliente Kilroy UK - 5 Countries 5C01.docx")).toBe("Reserva de Cliente Kilroy UK - 5 Countries 5C01.docx");
  });
});
