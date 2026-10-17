import { describe, expect, it } from "vitest";
import { arranqueLectura, configCasilla, lecturaActiva } from "./config";

describe("configCasilla (criterio #1)", () => {
  const completa = { SALES_IMAP_HOST: "imap.ejemplo.test", SALES_IMAP_USER: "sales@ejemplo.test", SALES_IMAP_PASSWORD: "x" };

  it("con las tres variables arma la conexión por SSL al 993", () => {
    expect(configCasilla(completa)).toEqual({ host: "imap.ejemplo.test", usuario: "sales@ejemplo.test", clave: "x", puerto: 993, seguro: true });
  });

  it("si falta alguna (o está vacía), no hay configuración", () => {
    for (const k of Object.keys(completa)) {
      expect(configCasilla({ ...completa, [k]: undefined })).toBeNull();
      expect(configCasilla({ ...completa, [k]: "  " })).toBeNull();
    }
  });

  it("sin TLS solo contra la máquina local (el servidor falso de los tests)", () => {
    expect(configCasilla({ ...completa, SALES_IMAP_HOST: "127.0.0.1", SALES_IMAP_PORT: "1143" })).toMatchObject({ puerto: 1143, seguro: false });
    expect(configCasilla({ ...completa, SALES_IMAP_PORT: "1143" })).toMatchObject({ puerto: 1143, seguro: true });
  });
});

describe("lecturaActiva (criterio #21)", () => {
  it("solo con LECTURA_SALES_ACTIVA=si", () => {
    expect(lecturaActiva({ LECTURA_SALES_ACTIVA: "si" })).toBe(true);
    expect(lecturaActiva({ LECTURA_SALES_ACTIVA: " SI " })).toBe(true);
    expect(lecturaActiva({})).toBe(false);
    expect(lecturaActiva({ LECTURA_SALES_ACTIVA: "no" })).toBe(false);
    expect(lecturaActiva({ LECTURA_SALES_ACTIVA: "true" })).toBe(false);
  });
});

describe("arranqueLectura (owner, 2026-10-17)", () => {
  it("sin LECTURA_SALES_DESDE no hay fecha de arranque", () => {
    expect(arranqueLectura({})).toBeNull();
    expect(arranqueLectura({ LECTURA_SALES_DESDE: "  " })).toBeNull();
  });

  it("lee una fecha y hora ISO", () => {
    expect(arranqueLectura({ LECTURA_SALES_DESDE: "2026-10-17T16:00:00Z" })?.toISOString()).toBe("2026-10-17T16:00:00.000Z");
  });

  it("si la fecha no se entiende, frena en vez de leer de más", () => {
    expect(() => arranqueLectura({ LECTURA_SALES_DESDE: "mañana" })).toThrow(/LECTURA_SALES_DESDE/);
  });
});
