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
// M3-08: la lista llega del servidor (server action); acá, de la consulta reemplazada. "Hoy" antes de los viajes de los fixtures: ninguno terminó.
vi.mock("@/app/(app)/reservas/acciones-lista", () => ({
  cargarLaListaDeReservas: async () => ({ filas: await consultas.cargarReservas({}), esAdmin: false, hoy: "2026-01-01", agencias: [] }),
}));
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
import { ListaReservasPantalla } from "./lista-reservas-pantalla";

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
    expect(within(tabla).getAllByText("Our Habitas Atacama").length).toBeGreaterThan(0);
    // M3-41: el Tayka que manda Journaway en el Overland no es su pick up: es el hotel de San Pedro.
    expect(within(tabla).queryByText(/Tayka del Desierto Hotel/)).toBeNull();
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

describe("una reserva de Journaway con varios productos (owner 2026-10-17)", () => {
  it("el detalle nombra todos: SPAP01 + SPAP03", async () => {
    consultas.cargarReserva.mockResolvedValue({ ...spap05, producto: producto("SPAP01", "Trip A"), otrosProductos: [producto("SPAP03", "Trip C")] });
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const seccion = await screen.findByTestId("producto-reserva");
    expect(seccion.textContent).toContain("SPAP01");
    expect(seccion.textContent).toContain("+ SPAP03");
  });

  it("la lista también: SPAP01 + SPAP03", async () => {
    consultas.cargarReservas.mockResolvedValue([
      { ...spap05, id: IDS.kilroy, producto: producto("SPAP01", "Trip A"), otrosProductos: [producto("SPAP03", "Trip C")] },
    ]);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    const fila = tabla.querySelector(`tr[data-id="${IDS.kilroy}"]`) as HTMLElement;
    expect(fila.textContent).toContain("SPAP01");
    expect(fila.textContent).toContain("+ SPAP03");
  });
});

describe("M3-38: el traslado San Pedro → Hito Cajón figura dentro del Overland", () => {
  const petzold: DetalleReserva = {
    ...spap05,
    fechaInicio: "2027-05-22",
    fechaFin: "2027-05-28",
    partes: [
      { orden: 5, tipo: "paquete", producto: producto("SPAE04", "El Tatio Geisers Tour (entrance fee)"), descripcion: null, fechaInicio: "2027-05-25", fechaFin: "2027-05-25", esTarea: false, pickUp: null },
      { orden: 6, tipo: "paquete", producto: producto("SPAT02", "Transfer San Pedro - Hito Cajon regular"), descripcion: null, fechaInicio: "2027-05-26", fechaFin: "2027-05-26", esTarea: false, pickUp: null },
      { orden: 7, tipo: "paquete", producto: producto("UYUO01", "Overland privado San Pedro – Uyuni en hoteles Tayka"), descripcion: null, fechaInicio: "2027-05-26", fechaFin: "2027-05-28", esTarea: false, pickUp: null },
    ],
  };

  it("SPAP05: sin línea suelta de SPAT02; el Overland dice que incluye el traslado regular del 26 may 2027", async () => {
    consultas.cargarReserva.mockResolvedValue(petzold);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const tabla = await screen.findByRole("table", { name: "Partes del tour" });
    expect(within(tabla).queryByText("SPAT02")).toBeNull();
    expect(within(tabla).getAllByRole("row")).toHaveLength(3);
    const overland = within(tabla).getByText("UYUO01").closest("tr")!;
    expect(overland).toHaveTextContent("incluye traslado regular San Pedro → Hito Cajón el 26 may 2027");
    expect(overland.textContent!.match(/\(incluye [^)]*\)/)![0]).not.toMatch(/privad/i);
  });
});

describe("M3-41: en el detalle, el pick up del Overland es el hotel de San Pedro", () => {
  const overland = async (reserva: DetalleReserva) => {
    consultas.cargarReserva.mockResolvedValue(reserva);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const tabla = await screen.findByRole("table", { name: "Partes del tour" });
    return within(tabla).getByText("UYUO01").closest("tr")!;
  };

  it("SPAP05 con las excursiones de San Pedro en Our Habitas: el Overland sale de Our Habitas, no del Tayka", async () => {
    const fila = await overland(spap05);
    expect(fila).toHaveTextContent("Our Habitas Atacama");
    expect(fila.lastElementChild!.textContent).not.toMatch(/tayka/i);
  });

  it("Petzold (sin hotel de San Pedro en el mail): a confirmar, lo informa Journaway, sin nombre de hotel", async () => {
    const petzold: DetalleReserva = {
      ...spap05,
      fechaInicio: "2027-05-22",
      fechaFin: "2027-05-28",
      hotelesAgencia: [],
      partes: [
        { orden: 5, tipo: "paquete", producto: producto("SPAE04", "El Tatio Geisers Tour (entrance fee)"), descripcion: null, fechaInicio: "2027-05-25", fechaFin: "2027-05-25", esTarea: false, pickUp: null },
        { orden: 7, tipo: "paquete", producto: producto("UYUO01", "Overland privado San Pedro – Uyuni en hoteles Tayka"), descripcion: null, fechaInicio: "2027-05-26", fechaFin: "2027-05-28", esTarea: false, pickUp: "Tayka del Desierto Hotel" },
      ],
    };
    const fila = await overland(petzold);
    expect(fila.lastElementChild).toHaveTextContent("hotel en San Pedro de Atacama a confirmar (lo informa Journaway)");
    expect(fila.lastElementChild!.textContent).not.toMatch(/tayka|habitas|don raul/i);
  });
});
