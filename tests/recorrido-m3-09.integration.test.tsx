// @vitest-environment jsdom
//
// Spec M3-09 §4 — verificación 3 (el recorrido con las pantallas reales): sobre
// una reserva de prueba ARCH31 en la BASE DE PRUEBAS y con la sesión de una
// persona del equipo, la pantalla y las server actions de verdad (solo se
// reemplaza de dónde sale el cliente de Supabase: la sesión de prueba). El
// correo es un SMTP FALSO local y el IMAP falso de M2-07: nunca Ferozo.
//
// 1. Abrir los pedidos → "Agregar un pedido a mano" → buscar el hotel de PUQ en
//    el directorio → escribir la noche extra → "Guardar pedido" → la tarjeta
//    "A mano" → "Enviar 1 pedido" → confirmar → en modo prueba llega SOLO a la
//    casilla de prueba, con el proveedor real arriba.
// 2. Con el envío real prendido (contra el mismo SMTP falso): "Enviado ✓ hh:mm ·
//    quién", ya no se puede sacar, y el detalle cuenta quién lo agregó.
// 3. Uno escrito a mano a un mail que no está en el directorio → "Sacar este
//    pedido" → confirmar → se va de la pantalla, de la base, y queda en el
//    historial.
// Lo que crea se borra al final (solo eso).
import { randomUUID } from "node:crypto";
import { simpleParser } from "mailparser";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { cargarPedidos } from "@/lib/pedidos/guardar";
import { horaCorta } from "@/lib/pedidos/pantalla";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
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
const A = T.aMano;
const E = T.envio;
const ESPERA = { timeout: 60_000 };
const PREFIJO = "[test M3-09 recorrido]";
const OPERATIONS = "operations@falso.test";
const CLAVE = `clave-${randomUUID()}`;
const CC = "liquidaciones@falso.test";
const DESTINO_PRUEBA = "owner@falso.test";
const NOCHE_EXTRA = "1 noche extra, IN 17/01/2027 OUT 18/01/2027, habitación doble";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

async function abrirPedidos(id: string) {
  render(await PedidosPage({ params: Promise.resolve({ id }) }));
  await waitFor(() => expect(screen.getAllByRole("article").length).toBeGreaterThan(0), ESPERA);
}

const botonEnviar = () => screen.getByRole("button", { name: /^Enviar \d+ pedidos?/ });
const tarjetasAMano = () => screen.getAllByRole("article").filter((t) => within(t).queryByText(A.etiqueta));

