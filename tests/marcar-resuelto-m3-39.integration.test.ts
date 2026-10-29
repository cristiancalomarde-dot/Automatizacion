// @vitest-environment node
//
// Spec M3-39 — verificación 2 (integración contra la BASE DE PRUEBAS):
// "Marcar como resuelto" un motivo de revisión con la sesión de una persona
// del equipo (RLS) y la función `corregir_reserva` (0022), sin migración nueva.
//
// El caso real: Petzold quedó para revisión con "Journaway pide 'Night Bus
// Peru' (31.05–01.06), que no es parte de SPAP05: consultarlo con Journaway".
// Fila 2: el evento con quién, qué motivo y la nota, y se ve en el historial.
// Fila 3: con 1 motivo → recibida; con 2 → resolver uno sigue para revisión.
// Fila 5: sin sesión no escribe; descartada → error en llano.
// Todo lo que crea el test es de prueba y se borra al final.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aVuelos, cargarReserva } from "@/lib/reservas/consultas";
import { marcarResuelto, MAXIMO_NOTA, type ResultadoCorregir } from "@/lib/reservas/corregir/corregir";
import { versionParaCorregir } from "@/lib/reservas/corregir/decidir";
import { MOTIVOS_EMPAREJADO as M } from "@/lib/reservas/emparejar/motivos";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import { MOTIVOS_INTERCAMBIO as MI } from "@/lib/reservas/intercambio";
import { MOTIVOS_JOURNAWAY as J } from "@/lib/reservas/journaway/motivos";
import type { ReservaEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M3-39]";
const T = TEXTOS.reserva.corregir;
const NIGHT_BUS = J.noEsParte("Night Bus Peru", "2027-05-31", "2027-06-01", "SPAP05");
const NOTA = "Journaway confirmó que era un error";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function ok(r: ResultadoCorregir): Extract<ResultadoCorregir, { ok: true }> {
  if (!r.ok) throw new Error(`Se esperaba ok: ${r.error}`);
  return r;
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-39 — marcar como resuelto un motivo en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let bochi: string;

  async function reserva(extra: Partial<ReservaEntrada> = {}): Promise<string> {
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-39.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-28T12:00:00.000Z",
        cuerpoTexto: "Mail sintético de prueba.",
        agencia: "Kilroy",
        dePrueba: true,
      },
      admin,
    );
    const { reserva: r } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        bookingId: `TEST339${randomUUID().slice(0, 8)}`,
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

  async function version(id: string): Promise<string> {
    const r = await leer(id);
    return versionParaCorregir({
      estado: r.estado,
      motivos: r.motivos_revision,
      vuelos: aVuelos(r.vuelos),
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
      pax: r.pax,
      notas: r.notas ?? [],
    });
  }

  const eventos = async (id: string, tipo: string) =>
    (await admin.from("evento_reserva").select("tipo,detalle,autor_id,created_at").eq("reserva_id", id).eq("tipo", tipo).order("created_at")).data ?? [];

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const sesion = await crearSesionDePrueba();
    equipo = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { data } = await equipo.auth.getUser();
    usuarioId = data.user!.id;
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-39" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    const p = await admin.from("producto").select("id").eq("codigo", "BOCHI04R").single();
    if (p.error) throw new Error(p.error.message);
    bochi = p.data.id;
  }, 120_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    } finally {
      await borrarSesion?.();
    }
  }, 120_000);

  it("filas 2 y 3: con un solo motivo (el de Petzold), resolverlo la deja recibida, con el evento y en el historial", async () => {
    const id = await reserva();
    const r = ok(await marcarResuelto(equipo, { reservaId: id, version: await version(id), motivos: [NIGHT_BUS], nota: `  ${NOTA}  ` }));
    expect(r).toMatchObject({ ok: true, estado: "recibida", motivos: [] });
    const fila = await leer(id);
    expect([fila.estado, fila.motivos_revision, fila.notas ?? []]).toEqual(["recibida", [], []]);

    const [ev] = await eventos(id, "dato_revisado");
    expect(ev.autor_id).toBe(usuarioId);
    expect(ev.detalle).toMatchObject({ resueltos: [NIGHT_BUS], explicacion: NOTA, persona: "Test M3-39" });

    const detalle = (await cargarReserva(equipo, id))!;
    expect(detalle.correcciones).toEqual([
      expect.objectContaining({ tipo: "resuelto", persona: "Test M3-39", resueltos: [NIGHT_BUS], explicacion: NOTA }),
    ]);
  });

  it("fila 3: con dos motivos, resolver uno la deja para revisión con el otro", async () => {
    const id = await reserva({ motivosRevision: [NIGHT_BUS, M.dudosos(["pax"])] });
    const r = ok(await marcarResuelto(equipo, { reservaId: id, version: await version(id), motivos: [NIGHT_BUS], nota: NOTA }));
    expect(r).toMatchObject({ estado: "para_revision", motivos: [M.dudosos(["pax"])] });
    expect((await leer(id)).motivos_revision).toEqual([M.dudosos(["pax"])]);
  });

  it("fila 1: sin nota (o con una nota larga) no guarda", async () => {
    const id = await reserva();
    const v = await version(id);
    expect(await marcarResuelto(equipo, { reservaId: id, version: v, motivos: [NIGHT_BUS], nota: "   " })).toEqual({
      ok: false,
      error: T.error(T.errores.faltaNota),
    });
    expect(await marcarResuelto(equipo, { reservaId: id, version: v, motivos: [NIGHT_BUS], nota: "x".repeat(MAXIMO_NOTA + 1) })).toEqual({
      ok: false,
      error: T.error(T.errores.notaLarga(MAXIMO_NOTA)),
    });
    expect((await leer(id)).estado).toBe("para_revision");
    expect(await eventos(id, "dato_revisado")).toEqual([]);
  });

  it("un motivo que ya no está (lo resolvió otra persona) no cambia nada", async () => {
    const id = await reserva({ motivosRevision: [NIGHT_BUS, MI.posibleDuplicada] });
    expect(await marcarResuelto(equipo, { reservaId: id, version: await version(id), motivos: [M.sinFechaInicio], nota: NOTA })).toEqual({
      ok: false,
      error: T.error(T.motivos.yaResuelto),
    });
    expect((await leer(id)).motivos_revision).toEqual([NIGHT_BUS, MI.posibleDuplicada]);
  });

  it("si la reserva cambió desde que la pantalla la leyó, no pisa", async () => {
    const id = await reserva();
    const v = await version(id);
    const otro = await admin.from("reserva").update({ pax: 3 }).eq("id", id);
    if (otro.error) throw new Error(otro.error.message);
    expect(await marcarResuelto(equipo, { reservaId: id, version: v, motivos: [NIGHT_BUS], nota: NOTA })).toEqual({ ok: false, error: T.cambio, cambio: true });
    expect((await leer(id)).estado).toBe("para_revision");
  });

  it("fila 5: sin sesión no escribe nada (ni con la acción ni llamando a la base)", async () => {
    const id = await reserva();
    expect(await marcarResuelto(anonimo, { reservaId: id, version: await version(id), motivos: [NIGHT_BUS], nota: NOTA })).toMatchObject({
      ok: false,
      sinSesion: true,
    });
    const { error } = await anonimo.rpc("corregir_reserva", {
      p_reserva: id,
      p_antes: {},
      p_cambios: {},
      p_motivos: [],
      p_evento: { tipo: "dato_revisado", detalle: { resueltos: [NIGHT_BUS] } },
    });
    expect(error).not.toBeNull();
    const fila = await leer(id);
    expect([fila.estado, fila.motivos_revision]).toEqual(["para_revision", [NIGHT_BUS]]);
  });

  it("fila 5: una reserva descartada no se toca, y lo dice en llano", async () => {
    const id = await reserva();
    const descartar = await admin.from("reserva").update({ estado: "descartada", motivos_revision: [] }).eq("id", id);
    if (descartar.error) throw new Error(descartar.error.message);
    expect(await marcarResuelto(equipo, { reservaId: id, version: await version(id), motivos: [NIGHT_BUS], nota: NOTA })).toEqual({
      ok: false,
      error: T.error(T.motivos.descartada),
    });
    expect(await eventos(id, "dato_revisado")).toEqual([]);
  });
});
