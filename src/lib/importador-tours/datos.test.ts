import { describe, expect, it } from "vitest";
import { verificarCategorias } from "./categorias";
import { mismaRuta, parsearCategoriasTour, parsearTramosConProveedor } from "./datos";
import { fila } from "./fixtures";
import { nochesBasePaquete } from "./noches-base";

describe("tramos-con-proveedor.csv (spec M1-05 §3 #6)", () => {
  it("lee la ruta 'Bus A – B' como dos destinos, válida en los dos sentidos", () => {
    const [t] = parsearTramosConProveedor("tour,ruta,booking_supplier,nota\nCHB31,Bus Uyuni – La Paz,Imperio Inca,\n");
    expect(t).toMatchObject({ tour: "CHB31", desde: "UYU", hasta: "LPB", bookingSupplier: "Imperio Inca" });
    expect(mismaRuta(t, "LPB", "UYU")).toBe(true);
    expect(mismaRuta(t, "UYU", "SPA")).toBe(false);
  });

  it("una ruta que no se entiende es un error explícito", () => {
    expect(() => parsearTramosConProveedor("tour,ruta,booking_supplier\nCHB31,Bus a Narnia,X\n")).toThrow(/fila 2/);
  });

  it("ambos_sentidos es opcional: 'si' = el proveedor hace el bus en los dos sentidos; sin columna, no", () => {
    expect(parsearTramosConProveedor("tour,ruta,booking_supplier\nCHB31,Bus Uyuni – La Paz,Imperio Inca\n")[0].ambosSentidos).toBe(false);
    const [si, no] = parsearTramosConProveedor(
      "tour,ruta,booking_supplier,ambos_sentidos\nCHB31,Bus Uyuni – La Paz,Imperio Inca,si\n5C01,Bus Calama – San Pedro,Transvipp,no\n",
    );
    expect([si.ambosSentidos, no.ambosSentidos]).toEqual([true, false]);
    expect(() => parsearTramosConProveedor("tour,ruta,booking_supplier,ambos_sentidos\nCHB31,Bus Uyuni – La Paz,X,quizas\n")).toThrow(/ambos_sentidos/);
  });

  it("el archivo real: Imperio Inca y Chalten Travel en los dos sentidos; Kupos.cl y Transvipp en 5C01", async () => {
    const { readFileSync } = await import("node:fs");
    const tramos = parsearTramosConProveedor(readFileSync("data/tramos-con-proveedor.csv", "utf-8"));
    expect(tramos.map((t) => [t.tour, t.desde, t.hasta, t.bookingSupplier, t.ambosSentidos])).toEqual([
      ["CHB31", "UYU", "LPB", "Imperio Inca", true],
      ["BOCHI04R", "UYU", "LPB", "Imperio Inca", true],
      ["ARCH31", "CHA", "FTE", "Chalten Travel", true],
      ["ARCH33", "CHA", "FTE", "Chalten Travel", true],
      ["5C01", "SCL", "VLP", "Kupos.cl", false],
      ["5C01", "CJC", "SPA", "Transvipp", false],
    ]);
  });
});

describe("categorías tour ↔ paquete (spec M1-05 §3 #8)", () => {
  const eq = parsearCategoriasTour(
    "tour,categoria_tour,componente,categoria_paquete,nota\nBRARCH26,Budget Hotel,OD032,Hotel 3*,Confirmado\n",
  );

  it("por defecto busca la misma categoría; con el archivo, la equivalente", () => {
    const faltan = verificarCategorias(
      "BRARCH26",
      ["Hostel", "Budget Hotel"],
      [
        { codigo: "OD018", categorias: ["Hostel", "Budget Hotel", "Hotel 3*"] },
        { codigo: "OD032", categorias: ["Hostel", "Hotel 3*"] },
        { codigo: "OD019", categorias: ["Hostel", "Hotel 3*", "Hotel 4*"] },
      ],
      eq,
    );
    expect(faltan.map((f) => `${f.componente} ${f.categoriaTour}→${f.buscada}`)).toEqual(["OD019 Budget Hotel→Budget Hotel"]);
  });

  it("un componente sin alojamiento (Overland) no se controla", () => {
    expect(verificarCategorias("CHB31", ["Hostel"], [{ codigo: "COMPBO20", categorias: [] }], [])).toEqual([]);
  });

  it("el archivo real trae lo que confirmó el owner (Budget de Río = 3*, Hotel in SPA = 3*, …)", async () => {
    const { readFileSync } = await import("node:fs");
    const filas = parsearCategoriasTour(readFileSync("data/categorias-tour.csv", "utf-8")).map(
      (f) => `${f.tour} ${f.categoriaTour} ${f.componente} → ${f.categoriaPaquete}`,
    );
    expect(filas).toEqual(
      expect.arrayContaining([
        "BRARCH26 Budget Hotel OD032 → Hotel 3*",
        "5C01 Budget Hotel OD032 → Hotel 3*",
        "CHB31 Hotel in SPA OD030 → Hotel 3*",
        "ARCH33 Hotel 3* OD033 → Budget Hotel",
        "5C01 Budget Hotel CHB31 → Hotel in SPA",
      ]),
    );
  });
});

describe("noches base de un paquete en el Excel de paquetes", () => {
  it("las toma de la celda vecina al título o de adentro del título", () => {
    const filas = [
      fila({ B: "MENDOZA, Mountains and Wineries OD019", K: "MENDOZA Welcome Package OD0212N" }),
      fila({ F: "Mendoza Mountains and Wineries OD019", H: "3 nights" }),
      fila({ B: "San Pedro de Atacama Explorer 3 nights OD030" }),
      fila({ B: "W Trek Standard 4 NTS + Puerto Natales CH10", C: "Estándar" }),
      fila({ F: "W Trek Standard Self Guided + Puerto Natales (6 nights) CH10" }),
      fila({ A: "COMPBO20", B: "Overland Tour San Pedro - Uyuni 3 dias / 2 noches en Villamar" }),
      fila({ F: "Sao Paulo 2 nights Sample", G: "COMPBR10", H: "2 nights" }),
    ];
    expect(nochesBasePaquete(filas, "OD019")).toBe(3);
    expect(nochesBasePaquete(filas, "OD030")).toBe(3);
    expect(nochesBasePaquete(filas, "CH10")).toBe(6);
    expect(nochesBasePaquete(filas, "COMPBO20")).toBe(2);
    expect(nochesBasePaquete(filas, "COMPBR10")).toBe(2);
    expect(nochesBasePaquete(filas, "OD021")).toBeNull();
  });
});
