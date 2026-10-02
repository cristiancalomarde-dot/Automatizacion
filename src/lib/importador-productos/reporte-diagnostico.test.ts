import { describe, expect, it } from "vitest";
import type { Diagnostico } from "./diagnostico";
import { reporteJson, reporteMarkdown } from "./reporte-diagnostico";

// Spec M1-04c §3 #4, #5, #6, #8: el reporte para el owner (.md) y el mismo
// contenido para el loop principal (.json).

const DIAG: Diagnostico = {
  generado: "2026-10-02T12:00:00.000Z",
  archivo: "Construccion de Paquetes 2019 con 3 y 4 estrellas.xls",
  hoja: "Analisis a Mayo 2026",
  omitidosPorYaCargados: ["OD010A"],
  codigosAusentesEnRutas: [],
  paquetes: [
    {
      codigo: "OD018",
      destino: "BUE",
      destinoExcel: "BUE",
      encontrado: true,
      nombre: "Buenos Aires, Tango City",
      celda: "B480",
      bloqueNoCalza: false,
      nivelesNoOfrecidos: ["Budget Hotel"],
      correcciones: [],
      enRutasEnBus: true,
      servicios: [
        {
          fila: 482,
          tipo: "alojamiento",
          nivel: null,
          noches: null,
          linea: "Accommodation: Milhouse Avenue. Booking Supplier: Milhouse",
          opciones: [
            { prioridad: 1, serviceProvider: "Milhouse Avenue", bookingSupplier: "Milhouse", emparejado: "sin_emparejar", proveedorDirectorio: null, nota: null },
          ],
        },
        {
          fila: 492,
          tipo: "alojamiento",
          nivel: "Hotel 4*",
          noches: null,
          linea: "Accommodation: Hotel 4* Brizo. Booking Supplier: Alvarez Arguelles",
          opciones: [
            { prioridad: 1, serviceProvider: "Hotel 4* Brizo", bookingSupplier: "Alvarez Arguelles", emparejado: "por_equivalencia", proveedorDirectorio: "Alvarez Arguelles SA", nota: null },
          ],
        },
        {
          fila: 498,
          tipo: "excursion",
          nivel: null,
          noches: null,
          linea: "Excursion: City Tour / Bike Tour. Booking Supplier: Grupo Summa / La Bicicleta Naranja",
          opciones: [
            { prioridad: 1, serviceProvider: "City Tour", bookingSupplier: "Grupo Summa", emparejado: "exacto", proveedorDirectorio: "Grupo Summa", nota: null },
            { prioridad: 2, serviceProvider: "Bike Tour", bookingSupplier: "La Bicicleta Naranja", emparejado: "exacto", proveedorDirectorio: "La Bicicleta Naranja", nota: null },
          ],
        },
      ],
    },
    {
      codigo: "COMPBO20",
      destino: "UYU",
      destinoExcel: null,
      encontrado: false,
      nombre: null,
      celda: null,
      bloqueNoCalza: false,
      nivelesNoOfrecidos: [],
      correcciones: [],
      enRutasEnBus: true,
      servicios: [],
    },
  ],
  aConfirmar: {
    proveedoresSinEmparejar: [
      {
        nombre: "Milhouse",
        paquetes: ["OD018", "OD020"],
        nota: null,
        sugerencias: [{ nombre: "Milhouse Hostel Avenue", ciudad: "BUENOS AIRES", parecido: 0.77 }],
      },
    ],
    equivalenciasParaRevisar: [],
    serviciosSinBookingSupplier: [{ linea: "Excursions en Natales", donde: [{ codigo: "OD017", fila: 742 }] }],
    alojamientosSinNivel: [
      {
        codigo: "OD018",
        lineas: [{ fila: 482, texto: "Accommodation: Milhouse Avenue. Booking Supplier: Milhouse" }],
        nivelesDeLaTabla: ["Hostel"],
      },
    ],
    nivelesSoloEnPrecios: [{ codigo: "OD020", nivel: "Budget Hotel" }],
    lineasNoEntendidas: [
      { texto: "Hosteria HI: 80 DBL y 60 SGL", motivo: "no calza con ningún patrón conocido", donde: [{ codigo: "OD013", fila: 222 }, { codigo: "OD016", fila: 222 }] },
    ],
    bloquesNoEncontrados: [
      {
        codigo: "COMPBO20",
        motivo: "aparece solo el código, sin el nombre del paquete: no parece el título de un bloque",
        apariciones: [{ celda: "C848", texto: "COMPBO20" }],
        contexto: [{ celda: "B847", texto: "Overland Tour San Pedro - Uyuni" }],
      },
    ],
    bloquesDuplicados: [],
    bloquesQueNoCalzan: [],
    destinosAConfirmar: [{ codigo: "OD033", destinoLista: "CHA", destinoExcel: null }],
    nivelesConfirmadosSinLinea: [],
  },
  habriaNecesitadoIA: [{ codigo: "OD013", bloqueEntero: false, lineas: [{ fila: 222, texto: "Hosteria HI: 80 DBL y 60 SGL" }] }],
};

