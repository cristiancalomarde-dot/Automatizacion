// @vitest-environment jsdom
//
// Spec M3-39 — verificación 3 (el recorrido con las pantallas reales): sobre
// la BASE DE PRUEBAS y con la sesión de una persona del equipo, el detalle de
// la reserva y las server actions de verdad (solo se reemplaza de dónde sale
// el cliente de Supabase: la sesión de prueba).
//
// El caso que lo motivó (Petzold, Journaway): quedó para revisión por "Journaway
// pide 'Night Bus Peru' (31.05–01.06), que no es parte de SPAP05" y no se podía
// armar el pedido. La persona lo marca como resuelto con una nota, la reserva
// queda recibida, aparece "Armar pedidos" y el historial lo cuenta. Con dos
// motivos, resolver uno la deja para revisión por el otro. Todo es de prueba y
// se borra.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import { MOTIVOS_INTERCAMBIO as MI } from "@/lib/reservas/intercambio";
import { MOTIVOS_JOURNAWAY as J } from "@/lib/reservas/journaway/motivos";
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

const T = TEXTOS.reserva.corregir;
const GENERICO = TEXTOS.reserva.motivos.generico;
const ESPERA = { timeout: 60_000 };
const PREFIJO = "[test M3-39 recorrido]";
const NIGHT_BUS = J.noEsParte("Night Bus Peru", "2027-05-31", "2027-06-01", "SPAP05");
const NOTA = "Journaway confirmó que era un error";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

(credencialesSupabaseDisponibles() ? describe : describe.skip)("recorrido de marcar como resuelto (spec M3-39, V3)", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let bochi: string;

  async function reserva(extra: Partial<ReservaEntrada> = {}): Promise<string> {
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-39-recorrido.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-28T12:00:00.000Z",
        cuerpoTexto: "Dear HI Travel,\nPlease book BOCHI04R for 2 pax.\nBest regards",
        agencia: "Kilroy",
        dePrueba: true,
      },
      admin,
    );
    const { reserva: r } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        bookingId: `DK339${randomUUID().slice(0, 8)}`,
        estado: "para_revision",
        motivosRevision: [NIGHT_BUS],
        productoId: bochi,
        productoTextoAgencia: "BOCHI04R",
        fechaInicio: "2027-03-10",
        fechaFin: "2027-03-18",
        pax: 2,
        vuelos: [],
        datosExtraidos: { tipo_mail: { valor: "reserva_nueva", confianza: 1 } } as unknown as FichaLectura,
        dePrueba: true,
        ...extra,
      },
      admin,
    );
    return r.id;
  }

  const leer = async (id: string) => (await admin.from("reserva").select("*").eq("id", id).single()).data!;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const sesion = await crearSesionDePrueba();
    cliente.actual = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { data } = await sesion.cliente.auth.getUser();
    usuarioId = data.user!.id;
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-39 recorrido" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    const p = await admin.from("producto").select("id").eq("codigo", "BOCHI04R").single();
    if (p.error) throw new Error(p.error.message);
    bochi = p.data.id;
  }, 120_000);

  afterEach(() => cleanup());

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    } finally {
      await borrarSesion?.();
    }
  }, 120_000);

  it("1. el caso Petzold: marcar el motivo como resuelto la deja recibida, con 'Armar pedidos' y el historial", async () => {
    const id = await reserva();
    render(<DetalleReservaPantalla id={id} />);
    const motivos = await screen.findByTestId("motivos-revision", {}, ESPERA);
    expect(screen.getByRole("button", { name: TEXTOS.reserva.armarPedidos })).toBeDisabled();

    // Sin nota no guarda.
    fireEvent.click(within(motivos).getByRole("button", { name: `${T.marcarResuelto}: ${GENERICO}` }));
    fireEvent.click(within(motivos).getByRole("button", { name: T.guardar }));
    expect(within(motivos).getByText(T.errores.faltaNota)).toBeInTheDocument();
    expect((await leer(id)).estado).toBe("para_revision");

    fireEvent.change(within(motivos).getByLabelText(T.notaResuelto), { target: { value: NOTA } });
    fireEvent.click(within(motivos).getByRole("button", { name: T.guardar }));
    expect(await screen.findByText(T.listoRecibida, {}, ESPERA)).toBeInTheDocument();
    const enlace = await screen.findByRole("link", { name: TEXTOS.reserva.armarPedidos }, ESPERA);
    expect(enlace).toHaveAttribute("href", `/reservas/${id}/pedidos`);
    expect(screen.queryByTestId("motivos-revision")).toBeNull();
    expect(screen.getByTestId("historial-correcciones")).toHaveTextContent(T.historialResuelto("Test M3-39 recorrido", NIGHT_BUS, NOTA));
    const fila = await leer(id);
    expect([fila.estado, fila.motivos_revision]).toEqual(["recibida", []]);
  });

  it("2. con dos motivos, resolver uno la deja para revisión por el otro", async () => {
    const id = await reserva({ motivosRevision: [NIGHT_BUS, MI.posibleDuplicada] });
    render(<DetalleReservaPantalla id={id} />);
    const antes = await screen.findByTestId("motivos-revision", {}, ESPERA);
    fireEvent.click(within(antes).getByRole("button", { name: `${T.marcarResuelto}: ${GENERICO}` }));
    fireEvent.change(within(antes).getByLabelText(T.notaResuelto), { target: { value: NOTA } });
    fireEvent.click(within(antes).getByRole("button", { name: T.guardar }));

    expect(await screen.findByText(/^Listo: sigue para revisión por: /, {}, ESPERA)).toBeInTheDocument();
    expect((await leer(id)).motivos_revision).toEqual([MI.posibleDuplicada]);
    const motivos = await screen.findByTestId("motivos-revision", {}, ESPERA);
    expect(await within(motivos).findByText(TEXTOS.reserva.motivos.posible_duplicada, {}, ESPERA)).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByTestId("motivos-revision")).queryByText(GENERICO)).toBeNull(), ESPERA);
    expect(screen.getByRole("button", { name: TEXTOS.reserva.armarPedidos })).toBeDisabled();
  });
});
