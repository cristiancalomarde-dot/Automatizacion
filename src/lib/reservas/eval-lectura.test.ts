import { describe, expect, it } from "vitest";
import { fichaGrabada, mailDePrueba } from "./__fixtures__/cargar";
import type { FichaIA } from "./esquema-ficha";
import { CAMPOS_EVAL, compararFicha, resumirEval, type FichaEsperada } from "./eval-lectura";
import { limpiarFicha } from "./limpiar-ficha";

// Spec M2-02 fila 28: el comparador del set de evaluación (exacto en códigos,
// números y fechas; normalizado en nombres).

function fichaSpap05() {
  const mail = mailDePrueba("journaway-spap05");
  return limpiarFicha(fichaGrabada("journaway-spap05") as unknown as FichaIA, {
    agencia: "Journaway",
    textoVerificable: mail.cuerpoTexto ?? "",
    seMandoPdf: false,
    adjuntosNoLeidos: [],
  });
}

const ESPERADA: FichaEsperada = {
  tipo_mail: "reserva_nueva",
  agencia: "Journaway",
  numero_reserva: null,
  productos: [
    { nombre: "San Pedro de Atacama: Astronomy Tour in the Atacama Desert", fecha_inicio: "2026-10-11", fecha_fin: null },
    { nombre: "San Pedro de Atacama: Tour through the Moon Valley", fecha_inicio: "2026-10-12", fecha_fin: null },
    { nombre: "San Pedro de Atacama: Tour to the Quepiaco River, Monjes de la Pacana, and the salt flats", fecha_inicio: "2026-10-13", fecha_fin: null },
    { nombre: "tour to the TATIO geysers", fecha_inicio: "2026-10-14", fecha_fin: null },
    { nombre: "From San Pedro: Sol de Manana Geysers, Licancabur Volcano & Laguna Colorada", fecha_inicio: "2026-10-15", fecha_fin: null },
    { nombre: "Siloli: Full-day tour to the Siloli Desert & the Black Lagoon", fecha_inicio: "2026-10-16", fecha_fin: null },
    { nombre: "Salar de Uyuni: Full-day tour to Uyuni", fecha_inicio: "2026-10-17", fecha_fin: null },
  ],
  fecha_inicio: "2026-10-06",
  fecha_fin: "2026-10-27",
  pax: 2,
  vuelos: [
    { numero: "IB1314", origen: "MUC", destino: "MAD", fecha_salida: "2026-10-06", hora_salida: "19:45", fecha_llegada: "2026-10-06", hora_llegada: "22:35" },
    { numero: "LA5404", origen: "MAD", destino: "SCL", fecha_salida: "2026-10-06", hora_salida: "23:59", fecha_llegada: "2026-10-07", hora_llegada: "08:25" },
    { numero: "LA148", origen: "SCL", destino: "CJC", fecha_salida: "2026-10-11", hora_salida: "14:01", fecha_llegada: "2026-10-11", hora_llegada: "16:11" },
    { numero: "LA2277", origen: "CUZ", destino: "LIM", fecha_salida: "2026-10-26", hora_salida: "18:45", fecha_llegada: "2026-10-26", hora_llegada: "20:25" },
    { numero: "LA2484", origen: "LIM", destino: "MAD", fecha_salida: "2026-10-26", hora_salida: "23:00", fecha_llegada: "2026-10-27", hora_llegada: "16:20" },
    { numero: "IB1315", origen: "MAD", destino: "MUC", fecha_salida: "2026-10-27", hora_salida: "20:00", fecha_llegada: "2026-10-27", hora_llegada: "22:40" },
  ],
};

describe("compararFicha (fila 28)", () => {
  it("la ficha correcta acierta todos los campos; los nombres se comparan normalizados", () => {
    const r = compararFicha(ESPERADA, fichaSpap05());
    expect(Object.keys(r.campos).sort()).toEqual([...CAMPOS_EVAL].sort());
    expect(Object.values(r.campos).every(Boolean)).toBe(true);
    expect(r.diferencias).toEqual([]);
  });

  it("una fecha corrida falla 'fechas' y solo 'fechas'", () => {
    const f = fichaSpap05();
    f.productos[3] = { ...f.productos[3], fecha_inicio: "2026-10-15" };
    const r = compararFicha(ESPERADA, f);
    expect(r.campos.fechas).toBe(false);
    expect(r.campos.producto).toBe(true);
    expect(r.diferencias.join(" ")).toMatch(/2026-10-14/);
  });

  it("los códigos y números son exactos: un vuelo con otro número o una hora distinta falla 'vuelos'", () => {
    const f = fichaSpap05();
    f.vuelos[1] = { ...f.vuelos[1], hora_llegada: "08:26" };
    expect(compararFicha(ESPERADA, f).campos.vuelos).toBe(false);
    const g = fichaSpap05();
    g.vuelos = g.vuelos.slice(1);
    expect(compararFicha(ESPERADA, g).campos.vuelos).toBe(false);
  });

  it("un producto de más o con otro código falla 'producto'", () => {
    const f = fichaSpap05();
    f.productos.push({ ...f.productos[0], nombre: "Otro tour" });
    expect(compararFicha(ESPERADA, f).campos.producto).toBe(false);
    const conCodigo: FichaEsperada = { ...ESPERADA, productos: [{ nombre: "X", codigo: "HI_ARGENTINA_OD010D-677", fecha_inicio: null, fecha_fin: null }] };
    const g = fichaSpap05();
    g.productos = [{ ...g.productos[0], nombre: "X", codigo: "HI_ARGENTINA_OD010C-677" }];
    expect(compararFicha(conCodigo, g).campos.producto).toBe(false);
  });

  it("número, pax, agencia y tipo exactos", () => {
    const f = fichaSpap05();
    expect(compararFicha({ ...ESPERADA, numero_reserva: "62992" }, f).campos.numero).toBe(false);
    expect(compararFicha({ ...ESPERADA, pax: 3 }, f).campos.pax).toBe(false);
    expect(compararFicha({ ...ESPERADA, agencia: "Kilroy" }, f).campos.agencia).toBe(false);
    expect(compararFicha({ ...ESPERADA, tipo_mail: "cancelacion" }, f).campos.tipo).toBe(false);
  });

  it("si la lectura quedó para revisión, no acierta ningún campo", () => {
    const r = compararFicha(ESPERADA, null);
    expect(Object.values(r.campos).some(Boolean)).toBe(false);
  });

  it("el resumen da el % por campo y el total", () => {
    const bien = compararFicha(ESPERADA, fichaSpap05());
    const mal = compararFicha(ESPERADA, null);
    const res = resumirEval([bien, mal]);
    expect(res.porCampo.agencia).toBe(50);
    expect(res.total).toBe(50);
  });
});
