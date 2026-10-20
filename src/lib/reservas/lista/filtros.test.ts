// Spec M3-08 filas 1 a 4, 6 y 7: el orden, los filtros de estado, agencia y
// fechas, la vista de terminadas y lo que se recuerda en el navegador.
import { describe, expect, it } from "vitest";
import {
  ELECCION_INICIAL,
  claveEleccionLista,
  eleccionGuardada,
  filtrarYOrdenar,
  hayFiltros,
  type EleccionLista,
} from "./filtros";

const HOY = "2026-10-20";

type F = { id: string; estado: string; agencia: string; fechaInicio: string | null; fechaFin: string | null; llego: string };
const f = (id: string, fechaInicio: string | null, fechaFin: string | null, extra: Partial<F> = {}): F => ({
  id,
  estado: "recibida",
  agencia: "Kilroy",
  fechaInicio,
  fechaFin,
  llego: "2026-10-01T10:00:00Z",
  ...extra,
});

const ids = (filas: F[]) => filas.map((x) => x.id);
const con = (cambios: Partial<EleccionLista>): EleccionLista => ({ ...ELECCION_INICIAL, ...cambios });

describe("M3-08 fila 1 — Ordenar por", () => {
  const filas = [
    f("nov", "2026-11-05", "2026-11-09", { llego: "2026-10-03T10:00:00Z" }),
    f("sin", null, null, { llego: "2026-10-05T10:00:00Z" }),
    f("oct", "2026-10-25", "2026-11-20", { llego: "2026-10-01T10:00:00Z" }),
    f("dic", "2026-12-01", "2026-12-03", { llego: "2026-10-02T10:00:00Z" }),
  ];
  it("por defecto, por inicio del viaje: las próximas primero y las sin fecha al final", () => {
    expect(ELECCION_INICIAL.orden).toBe("inicio");
    expect(ids(filtrarYOrdenar(filas, ELECCION_INICIAL, HOY))).toEqual(["oct", "nov", "dic", "sin"]);
  });
  it("por fin del viaje", () => {
    expect(ids(filtrarYOrdenar(filas, con({ orden: "fin" }), HOY))).toEqual(["nov", "oct", "dic", "sin"]);
  });
  it("por llegada del mail, las más nuevas primero", () => {
    expect(ids(filtrarYOrdenar(filas, con({ orden: "llegada" }), HOY))).toEqual(["sin", "nov", "dic", "oct"]);
  });
});

describe("M3-08 fila 2 — todas las vigentes juntas", () => {
  const filas = [
    f("confirmada", "2026-11-10", "2026-11-12", { estado: "confirmada" }),
    f("pendiente", "2026-11-01", "2026-11-03", { estado: "recibida" }),
    f("revision", "2026-11-05", "2026-11-06", { estado: "para_revision" }),
    f("descartada", "2026-10-30", "2026-11-02", { estado: "descartada" }),
  ];
  it("todos los estados en orden de inicio, salvo las descartadas", () => {
    expect(ids(filtrarYOrdenar(filas, ELECCION_INICIAL, HOY))).toEqual(["pendiente", "revision", "confirmada"]);
  });
  it("el filtro de estado sigue funcionando (también para ver las descartadas)", () => {
    expect(ids(filtrarYOrdenar(filas, con({ estado: "confirmada" }), HOY))).toEqual(["confirmada"]);
    expect(ids(filtrarYOrdenar(filas, con({ estado: "descartada" }), HOY))).toEqual(["descartada"]);
  });
});

describe("M3-08 fila 3 — filtro por agencia", () => {
  const filas = [
    f("k", "2026-11-01", "2026-11-02", { agencia: "Kilroy" }),
    f("j", "2026-11-02", "2026-11-03", { agencia: "Journaway" }),
    f("t", "2026-11-03", "2026-11-04", { agencia: "TourRadar" }),
  ];
  it("Todas por defecto; una agencia muestra solo las suyas", () => {
    expect(ids(filtrarYOrdenar(filas, ELECCION_INICIAL, HOY))).toEqual(["k", "j", "t"]);
    expect(ids(filtrarYOrdenar(filas, con({ agencia: "Journaway" }), HOY))).toEqual(["j"]);
    expect(ids(filtrarYOrdenar(filas, con({ agencia: "TourRadar" }), HOY))).toEqual(["t"]);
  });
});

