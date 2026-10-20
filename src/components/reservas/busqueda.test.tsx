// @vitest-environment jsdom
//
// Owner 2026-10-16: la lista busca por nombre de pasajero o por número de
// reserva de la agencia, sin distinguir mayúsculas ni acentos.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(async () => new Map()),
  cargarRevision: vi.fn(async () => null),
}));
vi.mock("@/lib/reservas/consultas", () => consultas);
// M3-08: la lista llega del servidor (server action); acá, de la consulta reemplazada. "Hoy" antes de los viajes de los fixtures: ninguno terminó.
vi.mock("@/app/(app)/reservas/acciones-lista", () => ({
  cargarLaListaDeReservas: async () => ({ filas: await consultas.cargarReservas({}), esAdmin: false, hoy: "2026-01-01", agencias: [] }),
}));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams("prueba=1"),
}));

import { IDS, listaReservas } from "@/lib/reservas/fixtures.test-utils";
import { ListaReservasPantalla } from "./lista-reservas-pantalla";

beforeEach(() => vi.clearAllMocks());

async function buscar(texto: string) {
  consultas.cargarReservas.mockResolvedValue(listaReservas);
  render(<ListaReservasPantalla />);
  const caja = await screen.findByRole("searchbox", { name: "Buscar por pasajero o número de reserva" });
  fireEvent.change(caja, { target: { value: texto } });
}

const idsVisibles = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((f) => f.getAttribute("data-id"));

describe("búsqueda en la lista de reservas", () => {
  it("por el nombre del pasajero, sin acentos ni mayúsculas: 'MUNOZ' encuentra a Lola Muñoz", async () => {
    await buscar("MUNOZ");
    expect(idsVisibles()).toEqual([IDS.revision]);
  });

  it("por un pasajero que no es el principal", async () => {
    await buscar("juan ejemplo");
    expect(idsVisibles()).toEqual([IDS.kilroy]);
  });

  it("por el número de la agencia, aun parcial", async () => {
    await buscar("dk1594100");
    expect(idsVisibles()).toEqual([IDS.revision]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "1377598" } });
    expect(idsVisibles()).toEqual([IDS.sinProducto]);
  });

  it("sin coincidencias: lo dice, y al borrar vuelven todas", async () => {
    await buscar("nadie");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Ninguna reserva coincide con «nadie».")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(idsVisibles()).toHaveLength(4);
  });
});
