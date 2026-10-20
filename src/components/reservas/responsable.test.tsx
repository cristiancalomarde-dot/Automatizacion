// @vitest-environment jsdom
//
// Spec M3-06 filas 4, 5, 6 y 8 (y §4): en el detalle, "Responsable: <nombre>"
// o "Sin responsable", "Tomar esta reserva" (con la pregunta si ya la lleva
// otro), "Pasarla a otro" con la lista del equipo, los estados y el historial.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(async () => new Map()),
  cargarRevision: vi.fn(async () => null),
}));
const equipo = vi.hoisted(() => ({ cargarEquipo: vi.fn() }));
const acciones = vi.hoisted(() => ({ tomarEstaReserva: vi.fn(), pasarlaAOtro: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-producto", () => ({ confirmarProductoDeReserva: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-responsable", () => acciones);
vi.mock("@/lib/reservas/consultas", () => consultas);
vi.mock("@/lib/usuarios/equipo", () => equipo);
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/reservas" }));

import { detalle } from "@/lib/reservas/fixtures.test-utils";
import { TEXTOS } from "@/lib/textos";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const T = TEXTOS.reserva.responsable;
const ID = "77777777-7777-4777-8777-777777777777";
const YO = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const LETICIA = "22222222-2222-4222-8222-bbbbbbbbbbbb";
const PABLO = "33333333-3333-4333-8333-cccccccccccc";

beforeEach(() => {
  vi.clearAllMocks();
  equipo.cargarEquipo.mockResolvedValue({
    yo: YO,
    personas: [
      { id: YO, nombre: "Damián" },
      { id: LETICIA, nombre: "Leticia" },
      { id: PABLO, nombre: "Pablo" },
    ],
  });
});

async function abrir(extra = {}) {
  consultas.cargarReserva.mockResolvedValue(detalle({ id: ID, ...extra }));
  render(<DetalleReservaPantalla id={ID} />);
  return screen.findByRole("region", { name: T.titulo });
}

describe("M3-06 fila 6 — se ve quién la lleva", () => {
  it("sin responsable: 'Sin responsable'", async () => {
    const zona = await abrir({ responsableId: null, responsable: null });
    expect(within(zona).getByText(T.sinResponsable)).toBeInTheDocument();
  });

  it("con responsable: 'Responsable: <nombre>'", async () => {
    const zona = await abrir({ responsableId: LETICIA, responsable: "Leticia" });
    expect(within(zona).getByText(T.etiqueta("Leticia"))).toBeInTheDocument();
  });
});

describe("M3-06 fila 4 — Tomar esta reserva", () => {
  it("sin responsable previo: la toma directo, con 'Guardando…' y 'Listo', y vuelve a leer la reserva", async () => {
    let terminar: (v: unknown) => void = () => {};
    acciones.tomarEstaReserva.mockReturnValue(new Promise((r) => (terminar = r)));
    const zona = await abrir({ responsableId: null, responsable: null });

    fireEvent.click(within(zona).getByRole("button", { name: T.tomar }));
    expect(acciones.tomarEstaReserva).toHaveBeenCalledWith({ reservaId: ID, esperado: null });
    expect(await within(zona).findByText(T.guardando)).toBeInTheDocument();

    consultas.cargarReserva.mockResolvedValue(detalle({ id: ID, responsableId: YO, responsable: "Damián" }));
    terminar({ ok: true, responsableId: YO, responsable: "Damián" });
    expect(await screen.findByText(T.listoTomada)).toBeInTheDocument();
    await waitFor(() => expect(consultas.cargarReserva).toHaveBeenCalledTimes(2));
  });

  it("si la lleva otro: pregunta 'La lleva <nombre>. ¿La tomás vos?' y solo con el sí la toma", async () => {
    acciones.tomarEstaReserva.mockResolvedValue({ ok: true, responsableId: YO, responsable: "Damián" });
    const zona = await abrir({ responsableId: LETICIA, responsable: "Leticia" });

    fireEvent.click(within(zona).getByRole("button", { name: T.tomar }));
    const pregunta = within(zona).getByRole("group", { name: T.dialogoTomar });
    expect(pregunta).toHaveTextContent(T.preguntaTomar("Leticia"));
    expect(acciones.tomarEstaReserva).not.toHaveBeenCalled();

    fireEvent.click(within(pregunta).getByRole("button", { name: T.cancelar }));
    expect(within(zona).queryByRole("group", { name: T.dialogoTomar })).toBeNull();
    expect(acciones.tomarEstaReserva).not.toHaveBeenCalled();

    fireEvent.click(within(zona).getByRole("button", { name: T.tomar }));
    fireEvent.click(within(zona).getByRole("button", { name: T.siTomar }));
    await waitFor(() => expect(acciones.tomarEstaReserva).toHaveBeenCalledWith({ reservaId: ID, esperado: LETICIA }));
  });

  it("si ya es mía, no ofrece tomarla", async () => {
    const zona = await abrir({ responsableId: YO, responsable: "Damián" });
    // Quién soy llega con el equipo.
    await waitFor(() => expect(within(zona).queryByRole("button", { name: T.tomar })).toBeNull());
    expect(within(zona).getByRole("button", { name: T.pasar })).toBeInTheDocument();
  });

  it("si falla: 'No se pudo guardar: <motivo>' con 'Reintentar', que vuelve a mandar lo mismo", async () => {
    acciones.tomarEstaReserva.mockResolvedValueOnce({ ok: false, error: T.error(T.motivos.conexion) });
    acciones.tomarEstaReserva.mockResolvedValueOnce({ ok: true, responsableId: YO, responsable: "Damián" });
    const zona = await abrir({ responsableId: null, responsable: null });

    fireEvent.click(within(zona).getByRole("button", { name: T.tomar }));
    expect(await within(zona).findByText(T.error(T.motivos.conexion))).toBeInTheDocument();
    fireEvent.click(within(zona).getByRole("button", { name: T.reintentar }));
    expect(await screen.findByText(T.listoTomada)).toBeInTheDocument();
    expect(acciones.tomarEstaReserva).toHaveBeenNthCalledWith(2, { reservaId: ID, esperado: null });
  });
});

describe("M3-06 fila 5 — Pasarla a otro", () => {
  it("elige de la lista del equipo (sin quien ya la lleva) y se la pasa", async () => {
    acciones.pasarlaAOtro.mockResolvedValue({ ok: true, responsableId: PABLO, responsable: "Pablo" });
    const zona = await abrir({ responsableId: LETICIA, responsable: "Leticia" });

    fireEvent.click(within(zona).getByRole("button", { name: T.pasar }));
    const lista = within(zona).getByRole("combobox", { name: T.aQuien });
    expect(within(lista).getAllByRole("option").map((o) => o.textContent)).toEqual([T.elegir, "Damián", "Pablo"]);
    fireEvent.change(lista, { target: { value: PABLO } });
    fireEvent.click(within(zona).getByRole("button", { name: T.pasarA("Pablo") }));

    await waitFor(() => expect(acciones.pasarlaAOtro).toHaveBeenCalledWith({ reservaId: ID, a: PABLO, esperado: LETICIA }));
    expect(await screen.findByText(T.listoPasada("Pablo"))).toBeInTheDocument();
  });
});

describe("M3-06 fila 8 — el historial del responsable", () => {
  it("'tomó la reserva', 'se la pasó a' y 'envió los primeros pedidos'", async () => {
    const zona = await abrir({
      responsableId: PABLO,
      responsable: "Pablo",
      responsables: [
        { tipo: "envio", fecha: "2026-10-20T10:00:00.000Z", persona: "Leticia", responsable: "Leticia" },
        { tipo: "tomada", fecha: "2026-10-20T11:00:00.000Z", persona: "Damián", responsable: "Damián" },
        { tipo: "pasada", fecha: "2026-10-20T12:00:00.000Z", persona: "Damián", responsable: "Pablo" },
      ],
    });
    const historial = within(zona).getByRole("list", { name: T.historial });
    const lineas = within(historial).getAllByRole("listitem").map((li) => li.textContent);
    expect(lineas[0]).toContain(T.historialEnvio("Leticia"));
    expect(lineas[1]).toContain(T.historialTomo("Damián"));
    expect(lineas[2]).toContain(T.historialPaso("Damián", "Pablo"));
  });
});
