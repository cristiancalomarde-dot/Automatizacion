// @vitest-environment jsdom
//
// Owner 2026-10-16 (revisión del modo prueba, TourRadar 1363612): "no dice en
// ningún lado que sea cancelación". Una reserva cuyo mail es una cancelación
// dice CANCELACIÓN junto al estado en la lista y en el título del detalle.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(async () => new Map()),
  cargarRevision: vi.fn(async () => null),
}));
vi.mock("@/lib/reservas/consultas", () => consultas);
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams(""),
}));

import { IDS, listaReservas, reservaKilroy } from "@/lib/reservas/fixtures.test-utils";
import { ListaReservasPantalla } from "./lista-reservas-pantalla";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

beforeEach(() => vi.clearAllMocks());

describe("cancelación bien visible", () => {
  it("en la lista: la marca CANCELACIÓN junto al estado; las demás no la llevan", async () => {
    const filas = listaReservas.map((f) => (f.id === IDS.kilroy ? { ...f, cancelacion: true } : f));
    consultas.cargarReservas.mockResolvedValue(filas);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    const kilroy = tabla.querySelector(`tr[data-id="${IDS.kilroy}"]`) as HTMLElement;
    expect(within(kilroy).getByText("CANCELACIÓN")).toBeInTheDocument();
    const tour = tabla.querySelector(`tr[data-id="${IDS.tour}"]`) as HTMLElement;
    expect(within(tour).queryByText("CANCELACIÓN")).toBeNull();
  });

  it("en el detalle: el título dice CANCELACIÓN con el número de la agencia", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, cancelacion: true });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const titulo = await screen.findByRole("heading", { level: 1 });
    expect(titulo).toHaveTextContent("CANCELACIÓN");
    expect(titulo).toHaveTextContent("DK1531608");
  });

  it("una reserva que no es cancelación no lo dice", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, cancelacion: false });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const titulo = await screen.findByRole("heading", { level: 1 });
    expect(titulo).not.toHaveTextContent("CANCELACIÓN");
  });
});
