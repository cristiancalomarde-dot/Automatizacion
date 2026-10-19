// @vitest-environment jsdom
//
// Spec M3-02 — verificación 1 (pantalla con datos simulados): las tarjetas,
// la edición guardada, "Incluir este pedido", el proveedor sin mail, las
// tareas a mano, los avisos, "Volver a armar", el diálogo de envío en los dos
// modos (filas 2 a 8), y los estados de carga, error y vacío (§4).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const acciones = vi.hoisted(() => ({
  armarPedidosDeLaReserva: vi.fn(),
  guardarBorradorDePedido: vi.fn(),
  enviarPedidos: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/pedidos/acciones", () => acciones);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { PedidoGuardado, TareaGuardada } from "@/lib/pedidos/guardar";
import type { ConfiguracionEnvio } from "@/lib/pedidos/pantalla";
import type { PantallaPedidos } from "@/lib/pedidos/revision";
import { TEXTOS } from "@/lib/textos";
import { PedidosPantalla } from "./pedidos-pantalla";

const T = TEXTOS.pedidos;
const RESERVA = "1b6e1f0a-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

function pedido(n: number, parcial: Partial<PedidoGuardado>): PedidoGuardado {
  return {
    id: ID(n),
    reserva_id: RESERVA,
    casilla: `casilla-${n}`,
    destinatarios: [`prov${n}@proveedor.test`],
    proveedor_ids: [`prov-${n}`],
    proveedores: [`Proveedor ${n}`],
    partes: [{ parte_id: null, producto_servicio_id: null, producto: "ARCH31", fecha: "2027-01-10" }],
    asunto: `Reserva Ana Prueba x 2 · ARCH31 (${n})`,
    cuerpo: `Hola, ¿cómo están?\n\nServicio ${n}`,
    firma: "Saludos,\n{{nombre_de_quien_envia}}\nHI Travel South America",
    sin_destinatario: null,
    avisos: [],
    estado: "borrador",
    editado: false,
    de_prueba: true,
    created_at: "2026-10-19T00:00:00Z",
    updated_at: "2026-10-19T00:00:00Z",
    ...parcial,
  };
}

const cuenca = pedido(1, { destinatarios: ["reservas8@cuencadelplata.com"], proveedores: ["Cuenca del Plata"], casilla: "reservas8@cuencadelplata.com" });
const hotel = pedido(2, { proveedores: ["Hostel del Glaciar"] });
const transfer = pedido(3, { proveedores: ["Transfer Calafate"] });
const sinMail = pedido(4, {
  destinatarios: [],
  proveedores: ["Aventura Sur"],
  proveedor_ids: ["prov-sin-mail"],
  casilla: "sin-mail:prov-sin-mail",
  sin_destinatario: "Falta el mail de Aventura Sur: completalo en el directorio de proveedores.",
});
const tareaArch31: TareaGuardada = {
  id: ID(9),
  reserva_id: RESERVA,
  tipo: "emitir_boleto",
  texto: "Emitir boleto: El Calafate → El Chaltén, 12 ene 2027",
  detalle: {},
  orden: 0,
  de_prueba: true,
};

function pantalla(parcial: Partial<PantallaPedidos> = {}) {
  return {
    ok: true as const,
    reserva: { id: RESERVA, numero: "DK9000001/test", agencia: "Kilroy" },
    pedidos: [cuenca, hotel, transfer],
    tareas: [tareaArch31],
    avisos: [],
    ...parcial,
  };
}

const PRUEBA: ConfiguracionEnvio = { modoPrueba: true, destinoPrueba: "ccalomarde@", cc: ["ccalomarde@hitravel.com.ar"] };
const REAL: ConfiguracionEnvio = { modoPrueba: false, destinoPrueba: "ccalomarde@", cc: ["ccalomarde@hitravel.com.ar"] };

function abrir(envio: ConfiguracionEnvio = PRUEBA) {
  return render(<PedidosPantalla reservaId={RESERVA} firmante="Leticia Gómez" envio={envio} />);
}

const tarjeta = (proveedor: string) => screen.getByRole("article", { name: proveedor });
const botonEnviar = () => screen.getByRole("button", { name: /^Enviar \d+ pedidos?/ });

