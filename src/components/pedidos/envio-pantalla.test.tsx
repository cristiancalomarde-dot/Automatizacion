// @vitest-environment jsdom
//
// Spec M3-03 — verificación 1 (pantalla con datos simulados): la franja de
// modo prueba, "Enviando…" → "Enviado ✓ 14:32", "No se pudo enviar ✗" con
// "Reintentar", "Reenviar" explícito, lo enviado ya no se edita ni cuenta en
// "Enviar N", y el error de configuración en llano (§4, filas 6, 7, 9 y 10).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const acciones = vi.hoisted(() => ({
  armarPedidosDeLaReserva: vi.fn(),
  guardarBorradorDePedido: vi.fn(),
  enviarPedidos: vi.fn(),
}));
vi.mock("@/app/(app)/reservas/[id]/pedidos/acciones", () => acciones);
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { PedidoGuardado } from "@/lib/pedidos/guardar";
import { horaCorta, type ConfiguracionEnvio } from "@/lib/pedidos/pantalla";
import type { EnvioHecho } from "@/lib/pedidos/revision";
import { TEXTOS } from "@/lib/textos";
import { PedidosPantalla } from "./pedidos-pantalla";

const T = TEXTOS.pedidos;
const E = T.envio;
const RESERVA = "1b6e1f0a-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const EN = "2026-10-19T17:32:00.000Z";

