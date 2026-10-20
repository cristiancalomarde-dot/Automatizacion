// @vitest-environment jsdom
//
// Spec M3-08 (pantalla): "Ordenar por" (por defecto inicio del viaje), todas
// las vigentes juntas, filtros de agencia y fechas, la vista "Viajes
// terminados" solo para administradoras, el recuerdo por persona, el
// contador y el vacío con "Limpiar filtros". La lista llega del servidor
// (la server action se reemplaza acá; la integración prueba la de verdad).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ListaDeReservas } from "@/lib/reservas/lista/cargar-lista";

const accion = vi.hoisted(() => ({ cargarLaListaDeReservas: vi.fn() }));
const equipo = vi.hoisted(() => ({ cargarEquipo: vi.fn() }));
vi.mock("@/app/(app)/reservas/acciones-lista", () => accion);
vi.mock("@/lib/reservas/consultas", () => ({ cargarRevisiones: vi.fn(async () => new Map()) }));
vi.mock("@/lib/usuarios/equipo", () => equipo);
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams(""),
}));

import { listaReservas } from "@/lib/reservas/fixtures.test-utils";
import { claveEleccionLista } from "@/lib/reservas/lista/filtros";
import type { FilaReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { ListaReservasPantalla } from "./lista-reservas-pantalla";

const L = TEXTOS.reservas.lista;
const YO = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const HOY = "2026-10-20";
const AGENCIAS = ["Journaway", "Jysk", "Kilroy", "TourRadar"];

const base = listaReservas[0];
const r = (id: string, extra: Partial<FilaReserva>): FilaReserva => ({ ...base, id, numero: id, dePrueba: false, ...extra });

const VIGENTES = [
  r("nov-confirmada", { estado: "confirmada", agencia: "Kilroy", fechaInicio: "2026-11-05", fechaFin: "2026-11-09", llego: "2026-10-03T10:00:00Z" }),
  r("oct-pendiente", { estado: "recibida", agencia: "Journaway", fechaInicio: "2026-10-25", fechaFin: "2026-10-30", llego: "2026-10-01T10:00:00Z" }),
  r("cruza-marzo", { estado: "pedido_a_proveedor", agencia: "TourRadar", fechaInicio: "2027-02-26", fechaFin: "2027-03-02", llego: "2026-10-05T10:00:00Z" }),
  r("sin-fecha", { estado: "para_revision", agencia: "Kilroy", fechaInicio: null, fechaFin: null, llego: "2026-10-06T10:00:00Z" }),
  r("descartada", { estado: "descartada", agencia: "Kilroy", fechaInicio: "2026-11-01", fechaFin: "2026-11-02", llego: "2026-10-02T10:00:00Z" }),
];
const TERMINADAS = [
  r("term-marzo", { estado: "confirmada", agencia: "Kilroy", fechaInicio: "2026-03-01", fechaFin: "2026-03-05" }),
  r("term-reciente", { estado: "confirmada", agencia: "TourRadar", fechaInicio: "2026-10-10", fechaFin: "2026-10-19" }),
];

function servidor(esAdmin: boolean): ListaDeReservas {
  // Como el de verdad: a un operador no le llegan las terminadas.
  return { filas: esAdmin ? [...VIGENTES, ...TERMINADAS] : VIGENTES, esAdmin, hoy: HOY, agencias: AGENCIAS };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  equipo.cargarEquipo.mockResolvedValue({ yo: YO, personas: [{ id: YO, nombre: "Damián" }] });
  accion.cargarLaListaDeReservas.mockResolvedValue(servidor(false));
});

const filas = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((f) => f.getAttribute("data-id"));

const combo = (nombre: string) => screen.getByRole("combobox", { name: nombre }) as HTMLSelectElement;

async function abrir() {
  render(<ListaReservasPantalla />);
  await screen.findByRole("table");
  await screen.findByRole("option", { name: TEXTOS.reservas.responsable.mias });
}

describe("M3-08 fila 1 — Ordenar por", () => {
  it("por defecto inicio del viaje, las próximas primero y las sin fecha al final", async () => {
    await abrir();
    expect(combo(L.ordenar).value).toBe("inicio");
    expect(within(combo(L.ordenar)).getAllByRole("option").map((o) => o.textContent)).toEqual([
      L.ordenes.inicio,
      L.ordenes.fin,
      L.ordenes.llegada,
    ]);
    expect(filas()).toEqual(["oct-pendiente", "nov-confirmada", "cruza-marzo", "sin-fecha"]);
  });

  it("cambiar el orden reordena", async () => {
    await abrir();
    fireEvent.change(combo(L.ordenar), { target: { value: "llegada" } });
    expect(filas()).toEqual(["sin-fecha", "cruza-marzo", "nov-confirmada", "oct-pendiente"]);
  });
});