beforeEach(() => {
  vi.clearAllMocks();
  acciones.armarPedidosDeLaReserva.mockResolvedValue(pantalla());
});
afterEach(cleanup);

describe("carga, error y vacío (§4)", () => {
  it("mientras arma dice 'Armando los pedidos…'", async () => {
    acciones.armarPedidosDeLaReserva.mockReturnValue(new Promise(() => {}));
    abrir();
    expect(screen.getByText(T.armando)).toBeInTheDocument();
    expect(acciones.armarPedidosDeLaReserva).toHaveBeenCalledWith(RESERVA, { reemplazarEditados: false });
  });

  it("si no se pudo armar, dice el motivo en llano y ofrece Reintentar", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce({ ok: false, error: "Resolvé primero lo que está para revisión." });
    abrir();
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent(T.error);
    expect(error).toHaveTextContent("Resolvé primero lo que está para revisión.");
    fireEvent.click(within(error).getByRole("button", { name: TEXTOS.comunes.reintentar }));
    expect(await screen.findByRole("article", { name: "Cuenca del Plata" })).toBeInTheDocument();
    expect(acciones.armarPedidosDeLaReserva).toHaveBeenCalledTimes(2);
  });

  it("si todo es a mano: 'no tiene pedidos por mail; quedan estas tareas'", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ pedidos: [] }));
    abrir();
    expect(await screen.findByText(T.vacio)).toBeInTheDocument();
    expect(screen.getByText(tareaArch31.texto)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Enviar/ })).not.toBeInTheDocument();
  });

  it("sin sesión vuelve al login", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce({ ok: false, error: T.sinSesion, sinSesion: true });
    abrir();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?error=sesion_vencida"));
  });
});

describe("las tarjetas (fila 2)", () => {
  it("una por pedido: proveedor, mail destino, CC, asunto, texto y lo que cubre", async () => {
    abrir();
    const t = await screen.findByRole("article", { name: "Cuenca del Plata" });
    expect(within(t).getByText("reservas8@cuencadelplata.com")).toBeInTheDocument();
    expect(within(t).getByText("ccalomarde@hitravel.com.ar")).toBeInTheDocument();
    expect(within(t).getByLabelText(T.asunto)).toHaveValue(cuenca.asunto);
    expect(within(t).getByLabelText(T.texto)).toHaveValue(cuenca.cuerpo);
    expect(within(t).getByText(/ARCH31 · 10\/01\/2027/)).toBeInTheDocument();
    // La firma ya con el nombre de quien envía.
    expect(within(t).getByText(/Leticia Gómez/)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    // El destinatario no se edita acá.
    expect(within(t).queryByRole("textbox", { name: T.para })).not.toBeInTheDocument();
  });

  it("editar el texto lo guarda como borrador, y al volver a entrar se ve lo editado", async () => {
    const editado = { ...cuenca, cuerpo: `${cuenca.cuerpo}\n\nPD: llegan tarde`, editado: true };
    acciones.guardarBorradorDePedido.mockResolvedValue({ ok: true, pedido: editado });
    const { unmount } = abrir();
    const t = await screen.findByRole("article", { name: "Cuenca del Plata" });
    const texto = within(t).getByLabelText(T.texto);
    fireEvent.change(texto, { target: { value: editado.cuerpo } });
    fireEvent.blur(texto);
    await waitFor(() =>
      expect(acciones.guardarBorradorDePedido).toHaveBeenCalledWith({ pedidoId: cuenca.id, asunto: cuenca.asunto, cuerpo: editado.cuerpo }),
    );
    expect(await within(t).findByText(T.guardado)).toBeInTheDocument();
    unmount();

    // Volver a entrar: el armado conserva el editado y la pantalla lo muestra.
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ pedidos: [editado, hotel, transfer] }));
    abrir();
    const otraVez = await screen.findByRole("article", { name: "Cuenca del Plata" });
    expect(within(otraVez).getByLabelText(T.texto)).toHaveValue(editado.cuerpo);
    expect(within(otraVez).getByText(T.editado)).toBeInTheDocument();
  });

  it("si no se pudo guardar, avisa y conserva lo escrito", async () => {
    acciones.guardarBorradorDePedido.mockResolvedValue({ ok: false, error: "x" });
    abrir();
    const t = await screen.findByRole("article", { name: "Hostel del Glaciar" });
    const asunto = within(t).getByLabelText(T.asunto);
    fireEvent.change(asunto, { target: { value: "Otro asunto" } });
    fireEvent.blur(asunto);
    expect(await within(t).findByText(T.errorGuardar)).toBeInTheDocument();
    expect(asunto).toHaveValue("Otro asunto");
  });

  it("sin cambios no guarda nada", async () => {
    abrir();
    const t = await screen.findByRole("article", { name: "Hostel del Glaciar" });
    fireEvent.blur(within(t).getByLabelText(T.texto));
    expect(acciones.guardarBorradorDePedido).not.toHaveBeenCalled();
  });
});

