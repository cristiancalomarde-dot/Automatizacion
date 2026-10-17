// @vitest-environment node
//
// Spec M2-07 — verificación 2: la corrida completa contra el SERVIDOR IMAP
// FALSO (tests/helpers/imap-falso.ts) y la BASE DE PRUEBAS, con la IA FALSA
// (no gasta). Criterios #1, #2, #3, #6, #8-15 y #17-19.
//
// Las reservas de la lectura real nacen SIN la marca de prueba (#11). Al
// final, todo lo que creó este archivo se marca de prueba y se borra (solo
// eso), y se borran sus filas de `lectura_casilla`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { abrirCasillaImap } from "@/lib/lectura-sales/casilla";
import { lineaDeLaLectura } from "@/lib/lectura-sales/consulta-estado";
import { leerSales, type OpcionesLectura, type ResumenCorrida } from "@/lib/lectura-sales/corrida";
import { correrModoPrueba } from "@/lib/modo-prueba/corrida";
import { fichaGrabada, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA, type ClienteMensajesIA } from "@/lib/reservas/extraer";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { comandosDeEscritura, crearImapFalso, emlSintetico, type ImapFalso } from "./helpers/imap-falso";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const registro = crearRegistroDePrueba();
/** Lo que crea la corrida de M2-06 de la comparación (#11): se borra primero, si no la real no puede tomar la marca. */
const registroM206 = crearRegistroDePrueba();
const FIXTURES = join(__dirname, "..", "src", "lib", "modo-prueba", "__fixtures__");
const USUARIO = "sales@falso.test";
const CLAVE = `clave-falsa-${randomUUID()}`;
const MARCA_CUERPO = `cuerpo-secreto-${randomUUID()}`;
const DIA = 86_400_000;

type Ficha = Record<string, unknown> & { productos: Array<Record<string, unknown>> };

/** Un número de reserva Kilroy único por corrida del test (no choca con restos de otras corridas). */
const sufijo = String(Date.now()).slice(-5);
const dk = (n: number) => `DK9${sufijo}${n}`;

/** La ficha que "devuelve la IA": Overland (CHB31) para Kilroy, el statement grabado para TourRadar. */
function fichaPara(texto: string): Ficha {
  const kilroy = /DK\d{7,9}/.exec(texto)?.[0];
  if (kilroy) {
    const f = fichaGrabada("kilroy-dk1594100") as Ficha;
    f.productos = f.productos.filter((p) => String(p.codigo).includes("OVERLAND"));
    Object.assign(f, { numero_reserva: { valor: `${kilroy}/abcd`, confianza: 1 } });
    return f;
  }
  const numero = /Booking Statement (\d{7})/.exec(texto)?.[1] ?? "0000042";
  const f = fichaGrabada("tourradar-1376833") as Ficha;
  Object.assign(f, { numero_reserva: { valor: numero, confianza: 1 } });
  return f;
}

/** IA falsa: contesta la ficha y cuenta las llamadas; "IA-CAIDA" en el mail = la API no responde. */
function iaFalsa() {
  const create = vi.fn(async (params: { messages: Array<{ content: Array<{ type: string; text?: string }> }> }) => {
    const texto = params.messages[0].content.map((b) => b.text ?? "").join("\n");
    if (texto.includes("IA-CAIDA")) throw new Error("503 la IA no está");
    return respuestaCon(fichaPara(texto));
  });
  return { cliente: { messages: { create } } as unknown as ClienteMensajesIA, create };
}

function registroMes(alSumar?: () => number): RegistroUsoIA {
  let gasto = 0;
  return {
    gastoDelMes: async () => gasto,
    sumar: async (_mes, uso) => {
      gasto += alSumar ? alSumar() : uso.costo;
    },
  };
}

/** Un .eml de ejemplo con un Message-ID nuevo (la lectura real usa el Message-ID de verdad). */
function fixtureConId(nombre: string, cambiar: (s: string) => string = (s) => s): string {
  const fuente = readFileSync(join(FIXTURES, nombre), "utf8").replace(/\r?\n/g, "\r\n");
  return cambiar(fuente.replace(/^Message-ID: .*$/m, `Message-ID: <m2-07-${randomUUID()}@falso.test>`));
}

