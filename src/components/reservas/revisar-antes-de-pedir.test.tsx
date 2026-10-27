// @vitest-environment jsdom
//
// Spec M3-24 fila 5: arriba de todo en el detalle de la reserva, en amarillo, el bloque "Revisar
// antes de pedir" con los avisos del itinerario (blackouts, fechas especiales, buses). Sin avisos,
// no aparece. Avisa, no frena: el resto del detalle sigue igual.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(async () => new Map()),
  cargarRevision: vi.fn(async () => null),
}));
const itinerario = vi.hoisted(() => ({ avisosDelItinerario: vi.fn() }));
vi.mock("@/lib/reservas/consultas", () => consultas);
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-itinerario", () => itinerario);
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams(""),
}));

import { IDS, reservaKilroy } from "@/lib/reservas/fixtures.test-utils";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const AVISOS = [
  "Bodegas half Day (Mendoza) cae jueves 24 dic 2026, Navidad: confirmá con el proveedor que opera.",
  "Alta Montaña (Mendoza) cae viernes 25 dic 2026, Navidad: confirmá con el proveedor que opera.",
  "El bus Río Gallegos → Ushuaia cae martes 5 ene 2027; según la planilla sale lun/mié/vie.",
];

beforeEach(() => vi.clearAllMocks());

describe("M3-24 — Revisar antes de pedir, en el detalle", () => {
  it("con avisos: el bloque amarillo va arriba de todo, con cada aviso en una línea", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, estado: "recibida", dePrueba: true });
    itinerario.avisosDelItinerario.mockResolvedValue({ ok: true, avisos: AVISOS });
    const { container } = render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const bloque = await screen.findByTestId("revisar-antes-de-pedir");
    expect(itinerario.avisosDelItinerario).toHaveBeenCalledWith(IDS.kilroy);
    expect(within(bloque).getByText("Revisar antes de pedir")).toBeInTheDocument();
    expect(within(bloque).getAllByRole("listitem").map((li) => li.textContent)).toEqual(AVISOS);
    // Arriba de todo: antes del aviso de prueba y del encabezado de la reserva.
    const orden = [...container.querySelectorAll("[data-testid], [role='note']")].map((x) => x.getAttribute("data-testid") ?? "nota");
    expect(orden.indexOf("revisar-antes-de-pedir")).toBe(0);
    expect(bloque.closest("[role='status']")!.className).toMatch(/aviso_aviso/);
  });

  it("sin avisos, no aparece", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, estado: "recibida" });
    itinerario.avisosDelItinerario.mockResolvedValue({ ok: true, avisos: [] });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByTestId("encabezado-reserva");
    await vi.waitFor(() => expect(itinerario.avisosDelItinerario).toHaveBeenCalled());
    expect(screen.queryByTestId("revisar-antes-de-pedir")).toBeNull();
  });

  it("en una reserva confirmada no se calcula", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, estado: "confirmada" });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByTestId("encabezado-reserva");
    expect(itinerario.avisosDelItinerario).not.toHaveBeenCalled();
  });

  it("si no se pudo calcular, lo dice y deja reintentar", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...reservaKilroy, estado: "recibida" });
    itinerario.avisosDelItinerario.mockResolvedValueOnce({ ok: false, error: "x" }).mockResolvedValueOnce({ ok: true, avisos: AVISOS.slice(2) });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const error = await screen.findByTestId("revisar-antes-error");
    expect(error).toHaveTextContent("No pudimos revisar las fechas del itinerario.");
    fireEvent.click(within(error).getByRole("button", { name: "Revisar de nuevo" }));
    const bloque = await screen.findByTestId("revisar-antes-de-pedir");
    expect(within(bloque).getByText(AVISOS[2])).toBeInTheDocument();
  });
});
