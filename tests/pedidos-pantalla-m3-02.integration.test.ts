// @vitest-environment node
//
// Spec M3-02 — verificación 2 (integración contra la BASE DE PRUEBAS): lo que
// hacen las acciones de la pantalla de pedidos con la sesión de una persona
// del equipo (RLS). Guardar una edición y releerla, rearmar sin pisar lo
// editado (y "Rearmar todo" sí lo reemplaza), ARCH31 con su tarea a mano,
// SPAP05 con lo que reserva Journaway, para revisión no arma, confirmar el
// envío no manda ni cambia nada, y sin sesión todo se rechaza. Lo que crea
// lleva `de_prueba = true` y se borra al final (solo lo suyo).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { cargarPedidos } from "@/lib/pedidos/guardar";
import { guardarEdicionDePedido, pedirEnvioDePedidos, prepararPedidos } from "@/lib/pedidos/revision";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada, ReservaEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M3-02]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const T = TEXTOS.pedidos;

function mailDePrueba(agencia = "Kilroy"): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-02.hitravel.local>`,
    remitente: agencia === "Journaway" ? "bookings@journaway.com" : "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-19T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia,
    dePrueba: true,
  };
}

const PASAJEROS = [
  { nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" },
  { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
];

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`Se esperaba ok: ${(r as unknown as { error: string }).error}`);
  return r as Extract<T, { ok: true }>;
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-02 — revisión de pedidos en la base de pruebas", { timeout: 120_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  const ids = new Map<string, string>();

  async function reservaDePrueba(extra: Partial<ReservaEntrada>, agencia = "Kilroy"): Promise<string> {
    const { mail } = await guardarMailRecibido(mailDePrueba(agencia), admin);
    const { reserva } = await crearReserva(
      {
        agencia,
        mailRecibidoId: mail.id,
        estado: "recibida",
        pax: 2,
        pasajeros: PASAJEROS,
        habitacion: "Double Room - Hostel",
        bookingIdOriginal: "DK9000002/test",
        dePrueba: true,
        ...extra,
      },
      admin,
    );
    return reserva.id;
  }

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
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-02" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    const productos = await admin.from("producto").select("id,codigo").in("codigo", ["OD010D", "ARCH31", "SPAP05"]);
    if (productos.error) throw new Error(productos.error.message);
    for (const p of productos.data ?? []) ids.set(p.codigo, p.id);
    expect([...ids.keys()].sort()).toEqual(["ARCH31", "OD010D", "SPAP05"]);
  });

  afterAll(async () => {
    await registro.limpiar(admin);
    if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    await borrarSesion?.();
  });

  it("arma y devuelve lo guardado, con el aviso de llegada si falta el vuelo (filas 2 y 6)", async () => {
    const id = await reservaDePrueba({ productoId: ids.get("OD010D"), fechaInicio: "2026-11-07", fechaFin: "2026-11-10" });
    const r = ok(await prepararPedidos(equipo, id));
    expect(r.reserva).toEqual({ id, numero: "DK9000002/test", agencia: "Kilroy" });
    expect(r.pedidos.length).toBeGreaterThan(0);
    expect(r.pedidos.some((p) => p.destinatarios.includes("reservas8@cuencadelplata.com"))).toBe(true);
    expect(r.avisos).toContain(T.faltaLlegada);
    const enBase = await cargarPedidos(admin, id);
    expect(r.pedidos.map((p) => p.id).sort()).toEqual(enBase.pedidos.map((p) => p.id).sort());
  });

  it("guardar la edición y releerla; rearmar la respeta; 'Rearmar todo' la reemplaza (filas 2 y 7)", async () => {
    const id = await reservaDePrueba({ productoId: ids.get("OD010D"), fechaInicio: "2026-11-07", fechaFin: "2026-11-10" });
    const r = ok(await prepararPedidos(equipo, id));
    const elegido = r.pedidos[0];
    const cuerpo = `${elegido.cuerpo}\n\nPD: llegan tarde, gracias.`;

    const e = ok(await guardarEdicionDePedido(equipo, { pedidoId: elegido.id, asunto: `${elegido.asunto} (corregido)`, cuerpo }));
    expect(e.pedido).toMatchObject({ id: elegido.id, cuerpo, editado: true, editado_por: usuarioId });

    // Volver a entrar: se rearma y lo editado sigue ahí, sin duplicar la casilla.
    const otraVez = ok(await prepararPedidos(equipo, id));
    const mismo = otraVez.pedidos.find((p) => p.id === elegido.id)!;
    expect(mismo.cuerpo).toBe(cuerpo);
    expect(mismo.asunto).toBe(`${elegido.asunto} (corregido)`);
    expect(otraVez.pedidos.filter((p) => p.casilla === elegido.casilla)).toHaveLength(1);
    expect(otraVez.pedidos).toHaveLength(r.pedidos.length);

    // La persona confirmó "Rearmar todo": vuelve el texto armado.
    const todo = ok(await prepararPedidos(equipo, id, { reemplazarEditados: true }));
    const nuevo = todo.pedidos.find((p) => p.casilla === elegido.casilla)!;
    expect(nuevo.cuerpo).toBe(elegido.cuerpo);
    expect(nuevo.editado).toBe(false);
    expect(todo.pedidos).toHaveLength(r.pedidos.length);
  });

  it("ARCH31: el bus a mano es tarea, no pedido (fila 5)", async () => {
    const detalle = await cargarProducto(admin, ids.get("ARCH31")!);
    const componentes = componentesDeLaReserva(detalle, "2027-01-10", { finalPuertoNatales: false, proveedorTransferPNT: null });
    const id = await reservaDePrueba({ productoId: ids.get("ARCH31"), fechaInicio: "2027-01-10", fechaFin: "2027-01-17", componentes });
    const r = ok(await prepararPedidos(equipo, id));
    const boletos = r.tareas.filter((t) => t.tipo === "emitir_boleto");
    expect(boletos.length).toBeGreaterThan(0);
    expect(boletos.some((t) => /^Emitir boleto: El Calafate/.test(t.texto))).toBe(true);
    for (const t of boletos) expect(r.pedidos.some((p) => p.cuerpo.includes(t.texto))).toBe(false);
  });

  it("SPAP05 de Journaway: arriba dice qué hoteles reserva la agencia (fila 6)", async () => {
    const detalle = await cargarProducto(admin, ids.get("SPAP05")!);
    const componentes = componentesDeLaReserva(detalle, "2027-02-01", { finalPuertoNatales: false, proveedorTransferPNT: null });
    const id = await reservaDePrueba(
      {
        productoId: ids.get("SPAP05"),
        fechaInicio: "2027-02-01",
        fechaFin: "2027-02-08",
        componentes,
        bookingIdOriginal: null,
        hotelesAgencia: [
          { nombre: "Tayka del Desierto", desde: "2027-02-01", hasta: "2027-02-04" },
          { nombre: "Tayka de Sal", desde: "2027-02-05", hasta: "2027-02-06" },
        ],
      },
      "Journaway",
    );
    const r = ok(await prepararPedidos(equipo, id));
    expect(r.avisos).toContain(T.hotelesAgencia("Journaway", "Tayka del Desierto, Tayka de Sal"));
    expect(r.avisos.some((a) => /: lo reserva la agencia\.$/.test(a))).toBe(false);
  });

  it("para revisión no arma ni guarda nada (fila 1)", async () => {
    const id = await reservaDePrueba({ productoId: ids.get("OD010D"), estado: "para_revision", motivosRevision: ["Falta el producto"] });
    expect(await prepararPedidos(equipo, id)).toEqual({ ok: false, error: "Resolvé primero lo que está para revisión." });
    const { pedidos, tareas } = await cargarPedidos(admin, id);
    expect(pedidos).toHaveLength(0);
    expect(tareas).toHaveLength(0);
  });

  it("pedir el envío sin la confirmación del diálogo no manda nada ni cambia los borradores (fila 8; M3-03 fila 10)", async () => {
    const id = await reservaDePrueba({ productoId: ids.get("OD010D"), fechaInicio: "2026-11-07", fechaFin: "2026-11-10" });
    const r = ok(await prepararPedidos(equipo, id));
    const antes = await cargarPedidos(admin, id);
    expect(await pedirEnvioDePedidos(equipo, { reservaId: id, pedidoIds: r.pedidos.map((p) => p.id) })).toEqual({ ok: false, error: T.envio.sinConfirmar });
    const despues = await cargarPedidos(admin, id);
    expect(despues.pedidos).toEqual(antes.pedidos);
    expect(despues.pedidos.every((p) => p.estado === "borrador")).toBe(true);
    const reserva = await admin.from("reserva").select("estado").eq("id", id).single();
    expect(reserva.data?.estado).toBe("recibida");
  });

  it("sin sesión: armar, guardar y enviar se rechazan y nada cambia (fila 9)", async () => {
    const id = await reservaDePrueba({ productoId: ids.get("OD010D"), fechaInicio: "2026-11-07", fechaFin: "2026-11-10" });
    ok(await prepararPedidos(equipo, id));
    const antes = await cargarPedidos(admin, id);
    const elegido = antes.pedidos[0];

    const rechazo = { ok: false, error: T.sinSesion, sinSesion: true };
    expect(await prepararPedidos(anonimo, id)).toEqual(rechazo);
    expect(await guardarEdicionDePedido(anonimo, { pedidoId: elegido.id, asunto: "Hackeado", cuerpo: "Hackeado" })).toEqual(rechazo);
    expect(await pedirEnvioDePedidos(anonimo, { reservaId: id, pedidoIds: [elegido.id] })).toEqual(rechazo);

    // Y la base, por su cuenta, tampoco deja tocar nada sin sesión (RLS).
    const directo = await anonimo.from("reserva_pedido").update({ cuerpo: "Hackeado" }).eq("id", elegido.id).select("id");
    expect(directo.data ?? []).toHaveLength(0);
    const despues = await cargarPedidos(admin, id);
    expect(despues.pedidos).toEqual(antes.pedidos);
  });
});
