// @vitest-environment node
//
// Spec M3-14 — verificación 2 (integración contra la BASE DE PRUEBAS): cada tour
// con la categoría que vende (ARCH33 y ARCH33EXP Hotel 3*; BRARCH26, ARBR23 y
// 5C01 Budget Hotel) arma sus pedidos con el catálogo real y data/categorias-tour.csv
// sin la tarea "Elegir el hotel de…"; en BRARCH26 Budget el pedido a Cuenca del
// Plata lleva El Pueblito (no "alojamiento a confirmar"). Sin sesión no se ve nada
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

const PREFIJO = "[test M3-14]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);

function mailDePrueba(agencia: string): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-14.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-22T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia,
    dePrueba: true,
  };
}

/**
 * Una ficha de lectura (M2-02) con un tour y su habitación, sobre la de ejemplo de Kilroy. ARBR23 no
 * lo vende Kilroy: va con el código propio de HI Travel (código exacto).
 */
function ficha(numero: string, agencia: string, codigo: string, fecha_inicio: string, habitacion: string): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: agencia, confianza: 1 };
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre: `Tour ${codigo}`, codigo: agencia === "Kilroy" ? `HI_TRAVEL_${codigo}-677` : codigo, fecha_inicio, fecha_fin: null, habitacion }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: null, confianza: 0 };
  return f;
}

const renglon = (cuerpo: string, empieza: string) => cuerpo.split("\n").find((l) => l.startsWith(empieza)) ?? "";

const CASOS = [
  { tour: "ARCH33", habitacion: "Double Room - Hotel 3*", inicio: "2027-02-03" },
  { tour: "ARCH33EXP", habitacion: "Double Room - Hotel 3*", inicio: "2027-03-03" },
  { tour: "BRARCH26", habitacion: "Double Room - Budget Hotel", inicio: "2027-04-03" },
  { tour: "ARBR23", habitacion: "Double Room - Budget Hotel", inicio: "2027-05-03", agencia: "HI Travel" },
  { tour: "5C01", habitacion: "Double Room - Budget Hotel", inicio: "2027-06-03" },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-14 — la categoría del tour elige el hotel, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;

  async function armar(caso: (typeof CASOS)[number], i: number) {
    const agencia = "agencia" in caso && caso.agencia ? caso.agencia : "Kilroy";
    const { mail } = await guardarMailRecibido(mailDePrueba(agencia), admin);
    const deps = await cargarDependenciasReservas(admin);
    const f = ficha(`DK9314${i}${SUFIJO}/test`, agencia, caso.tour, caso.inicio, caso.habitacion);
    const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia, deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
    const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", c.reserva.id).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
    expect([fila.producto?.codigo, fila.estado]).toEqual([caso.tour, "recibida"]);
    const r = await armarYGuardarPedidos(admin, c.reserva.id);
    if (!r.ok) throw new Error(r.error);
    const { pedidos } = await cargarPedidos(admin, c.reserva.id);
    return { tareas: r.tareas, pedidos };
  }

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
    it(`${caso.tour} (${caso.habitacion.replace("Double Room - ", "")}): sin "Elegir el hotel de…"`, async () => {
      const { tareas, pedidos } = await armar(caso, i);
      console.log(`[M3-14] ${caso.tour}: ${pedidos.length} pedidos; tareas: ${tareas.map((t) => t.texto).join(" | ") || "ninguna"}`);
      expect(tareas.filter((t) => t.texto.startsWith("Elegir el hotel"))).toEqual([]);
      if (caso.tour === "BRARCH26") {
        const c = pedidos.find((p) => p.cuerpo.includes("TRF IN"))!.cuerpo;
        console.log(`[M3-14] BRARCH26 Cuenca del Plata: ${renglon(c, "TRF IN")}`);
        expect(c).toContain("Alojamiento: Hotel 3* El Pueblito");
        expect(renglon(c, "TRF IN")).toContain("Drop off: Hotel 3* El Pueblito (Iguazú) · hotel a confirmar");
        expect(c).not.toContain("alojamiento a confirmar");
      }
    });
  });

  it("sin sesión no se ven los borradores ni las tareas (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
    const tareas = await anonimo.from("reserva_tarea").select("id").limit(1);
    expect(tareas.data ?? []).toEqual([]);
  });
});
