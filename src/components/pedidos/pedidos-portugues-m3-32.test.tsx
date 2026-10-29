// @vitest-environment jsdom
//
// Spec M3-32 — verificación 1 (pantalla con datos simulados): la tarjeta de un pedido a un proveedor
// de Brasil dice "En portugués" junto al destinatario (fila 5); la de un proveedor argentino, no. El
// pedido a mano con un proveedor de Brasil arranca con el borrador en portugués (fila 6). Lo demás de
// la pantalla sigue en castellano (fila 4).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

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
const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const PRUEBA: ConfiguracionEnvio = { modoPrueba: true, destinoPrueba: "ccalomarde@", cc: ["ccalomarde@hitravel.com.ar"] };
const FIRMA = "{{nombre_de_quien_envia}}\nHi Travel South America";

const BORRADOR = { asunto: "Solicitud de reserva – Ana Prueba x 2", cuerpo: "¡Hola! ¿Cómo están?\n\nPasajeros: 2\n\n¡Muchas gracias!", firma: FIRMA };
const BORRADOR_PT = { asunto: "Solicitação de reserva – Ana Prueba x 2", cuerpo: "Olá! Tudo bem?\n\nPassageiros: 2\n\nMuito obrigado!", firma: FIRMA };

function pedido(n: number, parcial: Partial<PedidoGuardado> = {}): PedidoGuardado {
  return {
    id: ID(n),
    reserva_id: RESERVA,
    casilla: `casilla-${n}`,
    destinatarios: [`prov${n}@proveedor.test`],
    proveedor_ids: [`prov-${n}`],
    proveedores: [`Proveedor ${n}`],
    partes: [],
    asunto: `Pedido ${n}`,
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

const bambu = pedido(1, { proveedores: ["Bambu hostel"], destinatarios: ["hostelsbambu@gmail.com"], asunto: "Solicitação de reserva – Ana Prueba x 2", avisos: ["Falta la fecha de algo: completala antes de enviar."] });
const cuenca = pedido(2, { proveedores: ["Cuenca del Plata"], destinatarios: ["reservas8@cuencadelplata.com"] });

function pantalla(parcial: Partial<PantallaPedidos> = {}) {
  return {
    ok: true as const,
    reserva: { id: RESERVA, numero: "DK1593147", agencia: "Kilroy" },
    estadoReserva: "recibida" as const,
    pedidos: [bambu, cuenca],
    tareas: [],
    avisos: [],
    aMano: BORRADOR,
    aManoPt: BORRADOR_PT,
    enPortugues: [bambu.id],
    ...parcial,
  };
}

const abrir = () => render(<PedidosPantalla reservaId={RESERVA} firmante="Leticia Gómez" envio={PRUEBA} />);

beforeEach(() => {
  vi.clearAllMocks();
  acciones.armarPedidosDeLaReserva.mockResolvedValue(pantalla());
  acciones.buscarProveedoresDelDirectorio.mockResolvedValue({ ok: true, proveedores: [] });
});
afterEach(cleanup);

describe("fila 5 — la tarjeta dice el idioma", () => {
  it("Bambu (Brasil) dice 'En portugués' junto al destinatario; Cuenca del Plata no", async () => {
    abrir();
    const tarjetaBambu = await screen.findByRole("article", { name: "Bambu hostel" });
    const para = within(tarjetaBambu).getByText("hostelsbambu@gmail.com", { exact: false });
    expect(within(para).getByText(T.enPortugues)).toBeInTheDocument();
    const tarjetaCuenca = screen.getByRole("article", { name: "Cuenca del Plata" });
    expect(within(tarjetaCuenca).queryByText(T.enPortugues)).not.toBeInTheDocument();
  });

  it("el texto sigue editable y lo interno (los avisos, los botones) en castellano", async () => {
    abrir();
    const tarjeta = await screen.findByRole("article", { name: "Bambu hostel" });
    expect(within(tarjeta).getByLabelText(T.asunto)).toHaveValue("Solicitação de reserva – Ana Prueba x 2");
    expect(within(tarjeta).getByLabelText(T.asunto)).not.toBeDisabled();
    expect(within(tarjeta).getByText(T.incluir)).toBeInTheDocument();
  });

  it("sin la lista (una pantalla vieja), ninguna tarjeta lo dice", async () => {
    acciones.armarPedidosDeLaReserva.mockResolvedValueOnce(pantalla({ enPortugues: undefined }));
    abrir();
    await screen.findByRole("article", { name: "Bambu hostel" });
    expect(screen.queryByText(T.enPortugues)).not.toBeInTheDocument();
  });
});

describe("fila 6 — el pedido a mano con un proveedor de Brasil", () => {
  async function formulario() {
    abrir();
    fireEvent.click(await screen.findByRole("button", { name: A.agregar }));
    return screen.getByRole("form", { name: A.titulo });
  }

  async function elegir(form: HTMLElement, nombre: string, enPortugues: boolean) {
    acciones.buscarProveedoresDelDirectorio.mockResolvedValue({
      ok: true,
      proveedores: [{ id: "8f7c6a2e-1b1a-4c3e-9a55-2a0f6d5b9c11", nombre, ciudad: enPortugues ? "PARATY" : "SALTA", mails: ["reservas@prov.test"], enPortugues }],
    });
    fireEvent.change(within(form).getByLabelText(A.buscar), { target: { value: nombre.slice(0, 6) } });
    fireEvent.click(await within(form).findByRole("button", { name: new RegExp(nombre) }));
  }

  it("elegir una pousada de Paraty cambia el texto al de la plantilla pt; volver a uno argentino, al de castellano", async () => {
    const form = await formulario();
    expect(within(form).getByLabelText(T.texto)).toHaveValue(BORRADOR.cuerpo);
    await elegir(form, "Pousada Dom Angelo", true);
    expect(within(form).getByLabelText(T.asunto)).toHaveValue(BORRADOR_PT.asunto);
    expect(within(form).getByLabelText(T.texto)).toHaveValue(BORRADOR_PT.cuerpo);
    await elegir(form, "Hotel Salta", false);
    expect(within(form).getByLabelText(T.texto)).toHaveValue(BORRADOR.cuerpo);
  });

  it("no debe pasar: lo que la persona ya escribió no se pisa al elegir", async () => {
    const form = await formulario();
    fireEvent.change(within(form).getByLabelText(T.texto), { target: { value: "Hola, una noche extra" } });
    await elegir(form, "Pousada Dom Angelo", true);
    expect(within(form).getByLabelText(T.texto)).toHaveValue("Hola, una noche extra");
  });

  it("no debe pasar: el borrador en portugués sin tocar no se guarda", async () => {
    const form = await formulario();
    await elegir(form, "Pousada Dom Angelo", true);
    fireEvent.click(within(form).getByRole("button", { name: A.guardar }));
    expect(await within(form).findByText(A.sinTexto)).toBeInTheDocument();
    expect(acciones.agregarPedidoAManoDeLaReserva).not.toHaveBeenCalled();
  });
});
