// @vitest-environment jsdom
//
// Spec M3-03 filas 8 y 9: después de enviar, el detalle dice a qué proveedores
// se les escribió, cuándo y quién, con el historial ("<persona> envió N
// pedidos a: …") y la marca "pedido incompleto" si quedó alguno sin enviar.
// La lista lleva la misma marca.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams(),
}));

import { formatearFechaHora } from "@/lib/formato";
import { IDS, detalle } from "@/lib/reservas/fixtures.test-utils";
import { TEXTOS } from "@/lib/textos";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";
import { ListaReservasPantalla } from "./lista-reservas-pantalla";

const T = TEXTOS.reserva;
const EN = "2026-10-19T17:32:00.000Z";

const pedida = detalle({
  id: IDS.kilroy,
  estado: "pedido_a_proveedor",
  pedidoIncompleto: true,
  pedidos: [
    {
      id: "p1",
      proveedores: ["Cuenca del Plata"],
      destinatarios: ["reservas8@cuencadelplata.com"],
      estado: "enviado",
      enviadoEn: EN,
      enviadoPor: "Leticia Gómez",
      motivoFallo: null,
      sinDestinatario: null,
      reenvios: 0,
    },
    {
      id: "p2",
      proveedores: ["Aventura Sur"],
      destinatarios: [],
      estado: "borrador",
      enviadoEn: null,
      enviadoPor: null,
      motivoFallo: null,
      sinDestinatario: "Falta el mail de Aventura Sur",
      reenvios: 0,
    },
  ],
  envios: [
    { tipo: "envio_de_prueba", fecha: "2026-10-19T17:00:00.000Z", persona: "Leticia Gómez", cantidad: 1, proveedores: ["Cuenca del Plata"], destino: "ccalomarde@hitravel.com.ar", reenvio: false },
    { tipo: "pedidos_enviados", fecha: EN, persona: "Leticia Gómez", cantidad: 1, proveedores: ["Cuenca del Plata"], destino: null, reenvio: false },
  ],
});

beforeEach(() => vi.clearAllMocks());

describe("el detalle después de enviar (filas 8 y 9)", () => {
  it("a quién se le escribió, cuándo y quién; el historial; y 'pedido incompleto'", async () => {
    consultas.cargarReserva.mockResolvedValue(pedida);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const seccion = await screen.findByTestId("pedidos-reserva");
    expect(within(seccion).getByText("Cuenca del Plata")).toBeInTheDocument();
    expect(within(seccion).getByText(T.pedidoEstado.enviado(formatearFechaHora(EN), "Leticia Gómez"))).toBeInTheDocument();
    expect(within(seccion).getByText(T.pedidoEstado.sinMail)).toBeInTheDocument();
    const historial = within(seccion).getByTestId("historial-envios");
    expect(historial).toHaveTextContent(T.envioRegistrado("Leticia Gómez", 1, "Cuenca del Plata"));
    expect(historial).toHaveTextContent(T.envioDePrueba("Leticia Gómez", 1, "Cuenca del Plata", "ccalomarde@hitravel.com.ar"));
    const encabezado = screen.getByTestId("encabezado-reserva");
    expect(within(encabezado).getByText(TEXTOS.reservas.estados.pedido_a_proveedor)).toBeInTheDocument();
    expect(within(encabezado).getByText(TEXTOS.reservas.pedidoIncompleto)).toBeInTheDocument();
    // Desde el detalle se vuelve a los pedidos (para reintentar o completar).
    expect(screen.getByRole("link", { name: T.verPedidos })).toHaveAttribute("href", `/reservas/${IDS.kilroy}/pedidos`);
  });

  it("sin pedidos todavía, no hay sección; completa, sin la marca", async () => {
    consultas.cargarReserva.mockResolvedValue(detalle({ id: IDS.kilroy }));
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByTestId("encabezado-reserva");
    expect(screen.queryByTestId("pedidos-reserva")).toBeNull();
    expect(screen.queryByText(TEXTOS.reservas.pedidoIncompleto)).toBeNull();
  });

  it("la lista lleva la marca 'pedido incompleto'", async () => {
    consultas.cargarReservas.mockResolvedValue([pedida, detalle({ id: IDS.revision, estado: "pedido_a_proveedor", pedidoIncompleto: false })]);
    render(<ListaReservasPantalla />);
    expect(await screen.findAllByText(TEXTOS.reservas.pedidoIncompleto)).toHaveLength(1);
  });
});
