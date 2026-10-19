// @vitest-environment jsdom
//
// Spec M3-02 §4 — verificación 3 (el recorrido con las pantallas reales):
// sobre reservas de prueba en la BASE DE PRUEBAS y con la sesión de una
// persona del equipo, las pantallas y las server actions de verdad (solo se
// reemplaza de dónde sale el cliente de Supabase: la sesión de prueba).
//
// El recorrido: detalle de la reserva → "Armar pedidos a proveedores" →
// tarjetas, tareas y avisos → edita el texto (queda guardado) → vuelve a
// entrar y lo ve → "Volver a armar" pregunta y conserva lo editado →
// destilda un pedido → "Enviar N pedidos" → el diálogo con destinatarios, CC,
// quién firma y "Modo prueba" → confirmar responde que falta configurar la
// casilla operations@ (M3-03, sin conexión) y nada cambia. Lo que crea se borra al final.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { cargarPedidos } from "@/lib/pedidos/guardar";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada, ReservaEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const cliente = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => cliente.actual }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => cliente.actual }));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams(),
  redirect: (destino: string) => {
    throw new Error(`redirect:${destino}`);
  },
}));

import { DetalleReservaPantalla } from "@/components/reservas/detalle-reserva-pantalla";
import PedidosPage from "@/app/(app)/reservas/[id]/pedidos/page";

const T = TEXTOS.pedidos;
const ESPERA = { timeout: 60_000 };
const PREFIJO = "[test M3-02 recorrido]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-02-recorrido.hitravel.local>`,
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

