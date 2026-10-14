// @vitest-environment node
//
// Spec M2-06 — verificación 2 (integración contra el Supabase real, con la IA
// FALSA: no gasta). Filas 3, 4, 5, 7, 8, 9, 10 y 13 sobre archivos inventados
// (los de `src/lib/modo-prueba/__fixtures__` más unos .eml que se arman acá).
// Todo lo que crea lleva la marca de prueba y se borra al final, solo eso
// (registro-de-prueba.ts): las reservas del modo prueba que revisa el owner no
// se tocan.
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { fichaGrabada, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA, type ClienteMensajesIA } from "@/lib/reservas/extraer";
import { procesarMail } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { correrModoPrueba, type OpcionesCorrida, type ResultadoCorrida } from "@/lib/modo-prueba/corrida";
import { leerArchivoDeMail, listarArchivos } from "@/lib/modo-prueba/leer-archivo";
import { borrarTodoLoDePrueba } from "@/lib/modo-prueba/borrar";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const registro = crearRegistroDePrueba();
const FIXTURES = join(__dirname, "..", "src", "lib", "modo-prueba", "__fixtures__");

type Ficha = Record<string, unknown> & { productos: Array<Record<string, unknown>> };

/** La ficha que "devuelve la IA" para cada mail inventado, según el número del asunto. */
function fichaPara(texto: string): Ficha {
  if (texto.includes("DK0000042") || texto.includes("DK0000045")) {
    // DK0000045 con otras fechas: si no, la marca blanda de M2-04 la vería parecida a la DK0000042.
    const es45 = texto.includes("DK0000045");
    const [inicio, fin] = es45 ? ["2027-02-18", "2027-02-24"] : ["2027-01-18", "2027-01-24"];
    const f = fichaGrabada("kilroy-dk1594100") as Ficha;
    f.productos = f.productos.filter((p) => String(p.codigo).includes("OVERLAND"));
    Object.assign(f, {
      numero_reserva: { valor: es45 ? "DK0000045/abcd" : "DK0000042/abcd", confianza: 1 },
      fecha_inicio: { valor: inicio, confianza: 1 },
      fecha_fin: { valor: fin, confianza: 1 },
    });
    f.productos[0] = { ...f.productos[0], fecha_inicio: inicio, fecha_fin: fin };
    return f;
  }
  if (texto.includes("DK0000043")) {
    const f = fichaGrabada("kilroy-od010d") as Ficha;
    Object.assign(f, { numero_reserva: { valor: "DK0000043/efgh", confianza: 1 } });
    return f;
  }
  const numero = /Booking Statement (\d{7})/.exec(texto)?.[1] ?? "0000042";
  const f = fichaGrabada("tourradar-1376833") as Ficha;
  Object.assign(f, { numero_reserva: { valor: numero, confianza: 1 } });
  return f;
}

/** Un cliente de IA falso: contesta con la ficha del mail y cuenta las llamadas. */
function iaFalsa() {
  const create = vi.fn(async (params: { messages: Array<{ content: Array<{ type: string; text?: string }> }> }) => {
    const texto = params.messages[0].content.map((b) => b.text ?? "").join("\n");
    return respuestaCon(fichaPara(texto));
  });
  return { cliente: { messages: { create } } as unknown as ClienteMensajesIA, create };
}

