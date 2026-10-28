// @vitest-environment node
//
// Spec M3-09 — verificación 2 (integración contra la BASE DE PRUEBAS): un
// pedido a mano con la sesión de una persona del equipo (RLS) y las funciones
// de la migración 0023.
//
// - Fila 2: buscar en el directorio completa los mails.
// - Fila 4: dos pedidos a mano al mismo mail más el armado conviven, cada uno
//   con su casilla y la marca "a mano".
// - Fila 5: rearmar (y "Rearmar todo") no lo borra ni lo cambia.
// - Fila 6: se manda por el mismo camino (modo prueba al SMTP falso: solo a la
//   casilla de prueba).
// - Fila 7: un pedido a mano sin enviar no marca "pedido incompleto".
// - Fila 8: sacar uno en borrador lo borra; uno enviado, la base lo rechaza.
// - Fila 9: el historial con autor y sin datos de pasajeros.
// - Filas 1 y 10: sin sesión no agrega ni saca nada; texto vacío o mail mal
//   escrito no se guardan; una reserva para revisión no admite pedidos a mano.
// Todo lo que crea el test es de prueba y se borra al final (solo eso).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enviarPedidosAprobados } from "@/lib/pedidos/envio/enviar";
import { cargarPedidos, type PedidoGuardado } from "@/lib/pedidos/guardar";
import { agregarPedidoAMano, buscarEnElDirectorio, prepararPedidos, sacarPedidoAMano, type PantallaPedidos } from "@/lib/pedidos/revision";
import { cargarReserva, cargarReservas } from "@/lib/reservas/consultas";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { ReservaEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSmtpFalso, type SmtpFalso } from "./helpers/smtp-falso";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M3-09]";
const A = TEXTOS.pedidos.aMano;
const OPERATIONS = "operations@falso.test";
const CLAVE = `clave-${randomUUID()}`;
const DESTINO_PRUEBA = "owner@falso.test";
const PEDIDO = "1 noche extra, IN 16/11/2026 OUT 17/11/2026, habitación doble";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function listo(r: Awaited<ReturnType<typeof prepararPedidos>>): PantallaPedidos {
  if (!r.ok) throw new Error(`Se esperaba la pantalla: ${r.error}`);
  return r;
}

function agregado(r: Awaited<ReturnType<typeof agregarPedidoAMano>>): PedidoGuardado {
  if (!r.ok) throw new Error(`Se esperaba el pedido guardado: ${r.error}`);
  return r.pedido;
}

