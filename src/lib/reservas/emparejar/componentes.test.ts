import { describe, expect, it } from "vitest";
import { detalleDePrueba, idDe, proveedorPatagoniaPlanet } from "./__fixtures__/cargar";
import { componentesDeLaReserva } from "./componentes";

/**
 * Spec M2-03 filas 9 y 10: las partes de un tour compuesto, en orden y con su
 * fecha real (fecha de inicio + día del tour), con el catálogo real (foto).
 */

const PNT = proveedorPatagoniaPlanet();
const partes = (codigo: string, inicio: string, finalPuertoNatales = false) =>
  componentesDeLaReserva(detalleDePrueba(codigo), inicio, { finalPuertoNatales, proveedorTransferPNT: PNT });

const resumen = (c: ReturnType<typeof partes>[number]) =>
  `${c.tipo}${c.esTarea ? " (tarea)" : ""} ${c.productoId ? codigoDe(c.productoId) : c.descripcionRuta} ${c.fechaInicio}`;
const CODIGOS = ["OD030", "COMPBO20", "OD032", "COMPBR10", "OD010D", "OD020", "OD019", "OD029", "COMPCH01", "OD031", "OD033", "OD016", "OD017", "CH10", "OD018", "OD025", "OD013", "OD022", "OD010A"];
function codigoDe(id: string) {
  return CODIGOS.find((c) => idDe(c) === id) ?? id;
}

describe("M2-03 fila 9 — tour compuesto: sus partes en orden y con fecha real", () => {
  it("CHB31 desde el 13 Sep 2026 → OD030 el 13/9, COMPBO20 el 16/9, bus Uyuni – La Paz el 18/9 con Imperio Inca", () => {
    const c = partes("CHB31", "2026-09-13");
    expect(c.map(resumen)).toEqual([
      "paquete OD030 2026-09-13",
      "paquete COMPBO20 2026-09-16",
      "servicio Bus Uyuni – La Paz 2026-09-18",
    ]);
    expect(c[0]).toMatchObject({ fechaFin: "2026-09-16", esTarea: false });
    expect(c[0].productoComponenteId).toBeTruthy();
    const bus = c[2];
    expect(bus.esTarea).toBe(false);
    expect(bus.proveedorId).toBeTruthy();
    expect(bus.productoServicioId).toBeTruthy();
    expect(bus.fechaFin).toBe("2026-09-19"); // nocturno: llega al día siguiente
  });

  it("5C01 → 10 paquetes, con CHB31 abierto en OD030 y COMPBO20", () => {
    const c = partes("5C01", "2026-11-01");
    const paquetes = c.filter((x) => x.tipo === "paquete").map((x) => codigoDe(x.productoId!));
    expect(paquetes).toEqual(["OD032", "COMPBR10", "OD010D", "OD020", "OD019", "OD029", "COMPCH01", "OD030", "COMPBO20", "OD031"]);
    expect(c.find((x) => x.productoId === idDe("OD030"))?.fechaInicio).toBe("2026-11-22");
    expect(c.find((x) => x.productoId === idDe("OD031"))?.fechaInicio).toBe("2026-11-28");
    // Las fechas no van para atrás.
    const fechas = c.map((x) => x.fechaInicio!);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it("no debe pasar: un bus de Kupos o Plataforma10 como pedido a un proveedor", () => {
    for (const codigo of ["5C01", "ARCH31", "ARCH33", "AR09", "BRARCH26", "BOCHI04R", "CHB31"]) {
      for (const c of partes(codigo, "2027-01-01")) {
        if (c.tipo === "tramo_bus") {
          expect(c.esTarea, `${codigo} ${c.descripcionRuta}`).toBe(true);
          expect(c.proveedorId).toBeNull();
        }
        if (c.esTarea) expect(c.proveedorId).toBeNull();
        if (c.tipo === "servicio") expect(c.descripcionRuta).not.toMatch(/kupos|plataforma/i);
      }
    }
    // Los buses Kupos del tour (Santiago – Valparaíso, Calama – San Pedro) son tareas.
    const kupos = partes("5C01", "2026-11-01").filter((x) => /Valparaíso|Calama – San Pedro/.test(x.descripcionRuta ?? ""));
    expect(kupos.length).toBeGreaterThanOrEqual(2);
    for (const k of kupos) expect(k.esTarea).toBe(true);
  });

  it("BOCHI04R: arranca con el bus La Paz – Uyuni (Imperio Inca) el día 1", () => {
    expect(partes("BOCHI04R", "2026-10-01").map(resumen)).toEqual([
      "servicio Bus La Paz – Uyuni 2026-10-01",
      "paquete COMPBO20 2026-10-02",
      "paquete OD030 2026-10-04",
    ]);
  });

  it("AR09 y BRARCH26: los tramos de bus público quedan como tareas, en su día", () => {
    const ar09 = partes("AR09", "2026-11-20");
    expect(ar09.filter((x) => x.tipo === "paquete")).toHaveLength(4);
    expect(ar09.find((x) => x.descripcionRuta === "Buenos Aires – Puerto Madryn")).toMatchObject({
      fechaInicio: "2026-11-23",
      fechaFin: "2026-11-24",
      esTarea: true,
    });
    expect(partes("BRARCH26", "2026-11-01").filter((x) => x.tipo === "paquete")).toHaveLength(5);
  });

  it("un paquete vendido solo no tiene partes", () => {
    expect(partes("OD010D", "2026-09-06")).toEqual([]);
  });
});

describe("M2-03 fila 10 — final de ARCH31 y ARCH33", () => {
  it("ARCH33 saliendo de Puerto Natales: el último paso es el transfer al aeropuerto PNT (Patagonia Planet)", () => {
    const c = partes("ARCH33", "2027-02-23", true);
    const ultimo = c.at(-1)!;
    expect(ultimo).toMatchObject({
      tipo: "servicio",
      esTarea: false,
      proveedorId: PNT!.id,
      descripcionRuta: "Transfer al aeropuerto de Puerto Natales (PNT)",
      fechaInicio: "2027-03-06",
    });
    expect(c.some((x) => /Punta Arenas/.test(x.descripcionRuta ?? ""))).toBe(false);
  });

  it("ARCH31 sin esa mención: el bus Kupos Puerto Natales – Punta Arenas como tarea", () => {
    const c = partes("ARCH31", "2027-03-01");
    expect(c.at(-1)).toMatchObject({
      tipo: "tramo_bus",
      esTarea: true,
      proveedorId: null,
      descripcionRuta: "Bus Puerto Natales – Punta Arenas",
      fechaInicio: "2027-03-09",
    });
    expect(c.map(resumen)).toEqual([
      "paquete OD033 2027-03-01",
      "paquete OD016 2027-03-04",
      "tramo_bus (tarea) El Calafate – Puerto Natales 2027-03-07",
      "paquete OD017 2027-03-07",
      "tramo_bus (tarea) Bus Puerto Natales – Punta Arenas 2027-03-09",
    ]);
  });
});
