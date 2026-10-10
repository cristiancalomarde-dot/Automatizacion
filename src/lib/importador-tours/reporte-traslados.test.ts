import { describe, expect, it } from "vitest";
import type { AjusteTraslado } from "./traslados";
import { lineaAjuste, reporteTrasladosMarkdown } from "./reporte-traslados";

function a(parcial: Partial<AjusteTraslado> & Pick<AjusteTraslado, "paquete" | "accion">): AjusteTraslado {
  return { tour: "5C01", orden: 1, texto: null, motivo: "motivo", origen: "regla", servicio: "Transfer X. Booking Supplier: Y", sentido: "llegada", ...parcial };
}

describe("reporte de traslados por tour para el owner (spec M1-08 §3 #10)", () => {
  const tours = [
    {
      codigo: "5C01",
      nombre: "5 Countries",
      ajustes: [
        a({ paquete: "OD020", accion: "anular", servicio: "Transfer EZE o AEP - Hotel - EZE o AEP. Booking Supplier: Greeters", motivo: "llega en bus desde Iguazú y sale en bus a Mendoza" }),
        a({ paquete: "OD031", accion: "reemplazar", origen: "excepcion", texto: "Transfer terminal de buses de La Paz - alojamiento", motivo: "Owner (2026-10-10): llega en bus desde Uyuni" }),
      ],
    },
    {
      codigo: "AR09",
      nombre: "Patagonia Adventure Tour",
      ajustes: [
        a({ tour: "AR09", paquete: "OD018", accion: "solo_llegada", motivo: "sale en bus a Puerto Madryn: solo se pide la llegada" }),
        a({ tour: "AR09", paquete: "OD022", accion: "solo_salida", motivo: "llega en bus desde El Calafate: solo se pide la salida" }),
      ],
    },
    { codigo: "CHB31", nombre: "Overland", ajustes: [] },
  ];
  const md = reporteTrasladosMarkdown(
    { tours, sinSentido: [{ paquete: "OD019", orden: 4, servicio: "Transfers: Remis Mendoza. Booking Booking Supplier: Remis Mendoza" }] },
    { fecha: "2026-10-10" },
  );

  it("por tour: qué se anuló, qué se reemplazó y qué quedó de un solo lado, en llano", () => {
    expect(md).toContain("## 5C01 · 5 Countries");
    expect(md).toMatch(/\*\*Se anulan\*\*[\s\S]*\*\*OD020\*\* · Transfer EZE o AEP - Hotel - EZE o AEP \(Greeters\): llega en bus desde Iguazú y sale en bus a Mendoza/);
    expect(md).toMatch(/\*\*Cambian\*\*[\s\S]*\*\*OD031\*\* · Transfer X \(Y\): se pide como “Transfer terminal de buses de La Paz - alojamiento”\. Owner \(2026-10-10\)/);
    expect(md).toMatch(/\*\*De un solo lado\*\*[\s\S]*\*\*OD018\*\* · Transfer X \(Y\): solo la llegada/);
    expect(md).toContain("solo la salida");
    expect(md).toMatch(/## CHB31 · Overland\n\nSin cambios: cada paquete pide sus traslados como se vende solo\./);
  });

  it("lista los traslados sin sentido deducido", () => {
    expect(md).toMatch(/## Traslados sin sentido deducido[\s\S]*\*\*OD019\*\* · Transfers: Remis Mendoza \(Remis Mendoza\)/);
  });

  it("una línea por acción", () => {
    expect(lineaAjuste(a({ paquete: "OD030", accion: "invertir", texto: "San Pedro → CJC" }))).toContain("cambia de sentido: “San Pedro → CJC”");
  });
});
