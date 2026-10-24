// @vitest-environment node
//
// Spec M3-18 — verificación 2 (integración contra la BASE DE PRUEBAS): con el
// catálogo real, el renglón de habitación de los pedidos de alojamiento sale
// Standard y con desayuno, también dentro de los tours (BRARCH26 en Budget Hotel,
// ARCH31 en hostel). El Overland de CHB31 sigue con su habitación de siempre
// (DBL con baño compartido), sin desayuno. Sin sesión no se ve nada (RLS). Lo que
// crea este archivo lleva `de_prueba = true` y se borra al final (solo lo suyo,
// registro-de-prueba.ts). No se envía nada (#4).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { fichaDePrueba } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const PREFIJO = "[test M3-18]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);

function mailDePrueba(agencia: string): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-18.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-23T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia,
    dePrueba: true,
  };
}

/** Una ficha de lectura (M2-02) de Kilroy con un tour y su habitación, sobre la de ejemplo. */
function ficha(numero: string, codigo: string, fecha_inicio: string, habitacion: string): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre: `Tour ${codigo}`, codigo: `HI_TRAVEL_${codigo}-677`, fecha_inicio, fecha_fin: null, habitacion }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: null, confianza: 0 };
  return f;
}

/** El renglón de habitación de cada alojamiento: "Alojamiento: X" → "Habitación: …". */
function habitaciones(cuerpos: string[]): Array<[string, string]> {
  const r: Array<[string, string]> = [];
  for (const c of cuerpos) {
    // Con varios servicios en el pedido van numerados ("1) Alojamiento: …").
    const l = c.split("\n").map((x) => x.replace(/^\d+\) /, ""));
    l.forEach((x, i) => {
      if (!x.startsWith("Alojamiento: ")) return;
      const hab = l.slice(i + 1, i + 5).find((y) => y.startsWith("Habitación:")) ?? "(sin renglón)";
      r.push([x.replace("Alojamiento: ", ""), hab]);
    });
  }
  return r;
}

const CASOS = [
  { tour: "BRARCH26", habitacion: "Double Room - Budget Hotel", inicio: "2027-04-07", esperado: "Habitación: DBL Standard con desayuno" },
  { tour: "ARCH31", habitacion: "Single Room - Hostel", inicio: "2027-05-07", esperado: "Habitación: SGL Standard con desayuno" },
  { tour: "ARCH31", habitacion: "Dormitory - Hostel", inicio: "2027-06-07", esperado: "Habitación: dorm compartido, con desayuno" },
  { tour: "CHB31", habitacion: "Double Room - Hostel", inicio: "2027-07-07", esperado: "Habitación: DBL Standard con desayuno" },
  // Lo que no se reconoce: lo de hoy + ", con desayuno".
  { tour: "BRARCH26", habitacion: "Budget Hotel", inicio: "2027-08-07", esperado: "Habitación: Budget Hotel, con desayuno" },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-18 — Standard con desayuno, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;

  async function armar(caso: (typeof CASOS)[number], i: number) {
    const { mail } = await guardarMailRecibido(mailDePrueba("Kilroy"), admin);
    const deps = await cargarDependenciasReservas(admin);
    const f = ficha(`DK9318${i}${SUFIJO}/test`, caso.tour, caso.inicio, caso.habitacion);
    const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
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
    it(`${caso.tour} (${caso.habitacion}): cada alojamiento pide «${caso.esperado}»`, async () => {
      const { tareas, pedidos } = await armar(caso, i);
      const habs = habitaciones(pedidos.map((p) => p.cuerpo));
      console.log(`[M3-18] ${caso.tour} ${caso.habitacion}: ${habs.map(([h, r]) => `${h} → ${r}`).join(" | ")}`);
      // En CHB31 el hostel de San Pedro va por WhatsApp (tarea, no pedido): puede no haber alojamiento por mail.
      if (caso.tour !== "CHB31") expect(habs.length).toBeGreaterThan(0);
      for (const [, r] of habs) expect(r).toBe(caso.esperado);
      // La tarea interna no cambia: sin "Standard" ni "desayuno".
      for (const t of tareas) expect(t.texto).not.toMatch(/Standard con desayuno/);
      if (caso.tour === "CHB31") {
        const c = pedidos.map((p) => p.cuerpo).find((x) => x.includes("Overland"))!;
        const overland = c.slice(c.indexOf("Overland")).split("\n\n")[0];
        console.log(`[M3-18] CHB31 Overland: ${overland.replace(/\n/g, " / ")}`);
        expect(overland).toContain("Habitación: DBL con baño compartido");
        expect(overland).not.toMatch(/desayuno|Standard/);
      }
    });
  });

  it("sin habitación (SPAP05 de Journaway, los Tayka del Overland privado): «Standard con desayuno (tipo a confirmar)» y un aviso", async () => {
    const prod = await admin.from("producto").select("id").eq("codigo", "SPAP05").single();
    if (prod.error) throw new Error(prod.error.message);
    const detalle = await cargarProducto(admin, prod.data.id);
    const componentes = componentesDeLaReserva(detalle, "2027-10-04", { finalPuertoNatales: false, proveedorTransferPNT: null });
    const { mail } = await guardarMailRecibido({ ...mailDePrueba("Journaway"), remitente: "bookings@journaway.com" }, admin);
    const { reserva } = await crearReserva(
      {
        agencia: "Journaway",
        mailRecibidoId: mail.id,
        estado: "recibida",
        pax: 2,
        pasajeros: [
          { nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" },
          { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
        ],
        habitacion: null,
        productoId: prod.data.id,
        fechaInicio: "2027-10-04",
        fechaFin: "2027-10-11",
        componentes,
        bookingIdOriginal: null,
        dePrueba: true,
      },
      admin,
    );
    const r = await armarYGuardarPedidos(admin, reserva.id);
    if (!r.ok) throw new Error(r.error);
    const { pedidos } = await cargarPedidos(admin, reserva.id);
    const habs = habitaciones(pedidos.map((p) => p.cuerpo));
    const avisos = pedidos.filter((p) => p.cuerpo.includes("Alojamiento: ")).flatMap((p) => p.avisos);
    console.log(`[M3-18] SPAP05 sin habitación: ${habs.map(([h, x]) => `${h} → ${x}`).join(" | ")} · avisos: ${avisos.join(" | ")}`);
    expect(habs.length).toBeGreaterThan(0);
    for (const [hotel, x] of habs) {
      expect(x).toBe("Habitación: Standard con desayuno (tipo a confirmar)");
      expect(avisos).toContain(`Falta el tipo de habitación de ${hotel}: completalo antes de enviar.`);
    }
  });

  it("sin sesión no se ven los borradores ni las tareas (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
    const tareas = await anonimo.from("reserva_tarea").select("id").limit(1);
    expect(tareas.data ?? []).toEqual([]);
  });
});
