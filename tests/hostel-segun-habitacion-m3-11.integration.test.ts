// @vitest-environment node
//
// Spec M3-11 — verificación 2 (integración contra la BASE DE PRUEBAS): una
// reserva de ejemplo OD017 con "Double Room - Hostel" pide el hostel de Puerto
// Natales a Factoria y otra con "Dormitory - Hostel" a Puma Hostel (la regla de
// data/hostel-segun-habitacion.csv, leída en runtime). Sin sesión no se ve
// nada (RLS). Lo que crea este archivo lleva `de_prueba = true` y se borra al
// final (solo lo suyo, registro-de-prueba.ts).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const PREFIJO = "[test M3-11]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-11.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-22T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

const PASAJEROS = [
  { nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" },
  { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-11 — Puerto Natales: el hostel según la habitación, en la base de pruebas", { timeout: 90_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let idOd017: string;
  /** El mail de cada hostel de Puerto Natales, como está en el catálogo cargado. */
  const mailDe = new Map<string, string[]>();

  async function reservaOd017(habitacion: string): Promise<string> {
    const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
    const { reserva } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        estado: "recibida",
        pax: 2,
        pasajeros: PASAJEROS,
        habitacion,
        bookingIdOriginal: "DK9001101/test",
        productoId: idOd017,
        fechaInicio: "2027-02-10",
        fechaFin: "2027-02-14",
        dePrueba: true,
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
    const prod = await admin.from("producto").select("id").eq("codigo", "OD017").single();
    if (prod.error) throw new Error(prod.error.message);
    idOd017 = prod.data.id;
    const detalle = await cargarProducto(admin, idOd017);
    for (const s of detalle.servicios.filter((x) => x.tipo === "alojamiento" && x.nivel === "Hostel")) {
      mailDe.set(s.serviceProviderNombre ?? "", [...new Set((s.bookingSupplier?.mails ?? []).map((m) => m.trim().toLowerCase()))]);
    }
    // M3-22: Factoria se le pide a Factoria (data/alojamiento-se-pide-a.csv), con su mail del directorio.
    const factoria = await admin.from("proveedor").select("mails").eq("nombre", "Factoria (hostel de Vertice)").single();
    if (factoria.error) throw new Error(factoria.error.message);
    mailDe.set("Factoria", [...new Set(((factoria.data.mails ?? []) as string[]).map((m) => m.trim().toLowerCase()))]);
  });

  afterAll(async () => {
    await registro.limpiar(admin);
  });

  it("el catálogo de pruebas tiene los tres hostels de OD017", () => {
    expect([...mailDe.keys()].sort()).toEqual(["Factoria", "Last Hope", "Puma Hostel"]);
  });

  it("Double Room - Hostel: el hostel va a Factoria, con Last Hope y Puma Hostel como otras", async () => {
    const id = await reservaOd017("Double Room - Hostel");
    const r = await armarYGuardarPedidos(admin, id);
    if (!r.ok) throw new Error(r.error);
    const hostel = r.pedidos.find((p) => p.cuerpo.includes("Alojamiento:"))!;
    expect(hostel.cuerpo).toContain("Alojamiento: Factoria");
    expect(hostel.destinatarios).toEqual(mailDe.get("Factoria"));
    expect(hostel.avisos.join("\n")).toContain("otras: Last Hope, Puma Hostel)");
    expect(r.pedidos.some((p) => p.cuerpo.includes("Alojamiento: Puma Hostel"))).toBe(false);
    const guardados = await cargarPedidos(admin, id);
    expect(guardados.pedidos.some((p) => p.cuerpo.includes("Alojamiento: Factoria"))).toBe(true);
  });

  it("Dormitory - Hostel: el hostel va a Puma Hostel, con Last Hope como otra (Factoria no se ofrece)", async () => {
    const id = await reservaOd017("Dormitory - Hostel");
    const r = await armarYGuardarPedidos(admin, id);
    if (!r.ok) throw new Error(r.error);
    const hostel = r.pedidos.find((p) => p.cuerpo.includes("Alojamiento:"))!;
    expect(hostel.cuerpo).toContain("Alojamiento: Puma Hostel");
    expect(hostel.destinatarios).toEqual(mailDe.get("Puma Hostel"));
    const avisos = hostel.avisos.join("\n");
    expect(avisos).toContain("otras: Last Hope)");
    expect(avisos).not.toContain("Factoria");
  });

  it("sin sesión no se ven los borradores (RLS)", async () => {
    const { data } = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(data ?? []).toEqual([]);
  });
});
