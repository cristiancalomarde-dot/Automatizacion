// @vitest-environment node
//
// Spec M3-01 — verificación 2 (integración contra la BASE DE PRUEBAS, con la
// migración 0018 aplicada): los borradores se guardan, rearmar no duplica, un
// borrador editado sobrevive al rearmado, una reserva "para revisión" no
// guarda nada, la base exige el lugar del nombre en la firma, y sin sesión no
// se ve nada (RLS). Lo que crea este archivo lleva `de_prueba = true` y se
// borra al final (solo lo suyo, registro-de-prueba.ts): los pedidos y las
// tareas se van con su reserva.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada, ReservaEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M3-01]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-01.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-19T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

const PASAJEROS = [
  { nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" },
  { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-01 — borradores de pedido en la base de pruebas", { timeout: 90_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let idOd010d: string;
  let idChb31: string;

  async function reservaDePrueba(extra: Partial<ReservaEntrada>): Promise<string> {
    const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
    const { reserva } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        estado: "recibida",
        pax: 2,
        pasajeros: PASAJEROS,
        habitacion: "Double Room - Hostel",
        bookingIdOriginal: "DK9000001/test",
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
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-01" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    const productos = await admin.from("producto").select("id,codigo").in("codigo", ["OD010D", "CHB31"]);
    if (productos.error) throw new Error(productos.error.message);
    idOd010d = productos.data!.find((p) => p.codigo === "OD010D")!.id;
    idChb31 = productos.data!.find((p) => p.codigo === "CHB31")!.id;
  });

  afterAll(async () => {
    await registro.limpiar(admin);
    if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    await borrarSesion?.();
  });

  it("guarda los borradores y armar dos veces no duplica (fila 11)", async () => {
    const id = await reservaDePrueba({ productoId: idOd010d, fechaInicio: "2026-11-07", fechaFin: "2026-11-10" });
    const primera = await armarYGuardarPedidos(admin, id);
    if (!primera.ok) throw new Error(primera.error);
    expect(primera.pedidos.length).toBeGreaterThan(0);
    const guardados = await cargarPedidos(admin, id);
    expect(guardados.pedidos).toHaveLength(primera.pedidos.length);
    expect(guardados.pedidos.every((p) => p.estado === "borrador" && p.de_prueba)).toBe(true);
    expect(guardados.pedidos.every((p) => p.firma.includes("{{nombre_de_quien_envia}}"))).toBe(true);
    // Cuenca del Plata (el 105 de Iguazú) va con su casilla.
    expect(guardados.pedidos.some((p) => p.destinatarios.includes("reservas8@cuencadelplata.com"))).toBe(true);
    // M3-16: el asunto guardado no lleva el código del producto ni el número de la agencia...
    for (const p of guardados.pedidos) {
      expect(p.asunto).toMatch(/^Solicitud de reserva – /);
      expect(p.asunto).not.toMatch(/OD010D|DK9000001/);
    }
    // ...que sigue guardado en la reserva.
    const fila = await admin.from("reserva").select("booking_id_original").eq("id", id).single();
    expect(fila.data?.booking_id_original).toBe("DK9000001/test");

    const segunda = await armarYGuardarPedidos(admin, id);
    if (!segunda.ok) throw new Error(segunda.error);
    const otraVez = await cargarPedidos(admin, id);
    expect(otraVez.pedidos).toHaveLength(primera.pedidos.length);
    expect(otraVez.tareas).toHaveLength(guardados.tareas.length);
  });

  it("un borrador editado sobrevive al rearmado y no se duplica su casilla (fila 11)", async () => {
    const id = await reservaDePrueba({ productoId: idOd010d, fechaInicio: "2026-11-07", fechaFin: "2026-11-10" });
    const r = await armarYGuardarPedidos(admin, id);
    if (!r.ok) throw new Error(r.error);
    const antes = await cargarPedidos(admin, id);
    const elegido = antes.pedidos[0];
    // Como lo hará la pantalla de M3-02, con la sesión de una persona del equipo.
    const edicion = await equipo
      .from("reserva_pedido")
      .update({ cuerpo: `${elegido.cuerpo}\n\nPD: editado a mano`, editado: true, editado_por: usuarioId, editado_en: new Date().toISOString() })
      .eq("id", elegido.id);
    expect(edicion.error).toBeNull();

    // Rearmar con la sesión del equipo (RLS: borra solo los borradores sin editar).
    const rearmado = await armarYGuardarPedidos(equipo, id);
    if (!rearmado.ok) throw new Error(rearmado.error);
    const despues = await cargarPedidos(admin, id);
    expect(despues.pedidos).toHaveLength(antes.pedidos.length);
    const editado = despues.pedidos.find((p) => p.id === elegido.id)!;
    expect(editado.cuerpo).toContain("PD: editado a mano");
    expect(despues.pedidos.filter((p) => p.casilla === elegido.casilla)).toHaveLength(1);
  });

  it("tour compuesto (CHB31 real del catálogo): un borrador por casilla y las tareas en la reserva (filas 2 y 8)", async () => {
    const detalle = await cargarProducto(admin, idChb31);
    const componentes = componentesDeLaReserva(detalle, "2027-01-18", { finalPuertoNatales: false, proveedorTransferPNT: null });
    const id = await reservaDePrueba({ productoId: idChb31, fechaInicio: "2027-01-18", fechaFin: "2027-01-24", componentes });
    const r = await armarYGuardarPedidos(admin, id);
    if (!r.ok) throw new Error(r.error);
    const { pedidos, tareas } = await cargarPedidos(admin, id);
    const casillas = pedidos.map((p) => p.casilla);
    expect(new Set(casillas).size).toBe(casillas.length);
    const tatio = pedidos.find((p) => p.cuerpo.includes("Tatio"));
    // Horizonte Atacama va con la ficha completa por pasajero (owner, 2026-10-19): el Tatio en FECHAS Y TOURS.
    expect(tatio?.cuerpo).toMatch(/FECHAS Y TOURS:\n(.+\n)*[^\n]*Tatio[^\n]* - 20\.01\.2027/);
    expect(tatio?.cuerpo).toContain("NOMBRE COMPLETO:");
    // El traslado de Transvip (reserva manual) es tarea, nunca mail.
    expect(tareas.some((t) => t.tipo === "reservar_a_mano" && /Transvip/i.test(t.texto))).toBe(true);
    expect(tareas.every((t) => t.de_prueba)).toBe(true);
  });

  it("una reserva para revisión devuelve el mensaje y no guarda nada (fila 10)", async () => {
    const id = await reservaDePrueba({ productoId: idOd010d, estado: "para_revision", motivosRevision: ["Falta el producto"] });
    const r = await armarYGuardarPedidos(admin, id);
    expect(r).toEqual({ ok: false, error: "Resolvé primero lo que está para revisión." });
    const { pedidos, tareas } = await cargarPedidos(admin, id);
    expect(pedidos).toHaveLength(0);
    expect(tareas).toHaveLength(0);
    // La base tampoco deja guardar a mano para una reserva en revisión.
    const directo = await admin.rpc("guardar_pedidos_armados", { p_reserva: id, p_pedidos: [], p_tareas: [] });
    expect(directo.error?.message).toMatch(/Resolvé primero lo que está para revisión/);
  });

  it("no debe pasar: la base rechaza un borrador sin el lugar del nombre en la firma (fila 6)", async () => {
    const id = await reservaDePrueba({ productoId: idOd010d, fechaInicio: "2026-11-07", fechaFin: "2026-11-10" });
    const { error } = await admin.from("reserva_pedido").insert({
      reserva_id: id,
      casilla: "x@prueba.test",
      destinatarios: ["x@prueba.test"],
      asunto: "Reserva",
      cuerpo: "Hola",
      firma: "Hi Travel South America",
    });
    expect(error?.message).toMatch(/reserva_pedido_firma_con_nombre/);
  });

  it("sin destinatario siempre lleva el motivo (fila 9)", async () => {
    const id = await reservaDePrueba({ productoId: idOd010d, fechaInicio: "2026-11-07", fechaFin: "2026-11-10" });
    const { error } = await admin.from("reserva_pedido").insert({
      reserva_id: id,
      casilla: "sin-mail:x",
      destinatarios: [],
      asunto: "Reserva",
      cuerpo: "Hola",
      firma: "{{nombre_de_quien_envia}}",
    });
    expect(error?.message).toMatch(/reserva_pedido_destinatario_coherente/);
  });

  it("sin sesión no se ve ningún pedido ni tarea (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").limit(5);
    const tareas = await anonimo.from("reserva_tarea").select("id").limit(5);
    expect(pedidos.data ?? []).toHaveLength(0);
    expect(tareas.data ?? []).toHaveLength(0);
    const rpc = await anonimo.rpc("guardar_pedidos_armados", { p_reserva: randomUUID(), p_pedidos: [], p_tareas: [] });
    expect(rpc.error).not.toBeNull();
  });
});
