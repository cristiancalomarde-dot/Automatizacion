// @vitest-environment jsdom
//
// Spec M3-08 — verificación 3 (el recorrido con las pantallas reales): sobre
// la BASE DE PRUEBAS, la página /reservas de verdad (con su server action)
// con dos sesiones de prueba: una operadora y una administradora (su mail en
// ADMINS_EMAILS). Solo se reemplaza de dónde sale el cliente de Supabase (la
// sesión de prueba) y el router.
//
// La operadora abre la lista: por inicio del viaje, la confirmada y las
// pendientes juntas, sin el viaje terminado ni el filtro "Viajes terminados";
// filtra por agencia y por los próximos 7 días, ve "Mostrando N reservas", al
// volver a entrar sigue con lo que eligió, y "Limpiar filtros" vuelve a todas.
// La administradora no ve la terminada en la lista normal; con "Viajes
// terminados" la ve, combinada con agencia y el mes. Lo creado se borra.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import { sumarDias } from "@/lib/reservas/lista/filtros";
import { hoyEnArgentina } from "@/lib/reservas/lista/terminadas";
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
  // Las de este recorrido son de prueba: se ven con ?prueba=1 (M2-06).
  useSearchParams: () => new URLSearchParams("prueba=1"),
}));

import ReservasPage from "@/app/(app)/reservas/page";

const L = TEXTOS.reservas.lista;
const ESPERA = { timeout: 60_000 };
const PREFIJO = "[test M3-08 recorrido]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

