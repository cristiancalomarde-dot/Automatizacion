// @vitest-environment node
//
// Spec M3-08 — verificación 2 (integración contra la BASE DE PRUEBAS): la
// lista de reservas como la arma el servidor, con la sesión de dos personas
// (RLS). Un operador NO recibe desde el servidor los viajes terminados (fin
// antes de hoy, hora Argentina): no es que la pantalla los esconda. Una
// administradora (su mail en ADMINS_EMAILS) los recibe, con la marca de
// administradora. La server action no recibe parámetros: no hay filtro que
// un operador pueda cambiar para pedirlas. Lo creado es de prueba y se borra.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import { cargarListaDeReservas } from "@/lib/reservas/lista/cargar-lista";
import { ELECCION_INICIAL, filtrarYOrdenar, sumarDias } from "@/lib/reservas/lista/filtros";
import { hoyEnArgentina } from "@/lib/reservas/lista/terminadas";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const servidor = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => servidor.actual }));

import { cargarLaListaDeReservas } from "@/app/(app)/reservas/acciones-lista";

const PREFIJO = "[test M3-08]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

interface Sesion {
  cliente: SupabaseClient;
  email: string;
  borrar: () => Promise<void>;
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-08 — la lista desde el servidor (base de pruebas)", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let operadora: Sesion;
  let duenia: Sesion;
  const hoy = hoyEnArgentina();
  const ids = { terminada: "", terminaHoy: "", sinFecha: "", proxima: "", terminadaJournaway: "" };
  const adminsOriginal = process.env.ADMINS_EMAILS;

