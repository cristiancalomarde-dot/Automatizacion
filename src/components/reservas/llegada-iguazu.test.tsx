// @vitest-environment jsdom
//
// Owner 2026-10-14: Iguazú (OD010A–D) sin vuelo ni bus de llegada queda
// "recibida" con un aviso visible, en la lista y en el detalle. Owner
// 2026-10-16: la marca es la misma que la del vuelo que falta ("falta dato de llegada").
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

const AVISO = "Falta el vuelo o bus de llegada a Iguazú: pasárselo a Cuenca del Plata cuando llegue.";

beforeEach(() => vi.clearAllMocks());

describe("Iguazú sin dato de llegada", () => {
  it("en la lista: la recibida lleva la marca escrita; las demás no", async () => {
    const filas = listaReservas.map((f) => (f.id === IDS.kilroy ? { ...f, sinDatoLlegada: true } : f));
    consultas.cargarReservas.mockResolvedValue(filas);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    const kilroy = tabla.querySelector(`tr[data-id="${IDS.kilroy}"]`) as HTMLElement;
    expect(within(kilroy).getByText("falta dato de llegada")).toBeInTheDocument();
    expect(within(kilroy).getByText(AVISO)).toBeInTheDocument();
    expect(within(kilroy).getByText("recibida")).toBeInTheDocument();
    const tour = tabla.querySelector(`tr[data-id="${IDS.tour}"]`) as HTMLElement;
    expect(within(tour).queryByText("falta dato de llegada")).toBeNull();
  });

  it("en el detalle: el aviso con qué hacer, y no es un motivo de revisión", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, sinDatoLlegada: true });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const aviso = await screen.findByTestId("avisos-vuelo");
    expect(within(aviso).getByText(AVISO)).toBeInTheDocument();
    expect(screen.queryByTestId("motivos-revision")).toBeNull();
  });

  it("con el dato (o en otro producto), sin aviso", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, sinDatoLlegada: false });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByTestId("encabezado-reserva");
    expect(screen.queryByText(AVISO)).toBeNull();
  });
});
