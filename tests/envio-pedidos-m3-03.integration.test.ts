// @vitest-environment node
//
// Spec M3-03 — verificación 2 (integración contra la BASE DE PRUEBAS, con un
// SMTP FALSO y el IMAP FALSO de M2-07; nunca el correo real): el envío con la
// sesión de una persona del equipo (RLS).
//
// - Modo prueba: el único destinatario es la casilla de prueba (también con un
//   borrador de varios destinatarios), sin CC, sin copia en Enviados, y la
//   reserva NO cambia de estado: queda el "envío de prueba" (filas 2 y 8).
// - Envío real: destinatarios, CC, remitente y firma; enviado con fecha, quién y
//   Message-ID; copia en Enviados solo con APPEND; reserva en "pedido a
//   proveedor" con el historial (filas 3, 5, 6, 8 y 9).
// - Dos envíos simultáneos del mismo pedido: un solo mail (fila 6). Reenviar
//   queda registrado.
// - Un destinatario que el SMTP rechaza: ese falla, los otros salen, y la
//   reserva lleva "pedido incompleto" hasta que se reintenta (filas 7 y 8).
// - Si guardar la copia falla, igual cuenta como enviado, con aviso (fila 5).
// - La firma con el nombre de la cuenta o lo previo a la @ (fila 4).
// - Sin sesión, sin confirmación o sin la casilla configurada: nada (filas 1 y 10).
//
// La configuración se arma a mano (nunca se leen las PEDIDOS_* de .env.local).
// Lo que se crea lleva `de_prueba = true` y se borra al final (solo lo suyo).
import { randomUUID } from "node:crypto";
import { simpleParser } from "mailparser";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { enviarPedidosAprobados, type EnvioHecho, type ResultadoEnvio } from "@/lib/pedidos/envio/enviar";
import { cargarPedidos } from "@/lib/pedidos/guardar";
import { prepararPedidos } from "@/lib/pedidos/revision";
import { cargarReserva, cargarReservas } from "@/lib/reservas/consultas";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada, ReservaEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { comandosDeEscritura, crearImapFalso, type ImapFalso } from "./helpers/imap-falso";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSmtpFalso, type SmtpFalso } from "./helpers/smtp-falso";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M3-03]";
const E = TEXTOS.pedidos.envio;
const OPERATIONS = "operations@falso.test";
const CLAVE = `clave-${randomUUID()}`;
const CC = "liquidaciones@falso.test";
const DESTINO_PRUEBA = "owner@falso.test";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-03.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-19T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

function hecho(r: ResultadoEnvio): EnvioHecho {
  if (!r.ok) throw new Error(`Se esperaba el envío hecho: ${r.error}`);
  return r;
}

