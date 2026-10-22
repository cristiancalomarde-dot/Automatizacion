// @vitest-environment jsdom
//
// Spec M3-09 — verificación 1 (pantalla con datos simulados): "Agregar un
// pedido a mano" solo donde corresponde (fila 1), elegir a quién en el
// directorio o con un mail (fila 2), el borrador ya empezado (fila 3), guardar
// (con sus errores y "Reintentar"), la tarjeta "A mano" que entra en "Enviar N"
// (filas 4 y 6), "Sacar este pedido" con confirmación (fila 8) y sin sesión
// (fila 10).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const acciones = vi.hoisted(() => ({
  armarPedidosDeLaReserva: vi.fn(),
  guardarBorradorDePedido: vi.fn(),
  enviarPedidos: vi.fn(),
  agregarPedidoAManoDeLaReserva: vi.fn(),
  sacarPedidoAManoDeLaReserva: vi.fn(),
  buscarProveedoresDelDirectorio: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/pedidos/acciones", () => acciones);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { PedidoGuardado } from "@/lib/pedidos/guardar";
import type { ConfiguracionEnvio } from "@/lib/pedidos/pantalla";
import type { PantallaPedidos } from "@/lib/pedidos/revision";
import { TEXTOS } from "@/lib/textos";
import { PedidosPantalla } from "./pedidos-pantalla";

const T = TEXTOS.pedidos;
const A = T.aMano;
const RESERVA = "1b6e1f0a-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
const HOSTAL = "8f7c6a2e-1b1a-4c3e-9a55-2a0f6d5b9c11";
const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const PRUEBA: ConfiguracionEnvio = { modoPrueba: true, destinoPrueba: "ccalomarde@", cc: ["ccalomarde@hitravel.com.ar"] };
const FIRMA = "{{nombre_de_quien_envia}}\nHi Travel South America";

const BORRADOR = {
  asunto: "Reserva Ana Prueba x2 · Ref. DK1592913",
  cuerpo: "¡Hola! ¿Cómo están? Esperamos que muy bien.\n\nLes escribimos desde HI Travel para pedirles la siguiente reserva:\n\n\n\nPasajeros: 2\n\n¡Muchas gracias!\n¡Saludos!",
  firma: FIRMA,
};
const PEDIDO = "1 noche extra, IN 14/01/2027 OUT 15/01/2027, habitación doble";

function pedido(n: number, parcial: Partial<PedidoGuardado> = {}): PedidoGuardado {
  return {
    id: ID(n),
    reserva_id: RESERVA,
    casilla: `casilla-${n}`,
    destinatarios: [`prov${n}@proveedor.test`],
    proveedor_ids: [`prov-${n}`],
    proveedores: [`Proveedor ${n}`],
    partes: [],
    asunto: `Reserva Ana Prueba x2 (${n})`,
    cuerpo: `Servicio ${n}`,
    firma: FIRMA,
    sin_destinatario: null,
    avisos: [],
    estado: "borrador",
    editado: false,
    a_mano: false,
    de_prueba: true,
    created_at: "2026-10-20T00:00:00Z",
    updated_at: "2026-10-20T00:00:00Z",
    ...parcial,
  };
}

const armado = pedido(1, { proveedores: ["Cuenca del Plata"] });
const aMano = (n: number, parcial: Partial<PedidoGuardado> = {}) =>
  pedido(n, {
    casilla: `a-mano:0000000${n}-0000-4000-8000-000000000000`,
    a_mano: true,
    proveedores: ["Hostal Magallanes"],
    proveedor_ids: [HOSTAL],
    destinatarios: ["reservas@hostal.test"],
    asunto: BORRADOR.asunto,
    cuerpo: BORRADOR.cuerpo.replace("reserva:\n\n", `reserva:\n\n${PEDIDO}`),
    ...parcial,
  });

