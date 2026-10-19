// @vitest-environment jsdom
//
// Spec M3-05 — verificación 3 (el recorrido con las pantallas reales): sobre
// la BASE DE PRUEBAS y con la sesión de una persona del equipo, el detalle de
// la reserva y la server action de verdad (solo se reemplaza de dónde sale el
// cliente de Supabase: la sesión de prueba).
//
// El caso que lo motivó: Kilroy manda "HI - La Paz Starter Package (Adventure
// Brew Hostal)" y la IA sugiere OD031 con 85%. La persona ve el recuadro,
// confirma con el OK corto y la reserva queda recibida con OD031, con el
// botón "Armar pedidos a proveedores" y el historial; la app aprendió el
// nombre. Después, una de prueba sin sugerencia: buscar en el catálogo,
// cancelar (no cambia nada), elegir y confirmar (sin aprender). Lo de prueba
// se borra; la real queda en la base de pruebas (M2-06) y lo aprendido se borra.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { normalizarNombre } from "@/lib/reservas/emparejar/emparejar";
import { MOTIVOS_EMPAREJADO as M } from "@/lib/reservas/emparejar/motivos";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { ReservaEntrada } from "@/lib/reservas/tipos";
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
}));

import { DetalleReservaPantalla } from "@/components/reservas/detalle-reserva-pantalla";

const T = TEXTOS.reserva.confirmarProducto;
const ESPERA = { timeout: 60_000 };
const PREFIJO = "[test M3-05 recorrido]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

