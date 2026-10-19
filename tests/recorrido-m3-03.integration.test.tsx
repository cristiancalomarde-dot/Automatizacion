// @vitest-environment jsdom
//
// Spec M3-03 §4 — verificación 3 (el recorrido con las pantallas reales):
// sobre una reserva de prueba en la BASE DE PRUEBAS y con la sesión de una
// persona del equipo, la pantalla y las server actions de verdad (solo se
// reemplaza de dónde sale el cliente de Supabase: la sesión de prueba). El
// correo es un SMTP FALSO local y el IMAP falso de M2-07: nunca Ferozo.
//
// 1. Modo prueba: franja fija → "Enviar N pedidos" → confirmar → cada tarjeta
//    "Prueba enviada ✓" → al SMTP falso le llegan SOLO a la casilla de prueba →
//    el detalle sigue "recibida" con el "envío de prueba" en el historial.
// 2. Con el envío real prendido (contra el mismo SMTP falso): sin franja →
//    confirmar → "Enviado ✓ 14:32 · quién" → la copia en Enviados → el detalle
//    en "pedido a proveedor" con a quién, cuándo y quién, y "Ver los pedidos".
// Lo que crea se borra al final (solo eso).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { cargarPedidos } from "@/lib/pedidos/guardar";
import { horaCorta } from "@/lib/pedidos/pantalla";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearImapFalso, type ImapFalso } from "./helpers/imap-falso";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSmtpFalso, type SmtpFalso } from "./helpers/smtp-falso";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const cliente = vi.hoisted(() => ({ actual: null as unknown }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => cliente.actual }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => cliente.actual }));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams(),
  redirect: (destino: string) => {
    throw new Error(`redirect:${destino}`);
  },
}));

import { DetalleReservaPantalla } from "@/components/reservas/detalle-reserva-pantalla";
import PedidosPage from "@/app/(app)/reservas/[id]/pedidos/page";

const T = TEXTOS.pedidos;
const E = T.envio;
const ESPERA = { timeout: 60_000 };
const PREFIJO = "[test M3-03 recorrido]";
const OPERATIONS = "operations@falso.test";
const CLAVE = `clave-${randomUUID()}`;
const CC = "liquidaciones@falso.test";
const DESTINO_PRUEBA = "owner@falso.test";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-03-recorrido.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-19T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

async function abrirPedidos(id: string) {
  render(await PedidosPage({ params: Promise.resolve({ id }) }));
}

const botonEnviar = () => screen.getByRole("button", { name: /^Enviar \d+ pedidos?/ });

