// @vitest-environment node
//
// Spec M2-09 — verificación 2: los mails de Journaway por el circuito real
// (M2-02 → M2-03 → M2-04) contra la BASE DE PRUEBAS, con el catálogo de
// Journaway de M2-08 cargado y la IA FALSA (no gasta). Filas 4, 6, 10, 12 y
// 15, más la lectura de sales@ (M2-07) con Journaway habilitado.
//
// Todo lo que crea lleva la marca de prueba (o se le pone al final) y se borra
// al terminar, solo eso (registro-de-prueba.ts).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { abrirCasillaImap } from "@/lib/lectura-sales/casilla";
import { leerSales } from "@/lib/lectura-sales/corrida";
import { respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarReserva } from "@/lib/reservas/consultas";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import type { FichaIA } from "@/lib/reservas/esquema-ficha";
import { leerMailConIA, type ClienteMensajesIA } from "@/lib/reservas/extraer";
import { parsearMailDeTexto } from "@/lib/reservas/mail-de-texto";
import { procesarMail } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { fichaIAJournaway, original, sinVuelo, textoJournaway } from "./fixtures/journaway/fichas";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { comandosDeEscritura, crearImapFalso, emlSintetico, type ImapFalso } from "./helpers/imap-falso";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const registro = crearRegistroDePrueba();
const DIA = 86_400_000;
const USUARIO = "sales@falso.test";
const CLAVE = `clave-falsa-${randomUUID()}`;
/** Un ID de Journaway (11 dígitos) único por corrida del test. */
const ID_SALES = `656${String(Date.now()).slice(-8)}`;

/** IDs únicos por corrida: dos mails con el mismo ID (IGRE01 e IGRE02) y dos con el mismo Trip Number y distinto ID. */
const base = String(Date.now()).slice(-7);
const ID_MISMO = `6571${base}`;
const ID_TRIP_1 = `6572${base}`;
const ID_TRIP_2 = `6573${base}`;

/** El mail de ejemplo con un asunto (las copias .docx no lo traen). */
const conAsunto = (texto: string, asunto: string) => texto.replace(/^(Remitente: .*)$/m, (linea) => `${linea}\nAsunto: ${asunto}`);

const conNumero = (f: FichaIA, id: string, tipo?: FichaIA["tipo_mail"]["valor"]): FichaIA => ({
  ...f,
  numero_reserva: { valor: f.numero_reserva.valor?.startsWith("Trip") ? `ID ${id} · ${f.numero_reserva.valor}` : `ID ${id}`, confianza: 1 },
  ...(tipo ? { tipo_mail: { valor: tipo, confianza: 1 } } : {}),
});

/** La ficha que "devuelve la IA" según el mail (los textos de tests/fixtures/journaway). */
function fichaPara(texto: string): FichaIA {
  if (texto.includes(ID_SALES)) return { ...fichaIAJournaway("B"), numero_reserva: { valor: `ID ${ID_SALES}`, confianza: 1 } };
  if (texto.includes(`Cancellation / Client Ejemplo / ID ${ID_MISMO}`)) return conNumero(fichaIAJournaway("B"), ID_MISMO, "cancelacion");
  if (texto.includes(ID_MISMO)) return conNumero(fichaIAJournaway(texto.includes("Argentinean side") ? "A" : "B"), ID_MISMO);
  for (const id of [ID_TRIP_1, ID_TRIP_2]) if (texto.includes(id)) return conNumero(fichaIAJournaway("C"), id);
  if (texto.includes("Trip Number")) return texto.includes("LA377") ? fichaIAJournaway("C") : sinVuelo(original("C"), "LA377").ficha;
  if (texto.includes("Tayka")) return fichaIAJournaway("D");
  if (texto.includes("Argentinean side")) return fichaIAJournaway("A");
  return fichaIAJournaway("B");
}

function iaFalsa() {
  const create = vi.fn(async (params: { messages: Array<{ content: Array<{ type: string; text?: string }> }> }) =>
    respuestaCon(fichaPara(params.messages[0].content.map((b) => b.text ?? "").join("\n"))),
  );
  return { cliente: { messages: { create } } as unknown as ClienteMensajesIA, create };
}

