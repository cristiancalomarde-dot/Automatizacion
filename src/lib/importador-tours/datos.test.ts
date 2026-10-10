import { describe, expect, it } from "vitest";
import { verificarCategorias } from "./categorias";
import { mismaRuta, parsearCategoriasTour, parsearTramosConProveedor, parsearTransfersTour } from "./datos";
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

  it("el archivo real: Imperio Inca en los dos sentidos; Kupos.cl en 5C01 (también Calama – San Pedro) y en la salida de ARCH33", async () => {
    const { readFileSync } = await import("node:fs");
    const texto = readFileSync("data/tramos-con-proveedor.csv", "utf-8");
    const tramos = parsearTramosConProveedor(texto);
    expect(tramos.map((t) => [t.tour, t.desde, t.hasta, t.bookingSupplier, t.ambosSentidos])).toEqual([
      ["CHB31", "UYU", "LPB", "Imperio Inca", true],
      ["BOCHI04R", "UYU", "LPB", "Imperio Inca", true],
      ["5C01", "SCL", "VLP", "Kupos.cl", false],
      ["5C01", "CJC", "SPA", "Kupos.cl", false],
      ["ARCH33", "PNT", "PUQ", "Kupos.cl", false],
      ["ARCH31", "PNT", "PUQ", "Kupos.cl", false],
    ]);
    // M1-07 #3: Transvip queda solo como traslado del aeropuerto de Calama (en OD030), no en 5C01.
    expect(texto).not.toMatch(/transvip/i);
    expect(tramos.find((t) => t.tour === "ARCH33")!.alternativa).toMatch(/Patagonia Planet/);
    // M1-08 (f): ARCH31 termina con la misma salida de Puerto Natales, el traslado a pedido
    expect(tramos.find((t) => t.tour === "ARCH31")!.alternativa).toMatch(/a pedido.*Patagonia Planet/);
  });

  it("alternativa es opcional", () => {
    expect(parsearTramosConProveedor("tour,ruta,booking_supplier\nCHB31,Bus Uyuni – La Paz,Imperio Inca\n")[0].alternativa).toBeUndefined();
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

describe("transfers-tour.csv (spec M1-07 §3 #4)", () => {
  it("cada fila dice qué cambia: si/no pisa la regla, vacío la deja", () => {
    const [e] = parsearTransfersTour("tour,codigo,transfer_in,transfer_out,nota\nBRARCH26,OD029,,no,owner\n");
    expect(e).toEqual({ tour: "BRARCH26", codigo: "OD029", transferIn: null, transferOut: false, nota: "owner" });
  });

  it("un valor que no es si/no/vacío, o una fila sin tour o código, es un error explícito", () => {
    const enc = "tour,codigo,transfer_in,transfer_out\n";
    expect(() => parsearTransfersTour(`${enc}BRARCH26,OD029,quizas,\n`)).toThrow(/fila 2.*transfer_in/);
    expect(() => parsearTransfersTour(`${enc},OD029,,no\n`)).toThrow(/fila 2/);
    expect(() => parsearTransfersTour(`${enc}BRARCH26,OD029,,\n`)).toThrow(/fila 2.*no cambia nada/);
  });

  it("el archivo real: BRARCH26 OD029 sin transfer de salida (owner, 2026-10-09); 5C01 OD031 llega a la terminal (M1-08)", async () => {
    const { readFileSync } = await import("node:fs");
    const filas = parsearTransfersTour(readFileSync("data/transfers-tour.csv", "utf-8"));
    expect(filas.map((f) => [f.tour, f.codigo, f.transferIn, f.transferOut])).toEqual([
      ["BRARCH26", "OD029", null, false],
      ["5C01", "OD031", true, false],
    ]);
  });
});

describe("equivalencias-proveedores.csv (spec M1-07 §3 #2)", () => {
  it("Cuenca del Plata y Patagonian Group se resuelven hotel por hotel (owner, 2026-10-10; M1-08 §3 #7)", async () => {
    const { readFileSync } = await import("node:fs");
    const { parsearEquivalencias } = await import("@/lib/importador-productos/equivalencias");
    const texto = readFileSync("data/equivalencias-proveedores.csv", "utf-8");
    expect(texto).not.toMatch(/Natalia|Analia/);
    const filas = parsearEquivalencias(texto);
    const modo = (destino: string, alias: string) => filas.find((f) => f.destino === destino && f.alias === alias)?.modo;
    for (const [d, a] of [["IGR", "Cuenca del Plata"], ["IGR", "Cuenca del Plana"], ["CHA", "Patagonian Group"], ["FTE", "Patagonian Group"]]) {
      expect(modo(d, a), `${d} ${a}`).toBe("por_service_provider");
    }
    const a = (destino: string, alias: string) => filas.find((f) => f.destino === destino && f.alias === alias)?.proveedor_en_directorio;
    expect(a("CHA", "Fitz Roy")).toBe("Hosteria Fitz roy, proveedor Patagonian Group");
    expect(a("CHA", "Vertical Lodge")).toBe("Vertical Lodge, proveedor Patagonian Group");
    expect(a("CHA", "El Paraiso")).toBe("Hosteria El Paraiso, proveedor Patagonian Group");
    expect(a("FTE", "Puerto San Julian")).toBe("Hosteria Puerto San Julian, proveedor Patagonian Group");
    expect(a("IGR", "El Pueblito")).toBe("El Pueblito, proveedor Cuenca del Plata");
    expect(a("IGR", "La Aldea")).toBe("La Aldea de la Selva, proveedor Cuenca del Plata");
    // ninguna equivalencia apunta ya a la fila suelta "Hosteria Fitz roy"
    expect(filas.some((f) => f.proveedor_en_directorio === "Hosteria Fitz roy")).toBe(false);
  });
});