(credencialesSupabaseDisponibles() ? describe : describe.skip)("recorrido del envío de pedidos (spec M3-03 §4, V3)", { timeout: 240_000 }, () => {
  let admin: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let firmante: string;
  let smtp: SmtpFalso;
  let imap: ImapFalso;
  let reservaId: string;

  beforeAll(async () => {
    smtp = await crearSmtpFalso({ usuario: OPERATIONS, clave: CLAVE });
    imap = await crearImapFalso({ usuario: OPERATIONS, clave: CLAVE, permitirAppend: true, carpetas: [{ path: "INBOX" }, { path: "INBOX.Sent", atributos: ["\\Sent"] }] });
    // La casilla es la del SMTP falso local: nunca la de .env.local.
    vi.stubEnv("PEDIDOS_SMTP_HOST", "127.0.0.1");
    vi.stubEnv("PEDIDOS_SMTP_PORT", String(smtp.puerto));
    vi.stubEnv("PEDIDOS_SMTP_USER", OPERATIONS);
    vi.stubEnv("PEDIDOS_SMTP_PASSWORD", CLAVE);
    vi.stubEnv("PEDIDOS_IMAP_HOST", "127.0.0.1");
    vi.stubEnv("PEDIDOS_IMAP_PORT", String(imap.puerto));
    vi.stubEnv("PEDIDOS_CC", CC);
    vi.stubEnv("PEDIDOS_DESTINO_PRUEBA", DESTINO_PRUEBA);
    vi.stubEnv("PEDIDOS_ENVIO_REAL", "");

    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const sesion = await crearSesionDePrueba();
    cliente.actual = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { data } = await sesion.cliente.auth.getUser();
    usuarioId = data.user!.id;
    firmante = data.user!.email!.split("@")[0];
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-03 recorrido" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);

    const producto = await admin.from("producto").select("id").eq("codigo", "OD010D").single();
    if (producto.error) throw new Error(producto.error.message);
    const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
    const { reserva } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        estado: "recibida",
        pax: 2,
        pasajeros: [
          { nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" },
          { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
        ],
        habitacion: "Double Room - Hostel",
        bookingIdOriginal: "DK9000005/test",
        productoId: producto.data.id,
        fechaInicio: "2026-11-07",
        fechaFin: "2026-11-10",
        dePrueba: true,
      },
      admin,
    );
    reservaId = reserva.id;
  }, 120_000);

  afterEach(() => cleanup());

  afterAll(async () => {
    vi.unstubAllEnvs();
    await smtp?.detener();
    await imap?.detener();
    try {
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    } finally {
      await borrarSesion?.();
    }
  }, 120_000);

  it("1. modo prueba: franja, confirmar, 'Prueba enviada ✓', solo a la casilla de prueba, y la reserva sigue recibida", async () => {
    await abrirPedidos(reservaId);
    expect(screen.getByTestId("franja-prueba")).toHaveTextContent(T.franjaPrueba(DESTINO_PRUEBA));
    await waitFor(() => expect(screen.getAllByRole("article").length).toBeGreaterThan(0), ESPERA);
    const conMail = screen.getAllByRole("article").filter((t) => !within(t).getByRole("checkbox", { name: T.incluir }).hasAttribute("disabled"));
    const n = conMail.length;
    expect(n).toBeGreaterThan(0);

    fireEvent.click(botonEnviar());
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(T.dialogo.modoPrueba(DESTINO_PRUEBA))).toBeInTheDocument();
    expect(within(dialogo).getByText(firmante)).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: T.dialogo.confirmar }));

    const resumen = await screen.findByTestId("resumen-envio", {}, ESPERA);
    expect(resumen).toHaveTextContent(E.resumen(n, 0, true));
    for (const t of screen.getAllByRole("article").filter((x) => !within(x).getByRole("checkbox", { name: T.incluir }).hasAttribute("disabled"))) {
      expect(within(t).getByText(new RegExp(`^Prueba enviada ✓ \\d{2}:\\d{2} \\(llegó solo a ${DESTINO_PRUEBA.replace(".", "\\.")}\\)$`))).toBeInTheDocument();
    }
    // Al SMTP falso le llegó todo SOLO a la casilla de prueba (no debe pasar: un mail a un proveedor).
    expect(smtp.mensajes).toHaveLength(n);
    expect(smtp.mensajes.every((m) => m.para.length === 1 && m.para[0] === DESTINO_PRUEBA)).toBe(true);
    expect(imap.carpeta("INBOX.Sent").mensajes).toHaveLength(0);
    cleanup();

    // El detalle: sigue recibida, con el envío de prueba en el historial.
    render(<DetalleReservaPantalla id={reservaId} />);
    const seccion = await screen.findByTestId("pedidos-reserva", {}, ESPERA);
    expect(within(screen.getByTestId("encabezado-reserva")).getByText(TEXTOS.reservas.estados.recibida)).toBeInTheDocument();
    expect(within(seccion).getByTestId("historial-envios")).toHaveTextContent(`${firmante} hizo un envío de prueba`);
    expect(screen.getByRole("link", { name: TEXTOS.reserva.armarPedidos })).toBeInTheDocument();
  });

  it("2. envío real (al SMTP falso): sin franja, 'Enviado ✓ hh:mm · quién', copia en Enviados y el detalle en 'pedido a proveedor'", async () => {
    vi.stubEnv("PEDIDOS_ENVIO_REAL", "si");
    smtp.mensajes.length = 0;
    await abrirPedidos(reservaId);
    expect(screen.queryByTestId("franja-prueba")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("article").length).toBeGreaterThan(0), ESPERA);
    const antes = (await cargarPedidos(admin, reservaId)).pedidos.filter((p) => p.destinatarios.length > 0);

    fireEvent.click(botonEnviar());
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).queryByText(/Modo prueba/)).not.toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: T.dialogo.confirmar }));
    const resumen = await screen.findByTestId("resumen-envio", {}, ESPERA);
    expect(resumen).toHaveTextContent(E.resumen(antes.length, 0, false));

    const despues = (await cargarPedidos(admin, reservaId)).pedidos.filter((p) => p.destinatarios.length > 0);
    for (const p of despues) {
      expect(p.estado).toBe("enviado");
      const tarjeta = screen.getByRole("article", { name: p.proveedores.join(" y ") });
      expect(within(tarjeta).getByText(E.enviado(horaCorta(p.enviado_en!), firmante))).toBeInTheDocument();
      expect(within(tarjeta).getByRole("button", { name: E.reenviar })).toBeInTheDocument();
      expect(within(tarjeta).getByLabelText(T.texto)).toBeDisabled();
    }
    expect(smtp.mensajes).toHaveLength(antes.length);
    expect(smtp.mensajes.every((m) => m.para.includes(CC) && !m.para.includes(DESTINO_PRUEBA))).toBe(true);
    expect(imap.carpeta("INBOX.Sent").mensajes).toHaveLength(antes.length);
    cleanup();

    // El detalle: pedido a proveedor, a quién, cuándo y quién; y el camino de vuelta a los pedidos.
    render(<DetalleReservaPantalla id={reservaId} />);
    const seccion = await screen.findByTestId("pedidos-reserva", {}, ESPERA);
    expect(within(screen.getByTestId("encabezado-reserva")).getByText(TEXTOS.reservas.estados.pedido_a_proveedor)).toBeInTheDocument();
    for (const p of despues) expect(within(seccion).getAllByText(p.proveedores.join(" y ")).length).toBeGreaterThan(0);
    expect(within(seccion).getAllByText(new RegExp(`^Enviado .* · ${firmante}$`))).toHaveLength(despues.length);
    expect(within(seccion).getByTestId("historial-envios")).toHaveTextContent(`${firmante} envió`);
    expect(screen.getByRole("link", { name: TEXTOS.reserva.verPedidos })).toHaveAttribute("href", `/reservas/${reservaId}/pedidos`);
  });
});
