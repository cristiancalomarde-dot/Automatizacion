import { describe, expect, it } from "vitest";
import { cargarExcursionesConEntrada, leerExcursionesConEntrada } from "./cargar";
import { llevaEntradas } from "./entradas";

describe("data/excursiones-con-entrada.csv", () => {
  it("se lee por código o por parte del nombre; 'revisar' no se aplica hasta confirmarlo", () => {
    const lista = leerExcursionesConEntrada(
      'codigo,patron,estado,nota\nSPAE04,,si,"Tatio, con entrada"\n,Valle de la Luna,si,nota\nSPAE05,,revisar,dudosa\n',
    );
    expect(llevaEntradas(lista, "SPAE04", "lo que sea")).toBe(true);
    expect(llevaEntradas(lista, "OD030", "Excursión al VALLE DE LA LUNA")).toBe(true);
    expect(llevaEntradas(lista, "SPAE05", "Salt Flats Route Tour")).toBe(false);
    expect(llevaEntradas(lista, "SPAE01", "Astrophotography Tour")).toBe(false);
  });

  it("una fila sin código ni patrón, o con un estado que no es 'si' ni 'revisar', es un error", () => {
    expect(() => leerExcursionesConEntrada("codigo,patron,estado,nota\n,,si,x\n")).toThrow(/fila 2/);
    expect(() => leerExcursionesConEntrada("codigo,patron,estado,nota\nSPAE04,,quizas,x\n")).toThrow(/fila 2/);
    expect(() => leerExcursionesConEntrada("codigo,estado\nSPAE04,si\n")).toThrow(/codigo,patron,estado,nota/);
  });

  it("la lista del owner: solo San Pedro de Atacama (Horizonte), nada de otros destinos", () => {
    const lista = cargarExcursionesConEntrada();
    expect(llevaEntradas(lista, "SPAE04", "El Tatio Geisers Tour (entrance fee)")).toBe(true);
    expect(llevaEntradas(lista, "SPAE03", "Moon Valley Tour (entrance fee)")).toBe(true);
    for (const [codigo, nombre] of [
      ["IGRE01", "Argentina Side of the Falls"],
      ["IGRE02", "Brazilian Side of the Falls"],
      ["FTEE01", "Perito Moreno Glacier day tour (group)"],
      ["PNTE01", "Torres del Paine Full Day with Milodon Cave from Puerto Natales"],
      ["USHE01", "Tierra del Fuego National Park Half Day"],
      ["UYUO01", "Overland privado San Pedro – Uyuni en hoteles Tayka"],
      ["OD031", "Tiwanaku"],
    ]) {
      expect(llevaEntradas(lista, codigo, nombre), codigo).toBe(false);
    }
    for (const fila of lista) if (fila.codigo) expect(fila.codigo).toMatch(/^SPAE/);
  });
});
