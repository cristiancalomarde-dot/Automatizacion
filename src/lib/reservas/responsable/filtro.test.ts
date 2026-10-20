// Spec M3-06 fila 7: el filtro por operativo de la lista ("Todas", "Mis
// reservas", "Sin responsable" y cada persona), lo que se recuerda en el
// navegador y la combinación con el buscador.
import { describe, expect, it } from "vitest";
import { TEXTOS } from "@/lib/textos";
import { coincideBusqueda } from "../reglas";
import { claveFiltroResponsable, filtroGuardado, opcionesFiltroResponsable, pasaFiltroResponsable } from "./filtro";

const F = TEXTOS.reservas.responsable;
const YO = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const OTRA = "22222222-2222-4222-8222-bbbbbbbbbbbb";
const EQUIPO = [
  { id: OTRA, nombre: "Leticia" },
  { id: YO, nombre: "Damián" },
];

const fila = (responsableId: string | null, pasajero: string) => ({ responsableId, pasajeros: [pasajero], numero: null });
const filas = [fila(YO, "Ana Perez"), fila(OTRA, "Luis Perez"), fila(null, "Ana Gomez"), fila(YO, "Juan Gomez")];

describe("pasaFiltroResponsable", () => {
  it("Todas (por defecto): todas", () => {
    expect(filas.filter((f) => pasaFiltroResponsable(f, "todas", YO))).toHaveLength(4);
  });

  it("Mis reservas: solo las mías; sin saber quién soy, ninguna", () => {
    expect(filas.filter((f) => pasaFiltroResponsable(f, "mias", YO)).map((f) => f.pasajeros[0])).toEqual(["Ana Perez", "Juan Gomez"]);
    expect(filas.filter((f) => pasaFiltroResponsable(f, "mias", null))).toEqual([]);
  });

  it("Sin responsable y una persona del equipo", () => {
    expect(filas.filter((f) => pasaFiltroResponsable(f, "sin", YO)).map((f) => f.pasajeros[0])).toEqual(["Ana Gomez"]);
    expect(filas.filter((f) => pasaFiltroResponsable(f, `persona:${OTRA}`, YO)).map((f) => f.pasajeros[0])).toEqual(["Luis Perez"]);
  });

  it("se combina con el buscador: filtra las dos cosas", () => {
    const encontradas = filas.filter((f) => pasaFiltroResponsable(f, "mias", YO) && coincideBusqueda(f, "perez"));
    expect(encontradas.map((f) => f.pasajeros[0])).toEqual(["Ana Perez"]);
  });
});

describe("opcionesFiltroResponsable", () => {
  it("Todas · Mis reservas · Sin responsable · cada persona (sin repetirme), por nombre", () => {
    expect(opcionesFiltroResponsable(EQUIPO, YO)).toEqual([
      { valor: "todas", texto: F.todas },
      { valor: "mias", texto: F.mias },
      { valor: "sin", texto: F.sin },
      { valor: `persona:${OTRA}`, texto: "Leticia" },
    ]);
  });

  it("sin saber quién soy, no ofrece 'Mis reservas'", () => {
    expect(opcionesFiltroResponsable(EQUIPO, null).map((o) => o.valor)).toEqual(["todas", "sin", `persona:${YO}`, `persona:${OTRA}`]);
  });
});

describe("lo que se recuerda en el navegador", () => {
  it("una clave por persona", () => {
    expect(claveFiltroResponsable(YO)).not.toBe(claveFiltroResponsable(OTRA));
  });

  it("lo guardado vale si sigue entre las opciones; si no, Todas", () => {
    const opciones = opcionesFiltroResponsable(EQUIPO, YO);
    expect(filtroGuardado("mias", opciones)).toBe("mias");
    expect(filtroGuardado(`persona:${OTRA}`, opciones)).toBe(`persona:${OTRA}`);
    expect(filtroGuardado("persona:otro", opciones)).toBe("todas");
    expect(filtroGuardado(null, opciones)).toBe("todas");
  });
});
