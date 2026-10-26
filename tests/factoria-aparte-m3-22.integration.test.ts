// @vitest-environment node
//
// Spec M3-22 — verificación 2 (integración contra la BASE DE PRUEBAS): con el
// catálogo cargado (Factoria "se le pide a Vertice" en el Excel), el alojamiento
// en Factoria arma su propio pedido a "Factoria (hostel de Vertice)" del
// directorio (la regla de data/alojamiento-se-pide-a.csv, leída al armar, sin
// recargar el catálogo). El W Trek sigue yendo a su proveedor, en otro pedido.
// Sin sesión no se ve nada (RLS). Lo que crea este archivo lleva
// `de_prueba = true` y se borra al final (solo lo suyo). No se envía nada (#4).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import type { PedidoArmado } from "@/lib/pedidos/tipos";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { fichaDePrueba } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const PREFIJO = "[test M3-22]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);
const FACTORIA = "Factoria (hostel de Vertice)";
const VERTICE = "VERTICE Travel: W Trek Standard con Grey";
const LAS_TORRES = "LAS TORRES: W Trek Standard y W Trek Express";

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-22.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-26T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

/** Una ficha de lectura (M2-02) de Kilroy con un producto y su habitación, sobre la de ejemplo. */
function ficha(numero: string, codigoKilroy: string, fecha_inicio: string, habitacion: string): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre: `Producto ${codigoKilroy}`, codigo: codigoKilroy, fecha_inicio, fecha_fin: null, habitacion }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: null, confianza: 0 };
  return f;
}