function pedido(n: number, parcial: Partial<PedidoGuardado> = {}): PedidoGuardado {
  return {
    id: ID(n),
    reserva_id: RESERVA,
    casilla: `casilla-${n}`,
    destinatarios: [`prov${n}@proveedor.test`],
    proveedor_ids: [`prov-${n}`],
    proveedores: [`Proveedor ${n}`],
    partes: [],
    asunto: `Reserva (${n})`,
    cuerpo: `Hola ${n}`,
    firma: "{{nombre_de_quien_envia}}\nHI Travel",
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

const enviado = (p: PedidoGuardado): PedidoGuardado => ({ ...p, estado: "enviado", enviado_en: EN, enviado_por_nombre: "Leticia Gómez", message_id: "<m@x>" });

const PRUEBA: ConfiguracionEnvio = { modoPrueba: true, destinoPrueba: "ccalomarde@", cc: ["ccalomarde@hitravel.com.ar"] };
const REAL: ConfiguracionEnvio = { modoPrueba: false, destinoPrueba: "ccalomarde@", cc: ["ccalomarde@hitravel.com.ar"] };

const uno = pedido(1);
const dos = pedido(2);

function pantalla(pedidos: PedidoGuardado[]) {
  return { ok: true as const, reserva: { id: RESERVA, numero: "DK1/test", agencia: "Kilroy" }, pedidos, tareas: [], avisos: [] };
}

function respuesta(parcial: Partial<EnvioHecho>): EnvioHecho {
  return {
    ok: true,
    modoPrueba: false,
    destinoPrueba: "ccalomarde@hitravel.com.ar",
    resultados: [],
    avisos: [],
    pedidos: [],
    reserva: { estado: "pedido_a_proveedor", pedidoIncompleto: false },
    ...parcial,
  };
}

const abrir = (envio: ConfiguracionEnvio) => render(<PedidosPantalla reservaId={RESERVA} firmante="Leticia Gómez" envio={envio} />);
const botonEnviar = () => screen.getByRole("button", { name: /^Enviar \d+ pedidos?/ });

beforeEach(() => {
  vi.clearAllMocks();
  acciones.armarPedidosDeLaReserva.mockResolvedValue(pantalla([uno, dos]));
});
afterEach(cleanup);

describe("modo prueba (§4)", () => {
  it("una franja fija lo dice arriba de todo; con el envío real prendido no está", async () => {
    abrir(PRUEBA);
    await screen.findByRole("article", { name: "Proveedor 1" });
    expect(screen.getByTestId("franja-prueba")).toHaveTextContent(T.franjaPrueba("ccalomarde@"));
    cleanup();
    abrir(REAL);
    await screen.findByRole("article", { name: "Proveedor 1" });
    expect(screen.queryByTestId("franja-prueba")).not.toBeInTheDocument();
  });
});

describe("enviar desde el diálogo (filas 6, 7 y 10)", () => {
  it("'Enviando…' en cada tarjeta y después 'Enviado ✓ 14:32' o 'No se pudo enviar ✗' con Reintentar", async () => {
    let terminar: (r: EnvioHecho) => void = () => undefined;
    acciones.enviarPedidos.mockReturnValue(new Promise<EnvioHecho>((r) => (terminar = r)));
    abrir(REAL);
    await screen.findByRole("article", { name: "Proveedor 1" });
    fireEvent.click(botonEnviar());
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.dialogo.confirmar }));

    // Exige la confirmación (la manda el diálogo) y muestra "Enviando…" en las dos.
    expect(acciones.enviarPedidos).toHaveBeenCalledWith({ reservaId: RESERVA, pedidoIds: [uno.id, dos.id], confirmado: true });
    await waitFor(() => expect(within(screen.getByRole("article", { name: "Proveedor 1" })).getByText(E.enviando)).toBeInTheDocument());
    expect(within(screen.getByRole("article", { name: "Proveedor 2" })).getByText(E.enviando)).toBeInTheDocument();

    const motivo = E.rechazado("prov2@proveedor.test");
    terminar(
      respuesta({
        resultados: [
          { pedidoId: uno.id, tipo: "enviado", enviadoEn: EN, prueba: false },
          { pedidoId: dos.id, tipo: "fallo", motivo },
        ],
        pedidos: [enviado(uno), { ...dos, estado: "fallo", motivo_fallo: motivo }],
        reserva: { estado: "pedido_a_proveedor", pedidoIncompleto: true },
      }),
    );

    const t1 = await screen.findByRole("article", { name: "Proveedor 1" });
    expect(await within(t1).findByText(E.enviado(horaCorta(EN), "Leticia Gómez"))).toBeInTheDocument();
    // Lo enviado ya no se edita ni se vuelve a incluir.
    expect(within(t1).getByLabelText(T.texto)).toBeDisabled();
    expect(within(t1).getByRole("checkbox", { name: T.incluir })).toBeDisabled();
    const t2 = screen.getByRole("article", { name: "Proveedor 2" });
    expect(within(t2).getByText(E.fallo(motivo))).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("resumen-envio")).toHaveTextContent(E.resumen(1, 1, false));
    expect(within(screen.getByTestId("resumen-envio")).getByRole("link", { name: T.volver })).toHaveAttribute("href", `/reservas/${RESERVA}`);
    // El botón de abajo cuenta solo el que falló.
    expect(botonEnviar()).toHaveTextContent("Enviar 1 pedido");

    // Reintentar: abre la confirmación solo con ese pedido.
    acciones.enviarPedidos.mockResolvedValueOnce(
      respuesta({ resultados: [{ pedidoId: dos.id, tipo: "enviado", enviadoEn: EN, prueba: false }], pedidos: [enviado(uno), enviado(dos)] }),
    );
    fireEvent.click(within(t2).getByRole("button", { name: E.reintentar }));
    const dialogo = screen.getByRole("dialog", { name: E.tituloReintentar });
    expect(within(dialogo).getByText(/prov2@proveedor\.test/)).toBeInTheDocument();
    expect(within(dialogo).queryByText(/prov1@proveedor\.test/)).not.toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: T.dialogo.confirmar }));
    expect(acciones.enviarPedidos).toHaveBeenLastCalledWith({ reservaId: RESERVA, pedidoIds: [dos.id], confirmado: true });
    expect(await within(screen.getByRole("article", { name: "Proveedor 2" })).findByText(E.enviado(horaCorta(EN), "Leticia Gómez"))).toBeInTheDocument();
  });

  it("'Reenviar' uno ya enviado: confirmación aparte, con el aviso, y va con reenviar", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValue(pantalla([enviado(uno), dos]));
    acciones.enviarPedidos.mockResolvedValue(respuesta({ resultados: [{ pedidoId: uno.id, tipo: "enviado", enviadoEn: EN, prueba: false }], pedidos: [enviado(uno), dos] }));
    abrir(REAL);
    const t1 = await screen.findByRole("article", { name: "Proveedor 1" });
    expect(botonEnviar()).toHaveTextContent("Enviar 1 pedido");
    fireEvent.click(within(t1).getByRole("button", { name: E.reenviar }));
    const dialogo = screen.getByRole("dialog", { name: E.tituloReenviar });
    expect(within(dialogo).getByText(E.avisoReenviar)).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: T.dialogo.confirmar }));
    expect(acciones.enviarPedidos).toHaveBeenCalledWith({ reservaId: RESERVA, pedidoIds: [uno.id], confirmado: true, reenviar: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cancelar el diálogo no manda nada", async () => {
    abrir(REAL);
    await screen.findByRole("article", { name: "Proveedor 1" });
    fireEvent.click(botonEnviar());
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.dialogo.cancelar }));
    expect(acciones.enviarPedidos).not.toHaveBeenCalled();
  });

  it("falta la casilla: el diálogo dice qué falta en llano y las tarjetas quedan como estaban", async () => {
    acciones.enviarPedidos.mockResolvedValue({ ok: false, error: E.faltaConfigurar });
    abrir(PRUEBA);
    await screen.findByRole("article", { name: "Proveedor 1" });
    fireEvent.click(botonEnviar());
    const dialogo = screen.getByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: T.dialogo.confirmar }));
    expect(await within(dialogo).findByText(E.faltaConfigurar)).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Proveedor 1" })).queryByText(E.enviando)).not.toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Proveedor 1" })).getByLabelText(T.texto)).toBeEnabled();
  });

  it("modo prueba: la tarjeta dice que la prueba llegó solo a la casilla de prueba", async () => {
    const probado = { ...uno, envio_prueba_en: EN, envio_prueba_por_nombre: "Leticia Gómez" };
    acciones.enviarPedidos.mockResolvedValue(
      respuesta({ modoPrueba: true, resultados: [{ pedidoId: uno.id, tipo: "enviado", enviadoEn: EN, prueba: true }], pedidos: [probado, dos], reserva: { estado: "recibida", pedidoIncompleto: false } }),
    );
    abrir(PRUEBA);
    await screen.findByRole("article", { name: "Proveedor 1" });
    fireEvent.click(within(screen.getByRole("article", { name: "Proveedor 2" })).getByRole("checkbox", { name: T.incluir }));
    fireEvent.click(botonEnviar());
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.dialogo.confirmar }));
    const t1 = screen.getByRole("article", { name: "Proveedor 1" });
    expect(await within(t1).findByText(E.pruebaEnviada(horaCorta(EN), "ccalomarde@"))).toBeInTheDocument();
    expect(screen.getByTestId("resumen-envio")).toHaveTextContent(E.resumen(1, 0, true));
    // En modo prueba el pedido sigue siendo un borrador: se puede volver a probar o mandar de verdad después.
    expect(within(t1).getByLabelText(T.texto)).toBeEnabled();
  });

  it("un pedido que otro ya mandó: lo dice en su tarjeta sin mandarlo de nuevo", async () => {
    acciones.enviarPedidos.mockResolvedValue(
      respuesta({ resultados: [{ pedidoId: uno.id, tipo: "no_enviado", motivo: E.yaEnviado }], pedidos: [enviado(uno), dos] }),
    );
    abrir(REAL);
    await screen.findByRole("article", { name: "Proveedor 1" });
    fireEvent.click(within(screen.getByRole("article", { name: "Proveedor 2" })).getByRole("checkbox", { name: T.incluir }));
    fireEvent.click(botonEnviar());
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.dialogo.confirmar }));
    expect(await within(screen.getByRole("article", { name: "Proveedor 1" })).findByText(E.yaEnviado)).toBeInTheDocument();
  });
});