function registroMes(gastoInicial = 0) {
  let gasto = gastoInicial;
  const r: RegistroUsoIA = {
    gastoDelMes: async () => gasto,
    sumar: async (_mes, uso) => {
      gasto += uso.costo;
    },
  };
  return r;
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M2-06 — modo prueba contra Supabase real (IA falsa)",
  { timeout: 240_000 },
  () => {
    let admin: SupabaseClient;
    let anonimo: SupabaseClient;
    let equipo: SupabaseClient;
    let usuarioId: string;
    let borrarSesion: () => Promise<void>;
    let soltarBloqueo: () => void;
    let deps: DependenciasReservas;
    let carpeta: string;
    const reservasReales: string[] = [];
    const mailsReales: string[] = [];

    function opciones(ia: ReturnType<typeof iaFalsa>, extra: Partial<OpcionesCorrida> = {}): OpcionesCorrida {
      const llamadas = crearRegistroLlamadasSupabase(admin);
      return {
        admin,
        registroUso: registroMes(),
        llamadas,
        alcance: () => registro.mails,
        leer: (mail, ctx) => {
          registro.mail(ctx.mailRecibidoId);
          return leerMailConIA(mail, { cliente: ia.cliente, registro: ctx.registro, mes: "2026-10", llamadas, mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
        },
        deps: () => deps,
        ...extra,
      };
    }

    async function correr(ia = iaFalsa(), extra: Partial<OpcionesCorrida> = {}): Promise<ResultadoCorrida> {
      const r = await correrModoPrueba(listarArchivos(carpeta), opciones(ia, extra));
      for (const a of r.archivos) registro.mail(a.mailRecibidoId);
      return r;
    }

    async function contarReales() {
      const { count, error } = await admin.from("reserva").select("id", { count: "exact", head: true }).eq("de_prueba", false);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }

    async function reservasDelTest() {
      const { data, error } = await admin.from("reserva").select("*").in("mail_recibido_id", registro.mails).order("created_at");
      if (error) throw new Error(error.message);
      return data!;
    }

    function mailInventado(nombre: string, de: string, asunto: string, dir = carpeta, cuerpo = "Mail inventado para el test de M2-06.") {
      writeFileSync(
        join(dir, nombre),
        [`From: ${de}`, "To: sales@hitravel.com.ar", `Subject: ${asunto}`, "Date: Tue, 13 Oct 2026 10:00:00 +0000", "Content-Type: text/plain; charset=utf-8", "", cuerpo, ""].join("\r\n"),
      );
    }

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      const conf = { auth: { autoRefreshToken: false, persistSession: false } };
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, conf);
      anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, conf);
      ({ cliente: equipo, borrar: borrarSesion } = await crearSesionDePrueba());
      const { data } = await equipo.auth.getUser();
      usuarioId = data.user!.id;
      const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M2-06" });
      if (alta.error) throw new Error(alta.error.message);
      deps = await cargarDependenciasReservas(admin);

      carpeta = mkdtempSync(join(tmpdir(), "m2-06-"));
      for (const f of ["kilroy-inventado.eml", "kilroy-copia.docx", "tourradar-con-pdf.eml", "1# Booking Statement 0000044 - 00000044 - vendorbill notas del owner.pdf", "notas.txt"]) {
        copyFileSync(join(FIXTURES, f), join(carpeta, f));
      }
      mailInventado("proveedor.eml", "Reservas <reservas@proveedor-inventado.com.ar>", "Pedido OD018 x4");
      mailInventado("jysk.eml", "Someone <someone@jr.dk>", "JY0000001 - Buenos Aires - 2 pax");
      mailInventado("journaway.eml", "journaway <de@journaway.com>", "de-DE Activity Booking / Client Inventado / ID 00000000001");
      mailInventado("respuesta.eml", "testtown@kilroy.dk", "Re: Pax Inventado UK0000099");

      // Si una corrida anterior del test se cortó, sus mails (los mismos archivos) siguen ahí: se borran antes.
      const ids = await Promise.all(listarArchivos(carpeta).map(async (r) => (await leerArchivoDeMail(r)).messageId!));
      const { data: viejos } = await admin.from("mail_recibido").select("id").eq("de_prueba", true).in("message_id", ids.map((m) => m.slice(1, -1)));
      for (const v of viejos ?? []) registro.mail(v.id);
      await registro.limpiar(admin);
    }, 360_000);

    afterAll(async () => {
      try {
        // Primero lo de prueba (si no, la real DK0000045 no puede tomar la marca: chocaría con la de
        // prueba del mismo número y producto); después las "reales" de la fila 5, con la marca.
        await registro.limpiar(admin);
        if (reservasReales.length) {
          const { error } = await admin.from("reserva").update({ de_prueba: true }).in("id", reservasReales);
          if (error) throw new Error(error.message);
        }
        if (mailsReales.length) {
          const { error } = await admin.from("mail_recibido").update({ de_prueba: true }).in("id", mailsReales);
          if (error) throw new Error(error.message);
        }
        for (const m of mailsReales) registro.mail(m);
        await registro.limpiar(admin);
        rmSync(carpeta, { recursive: true, force: true });
      } finally {
        await borrarSesion?.();
        soltarBloqueo?.();
      }
    }, 120_000);

    it("filas 3, 4 y 9: lee solo lo de Kilroy y TourRadar, todo queda de prueba y las reales no cambian (sin la clave de sales@)", async () => {
      const realesAntes = await contarReales();
      const guardadas = Object.fromEntries(Object.keys(process.env).filter((k) => k.startsWith("SALES_IMAP")).map((k) => [k, process.env[k]]));
      for (const k of Object.keys(guardadas)) delete process.env[k];
      const ia = iaFalsa();
      let r: ResultadoCorrida;
      try {
        r = await correr(ia);
      } finally {
        Object.assign(process.env, guardadas);
      }

      const por = Object.fromEntries(r.archivos.map((a) => [a.archivo, a]));
      expect(Object.keys(por)).toHaveLength(8); // el .txt no se procesa
      expect(por["proveedor.eml"]).toMatchObject({ estado: "salteado", motivo: "No es un mail de agencia" });
      expect(por["journaway.eml"]).toMatchObject({ estado: "salteado", motivo: "Journaway entra con M2-09" });
      expect(por["jysk.eml"]).toMatchObject({ estado: "salteado", agencia: "Jysk" });
      expect(por["respuesta.eml"]).toMatchObject({ estado: "salteado", numerosAsunto: ["UK0000099"] });
      for (const n of ["kilroy-inventado.eml", "kilroy-copia.docx", "tourradar-con-pdf.eml"]) expect(por[n].estado, n).toBe("procesado");
      // La IA solo se llamó por los 4 mails de agencia que se leen.
      expect(ia.create).toHaveBeenCalledTimes(4);
      expect(r.lecturasIA).toBe(4);

      // Jysk: el mail queda registrado, sin IA.
      const { data: jysk } = await admin.from("mail_recibido").select("agencia,de_prueba,procesado_en").eq("id", por["jysk.eml"].mailRecibidoId!).single();
      expect(jysk).toMatchObject({ agencia: "Jysk", de_prueba: true });
      expect(jysk!.procesado_en).toBeTruthy();

      // Fila 4: todas las filas nuevas con la marca de prueba.
      const reservas = await reservasDelTest();
      expect(reservas.length).toBeGreaterThanOrEqual(4);
      expect(reservas.every((x) => x.de_prueba)).toBe(true);
      const ids = reservas.map((x) => x.id);
      const partes = await admin.from("reserva_componente").select("de_prueba").in("reserva_id", ids);
      const eventos = await admin.from("evento_reserva").select("de_prueba").in("reserva_id", ids);
      const mails = await admin.from("mail_recibido").select("de_prueba").in("id", registro.mails);
      const llamadas = await admin.from("ia_llamada").select("de_prueba").in("mail_recibido_id", registro.mails);
      expect(partes.data!.length).toBeGreaterThan(0);
      for (const filas of [partes.data!, eventos.data!, mails.data!, llamadas.data!]) expect(filas.every((x) => x.de_prueba)).toBe(true);
      expect(llamadas.data).toHaveLength(4);
      expect(await contarReales()).toBe(realesAntes);
    });

    it("fila 7: correr otra vez no duplica ni llama a la IA", async () => {
      const antes = (await reservasDelTest()).length;
      const ia = iaFalsa();
      const r = await correr(ia);
      expect(ia.create).not.toHaveBeenCalled();
      expect(r.archivos.filter((a) => a.estado === "procesado")).toEqual([]);
      expect(r.archivos.filter((a) => a.estado === "ya_procesado")).toHaveLength(4);
      expect((await reservasDelTest()).length).toBe(antes);
      // El reporte de un archivo ya procesado igual trae sus reservas.
      expect(r.archivos.find((a) => a.archivo === "kilroy-inventado.eml")!.reservas).toHaveLength(1);
    });

    it("fila 10: con un tope chico la corrida corta antes de pasarse; los archivos que faltan quedan 'no procesados'", async () => {
      const otra = mkdtempSync(join(tmpdir(), "m2-06-tope-"));
      try {
        mailInventado("a-proveedor.eml", "x@proveedor-inventado.com.ar", "otro pedido", otra);
        writeFileSync(join(otra, "b-kilroy.eml"), `From: testtown@kilroy.dk\r\nSubject: DK0000045/abcd - Overland - KILROY booking request\r\n\r\nKILROY Reference.:DK0000045/abcd ${randomUUID()}\r\n`);
        writeFileSync(join(otra, "c-kilroy.eml"), `From: testtown@kilroy.dk\r\nSubject: DK0000042/abcd - otra\r\n\r\nKILROY Reference.:DK0000042/abcd ${randomUUID()}\r\n`);
        const ia = iaFalsa();
        const r = await correrModoPrueba(listarArchivos(otra), opciones(ia, { tope: 0.000001 }));
        for (const a of r.archivos) registro.mail(a.mailRecibidoId);
        expect(r.archivos.map((a) => [a.archivo, a.estado])).toEqual([
          ["a-proveedor.eml", "salteado"],
          ["b-kilroy.eml", "no_procesado"],
          ["c-kilroy.eml", "no_procesado"],
        ]);
        expect(r.archivos[1].motivo).toBe("No procesado: tope de la corrida (US$ 0.000001)");
        expect(ia.create).not.toHaveBeenCalled();
        expect(r.gasto).toBe(0);
        // No quedó nada guardado de esos mails: se pueden reintentar.
        const id = (await leerArchivoDeMail(join(otra, "b-kilroy.eml"))).messageId!.slice(1, -1);
        expect((await admin.from("mail_recibido").select("id").eq("message_id", id)).data).toEqual([]);

        // Con el techo del mes agotado pasa lo mismo, con su motivo.
        const sinMes = await correrModoPrueba(listarArchivos(otra), opciones(iaFalsa(), { registroUso: registroMes(19.999) }));
        for (const a of sinMes.archivos) registro.mail(a.mailRecibidoId);
        expect(sinMes.archivos[1].motivo).toBe("No procesado: se agotó el presupuesto de IA del mes (US$ 20)");
      } finally {
        rmSync(otra, { recursive: true, force: true });
      }
    });

    it("fila 5: prueba y real no se juntan, en los dos sentidos", async () => {
      const base = await leerArchivoDeMail(join(FIXTURES, "kilroy-inventado.eml"));
      const comoReal = (texto: string): MailEntrada => ({
        ...base,
        origen: "imap",
        messageId: `<m2-06-real-${randomUUID()}@prueba.hitravel.local>`,
        asunto: base.asunto!.replace("DK0000042", "DK0000045"),
        cuerpoTexto: `${base.cuerpoTexto!.replace(/DK0000042/g, "DK0000045")}\n${texto}`,
        dePrueba: false,
      });
      const ia = iaFalsa();
      const procesarReal = async (texto: string) => {
        const r = await procesarMail(comoReal(texto), {
          admin,
          deps: () => deps,
          alcance: () => [...registro.mails, ...mailsReales],
          dePrueba: false,
          leer: (mail, ctx) => {
            mailsReales.push(ctx.mailRecibidoId);
            return leerMailConIA(mail, { cliente: ia.cliente, registro: registroMes(), mes: "2026-10", mailRecibidoId: ctx.mailRecibidoId });
          },
        });
        if (r.estado !== "procesado") throw new Error("se esperaba un mail nuevo");
        reservasReales.push(...r.pedidos.map((p) => p.reservaId));
        return r;
      };

      // Una real DK0000045 primero; después la corrida de prueba con el mismo número y producto.
      const real = await procesarReal("primero");
      expect(real.pedidos.map((p) => p.accion)).toEqual(["nueva"]);
      const { data: antes } = await admin.from("reserva").select("*").eq("id", real.pedidos[0].reservaId).single();
      writeFileSync(join(carpeta, "z-kilroy-45.eml"), `From: testtown@kilroy.dk\r\nSubject: DK0000045/abcd - Overland - KILROY booking request\r\n\r\nKILROY Reference.:DK0000045/abcd\r\n`);
      const prueba = await correr(ia, { alcance: () => [...registro.mails, ...mailsReales] });
      const deLa45 = prueba.archivos.find((a) => a.archivo === "z-kilroy-45.eml")!;
      expect(deLa45.reservas.map((x) => x.accion)).toEqual(["nueva"]);
      const { data: despues } = await admin.from("reserva").select("*").eq("id", real.pedidos[0].reservaId).single();
      expect(despues).toEqual(antes);

      // Otro mail real del mismo intercambio se suma a la real, nunca a la de prueba.
      const pruebaId = (await reservasDelTest()).find((x) => x.booking_id === "DK0000045" && x.de_prueba)!.id;
      const eventosPrueba = (await admin.from("evento_reserva").select("id").eq("reserva_id", pruebaId)).data!;
      const segundo = await procesarReal("segundo");
      expect(segundo.pedidos).toEqual([expect.objectContaining({ accion: "sumada", reservaId: real.pedidos[0].reservaId })]);
      expect((await admin.from("evento_reserva").select("id").eq("reserva_id", pruebaId)).data).toEqual(eventosPrueba);
    });

    it("fila 13 (#1): la marca del owner guarda su autor, solo en reservas de prueba, y sin sesión no se ve", async () => {
      const [r] = await reservasDelTest();
      const alta = await equipo.from("revision_prueba").insert({ reserva_id: r.id, resultado: "mal", que_mal: ["producto", "fechas"], nota: "inventada" }).select("*").single();
      expect(alta.error).toBeNull();
      expect(alta.data).toMatchObject({ reserva_id: r.id, resultado: "mal", autor_id: usuarioId });
      // Se puede cambiar; el autor lo pone la base (nadie firma por otro).
      const cambio = await equipo.from("revision_prueba").update({ resultado: "bien", que_mal: [], autor_id: randomUUID() }).eq("reserva_id", r.id).select("*").single();
      expect(cambio.error).toBeNull();
      expect(cambio.data).toMatchObject({ resultado: "bien", que_mal: [], autor_id: usuarioId });
      // "Mal" sin decir qué, no.
      expect((await equipo.from("revision_prueba").update({ resultado: "mal", que_mal: [] }).eq("reserva_id", r.id)).error).not.toBeNull();
      // Una reserva real no se marca.
      expect(reservasReales.length).toBeGreaterThan(0);
      const real = await equipo.from("revision_prueba").insert({ reserva_id: reservasReales[0], resultado: "bien" });
      expect(real.error?.message).toMatch(/Solo se marcan las reservas de prueba/);
      // Sin sesión: nada.
      expect((await anonimo.from("revision_prueba").select("id").eq("reserva_id", r.id)).data ?? []).toEqual([]);
      expect((await anonimo.from("revision_prueba").insert({ reserva_id: r.id, resultado: "bien" })).error).not.toBeNull();
    });

    it("fila 8: --borrar deja 0 de prueba, las reales intactas y uso_ia igual (solo si no hay otros datos de prueba cargados)", async (ctx) => {
      const { count: ajenas } = await admin
        .from("reserva")
        .select("id", { count: "exact", head: true })
        .eq("de_prueba", true)
        .not("mail_recibido_id", "in", `(${registro.mails.join(",")})`);
      if ((ajenas ?? 0) > 0) {
        ctx.skip("Hay reservas de prueba que no son de este test (el modo prueba que revisa el owner): el --borrar completo no se corre.");
      }
      const reales = (await admin.from("reserva").select("*").eq("de_prueba", false).order("id")).data!;
      const uso = (await admin.from("uso_ia").select("*").order("mes")).data!;
      const revisiones = await admin.from("revision_prueba").select("id").in("reserva_id", (await reservasDelTest()).map((x) => x.id));
      expect(revisiones.data!.length).toBeGreaterThan(0);

      await borrarTodoLoDePrueba(admin);

      for (const tabla of ["reserva", "reserva_componente", "evento_reserva", "mail_recibido", "ia_llamada"]) {
        const { count } = await admin.from(tabla).select("id", { count: "exact", head: true }).eq("de_prueba", true);
        expect(count, tabla).toBe(0);
      }
      expect((await admin.from("revision_prueba").select("id", { count: "exact", head: true })).count).toBe(0);
      expect((await admin.from("reserva").select("*").eq("de_prueba", false).order("id")).data).toEqual(reales);
      expect((await admin.from("uso_ia").select("*").order("mes")).data).toEqual(uso);
      // Las "reales" de la fila 5 eran de este test: se les pone la marca en el afterAll y se borran ahí.
    });
  },
);
