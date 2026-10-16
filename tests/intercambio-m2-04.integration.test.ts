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
  fichaGrabada as fichaGrabadaReal,
  mailDePrueba as mailDePruebaReal,
  pdfSintetico,
  registroFalso,
  respuestaCon as respuestaConReal,
  respuestaGrabada as respuestaGrabadaReal,
} from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { crearReserva } from "@/lib/reservas/guardar";
import { MOTIVOS_INTERCAMBIO as MI } from "@/lib/reservas/intercambio";
import {
  cargarCandidatas,
  cargarReservasDelAsunto,
  procesarMail as procesarMailReal,
  procesarMails as procesarMailsReal,
  type OpcionesProceso,
} from "@/lib/reservas/procesar-mail";
import { respuestaMereceLectura } from "@/lib/reservas/respuestas";
import type { MailEntrada, Reserva } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { aNumeroDeTest as n, conNumerosDeTest } from "@/lib/reservas/numeros-de-test";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

/**
 * Lo que crea este archivo: lo único que borra (antes de cada test y al
 * final). Los mails se anotan al procesarlos y, por si el proceso se corta a
 * la mitad, también cuando se leen.
 */
const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
const procesarMails = registro.conMailRecibido(procesarMailsReal);

type Ficha = Record<string, unknown> & { productos: Array<Record<string, unknown>> };

/*
 * Copias de los mails y las respuestas grabadas con números de reserva de test
 * (DK1594100 → DK9594100): el modo prueba (M2-06) guarda en la misma base las
 * reservas reales de los mails de ejemplo, y este archivo no tiene que tocarlas.
 */
const mailDePrueba = (nombre: string) => conNumerosDeTest(mailDePruebaReal(nombre));
const fichaGrabada = (nombre: string) => conNumerosDeTest(fichaGrabadaReal(nombre));
const respuestaGrabada = (nombre: string) => conNumerosDeTest(respuestaGrabadaReal(nombre));
const respuestaCon = (ficha: unknown) => conNumerosDeTest(respuestaConReal(ficha));

