// @vitest-environment jsdom
//
// Spec M3-05 filas 1, 2, 3 y 9 (y §4): el recuadro "Producto sin confirmar" en
// el detalle de una reserva para revisión: confirmar la sugerencia de la IA o
// elegir otro producto del catálogo, siempre con un OK corto antes.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(async () => new Map()),
  cargarRevision: vi.fn(async () => null),
}));
const catalogo = vi.hoisted(() => ({ cargarCatalogo: vi.fn() }));
const acciones = vi.hoisted(() => ({ confirmarProductoDeReserva: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-producto", () => acciones);
vi.mock("@/lib/reservas/consultas", () => consultas);
vi.mock("@/lib/catalogo/consultas", () => catalogo);
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/reservas" }));

import { MOTIVOS_EMPAREJADO as M } from "@/lib/reservas/emparejar/motivos";
import { detalle } from "@/lib/reservas/fixtures.test-utils";
import type { FilaCatalogo } from "@/lib/catalogo/tipos";
import { TEXTOS } from "@/lib/textos";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const T = TEXTOS.reserva.confirmarProducto;
const ID = "77777777-7777-4777-8777-777777777777";
const NOMBRE = "HI - La Paz Starter Package (Adventure Brew Hostal)";
const OD031 = { id: "aaaaaaaa-0000-4000-8000-000000000331", codigo: "OD031", nombre: "La Paz Bolivia Starter package" };
const OD030 = { id: "aaaaaaaa-0000-4000-8000-000000000330", codigo: "OD030", nombre: "San Pedro de Atacama Explorer" };
const CHB31 = { id: "aaaaaaaa-0000-4000-8000-000000000031", codigo: "CHB31", nombre: "Overland San Pedro de Atacama to Uyuni" };

const fila = (p: typeof OD031) => ({ ...p, codigosExternos: [], esTour: false, destino: null, ciudades: [] }) as unknown as FilaCatalogo;

const sinConfirmar = (extra = {}) =>
  detalle({
    id: ID,
    estado: "para_revision",
    producto: null,
    productoTextoAgencia: NOMBRE,
    motivos: [M.noSeguro(NOMBRE, { codigo: "OD031", confianza: 0.85 })],
    sugerencia: OD031,
    ...extra,
  });

beforeEach(() => {
  vi.clearAllMocks();
  catalogo.cargarCatalogo.mockResolvedValue([fila(CHB31), fila(OD030), fila(OD031)]);
});

async function abrir(reserva = sinConfirmar()) {
  consultas.cargarReserva.mockResolvedValue(reserva);
  render(<DetalleReservaPantalla id={ID} />);
  return screen.findByRole("region", { name: T.titulo });
}

describe("M3-05 fila 1 — el recuadro 'Producto sin confirmar'", () => {
  it("con sugerencia: lo que mandó la agencia, la seguridad de la IA y 'Confirmar: es OD031 …'", async () => {
    const recuadro = await abrir();
    expect(within(recuadro).getByText(T.agenciaMando("Kilroy", NOMBRE))).toBeInTheDocument();
    expect(within(recuadro).getByText(T.seguridad(85))).toBeInTheDocument();
    expect(within(recuadro).getByRole("button", { name: T.confirmar("OD031", OD031.nombre) })).toBeInTheDocument();
    expect(within(recuadro).getByRole("button", { name: T.elegirOtro })).toBeInTheDocument();
  });

  it("sin sugerencia: no hay 'Confirmar', sí 'Elegir el producto'", async () => {
    const recuadro = await abrir(sinConfirmar({ sugerencia: null, motivos: [M.noSeguro(NOMBRE)] }));
    expect(within(recuadro).queryByRole("button", { name: /^Confirmar: es/ })).toBeNull();
    expect(within(recuadro).getByRole("button", { name: T.elegir })).toBeInTheDocument();
  });

  it.each([
    ["recibida", { estado: "recibida", motivos: [] }],
    ["sin motivo de producto", { motivos: [M.dudosos(["pax"])] }],
    ["Journaway", { agencia: "Journaway" }],
    ["ya tiene producto", { producto: OD030 }],
  ])("no aparece: %s", async (_, extra) => {
    consultas.cargarReserva.mockResolvedValue(sinConfirmar(extra));
    render(<DetalleReservaPantalla id={ID} />);
    await screen.findByTestId("encabezado-reserva");
    expect(screen.queryByRole("region", { name: T.titulo })).toBeNull();
  });
});

describe("M3-05 filas 3 y 9 — confirmar pide un OK y después muestra la reserva actualizada", () => {
  it("sin confirmar el diálogo no cambia nada", async () => {
    const recuadro = await abrir();
    fireEvent.click(within(recuadro).getByRole("button", { name: T.confirmar("OD031", OD031.nombre) }));
    const dialogo = screen.getByRole("dialog", { name: T.dialogo });
    expect(dialogo).toHaveTextContent(T.pregunta(NOMBRE, "OD031", OD031.nombre));
    expect(dialogo).toHaveTextContent(T.aprende("Kilroy"));
    fireEvent.click(within(dialogo).getByRole("button", { name: T.cancelar }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(acciones.confirmarProductoDeReserva).not.toHaveBeenCalled();
  });

  it("una reserva de prueba avisa que no se guarda la equivalencia", async () => {
    const recuadro = await abrir(sinConfirmar({ dePrueba: true }));
    fireEvent.click(within(recuadro).getByRole("button", { name: T.confirmar("OD031", OD031.nombre) }));
    expect(screen.getByRole("dialog", { name: T.dialogo })).toHaveTextContent(T.deMuestraNoAprende);
  });

  it("'Sí, confirmar' → 'Confirmando…' → 'Listo…' y vuelve a cargar la reserva", async () => {
    let terminar: (v: unknown) => void = () => {};
    acciones.confirmarProductoDeReserva.mockImplementation(() => new Promise((r) => (terminar = r)));
    const recuadro = await abrir();
    fireEvent.click(within(recuadro).getByRole("button", { name: T.confirmar("OD031", OD031.nombre) }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.si }));
    expect(await screen.findByText(T.confirmando)).toBeInTheDocument();
    expect(acciones.confirmarProductoDeReserva).toHaveBeenCalledWith({ reservaId: ID, productoId: OD031.id });

    consultas.cargarReserva.mockResolvedValue(detalle({ id: ID, estado: "recibida", producto: OD031, motivos: [] }));
    terminar({ ok: true, estado: "recibida", codigo: "OD031", agencia: "Kilroy", aprendio: true });
    expect(await screen.findByText(T.listo(true, "OD031", "Kilroy", true))).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: TEXTOS.reserva.armarPedidos })).toBeInTheDocument();
    expect(consultas.cargarReserva).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("region", { name: T.titulo })).toBeNull();
  });

  it("si falla: 'No se pudo confirmar: …' con 'Reintentar'", async () => {
    acciones.confirmarProductoDeReserva.mockResolvedValueOnce({ ok: false, error: T.error(T.motivos.conexion) });
    const recuadro = await abrir();
    fireEvent.click(within(recuadro).getByRole("button", { name: T.confirmar("OD031", OD031.nombre) }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.si }));
    expect(await screen.findByText(T.error(T.motivos.conexion))).toBeInTheDocument();
    acciones.confirmarProductoDeReserva.mockResolvedValueOnce({ ok: false, error: T.error(T.motivos.conexion) });
    fireEvent.click(screen.getByRole("button", { name: T.reintentar }));
    await waitFor(() => expect(acciones.confirmarProductoDeReserva).toHaveBeenCalledTimes(2));
    expect(acciones.confirmarProductoDeReserva).toHaveBeenLastCalledWith({ reservaId: ID, productoId: OD031.id });
  });

  it("fila 5: si la agencia ya lo tenía como otro producto, pregunta '¿Lo cambiamos?' y con el sí lo cambia", async () => {
    const pregunta = T.conflicto("Kilroy", NOMBRE, "OD030");
    acciones.confirmarProductoDeReserva.mockResolvedValueOnce({ ok: false, error: pregunta, conflicto: pregunta });
    acciones.confirmarProductoDeReserva.mockResolvedValueOnce({ ok: true, estado: "recibida", codigo: "OD031", agencia: "Kilroy", aprendio: true });
    const recuadro = await abrir();
    fireEvent.click(within(recuadro).getByRole("button", { name: T.confirmar("OD031", OD031.nombre) }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.si }));
    const dialogo = await screen.findByRole("dialog", { name: T.dialogo });
    expect(await within(dialogo).findByText(pregunta)).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: T.cambiar }));
    await waitFor(() =>
      expect(acciones.confirmarProductoDeReserva).toHaveBeenLastCalledWith({ reservaId: ID, productoId: OD031.id, cambiarEquivalencia: true }),
    );
  });
});