const conProveedor = (pedidos: PedidoArmado[], nombre: string) => pedidos.filter((p) => p.proveedores.some((x) => x.nombre === nombre));

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-22 — el pedido de Factoria va a Factoria, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  const mailDe = new Map<string, string[]>();

  /** Una reserva de Kilroy por el emparejado de M2 (sin IA): recibida, con sus borradores armados. */
  async function porElEmparejado(codigoKilroy: string, producto: string, inicio: string, habitacion: string, i: number) {
    const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
    const deps = await cargarDependenciasReservas(admin);
    const f = ficha(`DK9322${i}${SUFIJO}/test`, codigoKilroy, inicio, habitacion);
    const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
    const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", c.reserva.id).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
    expect([fila.producto?.codigo, fila.estado]).toEqual([producto, "recibida"]);
    const r = await armarYGuardarPedidos(admin, c.reserva.id);
    if (!r.ok) throw new Error(r.error);
    return { reservaId: c.reserva.id, armado: r };
  }

  async function idDe(codigo: string): Promise<string> {
    const { data, error } = await admin.from("producto").select("id").eq("codigo", codigo).single();
    if (error) throw new Error(`${codigo}: ${error.message}`);
    return data.id;
  }

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
    const { data, error } = await admin.from("proveedor").select("nombre,mails").in("nombre", [FACTORIA, VERTICE, LAS_TORRES]);
    if (error) throw new Error(error.message);
    for (const p of data ?? []) mailDe.set(p.nombre, [...new Set(((p.mails ?? []) as string[]).map((m) => m.trim().toLowerCase()))]);
  });

  afterAll(async () => {
    await registro.limpiar(admin);
  }, 120_000);

  it("el directorio de pruebas tiene a Factoria con su mail, aparte de Vértice", () => {
    expect(mailDe.get(FACTORIA)?.length).toBeGreaterThan(0);
    expect(mailDe.get(FACTORIA)).not.toEqual(mailDe.get(VERTICE));
  });

  it("fila 1: ARCH31 como DK1592913 (doble en hostel) → el alojamiento en Factoria va a Factoria; nada a Vértice", async () => {
    const { armado } = await porElEmparejado("HI_ARGENTINA_ARCH31-677", "ARCH31", "2027-03-09", "Double Room - Hostel", 1);
    const factoria = conProveedor(armado.pedidos, FACTORIA);
    expect(factoria).toHaveLength(1);
    expect(factoria[0].destinatarios).toEqual(mailDe.get(FACTORIA));
    expect(factoria[0].cuerpo).toContain("Alojamiento: Factoria");
    expect(conProveedor(armado.pedidos, VERTICE)).toEqual([]);
    expect(armado.pedidos.some((p) => p.destinatarios.some((m) => mailDe.get(VERTICE)!.includes(m)))).toBe(false);
    console.log(`[M3-22] ARCH31 doble → ${factoria[0].proveedores.map((x) => x.nombre).join(", ")} <${factoria[0].destinatarios.join(", ")}>\n${factoria[0].asunto}\n${factoria[0].cuerpo}`);
  });

  it("fila 2: CH10 (W Trek a Las Torres) + Factoria → dos pedidos, cada uno a su proveedor", async () => {
    const { armado } = await porElEmparejado("HI_TRAVEL_CH10-677", "CH10", "2027-04-01", "Double Room - Hostel", 2);
    const [factoria] = conProveedor(armado.pedidos, FACTORIA);
    const [trek] = conProveedor(armado.pedidos, LAS_TORRES);
    expect(factoria.destinatarios).toEqual(mailDe.get(FACTORIA));
    expect(factoria.cuerpo).toContain("Alojamiento: Factoria");
    expect(factoria.cuerpo).not.toMatch(/W[\s-]?Trek/i);
    expect(trek.cuerpo).toMatch(/W[\s-]?Trek/i);
    expect(trek.cuerpo).not.toContain("Alojamiento: Factoria");
    expect(conProveedor(armado.pedidos, VERTICE)).toEqual([]);
  });

  it("fila 2: Factoria (OD017) + el W Trek de Vértice (PNTW01) en la misma reserva → un pedido a Factoria y otro a Vértice", async () => {
    const [od017, pntw01] = [await idDe("OD017"), await idDe("PNTW01")];
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
        bookingIdOriginal: `DK9322${3}${SUFIJO}/test`,
        productoId: od017,
        otrosProductos: [pntw01],
        fechaInicio: "2027-05-01",
        fechaFin: "2027-05-08",
        componentes: [
          { tipo: "paquete", productoId: od017, fechaInicio: "2027-05-01", fechaFin: "2027-05-03" },
          { tipo: "paquete", productoId: pntw01, fechaInicio: "2027-05-03", fechaFin: "2027-05-08" },
        ],
        dePrueba: true,
      },
      admin,
    );
    const r = await armarYGuardarPedidos(admin, reserva.id);
    if (!r.ok) throw new Error(r.error);
    const factoria = conProveedor(r.pedidos, FACTORIA);
    const vertice = conProveedor(r.pedidos, VERTICE);
    expect(factoria).toHaveLength(1);
    expect(vertice).toHaveLength(1);
    expect(factoria[0].destinatarios).toEqual(mailDe.get(FACTORIA));
    expect(factoria[0].cuerpo).toContain("Alojamiento: Factoria");
    expect(vertice[0].destinatarios).toEqual(mailDe.get(VERTICE));
    expect(vertice[0].cuerpo).toMatch(/W[\s-]?Trek/i);
    expect(vertice[0].cuerpo).not.toContain("Alojamiento: Factoria");
    // Guardados: dos borradores, uno por proveedor.
    const guardados = await cargarPedidos(admin, reserva.id);
    expect(guardados.pedidos.filter((p) => p.cuerpo.includes("Alojamiento: Factoria"))).toHaveLength(1);
  });

  it("dorm → Puma Hostel: la regla de Factoria no toca a los otros hostels", async () => {
    const { armado } = await porElEmparejado("HI_ARGENTINA_ARCH31-677", "ARCH31", "2027-06-09", "Dormitory - Hostel", 4);
    expect(conProveedor(armado.pedidos, FACTORIA)).toEqual([]);
    expect(armado.pedidos.some((p) => p.cuerpo.includes("Alojamiento: Puma Hostel"))).toBe(true);
  });

  it("volver a armar deja el borrador a Factoria con lo mismo", async () => {
    const { reservaId, armado } = await porElEmparejado("HI_ARGENTINA_ARCH31-677", "ARCH31", "2027-07-09", "Twin Room - Hostel", 5);
    const antes = (await cargarPedidos(admin, reservaId)).pedidos.map((p) => `${p.destinatarios.join(",")}|${p.cuerpo}`).sort();
    const r = await armarYGuardarPedidos(admin, reservaId);
    if (!r.ok) throw new Error(r.error);
    const despues = (await cargarPedidos(admin, reservaId)).pedidos.map((p) => `${p.destinatarios.join(",")}|${p.cuerpo}`).sort();
    expect(despues).toEqual(antes);
    expect(conProveedor(armado.pedidos, FACTORIA)).toHaveLength(1);
  });

  it("sin sesión no se ven los borradores (RLS)", async () => {
    const { data } = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(data ?? []).toEqual([]);
  });
});