describe("M3-08 fila 2 — todas las vigentes juntas", () => {
  it("una confirmada y una pendiente juntas, sin las descartadas; el filtro de estado sigue", async () => {
    await abrir();
    expect(filas()).toContain("nov-confirmada");
    expect(filas()).toContain("oct-pendiente");
    expect(filas()).not.toContain("descartada");
    fireEvent.change(combo(L.estado), { target: { value: "confirmada" } });
    expect(filas()).toEqual(["nov-confirmada"]);
    fireEvent.change(combo(L.estado), { target: { value: "descartada" } });
    expect(filas()).toEqual(["descartada"]);
  });
});

describe("M3-08 fila 3 — Agencia", () => {
  it("Todas y las de data/agencias.csv; filtra", async () => {
    await abrir();
    expect(within(combo(L.agencia)).getAllByRole("option").map((o) => o.textContent)).toEqual([L.todasAgencias, ...AGENCIAS]);
    fireEvent.change(combo(L.agencia), { target: { value: "Journaway" } });
    expect(filas()).toEqual(["oct-pendiente"]);
  });
});

describe("M3-08 fila 4 — Fechas del viaje", () => {
  it("próximos 7 días y 'Viajan en' un mes (con los que cruzan de mes)", async () => {
    await abrir();
    fireEvent.change(combo(L.fechas), { target: { value: "7" } });
    expect(filas()).toEqual(["oct-pendiente"]);
    fireEvent.change(combo(L.fechas), { target: { value: "30" } });
    expect(filas()).toEqual(["oct-pendiente", "nov-confirmada"]);
    fireEvent.change(combo(L.fechas), { target: { value: "mes" } });
    const mes = screen.getByLabelText(L.mes) as HTMLInputElement;
    expect(mes.value).toBe("2026-10");
    expect(filas()).toEqual(["oct-pendiente"]);
    fireEvent.change(mes, { target: { value: "2027-03" } });
    expect(filas()).toEqual(["cruza-marzo"]);
  });
});

describe("M3-08 filas 5 y 6 — viajes terminados", () => {
  it("un operador no tiene el filtro (y la lista no las trae)", async () => {
    await abrir();
    expect(screen.queryByRole("combobox", { name: L.vista })).toBeNull();
    expect(screen.queryByRole("option", { name: L.terminadas })).toBeNull();
    expect(filas()).not.toContain("term-marzo");
  });

  it("una administradora: por defecto no las ve; con 'Viajes terminados', solo esas por fin (más recientes primero)", async () => {
    accion.cargarLaListaDeReservas.mockResolvedValue(servidor(true));
    await abrir();
    expect(filas()).not.toContain("term-marzo");
    fireEvent.change(combo(L.vista), { target: { value: "terminadas" } });
    expect(filas()).toEqual(["term-reciente", "term-marzo"]);
    fireEvent.change(combo(L.agencia), { target: { value: "Kilroy" } });
    expect(filas()).toEqual(["term-marzo"]);
    fireEvent.change(combo(L.agencia), { target: { value: "todas" } });
    fireEvent.change(combo(L.fechas), { target: { value: "mes" } });
    fireEvent.change(screen.getByLabelText(L.mes), { target: { value: "2026-03" } });
    expect(filas()).toEqual(["term-marzo"]);
  });
});

describe("M3-08 fila 7 — se recuerda por persona", () => {
  it("lo elegido se guarda y al volver arranca con eso", async () => {
    await abrir();
    fireEvent.change(combo(L.ordenar), { target: { value: "fin" } });
    fireEvent.change(combo(L.agencia), { target: { value: "Kilroy" } });
    const guardado = JSON.parse(window.localStorage.getItem(claveEleccionLista(YO)) ?? "{}");
    expect(guardado).toMatchObject({ orden: "fin", agencia: "Kilroy" });

    screen.getByRole("table").remove();
    document.body.innerHTML = "";
    await abrir();
    await waitFor(() => expect(combo(L.agencia).value).toBe("Kilroy"));
    expect(combo(L.ordenar).value).toBe("fin");
    expect(filas()).toEqual(["nov-confirmada", "sin-fecha"]);
  });
});

describe("M3-08 fila 8 y §4 — contador y vacío", () => {
  it("'Mostrando N reservas' según los filtros", async () => {
    await abrir();
    expect(screen.getByText(L.mostrando(4))).toBeInTheDocument();
    fireEvent.change(combo(L.agencia), { target: { value: "Kilroy" } });
    expect(screen.getByText(L.mostrando(2))).toBeInTheDocument();
  });

  it("sin resultados: 'No hay reservas con estos filtros' y 'Limpiar filtros' vuelve a todas", async () => {
    await abrir();
    fireEvent.change(combo(L.agencia), { target: { value: "Jysk" } });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(L.vacio)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: L.limpiar }));
    expect(combo(L.agencia).value).toBe("todas");
    expect(filas()).toHaveLength(4);
  });
});
