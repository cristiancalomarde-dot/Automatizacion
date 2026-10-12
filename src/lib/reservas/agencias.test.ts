import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENCIA_DESCONOCIDA, agenciaDelRemitente, direccionDelRemitente, leerAgencias } from "./agencias";

// Spec M2-01 filas 8 y 9: los remitentes conocidos de cada agencia
// (`data/agencias.csv`, listado del owner del 2026-10-12) y el reconocimiento
// de la agencia a partir de la dirección del remitente.

const RUTA_CSV = resolve(__dirname, "..", "..", "..", "data", "agencias.csv");
const reglasReales = () => leerAgencias(readFileSync(RUTA_CSV, "utf-8"));

describe("data/agencias.csv (fila 8)", () => {
  it("el archivo real se lee sin errores y tiene las cuatro agencias", () => {
    const reglas = reglasReales();
    expect(new Set(reglas.map((r) => r.agencia))).toEqual(new Set(["Kilroy", "Jysk", "TourRadar", "Journaway"]));
    expect(reglas.every((r) => r.estado === "confirmado")).toBe(true);
  });

  it("tiene los dominios y la dirección exacta del listado del owner", () => {
    const valores = (agencia: string, tipo: string) =>
      reglasReales()
        .filter((r) => r.agencia === agencia && r.tipo === tipo)
        .map((r) => r.valor)
        .sort();
    expect(valores("Kilroy", "dominio")).toEqual(
      [
        "kilroy.be",
        "kilroy.co.uk",
        "kilroy.dk",
        "kilroy.fi",
        "kilroy.is",
        "kilroy.net",
        "kilroy.nl",
        "kilroy.no",
        "kilroy.se",
        "kilroy.uk",
      ].sort(),
    );
    expect(valores("Jysk", "dominio")).toEqual(["jr.dk"]);
    expect(valores("TourRadar", "dominio")).toEqual(["tourradar.com"]);
    expect(valores("TourRadar", "direccion")).toEqual(["system@sent-via.netsuite.com"]);
    expect(valores("Journaway", "dominio")).toEqual(["journaway.com"]);
  });

  it("ninguna dirección o dominio aparece dos veces ni en dos agencias", () => {
    const vistos = reglasReales().map((r) => `${r.tipo}:${r.valor}`);
    expect(new Set(vistos).size).toBe(vistos.length);
  });

  it("ninguna fila es de hitravel.com.ar", () => {
    expect(reglasReales().some((r) => r.valor.endsWith("hitravel.com.ar"))).toBe(false);
  });
});

describe("leerAgencias — validación del archivo", () => {
  const ENCABEZADO = "agencia,tipo,valor,estado,nota\n";

  it("rechaza un valor repetido, aunque sea en otra agencia o con otras mayúsculas", () => {
    expect(() =>
      leerAgencias(`${ENCABEZADO}Kilroy,dominio,kilroy.dk,confirmado,\nJysk,dominio,Kilroy.DK,confirmado,\n`),
    ).toThrow(/kilroy\.dk/);
  });

  it("rechaza una fila de hitravel.com.ar (dominio, subdominio o dirección)", () => {
    expect(() => leerAgencias(`${ENCABEZADO}Kilroy,dominio,hitravel.com.ar,confirmado,\n`)).toThrow(/hitravel/);
    expect(() => leerAgencias(`${ENCABEZADO}Kilroy,direccion,sales@hitravel.com.ar,confirmado,\n`)).toThrow(
      /hitravel/,
    );
    expect(() => leerAgencias(`${ENCABEZADO}Kilroy,dominio,mail.hitravel.com.ar,confirmado,\n`)).toThrow(
      /hitravel/,
    );
  });

  it("rechaza un tipo o un estado desconocido, y una dirección o un dominio mal escritos", () => {
    expect(() => leerAgencias(`${ENCABEZADO}Kilroy,sitio,kilroy.dk,confirmado,\n`)).toThrow(/tipo/);
    expect(() => leerAgencias(`${ENCABEZADO}Kilroy,dominio,kilroy.dk,quizas,\n`)).toThrow(/estado/);
    expect(() => leerAgencias(`${ENCABEZADO}Kilroy,direccion,kilroy.dk,confirmado,\n`)).toThrow(/direcci/);
    expect(() => leerAgencias(`${ENCABEZADO}Kilroy,dominio,a@kilroy.dk,confirmado,\n`)).toThrow(/dominio/);
    expect(() => leerAgencias(`${ENCABEZADO},dominio,kilroy.dk,confirmado,\n`)).toThrow(/agencia/);
  });

  it("guarda los valores en minúscula y sin espacios", () => {
    expect(leerAgencias(`${ENCABEZADO}Kilroy, dominio , Kilroy.DK ,confirmado,ejemplo\n`)).toEqual([
      { agencia: "Kilroy", tipo: "dominio", valor: "kilroy.dk", estado: "confirmado", nota: "ejemplo" },
    ]);
  });
});

