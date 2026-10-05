import { describe, expect, it } from "vitest";
import { fila, RUTAS_5C01, RUTAS_ARCH31, RUTAS_ARCH33 } from "./fixtures";
import { leerTourRutas, normalizarCategoria } from "./rutas";

describe("códigos de cada tour en RutasenBus, hoja Tours 2027 (spec M1-05 §2)", () => {
  it("lee la fila de códigos justo arriba de 'Net Prices:', con la columna de cada paquete", () => {
    const t = leerTourRutas(RUTAS_ARCH31, "ARCH31")!;
    expect(t.componentes.map((c) => [c.codigo, c.ajusteNoches, c.columna, c.encabezado])).toEqual([
      ["OD016", 1, "C", "FTE + 1 Nt"],
      ["OD017", 0, "D", "PNT 2n"],
      ["OD033", 0, "F", "CHA 3 nts"],
    ]);
  });

  it("ignora lo que está desde la columna del total (la temporada '2026-27')", () => {
    const t = leerTourRutas(RUTAS_5C01, "5C01")!;
    expect(t.componentes.map((c) => c.codigo)).toEqual([
      "OD020", "OD019", "OD029", "OD010D", "OD032", "CHB31", "COMPCH01", "COMPBR10", "OD031",
    ]);
    expect(t.noReconocidos).toEqual([]);
  });

  it("'(menos 1 noche)' = una noche menos; '(mas 1 noche)' = una más", () => {
    expect(leerTourRutas(RUTAS_5C01, "5C01")!.componentes[1]).toMatchObject({ codigo: "OD019", ajusteNoches: -1 });
    expect(leerTourRutas(RUTAS_ARCH31, "ARCH31")!.componentes[0]).toMatchObject({ codigo: "OD016", ajusteNoches: 1 });
  });

  it("'(esta incluido en CH10)' no es un componente propio", () => {
    const t = leerTourRutas(RUTAS_ARCH33, "ARCH33")!;
    expect(t.componentes.map((c) => c.codigo)).toEqual(["OD016", "CH10", "OD033"]);
    expect(t.incluidos).toEqual([{ incluidoEn: "CH10", columna: "F", encabezado: "PNT - PUQ" }]);
  });

  it("una anotación que no entiende queda como no reconocida (no se adivina)", () => {
    const filas = [
      fila({ A: "ZZ01" }),
      fila({ C: "OD016 (con vuelo)", D: "OD017" }),
      fila({ B: "Net Prices:", C: "FTE", D: "PNT", E: "TTL" }),
    ];
    const t = leerTourRutas(filas, "ZZ01")!;
    expect(t.noReconocidos).toEqual([{ columna: "C", texto: "OD016 (con vuelo)" }]);
  });

  it("anota las columnas sin código (los buses según RutasenBus)", () => {
    expect(leerTourRutas(RUTAS_ARCH31, "ARCH31")!.columnasSinCodigo).toEqual([{ columna: "E", encabezado: "FTE - PNT" }]);
  });

  it("devuelve null si el tour no está en la hoja", () => {
    expect(leerTourRutas(RUTAS_ARCH31, "AR09")).toBeNull();
  });

  it("las categorías salen de la tabla de venta (no de la de costos), sin habitación ni suplementos", () => {
    expect(leerTourRutas(RUTAS_ARCH31, "ARCH31")!.categorias).toEqual(["Hostel", "Budget Hotel"]);
    expect(leerTourRutas(RUTAS_5C01, "5C01")!.categorias).toEqual(["Hostel", "Budget Hotel"]);
    expect(leerTourRutas(RUTAS_ARCH33, "ARCH33")!.categorias).toEqual(["Hostel", "Hotel 3*"]);
  });

  it("normaliza la categoría: saca Dorm/DBL/SGL/ensuite y unifica el nivel", () => {
    expect(normalizarCategoria("Dorm Ensuite Hostel")).toBe("Hostel");
    expect(normalizarCategoria("DBL Budget Hotel")).toBe("Budget Hotel");
    expect(normalizarCategoria("SGL Hotel 4*")).toBe("Hotel 4*");
    expect(normalizarCategoria("Hotel 3* DBL")).toBe("Hotel 3*");
    expect(normalizarCategoria("DBL Hotel in SPA")).toBe("Hotel in SPA");
  });
});