describe("reporteMarkdown", () => {
  const md = reporteMarkdown(DIAG);

  it("empieza con 'Lo que necesito que confirmes', antes del detalle por paquete", () => {
    const confirmar = md.indexOf("## Lo que necesito que confirmes");
    const detalle = md.indexOf("## Detalle por paquete");
    expect(confirmar).toBeGreaterThan(0);
    expect(detalle).toBeGreaterThan(confirmar);
  });

  it("una sección por paquete, con código, nombre y celda", () => {
    const secciones = md.split("\n").filter((l) => l.startsWith("### OD") || l.startsWith("### CH") || l.startsWith("### COMP"));
    expect(secciones).toHaveLength(2);
    expect(md).toContain("### OD018 · Buenos Aires, Tango City");
    expect(md).toContain("celda B480");
    expect(md).toContain("### COMPBO20 · no encontrado");
  });

  it("cada servicio muestra su Service Provider, su Booking Supplier y cómo emparejó", () => {
    expect(md).toMatch(/Milhouse Avenue.*Milhouse.*sin emparejar/);
    expect(md).toMatch(/Hotel 4\* Brizo.*Alvarez Arguelles.*por equivalencia.*Alvarez Arguelles SA/);
    expect(md).toMatch(/City Tour.*Grupo Summa.*exacto/);
  });

  it("cada proveedor sin emparejar aparece una sola vez en la lista, con sus paquetes y sugerencias marcadas como tales", () => {
    const lista = md.slice(md.indexOf("## Lo que necesito que confirmes"), md.indexOf("## Detalle por paquete"));
    expect(lista.match(/\*\*Milhouse\*\*/g)).toHaveLength(1);
    expect(lista).toContain("OD018, OD020");
    expect(lista).toMatch(/sugerencia/i);
    expect(lista).toContain("Milhouse Hostel Avenue");
  });

  it("incluye renglones no entendidos, niveles solo en precios, bloques no encontrados y destinos", () => {
    expect(md).toContain("Hosteria HI: 80 DBL y 60 SGL");
    expect(md).toMatch(/OD020.*Budget Hotel/);
    expect(md).toMatch(/COMPBO20[\s\S]*C848/);
    expect(md).toMatch(/OD033[\s\S]*CHA/);
  });

  it("tiene la sección 'Habría necesitado IA'", () => {
    expect(md).toContain("## Habría necesitado IA");
    expect(md).toMatch(/Habría necesitado IA[\s\S]*OD013[\s\S]*fila 222/);
  });

  it("no usa jerga de código para el owner (sin snake_case de estados)", () => {
    expect(md).not.toMatch(/sin_emparejar|por_equivalencia|sin_booking_supplier/);
  });
});

describe("reporteJson", () => {
  it("es JSON válido con una entrada por paquete", () => {
    const datos = JSON.parse(reporteJson(DIAG));
    expect(datos.paquetes).toHaveLength(2);
    expect(datos.paquetes.map((p: { codigo: string }) => p.codigo)).toEqual(["OD018", "COMPBO20"]);
    expect(datos.aConfirmar.proveedoresSinEmparejar[0].sugerencias[0].nombre).toBe("Milhouse Hostel Avenue");
  });
});
