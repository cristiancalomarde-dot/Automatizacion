import { describe, expect, it } from "vitest";
import { cuandoEnArgentina, lineaDeLectura, type CorridaParaLinea } from "./estado";

// 2026-10-16 es viernes. 15:14 UTC = 12:14 en Argentina.
const ahora = new Date("2026-10-16T18:00:00Z");
const corrida = (extra: Partial<CorridaParaLinea> = {}): CorridaParaLinea => ({
  estado: "anduvo_bien",
  inicio: "2026-10-16T15:14:00Z",
  miro: 41,
  de_agencias: 4,
  reservas_nuevas: 3,
  reservas_actualizadas: 1,
  avisos: [],
  errores: [],
  ...extra,
});

describe("cuandoEnArgentina", () => {
  it("hoy, ayer, el día de la semana o la fecha, en hora de Argentina", () => {
    expect(cuandoEnArgentina("2026-10-16T15:14:00Z", ahora)).toBe("hoy 12:14");
    expect(cuandoEnArgentina("2026-10-15T15:10:00Z", ahora)).toBe("ayer 12:10");
    expect(cuandoEnArgentina("2026-10-12T15:10:00Z", ahora)).toBe("el lunes 12:10");
    expect(cuandoEnArgentina("2026-10-01T15:10:00Z", ahora)).toBe("el 01/10 12:10");
    // 01:00 UTC del 16 todavía es el 15 en Argentina.
    expect(cuandoEnArgentina("2026-10-16T01:00:00Z", ahora)).toBe("ayer 22:00");
  });
});

describe("lineaDeLectura (§4)", () => {
  const base = { activa: true, ahora, noSePudoLeer: 0 };

  it("anduvo bien", () => {
    expect(lineaDeLectura({ ...base, ultima: corrida(), ultimaBuena: corrida() })).toEqual({
      tono: "ok",
      lineas: ["Última lectura de sales@: hoy 12:14 · 3 reservas nuevas, 1 actualizada (de 41 mails, 4 de agencias)."],
    });
  });

  it("con aviso: el resumen y debajo el aviso en llano", () => {
    const c = corrida({ estado: "con_aviso", reservas_nuevas: 1, reservas_actualizadas: 0, avisos: ["No encontré la carpeta Spam: solo se leyó la bandeja de entrada."] });
    expect(lineaDeLectura({ ...base, ultima: c, ultimaBuena: c })).toEqual({
      tono: "aviso",
      lineas: [
        "Última lectura de sales@: hoy 12:14 · 1 reserva nueva (de 41 mails, 4 de agencias).",
        "No encontré la carpeta Spam: solo se leyó la bandeja de entrada.",
      ],
    });
  });

  it("falló: qué pasó y que se reintenta; con los mails que no se pudieron leer", () => {
    const c = corrida({ estado: "fallo", inicio: "2026-10-16T15:03:00Z", errores: ["la casilla no respondió"] });
    expect(lineaDeLectura({ ...base, noSePudoLeer: 2, ultima: c, ultimaBuena: corrida({ inicio: "2026-10-15T18:10:00Z" }) })).toEqual({
      tono: "error",
      lineas: [
        "La última lectura falló (hoy 12:03): la casilla no respondió. Se reintenta mañana a las 12 y no se pierde nada.",
        "2 mails de agencias no se pudieron leer y esperan revisión.",
      ],
    });
  });

  it("atrasada: la última que anduvo es de hace más de 26 horas", () => {
    const vieja = corrida({ inicio: "2026-10-12T15:10:00Z" });
    const r = lineaDeLectura({ ...base, ultima: vieja, ultimaBuena: vieja });
    expect(r.tono).toBe("aviso");
    expect(r.lineas).toContain("No hubo lectura de sales@ desde el lunes 12:10.");
  });

  it("apagada, vacío y error al consultar", () => {
    expect(lineaDeLectura({ ...base, activa: false, ultima: corrida(), ultimaBuena: corrida() })).toEqual({
      tono: "neutro",
      lineas: ["La lectura automática de sales@ está apagada hasta tu OK del modo prueba."],
    });
    expect(lineaDeLectura({ ...base, ultima: null, ultimaBuena: null })).toEqual({ tono: "neutro", lineas: ["Todavía no corrió ninguna lectura de sales@."] });
    expect(lineaDeLectura({ ...base, error: true, ultima: null, ultimaBuena: null })).toEqual({ tono: "error", lineas: ["No pude consultar el registro de lecturas."] });
  });
});
