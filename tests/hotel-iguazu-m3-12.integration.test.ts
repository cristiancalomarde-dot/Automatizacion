// @vitest-environment node
//
// Spec M3-12 — verificación 2 (integración contra la BASE DE PRUEBAS): una
// reserva OD010A (suelta) y una BRARCH26 (OD010A dentro del tour, con el ajuste
// "reemplazar": llega y sale en bus) arman el pedido a Cuenca del Plata con el
// hotel de cada día (TRF IN, los dos lados, TRF OUT) y como 105 Premium. Los
// otros borradores de la reserva siguen saliendo. Sin sesión no se ve nada
// (RLS). Lo que crea este archivo lleva `de_prueba = true` y se borra al final
// (solo lo suyo, registro-de-prueba.ts).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { fichaDePrueba } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const PREFIJO = "[test M3-12]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-12.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-22T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

/** Una ficha de lectura (M2-02) de Kilroy con un producto y su habitación, sobre la de ejemplo. */
function ficha(numero: string, nombre: string, codigo: string, fecha_inicio: string, fecha_fin: string, habitacion: string): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre, codigo, fecha_inicio, fecha_fin, habitacion }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: fecha_fin, confianza: 1 };
  return f;
}

const renglon = (cuerpo: string, empieza: string) => cuerpo.split("\n").find((l) => l.startsWith(empieza)) ?? "";

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-12 — Iguazú: el pedido a Cuenca del Plata con el hotel de cada día, en la base de pruebas", { timeout: 120_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;

  async function reservaDe(f: FichaLectura): Promise<string> {
    const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
    const deps = await cargarDependenciasReservas(admin);
    const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
    return c.reserva.id;
  }

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
  });

  afterAll(async () => {
    await registro.limpiar(admin);
  });


  it("OD010A con Hotel 3*: TRF IN, los dos lados y TRF OUT con El Pueblito, como 105 Premium", async () => {
    const id = await reservaDe(
      ficha(`DK93121${SUFIJO}/test`, "Iguazu Falls Premium", "HI_ARGENTINA_OD010A-677", "2027-04-03", "2027-04-06", "Double Room - Hotel 3*"),
    );
    const r = await armarYGuardarPedidos(admin, id);
    if (!r.ok) throw new Error(r.error);
    const guardados = await cargarPedidos(admin, id);
    const c = guardados.pedidos.find((p) => p.cuerpo.includes("TRF IN"))!.cuerpo;
    const hotel = "Hotel 3* El Pueblito (Iguazú) · hotel a confirmar";
    expect(c).toContain("Paquete 105 Premium");
    expect(renglon(c, "TRF IN")).toBe(`TRF IN, regular: 3 abr 2027 · Bus o vuelo pendiente · Drop off: ${hotel}`);
    expect(renglon(c, "Lado argentino")).toBe(`Lado argentino, Premium, en inglés: 4 abr 2027 · Pick up y drop off: ${hotel}`);
    expect(renglon(c, "Lado brasileño")).toBe(`Lado brasileño, Premium, en inglés: 5 abr 2027 · Pick up y drop off: ${hotel}`);
    expect(renglon(c, "TRF OUT")).toBe(`TRF OUT, regular: 6 abr 2027 · Bus o vuelo pendiente · Pick up: ${hotel}`);
    // El hotel El Pueblito va en el mismo borrador (misma casilla), como antes.
    expect(c).toContain("Alojamiento: Hotel 3* El Pueblito");
  });

  it("BRARCH26: el 105 Premium de OD010A (desde la Rodoviaria) lleva el hotel; los otros pedidos del tour siguen saliendo", async () => {
    const id = await reservaDe(
      ficha(`DK93122${SUFIJO}/test`, "Tour BRARCH26", "HI_ARGENTINA_BRARCH26-677", "2027-05-01", "2027-05-16", "Double Room - Hotel 3*"),
    );
    const r = await armarYGuardarPedidos(admin, id);
    if (!r.ok) throw new Error(r.error);
    const guardados = await cargarPedidos(admin, id);
    const c = guardados.pedidos.find((p) => p.cuerpo.includes("TRF IN"))!.cuerpo;
    const hotel = "Hotel 3* El Pueblito (Iguazú) · hotel a confirmar";
    expect(c).toContain("Paquete 105 Premium con transfer in desde la Rodoviaria de Foz");
    // OD010A arranca el día 5 del tour (5 may) y sale el 8.
    expect(renglon(c, "TRF IN")).toBe(`TRF IN, regular: 5 may 2027 · Bus o vuelo pendiente · Drop off: ${hotel}`);
    expect(renglon(c, "Lado argentino")).toBe(`Lado argentino, Premium, en inglés: 6 may 2027 · Pick up y drop off: ${hotel}`);
    expect(renglon(c, "Lado brasileño")).toBe(`Lado brasileño, Premium, en inglés: 7 may 2027 · Pick up y drop off: ${hotel}`);
    expect(renglon(c, "TRF OUT")).toBe(`TRF OUT, regular: 8 may 2027 · Bus o vuelo pendiente · Pick up: ${hotel}`);
    // Los otros pedidos del tour siguen saliendo (Río, Buenos Aires, ...), sin el texto de Iguazú.
    const otros = guardados.pedidos.filter((p) => !p.cuerpo.includes("TRF IN"));
    expect(otros.length).toBeGreaterThan(2);
    for (const p of otros) expect(p.cuerpo).not.toContain("Premium, en inglés");
  });

  it("sin sesión no se ven los borradores (RLS)", async () => {
    const { data } = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(data ?? []).toEqual([]);
  });
});
