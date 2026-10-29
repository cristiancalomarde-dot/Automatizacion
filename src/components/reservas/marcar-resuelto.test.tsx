// @vitest-environment jsdom
//
// Spec M3-39 filas 1, 2 y 4: "Marcar como resuelto" en cada motivo de
// revisión del detalle, con nota obligatoria. La server action está simulada;
// la de verdad se prueba en la integración y en el recorrido (V2 y V3).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(async () => new Map()),
  cargarRevision: vi.fn(async () => null),
}));
const acciones = vi.hoisted(() => ({
  corregirVuelosDeReserva: vi.fn(),
  marcarDatoRevisado: vi.fn(),
  corregirDatoDeReserva: vi.fn(),
  marcarMotivoResuelto: vi.fn(),
}));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-producto", () => ({ confirmarProductoDeReserva: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-responsable", () => ({ tomarEstaReserva: vi.fn(), pasarlaAOtro: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-corregir", () => acciones);
vi.mock("@/lib/reservas/consultas", () => consultas);
vi.mock("@/lib/usuarios/equipo", () => ({ cargarEquipo: vi.fn(async () => ({ yo: null, personas: [] })) }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/reservas" }));

import { versionParaCorregir } from "@/lib/reservas/corregir/decidir";
import { MOTIVOS_EMPAREJADO as M } from "@/lib/reservas/emparejar/motivos";
import { detalle } from "@/lib/reservas/fixtures.test-utils";
import { MOTIVOS_INTERCAMBIO as MI } from "@/lib/reservas/intercambio";
import { MOTIVOS_JOURNAWAY as J } from "@/lib/reservas/journaway/motivos";
import type { DetalleReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const T = TEXTOS.reserva.corregir;
const GENERICO = TEXTOS.reserva.motivos.generico;
const DUPLICADA = TEXTOS.reserva.motivos.posible_duplicada;
const ID = "77777777-7777-4777-8777-777777777739";
const NIGHT_BUS = J.noEsParte("Night Bus Peru", "2027-05-31", "2027-06-01", "SPAP05");
const NOTA = "Journaway confirmó que era un error";

const reserva = (extra: Partial<DetalleReserva> = {}) => detalle({ id: ID, estado: "para_revision", motivos: [NIGHT_BUS], ...extra });

beforeEach(() => {
  vi.clearAllMocks();
});

async function abrir(r: DetalleReserva = reserva()) {
  consultas.cargarReserva.mockResolvedValue(r);
  render(<DetalleReservaPantalla id={ID} />);
  return screen.findByTestId("motivos-revision");
}

describe("M3-39 fila 1 — 'Marcar como resuelto' en cada motivo, con nota obligatoria", () => {
  it("el botón está en el motivo; sin nota no guarda y dice qué falta", async () => {
    const motivos = await abrir();
    fireEvent.click(within(motivos).getByRole("button", { name: `${T.marcarResuelto}: ${GENERICO}` }));
    const form = within(motivos).getByRole("group", { name: `${T.marcarResuelto}: ${GENERICO}` });
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));
    expect(within(form).getByText(T.errores.faltaNota)).toBeInTheDocument();
    expect(within(form).getByLabelText(T.notaResuelto)).toHaveAttribute("aria-invalid", "true");
    expect(acciones.marcarMotivoResuelto).not.toHaveBeenCalled();
  });

  it("una nota larga tampoco se guarda", async () => {
    const motivos = await abrir();
    fireEvent.click(within(motivos).getByRole("button", { name: `${T.marcarResuelto}: ${GENERICO}` }));
    fireEvent.change(within(motivos).getByLabelText(T.notaResuelto), { target: { value: "x".repeat(201) } });
    fireEvent.click(within(motivos).getByRole("button", { name: T.guardar }));
    expect(within(motivos).getByText(T.errores.notaLarga(200))).toBeInTheDocument();
    expect(acciones.marcarMotivoResuelto).not.toHaveBeenCalled();
  });

  it("con la nota, manda los motivos del renglón y la versión; queda recibida y lo dice arriba", async () => {
    acciones.marcarMotivoResuelto.mockResolvedValue({ ok: true, estado: "recibida", motivos: [], avisos: [] });
    const r = reserva({ motivos: [NIGHT_BUS, MI.posibleDuplicada] });
    const motivos = await abrir(r);
    fireEvent.click(within(motivos).getByRole("button", { name: `${T.marcarResuelto}: ${GENERICO}` }));
    fireEvent.change(within(motivos).getByLabelText(T.notaResuelto), { target: { value: `  ${NOTA} ` } });
    fireEvent.click(within(motivos).getByRole("button", { name: T.guardar }));
    expect(await screen.findByTestId("producto-confirmado")).toHaveTextContent(T.listoRecibida);
    expect(acciones.marcarMotivoResuelto).toHaveBeenCalledWith({
      reservaId: ID,
      version: versionParaCorregir({ ...r, notas: r.notas ?? [] }),
      motivos: [NIGHT_BUS],
      nota: NOTA,
    });
  });

  it("si falla, lo dice en llano y se puede reintentar", async () => {
    acciones.marcarMotivoResuelto.mockResolvedValue({ ok: false, error: T.error(T.motivos.descartada) });
    const motivos = await abrir();
    fireEvent.click(within(motivos).getByRole("button", { name: `${T.marcarResuelto}: ${GENERICO}` }));
    fireEvent.change(within(motivos).getByLabelText(T.notaResuelto), { target: { value: NOTA } });
    fireEvent.click(within(motivos).getByRole("button", { name: T.guardar }));
    expect(await within(motivos).findByText(T.error(T.motivos.descartada))).toBeInTheDocument();
    expect(within(motivos).getByRole("button", { name: T.reintentar })).toBeInTheDocument();
  });
});

describe("M3-39 fila 4 — los motivos con arreglo propio siguen con su botón", () => {
  it("los datos dudosos no llevan 'Marcar como resuelto' (tienen 'Está bien así'); los demás sí", async () => {
    const motivos = await abrir(reserva({ motivos: [M.dudosos(["pax"]), MI.posibleDuplicada], posibleDuplicada: true }));
    expect(within(motivos).getAllByRole("button", { name: new RegExp(`^${T.marcarResuelto}`) })).toHaveLength(1);
    expect(within(motivos).getByRole("button", { name: `${T.marcarResuelto}: ${DUPLICADA}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${T.estaBien}: cantidad de pasajeros` })).toBeInTheDocument();
  });

  it("el producto no seguro, cuando se puede confirmar, va por 'Confirmar producto'", async () => {
    const motivos = await abrir(reserva({ motivos: [M.noSeguro("Patagonia Express")], producto: null, agencia: "Kilroy" }));
    expect(within(motivos).queryByRole("button", { name: new RegExp(`^${T.marcarResuelto}`) })).toBeNull();
  });

  it("una reserva que no está para revisión no muestra el botón", async () => {
    consultas.cargarReserva.mockResolvedValue(reserva({ estado: "recibida", motivos: [MI.posibleDuplicada], posibleDuplicada: true }));
    render(<DetalleReservaPantalla id={ID} />);
    expect(await screen.findByTestId("motivos-revision")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(`^${T.marcarResuelto}`) })).toBeNull();
  });
});

describe("M3-39 fila 2 — el historial", () => {
  it("'<persona> marcó como resuelto: <motivo> — <nota>'", async () => {
    consultas.cargarReserva.mockResolvedValue(
      reserva({
        estado: "recibida",
        motivos: [],
        correcciones: [
          { tipo: "resuelto", fecha: "2026-10-28T12:00:00.000Z", persona: "Damian", vuelos: [], dato: null, nota: false, resueltos: [NIGHT_BUS], explicacion: NOTA },
        ],
      }),
    );
    render(<DetalleReservaPantalla id={ID} />);
    expect(await screen.findByTestId("historial-correcciones")).toHaveTextContent(T.historialResuelto("Damian", NIGHT_BUS, NOTA));
  });
});
