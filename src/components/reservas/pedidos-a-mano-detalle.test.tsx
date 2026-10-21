// @vitest-environment jsdom
//
// Spec M3-09 filas 7 y 9 en el detalle de la reserva: el historial "<persona>
// agregó un pedido a mano a …" / "<persona> sacó el pedido a mano a …", la
// etiqueta "A mano" en la tabla de pedidos, y que uno a mano sin enviar no
// pinta la fila como pendiente.
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

import { IDS, detalle } from "@/lib/reservas/fixtures.test-utils";
import { TEXTOS } from "@/lib/textos";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const A = TEXTOS.pedidos.aMano;

beforeEach(() => vi.clearAllMocks());

describe("pedidos a mano en el detalle (filas 7 y 9)", () => {
  it("el historial con quién y a quién; la etiqueta 'A mano'", async () => {
    consultas.cargarReserva.mockResolvedValue(
      detalle({
        id: IDS.kilroy,
        estado: "pedido_a_proveedor",
        pedidoIncompleto: false,
        pedidos: [
          {
            id: "p1",
            proveedores: ["Hospedaje Magallanes"],
            destinatarios: ["reservas@hospedaje.test"],
            estado: "borrador",
            enviadoEn: null,
            enviadoPor: null,
            motivoFallo: null,
            sinDestinatario: null,
            reenvios: 0,
            aMano: true,
          },
        ],
        envios: [],
        pedidosAMano: [
          { tipo: "agregado", fecha: "2026-10-20T21:40:00.000Z", persona: "Leticia Gómez", a: "Hospedaje Magallanes" },
          { tipo: "agregado", fecha: "2026-10-20T21:41:00.000Z", persona: "Leticia Gómez", a: "x@hotel.test" },
          { tipo: "sacado", fecha: "2026-10-20T21:42:00.000Z", persona: "Damián", a: "x@hotel.test" },
        ],
      }),
    );
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const seccion = await screen.findByTestId("pedidos-reserva");
    const fila = within(seccion).getByText("Hospedaje Magallanes").closest("tr")!;
    expect(within(fila).getByText(A.etiqueta)).toBeInTheDocument();
    const historial = within(seccion).getByTestId("historial-a-mano");
    expect(historial).toHaveTextContent(A.historialAgrego("Leticia Gómez", "Hospedaje Magallanes"));
    expect(historial).toHaveTextContent(A.historialAgrego("Leticia Gómez", "x@hotel.test"));
    expect(historial).toHaveTextContent(A.historialSaco("Damián", "x@hotel.test"));
    expect(within(screen.getByTestId("encabezado-reserva")).queryByText(TEXTOS.reservas.pedidoIncompleto)).toBeNull();
  });

  it("aunque ya no quede ningún pedido, el historial de lo sacado se ve", async () => {
    consultas.cargarReserva.mockResolvedValue(
      detalle({
        id: IDS.kilroy,
        pedidos: [],
        envios: [],
        pedidosAMano: [{ tipo: "sacado", fecha: "2026-10-20T21:42:00.000Z", persona: "Damián", a: "x@hotel.test" }],
      }),
    );
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const seccion = await screen.findByTestId("pedidos-reserva");
    expect(within(seccion).getByTestId("historial-a-mano")).toHaveTextContent(A.historialSaco("Damián", "x@hotel.test"));
  });
});
