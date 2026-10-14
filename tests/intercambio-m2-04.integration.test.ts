// @vitest-environment node
//
// Spec M2-04 — verificación 2 (integración contra el Supabase real, con la IA
// grabada de M2-02: no gasta). Filas 1, 3, 6, 7, 8, 9, 10 y 11, la prueba de
// concurrencia y RLS en las tablas tocadas. Todo lo que se crea lleva
// `de_prueba = true` y se borra antes de cada caso y al final.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import {
  clienteFalso,
  fichaGrabada,
  mailDePrueba,
  pdfSintetico,
  registroFalso,
  respuestaCon,
  respuestaGrabada,
} from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { borrarDatosDePrueba, crearReserva } from "@/lib/reservas/guardar";
import { MOTIVOS_INTERCAMBIO as MI } from "@/lib/reservas/intercambio";
import { cargarCandidatas, procesarMail, procesarMails, type OpcionesProceso } from "@/lib/reservas/procesar-mail";
import type { MailEntrada, Reserva } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

type Ficha = Record<string, unknown> & { productos: Array<Record<string, unknown>> };

const ASUNTO_VARIAS = "DK1594100/maga - 3 NEW BOOKINGS - KILROY booking request";
const ASUNTO_OVERLAND = "DK1594100/maga - Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days - KILROY booking request";

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M2-04 — mismo intercambio contra Supabase real",
  { timeout: 180_000 },
  () => {
    let admin: SupabaseClient;
    let anonimo: SupabaseClient;
    let soltarBloqueo: () => void;
    let deps: DependenciasReservas;

    /** Un lector de M2-02 con una respuesta grabada (o una variante): cuenta las llamadas a la "IA". */
    function lector(respuesta: unknown) {
      const { cliente, create } = clienteFalso(respuesta);
      const { registro, sumar } = registroFalso();
      const leer: OpcionesProceso["leer"] = (mail, ctx) =>
        leerMailConIA(mail, {
          cliente,
          registro,
          mes: "2026-10",
          llamadas: crearRegistroLlamadasSupabase(admin),
          mailRecibidoId: ctx.mailRecibidoId,
          dePrueba: true,
        });
      return { leer, create, sumar };
    }

    function opciones(leer: OpcionesProceso["leer"], extra: Partial<OpcionesProceso> = {}): OpcionesProceso {
      return { admin, leer, deps: () => deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true, ...extra };
    }

    function entrada(base: { remitente: string; asunto?: string | null; cuerpoTexto?: string | null }, extra: Partial<MailEntrada> = {}): MailEntrada {
      return {
        origen: "archivo",
        messageId: `<m2-04-${randomUUID()}@prueba.hitravel.local>`,
        remitente: base.remitente,
        asunto: base.asunto ?? null,
        cuerpoTexto: base.cuerpoTexto ?? null,
        adjuntos: [],
        dePrueba: true,
        ...extra,
      };
    }

    const fichaVarias = () => fichaGrabada("kilroy-dk1594100") as Ficha;
    function fichaSoloOverland(): Ficha {
      const f = fichaVarias();
      f.productos = f.productos.filter((p) => String(p.codigo).includes("OVERLAND"));
      (f.fecha_inicio as { valor: string }).valor = "2027-01-18";
      return f;
    }
    const mailVarias = (asunto = ASUNTO_VARIAS, extra: Partial<MailEntrada> = {}) =>
      entrada({ ...mailDePrueba("kilroy-dk1594100-respuesta"), asunto }, extra);

    async function reservasDe(bookingId: string): Promise<Reserva[]> {
      const { data, error } = await admin.from("reserva").select("*").eq("booking_id", bookingId).eq("de_prueba", true).order("created_at");
      if (error) throw new Error(error.message);
      return data as Reserva[];
    }
    async function eventosDe(reservaId: string) {
      const { data, error } = await admin
        .from("evento_reserva")
        .select("tipo,mail_recibido_id,detalle,estado_nuevo")
        .eq("reserva_id", reservaId)
        .order("created_at");
      if (error) throw new Error(error.message);
      return data!;
    }
    /** Los mails del historial: el del que nació más los que se le sumaron. */
    async function mailsDe(r: Reserva): Promise<string[]> {
      const extra = (await eventosDe(r.id)).filter((e) => e.tipo === "mail_agregado").map((e) => e.mail_recibido_id as string);
      return [...new Set([r.mail_recibido_id, ...extra])];
    }

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      const conf = { auth: { autoRefreshToken: false, persistSession: false } };
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, conf);
      anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, conf);
      deps = await cargarDependenciasReservas(admin);
    }, 360_000);

    beforeEach(async () => {
      await borrarDatosDePrueba(admin);
    }, 120_000);

    afterAll(async () => {
      try {
        await borrarDatosDePrueba(admin);
        const { data } = await admin.from("reserva").select("id").eq("de_prueba", true);
        expect(data ?? []).toEqual([]);
      } finally {
        soltarBloqueo?.();
      }
    }, 120_000);

    it("fila 1: el mismo mail dos veces → 1 mail, 1 reserva, 1 llamada a la IA y nada nuevo en el historial", async () => {
      const { leer, create, sumar } = lector(respuestaCon(fichaSoloOverland()));
      const mail = mailVarias(ASUNTO_OVERLAND);
      const primera = await procesarMail(mail, opciones(leer));
      expect(primera.estado).toBe("procesado");
      const [overland] = await reservasDe("DK1594100");
      const eventosAntes = await eventosDe(overland.id);

      const segunda = await procesarMail({ ...mail }, opciones(leer));
      expect(segunda).toMatchObject({ estado: "ya_procesado", mailRecibidoId: primera.mailRecibidoId, pedidos: [] });
      expect(create).toHaveBeenCalledTimes(1);
      expect(sumar).toHaveBeenCalledTimes(1);
      expect(await reservasDe("DK1594100")).toHaveLength(1);
      expect(await eventosDe(overland.id)).toEqual(eventosAntes);
      const { data: mails } = await admin.from("mail_recibido").select("id,procesado_en").eq("de_prueba", true);
      expect(mails).toHaveLength(1);
      expect(mails![0].procesado_en).toBeTruthy();
      const { data: llamadas } = await admin.from("ia_llamada").select("id").eq("mail_recibido_id", primera.mailRecibidoId);
      expect(llamadas).toHaveLength(1);
    });

    it("fila 1: el mismo mail en el Inbox y en Spam cuenta como uno", async () => {
      const { leer, create } = lector(respuestaCon(fichaSoloOverland()));
      const messageId = `<m2-04-${randomUUID()}@prueba.hitravel.local>`;
      const inbox = mailVarias(ASUNTO_OVERLAND, { origen: "imap", carpeta: "inbox", imapUidvalidity: 1, imapUid: 10, messageId });
      const spam = { ...inbox, carpeta: "spam" as const, imapUid: 99 };
      const [a, b] = await procesarMails([inbox, spam], opciones(leer));
      expect([a.estado, b.estado]).toEqual(["procesado", "ya_procesado"]);
      expect(create).toHaveBeenCalledTimes(1);
      expect(await reservasDe("DK1594100")).toHaveLength(1);
    });

    it("fila 1: sin Message-ID, el mismo id IMAP (carpeta + UIDVALIDITY + UID) cuenta como el mismo mail", async () => {
      const { leer, create } = lector(respuestaCon(fichaSoloOverland()));
      const uid = Math.floor(Math.random() * 1_000_000_000);
      const imap = { origen: "imap" as const, carpeta: "inbox" as const, imapUidvalidity: 7, imapUid: uid, messageId: null };
      const primero = mailVarias(ASUNTO_OVERLAND, imap);
      const otraVez = { ...primero, cuerpoTexto: `${primero.cuerpoTexto}\n` + "(releído)" };
      const [a, b] = await procesarMails([primero, otraVez], opciones(leer));
      expect([a.estado, b.estado]).toEqual(["procesado", "ya_procesado"]);
      expect(b.mailRecibidoId).toBe(a.mailRecibidoId);
      expect(create).toHaveBeenCalledTimes(1);
    });

    it("filas 3 y 6: Overland del 9-oct y después 'varias' → el Overland sigue siendo 1 con 2 mails, y nacen Iguazú y El Calafate", async () => {
      const overland = await procesarMail(mailVarias(ASUNTO_OVERLAND), opciones(lector(respuestaCon(fichaSoloOverland())).leer));
      const varias = await procesarMail(mailVarias(), opciones(lector(respuestaGrabada("kilroy-dk1594100")).leer));
      expect(varias.estado === "procesado" && varias.pedidos.map((p) => p.accion)).toEqual(["nueva", "nueva", "sumada"]);

      const reservas = await reservasDe("DK1594100");
      expect(reservas).toHaveLength(3);
      const idOverland = overland.estado === "procesado" ? overland.pedidos[0].reservaId : "";
      const laDelOverland = reservas.find((r) => r.id === idOverland)!;
      expect(await mailsDe(laDelOverland)).toEqual([overland.mailRecibidoId, varias.mailRecibidoId]);
      expect(reservas.filter((r) => r.producto_clave_agencia === "hi_argentina_overland_7days")).toHaveLength(1);
      expect(laDelOverland.booking_id_original).toBe("DK1594100/maga");

      // Las nuevas quedan enlazadas a las de la misma referencia.
      const iguazu = reservas.find((r) => r.producto_clave_agencia === "hi_argentina_od010d")!;
      const enlace = (await eventosDe(iguazu.id)).find((e) => e.tipo === "misma_referencia");
      expect((enlace!.detalle as { reservas: string[] }).reservas).toEqual([idOverland]);
    });

    it("fila 3: los 2 estados de cuenta de TourRadar 1377598 → 1 reserva con los dos mails", async () => {
      const pdf = (asunto: string) =>
        entrada(
          { remitente: "system@sent-via.netsuite.com", asunto, cuerpoTexto: "" },
          { adjuntos: [{ nombre: `${asunto}.pdf`, tipo: "application/pdf", contenido: pdfSintetico() }] },
        );
      const primero = await procesarMail(
        pdf("Booking Statement 1377598 - 25372219 - vendorbill"),
        opciones(lector(respuestaGrabada("tourradar-1377598-opcionales")).leer),
      );
      const segundo = await procesarMail(
        pdf("Booking Statement 1377598 - 25388222 - vendorbill"),
        opciones(lector(respuestaGrabada("tourradar-cargo-1377598")).leer),
      );
      const reservas = await reservasDe("1377598");
      expect(reservas).toHaveLength(1);
      expect(await mailsDe(reservas[0])).toEqual([primero.mailRecibidoId, segundo.mailRecibidoId]);
    });

    it("fila 6: '2 NEW BOOKINGS - DK1576932/emhe' → 2 reservas (ARCH33 y el Overland) desde un solo mail", async () => {
      const r = await procesarMail(entrada(mailDePrueba("kilroy-dk1576932")), opciones(lector(respuestaGrabada("kilroy-dk1576932")).leer));
      expect(r.estado === "procesado" && r.pedidos.map((p) => p.accion)).toEqual(["nueva", "nueva"]);
      const reservas = await reservasDe("DK1576932");
      expect(reservas.map((x) => x.producto_clave_agencia)).toEqual(["hi_argentina_w_trek_arch_33", "hi_argentina_overland_7days"]);
    });

    // --- Fila 7 -------------------------------------------------------------------------------

    /** El mail "aquí van los pasaportes": sin producto, con los pasajeros y su nacionalidad. */
    function pasaportes(numero: string, pasajeros: Array<Record<string, unknown>>) {
      const f = fichaGrabada("kilroy-od010d") as Ficha;
      Object.assign(f, {
        tipo_mail: { valor: "respuesta_intercambio", confianza: 1 },
        numero_reserva: { valor: numero, confianza: 1 },
        productos: [],
        fecha_inicio: { valor: null, confianza: 0 },
        fecha_fin: { valor: null, confianza: 0 },
        pax: { valor: null, confianza: 0 },
        pasajeros: pasajeros.map((p) => ({ ...p, nacionalidad: "DK" })),
        vuelos: [],
        pedidos_especiales: [],
      });
      const mail = entrada({ remitente: "copenhagen@kilroy.dk", asunto: `Passports ${numero}`, cuerpoTexto: "Here are the passports." });
      return { mail, leer: lector(respuestaCon(f)).leer };
    }

    it("fila 7: pasaportes con DK1586168 y una sola reserva con esa referencia → se suma y completa lo vacío", async () => {
      const f = fichaGrabada("kilroy-od010d") as Ficha;
      const pasajeros = (f.pasajeros as Array<Record<string, unknown>>).map((p) => ({ ...p, nacionalidad: null }));
      Object.assign(f, { numero_reserva: { valor: "DK1586168/pela", confianza: 1 }, pasajeros });
      f.productos = [{ ...f.productos[0], nombre: "Patagonia, Trekking Paradise with W-Trek EXPRESS", codigo: "HI_TRAVEL_ARCH_EXP-677" }];
      const original = mailDePrueba("kilroy-od010d");
      await procesarMail(
        entrada({ ...original, asunto: "DK1586168/pela - Patagonia, Trekking Paradise EXPRESS - KILROY booking request" }),
        opciones(lector(respuestaCon(f)).leer),
      );

      const p = pasaportes("DK1586168/pela", pasajeros);
      const r = await procesarMail(p.mail, opciones(p.leer));
      expect(r.estado === "procesado" && r.pedidos.map((x) => x.accion)).toEqual(["sumada"]);
      const [reserva] = await reservasDe("DK1586168");
      expect(await reservasDe("DK1586168")).toHaveLength(1);
      expect((reserva.pasajeros as Array<{ nacionalidad: string | null }>).every((x) => x.nacionalidad === "DK")).toBe(true);
      const tipos = (await eventosDe(reserva.id)).map((e) => e.tipo);
      expect(tipos).toEqual(expect.arrayContaining(["creada", "mail_agregado", "datos_completados"]));
    });

    it("fila 7: pasaportes con DK1576932 (ARCH33 y el Overland) → para revisión con las 2 enlazadas y sin copiar nada", async () => {
      await procesarMail(entrada(mailDePrueba("kilroy-dk1576932")), opciones(lector(respuestaGrabada("kilroy-dk1576932")).leer));
      const antes = await reservasDe("DK1576932");
      const eventosAntes = await Promise.all(antes.map((x) => eventosDe(x.id)));

      const p = pasaportes("DK1576932/emhe", [{ nombre: "Pasajero", apellido: "Uno", fecha_nacimiento: null, confianza: 1 }]);
      const r = await procesarMail(p.mail, opciones(p.leer));
      expect(r.estado === "procesado" && r.pedidos.map((x) => x.accion)).toEqual(["revision_ambigua"]);

      const despues = await reservasDe("DK1576932");
      expect(despues).toHaveLength(3);
      const nueva = despues.find((x) => !antes.some((a) => a.id === x.id))!;
      expect(nueva.estado).toBe("para_revision");
      expect(nueva.motivos_revision[0]).toBe(MI.ambigua(2, "DK1576932"));
      const enlace = (await eventosDe(nueva.id)).find((e) => e.tipo === "misma_referencia")!;
      expect((enlace.detalle as { reservas: string[] }).reservas.sort()).toEqual(antes.map((a) => a.id).sort());
      // Las dos que ya estaban no cambiaron: ni datos ni historial.
      for (const [i, a] of antes.entries()) {
        const ahora = despues.find((x) => x.id === a.id)!;
        expect(ahora.pasajeros).toEqual(a.pasajeros);
        expect(await eventosDe(a.id)).toEqual(eventosAntes[i]);
      }
    });

    // --- Fila 8 -------------------------------------------------------------------------------

    async function journaway(ficha?: Ficha) {
      const r = await procesarMail(
        entrada(mailDePrueba("journaway-iguazu-arg")),
        opciones(lector(ficha ? respuestaCon(ficha) : respuestaGrabada("journaway-iguazu-arg")).leer),
      );
      if (r.estado !== "procesado") throw new Error("se esperaba un mail nuevo");
      return r.pedidos[0];
    }
    async function laReserva(id: string): Promise<Reserva> {
      const { data, error } = await admin.from("reserva").select("*").eq("id", id).single();
      if (error) throw new Error(error.message);
      return data as Reserva;
    }

    it("fila 8: Journaway sin número — los Gallien (Brasil 13/06 y Argentina 14/06) sin marca; el reenvío, marcado y enlazado", async () => {
      const brasil = fichaGrabada("journaway-iguazu-arg") as Ficha;
      brasil.productos = [{ ...brasil.productos[0], nombre: "Half-day tour to the Brazilian Iguazú Falls", fecha_inicio: "2027-06-13" }];
      (brasil.fecha_inicio as { valor: string }).valor = "2027-06-13";

      const arg = await journaway();
      const br = await journaway(brasil);
      expect([arg.accion, br.accion]).toEqual(["nueva", "nueva"]);
      expect((await laReserva(br.reservaId)).posible_duplicada).toBe(false);

      const reenvio = await journaway();
      expect(reenvio).toMatchObject({ accion: "posible_duplicada", enlazadas: [arg.reservaId] });
      const marcada = await laReserva(reenvio.reservaId);
      expect(marcada).toMatchObject({ posible_duplicada: true, duplicada_de_id: arg.reservaId, estado: "para_revision", booking_id: null });
      expect(marcada.motivos_revision).toContain(MI.posibleDuplicada);
      expect((await eventosDe(marcada.id)).map((e) => e.tipo)).toContain("posible_duplicada");
      // La original sigue igual: nada se descarta ni se junta.
      expect((await laReserva(arg.reservaId)).estado).not.toBe("descartada");
    });

    it("fila 8: si la otra entró hace 61 días, sin marca", async () => {
      const arg = await journaway();
      const hace61 = new Date(Date.now() - 61 * 86_400_000).toISOString();
      const { error } = await admin.from("reserva").update({ created_at: hace61 }).eq("id", arg.reservaId);
      expect(error).toBeNull();
      const otra = await journaway();
      expect(otra.accion).toBe("nueva");
      expect((await laReserva(otra.reservaId)).posible_duplicada).toBe(false);
    });

    // --- Fila 9 -------------------------------------------------------------------------------

    const statement = (asunto: string) =>
      entrada(
        { remitente: "system@sent-via.netsuite.com", asunto, cuerpoTexto: "" },
        { adjuntos: [{ nombre: `${asunto}.pdf`, tipo: "application/pdf", contenido: pdfSintetico() }] },
      );
    const ASUNTO_CANCELACION = "Booking Statement 1363612 - 25160515 - vendorcredit";

    it("fila 9: la cancelación de 1363612 sin la reserva cargada → 1 reserva para revisión con ese motivo", async () => {
      await procesarMail(statement(ASUNTO_CANCELACION), opciones(lector(respuestaGrabada("tourradar-cancelacion-1363612")).leer));
      const reservas = await reservasDe("1363612");
      expect(reservas).toHaveLength(1);
      expect(reservas[0].estado).toBe("para_revision");
      expect(reservas[0].motivos_revision).toContain(MI.cancelacionSinReserva);
    });

    it("fila 9: con la reserva ya cargada → sigue siendo 1, ahora en revisión con el evento", async () => {
      const alta = fichaGrabada("tourradar-cancelacion-1363612") as Ficha;
      alta.tipo_mail = { valor: "reserva_nueva", confianza: 1 };
      await procesarMail(statement("Booking Statement 1363612 - 25100000 - vendorbill"), opciones(lector(respuestaCon(alta)).leer));
      const c = await procesarMail(statement(ASUNTO_CANCELACION), opciones(lector(respuestaGrabada("tourradar-cancelacion-1363612")).leer));
      expect(c.estado === "procesado" && c.pedidos.map((p) => p.accion)).toEqual(["sumada"]);

      const reservas = await reservasDe("1363612");
      expect(reservas).toHaveLength(1);
      expect(reservas[0].estado).toBe("para_revision");
      expect(reservas[0].motivos_revision).toContain(MI.cancelacion);
      const agregado = (await eventosDe(reservas[0].id)).find((e) => e.tipo === "mail_agregado")!;
      expect(agregado).toMatchObject({ mail_recibido_id: c.mailRecibidoId, detalle: expect.objectContaining({ cancelacion: true }) });
    });

    // --- Filas 10 y 11 ----------------------------------------------------------------------------

    it("fila 10: una reserva de prueba DK1594100 no es candidata para un mail real (y al revés)", async () => {
      await procesarMail(mailVarias(ASUNTO_OVERLAND), opciones(lector(respuestaCon(fichaSoloOverland())).leer));
      const pedido = {
        agencia: "Kilroy",
        bookingId: "DK1594100",
        productoId: null,
        claveAgencia: "hi_argentina_overland_7days",
        fechaInicio: "2027-01-18",
        pax: 2,
      };
      expect(await cargarCandidatas(admin, { ...pedido, dePrueba: false }, new Date())).toEqual([]);
      expect(await cargarCandidatas(admin, { ...pedido, dePrueba: true }, new Date())).toHaveLength(1);
    });

    it("fila 11: 2 mails del Overland DK1594100 en la misma corrida → 1 reserva, en el orden en que llegaron", async () => {
      const { leer } = lector(respuestaCon(fichaSoloOverland()));
      const temprano = mailVarias(ASUNTO_OVERLAND, { fechaMail: "2026-10-09T08:38:00Z" });
      const tarde = mailVarias(ASUNTO_OVERLAND, { fechaMail: "2026-10-09T10:00:00Z" });
      const [a, b] = await procesarMails([tarde, temprano], opciones(leer));
      expect(a.estado === "procesado" && a.pedidos[0].accion).toBe("nueva");
      expect(b.estado === "procesado" && b.pedidos[0].accion).toBe("sumada");
      const { data: mailA } = await admin.from("mail_recibido").select("fecha_mail").eq("id", a.mailRecibidoId).single();
      expect(mailA!.fecha_mail).toBe("2026-10-09T08:38:00+00:00");
      expect(await reservasDe("DK1594100")).toHaveLength(1);
    });

    it("fila 11: dos procesos a la vez con el mismo booking_id + producto → 1 reserva", async () => {
      const { leer } = lector(respuestaCon(fichaSoloOverland()));
      const resultados = await Promise.all([
        procesarMail(mailVarias(ASUNTO_OVERLAND), opciones(leer)),
        procesarMail(mailVarias(ASUNTO_OVERLAND), opciones(leer)),
      ]);
      const acciones = resultados.flatMap((r) => (r.estado === "procesado" ? r.pedidos.map((p) => p.accion) : [])).sort();
      expect(acciones).toEqual(["nueva", "sumada"]);
      const reservas = await reservasDe("DK1594100");
      expect(reservas).toHaveLength(1);
      expect(await mailsDe(reservas[0])).toHaveLength(2);
      // La red: la base rechaza una segunda reserva del mismo booking_id + producto.
      const otra = crearReserva(
        {
          agencia: "Kilroy",
          mailRecibidoId: reservas[0].mail_recibido_id,
          bookingId: "DK1594100",
          productoId: reservas[0].producto_id,
          productoClaveAgencia: reservas[0].producto_clave_agencia,
          estado: "recibida",
          dePrueba: true,
        },
        admin,
      );
      await expect(otra).rejects.toMatchObject({ code: "23505" });
    });

    it("RLS sigue activa: sin sesión no se ve ni se escribe nada de lo que tocó M2-04", async () => {
      const r = await procesarMail(mailVarias(), opciones(lector(respuestaGrabada("kilroy-dk1594100")).leer));
      const ids = r.estado === "procesado" ? r.pedidos.map((p) => p.reservaId) : [];
      expect(ids).toHaveLength(3);
      expect((await anonimo.from("reserva").select("id").in("id", ids)).data ?? []).toEqual([]);
      expect((await anonimo.from("evento_reserva").select("id").in("reserva_id", ids)).data ?? []).toEqual([]);
      expect((await anonimo.from("mail_recibido").select("id").eq("id", r.mailRecibidoId)).data ?? []).toEqual([]);
      const insert = await anonimo.from("evento_reserva").insert({ reserva_id: ids[0], tipo: "misma_referencia" });
      expect(insert.error).not.toBeNull();
    });
  },
);