/** El borrador inicial con lo que se pide escrito en el espacio en blanco. */
const conTexto = (cuerpo: string) => cuerpo.replace("reserva:\n\n", `reserva:\n\n${PEDIDO}`);

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-09 — pedido a mano en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let od010d: string;
  let smtp: SmtpFalso;

  async function reserva(extra: Partial<ReservaEntrada> = {}): Promise<string> {
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-09.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-20T12:00:00.000Z",
        cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
        agencia: "Kilroy",
        dePrueba: true,
      },
      admin,
    );
    const { reserva: r } = await crearReserva(
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
        bookingIdOriginal: `DK90009${randomUUID().slice(0, 4)}/test`,
        productoId: od010d,
        fechaInicio: "2026-11-07",
        fechaFin: "2026-11-10",
        dePrueba: true,
        ...extra,
      },
      admin,
    );
    return r.id;
  }

  const eventos = async (id: string, tipo: string) =>
    (await admin.from("evento_reserva").select("tipo,detalle,autor_id").eq("reserva_id", id).eq("tipo", tipo).order("created_at")).data ?? [];

  beforeAll(async () => {
    smtp = await crearSmtpFalso({ usuario: OPERATIONS, clave: CLAVE });
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
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-09" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    const p = await admin.from("producto").select("id").eq("codigo", "OD010D").single();
    if (p.error) throw new Error(p.error.message);
    od010d = p.data.id;
  }, 120_000);

  afterAll(async () => {
    await smtp?.detener();
    try {
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    } finally {
      await borrarSesion?.();
    }
  }, 120_000);

  it("fila 2: buscar 'Hostal' en el directorio trae proveedores con sus mails; sin sesión, nada", async () => {
    const r = await buscarEnElDirectorio(equipo, "Hostal");
    if (!r.ok) throw new Error(r.error);
    expect(r.proveedores.length).toBeGreaterThan(0);
    expect(r.proveedores.every((p) => /hostal/i.test(p.nombre))).toBe(true);
    expect(r.proveedores.some((p) => p.mails.length > 0)).toBe(true);
    // Los comodines se buscan como texto: "%" no trae todo.
    const comodin = await buscarEnElDirectorio(equipo, "%%");
    expect(comodin.ok && comodin.proveedores).toEqual([]);
    expect(await buscarEnElDirectorio(anonimo, "Hostal")).toEqual({ ok: false, error: TEXTOS.pedidos.sinSesion, sinSesion: true });
  });

  it("filas 3, 4, 5 y 9: dos a mano al mismo mail que un armado conviven; el rearmado no los toca; historial con autor", async () => {
    const id = await reserva();
    const pantalla = listo(await prepararPedidos(equipo, id));
    expect(pantalla.aMano).not.toBeNull();
    // M3-16: sin el número de la agencia; con las fechas de la reserva.
    // M3-28 (owner, 2026-10-28): el asunto lleva "x N" con los pax después del pasajero.
    expect(pantalla.aMano!.asunto).toBe("Solicitud de reserva – Ana Prueba x 2 – 7 al 10 nov 2026");
    const armado = pantalla.pedidos.find((p) => p.destinatarios.length > 0)!;
    expect(armado).toBeDefined();
    const mail = armado.destinatarios[0];

    const directorio = await admin.from("proveedor").select("id,nombre,mails").eq("id", armado.proveedor_ids[0]).single();
    const uno = agregado(
      await agregarPedidoAMano(equipo, { reservaId: id, proveedorId: directorio.data!.id, mails: mail, asunto: pantalla.aMano!.asunto, cuerpo: conTexto(pantalla.aMano!.cuerpo) }),
    );
    const dos = agregado(await agregarPedidoAMano(equipo, { reservaId: id, proveedorId: null, mails: mail.toUpperCase(), asunto: "Consulta", cuerpo: "¿Tienen lugar?" }));

    expect(uno.a_mano).toBe(true);
    expect(uno.casilla).toMatch(/^a-mano:[0-9a-f-]{36}$/);
    expect(uno.casilla).not.toBe(dos.casilla);
    expect(uno.proveedores).toEqual([directorio.data!.nombre]);
    expect(uno.proveedor_ids).toEqual([directorio.data!.id]);
    expect(uno.firma).toBe(armado.firma);
    expect(uno.partes).toEqual([]);
    expect(uno.estado).toBe("borrador");
    // Sin proveedor del directorio, se nombra por el mail (normalizado).
    expect(dos.destinatarios).toEqual([mail.toLowerCase()]);
    expect(dos.proveedores).toEqual([mail.toLowerCase()]);
    expect(dos.proveedor_ids).toEqual([]);

    const todos = (await cargarPedidos(equipo, id)).pedidos;
    expect(todos.filter((p) => p.destinatarios.includes(mail.toLowerCase()))).toHaveLength(3);

    // Fila 5: volver a entrar (rearmado) y "Rearmar todo" no los borran ni los cambian.
    const antes = new Map(todos.filter((p) => p.a_mano).map((p) => [p.id, p]));
    listo(await prepararPedidos(equipo, id));
    listo(await prepararPedidos(equipo, id, { reemplazarEditados: true }));
    const despues = (await cargarPedidos(equipo, id)).pedidos;
    for (const [pid, p] of antes) expect(despues.find((x) => x.id === pid)).toEqual(p);
    // El armado sigue uno solo por casilla.
    expect(despues.filter((p) => !p.a_mano && p.casilla === armado.casilla)).toHaveLength(1);

    // Fila 9: historial con autor, a quién, y sin datos de pasajeros.
    const ev = await eventos(id, "pedido_a_mano_agregado");
    expect(ev).toHaveLength(2);
    expect(ev.every((e) => e.autor_id === usuarioId)).toBe(true);
    expect(ev.map((e) => e.detalle.a)).toEqual([directorio.data!.nombre, mail.toLowerCase()]);
    expect(ev[0].detalle.persona).toBe("Test M3-09");
    expect(JSON.stringify(ev)).not.toMatch(/Ana|Prueba|Luis|Ensayo/);

    // El detalle de la reserva lo cuenta en su historial.
    const detalle = await cargarReserva(equipo, id);
    expect(detalle!.pedidosAMano!.map((h) => [h.tipo, h.persona, h.a])).toEqual([
      ["agregado", "Test M3-09", directorio.data!.nombre],
      ["agregado", "Test M3-09", mail.toLowerCase()],
    ]);
  });

  it("filas 6 y 7: se manda en modo prueba solo a la casilla de prueba, y uno sin enviar no marca 'pedido incompleto'", async () => {
    const id = await reserva();
    const pantalla = listo(await prepararPedidos(equipo, id));
    const nuevo = agregado(await agregarPedidoAMano(equipo, { reservaId: id, proveedorId: null, mails: "reservas@hotel-a-mano.test", asunto: "Noche extra", cuerpo: PEDIDO }));

    const env = {
      PEDIDOS_SMTP_HOST: "127.0.0.1",
      PEDIDOS_SMTP_PORT: String(smtp.puerto),
      PEDIDOS_SMTP_USER: OPERATIONS,
      PEDIDOS_SMTP_PASSWORD: CLAVE,
      PEDIDOS_DESTINO_PRUEBA: DESTINO_PRUEBA,
      PEDIDOS_ENVIO_REAL: "",
    };
    smtp.mensajes.length = 0;
    const r = await enviarPedidosAprobados(equipo, { reservaId: id, pedidoIds: [nuevo.id], confirmado: true }, { env });
    if (!r.ok) throw new Error(r.error);
    expect(r.resultados).toEqual([expect.objectContaining({ pedidoId: nuevo.id, tipo: "enviado", prueba: true })]);
    expect(smtp.mensajes).toHaveLength(1);
    expect(smtp.mensajes[0].para).toEqual([DESTINO_PRUEBA]);
    const crudo = smtp.mensajes[0].crudo.toString("utf-8");
    expect(crudo).toContain("hotel-a-mano.test");
    expect(crudo).not.toMatch(/^To:.*hotel-a-mano/im);
    const trasPrueba = (await cargarPedidos(admin, id)).pedidos.find((p) => p.id === nuevo.id)!;
    expect(trasPrueba.estado).toBe("borrador");
    // Firma como cualquier pedido: el nombre de la cuenta (acá, lo previo a la @).
    expect(trasPrueba.envio_prueba_por_nombre).toMatch(/^test-m1-06-/);

    // Fila 7: los armados enviados (a mano por el admin) y el a mano sin enviar → no es "pedido incompleto".
    for (const p of pantalla.pedidos) {
      await admin.from("reserva_pedido").update({ estado: "enviando", enviando_desde: new Date().toISOString() }).eq("id", p.id);
      const fin = await admin
        .from("reserva_pedido")
        .update({ estado: "enviado", enviado_en: new Date().toISOString(), enviado_por_nombre: "Test", message_id: `<${randomUUID()}@test>`, sin_destinatario: p.sin_destinatario })
        .eq("id", p.id);
      if (fin.error) throw new Error(fin.error.message);
    }
    await admin.from("reserva").update({ estado: "pedido_a_proveedor" }).eq("id", id);
    const detalle = await cargarReserva(equipo, id);
    expect(detalle!.estado).toBe("pedido_a_proveedor");
    expect(detalle!.pedidoIncompleto).toBe(false);
    const fila = (await cargarReservas(equipo)).find((x) => x.id === id);
    if (fila) expect(fila.pedidoIncompleto).toBe(false);
    // En una reserva ya pedida también se agregan.
    expect(listo(await prepararPedidos(equipo, id)).aMano).not.toBeNull();
  });

  it("fila 8: sacar uno en borrador lo borra (con historial); uno enviado, la base lo rechaza", async () => {
    const id = await reserva();
    listo(await prepararPedidos(equipo, id));
    const borrador = agregado(await agregarPedidoAMano(equipo, { reservaId: id, proveedorId: null, mails: "a@hotel-a-mano.test", asunto: "Uno", cuerpo: PEDIDO }));
    const enviado = agregado(await agregarPedidoAMano(equipo, { reservaId: id, proveedorId: null, mails: "b@hotel-a-mano.test", asunto: "Dos", cuerpo: PEDIDO }));

    expect(await sacarPedidoAMano(equipo, borrador.id)).toEqual({ ok: true, pedidoId: borrador.id });
    expect((await admin.from("reserva_pedido").select("id").eq("id", borrador.id)).data).toEqual([]);
    const sacado = await eventos(id, "pedido_a_mano_sacado");
    expect(sacado).toHaveLength(1);
    expect(sacado[0].autor_id).toBe(usuarioId);
    expect(sacado[0].detalle).toMatchObject({ persona: "Test M3-09", a: "a@hotel-a-mano.test", pedido_id: borrador.id });

    await admin.from("reserva_pedido").update({ estado: "enviando", enviando_desde: new Date().toISOString() }).eq("id", enviado.id);
    await admin
      .from("reserva_pedido")
      .update({ estado: "enviado", enviado_en: new Date().toISOString(), enviado_por_nombre: "Test", message_id: `<${randomUUID()}@test>` })
      .eq("id", enviado.id);
    expect(await sacarPedidoAMano(equipo, enviado.id)).toEqual({ ok: false, error: A.noSeSaca });
    const directo = await equipo.rpc("sacar_pedido_a_mano", { p_pedido: enviado.id });
    expect(directo.error?.code).toBe("HT409");
    // Tampoco con un DELETE suelto (RLS): sigue ahí.
    await equipo.from("reserva_pedido").delete().eq("id", enviado.id);
    expect((await admin.from("reserva_pedido").select("estado").eq("id", enviado.id).single()).data).toEqual({ estado: "enviado" });

    // Un armado no se saca por acá.
    const armado = (await cargarPedidos(equipo, id)).pedidos.find((p) => !p.a_mano)!;
    expect((await equipo.rpc("sacar_pedido_a_mano", { p_pedido: armado.id })).error?.code).toBe("23514");
  });

  it("filas 1 y 10: sin sesión, texto vacío, mail mal escrito o reserva para revisión: no se guarda nada", async () => {
    const id = await reserva();
    const pantalla = listo(await prepararPedidos(equipo, id));
    const base = { reservaId: id, proveedorId: null, mails: "reservas@hotel-a-mano.test", asunto: "Noche extra", cuerpo: PEDIDO };
    const cuantos = async () => (await admin.from("reserva_pedido").select("id").eq("reserva_id", id).eq("a_mano", true)).data!.length;

    expect(await agregarPedidoAMano(anonimo, base)).toEqual({ ok: false, error: TEXTOS.pedidos.sinSesion, sinSesion: true });
    expect((await anonimo.rpc("agregar_pedido_a_mano", { p_reserva: id, p_proveedor: null, p_destinatarios: ["x@y.test"], p_asunto: "A", p_cuerpo: "B", p_firma: "{{nombre_de_quien_envia}}" })).error).not.toBeNull();
    expect(await agregarPedidoAMano(equipo, { ...base, cuerpo: "  " })).toEqual({ ok: false, error: A.sinTexto });
    expect(await agregarPedidoAMano(equipo, { ...base, cuerpo: pantalla.aMano!.cuerpo })).toEqual({ ok: false, error: A.sinTexto });
    expect(await agregarPedidoAMano(equipo, { ...base, mails: "reservas@hotel" })).toEqual({ ok: false, error: A.mailInvalido });
    // La base también rechaza un mail mal escrito que llegue directo.
    const malMail = await equipo.rpc("agregar_pedido_a_mano", { p_reserva: id, p_proveedor: null, p_destinatarios: ["mal"], p_asunto: "A", p_cuerpo: "B", p_firma: "{{nombre_de_quien_envia}}" });
    expect(malMail.error?.code).toBe("22023");
    expect(await cuantos()).toBe(0);

    // Sin sesión tampoco saca.
    const nuevo = agregado(await agregarPedidoAMano(equipo, base));
    expect(await sacarPedidoAMano(anonimo, nuevo.id)).toEqual({ ok: false, error: TEXTOS.pedidos.sinSesion, sinSesion: true });
    expect(await cuantos()).toBe(1);

    // Para revisión: ni la app ni la base lo agregan.
    const enRevision = await reserva({ estado: "para_revision", motivosRevision: ["Producto no reconocido"] });
    expect(await agregarPedidoAMano(equipo, { ...base, reservaId: enRevision })).toEqual({ ok: false, error: A.noSeAgrega });
    const directo = await equipo.rpc("agregar_pedido_a_mano", {
      p_reserva: enRevision,
      p_proveedor: null,
      p_destinatarios: ["x@y.test"],
      p_asunto: "A",
      p_cuerpo: "B",
      p_firma: "{{nombre_de_quien_envia}}",
    });
    expect(directo.error?.code).toBe("HT423");
  });
});
