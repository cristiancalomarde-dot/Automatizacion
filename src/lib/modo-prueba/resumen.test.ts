import { describe, expect, it } from "vitest";
import { armarResumen, type DatosResumen } from "./resumen";

// Spec M2-06 fila 15: el resumen tiene la medición (el mismo número que la
// pantalla), el gasto, el modelo usado, la comparación Sonnet vs. Opus y la
// lista de reservas con su marca. Datos inventados.

function datos(c: Partial<DatosResumen> = {}): DatosResumen {
  return {
    fecha: "2026-10-14",
    reservas: [
      { archivo: "a.docx", reporte: "a.md", bookingId: "DK0000042/abcd", agencia: "Kilroy", producto: "CHB31", estado: "para_revision", motivos: ["Falta el vuelo"], marca: { resultado: "bien", queMal: [], nota: null } },
      { archivo: "b.pdf", reporte: "b.md", bookingId: "0000042", agencia: "TourRadar", producto: null, estado: "para_revision", motivos: ["No está en el catálogo"], marca: { resultado: "mal", queMal: ["producto"], nota: "era AR09" } },
      { archivo: "c.eml", reporte: "c.md", bookingId: "DK0000043", agencia: "Kilroy", producto: "OD010D", estado: "recibida", motivos: [], marca: null },
    ],
    archivos: [
      { archivo: "a.docx", estado: "procesado", reservas: 1, reporte: "a.md" },
      { archivo: "p.docx", estado: "salteado", motivo: "No es un mail de agencia", reservas: 0, reporte: "p.md" },
    ],
    gasto: { total: 0.4321, lecturas: 15, propuestas: 3 },
    modelos: ["claude-sonnet-5-5"],
    versiones: ["lectura-mail.v2"],
    evals: [
      { modelo: "claude-sonnet-5-5", version: "lectura-mail.v2", total: 100, gasto: 0.14, porCampo: { tipo: 100, numero: 100, pax: 100 }, cuando: "2026-10-14T01:06" },
      { modelo: "claude-opus-5-5", version: "lectura-mail.v2", total: 97.6, gasto: 0.31, porCampo: { tipo: 100, numero: 100, pax: 83.3 }, cuando: "2026-10-14T20:00" },
    ],
    ...c,
  };
}

describe("armarResumen", () => {
  it("la medición con el mismo texto que la pantalla, y el % de producto mal aparte", () => {
    const md = armarResumen(datos());
    expect(md).toContain("Revisadas 2 de 3 · 1 mal (50%) · faltan 1 por revisar");
    expect(md).toContain("Producto mal: 1 de 2 revisadas (50%)");
  });

  it("el gasto, el modelo y la versión de las instrucciones", () => {
    const md = armarResumen(datos());
    expect(md).toContain("US$ 0,4321");
    expect(md).toContain("claude-sonnet-5-5");
    expect(md).toContain("lectura-mail.v2");
  });

  it("la comparación de modelos por campo, con su costo", () => {
    const md = armarResumen(datos());
    expect(md).toMatch(/\| Campo \| claude-sonnet-5-5 \| claude-opus-5-5 \|/);
    expect(md).toMatch(/\| pax \| 100% \| 83,3% \|/);
    expect(md).toMatch(/\| Costo de la corrida \| US\$ 0,1400 \| US\$ 0,3100 \|/);
  });

  it("la lista de reservas con su marca y lo que pasó con cada archivo", () => {
    const md = armarResumen(datos());
    expect(md).toContain("| a.docx | Kilroy | DK0000042/abcd | CHB31 | Para revisión | Bien |");
    expect(md).toContain("| b.pdf | TourRadar | 0000042 | sin producto | Para revisión | Mal: producto (era AR09) |");
    expect(md).toContain("| c.eml | Kilroy | DK0000043 | OD010D | Recibida | sin marcar |");
    expect(md).toContain("| p.docx | No es un mail de agencia | 0 |");
  });

  it("sin la tabla de marcas todavía (migración sin aplicar), lo dice y no inventa la medición", () => {
    const md = armarResumen(datos({ marcasDisponibles: false }));
    expect(md).toContain("La marca del owner todavía no está disponible");
  });
});