(credencialesSupabaseDisponibles() ? describe : describe.skip)("recorrido de orden, filtros y viajes terminados (spec M3-08, V3)", { timeout: 240_000 }, () => {
  let admin: SupabaseClient;
  let operadora: { cliente: SupabaseClient; borrar: () => Promise<void> };
  let duenia: { cliente: SupabaseClient; email: string; borrar: () => Promise<void> };
  const hoy = hoyEnArgentina();
  const finTerminada = sumarDias(hoy, -2);
  const ids = { terminada: "", proxima: "", confirmada: "", lejana: "" };
  const adminsOriginal = process.env.ADMINS_EMAILS;

  let creadas = 0;
  async function reserva(agencia: string, inicio: string, fin: string, estado: "recibida" | "confirmada" = "recibida"): Promise<string> {
    // Cada mail llega un minuto después del anterior (para "Llegada del mail").
    creadas += 1;
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-08-recorrido.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: `2026-10-20T12:0${creadas}:00.000Z`,
        cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
        agencia,
        dePrueba: true,
      },
      admin,
    );
    const { reserva: r } = await crearReserva(
      { agencia, mailRecibidoId: mail.id, estado: "recibida", pax: 1, bookingIdOriginal: `R308${randomUUID().slice(0, 6)}`, fechaInicio: inicio, fechaFin: fin, dePrueba: true },
      admin,
    );
    if (estado !== "recibida") {
      const cambio = await admin.from("reserva").update({ estado }).eq("id", r.id);
      if (cambio.error) throw new Error(cambio.error.message);
    }
    return r.id;
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    operadora = await crearSesionDePrueba();
    const d = await crearSesionDePrueba();
    const { data } = await d.cliente.auth.getUser();
    duenia = { ...d, email: data.user!.email! };
    process.env.ADMINS_EMAILS = duenia.email;

    ids.terminada = await reserva("Kilroy", sumarDias(hoy, -9), finTerminada, "confirmada");
    ids.confirmada = await reserva("TourRadar", sumarDias(hoy, 4), sumarDias(hoy, 6), "confirmada");
    ids.proxima = await reserva("Journaway", sumarDias(hoy, 2), sumarDias(hoy, 8));
    ids.lejana = await reserva("Kilroy", sumarDias(hoy, 60), sumarDias(hoy, 65));
  }, 120_000);

  afterEach(() => cleanup());

  afterAll(async () => {
    process.env.ADMINS_EMAILS = adminsOriginal;
    try {
      await registro.limpiar(admin);
    } finally {
      await operadora?.borrar();
      await duenia?.borrar();
    }
  }, 120_000);

  const nuestras = () =>
    within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((f) => f.getAttribute("data-id") ?? "")
      .filter((id) => Object.values(ids).includes(id));
  const combo = (nombre: string) => screen.getByRole("combobox", { name: nombre }) as HTMLSelectElement;
  const contador = () => screen.getByTestId("contador-lista").textContent;
  const filasEnTabla = () => (screen.queryByRole("table") ? within(screen.getByRole("table")).getAllByRole("row").length - 1 : 0);

  async function abrir() {
    render(await ReservasPage());
    await screen.findByRole("table", {}, ESPERA);
    // Con el equipo cargado (quién soy), se aplica lo que guardó esta persona.
    await screen.findByRole("option", { name: TEXTOS.reservas.responsable.mias }, ESPERA);
  }

  it("1. la operadora: por inicio del viaje, todas las vigentes juntas, sin la terminada ni su filtro", async () => {
    cliente.actual = operadora.cliente;
    await abrir();
    expect(combo(L.ordenar).value).toBe("inicio");
    expect(nuestras()).toEqual([ids.proxima, ids.confirmada, ids.lejana]);
    expect(screen.queryByRole("combobox", { name: L.vista })).toBeNull();
    expect(screen.queryByRole("option", { name: L.terminadas })).toBeNull();
    expect(contador()).toBe(L.mostrando(filasEnTabla()));

    fireEvent.change(combo(L.ordenar), { target: { value: "llegada" } });
    expect(nuestras()).toEqual([ids.lejana, ids.proxima, ids.confirmada]);
  });

  it("2. la operadora filtra por agencia y fechas; al volver a entrar sigue igual; 'Limpiar filtros' vuelve a todas", async () => {
    cliente.actual = operadora.cliente;
    await abrir();
    fireEvent.change(combo(L.ordenar), { target: { value: "inicio" } });
    fireEvent.change(combo(L.agencia), { target: { value: "Kilroy" } });
    expect(nuestras()).toEqual([ids.lejana]);
    fireEvent.change(combo(L.agencia), { target: { value: "todas" } });
    fireEvent.change(combo(L.fechas), { target: { value: "7" } });
    expect(nuestras()).toEqual([ids.proxima, ids.confirmada]);
    fireEvent.change(combo(L.agencia), { target: { value: "Journaway" } });
    expect(nuestras()).toEqual([ids.proxima]);
    expect(contador()).toBe(L.mostrando(filasEnTabla()));
    cleanup();

    await abrir();
    await waitFor(() => expect(combo(L.agencia).value).toBe("Journaway"), ESPERA);
    expect(combo(L.fechas).value).toBe("7");
    expect(nuestras()).toEqual([ids.proxima]);

    // Un mes sin viajes: el vacío lo dice y ofrece limpiar.
    fireEvent.change(combo(L.estado), { target: { value: "confirmada" } });
    fireEvent.change(combo(L.fechas), { target: { value: "mes" } });
    fireEvent.change(screen.getByLabelText(L.mes), { target: { value: "1990-01" } });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(L.vacio)).toBeInTheDocument();
    expect(contador()).toBe(L.mostrando(0));
    fireEvent.click(screen.getByRole("button", { name: L.limpiar }));
    expect(combo(L.agencia).value).toBe("todas");
    expect(combo(L.fechas).value).toBe("todas");
    expect(combo(L.estado).value).toBe("todas");
    expect(nuestras()).toEqual([ids.proxima, ids.confirmada, ids.lejana]);
  });

  it("3. la administradora: en la lista normal tampoco ve la terminada; con 'Viajes terminados', sí, combinada con agencia y mes", async () => {
    cliente.actual = duenia.cliente;
    await abrir();
    expect(nuestras()).toEqual([ids.proxima, ids.confirmada, ids.lejana]);
    const vista = await screen.findByRole("combobox", { name: L.vista }, ESPERA);
    expect(within(vista).getByRole("option", { name: L.terminadas })).toBeInTheDocument();

    fireEvent.change(vista, { target: { value: "terminadas" } });
    expect(nuestras()).toEqual([ids.terminada]);
    fireEvent.change(combo(L.agencia), { target: { value: "Kilroy" } });
    fireEvent.change(combo(L.fechas), { target: { value: "mes" } });
    fireEvent.change(screen.getByLabelText(L.mes), { target: { value: finTerminada.slice(0, 7) } });
    expect(nuestras()).toEqual([ids.terminada]);
    fireEvent.change(combo(L.agencia), { target: { value: "TourRadar" } });
    expect(screen.queryByRole("table") ? nuestras() : []).toEqual([]);
  });
});
