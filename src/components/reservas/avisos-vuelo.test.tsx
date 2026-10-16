// @vitest-environment jsdom
//
// Owner 2026-10-16: "falta el vuelo" deja de mandar a revisión. La reserva
// queda "recibida" con un aviso concreto, visible en la lista y en el detalle.
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

const AVISO = "Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030";

beforeEach(() => vi.clearAllMocks());

describe("falta el vuelo: aviso, no revisión", () => {
  it("en la lista: la reserva recibida lleva la marca 'falta el vuelo' y el aviso concreto; las demás no", async () => {
    const filas = listaReservas.map((f) => (f.id === IDS.tour ? { ...f, avisosVuelo: [AVISO] } : f));
    consultas.cargarReservas.mockResolvedValue(filas);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    const tour = tabla.querySelector(`tr[data-id="${IDS.tour}"]`) as HTMLElement;
    expect(within(tour).getByText("recibida")).toBeInTheDocument();
    expect(within(tour).getByText("falta el vuelo")).toBeInTheDocument();
    expect(within(tour).getByText(AVISO)).toBeInTheDocument();
    // No es "para revisión": la fila no lleva la franja de atención.
    expect(tour.getAttribute("data-atencion")).toBeNull();
    const kilroy = tabla.querySelector(`tr[data-id="${IDS.kilroy}"]`) as HTMLElement;
    expect(within(kilroy).queryByText("falta el vuelo")).toBeNull();
  });

  it("en el detalle: el aviso concreto, y no es un motivo de revisión", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, avisosVuelo: [AVISO] });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const aviso = await screen.findByTestId("avisos-vuelo");
    expect(within(aviso).getByText(AVISO)).toBeInTheDocument();
    expect(within(aviso).getByText("Lo demás se puede pedir ya; el traslado espera el dato del vuelo.")).toBeInTheDocument();
    expect(screen.queryByTestId("motivos-revision")).toBeNull();
  });

  it("sin vuelos pendientes, sin aviso", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, avisosVuelo: [] });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByTestId("encabezado-reserva");
    expect(screen.queryByTestId("avisos-vuelo")).toBeNull();
  });
});
