// @vitest-environment jsdom
//
// Spec M3-02 fila 1: "Armar pedidos a proveedores" en el detalle solo con la
// reserva recibida; en "para revisión" se ve deshabilitado con el porqué.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(async () => new Map()),
  cargarRevision: vi.fn(async () => null),
}));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("@/lib/reservas/consultas", () => consultas);
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/reservas" }));

import { IDS, detalle, reservaKilroy, reservaRevision } from "@/lib/reservas/fixtures.test-utils";
import { TEXTOS } from "@/lib/textos";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const T = TEXTOS.reserva;

beforeEach(() => vi.clearAllMocks());

describe("Armar pedidos a proveedores (spec M3-02 fila 1)", () => {
  it("con la reserva recibida lleva a la pantalla de pedidos", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const enlace = await screen.findByRole("link", { name: T.armarPedidos });
    expect(enlace).toHaveAttribute("href", `/reservas/${IDS.kilroy}/pedidos`);
  });

  it("para revisión: deshabilitado, con 'Resolvé primero lo que está para revisión'", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaRevision);
    render(<DetalleReservaPantalla id={reservaRevision.id} />);
    const boton = await screen.findByRole("button", { name: T.armarPedidos });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(T.resolverPrimero);
    expect(screen.queryByRole("link", { name: T.armarPedidos })).toBeNull();
  });

  it("en otro estado no aparece", async () => {
    consultas.cargarReserva.mockResolvedValue(detalle({ id: IDS.kilroy, estado: "descartada" }));
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByTestId("encabezado-reserva");
    expect(screen.queryByText(T.armarPedidos)).toBeNull();
  });
});