const ASUNTO_VARIAS = n("DK1594100/maga - 3 NEW BOOKINGS - KILROY booking request");
const ASUNTO_OVERLAND = n("DK1594100/maga - Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days - KILROY booking request");

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
      const leerAnotando: OpcionesProceso["leer"] = (mail, ctx) => {
        registro.mail(ctx.mailRecibidoId);
        return leer(mail, ctx);
      };
      // `alcance`: el mismo intercambio se busca solo entre las reservas de este archivo.
      return {
        admin,
        leer: leerAnotando,
        deps: () => deps,
        llamadas: crearRegistroLlamadasSupabase(admin),
        dePrueba: true,
        alcance: () => registro.mails,
        ...extra,
      };
    }

    function entrada(base: { remitente: string; asunto?: string | null; cuerpoTexto?: string | null }, extra: Partial<MailEntrada> = {}): MailEntrada {
      return {
        origen: "archivo",
        messageId: `<m2-04-${randomUUID()}@prueba.hitravel.local>`,
        remitente: base.remitente,
        asunto: n(base.asunto) ?? null,
        cuerpoTexto: n(base.cuerpoTexto) ?? null,
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
      // Solo las de este archivo: puede haber otras de prueba (las del modo prueba, M2-06).
      const { data, error } = await admin
        .from("reserva")
        .select("*")
        .eq("booking_id", n(bookingId))
        .eq("de_prueba", true)
        .in("mail_recibido_id", registro.mails)
        .order("created_at");
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
      await registro.limpiar(admin);
    }, 120_000);

    afterAll(async () => {
      try {
        const mails = registro.mails;
        await registro.limpiar(admin);
        const { data } = await admin.from("reserva").select("id").in("mail_recibido_id", mails);
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
      const { data: mails } = await admin.from("mail_recibido").select("id,procesado_en").eq("de_prueba", true).in("id", registro.mails);
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
      expect(laDelOverland.booking_id_original).toBe(n("DK1594100/maga"));

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

    it("owner 2026-10-14: el cargo extra de TourRadar 1377598 manda la reserva recibida a revisión, y queda en el historial", async () => {
      const pdf = (asunto: string) =>
        entrada(
          { remitente: "system@sent-via.netsuite.com", asunto, cuerpoTexto: "" },
          { adjuntos: [{ nombre: `${asunto}.pdf`, tipo: "application/pdf", contenido: pdfSintetico() }] },
        );
      await procesarMail(
        pdf("Booking Statement 1377598 - 25372219 - vendorbill"),
        opciones(lector(respuestaGrabada("tourradar-1377598-opcionales")).leer),
      );
      // La reserva ya se revisó y quedó recibida (lo haría una persona en la pantalla).
      const [antes] = await reservasDe("1377598");
      const { error } = await admin.from("reserva").update({ estado: "recibida", motivos_revision: [] }).eq("id", antes.id);
      if (error) throw new Error(error.message);

      const cargo = await procesarMail(
        pdf("Booking Statement 1377598 - 25388222 - vendorbill"),
        opciones(lector(respuestaGrabada("tourradar-cargo-1377598")).leer),
      );
      expect(cargo.estado === "procesado" && cargo.pedidos.map((p) => p.accion)).toEqual(["sumada"]);
      const motivo = "TourRadar mandó un cargo extra: puede ser un servicio nuevo. Revisar.";
      const [despues] = await reservasDe("1377598");
      expect(despues).toMatchObject({ id: antes.id, estado: "para_revision", motivos_revision: [motivo] });

      const eventos = await eventosDe(antes.id);
      expect(eventos.at(-1)).toMatchObject({ tipo: "estado_cambiado", estado_nuevo: "para_revision", detalle: { motivos: [motivo] } });
      expect(eventos).toContainEqual(expect.objectContaining({ tipo: "mail_agregado", mail_recibido_id: cargo.mailRecibidoId }));
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
      expect(nueva.motivos_revision[0]).toBe(MI.ambigua(2, n("DK1576932")));
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
    const ASUNTO_CANCELACION = n("Booking Statement 1363612 - 25160515 - vendorcredit");

    it("fila 9: la cancelación de 1363612 sin la reserva cargada → 1 reserva para revisión con ese motivo", async () => {
      await procesarMail(statement(ASUNTO_CANCELACION), opciones(lector(respuestaGrabada("tourradar-cancelacion-1363612")).leer));
      const reservas = await reservasDe("1363612");
      expect(reservas).toHaveLength(1);
      expect(reservas[0].estado).toBe("para_revision");
      expect(reservas[0].motivos_revision).toContain(MI.cancelacionSinReserva);
    });

    it("owner 2026-10-16: la cancelación 1363612 con la noche de hotel extra → UNA reserva (la del tour), y otra igual se le suma", async () => {
      const conHotel = () => {
        const f = fichaGrabada("tourradar-cancelacion-1363612") as Ficha;
        f.productos = [
          ...f.productos,
          { nombre: "Hotel La Aldea 4*", codigo: null, fecha_inicio: null, fecha_fin: null, noches: null, habitacion: "SGL", punto_recogida: null, opcionales: [], confianza: 0.7 },
        ];
        return f;
      };
      const r = await procesarMail(statement(ASUNTO_CANCELACION), opciones(lector(respuestaCon(conHotel())).leer));
      expect(r.estado === "procesado" && r.pedidos.map((p) => p.accion)).toEqual(["nueva"]);
      const [reserva, ...otras] = await reservasDe("1363612");
      expect(otras).toEqual([]);
      expect(reserva).toMatchObject({
        producto_texto_agencia: "Iguazu Falls on a Shoestring (3N)",
        producto_clave_agencia: "iguazu falls on a shoestring (3n)",
        pedidos_especiales: expect.stringContaining("También en el estado de cuenta: Hotel La Aldea 4* (SGL)"),
      });
      const otra = await procesarMail(
        statement("Booking Statement 1363612 - 25300001 - vendorcredit"),
        opciones(lector(respuestaCon(conHotel())).leer),
      );
      expect(otra.estado === "procesado" && otra.pedidos.map((p) => p.accion)).toEqual(["sumada"]);
      expect(await reservasDe("1363612")).toHaveLength(1);
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
        bookingId: n("DK1594100"),
        productoId: null,
        claveAgencia: "hi_argentina_overland_7days",
        fechaInicio: "2027-01-18",
        pax: 2,
      };
      expect(await cargarCandidatas(admin, { ...pedido, dePrueba: false }, new Date())).toEqual([]);
      // Acotada a este archivo: la marca blanda (misma fecha y pax) también vería las reservas del modo prueba (M2-06).
      expect(await cargarCandidatas(admin, { ...pedido, dePrueba: true }, new Date(), registro.mails)).toHaveLength(1);
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
          bookingId: n("DK1594100"),
          productoId: reservas[0].producto_id,
          productoClaveAgencia: reservas[0].producto_clave_agencia,
          estado: "recibida",
          dePrueba: true,
        },
        admin,
      );
      await expect(otra).rejects.toMatchObject({ code: "23505" });
    });

    // --- Respuestas con vuelos (owner, 2026-10-14) — datos inventados -----------------------------

    const ASUNTO_ALTA = n("DK1562336/emri - Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days - KILROY booking request");
    const CUERPO_ALTA =
      "NEW BOOKING\nTour code: HI_ARGENTINA_OVERLAND_7DAYS-677\nStart date: 06 Mar 2027\nEnd date: 12 Mar 2027\nKILROY Reference.:DK1562336/emri\n";
    const ASUNTO_VUELO = n("Re: NEW FLIGHT: DK1562336 /emri - Overland San Pedro de Atacama");

    async function altaQueEsperaVuelo(): Promise<Reserva> {
      const f = fichaGrabada("kilroy-od010d") as Ficha;
      Object.assign(f, {
        numero_reserva: { valor: "DK1562336/emri", confianza: 1 },
        fecha_inicio: { valor: "2027-03-06", confianza: 1 },
        fecha_fin: { valor: "2027-03-12", confianza: 1 },
        pasajeros: [],
        vuelos: [],
        pedidos_especiales: [],
      });
      f.productos = [
        {
          ...f.productos[0],
          nombre: "Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days",
          codigo: "HI_ARGENTINA_OVERLAND_7DAYS-677",
          fecha_inicio: "2027-03-06",
          fecha_fin: "2027-03-12",
          noches: 6,
          confianza: 1,
        },
      ];
      await procesarMail(
        entrada({ remitente: "copenhagen@kilroy.dk", asunto: ASUNTO_ALTA, cuerpoTexto: CUERPO_ALTA }),
        opciones(lector(respuestaCon(f)).leer),
      );
      const [r] = await reservasDe("DK1562336");
      return r;
    }

    function respuestaConVuelo() {
      const f = fichaGrabada("kilroy-od010d") as Ficha;
      Object.assign(f, {
        tipo_mail: { valor: "respuesta_intercambio", confianza: 1 },
        numero_reserva: { valor: "DK1562336", confianza: 1 },
        productos: [],
        fecha_inicio: { valor: null, confianza: 0 },
        fecha_fin: { valor: null, confianza: 0 },
        pax: { valor: null, confianza: 0 },
        pasajeros: [],
        pedidos_especiales: [],
        vuelos: [
          {
            numero: "LA148",
            aerolinea: "LATAM",
            origen: "SCL",
            destino: "CJC",
            fecha_salida: "2027-03-06",
            hora_salida: "12:00",
            fecha_llegada: "2027-03-06",
            hora_llegada: "14:10",
            confianza: 0.95,
          },
        ],
      });
      const mail = entrada(
        { remitente: "copenhagen@kilroy.dk", asunto: ASUNTO_VUELO, cuerpoTexto: "Flight: LA148 SCL-CJC, 06 Mar 2027, dep 12:00, arr 14:10" },
        { fechaMail: "2026-10-12T09:00:00Z" },
      );
      return { mail, ...lector(respuestaCon(f)) };
    }

    it("owner 2026-10-16: 'Re: NEW FLIGHT: DK1562336' con la reserva recibida y el aviso del vuelo → se lee, se suma y el aviso se va", async () => {
      const alta = await altaQueEsperaVuelo();
      expect(alta).toMatchObject({ estado: "recibida", motivos_revision: [] });

      const r = respuestaConVuelo();
      const candidatas = await cargarReservasDelAsunto(admin, ASUNTO_VUELO, "Kilroy", true, registro.mails);
      expect(candidatas).toEqual([
        expect.objectContaining({ id: alta.id, avisos_vuelo: ["Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030"] }),
      ]);
      const decision = respuestaMereceLectura(ASUNTO_VUELO, "Kilroy", candidatas, { dePrueba: true });
      expect(decision).toEqual({ leer: true, motivo: "espera_vuelo", reservaIds: [alta.id] });

      const p = await procesarMail(r.mail, opciones(r.leer));
      expect(p.estado === "procesado" && p.pedidos.map((x) => x.accion)).toEqual(["sumada"]);
      const [despues] = await reservasDe("DK1562336");
      expect(await reservasDe("DK1562336")).toHaveLength(1);
      expect(despues).toMatchObject({ id: alta.id, estado: "recibida", motivos_revision: [] });
      const agregado = (await eventosDe(alta.id)).find((e) => e.tipo === "mail_agregado")!;
      expect((agregado.detalle as { nota: string }).nota).toBe("Llegaron los vuelos (mail del 12/10)");
      const ahora = await cargarReservasDelAsunto(admin, ASUNTO_VUELO, "Kilroy", true, registro.mails);
      expect(ahora).toEqual([expect.objectContaining({ id: alta.id, avisos_vuelo: [] })]);
    });

    it("Iguazú (owner 2026-10-14): OD010D sin vuelo queda recibida; 'Re: NEW FLIGHT' se lee, suma el vuelo y el aviso se va", async () => {
      const alta = fichaGrabada("kilroy-od010d") as Ficha;
      Object.assign(alta, { vuelos: [], pedidos_especiales: [] });
      await procesarMail(
        entrada(mailDePrueba("kilroy-od010d")),
        opciones(lector(respuestaCon(alta)).leer),
      );
      const [r] = await reservasDe("DK1564627");
      expect(r).toMatchObject({ estado: "recibida", motivos_revision: [] });

      const asunto = n("Re: NEW FLIGHT: DK1564627 /cafj - Iguazu Falls Combined");
      const antes = await cargarReservasDelAsunto(admin, asunto, "Kilroy", true, registro.mails);
      expect(antes).toEqual([expect.objectContaining({ id: r.id, sin_dato_llegada: true })]);
      expect(respuestaMereceLectura(asunto, "Kilroy", antes, { dePrueba: true })).toEqual({ leer: true, motivo: "espera_vuelo", reservaIds: [r.id] });

      const vuelo = fichaGrabada("kilroy-od010d") as Ficha;
      Object.assign(vuelo, {
        tipo_mail: { valor: "respuesta_intercambio", confianza: 1 },
        numero_reserva: { valor: "DK1564627", confianza: 1 },
        productos: [],
        fecha_inicio: { valor: null, confianza: 0 },
        fecha_fin: { valor: null, confianza: 0 },
        pax: { valor: null, confianza: 0 },
        pasajeros: [],
        pedidos_especiales: [],
        vuelos: [
          { numero: "G31234", aerolinea: "GOL", origen: "GRU", destino: "IGU", fecha_salida: "2026-09-06", hora_salida: "08:00", fecha_llegada: "2026-09-06", hora_llegada: "09:45", confianza: 0.95 },
        ],
      });
      const p = await procesarMail(
        entrada({ remitente: "aarhus@kilroy.dk", asunto, cuerpoTexto: "Flight G31234 GRU-IGU 06 Sep 2026 dep 08:00 arr 09:45" }),
        opciones(lector(respuestaCon(vuelo)).leer),
      );
      expect(p.estado === "procesado" && p.pedidos.map((x) => x.accion)).toEqual(["sumada"]);
      const [despues] = await reservasDe("DK1564627");
      expect(despues).toMatchObject({ id: r.id, estado: "recibida" });
      expect((despues.vuelos as Array<{ numero: string }>).map((v) => v.numero)).toEqual(["G31234"]);
      const ahora = await cargarReservasDelAsunto(admin, asunto, "Kilroy", true, registro.mails);
      expect(ahora).toEqual([expect.objectContaining({ id: r.id, sin_dato_llegada: false })]);
    });

    it("la misma respuesta con la reserva que ya tiene el vuelo, o sin número conocido → no se lee (sin IA)", async () => {
      await altaQueEsperaVuelo();
      const llegada = { numero: "LA148", aerolinea: "LATAM", origen: "SCL", destino: "CJC", fecha_salida: "2027-03-06", hora_salida: "12:00", fecha_llegada: "2027-03-06", hora_llegada: "14:10", confianza: 0.95 };
      await admin
        .from("reserva")
        .update({ estado: "recibida", motivos_revision: [], vuelos: [llegada] })
        .eq("booking_id", n("DK1562336"))
        .eq("de_prueba", true)
        .in("mail_recibido_id", registro.mails);
      const candidatas = await cargarReservasDelAsunto(admin, ASUNTO_VUELO, "Kilroy", true);
      expect(respuestaMereceLectura(ASUNTO_VUELO, "Kilroy", candidatas, { dePrueba: true })).toMatchObject({
        leer: false,
        motivo: "no_espera_vuelo",
      });
      const otro = "Re: NEW FLIGHT: DK1999999 /emri";
      expect(
        respuestaMereceLectura(otro, "Kilroy", await cargarReservasDelAsunto(admin, otro, "Kilroy", true), { dePrueba: true }),
      ).toMatchObject({ leer: false, motivo: "sin_numero_conocido" });
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
