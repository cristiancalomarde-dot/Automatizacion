// @vitest-environment node
//
// Spec M3-19 — verificación 2 (integración contra la BASE DE PRUEBAS): con el
// catálogo real, el pedido del W Trek (CH10, CH11 sueltos y dentro de ARCH33 y
// ARCH33EXP) lleva "Alojamiento en el trek: …" según la habitación de la reserva
// (DK1594177: "Double Room - Hostel and W-Trek Tent" → Tent DBL). Los alojamientos
// de Puerto Natales siguen con su habitación Standard con desayuno (M3-18) y el
// Overland de CHB31 no cambia. Sin sesión no se ve nada (RLS). Lo que crea este
// archivo lleva `de_prueba = true` y se borra al final (solo lo suyo). No se envía nada (#4).
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

const PREFIJO = "[test M3-19]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);
const A_CONFIRMAR = "Alojamiento en el trek: a confirmar (Refugio Dorm a compartir / Tent DBL / Tent SGL)";

function mailDePrueba(agencia: string): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-19.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-23T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia,
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

/** Los renglones sin la numeración de cada servicio ("1) …"). */
const lineas = (cuerpo: string) => cuerpo.split("\n").map((x) => x.replace(/^\d+\) /, ""));
const renglonesTrek = (cuerpos: string[]) => cuerpos.flatMap(lineas).filter((l) => l.startsWith("Alojamiento en el trek:"));
/** "Alojamiento: X" → su renglón "Habitación: …". */
function habitaciones(cuerpos: string[]): string[] {
  const r: string[] = [];
  for (const c of cuerpos) {
    const l = lineas(c);
    l.forEach((x, i) => {
      if (x.startsWith("Alojamiento: ")) r.push(l.slice(i + 1, i + 5).find((y) => y.startsWith("Habitación:")) ?? "(sin renglón)");
    });
  }
  return r;
}

const CASOS = [
  { codigo: "HI_ARGENTINA_W_TREK_CH_11-677", producto: "CH11", habitacion: "Double Room - Hostel and W-Trek Tent", inicio: "2027-03-01", trek: "Alojamiento en el trek: Tent DBL", hab: "Habitación: DBL Standard con desayuno" },
  { codigo: "HI_TRAVEL_CH10-677", producto: "CH10", habitacion: "Single Room - Hotel 3*", inicio: "2027-04-01", trek: "Alojamiento en el trek: Tent SGL", hab: "Habitación: SGL Standard con desayuno" },
  { codigo: "HI_ARGENTINA_W_TREK_ARCH_33-677", producto: "ARCH33", habitacion: "Dormitory - Hostel", inicio: "2027-05-01", trek: "Alojamiento en el trek: Refugio Dorm a compartir", hab: "Habitación: dorm compartido, con desayuno" },
  { codigo: "HI_TRAVEL_ARCH_EXP-677", producto: "ARCH33EXP", habitacion: "Double Room - Hostel and W-Trek Tent", inicio: "2027-06-01", trek: "Alojamiento en el trek: Tent DBL", hab: "Habitación: DBL Standard con desayuno" },
  { codigo: "HI_ARGENTINA_W_TREK_CH_11-677", producto: "CH11", habitacion: "Triple Room - Hotel 3*", inicio: "2027-07-01", trek: A_CONFIRMAR, hab: "Habitación: TPL Standard con desayuno" },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-19 — el W Trek dice el tipo de alojamiento, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;

  async function armar(caso: (typeof CASOS)[number], i: number) {
    const { mail } = await guardarMailRecibido(mailDePrueba("Kilroy"), admin);
    const deps = await cargarDependenciasReservas(admin);
    const f = ficha(`DK9319${i}${SUFIJO}/test`, caso.codigo, caso.inicio, caso.habitacion);
    const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
    const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", c.reserva.id).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
    expect([fila.producto?.codigo, fila.estado]).toEqual([caso.producto, "recibida"]);
    const r = await armarYGuardarPedidos(admin, c.reserva.id);
    if (!r.ok) throw new Error(r.error);
    const { pedidos } = await cargarPedidos(admin, c.reserva.id);
    return { reservaId: c.reserva.id, pedidos };
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
    it(`${caso.producto} (${caso.habitacion}): «${caso.trek}»; Puerto Natales «${caso.hab}»`, async () => {
      const { pedidos } = await armar(caso, i);
      const cuerpos = pedidos.map((p) => p.cuerpo);
      const trekPedido = pedidos.find((p) => /W[\s-]?Trek/i.test(p.cuerpo))!;
      const bloque = trekPedido.cuerpo.slice(trekPedido.cuerpo.search(/W[\s-]?Trek/i)).split("\n\n")[0];
      console.log(`[M3-19] ${caso.producto} ${caso.habitacion}:\n${bloque}\n  Puerto Natales/otros: ${habitaciones(cuerpos).join(" | ")}`);
      // Un solo W Trek por paquete: un solo renglón, y es el esperado.
      expect(renglonesTrek(cuerpos)).toEqual([caso.trek]);
      expect(bloque).toContain(caso.trek);
      if (caso.trek === A_CONFIRMAR) expect(trekPedido.avisos.some((a) => /^Falta el tipo de alojamiento del W[\s-]?Trek/i.test(a))).toBe(true);
      else expect(trekPedido.avisos.filter((a) => /alojamiento del W/i.test(a))).toEqual([]);
      // Los alojamientos (Puerto Natales y los demás del tour) siguen como en M3-18.
      const habs = habitaciones(cuerpos);
      expect(habs.length).toBeGreaterThan(0);
      for (const h of habs) expect(h).toBe(caso.hab);
    });
  });

  it("volver a armar deja el borrador del W Trek sin editar con lo mismo", async () => {
    const { reservaId, pedidos } = await armar({ ...CASOS[0], inicio: "2027-08-01" }, 9);
    const antes = pedidos.map((p) => p.cuerpo).sort();
    const r = await armarYGuardarPedidos(admin, reservaId);
    if (!r.ok) throw new Error(r.error);
    const despues = (await cargarPedidos(admin, reservaId)).pedidos.map((p) => p.cuerpo).sort();
    expect(despues).toEqual(antes);
    expect(renglonesTrek(despues)).toEqual(["Alojamiento en el trek: Tent DBL"]);
  });

  it("el Overland de CHB31 no cambia: su habitación de siempre y sin renglón del trek", async () => {
    const { mail } = await guardarMailRecibido(mailDePrueba("Kilroy"), admin);
    const deps = await cargarDependenciasReservas(admin);
    const f = ficha(`DK9319${8}${SUFIJO}/test`, "HI_ARGENTINA_OVERLAND_7DAYS-677", "2027-09-07", "Double Room - Hostel");
    const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
    const r = await armarYGuardarPedidos(admin, c.reserva.id);
    if (!r.ok) throw new Error(r.error);
    const cuerpos = (await cargarPedidos(admin, c.reserva.id)).pedidos.map((p) => p.cuerpo);
    const conOverland = cuerpos.find((x) => x.includes("Overland"))!;
    const overland = conOverland.slice(conOverland.indexOf("Overland")).split("\n\n")[0];
    console.log(`[M3-19] CHB31 Overland: ${overland.replace(/\n/g, " / ")}`);
    expect(overland).toContain("Habitación: DBL con baño compartido");
    expect(cuerpos.join("\n")).not.toContain("Alojamiento en el trek");
  });

  it("sin sesión no se ven los borradores ni las tareas (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
    const tareas = await anonimo.from("reserva_tarea").select("id").limit(1);
    expect(tareas.data ?? []).toEqual([]);
  });
});