(credencialesSupabaseDisponibles() ? describe : describe.skip)("recorrido de la revisión de pedidos (spec M3-02 §4, V3)", { timeout: 240_000 }, () => {
  let admin: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let firmante: string;
  const ids = new Map<string, string>();
  const reservas = new Map<string, string>();

  async function reservaDePrueba(extra: Partial<ReservaEntrada>): Promise<string> {
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
        bookingIdOriginal: "DK9000003/test",
        dePrueba: true,
        ...extra,
      },
      admin,
    );
    return reserva.id;
  }

  beforeAll(async () => {
    vi.stubEnv("PEDIDOS_ENVIO_REAL", "");
    vi.stubEnv("PEDIDOS_DESTINO_PRUEBA", "");
    vi.stubEnv("PEDIDOS_CC", "");
    // M3-03: sin la casilla configurada, confirmar no abre ninguna conexión (nunca el correo real en un test).
    vi.stubEnv("PEDIDOS_SMTP_HOST", "");
    vi.stubEnv("PEDIDOS_SMTP_USER", "");
    vi.stubEnv("PEDIDOS_SMTP_PASSWORD", "");
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const sesion = await crearSesionDePrueba();
    cliente.actual = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { data } = await sesion.cliente.auth.getUser();
    usuarioId = data.user!.id;
    firmante = data.user!.email!.split("@")[0];
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-02 recorrido" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);

    const productos = await admin.from("producto").select("id,codigo").in("codigo", ["ARCH31", "OD010D"]);
    if (productos.error) throw new Error(productos.error.message);
    for (const p of productos.data ?? []) ids.set(p.codigo, p.id);

    const arch31 = await cargarProducto(admin, ids.get("ARCH31")!);
    reservas.set(
      "ARCH31",
      await reservaDePrueba({
        productoId: ids.get("ARCH31"),
        fechaInicio: "2027-01-10",
        fechaFin: "2027-01-17",
        componentes: componentesDeLaReserva(arch31, "2027-01-10", { finalPuertoNatales: false, proveedorTransferPNT: null }),
      }),
    );
    reservas.set("revision", await reservaDePrueba({ productoId: ids.get("OD010D"), estado: "para_revision", motivosRevision: ["Falta el producto"] }));
  }, 120_000);

  afterEach(() => cleanup());

  afterAll(async () => {
    vi.unstubAllEnvs();
    try {
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    } finally {
      await borrarSesion?.();
    }
  }, 120_000);

  it("1. el detalle de una reserva recibida lleva a sus pedidos; una para revisión no", async () => {
    const id = reservas.get("ARCH31")!;
    render(<DetalleReservaPantalla id={id} />);
    const enlace = await screen.findByRole("link", { name: TEXTOS.reserva.armarPedidos }, ESPERA);
    expect(enlace).toHaveAttribute("href", `/reservas/${id}/pedidos`);
    cleanup();

    render(<DetalleReservaPantalla id={reservas.get("revision")!} />);
    const boton = await screen.findByRole("button", { name: TEXTOS.reserva.armarPedidos }, ESPERA);
    expect(boton).toBeDisabled();
    expect(screen.getByText(TEXTOS.reserva.resolverPrimero)).toBeInTheDocument();
    cleanup();

    // Si alguien entra directo por la URL, la pantalla dice por qué no arma.
    await abrirPedidos(reservas.get("revision")!);
    const error = await screen.findByRole("alert", {}, ESPERA);
    expect(error).toHaveTextContent(`${T.error} Resolvé primero lo que está para revisión.`);
  });

  it("2. ARCH31: tarjetas, tareas a mano, editar, volver a entrar, rearmar y el diálogo de envío", async () => {
    const id = reservas.get("ARCH31")!;
    await abrirPedidos(id);
    expect(screen.getByText(T.armando)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("article").length).toBeGreaterThan(1), ESPERA);

    const tarjetas = screen.getAllByRole("article");
    const conMail = tarjetas.filter((t) => !within(t).getByRole("checkbox", { name: T.incluir }).hasAttribute("disabled"));
    const sinMail = tarjetas.length - conMail.length;
    expect(botonEnviar()).toHaveTextContent(T.enviar(conMail.length, sinMail));

    // Las tareas a mano, aparte y sin contar en el botón.
    const tareas = screen.getByRole("region", { name: T.tareas });
    expect(within(tareas).getAllByText(/^Emitir boleto: /).length).toBeGreaterThan(0);
    // Y la firma con el nombre de quien tiene la sesión.
    expect(within(conMail[0]).getByText(new RegExp(firmante))).toBeInTheDocument();

    // Editar el texto de la primera: queda guardado como borrador editado.
    const primera = conMail[0];
    const nombre = primera.getAttribute("aria-labelledby")!;
    const proveedor = document.getElementById(nombre)!.textContent!;
    const texto = within(primera).getByLabelText(T.texto) as HTMLTextAreaElement;
    const editado = `${texto.value}\n\nPD: el pasajero llega tarde (recorrido M3-02).`;
    fireEvent.change(texto, { target: { value: editado } });
    fireEvent.blur(texto);
    expect(await within(primera).findByText(T.guardado, {}, ESPERA)).toBeInTheDocument();
    const enBase = await cargarPedidos(admin, id);
    expect(enBase.pedidos.find((p) => p.cuerpo === editado)?.editado).toBe(true);
    cleanup();

    // Volver a entrar: lo editado sigue ahí.
    await abrirPedidos(id);
    const otraVez = await screen.findByRole("article", { name: proveedor }, ESPERA);
    expect(within(otraVez).getByLabelText(T.texto)).toHaveValue(editado);
    expect(within(otraVez).getByText(T.editado)).toBeInTheDocument();

    // "Volver a armar" pregunta; conservar deja lo editado.
    fireEvent.click(screen.getByRole("button", { name: T.volverAArmar }));
    const pregunta = screen.getByRole("dialog", { name: T.rearmar.titulo });
    expect(pregunta).toHaveTextContent(T.rearmar.editados(1));
    fireEvent.click(within(pregunta).getByRole("button", { name: T.rearmar.conservar }));
    await waitFor(() => expect(screen.getByRole("button", { name: T.volverAArmar })).toBeEnabled(), ESPERA);
    expect(within(screen.getByRole("article", { name: proveedor })).getByLabelText(T.texto)).toHaveValue(editado);

    // Destildar uno baja el número del botón.
    const n = conMail.length;
    const otra = screen.getAllByRole("article").find((t) => t.getAttribute("aria-labelledby") !== nombre && !within(t).getByRole("checkbox", { name: T.incluir }).hasAttribute("disabled"))!;
    fireEvent.click(within(otra).getByRole("checkbox", { name: T.incluir }));
    expect(botonEnviar()).toHaveTextContent(T.enviar(n - 1, sinMail));

    // El diálogo: destinatarios, CC, quién firma y el modo prueba bien visible.
    const antes = await cargarPedidos(admin, id);
    fireEvent.click(botonEnviar());
    const dialogo = screen.getByRole("dialog", { name: T.enviar(n - 1, sinMail) });
    expect(within(dialogo).getByText(T.dialogo.modoPrueba("ccalomarde@"))).toBeInTheDocument();
    expect(within(dialogo).getByText("ccalomarde@hitravel.com.ar")).toBeInTheDocument();
    expect(within(dialogo).getByText(firmante)).toBeInTheDocument();
    expect(within(dialogo).getAllByRole("listitem").length).toBeGreaterThanOrEqual(n - 1);

    // M3-03: sin la casilla configurada, confirmar no manda nada y lo dice en llano.
    fireEvent.click(within(dialogo).getByRole("button", { name: T.dialogo.confirmar }));
    expect(await within(dialogo).findByText(T.envio.faltaConfigurar, {}, ESPERA)).toBeInTheDocument();
    const despues = await cargarPedidos(admin, id);
    expect(despues.pedidos).toEqual(antes.pedidos);
    const reserva = await admin.from("reserva").select("estado").eq("id", id).single();
    expect(reserva.data?.estado).toBe("recibida");
  });
});