(credencialesSupabaseDisponibles() ? describe : describe.skip)("recorrido de confirmar el producto (spec M3-05, V3)", { timeout: 240_000 }, () => {
  let admin: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let od031: { id: string; codigo: string; nombre: string };
  const aprendidos: string[] = [];

  async function reserva(dePrueba: boolean, nombre: string, extra: Partial<ReservaEntrada> = {}): Promise<string> {
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-05-recorrido.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-19T12:00:00.000Z",
        cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
        agencia: "Kilroy",
        dePrueba,
      },
      admin,
    );
    const ficha = {
      tipo_mail: { valor: "reserva_nueva", confianza: 1 },
      productos: [{ nombre, codigo: null, fecha_inicio: null, fecha_fin: null, noches: null, habitacion: null, punto_recogida: null, opcionales: [], confianza: 1 }],
    } as unknown as FichaLectura;
    const { reserva: r } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        bookingId: `UK305${randomUUID().slice(0, 8)}`,
        estado: "para_revision",
        motivosRevision: [M.noSeguro(nombre)],
        productoTextoAgencia: nombre,
        fechaInicio: "2027-04-02",
        fechaFin: "2027-04-05",
        pax: 1,
        datosExtraidos: ficha,
        dePrueba,
        ...extra,
      },
      admin,
    );
    return r.id;
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const sesion = await crearSesionDePrueba();
    cliente.actual = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { data } = await sesion.cliente.auth.getUser();
    usuarioId = data.user!.id;
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-05 recorrido" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    const p = await admin.from("producto").select("id,codigo,nombre").eq("codigo", "OD031").single();
    if (p.error) throw new Error(p.error.message);
    od031 = p.data;
  }, 120_000);

  afterEach(() => cleanup());

  afterAll(async () => {
    try {
      if (aprendidos.length) await admin.from("codigo_externo").delete().eq("agencia", "Kilroy").in("codigo", aprendidos);
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    } finally {
      await borrarSesion?.();
    }
  }, 120_000);

  it("1. el caso de Kilroy: confirmar la sugerencia de la IA deja la reserva recibida, con pedidos e historial, y la app aprende", async () => {
    const nombre = `HI - La Paz Starter Package (Adventure Brew Hostal) ${randomUUID().slice(0, 6)}`;
    aprendidos.push(normalizarNombre(nombre));
    const id = await reserva(false, nombre, {
      motivosRevision: [M.noSeguro(nombre, { codigo: "OD031", confianza: 0.85 })],
      sugerenciaProductoId: od031.id,
    });

    render(<DetalleReservaPantalla id={id} />);
    const recuadro = await screen.findByRole("region", { name: T.titulo }, ESPERA);
    expect(within(recuadro).getByText(T.agenciaMando("Kilroy", nombre))).toBeInTheDocument();
    expect(within(recuadro).getByText(T.seguridad(85))).toBeInTheDocument();
    // Mientras está para revisión, los pedidos esperan.
    expect(screen.getByRole("button", { name: TEXTOS.reserva.armarPedidos })).toBeDisabled();

    fireEvent.click(within(recuadro).getByRole("button", { name: T.confirmar("OD031", od031.nombre) }));
    const dialogo = screen.getByRole("dialog", { name: T.dialogo });
    expect(dialogo).toHaveTextContent(`${T.pregunta(nombre, "OD031", od031.nombre)} ${T.aprende("Kilroy")}`);
    fireEvent.click(within(dialogo).getByRole("button", { name: T.si }));

    expect(await screen.findByText(T.listo(true, "OD031", "Kilroy", true), {}, ESPERA)).toBeInTheDocument();
    const enlace = await screen.findByRole("link", { name: TEXTOS.reserva.armarPedidos }, ESPERA);
    expect(enlace).toHaveAttribute("href", `/reservas/${id}/pedidos`);
    expect(screen.queryByRole("region", { name: T.titulo })).toBeNull();
    expect(within(screen.getByTestId("producto-reserva")).getByRole("link", { name: "OD031" })).toBeInTheDocument();
    expect(within(screen.getByTestId("historial-producto")).getByText(/confirmó el producto OD031 \(sugerido por la IA\)$/)).toBeInTheDocument();

    const guardada = (await admin.from("reserva").select("estado,producto_id,origen_emparejado").eq("id", id).single()).data;
    expect(guardada).toEqual({ estado: "recibida", producto_id: od031.id, origen_emparejado: "ia" });
    const aprendido = (await admin.from("codigo_externo").select("producto_id,origen").eq("agencia", "Kilroy").eq("codigo", normalizarNombre(nombre))).data;
    expect(aprendido).toEqual([{ producto_id: od031.id, origen: "aprendido" }]);
  });

  it("2. sin sugerencia: buscar en el catálogo, cancelar no cambia nada, elegir y confirmar (una de prueba no aprende)", async () => {
    const nombre = `Bolivia start ${randomUUID().slice(0, 6)}`;
    const id = await reserva(true, nombre);
    const antes = (await admin.from("reserva").select("*").eq("id", id).single()).data;

    render(<DetalleReservaPantalla id={id} />);
    const recuadro = await screen.findByRole("region", { name: T.titulo }, ESPERA);
    expect(within(recuadro).queryByRole("button", { name: /^Confirmar: es/ })).toBeNull();
    fireEvent.click(within(recuadro).getByRole("button", { name: T.elegir }));
    const buscador = within(recuadro).getByRole("searchbox", { name: T.buscar });

    fireEvent.change(buscador, { target: { value: "OD03" } });
    const lista = await within(recuadro).findByRole("list", { name: T.resultados }, ESPERA);
    expect(within(lista).getByRole("button", { name: T.elegirEste("OD031", od031.nombre) })).toBeInTheDocument();
    fireEvent.change(buscador, { target: { value: "La Paz" } });
    const elegir = within(within(recuadro).getByRole("list", { name: T.resultados })).getByRole("button", { name: T.elegirEste("OD031", od031.nombre) });

    // Cancelar el OK corto no cambia nada.
    fireEvent.click(elegir);
    const dialogo = screen.getByRole("dialog", { name: T.dialogo });
    expect(dialogo).toHaveTextContent(T.deMuestraNoAprende);
    fireEvent.click(within(dialogo).getByRole("button", { name: T.cancelar }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((await admin.from("reserva").select("*").eq("id", id).single()).data).toEqual(antes);

    fireEvent.click(elegir);
    fireEvent.click(within(screen.getByRole("dialog", { name: T.dialogo })).getByRole("button", { name: T.si }));
    expect(await screen.findByText(T.listo(true, "OD031", "Kilroy", false), {}, ESPERA)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: TEXTOS.reserva.armarPedidos }, ESPERA)).toBeInTheDocument();
    expect(within(screen.getByTestId("historial-producto")).getByText(/eligió OD031$/)).toBeInTheDocument();

    const guardada = (await admin.from("reserva").select("estado,producto_id,origen_emparejado").eq("id", id).single()).data;
    expect(guardada).toEqual({ estado: "recibida", producto_id: od031.id, origen_emparejado: "nombre" });
    expect((await admin.from("codigo_externo").select("id").eq("agencia", "Kilroy").eq("codigo", normalizarNombre(nombre))).data).toEqual([]);
  });
});