function pantalla(parcial: Partial<PantallaPedidos> = {}) {
  return {
    ok: true as const,
    reserva: { id: RESERVA, numero: "DK1592913", agencia: "Kilroy" },
    estadoReserva: "recibida" as const,
    pedidos: [armado],
    tareas: [],
    avisos: [],
    aMano: BORRADOR,
    ...parcial,
  };
}

function abrir() {
  return render(<PedidosPantalla reservaId={RESERVA} firmante="Leticia Gómez" envio={PRUEBA} />);
}

const botonEnviar = () => screen.getByRole("button", { name: /^Enviar \d+ pedidos?/ });

async function abrirFormulario() {
  abrir();
  fireEvent.click(await screen.findByRole("button", { name: A.agregar }));
  return screen.getByRole("form", { name: A.titulo });
}

beforeEach(() => {
  vi.clearAllMocks();
  acciones.armarPedidosDeLaReserva.mockResolvedValue(pantalla());
  acciones.buscarProveedoresDelDirectorio.mockResolvedValue({ ok: true, proveedores: [] });
});
afterEach(cleanup);

describe("dónde aparece (fila 1)", () => {
  it.each(["recibida", "pedido_a_proveedor"] as const)("en una reserva %s, debajo de las tarjetas", async (estado) => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ estadoReserva: estado }));
    abrir();
    const boton = await screen.findByRole("button", { name: A.agregar });
    const tarjeta = screen.getByRole("article", { name: "Cuenca del Plata" });
    expect(tarjeta.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("no debe pasar: en una reserva cancelada (sin borrador a mano) no aparece", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ aMano: null }));
    abrir();
    await screen.findByRole("article", { name: "Cuenca del Plata" });
    expect(screen.queryByRole("button", { name: A.agregar })).not.toBeInTheDocument();
  });

  it("no debe pasar: en una reserva para revisión no aparece (la pantalla no arma)", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce({ ok: false, error: "Resolvé primero lo que está para revisión." });
    abrir();
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: A.agregar })).not.toBeInTheDocument();
  });

  it("también en una reserva sin pedidos armados", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ pedidos: [] }));
    abrir();
    expect(await screen.findByRole("button", { name: A.agregar })).toBeInTheDocument();
  });
});

describe("el formulario (filas 2 y 3)", () => {
  it("arranca con el asunto y el texto de la plantilla; la firma de siempre", async () => {
    const form = await abrirFormulario();
    expect(within(form).getByLabelText(T.asunto)).toHaveValue(BORRADOR.asunto);
    expect(within(form).getByLabelText(T.texto)).toHaveValue(BORRADOR.cuerpo);
    expect(within(form).getByText(/^Leticia Gómez/)).toBeInTheDocument();
    // El botón se va mientras la tarjeta nueva está abierta.
    expect(screen.queryByRole("button", { name: A.agregar })).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: A.cancelar }));
    expect(screen.queryByRole("form", { name: A.titulo })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.agregar })).toBeInTheDocument();
  });

  it("buscar 'Hostal' completa los mails del proveedor, que se pueden editar", async () => {
    acciones.buscarProveedoresDelDirectorio.mockResolvedValue({
      ok: true,
      proveedores: [{ id: HOSTAL, nombre: "Hostal Magallanes", ciudad: "PUNTA ARENAS", mails: ["reservas@hostal.test", "ventas@hostal.test"] }],
    });
    const form = await abrirFormulario();
    fireEvent.change(within(form).getByLabelText(A.buscar), { target: { value: "Hostal" } });
    const opcion = await within(form).findByRole("button", { name: /Hostal Magallanes/ });
    expect(acciones.buscarProveedoresDelDirectorio).toHaveBeenLastCalledWith("Hostal");
    fireEvent.click(opcion);
    const para = within(form).getByLabelText(A.para);
    expect(para).toHaveValue("reservas@hostal.test, ventas@hostal.test");
    expect(within(form).getByText(A.elegido("Hostal Magallanes"))).toBeInTheDocument();
    fireEvent.change(para, { target: { value: "reservas@hostal.test" } });
    expect(para).toHaveValue("reservas@hostal.test");
  });

  it("sin coincidencias: 'No está en el directorio: escribí el mail'", async () => {
    const form = await abrirFormulario();
    fireEvent.change(within(form).getByLabelText(A.buscar), { target: { value: "Hotel PUQ" } });
    expect(await within(form).findByText(A.sinCoincidencias)).toBeInTheDocument();
  });

  it("no debe pasar: un mail mal escrito muestra el error y no guarda", async () => {
    const form = await abrirFormulario();
    fireEvent.change(within(form).getByLabelText(A.para), { target: { value: "reservas@hotelpuq" } });
    fireEvent.change(within(form).getByLabelText(T.texto), { target: { value: `Hola\n\n${PEDIDO}` } });
    fireEvent.click(within(form).getByRole("button", { name: A.guardar }));
    expect(await within(form).findByText(A.mailInvalido)).toBeInTheDocument();
    expect(acciones.agregarPedidoAManoDeLaReserva).not.toHaveBeenCalled();
  });

  it("no debe pasar: sin escribir qué se pide (o con el texto vacío) no guarda", async () => {
    const form = await abrirFormulario();
    fireEvent.change(within(form).getByLabelText(A.para), { target: { value: "reservas@hotelpuq.cl" } });
    fireEvent.click(within(form).getByRole("button", { name: A.guardar }));
    expect(await within(form).findByText(A.sinTexto)).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText(T.texto), { target: { value: "  " } });
    fireEvent.click(within(form).getByRole("button", { name: A.guardar }));
    expect(within(form).getByText(A.sinTexto)).toBeInTheDocument();
    expect(acciones.agregarPedidoAManoDeLaReserva).not.toHaveBeenCalled();
  });
});