const direcciones = (a: unknown): string[] => {
  if (!a) return [];
  const lista = Array.isArray(a) ? a : [a];
  return lista.flatMap((x: { value?: Array<{ address?: string }> }) => (x.value ?? []).map((d) => d.address ?? ""));
};

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-03 — envío por operations@ en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let firmaPorMail: string;
  let smtp: SmtpFalso;
  let imap: ImapFalso;
  const ids = new Map<string, string>();

  const env = (real: boolean) => ({
    PEDIDOS_SMTP_HOST: "127.0.0.1",
    PEDIDOS_SMTP_PORT: String(smtp.puerto),
    PEDIDOS_SMTP_USER: OPERATIONS,
    PEDIDOS_SMTP_PASSWORD: CLAVE,
    PEDIDOS_IMAP_HOST: "127.0.0.1",
    PEDIDOS_IMAP_PORT: String(imap.puerto),
    PEDIDOS_CC: CC,
    PEDIDOS_DESTINO_PRUEBA: DESTINO_PRUEBA,
    PEDIDOS_ENVIO_REAL: real ? "si" : "",
  });

  const enviar = (reservaId: string, pedidoIds: string[], real: boolean, extra: { reenviar?: boolean } = {}) =>
    enviarPedidosAprobados(equipo, { reservaId, pedidoIds, confirmado: true, ...extra }, { env: env(real) });

  async function reservaDePrueba(extra: Partial<ReservaEntrada>): Promise<string> {
    const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
    const { reserva } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        estado: "recibida",
        pax: 2,
        pasajeros: [
          { nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" },
          { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
        ],
        habitacion: "Double Room - Hostel",
        bookingIdOriginal: "DK9000004/test",
        dePrueba: true,
        ...extra,
      },
      admin,
    );
    return reserva.id;
  }

  /** Una reserva recibida con sus pedidos armados (con mail). */
  async function conPedidos(codigo: "OD010D" | "ARCH31"): Promise<{ id: string; pedidos: Awaited<ReturnType<typeof cargarPedidos>>["pedidos"] }> {
    let extra: Partial<ReservaEntrada> = { productoId: ids.get("OD010D"), fechaInicio: "2026-11-07", fechaFin: "2026-11-10" };
    if (codigo === "ARCH31") {
      const detalle = await cargarProducto(admin, ids.get("ARCH31")!);
      extra = {
        productoId: ids.get("ARCH31"),
        fechaInicio: "2027-01-10",
        fechaFin: "2027-01-17",
        componentes: componentesDeLaReserva(detalle, "2027-01-10", { finalPuertoNatales: false, proveedorTransferPNT: null }),
      };
    }
    const id = await reservaDePrueba(extra);
    const r = await prepararPedidos(equipo, id);
    if (!r.ok) throw new Error(r.error);
    return { id, pedidos: r.pedidos };
  }

  const conMail = <T extends { destinatarios: string[] }>(lista: T[]) => lista.filter((p) => p.destinatarios.length > 0);

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
    const sesion = await crearSesionDePrueba();
    equipo = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { data } = await equipo.auth.getUser();
    usuarioId = data.user!.id;
    firmaPorMail = data.user!.email!.split("@")[0];
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-03" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    const productos = await admin.from("producto").select("id,codigo").in("codigo", ["OD010D", "ARCH31"]);
    if (productos.error) throw new Error(productos.error.message);
    for (const p of productos.data ?? []) ids.set(p.codigo, p.id);
    expect([...ids.keys()].sort()).toEqual(["ARCH31", "OD010D"]);

    smtp = await crearSmtpFalso({ usuario: OPERATIONS, clave: CLAVE });
    imap = await crearImapFalso({
      usuario: OPERATIONS,
      clave: CLAVE,
      permitirAppend: true,
      carpetas: [{ path: "INBOX" }, { path: "INBOX.Sent", atributos: ["\\Sent"] }],
    });
  }, 120_000);

  beforeEach(() => {
    smtp.mensajes.length = 0;
    smtp.rechazar.clear();
    smtp.demoraMs = 0;
    imap.apagado = false;
  });

  afterAll(async () => {
    await smtp?.detener();
    await imap?.detener();
    try {
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    } finally {
      await borrarSesion?.();
    }
  }, 120_000);

  it("modo prueba: solo a la casilla de prueba (también con varios destinatarios), sin CC ni copia, y la reserva no cambia (filas 2 y 8)", async () => {
    const { id, pedidos } = await conPedidos("OD010D");
    const salen = conMail(pedidos);
    expect(salen.length).toBeGreaterThan(0);
    // Un borrador con varios destinatarios: igual sale solo a la casilla de prueba.
    const varios = ["reservas8@cuencadelplata.com", "otra-casilla@cuencadelplata.com"];
    const upd = await admin.from("reserva_pedido").update({ destinatarios: varios }).eq("id", salen[0].id);
    expect(upd.error).toBeNull();
    const enSent = imap.carpeta("INBOX.Sent").mensajes.length;

    const r = hecho(await enviar(id, salen.map((p) => p.id), false));
    expect(r.modoPrueba).toBe(true);
    expect(r.resultados.every((x) => x.tipo === "enviado" && x.prueba)).toBe(true);
    expect(smtp.mensajes).toHaveLength(salen.length);
    for (const m of smtp.mensajes) {
      // No debe pasar: que en modo prueba salga un mail a un proveedor.
      expect(m.para).toEqual([DESTINO_PRUEBA]);
      const leido = await simpleParser(m.crudo);
      expect(direcciones(leido.to)).toEqual([DESTINO_PRUEBA]);
      expect(leido.cc).toBeUndefined();
      expect(leido.subject).toMatch(/^\[PRUEBA\] /);
      expect(leido.text?.split("\n")[0]).toMatch(/^Este pedido iba para: /);
    }
    const textos = await Promise.all(smtp.mensajes.map(async (m) => (await simpleParser(m.crudo)).text ?? ""));
    expect(textos.some((t) => t.startsWith(E.ibaPara(salen[0].proveedores.join(" y "), varios.join(", "))))).toBe(true);
    // Sin copia en Enviados.
    expect(imap.carpeta("INBOX.Sent").mensajes).toHaveLength(enSent);

    const reserva = await admin.from("reserva").select("estado").eq("id", id).single();
    expect(reserva.data?.estado).toBe("recibida");
    const { pedidos: despues } = await cargarPedidos(admin, id);
    for (const p of despues.filter((x) => salen.some((s) => s.id === x.id))) {
      expect(p.estado).toBe("borrador");
      expect(p.envio_prueba_en).toBeTruthy();
      expect(p.message_id).toBeNull();
    }
    const eventos = await admin.from("evento_reserva").select("tipo,detalle,autor_id").eq("reserva_id", id).order("created_at");
    expect(eventos.data?.map((e) => e.tipo)).toEqual(["creada", "envio_de_prueba"]);
    expect(eventos.data?.[1]).toMatchObject({ autor_id: usuarioId, detalle: { persona: firmaPorMail, cantidad: salen.length, destino: DESTINO_PRUEBA } });
  });

  it("envío real: destinatarios, CC, remitente y firma; enviado con fecha, quién y Message-ID; copia en Enviados; reserva pedida (filas 3, 4, 5, 6, 8 y 9)", async () => {
    const { id, pedidos } = await conPedidos("OD010D");
    const salen = conMail(pedidos);
    const enSent = imap.carpeta("INBOX.Sent").mensajes.length;
    imap.comandos.length = 0;

    const r = hecho(await enviar(id, salen.map((p) => p.id), true));
    expect(r.modoPrueba).toBe(false);
    expect(r.avisos).toEqual([]);
    expect(r.resultados.every((x) => x.tipo === "enviado" && !x.prueba)).toBe(true);
    expect(smtp.mensajes).toHaveLength(salen.length);

    const { pedidos: despues } = await cargarPedidos(admin, id);
    for (const p of salen) {
      const m = smtp.mensajes.find((x) => x.para[0] === p.destinatarios[0])!;
      expect(m.de).toBe(OPERATIONS);
      expect(m.para).toEqual([...p.destinatarios, CC]);
      const leido = await simpleParser(m.crudo);
      expect(leido.from?.value[0].address).toBe(OPERATIONS);
      expect(direcciones(leido.to)).toEqual(p.destinatarios);
      expect(direcciones(leido.cc)).toEqual([CC]);
      expect(leido.subject).toBe(p.asunto);
      expect(leido.text).toContain(p.firma.replace("{{nombre_de_quien_envia}}", firmaPorMail).trim());
      expect(leido.text).not.toContain("{{nombre_de_quien_envia}}");

      const g = despues.find((x) => x.id === p.id)!;
      expect(g).toMatchObject({ estado: "enviado", enviado_por: usuarioId, enviado_por_nombre: firmaPorMail, copia_en_enviados: true, reenvios: 0 });
      expect(g.enviado_en).toBeTruthy();
      expect(g.message_id).toBe(leido.messageId);
    }

    // La copia en Enviados: el mismo mail, solo con APPEND.
    const sent = imap.carpeta("INBOX.Sent").mensajes.slice(enSent);
    expect(sent).toHaveLength(salen.length);
    const normal = (x: string) => x.replace(/\r\n/g, "\n").trim();
    expect(sent.map((m) => normal(m.fuente)).sort()).toEqual(smtp.mensajes.map((m) => normal(m.crudo.toString("utf8"))).sort());
    expect(new Set(comandosDeEscritura(imap.comandos).map((c) => c.split(" ")[0]))).toEqual(new Set(["APPEND"]));

    // La reserva: pedido a proveedor, con el historial.
    const eventos = await admin.from("evento_reserva").select("tipo,estado_nuevo,detalle,autor_id").eq("reserva_id", id).order("created_at");
    expect(eventos.data?.map((e) => e.tipo)).toEqual(["creada", "estado_cambiado", "pedidos_enviados"]);
    expect(eventos.data?.[1]).toMatchObject({ estado_nuevo: "pedido_a_proveedor", autor_id: usuarioId });
    expect(eventos.data?.[2]).toMatchObject({ autor_id: usuarioId, detalle: { persona: firmaPorMail, cantidad: salen.length, reenvio: false } });
    expect(r.reserva).toEqual({ estado: "pedido_a_proveedor", pedidoIncompleto: despues.some((p) => p.estado !== "enviado") });

    // El detalle y la lista (con la sesión): a quién, cuándo y quién (fila 9).
    const detalle = (await cargarReserva(equipo, id))!;
    expect(detalle.estado).toBe("pedido_a_proveedor");
    for (const p of salen) {
      expect(detalle.pedidos?.find((x) => x.id === p.id)).toMatchObject({ estado: "enviado", enviadoPor: firmaPorMail, proveedores: p.proveedores });
    }
    expect(detalle.envios?.map((e) => e.tipo)).toEqual(["pedidos_enviados"]);
    const fila = (await cargarReservas(equipo)).find((f) => f.id === id)!;
    expect(fila.pedidoIncompleto).toBe(despues.some((p) => p.estado !== "enviado"));

    // Un segundo "Enviar" no lo vuelve a mandar (fila 6).
    const otra = hecho(await enviar(id, salen.map((p) => p.id), true));
    expect(otra.resultados.every((x) => x.tipo === "no_enviado" && x.motivo === E.yaEnviado)).toBe(true);
    expect(smtp.mensajes).toHaveLength(salen.length);

    // "Reenviar" explícito: sale de nuevo y queda registrado.
    const reenvio = hecho(await enviar(id, [salen[0].id], true, { reenviar: true }));
    expect(reenvio.resultados).toEqual([expect.objectContaining({ pedidoId: salen[0].id, tipo: "enviado" })]);
    expect(smtp.mensajes).toHaveLength(salen.length + 1);
    const tras = (await cargarPedidos(admin, id)).pedidos.find((x) => x.id === salen[0].id)!;
    expect(tras.reenvios).toBe(1);
    expect(tras.message_id).not.toBe(despues.find((x) => x.id === salen[0].id)!.message_id);
    const ultimo = await admin.from("evento_reserva").select("tipo,detalle").eq("reserva_id", id).order("created_at", { ascending: false }).limit(1).single();
    expect(ultimo.data).toMatchObject({ tipo: "pedidos_enviados", detalle: { reenvio: true, cantidad: 1 } });
  });

  it("dos envíos simultáneos del mismo pedido dan un solo mail (fila 6)", async () => {
    const { id, pedidos } = await conPedidos("OD010D");
    const p = conMail(pedidos)[0];
    smtp.demoraMs = 400;
    const [a, b] = await Promise.all([enviar(id, [p.id], true), enviar(id, [p.id], true)]);
    const resultados = [hecho(a), hecho(b)].flatMap((r) => r.resultados);
    expect(resultados.filter((x) => x.tipo === "enviado")).toHaveLength(1);
    expect(resultados.filter((x) => x.tipo === "no_enviado")).toHaveLength(1);
    expect(smtp.mensajes).toHaveLength(1);
    const eventos = await admin.from("evento_reserva").select("tipo").eq("reserva_id", id).eq("tipo", "pedidos_enviados");
    expect(eventos.data).toHaveLength(1);
  });

  it("un destinatario que el SMTP rechaza: ese falla, los otros salen; 'pedido incompleto' hasta reintentar (filas 7 y 8)", async () => {
    const { id, pedidos } = await conPedidos("ARCH31");
    const salen = conMail(pedidos);
    expect(salen.length).toBeGreaterThan(1);
    const malo = salen[0];
    for (const m of malo.destinatarios) smtp.rechazar.add(m.toLowerCase());
    // Que el rechazado no comparta casilla con los demás (si no, no es "uno solo").
    const otros = salen.slice(1).filter((p) => !p.destinatarios.some((m) => smtp.rechazar.has(m.toLowerCase())));
    expect(otros.length).toBeGreaterThan(0);

    const r = hecho(await enviar(id, [malo.id, ...otros.map((p) => p.id)], true));
    const delMalo = r.resultados.find((x) => x.pedidoId === malo.id)!;
    expect(delMalo).toEqual({ pedidoId: malo.id, tipo: "fallo", motivo: E.rechazado(malo.destinatarios.map((m) => m.toLowerCase()).join(", ")) });
    expect(r.resultados.filter((x) => x.tipo === "enviado").map((x) => x.pedidoId).sort()).toEqual(otros.map((p) => p.id).sort());
    // A los proveedores les llegaron solo los otros; del rechazado, como mucho la copia (CC).
    const aProveedores = smtp.mensajes.filter((m) => m.para.some((x) => x !== CC));
    expect(aProveedores).toHaveLength(otros.length);
    expect(smtp.mensajes.filter((m) => !aProveedores.includes(m)).every((m) => m.para.join() === CC)).toBe(true);
    expect(r.reserva).toEqual({ estado: "pedido_a_proveedor", pedidoIncompleto: true });
    const g = (await cargarPedidos(admin, id)).pedidos.find((x) => x.id === malo.id)!;
    expect(g).toMatchObject({ estado: "fallo", motivo_fallo: delMalo.tipo === "fallo" ? delMalo.motivo : "" });
    expect((await cargarReservas(equipo)).find((f) => f.id === id)?.pedidoIncompleto).toBe(true);

    // Reintentar (ya corregido): sale. Si no queda nada sin enviar, la marca se va.
    smtp.rechazar.clear();
    const otraVez = hecho(await enviar(id, [malo.id], true));
    expect(otraVez.resultados).toEqual([expect.objectContaining({ pedidoId: malo.id, tipo: "enviado" })]);
    const todos = (await cargarPedidos(admin, id)).pedidos;
    const quedan = todos.filter((p) => p.estado !== "enviado");
    // Lo que quede (sin mail o no incluido) mantiene la marca; mandándolo, se va.
    if (quedan.some((p) => p.destinatarios.length > 0)) {
      hecho(await enviar(id, quedan.filter((p) => p.destinatarios.length > 0).map((p) => p.id), true));
    }
    const final = (await cargarPedidos(admin, id)).pedidos;
    expect((await cargarReserva(equipo, id))?.pedidoIncompleto).toBe(final.some((p) => p.estado !== "enviado"));
    // Un pedido sin mail no se manda nunca: si lo hay, la reserva sigue incompleta.
    expect((await cargarReserva(equipo, id))?.pedidoIncompleto).toBe(final.some((p) => p.destinatarios.length === 0));
  });

  it("si la copia en Enviados falla, igual cuenta como enviado y queda el aviso (fila 5)", async () => {
    const { id, pedidos } = await conPedidos("OD010D");
    const p = conMail(pedidos)[0];
    imap.apagado = true;
    const r = hecho(await enviar(id, [p.id], true));
    expect(r.resultados).toEqual([expect.objectContaining({ tipo: "enviado" })]);
    expect(r.avisos).toEqual([E.sinCopia(E.copiaNoResponde)]);
    const g = (await cargarPedidos(admin, id)).pedidos.find((x) => x.id === p.id)!;
    expect(g).toMatchObject({ estado: "enviado", copia_en_enviados: false });
  });

  it("la firma lleva el nombre de la cuenta de Google cuando lo hay (fila 4)", async () => {
    const cambio = await admin.auth.admin.updateUserById(usuarioId, { user_metadata: { full_name: "Valentina Prueba" } });
    expect(cambio.error).toBeNull();
    try {
      const { id, pedidos } = await conPedidos("OD010D");
      const p = conMail(pedidos)[0];
      hecho(await enviar(id, [p.id], false));
      const leido = await simpleParser(smtp.mensajes[0].crudo);
      expect(leido.text).toContain("Valentina Prueba");
      expect(leido.text).not.toContain(firmaPorMail);
    } finally {
      await admin.auth.admin.updateUserById(usuarioId, { user_metadata: {} });
    }
  });

  it("sin sesión, sin la confirmación o sin la casilla configurada: no se manda nada (filas 1 y 10)", async () => {
    const { id, pedidos } = await conPedidos("OD010D");
    const pedidoIds = conMail(pedidos).map((p) => p.id);
    const antes = await cargarPedidos(admin, id);
    const ingresos = smtp.ingresos;

    expect(await enviarPedidosAprobados(anonimo, { reservaId: id, pedidoIds, confirmado: true }, { env: env(true) })).toEqual({
      ok: false,
      error: TEXTOS.pedidos.sinSesion,
      sinSesion: true,
    });
    expect(await enviarPedidosAprobados(equipo, { reservaId: id, pedidoIds }, { env: env(true) })).toEqual({ ok: false, error: E.sinConfirmar });
    expect(await enviarPedidosAprobados(equipo, { reservaId: id, pedidoIds, confirmado: true }, { env: { ...env(true), PEDIDOS_SMTP_PASSWORD: "" } })).toEqual({
      ok: false,
      error: E.faltaConfigurar,
    });

    expect(smtp.mensajes).toHaveLength(0);
    expect(smtp.ingresos).toBe(ingresos);
    expect((await cargarPedidos(admin, id)).pedidos).toEqual(antes.pedidos);
    const reserva = await admin.from("reserva").select("estado").eq("id", id).single();
    expect(reserva.data?.estado).toBe("recibida");
  });

  it("la base no deja saltear 'enviando' ni marcar enviado sin Message-ID (fila 6)", async () => {
    const { pedidos } = await conPedidos("OD010D");
    const p = conMail(pedidos)[0];
    const directo = await equipo.from("reserva_pedido").update({ estado: "enviado" }).eq("id", p.id);
    expect(directo.error?.message).toMatch(/enviando/);
    await equipo.from("reserva_pedido").update({ estado: "enviando", enviando_desde: new Date().toISOString() }).eq("id", p.id);
    const sinId = await equipo.from("reserva_pedido").update({ estado: "enviado", enviado_en: new Date().toISOString(), enviado_por_nombre: "x" }).eq("id", p.id);
    expect(sinId.error).not.toBeNull();
  });
});
