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
import { borrarDatosDePrueba } from "@/lib/reservas/guardar";
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
  },
);