describe("Incluir este pedido (fila 3)", () => {
  it("por defecto sí; destildar uno pasa de 'Enviar 3' a 'Enviar 2'", async () => {
    abrir();
    await screen.findByRole("article", { name: "Cuenca del Plata" });
    expect(botonEnviar()).toHaveTextContent("Enviar 3 pedidos");
    const incluir = within(tarjeta("Hostel del Glaciar")).getByRole("checkbox", { name: T.incluir });
    expect(incluir).toBeChecked();
    fireEvent.click(incluir);
    expect(botonEnviar()).toHaveTextContent("Enviar 2 pedidos");
  });

  it("sin ninguno incluido, el botón queda deshabilitado", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ pedidos: [cuenca] }));
    abrir();
    const t = await screen.findByRole("article", { name: "Cuenca del Plata" });
    expect(botonEnviar()).toHaveTextContent("Enviar 1 pedido");
    fireEvent.click(within(t).getByRole("checkbox", { name: T.incluir }));
    expect(botonEnviar()).toBeDisabled();
  });
});

describe("proveedor sin mail (fila 4)", () => {
  it("tarjeta deshabilitada, aviso con 'Completar en el directorio' y el botón cuenta el pendiente", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ pedidos: [cuenca, hotel, transfer, sinMail] }));
    abrir();
    const t = await screen.findByRole("article", { name: "Aventura Sur" });
    expect(within(t).getByText(sinMail.sin_destinatario!)).toBeInTheDocument();
    expect(within(t).getByRole("link", { name: T.completarDirectorio })).toHaveAttribute("href", "/proveedores/prov-sin-mail");
    expect(within(t).getByRole("checkbox", { name: T.incluir })).toBeDisabled();
    expect(within(t).getByRole("checkbox", { name: T.incluir })).not.toBeChecked();
    expect(within(t).getByLabelText(T.texto)).toBeDisabled();
    expect(botonEnviar()).toHaveTextContent("Enviar 3 pedidos (1 queda pendiente)");
  });
});

describe("tareas a mano (fila 5)", () => {
  it("ARCH31: la tarea se ve aparte y no cuenta en 'Enviar N'", async () => {
    abrir();
    const tareas = await screen.findByRole("region", { name: T.tareas });
    expect(within(tareas).getByText(tareaArch31.texto)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(botonEnviar()).toHaveTextContent("Enviar 3 pedidos");
  });
});

describe("avisos arriba (fila 6)", () => {
  it("falta dato de llegada y lo que reserva la agencia", async () => {
    const hoteles = TEXTOS.pedidos.hotelesAgencia("Journaway", "Tayka del Desierto, Tayka de Sal");
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ avisos: [T.faltaLlegada, hoteles] }));
    abrir();
    const avisos = await screen.findByTestId("avisos-pedidos");
    expect(within(avisos).getByText(T.faltaLlegada)).toBeInTheDocument();
    expect(within(avisos).getByText(hoteles)).toBeInTheDocument();
  });

  it("los avisos de un pedido van en su tarjeta", async () => {
    const conAviso = { ...hotel, avisos: ["Faltan las fechas de Hostel del Glaciar: completalas antes de enviar."] };
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ pedidos: [cuenca, conAviso] }));
    abrir();
    const t = await screen.findByRole("article", { name: "Hostel del Glaciar" });
    expect(within(t).getByText(conAviso.avisos[0])).toBeInTheDocument();
  });
});

