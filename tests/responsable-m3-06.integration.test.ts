// @vitest-environment node
//
// Spec M3-06 — verificación 2 (integración contra la BASE DE PRUEBAS, con el
// SMTP FALSO y el IMAP FALSO de M3-03; nunca el correo real): con la sesión
// de dos personas del equipo (RLS).
//
// - Nombre para la firma: guardar y volver a leer; vacío vuelve al de Google;
//   cada uno edita solo el suyo, y de `usuario` solo esa columna (fila 1).
// - La firma del mail enviado y el responsable al enviar: sin responsable,
//   queda quien envió (modo prueba y real) con su entrada del historial; con
//   responsable, no cambia (filas 2, 3 y 8).
// - Tomar y pasar: cambia el responsable y queda en el historial con autor;
//   si cambió mientras tanto, no se pisa (filas 4, 5 y 8).
// - Solo el equipo: sin sesión rechaza; un id que no está en `usuario`
//   rechaza; un UPDATE suelto del responsable con sesión, también (fila 9).
// - La lista y el detalle traen el responsable (fila 6).
//
// La configuración del envío se arma a mano (nunca se leen las PEDIDOS_* de
// .env.local). Lo que se crea lleva `de_prueba = true` y se borra al final.
import { randomUUID } from "node:crypto";
import { simpleParser } from "mailparser";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enviarPedidosAprobados } from "@/lib/pedidos/envio/enviar";
import { prepararPedidos } from "@/lib/pedidos/revision";
import { cargarReserva, cargarReservas } from "@/lib/reservas/consultas";
import { pasarReserva, tomarReserva } from "@/lib/reservas/responsable/asignar";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import { TEXTOS } from "@/lib/textos";
import { cargarEquipo } from "@/lib/usuarios/equipo";
import { leerNombreParaLaFirma } from "@/lib/usuarios/firma";
import { guardarNombreParaLaFirma } from "@/lib/usuarios/guardar-firma";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearImapFalso, type ImapFalso } from "./helpers/imap-falso";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSmtpFalso, type SmtpFalso } from "./helpers/smtp-falso";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M3-06]";
// El nombre en `usuario` (el de la cuenta de Google en la app real): lo usa la base para el historial y la lista.
const DAMIAN = "Damián Prueba M3-06";
const R = TEXTOS.reserva.responsable;
const OPERATIONS = "operations@falso.test";
const CLAVE = `clave-${randomUUID()}`;
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

interface Persona {
  cliente: SupabaseClient;
  id: string;
  email: string;
  borrar: () => Promise<void>;
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-06 — firma y responsable en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let damian: Persona;
  let leticia: Persona;
  let od010d: string;
  let smtp: SmtpFalso;
  let imap: ImapFalso;

  const env = (real: boolean) => ({
    PEDIDOS_SMTP_HOST: "127.0.0.1",
    PEDIDOS_SMTP_PORT: String(smtp.puerto),
    PEDIDOS_SMTP_USER: OPERATIONS,
    PEDIDOS_SMTP_PASSWORD: CLAVE,
    PEDIDOS_IMAP_HOST: "127.0.0.1",
    PEDIDOS_IMAP_PORT: String(imap.puerto),
    PEDIDOS_CC: "liquidaciones@falso.test",
    PEDIDOS_DESTINO_PRUEBA: "owner@falso.test",
    PEDIDOS_ENVIO_REAL: real ? "si" : "",
  });

  async function persona(nombre: string): Promise<Persona> {
    const sesion = await crearSesionDePrueba();
    const { data } = await sesion.cliente.auth.getUser();
    const alta = await admin.from("usuario").insert({ id: data.user!.id, email: data.user!.email, nombre });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    return { cliente: sesion.cliente, id: data.user!.id, email: data.user!.email!, borrar: sesion.borrar };
  }

