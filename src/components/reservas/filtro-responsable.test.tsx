// @vitest-environment jsdom
//
// Spec M3-06 filas 6 y 7: en la lista, el responsable de cada fila ("Sin
// responsable" si nadie la tomó) y el filtro "Responsable: Todas · Mis
// reservas · Sin responsable · <cada persona>", combinado con el buscador y
// recordado por persona en el navegador.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(async () => new Map()),
  cargarRevision: vi.fn(async () => null),
}));
const equipo = vi.hoisted(() => ({ cargarEquipo: vi.fn() }));
vi.mock("@/lib/reservas/consultas", () => consultas);
vi.mock("@/lib/usuarios/equipo", () => equipo);
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams("prueba=1"),
}));

import { IDS, listaReservas } from "@/lib/reservas/fixtures.test-utils";
import { claveFiltroResponsable } from "@/lib/reservas/responsable/filtro";
import { TEXTOS } from "@/lib/textos";
import { ListaReservasPantalla } from "./lista-reservas-pantalla";

const F = TEXTOS.reservas.responsable;
const YO = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const LETICIA = "22222222-2222-4222-8222-bbbbbbbbbbbb";

// kilroy y sinProducto son mías; revision la lleva Leticia; la 4ta no tiene responsable.
const conResponsables = listaReservas.map((f) =>
  f.id === IDS.kilroy || f.id === IDS.sinProducto
    ? { ...f, responsableId: YO, responsable: "Damián" }
    : f.id === IDS.revision
      ? { ...f, responsableId: LETICIA, responsable: "Leticia" }
      : { ...f, responsableId: null, responsable: null },
);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  equipo.cargarEquipo.mockResolvedValue({
    yo: YO,
    personas: [
      { id: YO, nombre: "Damián" },
      { id: LETICIA, nombre: "Leticia" },
    ],
  });
  consultas.cargarReservas.mockResolvedValue(conResponsables);
});

const idsVisibles = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((f) => f.getAttribute("data-id"))
    .sort();

async function abrir() {
  render(<ListaReservasPantalla />);
  await screen.findByRole("table");
  // Con el equipo cargado (quién soy), aparece "Mis reservas".
  await screen.findByRole("option", { name: F.mias });
  return screen.getByRole("combobox", { name: F.filtro });
}

describe("M3-06 fila 6 — el responsable en cada fila", () => {
  it("columna 'Responsable' con el nombre o 'Sin responsable'", async () => {
    await abrir();
    expect(screen.getByRole("columnheader", { name: new RegExp(F.columna) })).toBeInTheDocument();
    const fila = (id: string) => screen.getByRole("table").querySelector(`tr[data-id="${id}"]`) as HTMLElement;
    expect(within(fila(IDS.revision)).getByText("Leticia")).toBeInTheDocument();
    const sin = conResponsables.find((f) => f.responsableId === null)!;
    expect(within(fila(sin.id)).getByText(F.sin)).toBeInTheDocument();
  });
});

describe("M3-06 fila 7 — el filtro por operativo", () => {
  it("opciones: Todas (por defecto) · Mis reservas · Sin responsable · cada persona", async () => {
    const filtro = await abrir();
    expect(within(filtro).getAllByRole("option").map((o) => o.textContent)).toEqual([F.todas, F.mias, F.sin, "Leticia"]);
    expect((filtro as HTMLSelectElement).value).toBe("todas");
    expect(idsVisibles()).toHaveLength(4);
  });

  it("'Mis reservas' muestra solo las mías; 'Sin responsable' y una persona, las suyas", async () => {
    const filtro = await abrir();
    fireEvent.change(filtro, { target: { value: "mias" } });
    expect(idsVisibles()).toEqual([IDS.kilroy, IDS.sinProducto].sort());
    fireEvent.change(filtro, { target: { value: "sin" } });
    expect(idsVisibles()).toEqual(conResponsables.filter((f) => !f.responsableId).map((f) => f.id));
    fireEvent.change(filtro, { target: { value: `persona:${LETICIA}` } });
    expect(idsVisibles()).toEqual([IDS.revision]);
  });

  it("combinado con el buscador, filtra las dos cosas", async () => {
    const filtro = await abrir();
    fireEvent.change(filtro, { target: { value: "mias" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "juan ejemplo" } });
    expect(idsVisibles()).toEqual([IDS.kilroy]);
    // Lola Muñoz es de Leticia: con "Mis reservas", no aparece.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "munoz" } });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(F.sinCoincidencias)).toBeInTheDocument();
  });

  it("se recuerda por persona en el navegador", async () => {
    const filtro = await abrir();
    fireEvent.change(filtro, { target: { value: "mias" } });
    expect(window.localStorage.getItem(claveFiltroResponsable(YO))).toBe("mias");
  });

  it("al volver a entrar, arranca con lo que eligió esa persona", async () => {
    window.localStorage.setItem(claveFiltroResponsable(YO), `persona:${LETICIA}`);
    const filtro = await abrir();
    // El equipo (quién soy) llega aparte: el filtro guardado se aplica apenas se sabe.
    await waitFor(() => expect((filtro as HTMLSelectElement).value).toBe(`persona:${LETICIA}`));
    expect(idsVisibles()).toEqual([IDS.revision]);
  });
});