  async function reserva(agencia: string, fechaInicio: string | null, fechaFin: string | null, estado: "recibida" | "confirmada" = "recibida") {
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-08.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-20T12:00:00.000Z",
        cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
        agencia,
        dePrueba: true,
      },
      admin,
    );
    const { reserva: r } = await crearReserva(
      { agencia, mailRecibidoId: mail.id, estado: "recibida", pax: 1, bookingIdOriginal: `M308${randomUUID().slice(0, 6)}`, fechaInicio, fechaFin, dePrueba: true },
      admin,
    );
    if (estado !== "recibida") {
      const cambio = await admin.from("reserva").update({ estado }).eq("id", r.id);
      if (cambio.error) throw new Error(cambio.error.message);
    }
    return r.id;
  }

  async function sesion(): Promise<Sesion> {
    const s = await crearSesionDePrueba();
    const { data } = await s.cliente.auth.getUser();
    return { cliente: s.cliente, email: data.user!.email!, borrar: s.borrar };
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    operadora = await sesion();
    duenia = await sesion();
    ids.terminada = await reserva("Kilroy", sumarDias(hoy, -10), sumarDias(hoy, -1), "confirmada");
    ids.terminadaJournaway = await reserva("Journaway", sumarDias(hoy, -40), sumarDias(hoy, -30), "confirmada");
    ids.terminaHoy = await reserva("Kilroy", sumarDias(hoy, -3), hoy);
    ids.sinFecha = await reserva("TourRadar", null, null);
    ids.proxima = await reserva("Journaway", sumarDias(hoy, 5), sumarDias(hoy, 9), "confirmada");
  }, 120_000);

  afterAll(async () => {
    process.env.ADMINS_EMAILS = adminsOriginal;
    try {
      await registro.limpiar(admin);
    } finally {
      await operadora?.borrar();
      await duenia?.borrar();
    }
  }, 120_000);

  const mias = (filas: { id: string }[]) => filas.map((f) => f.id).filter((id) => Object.values(ids).includes(id));

  it("fila 5: un operador no recibe del servidor los viajes terminados; sí los de hoy, los próximos y los sin fecha", async () => {
    const lista = await cargarListaDeReservas(operadora.cliente, { admins: duenia.email, agencias: [] });
    expect(lista.esAdmin).toBe(false);
    expect(lista.hoy).toBe(hoy);
    const recibidas = mias(lista.filas);
    expect(recibidas).not.toContain(ids.terminada);
    expect(recibidas).not.toContain(ids.terminadaJournaway);
    expect(recibidas.sort()).toEqual([ids.terminaHoy, ids.sinFecha, ids.proxima].sort());
    // Ninguna fila de la base (no solo las de este test) llega terminada.
    expect(lista.filas.filter((f) => f.fechaFin !== null && f.fechaFin < hoy)).toEqual([]);
  });

  it("fila 5: ni cambiando el filtro a 'Viajes terminados' las ve (no le llegaron)", async () => {
    const lista = await cargarListaDeReservas(operadora.cliente, { admins: duenia.email, agencias: [] });
    expect(filtrarYOrdenar(lista.filas, { ...ELECCION_INICIAL, vista: "terminadas" }, lista.hoy)).toEqual([]);
  });

  it("fila 6: una administradora las recibe y la vista de terminadas las trae por fin (más recientes primero), combinable con agencia", async () => {
    const lista = await cargarListaDeReservas(duenia.cliente, { admins: ` otra@hitravel.com.ar , ${duenia.email.toUpperCase()}`, agencias: [] });
    expect(lista.esAdmin).toBe(true);
    const recibidas = mias(lista.filas);
    expect(recibidas.sort()).toEqual(Object.values(ids).sort());
    const terminadas = mias(filtrarYOrdenar(lista.filas, { ...ELECCION_INICIAL, vista: "terminadas" }, lista.hoy));
    expect(terminadas).toEqual([ids.terminada, ids.terminadaJournaway]);
    const deJournaway = mias(filtrarYOrdenar(lista.filas, { ...ELECCION_INICIAL, vista: "terminadas", agencia: "Journaway" }, lista.hoy));
    expect(deJournaway).toEqual([ids.terminadaJournaway]);
    // En la vista normal, tampoco ella las ve.
    expect(mias(filtrarYOrdenar(lista.filas, ELECCION_INICIAL, lista.hoy))).not.toContain(ids.terminada);
  });

  it("filas 2 y 3: confirmadas y pendientes juntas, en orden de inicio", async () => {
    const lista = await cargarListaDeReservas(operadora.cliente, { admins: undefined, agencias: [] });
    expect(mias(filtrarYOrdenar(lista.filas, ELECCION_INICIAL, lista.hoy))).toEqual([ids.terminaHoy, ids.proxima, ids.sinFecha]);
  });

  it("la server action de verdad: decide por el mail de la sesión y ADMINS_EMAILS; trae las agencias del CSV; no recibe parámetros", async () => {
    expect(cargarLaListaDeReservas.length).toBe(0);
    process.env.ADMINS_EMAILS = duenia.email;

    servidor.actual = operadora.cliente;
    const deOperadora = await cargarLaListaDeReservas();
    expect(deOperadora.esAdmin).toBe(false);
    expect(mias(deOperadora.filas)).not.toContain(ids.terminada);
    expect(deOperadora.agencias).toEqual(expect.arrayContaining(["Journaway", "Kilroy", "TourRadar"]));

    servidor.actual = duenia.cliente;
    const deDuenia = await cargarLaListaDeReservas();
    expect(deDuenia.esAdmin).toBe(true);
    expect(mias(deDuenia.filas)).toContain(ids.terminada);

    // Sin la variable, nadie es administradora.
    delete process.env.ADMINS_EMAILS;
    const sinVariable = await cargarLaListaDeReservas();
    expect(sinVariable.esAdmin).toBe(false);
    expect(mias(sinVariable.filas)).not.toContain(ids.terminada);
  });

  it("sin sesión: nada (RLS)", async () => {
    const anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const lista = await cargarListaDeReservas(anonimo, { admins: duenia.email, agencias: [] });
    expect(lista.esAdmin).toBe(false);
    expect(lista.filas).toEqual([]);
  });
});
