// @vitest-environment jsdom
//
// Spec M2-09 §4: el detalle de una reserva de Journaway suma lo que reserva
// Journaway (no se pide), el pick up de cada tour, el número de viaje (o que
// no vino) y las notas. En las demás agencias nada de eso aparece.
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

import { IDS, reservaKilroy } from "@/lib/reservas/fixtures.test-utils";
import type { DetalleReserva } from "@/lib/reservas/tipos";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const producto = (codigo: string, nombre: string) => ({ id: `id-${codigo}`, codigo, nombre });

const spap05: DetalleReserva = {
  ...reservaKilroy,
  agencia: "Journaway",
  numero: null,
  producto: producto("SPAP05", "Trip D Option 1) San Pedro de Atacama + Uyuni Salt Flats in Tayka Hotels 7N/8D"),
  pasajeros: ["Karl Mustermann", "Erika Beispiel"],
  fechaInicio: "2026-10-11",
  fechaFin: "2026-10-17",
  partes: [
    { orden: 1, tipo: "paquete", producto: producto("SPAT01", "Regular shuttle"), descripcion: null, fechaInicio: "2026-10-11", fechaFin: "2026-10-11", esTarea: false, pickUp: null },
    {
      orden: 2,
      tipo: "paquete",
      producto: producto("SPAE01", "Astrophotography Tour"),
      descripcion: null,
      textoAgencia: "San Pedro de Atacama: Astronomy Tour in the Atacama Desert",
      fechaInicio: "2026-10-11",
      fechaFin: "2026-10-11",
      esTarea: false,
      pickUp: "Our Habitas Atacama",
    },
    {
      orden: 3,
      tipo: "paquete",
      producto: producto("UYUO01", "Overland privado"),
      descripcion: null,
      fechaInicio: "2026-10-15",
      fechaFin: "2026-10-17",
      esTarea: false,
      pickUp: "Tayka del Desierto Hotel / Tayka del Sal Hotel",
    },
  ],
  hotelesAgencia: [
    { nombre: "Hub Providencia", desde: "2026-10-07", hasta: "2026-10-09" },
    { nombre: "Our Habitas Atacama", desde: "2026-10-11", hasta: "2026-10-15" },
  ],
  tripNumber: null,
  contactoCliente: { nombre: "Karl Mustermann", email: "karl.mustermann@example.de", telefono: "+49 151 0000003" },
  notas: ["Trae adjuntos: pasaportes (no se leen)"],
};

beforeEach(() => vi.clearAllMocks());

describe("detalle de una reserva de Journaway (spec M2-09 §4)", () => {
  it("los hoteles de Journaway en su sección, aparte de lo que se pide", async () => {
    consultas.cargarReserva.mockResolvedValue(spap05);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const seccion = await screen.findByTestId("hoteles-agencia");
    expect(within(seccion).getByText("Lo que reserva Journaway (no se pide)")).toBeInTheDocument();
    expect(within(seccion).getByText("Hub Providencia")).toBeInTheDocument();
    expect(within(seccion).getAllByRole("row")).toHaveLength(3);
  });

  it("el pick up al lado de cada tour, y el nombre con que lo mandó Journaway", async () => {
    consultas.cargarReserva.mockResolvedValue(spap05);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const tabla = await screen.findByRole("table", { name: "Partes del tour" });
    expect(within(tabla).getByText("Pick up / drop off")).toBeInTheDocument();
    expect(within(tabla).getByText("Our Habitas Atacama")).toBeInTheDocument();
    expect(within(tabla).getByText("Tayka del Desierto Hotel / Tayka del Sal Hotel")).toBeInTheDocument();
    expect(within(tabla).getByText(/Astronomy Tour in the Atacama Desert/)).toBeInTheDocument();
  });

  it("sin número: 'Journaway no mandó número de viaje' y la referencia es el pasajero principal + la fecha", async () => {
    consultas.cargarReserva.mockResolvedValue(spap05);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const encabezado = await screen.findByTestId("encabezado-reserva");
    expect(within(encabezado).getByText("Journaway no mandó número de viaje")).toBeInTheDocument();
    expect(within(encabezado).getByRole("heading", { level: 1 })).toHaveTextContent("Karl Mustermann · 11/10/2026");
  });

  it("con Trip Number, se muestra", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...spap05, numero: "Trip 62992", tripNumber: "62992" });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const encabezado = await screen.findByTestId("encabezado-reserva");
    expect(within(encabezado).getByText("62992")).toBeInTheDocument();
    expect(within(encabezado).queryByText("Journaway no mandó número de viaje")).toBeNull();
  });

  it("las notas y el contacto del cliente", async () => {
    consultas.cargarReserva.mockResolvedValue(spap05);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const notas = await screen.findByTestId("notas-reserva");
    expect(within(notas).getByText("Trae adjuntos: pasaportes (no se leen)")).toBeInTheDocument();
    const datos = screen.getByTestId("datos-reserva");
    expect(within(datos).getByText(/karl.mustermann@example.de/)).toBeInTheDocument();
  });

  it("una reserva de Kilroy no muestra nada de esto (sin cajas vacías)", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByTestId("encabezado-reserva");
    expect(screen.queryByTestId("hoteles-agencia")).toBeNull();
    expect(screen.queryByTestId("notas-reserva")).toBeNull();
    expect(screen.queryByText("Journaway no mandó número de viaje")).toBeNull();
    expect(screen.queryByText("Pick up / drop off")).toBeNull();
  });

  it("con todos los hoteles de Journaway y ninguno listado, la sección no aparece", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...spap05, hotelesAgencia: [] });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByTestId("encabezado-reserva");
    expect(screen.queryByTestId("hoteles-agencia")).toBeNull();
  });
});