describe("M3-08 fila 4 — filtro por fechas del viaje", () => {
  const filas = [
    f("hoy", "2026-10-20", "2026-10-22"),
    f("en7", "2026-10-27", "2026-10-29"),
    f("en8", "2026-10-28", "2026-10-30"),
    f("en30", "2026-11-19", "2026-11-25"),
    f("en31", "2026-11-20", "2026-11-25"),
    f("cruza", "2027-02-26", "2027-03-02"),
    f("marzo", "2027-03-10", "2027-03-12"),
    f("finDeMarzo", "2027-03-31", null),
    f("sinFecha", null, null),
  ];
  it("arrancan en los próximos 7 días (hoy incluido)", () => {
    expect(ids(filtrarYOrdenar(filas, con({ fechas: "7" }), HOY))).toEqual(["hoy", "en7"]);
  });
  it("arrancan en los próximos 30 días", () => {
    expect(ids(filtrarYOrdenar(filas, con({ fechas: "30" }), HOY))).toEqual(["hoy", "en7", "en8", "en30"]);
  });
  it("viajan en marzo: alguno de sus días cae en marzo (también los que cruzan de mes)", () => {
    expect(ids(filtrarYOrdenar(filas, con({ fechas: "mes", mes: "2027-03" }), HOY))).toEqual(["cruza", "marzo", "finDeMarzo"]);
    expect(ids(filtrarYOrdenar(filas, con({ fechas: "mes", mes: "2027-02" }), HOY))).toEqual(["cruza"]);
  });
  it("un viaje de fin de año cae en diciembre y en enero", () => {
    const fin = [f("anio", "2026-12-28", "2027-01-03")];
    expect(ids(filtrarYOrdenar(fin, con({ fechas: "mes", mes: "2026-12" }), HOY))).toEqual(["anio"]);
    expect(ids(filtrarYOrdenar(fin, con({ fechas: "mes", mes: "2027-01" }), HOY))).toEqual(["anio"]);
    expect(ids(filtrarYOrdenar(fin, con({ fechas: "mes", mes: "2026-11" }), HOY))).toEqual([]);
  });
  it("todas las fechas: también las sin fecha", () => {
    expect(filtrarYOrdenar(filas, ELECCION_INICIAL, HOY)).toHaveLength(filas.length);
  });
});

describe("M3-08 filas 5 y 6 — terminadas", () => {
  const filas = [
    f("vigente", "2026-10-18", "2026-10-20"),
    f("vieja", "2026-03-01", "2026-03-05", { agencia: "TourRadar" }),
    f("reciente", "2026-10-10", "2026-10-19", { agencia: "Kilroy" }),
    f("marzoK", "2026-02-27", "2026-03-02", { agencia: "Kilroy" }),
  ];
  it("en la vista normal no aparecen las terminadas", () => {
    expect(ids(filtrarYOrdenar(filas, ELECCION_INICIAL, HOY))).toEqual(["vigente"]);
  });
  it("'Viajes terminados': solo esas, por fin del viaje (las más recientes primero)", () => {
    expect(ids(filtrarYOrdenar(filas, con({ vista: "terminadas" }), HOY))).toEqual(["reciente", "vieja", "marzoK"]);
  });
  it("combinable con agencia y mes", () => {
    expect(ids(filtrarYOrdenar(filas, con({ vista: "terminadas", agencia: "Kilroy" }), HOY))).toEqual(["reciente", "marzoK"]);
    expect(ids(filtrarYOrdenar(filas, con({ vista: "terminadas", fechas: "mes", mes: "2026-03" }), HOY))).toEqual(["vieja", "marzoK"]);
  });
});

describe("M3-08 fila 7 — lo que se recuerda", () => {
  const opciones = { agencias: ["Journaway", "Kilroy", "TourRadar"], esAdmin: false };
  it("una clave por persona", () => {
    expect(claveEleccionLista("a")).not.toBe(claveEleccionLista("b"));
  });
  it("lo guardado vale si sigue siendo una opción; lo demás vuelve a lo inicial", () => {
    const guardado = JSON.stringify({ orden: "fin", agencia: "Kilroy", fechas: "mes", mes: "2027-03", estado: "confirmada", vista: "vigentes" });
    expect(eleccionGuardada(guardado, opciones)).toEqual({ orden: "fin", agencia: "Kilroy", fechas: "mes", mes: "2027-03", estado: "confirmada", vista: "vigentes" });
    const raro = JSON.stringify({ orden: "x", agencia: "Otra", fechas: "99", mes: "marzo", estado: "nada", vista: "terminadas" });
    expect(eleccionGuardada(raro, opciones)).toEqual(ELECCION_INICIAL);
    expect(eleccionGuardada("{no es json", opciones)).toEqual(ELECCION_INICIAL);
    expect(eleccionGuardada(null, opciones)).toEqual(ELECCION_INICIAL);
  });
  it("la vista de terminadas guardada solo vale para una administradora", () => {
    const guardado = JSON.stringify({ ...ELECCION_INICIAL, vista: "terminadas" });
    expect(eleccionGuardada(guardado, opciones).vista).toBe("vigentes");
    expect(eleccionGuardada(guardado, { ...opciones, esAdmin: true }).vista).toBe("terminadas");
  });
  it("hayFiltros: algo distinto de lo inicial (para 'Limpiar filtros')", () => {
    expect(hayFiltros(ELECCION_INICIAL)).toBe(false);
    expect(hayFiltros(con({ agencia: "Kilroy" }))).toBe(true);
    expect(hayFiltros(con({ orden: "fin" }))).toBe(false);
  });
});
