// @vitest-environment node
//
// Spec M3-07 — verificación 2 (integración contra la BASE DE PRUEBAS):
// corregir los vuelos y los datos dudosos de una reserva con la sesión de una
// persona del equipo (RLS) y la función de la migración 0022.
//
// Fila 4: (a) solo dudoso de vuelos → recibida; (b) dudoso de vuelos y de pax,
// corrijo vuelos → sigue con pax; (c) corrijo y todavía falta un vuelo que el
// producto necesita → aviso (no motivo), queda recibida. Además: la nota del
// operativo, "Está bien así" y corregir fechas o pax, el aviso de un pedido
// ya enviado, el historial con autor, el conflicto, sin sesión y cerrada.
// Todo lo que crea el test es de prueba y se borra al final.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { aVuelos } from "@/lib/reservas/consultas";
import { corregirDato, corregirVuelos, revisarDato, type ResultadoCorregir } from "@/lib/reservas/corregir/corregir";
import { versionParaCorregir } from "@/lib/reservas/corregir/decidir";
import type { VueloCorregido } from "@/lib/reservas/corregir/vuelos";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { MOTIVOS_EMPAREJADO as M } from "@/lib/reservas/emparejar/motivos";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { ReservaEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M3-07]";
const T = TEXTOS.reserva.corregir;
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

/** El caso real (DK1595221): "Departure flight: H2253 ETA 18MAR27 08.44 from CJC". */
const SALIDA_CJC: VueloCorregido = { lado: "salida", numero: "H2253", aeropuerto: "CJC", fecha: "2027-03-18", hora: "08:44" };
const COMO_LLEGADA = { numero: "H2253", aerolinea: null, origen: null, destino: "CJC", fecha_salida: null, hora_salida: null, fecha_llegada: "2027-03-18", hora_llegada: "08:44", confianza: 0.6 };