describe("agenciaDelRemitente (fila 9)", () => {
  const reconocer = (remitente: string) => agenciaDelRemitente(remitente, reglasReales());

  it.each([
    ["aarhus@kilroy.dk", "Kilroy"],
    ["Copenhagen@Kilroy.DK", "Kilroy"],
    ["oslo@kilroy.no", "Kilroy"],
    ["travels@kilroy.co.uk", "Kilroy"],
    ["alguien@jr.dk", "Jysk"],
    ["explore@mail.tourradar.com", "TourRadar"],
    ["msg@notify.tourradar.com", "TourRadar"],
    ["system@sent-via.netsuite.com", "TourRadar"],
    ["de@journaway.com", "Journaway"],
    ["info@journaway.com", "Journaway"],
    ["Kilroy Aarhus <aarhus@kilroy.dk>", "Kilroy"],
    ['"Journaway Operations" <operations@journaway.com>', "Journaway"],
  ])("%s → %s", (remitente, agencia) => {
    expect(reconocer(remitente)).toBe(agencia);
  });

  it.each([
    "otro@sent-via.netsuite.com",
    "alguien@kilroy.dk.ejemplo.com",
    "x@notkilroy.dk",
    "x@faketourradar.com",
    "sales@hitravel.com.ar",
    '"Journaway" <reservas@gmail.com>',
    "Journaway <journaway@gmail.com>",
    "journaway.com",
    "",
    "sin arroba",
  ])("no debe pasar: %s → desconocida", (remitente) => {
    expect(reconocer(remitente)).toBe(AGENCIA_DESCONOCIDA);
  });

  it("la dirección exacta le gana al dominio", () => {
    const reglas = leerAgencias(
      "agencia,tipo,valor,estado,nota\nKilroy,dominio,ejemplo.com,confirmado,\nJysk,direccion,jysk@ejemplo.com,confirmado,\n",
    );
    expect(agenciaDelRemitente("jysk@ejemplo.com", reglas)).toBe("Jysk");
    expect(agenciaDelRemitente("otro@ejemplo.com", reglas)).toBe("Kilroy");
  });

  it("una fila a confirmar no reconoce a nadie (nunca se adivina)", () => {
    const reglas = leerAgencias("agencia,tipo,valor,estado,nota\nKilroy,dominio,kilroy.dk,a_confirmar,\n");
    expect(agenciaDelRemitente("aarhus@kilroy.dk", reglas)).toBe(AGENCIA_DESCONOCIDA);
  });

  it("sin reglas explícitas usa el archivo real", () => {
    expect(agenciaDelRemitente("aarhus@kilroy.dk")).toBe("Kilroy");
  });
});

describe("direccionDelRemitente", () => {
  it("saca la dirección de un remitente con nombre visible, en minúscula", () => {
    expect(direccionDelRemitente('"Kilroy Aarhus" <Aarhus@Kilroy.DK>')).toBe("aarhus@kilroy.dk");
    expect(direccionDelRemitente("  aarhus@kilroy.dk ")).toBe("aarhus@kilroy.dk");
    expect(direccionDelRemitente("Journaway")).toBeNull();
  });
});
