import { describe, expect, it } from "vitest";
import { armarTour } from "./armado";
import { PAQUETES, RUTAS_ARCH31, RUTAS_CHB31, WORD_ARCH31, WORD_CHB31 } from "./fixtures";
import type { ResumenImportacionTours, ResumenTour } from "./importar";
import { reporteToursMarkdown } from "./reporte";
import { leerTourRutas } from "./rutas";
import { leerItinerario } from "./word";

function resumenDe(codigo: string, filas: string[][], word: string[]): ResumenTour {
  const excel = leerTourRutas(filas, codigo)!;
  const t = armarTour({
    codigo,
    excel,
    word: leerItinerario(word, codigo),
    paquetes: new Map(PAQUETES.map((p) => [p.codigo, p])),
    codigosTour: new Set(["CHB31", "ARCH31"]),
    tours: new Map(),
    tramosConProveedor: [{ tour: "CHB31", desde: "UYU", hasta: "LPB", ruta: "Bus Uyuni – La Paz", bookingSupplier: "Imperio Inca" }],
  });
  if (t.estado !== "armado") throw new Error(t.motivos.join(" | "));
  return {
    codigo,
    nombre: t.nombre,
    noches: t.noches,
    estado: "armado",
    motivos: [],
    notas: t.notas,
    componentes: t.componentes.map((c) => ({ ...c, nombreComponente: `Paquete ${c.codigo}` })),
    serviciosPropios: t.serviciosPropios.map((s) => ({ ...s, bookingSupplierId: "x", sinResolver: false, reservaManual: false })),
    ciudades: t.ciudades,
    categorias: excel.categorias,
    categoriasFaltantes: [],
    wordArchivo: "Multi.docx",
    filaRutas: excel.fila,
    columnasSinCodigo: excel.columnasSinCodigo,
    diasSinEncabezado: [],
  };
}

describe("reporte de los tours para el owner (spec M1-05 §3 #10)", () => {
  const r: ResumenImportacionTours = {
    importacionId: "x",
    tours: [
      resumenDe("ARCH31", RUTAS_ARCH31, WORD_ARCH31),
      resumenDe("CHB31", RUTAS_CHB31, WORD_CHB31),
      {
        ...resumenDe("ARCH31", RUTAS_ARCH31, WORD_ARCH31),
        codigo: "AR09",
        nombre: "Patagonia Adventure Tour",
        estado: "para_revisar",
        motivos: ["el Word suma 14 noches y el título dice 15 noches"],
        componentes: [],
        diasSinEncabezado: [3, 7],
      },
    ],
    nochesBase: { OD016: 2, OD033: null },
    creados: { productos: 0, componentes: 0, servicios: 0, codigos: 0 },
    actualizados: { productos: 0, componentes: 0, servicios: 0 },
    eliminados: { componentes: 0, servicios: 0 },
    filasParaRevisar: 1,
  };
  r.tours[0].categoriasFaltantes = [
    { tour: "ARCH31", categoriaTour: "Budget Hotel", componente: "OD017", buscada: "Budget Hotel", porArchivo: false, disponibles: ["Hostel", "Hotel 3*"] },
  ];
  const md = reporteToursMarkdown(r, { fecha: "2026-10-05", archivos: ["RutasenBus2020.xls"] });

  it("tiene la secuencia día por día con noches, buses y quién los reserva", () => {
    expect(md).toContain("| 1 | **OD033** Paquete OD033 (El Chaltén) | 3 noches | transfer de llegada |");
    expect(md).toContain("| 4 | Bus El Chaltén – El Calafate (diurno) | — | lo emite HI Travel (tarea manual) |");
    expect(md).toContain("3 noches (1 noche más que el paquete solo)");
    expect(md).toContain("| 6 | Bus Uyuni – La Paz (nocturno, llega el día 7) | — | lo reserva Imperio Inca (servicio del tour) |");
  });

  it("lista los tours para revisar con su motivo", () => {
    expect(md).toMatch(/## Para revisar[\s\S]*\*\*AR09\*\*[\s\S]*el Word suma 14 noches/);
  });

  it("tiene “Lo que necesito que confirmes”: categorías, buses y días del Word", () => {
    expect(md).toContain("## Lo que necesito que confirmes");
    expect(md).toContain("- [ ] **ARCH31**, “Budget Hotel”: OD017 (tiene Hostel, Hotel 3*).");
    expect(md).toMatch(/\*\*ARCH31\*\*: El Chaltén – El Calafate; El Calafate – Puerto Natales\. En RutasenBus, las columnas sin código son: “FTE - PNT”/);
    expect(md).toContain("- [ ] **AR09**: días 3, 7.");
    expect(md).toContain("| OD033 | no encontradas |");
  });
});