function ok(r: ResultadoCorregir): Extract<ResultadoCorregir, { ok: true }> {
  if (!r.ok) throw new Error(`Se esperaba ok: ${r.error}`);
  return r;
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-07 — corregir vuelos y datos dudosos en la base de pruebas", { timeout: 180_000 }, () => {
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
        messageId: `<${randomUUID()}@test-m3-07.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-20T12:00:00.000Z",
        cuerpoTexto: "Mail sintético de prueba.\nDeparture flight: H2253 ETA 18MAR27 08.44 from CJC",
        agencia: "Kilroy",
        dePrueba: true,
      },
      admin,
    );
    const { reserva: r } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        bookingId: `TEST307${randomUUID().slice(0, 8)}`,
        estado: "para_revision",
        motivosRevision: [M.dudosos(["vuelos"])],
        productoId: bochi,
        productoTextoAgencia: "BOCHI04R",
        fechaInicio: "2027-03-10",
        fechaFin: "2027-03-18",
        pax: 2,
        vuelos: [COMO_LLEGADA],
        datosExtraidos: { tipo_mail: { valor: "reserva_nueva", confianza: 1 } } as unknown as FichaLectura,
        dePrueba: true,
        ...extra,
      },
      admin,
    );
    return r.id;
  }

  const leer = async (id: string) => (await admin.from("reserva").select("*").eq("id", id).single()).data!;

  /** La versión que vería la pantalla ahora (la arma igual que el detalle). */
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
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-07" });
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

  it("(a) + filas 1, 4 y 7: solo dudoso de vuelos; la llegada pasa a salida → recibida, confianza 1 e historial con autor", async () => {
    const id = await reserva();
    const r = ok(await corregirVuelos(equipo, { reservaId: id, version: await version(id), vuelos: [SALIDA_CJC] }));
    expect(r).toEqual({ ok: true, estado: "recibida", motivos: [], avisos: [] });

    const fila = await leer(id);
    expect(fila.estado).toBe("recibida");
    expect(fila.motivos_revision).toEqual([]);
    expect(fila.vuelos).toEqual([
      { numero: "H2253", aerolinea: null, origen: "CJC", destino: null, fecha_salida: "2027-03-18", hora_salida: "08:44", fecha_llegada: null, hora_llegada: null, confianza: 1 },
    ]);

    const [ev] = await eventos(id, "vuelos_corregidos");
    expect(ev.autor_id).toBe(usuarioId);
    expect(ev.detalle).toEqual({
      persona: "Test M3-07",
      nota: false,
      avisar: [],
      vuelos: [{ lado: "salida", numero: "H2253", aeropuerto: "CJC", fecha: "2027-03-18", hora: "08:44" }],
    });
    // El cambio de estado lo agrega el trigger de 0010, con el autor de la sesión.
    const [estado] = await eventos(id, "estado_cambiado");
    expect(estado.autor_id).toBe(usuarioId);
  });

  it("(b) dudoso de vuelos y de pax, corrijo vuelos → sigue para revisión solo con pax; 'Está bien así' en pax → recibida", async () => {
    const id = await reserva({ motivosRevision: [M.dudosos(["vuelos", "pax"])] });
    const r = ok(await corregirVuelos(equipo, { reservaId: id, version: await version(id), vuelos: [SALIDA_CJC] }));
    expect(r.estado).toBe("para_revision");
    expect(r.motivos).toEqual([M.dudosos(["pax"])]);
    expect((await leer(id)).motivos_revision).toEqual([M.dudosos(["pax"])]);

    const revisado = ok(await revisarDato(equipo, { reservaId: id, version: await version(id), dato: "pax" }));
    expect(revisado.estado).toBe("recibida");
    const [ev] = await eventos(id, "dato_revisado");
    expect(ev.detalle).toEqual({ persona: "Test M3-07", dato: "pax", nota: false });
    expect(ev.autor_id).toBe(usuarioId);
  });

  it("(c) corrijo y todavía falta el vuelo de salida de Calama → aviso, no motivo: queda recibida", async () => {
    const id = await reserva();
    const llegadaLPB: VueloCorregido = { lado: "llegada", numero: "LA2120", aeropuerto: "LPB", fecha: "2027-03-10", hora: "10:05" };
    const r = ok(await corregirVuelos(equipo, { reservaId: id, version: await version(id), vuelos: [llegadaLPB] }));
    expect(r.estado).toBe("recibida");
    expect(r.motivos).toEqual([]);
    expect(r.avisos).toEqual(["Falta el vuelo de salida de Calama (CJC) para el traslado de OD030"]);
    expect((await leer(id)).estado).toBe("recibida");
  });

  it("fila 3: la nota del operativo se agrega a las notas de la reserva", async () => {
    const id = await reserva();
    ok(await corregirVuelos(equipo, { reservaId: id, version: await version(id), vuelos: [SALIDA_CJC], nota: "  Llegan a La Paz por tierra  " }));
    expect((await leer(id)).notas).toEqual(["Llegan a La Paz por tierra"]);
    const [ev] = await eventos(id, "vuelos_corregidos");
    expect(ev.detalle.nota).toBe(true);
    expect(JSON.stringify(ev.detalle)).not.toContain("tierra");
  });

  it("fila 2: un vuelo mal escrito no se guarda y dice qué está mal", async () => {
    const id = await reserva();
    const r = await corregirVuelos(equipo, { reservaId: id, version: await version(id), vuelos: [{ ...SALIDA_CJC, hora: "08.44" }] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores).toEqual([{ fila: 0, campo: "hora", mensaje: T.errores.hora }]);
    expect((await leer(id)).vuelos).toEqual([COMO_LLEGADA]);
  });

  it("fila 5: corregir las fechas y el pax saca esos datos de los dudosos (y quedan en el historial)", async () => {
    const id = await reserva({ motivosRevision: [M.dudosos(["fechas", "pax", "vuelos"])] });
    ok(await corregirDato(equipo, { reservaId: id, version: await version(id), dato: "fechas", fechaInicio: "2027-03-11", fechaFin: "2027-03-18" }));
    ok(await corregirDato(equipo, { reservaId: id, version: await version(id), dato: "pax", pax: 3 }));
    const fila = await leer(id);
    expect([fila.fecha_inicio, fila.fecha_fin, fila.pax]).toEqual(["2027-03-11", "2027-03-18", 3]);
    expect(fila.motivos_revision).toEqual([M.dudosos(["vuelos"])]);
    expect((await eventos(id, "dato_corregido")).map((e) => e.detalle.dato)).toEqual(["fechas", "pax"]);

    const mal = await corregirDato(equipo, { reservaId: id, version: await version(id), dato: "fechas", fechaInicio: "2027-03-18", fechaFin: "2027-03-11" });
    expect(mal).toEqual({ ok: false, error: T.error(T.errores.fechasOrden) });
  });

  it("'Está bien así' sobre un dato que ya no está dudoso no cambia nada", async () => {
    const id = await reserva();
    expect(await revisarDato(equipo, { reservaId: id, version: await version(id), dato: "pax" })).toEqual({ ok: false, error: T.error(T.motivos.noEsDudoso) });
  });

  it("fila 6: con un pedido ya enviado y el vuelo cambiado, queda a quién avisarle", async () => {
    const id = await reserva({ estado: "recibida", motivosRevision: [] });
    // El pedido se envió con el vuelo que había (o "Vuelo pendiente"): así lo armó M3-01.
    const pedido = await admin
      .from("reserva_pedido")
      .insert({
        reserva_id: id,
        casilla: "traslados@prueba.test",
        destinatarios: ["traslados@prueba.test"],
        proveedores: ["Traslados de prueba"],
        asunto: "Reserva",
        cuerpo: "Traslado de salida: Hotel - Aeropuerto Calama\nFecha: 18/03\nVuelo pendiente",
        firma: "{{nombre_de_quien_envia}}",
        estado: "enviado",
        enviado_en: "2026-10-20T12:00:00.000Z",
        enviado_por_nombre: "Test M3-07",
        message_id: `<${randomUUID()}@test-m3-07.hitravel.local>`,
      })
      .select("id")
      .single();
    if (pedido.error) throw new Error(pedido.error.message);

    ok(await corregirVuelos(equipo, { reservaId: id, version: await version(id), vuelos: [SALIDA_CJC] }));
    const [ev] = await eventos(id, "vuelos_corregidos");
    expect(ev.detalle.avisar).toEqual([{ pedido_id: pedido.data.id, proveedores: ["Traslados de prueba"] }]);
    // El estado no cambia fuera de "para revisión".
    expect((await leer(id)).estado).toBe("recibida");
  });

  it("fila 8: si la reserva cambió desde que la pantalla la leyó, no pisa", async () => {
    const id = await reserva({ motivosRevision: [M.dudosos(["vuelos", "pax"])] });
    const vieja = await version(id);
    ok(await revisarDato(equipo, { reservaId: id, version: vieja, dato: "pax" }));
    expect(await corregirVuelos(equipo, { reservaId: id, version: vieja, vuelos: [SALIDA_CJC] })).toEqual({ ok: false, error: T.cambio, cambio: true });
    expect((await leer(id)).vuelos).toEqual([COMO_LLEGADA]);

    // Y la base también controla: con lo de antes distinto, HT409.
    const fila = await leer(id);
    const { error } = await equipo.rpc("corregir_reserva", {
      p_reserva: id,
      p_antes: { estado: fila.estado, motivos: ["otro motivo"], vuelos: fila.vuelos, fecha_inicio: fila.fecha_inicio, fecha_fin: fila.fecha_fin, pax: fila.pax, notas: fila.notas },
      p_cambios: { vuelos: [] },
      p_motivos: [],
      p_evento: { tipo: "vuelos_corregidos", detalle: {} },
    });
    expect(error?.code).toBe("HT409");
  });

  it("fila 8: sin sesión no se corrige nada (ni con la acción ni llamando a la base)", async () => {
    const id = await reserva();
    const r = await corregirVuelos(anonimo, { reservaId: id, version: await version(id), vuelos: [SALIDA_CJC] });
    expect(r).toMatchObject({ ok: false, sinSesion: true });
    const { error } = await anonimo.rpc("corregir_reserva", {
      p_reserva: id,
      p_antes: {},
      p_cambios: { vuelos: [] },
      p_motivos: [],
      p_evento: { tipo: "vuelos_corregidos", detalle: {} },
    });
    expect(error).not.toBeNull();
    expect((await leer(id)).vuelos).toEqual([COMO_LLEGADA]);
  });

  it("fila 1: una reserva cerrada no se corrige", async () => {
    const id = await reserva({ estado: "recibida", motivosRevision: [] });
    const cerrar = await admin.from("reserva").update({ estado: "cerrada" }).eq("id", id);
    if (cerrar.error) throw new Error(cerrar.error.message);
    expect(await corregirVuelos(equipo, { reservaId: id, version: await version(id), vuelos: [SALIDA_CJC] })).toEqual({
      ok: false,
      error: T.error(T.motivos.cerrada),
    });
  });

  describe("owner 2026-10-20: corregir las fechas de ARCH31 (tour con partes)", () => {
    async function conPartes(): Promise<{ id: string; partes: () => Promise<Array<{ orden: number; fecha_inicio: string | null; fecha_fin: string | null }>> }> {
      const p = await admin.from("producto").select("id").eq("codigo", "ARCH31").single();
      if (p.error) throw new Error(p.error.message);
      const detalle = (await cargarProducto(admin, p.data.id))!;
      const componentes = componentesDeLaReserva(detalle, "2027-01-10", { finalPuertoNatales: false, proveedorTransferPNT: null });
      expect(componentes.length).toBeGreaterThan(1);
      const id = await reserva({
        estado: "recibida",
        motivosRevision: [],
        productoId: p.data.id,
        productoTextoAgencia: "ARCH31",
        fechaInicio: "2027-01-10",
        fechaFin: "2027-01-17",
        vuelos: [],
        componentes,
      });
      const partes = async () =>
        ((await admin.from("reserva_componente").select("orden,fecha_inicio,fecha_fin").eq("reserva_id", id).order("orden")).data ?? []) as Array<{
          orden: number;
          fecha_inicio: string | null;
          fecha_fin: string | null;
        }>;
      return { id, partes };
    }

    const correr = (fecha: string | null, dias: number) => {
      if (!fecha) return fecha;
      const d = new Date(`${fecha}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + dias);
      return d.toISOString().slice(0, 10);
    };

    it("inicio +2 y fin +2 → todas las partes se corren 2 días, y queda en el historial", async () => {
      const { id, partes } = await conPartes();
      const antes = await partes();
      expect(antes.some((p) => p.fecha_inicio)).toBe(true);
      const r = ok(await corregirDato(equipo, { reservaId: id, version: await version(id), dato: "fechas", fechaInicio: "2027-01-12", fechaFin: "2027-01-19" }));
      expect(r.aviso).toBeUndefined();
      expect(await partes()).toEqual(antes.map((p) => ({ ...p, fecha_inicio: correr(p.fecha_inicio, 2), fecha_fin: correr(p.fecha_fin, 2) })));
      const [ev] = await eventos(id, "dato_corregido");
      expect(ev.detalle).toMatchObject({ dato: "fechas", dias_corridos: 2 });
      expect(ev.autor_id).toBe(usuarioId);
    });

    it("inicio +2 y fin +3 (una noche extra) → las partes no se tocan y avisa que cambió la duración", async () => {
      const { id, partes } = await conPartes();
      const antes = await partes();
      const r = ok(await corregirDato(equipo, { reservaId: id, version: await version(id), dato: "fechas", fechaInicio: "2027-01-12", fechaFin: "2027-01-20" }));
      expect(r.aviso).toBe(T.avisoDuracion(7, 8));
      expect(await partes()).toEqual(antes);
      const fila = await leer(id);
      expect([fila.fecha_inicio, fila.fecha_fin]).toEqual(["2027-01-12", "2027-01-20"]);
      const [ev] = await eventos(id, "dato_corregido");
      expect(ev.detalle.dias_corridos).toBeUndefined();
    });

    it("sin partes, cambiar la duración no avisa nada", async () => {
      const id = await reserva({ estado: "recibida", motivosRevision: [] });
      const r = ok(await corregirDato(equipo, { reservaId: id, version: await version(id), dato: "fechas", fechaInicio: "2027-03-10", fechaFin: "2027-03-20" }));
      expect(r.aviso).toBeUndefined();
    });
  });
});