describe("guardar (filas 4, 6 y 10)", () => {
  async function completar(form: HTMLElement) {
    fireEvent.change(within(form).getByLabelText(A.para), { target: { value: "reservas@hostal.test" } });
    fireEvent.change(within(form).getByLabelText(T.texto), { target: { value: BORRADOR.cuerpo.replace("reserva:\n\n", `reserva:\n\n${PEDIDO}`) } });
  }

  it("'Guardando…' y después una tarjeta más con 'A mano', 'Incluir' y 'Sacar', que entra en 'Enviar N'", async () => {
    let responder: (v: unknown) => void = () => undefined;
    acciones.agregarPedidoAManoDeLaReserva.mockReturnValue(new Promise((r) => (responder = r)));
    const form = await abrirFormulario();
    expect(botonEnviar()).toHaveTextContent(T.enviar(1, 0));
    await completar(form);
    fireEvent.click(within(form).getByRole("button", { name: A.guardar }));
    expect(within(form).getByRole("button", { name: A.guardando })).toBeDisabled();
    expect(acciones.agregarPedidoAManoDeLaReserva).toHaveBeenCalledWith({
      reservaId: RESERVA,
      proveedorId: null,
      mails: "reservas@hostal.test",
      asunto: BORRADOR.asunto,
      cuerpo: BORRADOR.cuerpo.replace("reserva:\n\n", `reserva:\n\n${PEDIDO}`),
    });
    responder({ ok: true, pedido: aMano(5) });

    const t = await screen.findByRole("article", { name: "Hostal Magallanes" });
    expect(screen.queryByRole("form", { name: A.titulo })).not.toBeInTheDocument();
    expect(within(t).getByText(A.etiqueta)).toBeInTheDocument();
    expect(within(t).getByRole("checkbox", { name: T.incluir })).toBeChecked();
    expect(within(t).getByRole("button", { name: A.sacar })).toBeInTheDocument();
    expect(botonEnviar()).toHaveTextContent(T.enviar(2, 0));
    // El armado no lleva "A mano" ni "Sacar".
    const otro = screen.getByRole("article", { name: "Cuenca del Plata" });
    expect(within(otro).queryByText(A.etiqueta)).not.toBeInTheDocument();
    expect(within(otro).queryByRole("button", { name: A.sacar })).not.toBeInTheDocument();

    // Fila 6: en el diálogo de envío, con su destinatario.
    fireEvent.click(botonEnviar());
    expect(within(screen.getByRole("dialog")).getByText("Hostal Magallanes — reservas@hostal.test")).toBeInTheDocument();
  });

  it("si no se pudo guardar: 'No se pudo guardar: <motivo>' con 'Reintentar', y lo escrito sigue ahí", async () => {
    acciones.agregarPedidoAManoDeLaReserva.mockResolvedValueOnce({ ok: false, error: "se cortó la conexión" }).mockResolvedValueOnce({ ok: true, pedido: aMano(5) });
    const form = await abrirFormulario();
    await completar(form);
    fireEvent.click(within(form).getByRole("button", { name: A.guardar }));
    const error = await within(form).findByText(A.noSeGuardo("se cortó la conexión"));
    expect(within(form).getByLabelText(A.para)).toHaveValue("reservas@hostal.test");
    fireEvent.click(within(error.closest("[role=alert]") as HTMLElement).getByRole("button", { name: A.reintentar }));
    expect(await screen.findByRole("article", { name: "Hostal Magallanes" })).toBeInTheDocument();
    expect(acciones.agregarPedidoAManoDeLaReserva).toHaveBeenCalledTimes(2);
  });

  it("sin sesión vuelve al login", async () => {
    acciones.agregarPedidoAManoDeLaReserva.mockResolvedValueOnce({ ok: false, error: T.sinSesion, sinSesion: true });
    const form = await abrirFormulario();
    await completar(form);
    fireEvent.click(within(form).getByRole("button", { name: A.guardar }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?error=sesion_vencida"));
  });
});

describe("sacar (fila 8)", () => {
  it("con confirmación lo saca de la lista", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ pedidos: [armado, aMano(5)] }));
    acciones.sacarPedidoAManoDeLaReserva.mockResolvedValueOnce({ ok: true, pedidoId: ID(5) });
    abrir();
    const t = await screen.findByRole("article", { name: "Hostal Magallanes" });
    fireEvent.click(within(t).getByRole("button", { name: A.sacar }));
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent(A.sacarPregunta("Hostal Magallanes"));
    fireEvent.click(within(dialogo).getByRole("button", { name: A.sacarConfirmar }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Hostal Magallanes" })).not.toBeInTheDocument());
    expect(acciones.sacarPedidoAManoDeLaReserva).toHaveBeenCalledWith(ID(5));
    expect(botonEnviar()).toHaveTextContent(T.enviar(1, 0));
  });

  it("cancelar no saca nada; si la base no lo deja, lo dice", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ pedidos: [armado, aMano(5)] }));
    acciones.sacarPedidoAManoDeLaReserva.mockResolvedValueOnce({ ok: false, error: A.noSeSaca });
    abrir();
    const t = await screen.findByRole("article", { name: "Hostal Magallanes" });
    fireEvent.click(within(t).getByRole("button", { name: A.sacar }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: A.cancelar }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(acciones.sacarPedidoAManoDeLaReserva).not.toHaveBeenCalled();

    fireEvent.click(within(t).getByRole("button", { name: A.sacar }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: A.sacarConfirmar }));
    expect(await within(screen.getByRole("dialog")).findByText(A.noSeSaca)).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Hostal Magallanes" })).toBeInTheDocument();
  });

  it("no debe pasar: uno ya enviado ofrece 'Sacar'", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(
      pantalla({ pedidos: [aMano(5, { estado: "enviado", enviado_en: "2026-10-20T21:42:00Z", enviado_por_nombre: "Leticia Gómez", message_id: "<x@y>" })] }),
    );
    abrir();
    const t = await screen.findByRole("article", { name: "Hostal Magallanes" });
    expect(within(t).getByText(A.etiqueta)).toBeInTheDocument();
    expect(within(t).queryByRole("button", { name: A.sacar })).not.toBeInTheDocument();
    expect(within(t).getByRole("button", { name: T.envio.reenviar })).toBeInTheDocument();
  });
});