const registroMes = (): RegistroUsoIA => ({ gastoDelMes: async () => 0, sumar: async () => {} });

function entrada(texto: string): MailEntrada {
  const m = parsearMailDeTexto(texto);
  return {
    origen: "archivo",
    archivoOrigen: "m2-09-test.txt",
    messageId: `<m2-09-${randomUUID()}@prueba.test>`,
    remitente: m.remitente,
    asunto: m.asunto,
    fechaMail: new Date().toISOString(),
    cuerpoTexto: m.cuerpoTexto,
    adjuntos: [],
    dePrueba: true,
  };
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M2-09 — reservas de Journaway contra la base de pruebas (IA falsa)",
  { timeout: 240_000 },
  () => {
    let admin: SupabaseClient;
    let soltarBloqueo: () => void;
    let deps: DependenciasReservas;
    const falsos: ImapFalso[] = [];
    const corridas: string[] = [];

    /** Procesa mails de un escenario; el "mismo intercambio" se busca solo entre los de ese escenario. */
    function escenario() {
      const propios: string[] = [];
      const ia = iaFalsa();
      return {
        ia,
        propios,
        procesar: async (texto: string) => {
          const r = await procesarMail(entrada(texto), {
            admin,
            dePrueba: true,
            alcance: () => propios,
            leer: (mail, ctx) => {
              registro.mail(ctx.mailRecibidoId);
              propios.push(ctx.mailRecibidoId);
              return leerMailConIA(mail, { cliente: ia.cliente, registro: registroMes(), mes: "2026-10", mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
            },
            deps: () => deps,
          });
          registro.mail(r.mailRecibidoId);
          return r;
        },
      };
    }

    async function reservasDe(mailId: string) {
      const { data, error } = await admin.from("reserva").select("*, producto:producto_id(codigo)").eq("mail_recibido_id", mailId).order("created_at");
      if (error) throw new Error(error.message);
      return data as Array<Record<string, unknown> & { id: string; producto: { codigo: string } | null }>;
    }

    async function partesDe(reservaId: string) {
      const { data, error } = await admin
        .from("reserva_componente")
        .select("orden,tipo,descripcion_ruta,texto_agencia,fecha_inicio,fecha_fin,pick_up,producto:producto_id(codigo)")
        .eq("reserva_id", reservaId)
        .order("orden");
      if (error) throw new Error(error.message);
      return data as unknown as Array<Record<string, string | null> & { producto: { codigo: string } | null }>;
    }

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      deps = await cargarDependenciasReservas(admin);
      const codigos = deps.journaway!.catalogo.paquetes.map((p) => p.codigo);
      if (!codigos.includes("SPAP05")) throw new Error("La base de pruebas no tiene el catálogo de Journaway (M2-08): correr importar:journaway en pruebas.");
      // Hasta 5 minutos esperando el candado de datos de prueba (otros archivos lo usan) más la carga.
    }, 420_000);

    afterAll(async () => {
      try {
        const mails = registro.mails;
        if (mails.length) {
          // Lo que creó la lectura de sales@ nace real (#11 de M2-07): se marca de prueba para poder borrarlo.
          const { data } = await admin.from("reserva").select("id").in("mail_recibido_id", [...mails]);
          const ids = (data ?? []).map((r) => r.id);
          if (ids.length) await admin.from("reserva").update({ de_prueba: true }).in("id", ids);
          await admin.from("mail_recibido").update({ de_prueba: true }).in("id", [...mails]);
        }
        await registro.limpiar(admin);
        if (corridas.length) await admin.from("lectura_casilla").delete().in("id", corridas);
        for (const f of falsos) await f.detener();
      } finally {
        soltarBloqueo?.();
      }
    }, 120_000);

    it("filas 6 y 10: el mail D da SPAP05 con sus partes, el pick up de cada tour y los 8 hoteles solo como información", async () => {
      const e = escenario();
      const r = await e.procesar(textoJournaway("D"));
      const [reserva, ...otras] = await reservasDe(r.mailRecibidoId);
      expect(otras).toEqual([]);
      expect(reserva).toMatchObject({
        agencia: "Journaway",
        estado: "recibida",
        booking_id: null,
        trip_number: null,
        fecha_inicio: "2026-10-11",
        fecha_fin: "2026-10-17",
        pax: 2,
        de_prueba: true,
        sin_traslado_de: null,
      });
      expect(reserva.producto?.codigo).toBe("SPAP05");
      expect(reserva.contacto_cliente).toEqual({ nombre: "Karl Mustermann", email: "karl.mustermann@example.de", telefono: "+49 151 0000003" });
      expect(reserva.notas).toContain("Trae adjuntos: pasaportes (no se leen)");
      expect((reserva.hoteles_agencia as unknown[]).length).toBe(8);

      const partes = await partesDe(reserva.id);
      expect(partes.map((p) => [p.producto?.codigo, p.fecha_inicio, p.fecha_fin, p.pick_up])).toEqual([
        ["SPAT01", "2026-10-11", "2026-10-11", null],
        ["SPAE01", "2026-10-11", "2026-10-11", "Our Habitas Atacama"],
        ["SPAE03", "2026-10-12", "2026-10-12", "Our Habitas Atacama"],
        ["SPAE05", "2026-10-13", "2026-10-13", "Our Habitas Atacama"],
        ["SPAE04", "2026-10-14", "2026-10-14", "Our Habitas Atacama"],
        ["SPAT02", "2026-10-15", "2026-10-15", null],
        ["UYUO01", "2026-10-15", "2026-10-17", "Tayka del Desierto Hotel / Tayka del Sal Hotel"],
      ]);
      const aPedir = JSON.stringify(partes.map((p) => [p.descripcion_ruta, p.texto_agencia])) + String(reserva.pedidos_especiales ?? "");
      for (const h of ["Hub Providencia", "Fauna", "Our Habitas Atacama -", "MET Hotel", "Sonesta", "Night Bus Peru", "Viza", "Saska"]) {
        expect(aPedir).not.toContain(h);
      }

      // Cada reserva deja su evento "creada" (#1).
      const { data: eventos } = await admin.from("evento_reserva").select("tipo").eq("reserva_id", reserva.id);
      expect(eventos!.map((x) => x.tipo)).toContain("creada");

      // El detalle (M2-05) lo muestra: hoteles, pick up, sin número de viaje, el traslado de llegada con LA148 sin aviso.
      const detalle = await cargarReserva(admin, reserva.id);
      expect(detalle!.hotelesAgencia).toHaveLength(8);
      expect(detalle!.tripNumber).toBeNull();
      expect(detalle!.partes.find((p) => p.producto?.codigo === "SPAE01")?.pickUp).toBe("Our Habitas Atacama");
      expect(detalle!.avisosVuelo).toEqual([]);
      expect(detalle!.vuelos.find((v) => v.destino === "CJC")).toMatchObject({ numero: "LA148", fechaLlegada: "2026-10-11", horaLlegada: "16:11" });
    });

    it("filas 4, 12 y 15: el mail C es UNA reserva SPAP01 + SPAP03 (owner 2026-10-17), con las partes en orden de fecha", async () => {
      const e = escenario();
      const r = await e.procesar(textoJournaway("C"));
      const reservas = await reservasDe(r.mailRecibidoId);
      expect(reservas).toHaveLength(1);
      const [x] = reservas;
      expect(x.producto?.codigo).toBe("SPAP01");
      expect(x).toMatchObject({ estado: "recibida", trip_number: "62992", booking_id: null, pax: 2, posible_duplicada: false, sin_traslado_de: "salida" });
      expect(x.fecha_inicio).toBe("2027-03-16");
      expect(x.fecha_fin).toBe("2027-03-23");
      expect(x.hoteles_agencia).toEqual([]);
      const partes = await partesDe(x.id);
      expect(partes.map((p) => [p.producto?.codigo, p.fecha_inicio])).toEqual([
        ["SPAT01", "2027-03-16"],
        ["SPAE01", "2027-03-16"],
        ["SPAE03", "2027-03-17"],
        ["SPAE04", "2027-03-17"],
        ["SPAE05", "2027-03-18"],
        ["SPAE02", "2027-03-19"],
        ["SPAE06", "2027-03-20"],
        ["SPAE07", "2027-03-21"],
        ["SPAT01", "2027-03-23"],
      ]);
      expect(partes[0].descripcion_ruta).toBe("Solo la llegada: la salida va con SPAP03");
      const detalle = (await cargarReserva(admin, x.id))!;
      expect(detalle.otrosProductos?.map((p) => p.codigo)).toEqual(["SPAP03"]);
      expect(detalle.avisosVuelo).toEqual([]);
    });

    it("fila 15 (con la regla del owner 2026-10-16): sin el vuelo LA377 queda recibida con un solo aviso, el de la salida de Calama", async () => {
      const e = escenario();
      const r = await e.procesar(sinVuelo(original("C"), "LA377").texto);
      const reservas = await reservasDe(r.mailRecibidoId);
      expect(reservas).toHaveLength(1);
      expect(reservas[0].estado).toBe("recibida");
      expect((await cargarReserva(admin, reservas[0].id))!.avisosVuelo).toEqual([expect.stringMatching(/^Falta el vuelo de salida de Calama \(CJC\)/)]);
    });

    it("owner 2026-10-17: dos mails con el mismo ID de Journaway son UNA reserva con IGRE01 + IGRE02; repetir uno no duplica; una cancelación va a revisión", async () => {
      const e = escenario();
      const asunto = `de-DE Activity Booking / Client Ejemplo / ID ${ID_MISMO}`;
      const a = await e.procesar(conAsunto(textoJournaway("A"), asunto));
      const b = await e.procesar(conAsunto(textoJournaway("B"), asunto));
      expect(a.pedidos[0].accion).toBe("nueva");
      expect(b.pedidos[0]).toMatchObject({ accion: "sumada", reservaId: a.pedidos[0].reservaId });
      expect(await reservasDe(b.mailRecibidoId)).toEqual([]);
      const [r] = await reservasDe(a.mailRecibidoId);
      expect(r).toMatchObject({ booking_id: ID_MISMO, estado: "recibida", posible_duplicada: false, fecha_inicio: "2027-06-13", fecha_fin: "2027-06-14" });
      expect(r.producto?.codigo).toBe("IGRE01");
      expect((await partesDe(r.id)).map((p) => [p.producto?.codigo, p.fecha_inicio, p.pick_up])).toEqual([
        ["IGRE02", "2027-06-13", "Hotel Rafain Centro"],
        ["IGRE01", "2027-06-14", "Hotel Rafain Centro"],
      ]);
      const detalle = (await cargarReserva(admin, r.id))!;
      expect(detalle.otrosProductos?.map((p) => p.codigo)).toEqual(["IGRE02"]);
      expect(detalle.mails).toHaveLength(2);

      // El mismo pedido otra vez (otro mail): se suma, sin partes repetidas.
      const otra = await e.procesar(conAsunto(textoJournaway("B"), asunto));
      expect(otra.pedidos[0].accion).toBe("sumada");
      expect(await partesDe(r.id)).toHaveLength(2);

      // Una cancelación con ese ID: a revisión, como siempre.
      const cancela = await e.procesar(conAsunto(textoJournaway("B"), `Cancellation / Client Ejemplo / ID ${ID_MISMO}`));
      expect(cancela.pedidos[0]).toMatchObject({ accion: "sumada", reservaId: r.id });
      const [despues] = await reservasDe(a.mailRecibidoId);
      expect(despues.estado).toBe("para_revision");
      expect(await partesDe(r.id)).toHaveLength(2);
    });

    it("owner 2026-10-17: el mismo Trip Number con distinto ID no se junta (manda el ID)", async () => {
      const e = escenario();
      const uno = await e.procesar(conAsunto(textoJournaway("C"), `Program Booking / Client Probe / ID ${ID_TRIP_1}`));
      const dos = await e.procesar(conAsunto(textoJournaway("C"), `Program Booking / Client Muster / ID ${ID_TRIP_2}`));
      expect([uno.pedidos[0].accion, dos.pedidos[0].accion]).toEqual(["nueva", "nueva"]);
      const [r1] = await reservasDe(uno.mailRecibidoId);
      const [r2] = await reservasDe(dos.mailRecibidoId);
      expect([r1.booking_id, r2.booking_id]).toEqual([ID_TRIP_1, ID_TRIP_2]);
      expect([r1.trip_number, r2.trip_number]).toEqual(["62992", "62992"]);
    });

    it("fila 12: A y B son dos reservas aparte; el mail A otra vez queda como 'posible duplicada', sin crear otra en silencio", async () => {
      const e = escenario();
      const a = await e.procesar(textoJournaway("A"));
      const b = await e.procesar(textoJournaway("B"));
      const [ra] = await reservasDe(a.mailRecibidoId);
      const [rb] = await reservasDe(b.mailRecibidoId);
      expect([ra.producto?.codigo, rb.producto?.codigo]).toEqual(["IGRE01", "IGRE02"]);
      expect([ra.booking_id, rb.booking_id]).toEqual([null, null]);
      expect([ra.posible_duplicada, rb.posible_duplicada]).toEqual([false, false]);
      expect(ra.notas).toContain("Journaway lo llama half-day; es el full day");
      expect(ra.contacto_cliente).toBeNull();

      const otra = await e.procesar(textoJournaway("A"));
      const [dup] = await reservasDe(otra.mailRecibidoId);
      expect(dup).toMatchObject({ posible_duplicada: true, duplicada_de_id: ra.id });
      expect(otra.pedidos[0].accion).toBe("posible_duplicada");
    });

    it("M2-07 con Journaway: un 'Program Booking' de sales@ se lee con IA y nace real; una novedad de Journaway se registra sin IA", async () => {
      const falso = await crearImapFalso({ usuario: USUARIO, clave: CLAVE, carpetas: [{ path: "INBOX" }, { path: "INBOX.spam" }] });
      falsos.push(falso);
      const cuerpoB = textoJournaway("B").split("\n\n").slice(1).join("\n\n").replace(/\n/g, "\r\n");
      falso.agregar("INBOX", {
        fuente: emlSintetico({
          de: "Agente Ejemplo von journaway <de@journaway.com>",
          asunto: `de-DE Activity Booking / Client Ejemplo / ID ${ID_SALES}`,
          fecha: new Date(Date.now() - DIA),
          messageId: `<m2-09-${randomUUID()}@falso.test>`,
          cuerpo: cuerpoB,
        }),
        fecha: new Date(Date.now() - DIA),
      });
      falso.agregar("INBOX", {
        fuente: emlSintetico({
          de: "journaway <newsletter@journaway.com>",
          asunto: "Unsere Reiseideen für den Herbst",
          fecha: new Date(Date.now() - DIA),
          messageId: `<m2-09-${randomUUID()}@falso.test>`,
        }),
        fecha: new Date(Date.now() - DIA),
      });
      const ia = iaFalsa();
      const guardados: string[] = [];
      const resumen = await leerSales({
        admin,
        origen: "manual",
        casilla: () => abrirCasillaImap({ host: "127.0.0.1", puerto: falso.puerto, seguro: false, usuario: USUARIO, clave: CLAVE, esperaMs: 3_000 }),
        registroUso: registroMes(),
        alcance: () => guardados,
        alGuardar: (id) => {
          guardados.push(id);
          registro.mail(id);
        },
        leer: (mail, ctx) => leerMailConIA(mail, { cliente: ia.cliente, registro: ctx.registro, mes: "2026-10", mailRecibidoId: ctx.mailRecibidoId }),
        deps: () => deps,
      });
      if (resumen.id) corridas.push(resumen.id);
      expect(comandosDeEscritura(falso.comandos)).toEqual([]);
      expect(ia.create).toHaveBeenCalledTimes(1);
      expect(resumen).toMatchObject({ de_agencias: 2, procesados: 1, reservas_nuevas: 1 });

      const { data: mails } = await admin.from("mail_recibido").select("id,remitente,estado_lectura").in("id", guardados);
      expect(mails!.find((m) => m.remitente === "newsletter@journaway.com")?.estado_lectura).toBe("registrado");
      const reserva = (await reservasDe(mails!.find((m) => m.remitente === "de@journaway.com")!.id))[0];
      expect(reserva).toMatchObject({ agencia: "Journaway", booking_id: ID_SALES, estado: "recibida", de_prueba: false });
      expect(reserva.producto?.codigo).toBe("IGRE02");
    });
  },
);