describe("Volver a armar (fila 7)", () => {
  it("sin editados, vuelve a armar directo", async () => {
    abrir();
    await screen.findByRole("article", { name: "Cuenca del Plata" });
    fireEvent.click(screen.getByRole("button", { name: T.volverAArmar }));
    await waitFor(() => expect(acciones.armarPedidosDeLaReserva).toHaveBeenCalledTimes(2));
    expect(acciones.armarPedidosDeLaReserva).toHaveBeenLastCalledWith(RESERVA, { reemplazarEditados: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("con uno editado, pide confirmación antes de reemplazarlo", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValue(pantalla({ pedidos: [{ ...cuenca, editado: true }, hotel] }));
    abrir();
    await screen.findByRole("article", { name: "Cuenca del Plata" });
    fireEvent.click(screen.getByRole("button", { name: T.volverAArmar }));
    const dialogo = screen.getByRole("dialog", { name: T.rearmar.titulo });
    expect(dialogo).toHaveTextContent(T.rearmar.editados(1));
    expect(acciones.armarPedidosDeLaReserva).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialogo).getByRole("button", { name: T.rearmar.cancelar }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(acciones.armarPedidosDeLaReserva).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: T.volverAArmar }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.rearmar.conservar }));
    await waitFor(() => expect(acciones.armarPedidosDeLaReserva).toHaveBeenLastCalledWith(RESERVA, { reemplazarEditados: false }));

    await screen.findByRole("article", { name: "Cuenca del Plata" });
    fireEvent.click(screen.getByRole("button", { name: T.volverAArmar }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.rearmar.reemplazar }));
    await waitFor(() => expect(acciones.armarPedidosDeLaReserva).toHaveBeenLastCalledWith(RESERVA, { reemplazarEditados: true }));
  });

  it("si el rearmado falla, los borradores siguen a la vista con el aviso", async () => {
    abrir();
    await screen.findByRole("article", { name: "Cuenca del Plata" });
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce({ ok: false, error: "No se pudo leer la reserva." });
    fireEvent.click(screen.getByRole("button", { name: T.volverAArmar }));
    expect(await screen.findByText(T.errorRearmar)).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Cuenca del Plata" })).toBeInTheDocument();
  });
});

describe("el diálogo 'Enviar N pedidos' (fila 8)", () => {
  it("modo prueba: lista destinatarios, CC y quién firma, y lo dice bien visible", async () => {
    acciones.enviarPedidos.mockResolvedValue({ ok: false, error: T.faltaConectar });
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ pedidos: [cuenca, hotel, transfer, sinMail] }));
    abrir(PRUEBA);
    await screen.findByRole("article", { name: "Cuenca del Plata" });
    fireEvent.click(within(tarjeta("Transfer Calafate")).getByRole("checkbox", { name: T.incluir }));
    fireEvent.click(botonEnviar());

    const dialogo = screen.getByRole("dialog", { name: "Enviar 2 pedidos (1 queda pendiente)" });
    expect(within(dialogo).getByText(T.dialogo.modoPrueba("ccalomarde@"))).toBeInTheDocument();
    expect(within(dialogo).getByText(/reservas8@cuencadelplata\.com/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/prov2@proveedor\.test/)).toBeInTheDocument();
    expect(within(dialogo).queryByText(/prov3@proveedor\.test/)).not.toBeInTheDocument();
    expect(within(dialogo).getByText("ccalomarde@hitravel.com.ar")).toBeInTheDocument();
    expect(within(dialogo).getByText("Leticia Gómez")).toBeInTheDocument();
    expect(within(dialogo).getByText(/Aventura Sur/)).toBeInTheDocument();

    // Confirmar todavía no manda nada (M3-03).
    fireEvent.click(within(dialogo).getByRole("button", { name: T.dialogo.confirmar }));
    expect(await within(dialogo).findByText(T.faltaConectar)).toBeInTheDocument();
    expect(acciones.enviarPedidos).toHaveBeenCalledWith({ reservaId: RESERVA, pedidoIds: [cuenca.id, hotel.id] });
  });

  it("envío real prendido: no muestra el modo prueba", async () => {
    abrir(REAL);
    await screen.findByRole("article", { name: "Cuenca del Plata" });
    fireEvent.click(botonEnviar());
    const dialogo = screen.getByRole("dialog", { name: "Enviar 3 pedidos" });
    expect(within(dialogo).queryByText(/Modo prueba/)).not.toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: T.dialogo.cancelar }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(acciones.enviarPedidos).not.toHaveBeenCalled();
  });
});