/** Deja incluidos solo los pedidos a mano (los armados se mandan en otro momento). */
function soloLosAMano() {
  for (const t of screen.getAllByRole("article")) {
    const incluir = within(t).getByRole("checkbox", { name: T.incluir });
    if (!within(t).queryByText(A.etiqueta) && !incluir.hasAttribute("disabled") && (incluir as HTMLInputElement).checked) fireEvent.click(incluir);
  }
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("recorrido del pedido a mano (spec M3-09 §4, V3)", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let firmante: string;
  let smtp: SmtpFalso;
  let imap: ImapFalso;
  let reservaId: string;
  let hotel: { id: string; nombre: string; mails: string[] };

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
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-09 recorrido" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);

    // El hotel de PUQ del directorio de la base de pruebas.
    const h = await admin.from("proveedor").select("id,nombre,mails").ilike("nombre", "Hospedaje Magallanes").single();
    if (h.error) throw new Error(`Falta el hotel de PUQ en el directorio de pruebas: ${h.error.message}`);
    hotel = h.data as typeof hotel;

    const producto = await admin.from("producto").select("id").eq("codigo", "ARCH31").single();
    if (producto.error) throw new Error(producto.error.message);
    const detalle = await cargarProducto(admin, producto.data.id);
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-09-recorrido.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-20T12:00:00.000Z",
        cuerpoTexto: "Mail sintético de prueba (sin datos de nadie). Post night in PUQ.",
        agencia: "Kilroy",
        dePrueba: true,
      },
      admin,
    );
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
        bookingIdOriginal: "DK9000009/test",
        productoId: producto.data.id,
        fechaInicio: "2027-01-10",
        fechaFin: "2027-01-17",
        componentes: componentesDeLaReserva(detalle, "2027-01-10", { finalPuertoNatales: false, proveedorTransferPNT: null }),
        pedidosEspeciales: "Post night in PUQ",
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

  it("1. buscar el hotel de PUQ, escribir la noche extra, guardar, y en modo prueba llega solo a la casilla de prueba", async () => {
    await abrirPedidos(reservaId);
    expect(screen.getByTestId("franja-prueba")).toBeInTheDocument();
    const armados = screen.getAllByRole("article").length;

    fireEvent.click(screen.getByRole("button", { name: A.agregar }));
    const form = screen.getByRole("form", { name: A.titulo });
    // M3-16: sin el número de la agencia; con las fechas de la reserva.
    expect(within(form).getByLabelText(T.asunto)).toHaveValue("Solicitud de reserva – Ana Prueba – 10 al 17 ene 2027");
    const texto = within(form).getByLabelText(T.texto) as HTMLTextAreaElement;
    expect(texto.value).toContain("pedirles la siguiente reserva:");

    fireEvent.change(within(form).getByLabelText(A.buscar), { target: { value: "Magallanes" } });
    fireEvent.click(await within(form).findByRole("button", { name: new RegExp(hotel.nombre) }, ESPERA));
    expect(within(form).getByLabelText(A.para)).toHaveValue(hotel.mails.join(", "));
    fireEvent.change(texto, { target: { value: texto.value.replace("reserva:\n\n", `reserva:\n\n${NOCHE_EXTRA}`) } });
    fireEvent.click(within(form).getByRole("button", { name: A.guardar }));

    await waitFor(() => expect(tarjetasAMano()).toHaveLength(1), ESPERA);
    expect(screen.getAllByRole("article")).toHaveLength(armados + 1);
    const tarjeta = tarjetasAMano()[0];
    expect(within(tarjeta).getByRole("heading", { name: hotel.nombre })).toBeInTheDocument();
    expect((within(tarjeta).getByLabelText(T.texto) as HTMLTextAreaElement).value).toContain(NOCHE_EXTRA);

    soloLosAMano();
    expect(botonEnviar()).toHaveTextContent(/^Enviar 1 pedido\b/);
    fireEvent.click(botonEnviar());
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(`${hotel.nombre} — ${hotel.mails.join(", ")}`)).toBeInTheDocument();
    expect(within(dialogo).getByText(T.dialogo.modoPrueba(DESTINO_PRUEBA))).toBeInTheDocument();
    smtp.mensajes.length = 0;
    fireEvent.click(within(dialogo).getByRole("button", { name: T.dialogo.confirmar }));

    expect(await screen.findByTestId("resumen-envio", {}, ESPERA)).toHaveTextContent(E.resumen(1, 0, true));
    expect(within(tarjetasAMano()[0]).getByText(new RegExp(`^Prueba enviada ✓ \\d{2}:\\d{2} \\(llegó solo a ${DESTINO_PRUEBA.replace(".", "\\.")}\\)$`))).toBeInTheDocument();
    // Al SMTP falso le llegó UNO, solo a la casilla de prueba, con el proveedor real arriba.
    expect(smtp.mensajes).toHaveLength(1);
    expect(smtp.mensajes[0].para).toEqual([DESTINO_PRUEBA]);
    const leido = await simpleParser(smtp.mensajes[0].crudo);
    expect(leido.subject).toBe("[PRUEBA] Solicitud de reserva – Ana Prueba – 10 al 17 ene 2027");
    expect(leido.text).toContain(E.ibaPara(hotel.nombre, hotel.mails.join(", ")));
    expect(leido.text).toContain(NOCHE_EXTRA);
    expect(leido.text).toContain(firmante);
  });

  it("2. envío real (al SMTP falso): 'Enviado ✓ hh:mm · quién', ya no se saca, y el detalle cuenta quién lo agregó", async () => {
    vi.stubEnv("PEDIDOS_ENVIO_REAL", "si");
    await abrirPedidos(reservaId);
    // Volver a entrar rearma: el pedido a mano sigue ahí, igual.
    expect(tarjetasAMano()).toHaveLength(1);
    soloLosAMano();
    smtp.mensajes.length = 0;
    fireEvent.click(botonEnviar());
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: T.dialogo.confirmar }));
    expect(await screen.findByTestId("resumen-envio", {}, ESPERA)).toHaveTextContent(E.resumen(1, 0, false));

    const enviado = (await cargarPedidos(admin, reservaId)).pedidos.find((p) => p.a_mano)!;
    expect(enviado.estado).toBe("enviado");
    const tarjeta = tarjetasAMano()[0];
    expect(within(tarjeta).getByText(E.enviado(horaCorta(enviado.enviado_en!), firmante))).toBeInTheDocument();
    expect(within(tarjeta).queryByRole("button", { name: A.sacar })).not.toBeInTheDocument();
    expect(smtp.mensajes).toHaveLength(1);
    expect(smtp.mensajes[0].para).toEqual(expect.arrayContaining([...hotel.mails, CC]));
    expect(smtp.mensajes[0].para).not.toContain(DESTINO_PRUEBA);
    cleanup();

    render(<DetalleReservaPantalla id={reservaId} />);
    const seccion = await screen.findByTestId("pedidos-reserva", {}, ESPERA);
    expect(within(seccion).getByTestId("historial-a-mano")).toHaveTextContent(A.historialAgrego("Test M3-09 recorrido", hotel.nombre));
  });

  it("3. uno a un mail fuera del directorio: 'Sacar este pedido' → confirmar → se va, y queda en el historial", async () => {
    vi.stubEnv("PEDIDOS_ENVIO_REAL", "");
    await abrirPedidos(reservaId);
    fireEvent.click(screen.getByRole("button", { name: A.agregar }));
    const form = screen.getByRole("form", { name: A.titulo });
    fireEvent.change(within(form).getByLabelText(A.buscar), { target: { value: "Hotel que no existe zzz" } });
    expect(await within(form).findByText(A.sinCoincidencias, {}, ESPERA)).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText(A.para), { target: { value: "consultas@hotel-fuera.test" } });
    fireEvent.change(within(form).getByLabelText(T.texto), { target: { value: "¿Tienen lugar para 2 el 17/01/2027?" } });
    fireEvent.click(within(form).getByRole("button", { name: A.guardar }));
    const tarjeta = await screen.findByRole("article", { name: "consultas@hotel-fuera.test" }, ESPERA);

    fireEvent.click(within(tarjeta).getByRole("button", { name: A.sacar }));
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent(A.sacarPregunta("consultas@hotel-fuera.test"));
    fireEvent.click(within(dialogo).getByRole("button", { name: A.sacarConfirmar }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "consultas@hotel-fuera.test" })).not.toBeInTheDocument(), ESPERA);
    expect((await cargarPedidos(admin, reservaId)).pedidos.filter((p) => p.a_mano).map((p) => p.proveedores)).toEqual([[hotel.nombre]]);
    cleanup();

    render(<DetalleReservaPantalla id={reservaId} />);
    const historial = within(await screen.findByTestId("pedidos-reserva", {}, ESPERA)).getByTestId("historial-a-mano");
    expect(historial).toHaveTextContent(A.historialSaco("Test M3-09 recorrido", "consultas@hotel-fuera.test"));
  });
});
