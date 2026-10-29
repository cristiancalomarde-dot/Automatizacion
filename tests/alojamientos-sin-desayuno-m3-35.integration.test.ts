// @vitest-environment node
//
// Spec M3-35 — verificación 2 (integración contra la BASE DE PRUEBAS): con el catálogo real y la
// lista de data/alojamientos-sin-desayuno.csv, en ARCH31 el Puma Hostel (Puma House) pide la
// habitación sin "con desayuno" y los otros hostels del tour siguen con desayuno. Sin sesión no se ve
// nada (RLS). Lo que crea este archivo lleva `de_prueba = true` y se borra al final (solo lo suyo,
// registro-de-prueba.ts). No se envía nada (#4).
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

const PREFIJO = "[test M3-35]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-35.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-29T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

function ficha(numero: string, codigo: string, fecha_inicio: string, habitacion: string): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre: `Tour ${codigo}`, codigo: `HI_TRAVEL_${codigo}-677`, fecha_inicio, fecha_fin: null, habitacion }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: null, confianza: 0 };
  return f;
}

/** "Alojamiento: X" → [X, su renglón "Habitación: …"]. */
function habitaciones(cuerpos: string[]): Map<string, string> {
  const r = new Map<string, string>();
  for (const c of cuerpos) {
    const l = c.split("\n").map((x) => x.replace(/^\d+\) /, ""));
    l.forEach((x, i) => {
      if (x.startsWith("Alojamiento: ")) r.set(x.replace("Alojamiento: ", ""), l.slice(i + 1, i + 5).find((y) => y.startsWith("Habitación:")) ?? "(sin renglón)");
    });
  }
  return r;
}

const CASOS = [
  { habitacion: "Dormitory - Hostel", inicio: "2027-05-14", puma: "Habitación: dorm compartido", otros: "Habitación: dorm compartido, con desayuno" },
  { habitacion: "Hostel", inicio: "2027-06-14", puma: "Habitación: a confirmar (dorm / DBL / SGL)", otros: "Habitación: a confirmar (dorm / DBL / SGL), con desayuno" },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-35 — alojamientos sin desayuno, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
  });

  afterAll(async () => {
    await registro.limpiar(admin);
  }, 120_000);

  CASOS.forEach((caso, i) => {
    it(`ARCH31 «${caso.habitacion}»: Puma Hostel «${caso.puma}», los demás «${caso.otros}»`, async () => {
      const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
      const deps = await cargarDependenciasReservas(admin);
      const f = ficha(`DK9335${i}${SUFIJO}/test`, "ARCH31", caso.inicio, caso.habitacion);
      const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
      const r = await armarYGuardarPedidos(admin, c.reserva.id);
      if (!r.ok) throw new Error(r.error);
      const { pedidos } = await cargarPedidos(admin, c.reserva.id);
      const habs = habitaciones(pedidos.map((p) => p.cuerpo));
      console.log(`[M3-35] ARCH31 ${caso.habitacion}: ${[...habs].map(([h, x]) => `${h} → ${x}`).join(" | ")}`);
      expect(habs.get("Puma Hostel")).toBe(caso.puma);
      const otros = [...habs].filter(([h]) => h !== "Puma Hostel");
      expect(otros.length).toBeGreaterThan(0);
      for (const [, x] of otros) expect(x).toBe(caso.otros);
    });
  });

  it("sin sesión no se ven los borradores ni las tareas (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
    const tareas = await anonimo.from("reserva_tarea").select("id").limit(1);
    expect(tareas.data ?? []).toEqual([]);
  });
});