  async function reservaDePrueba(): Promise<string> {
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-06.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-20T12:00:00.000Z",
        cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
        agencia: "Kilroy",
        dePrueba: true,
      },
      admin,
    );
    const { reserva } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        estado: "recibida",
        pax: 1,
        pasajeros: [{ nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" }],
        bookingIdOriginal: `DK9${randomUUID().slice(0, 6)}`,
        productoId: od010d,
        fechaInicio: "2026-11-07",
        fechaFin: "2026-11-10",
        dePrueba: true,
      },
      admin,
    );
    return reserva.id;
  }

  const eventos = async (id: string) =>
    (await admin.from("evento_reserva").select("tipo,detalle,autor_id").eq("reserva_id", id).order("created_at")).data ?? [];
  const responsableDe = async (id: string) => (await admin.from("reserva").select("responsable_id").eq("id", id).single()).data?.responsable_id ?? null;

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
    damian = await persona(DAMIAN);
    leticia = await persona("Leticia Prueba M3-06");
    const p = await admin.from("producto").select("id").eq("codigo", "OD010D").single();
    if (p.error) throw new Error(p.error.message);
    od010d = p.data.id;
    smtp = await crearSmtpFalso({ usuario: OPERATIONS, clave: CLAVE });
    imap = await crearImapFalso({
      usuario: OPERATIONS,
      clave: CLAVE,
      permitirAppend: true,
      carpetas: [{ path: "INBOX" }, { path: "INBOX.Sent", atributos: ["\\Sent"] }],
    });
  }, 120_000);

  afterAll(async () => {
    await smtp?.detener();
    await imap?.detener();
    try {
      await registro.limpiar(admin);
      for (const p of [damian, leticia]) if (p) await admin.from("usuario").delete().eq("id", p.id);
    } finally {
      await damian?.borrar();
      await leticia?.borrar();
    }
  }, 120_000);

  it("fila 1: guardar el nombre para la firma y volver a leerlo; vacío vuelve al de Google", async () => {
    const guardado = await guardarNombreParaLaFirma(damian.cliente, "  Damián   · Operaciones ");
    expect(guardado).toEqual({ ok: true, nombreFirma: "Damián · Operaciones", firmaComo: "Damián · Operaciones" });
    expect(await leerNombreParaLaFirma(damian.cliente, damian.id)).toBe("Damián · Operaciones");

    const vacio = await guardarNombreParaLaFirma(damian.cliente, "");
    expect(vacio).toEqual({ ok: true, nombreFirma: null, firmaComo: damian.email.split("@")[0] });
    expect(await leerNombreParaLaFirma(damian.cliente, damian.id)).toBeNull();
  });

  it("fila 1 (RLS): cada uno edita solo su nombre para la firma, y nada más de `usuario`", async () => {
    // Damián intenta cambiar el de Leticia: no toca ninguna fila.
    const ajena = await damian.cliente.from("usuario").update({ nombre_firma: "Otra" }).eq("id", leticia.id).select("id");
    expect(ajena.data ?? []).toEqual([]);
    expect((await admin.from("usuario").select("nombre_firma").eq("id", leticia.id).single()).data?.nombre_firma).toBeNull();
    // Otra columna de su propia fila: no.
    const rol = await damian.cliente.from("usuario").update({ nombre: "Otro nombre" }).eq("id", damian.id);
    expect(rol.error).not.toBeNull();
    // Sin sesión: no.
    expect(await guardarNombreParaLaFirma(anonimo, "Alguien")).toMatchObject({ ok: false, sinSesion: true });
    const anon = await anonimo.from("usuario").update({ nombre_firma: "Anon" }).eq("id", damian.id).select("id");
    expect(anon.data ?? []).toEqual([]);
  });

  it("filas 2, 3 y 8: el envío firma con el nombre guardado y, sin responsable, deja a quien envió (prueba y real); con responsable no cambia", async () => {
    await guardarNombreParaLaFirma(leticia.cliente, "Leticia · Operaciones");

    // Modo prueba: queda Leticia, con la entrada del historial.
    const id = await reservaDePrueba();
    const armado = await prepararPedidos(leticia.cliente, id);
    if (!armado.ok) throw new Error(armado.error);
    const conMail = armado.pedidos.filter((p) => p.destinatarios.length > 0);
    expect(conMail.length).toBeGreaterThan(0);
    smtp.mensajes.length = 0;
    const prueba = await enviarPedidosAprobados(leticia.cliente, { reservaId: id, pedidoIds: [conMail[0].id], confirmado: true }, { env: env(false) });
    expect(prueba).toMatchObject({ ok: true, modoPrueba: true });
    const texto = (await simpleParser(smtp.mensajes[0].crudo)).text ?? "";
    expect(texto).toContain("Leticia · Operaciones");
    expect(await responsableDe(id)).toBe(leticia.id);
    const tras = await eventos(id);
    expect(tras.map((e) => e.tipo)).toEqual(["creada", "responsable_por_envio", "envio_de_prueba"]);
    expect(tras[1]).toMatchObject({ autor_id: leticia.id, detalle: { persona: "Leticia · Operaciones", responsable_id: leticia.id } });

    // Envío real de Damián sobre la misma reserva: el responsable no cambia y no hay otra entrada.
    const real = await enviarPedidosAprobados(damian.cliente, { reservaId: id, pedidoIds: conMail.map((p) => p.id), confirmado: true }, { env: env(true) });
    expect(real).toMatchObject({ ok: true, modoPrueba: false });
    expect(await responsableDe(id)).toBe(leticia.id);
    expect((await eventos(id)).filter((e) => e.tipo === "responsable_por_envio")).toHaveLength(1);

    // Envío real sin responsable: queda quien envió.
    const otra = await reservaDePrueba();
    const armada = await prepararPedidos(damian.cliente, otra);
    if (!armada.ok) throw new Error(armada.error);
    const r = await enviarPedidosAprobados(
      damian.cliente,
      { reservaId: otra, pedidoIds: armada.pedidos.filter((p) => p.destinatarios.length > 0).map((p) => p.id), confirmado: true },
      { env: env(true) },
    );
    expect(r).toMatchObject({ ok: true, modoPrueba: false });
    expect(await responsableDe(otra)).toBe(damian.id);
    const ev = await eventos(otra);
    expect(ev.map((e) => e.tipo)).toEqual(["creada", "responsable_por_envio", "estado_cambiado", "pedidos_enviados"]);
    expect(ev[1]).toMatchObject({ autor_id: damian.id, detalle: { persona: DAMIAN } });

    // El detalle lo muestra (fila 6) y la lista también.
    const detalle = await cargarReserva(damian.cliente, otra);
    expect(detalle).toMatchObject({ responsableId: damian.id, responsable: DAMIAN });
    expect(detalle?.responsables).toEqual([expect.objectContaining({ tipo: "envio", persona: DAMIAN })]);
  });

  it("filas 4, 5 y 8: tomar y pasar cambian el responsable y quedan en el historial con autor", async () => {
    const id = await reservaDePrueba();
    expect(await tomarReserva(leticia.cliente, { reservaId: id, esperado: null })).toEqual({
      ok: true,
      responsableId: leticia.id,
      responsable: "Leticia · Operaciones",
    });
    expect(await responsableDe(id)).toBe(leticia.id);

    // Damián vio "sin responsable" pero ya la tomó Leticia: no se pisa.
    expect(await tomarReserva(damian.cliente, { reservaId: id, esperado: null })).toEqual({ ok: false, error: R.error(R.motivos.cambio), cambio: true });
    expect(await responsableDe(id)).toBe(leticia.id);

    // "La lleva Leticia. ¿La tomás vos?" → sí.
    expect(await tomarReserva(damian.cliente, { reservaId: id, esperado: leticia.id })).toMatchObject({ ok: true, responsableId: damian.id });
    // Damián se la pasa a Leticia.
    expect(await pasarReserva(damian.cliente, { reservaId: id, a: leticia.id, esperado: damian.id })).toMatchObject({
      ok: true,
      responsableId: leticia.id,
      responsable: "Leticia · Operaciones",
    });

    const ev = (await eventos(id)).filter((e) => e.tipo !== "creada");
    expect(ev.map((e) => [e.tipo, e.autor_id])).toEqual([
      ["reserva_tomada", leticia.id],
      ["reserva_tomada", damian.id],
      ["reserva_pasada", damian.id],
    ]);
    expect(ev[2].detalle).toMatchObject({ persona: DAMIAN, responsable: "Leticia · Operaciones", anterior: DAMIAN });

    const detalle = await cargarReserva(leticia.cliente, id);
    expect(detalle?.responsables?.map((c) => [c.tipo, c.persona, c.responsable])).toEqual([
      ["tomada", "Leticia · Operaciones", "Leticia · Operaciones"],
      ["tomada", DAMIAN, DAMIAN],
      ["pasada", DAMIAN, "Leticia · Operaciones"],
    ]);
    const fila = (await cargarReservas(leticia.cliente)).find((f) => f.id === id);
    expect(fila).toMatchObject({ responsableId: leticia.id, responsable: "Leticia · Operaciones" });
  });

  it("fila 9: sin sesión rechaza; alguien que no está en `usuario` rechaza; un UPDATE suelto del responsable, también", async () => {
    const id = await reservaDePrueba();
    expect(await tomarReserva(anonimo, { reservaId: id, esperado: null })).toMatchObject({ ok: false, sinSesion: true });
    expect(await pasarReserva(damian.cliente, { reservaId: id, a: randomUUID(), esperado: null })).toEqual({
      ok: false,
      error: R.error(R.motivos.noEsDelEquipo),
    });
    // La función de la base, directo, con un id ajeno: tampoco.
    const rpc = await damian.cliente.rpc("asignar_responsable", { p_reserva: id, p_responsable: randomUUID(), p_esperado: null });
    expect(rpc.error?.code).toBe("HT404");
    const anon = await anonimo.rpc("asignar_responsable", { p_reserva: id, p_responsable: damian.id, p_esperado: null });
    expect(anon.error).not.toBeNull();
    // Un UPDATE suelto con sesión: no (el historial no quedaría).
    const suelto = await damian.cliente.from("reserva").update({ responsable_id: damian.id }).eq("id", id);
    expect(suelto.error).not.toBeNull();
    expect(await responsableDe(id)).toBeNull();
  });

  it("fila 5: la lista de personas para pasarla sale de `usuario`, con su nombre para mostrar", async () => {
    const equipo = await cargarEquipo(damian.cliente);
    expect(equipo.yo).toBe(damian.id);
    expect(equipo.personas).toEqual(
      expect.arrayContaining([
        { id: damian.id, nombre: DAMIAN },
        { id: leticia.id, nombre: "Leticia · Operaciones" },
      ]),
    );
    await expect(cargarEquipo(anonimo)).resolves.toEqual({ yo: null, personas: [] });
  });
});