describe("M3-05 fila 2 — elegir otro producto del catálogo", () => {
  it("buscar por código ('OD03') o nombre ('La Paz'), elegir y confirmar deja ese producto", async () => {
    acciones.confirmarProductoDeReserva.mockResolvedValue({ ok: true, estado: "recibida", codigo: "OD030", agencia: "Kilroy", aprendio: true });
    const recuadro = await abrir();
    fireEvent.click(within(recuadro).getByRole("button", { name: T.elegirOtro }));
    const buscador = await within(recuadro).findByRole("searchbox", { name: T.buscar });

    fireEvent.change(buscador, { target: { value: "OD03" } });
    const lista = await within(recuadro).findByRole("list", { name: T.resultados });
    expect(within(lista).getAllByRole("button").map((b) => b.textContent)).toEqual([
      T.elegirEste("OD030", OD030.nombre),
      T.elegirEste("OD031", OD031.nombre),
    ]);

    fireEvent.change(buscador, { target: { value: "la paz" } });
    expect(within(within(recuadro).getByRole("list", { name: T.resultados })).getAllByRole("button")).toHaveLength(1);

    fireEvent.change(buscador, { target: { value: "OD030" } });
    fireEvent.click(within(recuadro).getByRole("button", { name: T.elegirEste("OD030", OD030.nombre) }));
    const dialogo = screen.getByRole("dialog", { name: T.dialogo });
    expect(dialogo).toHaveTextContent(T.pregunta(NOMBRE, "OD030", OD030.nombre));
    fireEvent.click(within(dialogo).getByRole("button", { name: T.si }));
    await waitFor(() => expect(acciones.confirmarProductoDeReserva).toHaveBeenCalledWith({ reservaId: ID, productoId: OD030.id }));
  });

  it("si no está en el catálogo: 'Ese producto no está en el catálogo: hay que cargarlo primero'", async () => {
    const recuadro = await abrir();
    fireEvent.click(within(recuadro).getByRole("button", { name: T.elegirOtro }));
    fireEvent.change(await within(recuadro).findByRole("searchbox", { name: T.buscar }), { target: { value: "Machu Picchu" } });
    expect(await within(recuadro).findByText(T.noEstaEnCatalogo)).toBeInTheDocument();
  });
});

describe("M3-05 fila 7 — el historial en el detalle", () => {
  it("'<persona> confirmó el producto OD031 (sugerido por la IA)' y '<persona> eligió OD030'", async () => {
    consultas.cargarReserva.mockResolvedValue(
      detalle({
        id: ID,
        estado: "recibida",
        producto: OD031,
        confirmacionesProducto: [
          { fecha: "2026-10-19T15:00:00.000Z", persona: "Cristian", codigo: "OD031", sugerida: true },
          { fecha: "2026-10-19T16:00:00.000Z", persona: "Leticia", codigo: "OD030", sugerida: false },
        ],
      }),
    );
    render(<DetalleReservaPantalla id={ID} />);
    expect(await screen.findByText(T.historialSugerido("Cristian", "OD031"))).toBeInTheDocument();
    expect(screen.getByText(T.historialElegido("Leticia", "OD030"))).toBeInTheDocument();
  });
});