const reserva = (n: number, extra: { cuerpo?: string; messageId?: string | null; asunto?: string } = {}) =>
  emlSintetico({
    de: "KILROY Testtown <testtown@kilroy.dk>",
    asunto: extra.asunto ?? `${dk(n)}/abcd - Overland San Pedro de Atacama to Uyuni - KILROY booking request`,
    fecha: new Date(Date.now() - DIA),
    messageId: extra.messageId === undefined ? `<m2-07-${randomUUID()}@falso.test>` : extra.messageId,
    cuerpo: `NEW BOOKING\r\nTour code: HI_ARGENTINA_OVERLAND_7DAYS-677\r\nKILROY Reference.:${dk(n)}/abcd\r\n${extra.cuerpo ?? MARCA_CUERPO}`,
  });

const desconocido = (i: number) =>
  emlSintetico({ de: `alguien${i}@desconocido-m207.test`, asunto: `Promo ${i}`, fecha: new Date(Date.now() - DIA), cuerpo: MARCA_CUERPO });

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M2-07 — lectura de sales@ contra el IMAP falso y la base de pruebas (IA falsa)",
  { timeout: 240_000 },
  () => {
    let admin: SupabaseClient;
    let anonimo: SupabaseClient;
    let equipo: SupabaseClient;
    let borrarSesion: () => Promise<void>;
    let soltarBloqueo: () => void;
    let deps: DependenciasReservas;
    const corridas: string[] = [];
    const falsos: ImapFalso[] = [];
    const salida: string[] = [];

    async function nuevoFalso(carpetas: Array<{ path: string; atributos?: string[] }> = [{ path: "INBOX" }, { path: "INBOX.spam" }]) {
      const f = await crearImapFalso({ usuario: USUARIO, clave: CLAVE, carpetas });
      falsos.push(f);
      return f;
    }

    function opciones(falso: ImapFalso, ia = iaFalsa(), extra: Partial<OpcionesLectura> = {}): OpcionesLectura {
      const llamadas = crearRegistroLlamadasSupabase(admin);
      return {
        admin,
        origen: "manual",
        casilla: () => abrirCasillaImap({ host: "127.0.0.1", puerto: falso.puerto, seguro: false, usuario: USUARIO, clave: CLAVE, esperaMs: 3_000 }),
        registroUso: registroMes(),
        llamadas,
        alcance: () => registro.mails,
        alGuardar: (id) => registro.mail(id),
        leer: (mail, ctx) =>
          leerMailConIA(mail, { cliente: ia.cliente, registro: ctx.registro, mes: "2026-10", llamadas, mailRecibidoId: ctx.mailRecibidoId }),
        deps: () => deps,
        ...extra,
      };
    }

    async function correr(falso: ImapFalso, ia = iaFalsa(), extra: Partial<OpcionesLectura> = {}): Promise<ResumenCorrida> {
      const r = await leerSales(opciones(falso, ia, extra));
      if (r.id) corridas.push(r.id);
      return r;
    }

    async function reservasDe(mailIds: readonly string[]) {
      const { data, error } = await admin.from("reserva").select("*").in("mail_recibido_id", [...mailIds]).order("created_at");
      if (error) throw new Error(error.message);
      return data!;
    }

    async function mailPorMessageId(fuente: string) {
      const id = /^Message-ID: <([^>]+)>/m.exec(fuente)![1].toLowerCase();
      const { data } = await admin.from("mail_recibido").select("*").eq("huella", id);
      return data?.[0] ?? null;
    }

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      const conf = { auth: { autoRefreshToken: false, persistSession: false } };
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, conf);
      anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, conf);
      ({ cliente: equipo, borrar: borrarSesion } = await crearSesionDePrueba());
      deps = await cargarDependenciasReservas(admin);
      // Una corrida "en curso" que dejó otro test cortado no tiene que trabar estos (es la base de pruebas).
      await admin.from("lectura_casilla").delete().eq("estado", "en_curso");
      for (const nivel of ["log", "warn", "error", "info"] as const) {
        vi.spyOn(console, nivel).mockImplementation((...a: unknown[]) => {
          salida.push(a.map(String).join(" "));
        });
      }
    }, 120_000);

    afterEach(() => {
      // #15: en ninguna corrida de la suite aparece un comando que escriba en la casilla.
      for (const f of falsos) expect(comandosDeEscritura(f.comandos)).toEqual([]);
    });

    afterAll(async () => {
      vi.restoreAllMocks();
      try {
        await registroM206.limpiar(admin);
        const mails = registro.mails;
        if (mails.length) {
          const reservas = (await reservasDe(mails)).map((r) => r.id);
          if (reservas.length) {
            const { error } = await admin.from("reserva").update({ de_prueba: true }).in("id", reservas);
            if (error) throw new Error(error.message);
          }
          const { error } = await admin.from("mail_recibido").update({ de_prueba: true }).in("id", mails);
          if (error) throw new Error(error.message);
        }
        await registro.limpiar(admin);
        if (corridas.length) await admin.from("lectura_casilla").delete().in("id", corridas);
        for (const f of falsos) await f.detener();
      } finally {
        await borrarSesion?.();
        soltarBloqueo?.();
      }
    }, 120_000);

    it("#1: sin las variables de sales@ no se conecta y registra 'falta la clave de sales@'", async () => {
      const falso = await nuevoFalso();
      const r = await correr(falso, iaFalsa(), { casilla: null });
      expect(r).toMatchObject({ estado: "fallo", errores: ["falta la clave de sales@"] });
      expect(falso.comandos).toEqual([]);
    });

    it("#2 y #3: encuentra Spam marcada \\Junk, INBOX.Spam o Junk y registra su nombre; sin Spam lee el Inbox 'con aviso'", async () => {
      const casos: Array<[Array<{ path: string; atributos?: string[] }>, string[]]> = [
        [[{ path: "INBOX" }, { path: "INBOX.Spam" }, { path: "Correo basura", atributos: ["\\Junk"] }], ["INBOX", "Correo basura"]],
        [[{ path: "INBOX" }, { path: "INBOX.Spam" }, { path: "Trash" }], ["INBOX", "INBOX.Spam"]],
        [[{ path: "INBOX" }, { path: "Junk" }, { path: "INBOX.Promociones" }], ["INBOX", "Junk"]],
      ];
      for (const [carpetas, esperadas] of casos) {
        const falso = await nuevoFalso(carpetas);
        const spam = esperadas[1];
        falso.agregar(spam, { fuente: desconocido(1), fecha: new Date() });
        const r = await correr(falso);
        expect(r.estado).toBe("anduvo_bien");
        expect(r.carpetas).toEqual(esperadas);
        expect(r.miro).toBe(1);
        expect(falso.comandos.some((c) => c.replace(/"/g, "") === `EXAMINE ${spam}`)).toBe(true);
        const { data } = await admin.from("lectura_casilla").select("carpetas,estado").eq("id", r.id!).single();
        expect(data).toEqual({ carpetas: esperadas, estado: "anduvo_bien" });
      }

      const sinSpam = await nuevoFalso([{ path: "INBOX" }, { path: "INBOX.Promociones" }]);
      sinSpam.agregar("INBOX", { fuente: desconocido(2), fecha: new Date() });
      const r = await correr(sinSpam);
      expect(r).toMatchObject({ estado: "con_aviso", carpetas: ["INBOX"], miro: 1 });
      expect(r.avisos).toContain("No encontré la carpeta Spam: solo se leyó la bandeja de entrada.");
    });

    let principal: ImapFalso;
    let kilroyFuente: string;
    let statementFuente: string;
    let sinIdFuente: string;

    it("#6: --solo-listar muestra los mails de agencias sin IA, sin reservas y sin registro", async () => {
      principal = await nuevoFalso();
      kilroyFuente = fixtureConId("kilroy-inventado.eml");
      statementFuente = fixtureConId("tourradar-con-pdf.eml");
      principal.agregar("INBOX", { fuente: kilroyFuente, fecha: new Date(Date.now() - DIA) });
      principal.agregar("INBOX.spam", { fuente: statementFuente, fecha: new Date(Date.now() - DIA) });
      for (const i of [1, 2, 3]) principal.agregar(i === 2 ? "INBOX.spam" : "INBOX", { fuente: desconocido(i), fecha: new Date(Date.now() - DIA) });

      const ia = iaFalsa();
      const antes = (await admin.from("lectura_casilla").select("id", { count: "exact", head: true })).count;
      const r = await leerSales({ ...opciones(principal, ia), soloListar: true });
      expect(ia.create).not.toHaveBeenCalled();
      expect(r.id).toBeNull();
      expect(r.listado.map((x) => [x.carpeta, x.agencia, x.accion])).toEqual([
        ["inbox", "Kilroy", "leer"],
        ["spam", "TourRadar", "leer"],
      ]);
      expect(JSON.stringify(r.listado)).not.toMatch(/testtown|DK0000042|Inventado/);
      expect((await admin.from("lectura_casilla").select("id", { count: "exact", head: true })).count).toBe(antes);
      expect(await mailPorMessageId(kilroyFuente)).toBeNull();
      expect(principal.cuerposPedidos).toEqual([]);
    });

    it("#10, #11 y #18: 1 Kilroy + 1 TourRadar en Spam + 3 desconocidos: la IA se llama 2 veces y nace la misma reserva que en M2-06, sin marca de prueba", async () => {
      const ia = iaFalsa();
      const r = await correr(principal, ia);
      expect(ia.create).toHaveBeenCalledTimes(2);
      expect(r).toMatchObject({ estado: "anduvo_bien", miro: 5, de_agencias: 2, procesados: 2, reservas_nuevas: 2, reservas_actualizadas: 0 });
      const { data: fila } = await admin.from("lectura_casilla").select("*").eq("id", r.id!).single();
      expect(fila).toMatchObject({ origen: "manual", estado: "anduvo_bien", miro: 5, de_agencias: 2, procesados: 2, reservas_nuevas: 2 });
      expect(fila!.fin).toBeTruthy();

      // Al falso nunca se le pidió el cuerpo de los desconocidos, y no dejaron rastro.
      const kilroyUid = principal.carpeta("INBOX").mensajes[0].uid;
      const statementUid = principal.carpeta("INBOX.spam").mensajes[0].uid;
      expect(principal.cuerposPedidos).toEqual([
        { carpeta: "INBOX", uid: kilroyUid },
        { carpeta: "INBOX.spam", uid: statementUid },
      ]);
      const rastro = await admin.from("mail_recibido").select("id").like("remitente", "%desconocido-m207.test");
      expect(rastro.data).toEqual([]);

      const kilroy = await mailPorMessageId(kilroyFuente);
      const statement = await mailPorMessageId(statementFuente);
      expect(kilroy).toMatchObject({ origen: "imap", carpeta: "inbox", imap_uid: kilroyUid, estado_lectura: "procesado", de_prueba: false });
      expect(statement).toMatchObject({ origen: "imap", carpeta: "spam", estado_lectura: "procesado", de_prueba: false });
      const [real] = await reservasDe([kilroy.id]);
      expect(real.de_prueba).toBe(false);

      // La misma reserva que da M2-06 con ese archivo (con la marca de prueba).
      const m206 = await correrModoPrueba([join(FIXTURES, "kilroy-inventado.eml")], {
        admin,
        registroUso: registroMes(),
        alcance: () => registroM206.mails,
        leer: (mail, ctx) => {
          registroM206.mail(ctx.mailRecibidoId);
          return leerMailConIA(mail, { cliente: iaFalsa().cliente, registro: ctx.registro, mes: "2026-10", mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
        },
        deps: () => deps,
      });
      const idPrueba = m206.archivos[0].mailRecibidoId!;
      registroM206.mail(idPrueba);
      const [prueba] = await reservasDe([idPrueba]);
      const campos = ["agencia", "booking_id", "producto_id", "fecha_inicio", "fecha_fin", "pax", "estado", "motivos_revision"] as const;
      for (const c of campos) expect(real[c], c).toEqual(prueba[c]);
      expect(prueba.de_prueba).toBe(true);

      // #18: ni la clave ni el cuerpo de los mails en lo que se imprimió ni en el registro.
      const todo = [...salida, JSON.stringify(fila), principal.comandos.join("\n")].join("\n");
      expect(todo).not.toContain(CLAVE);
      expect(todo).not.toContain(MARCA_CUERPO);
      expect(todo).not.toContain("pepe.inventado");
    });

    it("#12: la segunda corrida no llama a la IA; mover el mail de Spam al Inbox tampoco lo reprocesa; igual sin Message-ID", async () => {
      sinIdFuente = reserva(1, { messageId: null });
      principal.agregar("INBOX", { fuente: sinIdFuente, fecha: new Date(Date.now() - DIA) });
      const primera = await correr(principal);
      expect(primera.procesados).toBe(1);

      const ia = iaFalsa();
      const reservasAntes = (await reservasDe(registro.mails)).length;
      const segunda = await correr(principal, ia);
      expect(ia.create).not.toHaveBeenCalled();
      expect(segunda).toMatchObject({ estado: "anduvo_bien", procesados: 0, reservas_nuevas: 0 });

      const uid = principal.carpeta("INBOX.spam").mensajes[0].uid;
      principal.mover("INBOX.spam", uid, "INBOX");
      const sinId = principal.carpeta("INBOX").mensajes.find((m) => m.fuente === sinIdFuente)!;
      principal.mover("INBOX", sinId.uid, "INBOX.spam");
      const tercera = await correr(principal, ia);
      expect(ia.create).not.toHaveBeenCalled();
      expect(tercera.procesados).toBe(0);
      expect((await reservasDe(registro.mails)).length).toBe(reservasAntes);
    });

    it("#9: un mail de agencia de hace 6 días se procesa; uno de hace 10 no se mira", async () => {
      const falso = await nuevoFalso();
      falso.agregar("INBOX", { fuente: reserva(2), fecha: new Date(Date.now() - 6 * DIA) });
      falso.agregar("INBOX", { fuente: reserva(3), fecha: new Date(Date.now() - 10 * DIA) });
      const ia = iaFalsa();
      const r = await correr(falso, ia);
      expect(r).toMatchObject({ miro: 1, procesados: 1 });
      expect(ia.create).toHaveBeenCalledTimes(1);
      expect(falso.cuerposPedidos.map((x) => x.uid)).toEqual([1]);
    });

    it("#13: si la IA falla para 1 de 3, se procesan 2 y el tercero se reintenta; a los 3 intentos queda 'no se pudo leer'", async () => {
      const falso = await nuevoFalso();
      const caida = reserva(4, { cuerpo: "IA-CAIDA" });
      falso.agregar("INBOX", { fuente: reserva(5), fecha: new Date(Date.now() - DIA) });
      falso.agregar("INBOX", { fuente: caida, fecha: new Date(Date.now() - DIA) });
      falso.agregar("INBOX", { fuente: reserva(6), fecha: new Date(Date.now() - DIA) });

      const r1 = await correr(falso);
      expect(r1).toMatchObject({ estado: "con_aviso", procesados: 2, pendientes: 1, no_se_pudo_leer: 0 });
      expect(r1.errores).toEqual(["Un mail de Kilroy no se pudo procesar (la IA no respondió): se reintenta mañana."]);
      let mail = await mailPorMessageId(caida);
      expect(mail).toMatchObject({ estado_lectura: "pendiente", intentos: 1, procesado_en: null });
      expect(await reservasDe([mail.id])).toEqual([]);

      await correr(falso);
      const r3 = await correr(falso);
      expect(r3).toMatchObject({ no_se_pudo_leer: 1, pendientes: 0 });
      mail = await mailPorMessageId(caida);
      expect(mail).toMatchObject({ estado_lectura: "no_se_pudo_leer", intentos: 3 });

      const ia = iaFalsa();
      const r4 = await correr(falso, ia);
      expect(ia.create).not.toHaveBeenCalled();
      expect(r4).toMatchObject({ estado: "anduvo_bien", procesados: 0 });
      expect(await reservasDe([mail.id])).toEqual([]);
    });

    it("#14: con el techo alcanzado después de 1 llamada y 3 mails, se procesa 1 y quedan 2 para mañana", async () => {
      const falso = await nuevoFalso();
      const fuentes = [7, 8, 9].map((n) => reserva(n));
      for (const f of fuentes) falso.agregar("INBOX", { fuente: f, fecha: new Date(Date.now() - DIA) });
      const ia = iaFalsa();
      const r = await correr(falso, ia, { registroUso: registroMes(() => 100) });
      expect(ia.create).toHaveBeenCalledTimes(1);
      expect(r).toMatchObject({ estado: "con_aviso", procesados: 1, pendientes: 2 });
      expect(r.avisos).toContain("Se alcanzó el techo de gasto de IA: 2 mails quedan para mañana.");

      // Al día siguiente (con presupuesto) se procesan los dos que quedaron.
      const despues = await correr(falso, iaFalsa());
      expect(despues).toMatchObject({ estado: "anduvo_bien", procesados: 2 });
    });

    it("#8: con una corrida en curso la nueva queda 'salteada'; una en curso de hace 20 minutos no la bloquea", async () => {
      const falso = await nuevoFalso();
      const { data: colgada } = await admin.from("lectura_casilla").insert({ origen: "cron", estado: "en_curso" }).select("id").single();
      corridas.push(colgada!.id);
      const r = await correr(falso);
      expect(r.estado).toBe("salteada");
      expect(falso.comandos).toEqual([]);

      await admin.from("lectura_casilla").update({ inicio: new Date(Date.now() - 20 * 60_000).toISOString() }).eq("id", colgada!.id);
      const r2 = await correr(falso);
      expect(r2.estado).toBe("anduvo_bien");
      const { data } = await admin.from("lectura_casilla").select("estado,errores").eq("id", colgada!.id).single();
      expect(data).toEqual({ estado: "fallo", errores: ["quedó colgada más de 15 minutos"] });
    });

    it("#17: casilla caída o clave equivocada = 'falló' en llano; al volver, la corrida siguiente procesa lo de esos días", async () => {
      const falso = await nuevoFalso();
      const fuente = reserva(10);
      falso.agregar("INBOX", { fuente, fecha: new Date(Date.now() - 2 * DIA) });
      falso.apagado = true;
      const caida = await correr(falso);
      expect(caida).toMatchObject({ estado: "fallo", errores: ["la casilla no respondió"] });

      falso.apagado = false;
      const malaClave = await leerSales({
        ...opciones(falso),
        casilla: () => abrirCasillaImap({ host: "127.0.0.1", puerto: falso.puerto, seguro: false, usuario: USUARIO, clave: "otra-clave" }),
      });
      corridas.push(malaClave.id!);
      expect(malaClave).toMatchObject({ estado: "fallo", errores: ["la clave de sales@ no es válida"] });
      expect(await mailPorMessageId(fuente)).toBeNull();

      const vuelta = await correr(falso);
      expect(vuelta).toMatchObject({ estado: "anduvo_bien", procesados: 1 });
    });

    it("#19: el equipo logueado lee el registro y no lo puede escribir; sin sesión no se ve", async () => {
      const { data: leidas, error } = await equipo.from("lectura_casilla").select("id").in("id", corridas);
      expect(error).toBeNull();
      expect(leidas!.length).toBe(corridas.length);
      const alta = await equipo.from("lectura_casilla").insert({ origen: "manual", estado: "anduvo_bien" });
      expect(alta.error).not.toBeNull();
      const cambio = await equipo.from("lectura_casilla").update({ estado: "salteada" }).eq("id", corridas[0]).select("id");
      expect(cambio.data ?? []).toEqual([]);
      const { data: sigue } = await admin.from("lectura_casilla").select("estado").eq("id", corridas[0]).single();
      expect(sigue!.estado).toBe("fallo"); // la del #1: sigue como estaba
      const { data: anon } = await anonimo.from("lectura_casilla").select("id").in("id", corridas);
      expect(anon ?? []).toEqual([]);

      // #20: la línea de la lista se arma con la sesión del equipo (la última corrida de este archivo).
      vi.stubEnv("LECTURA_SALES_ACTIVA", "si");
      try {
        const linea = await lineaDeLaLectura(equipo);
        expect(linea.lineas[0]).toMatch(/^Última lectura de sales@: (hoy|ayer) \d{2}:\d{2} · /);
        expect((await lineaDeLaLectura(anonimo)).lineas).toEqual(["Todavía no corrió ninguna lectura de sales@."]);
      } finally {
        vi.unstubAllEnvs();
      }
      expect((await lineaDeLaLectura(equipo)).lineas).toEqual(["La lectura automática de sales@ está apagada hasta tu OK del modo prueba."]);
    });

    it("#15: al final, todos los mails del falso conservan sus marcas (el no leído sigue no leído)", () => {
      for (const f of falsos) {
        for (const c of ["INBOX", "INBOX.spam"]) {
          try {
            for (const m of f.carpeta(c).mensajes) expect(m.flags).toEqual([]);
          } catch (e) {
            if (!String(e).includes("no tiene la carpeta")) throw e;
          }
        }
      }
    });
  },
);
