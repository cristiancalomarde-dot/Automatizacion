// @vitest-environment node
//
// Spec M3-21 — verificación 2 (integración contra la BASE DE PRUEBAS): con el
// catálogo real, la habitación sin tipo va por los pax. En los hoteles de los tours
// (BRARCH26 "Budget Hotel") 2 pax → DBL y 1 pax → SGL con un aviso para revisarlo con
// el vendedor; "2 SGLs" se respeta; en un hostel sin tipo (ARCH31 "Hostel") queda a
// confirmar. SPAP05 de Journaway (Tayka, sin habitación) igual. En el W Trek (ARCH33,
// CH10) la carpa sin cantidad con 2 pax es Tent DBL; con 1 pax o con un single que no
// menciona el trek, a confirmar con el aviso de 1 pax. Los avisos no van en el texto.
// Sin sesión no se ve nada (RLS). Lo que crea este archivo lleva `de_prueba = true` y
// se borra al final (solo lo suyo). No se envía nada (#4).
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

const PREFIJO = "[test M3-21]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);
const TREK_A_CONFIRMAR = "Alojamiento en el trek: a confirmar (Refugio Dorm a compartir / Tent DBL / Tent SGL)";
const AVISO_DBL = "La reserva no dice el tipo de habitación: va DBL por 2 pax. Revisalo con el vendedor.";
const AVISO_SGL = "La reserva no dice el tipo de habitación: va SGL por 1 pax. Revisalo con el vendedor.";

function mailDePrueba(agencia: string): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-21.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-23T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia,
    dePrueba: true,
  };
}

/** Una ficha de lectura (M2-02) de Kilroy con un producto, su habitación y los pax, sobre la de ejemplo. */
function ficha(numero: string, codigoKilroy: string, fecha_inicio: string, habitacion: string, pax: number): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre: `Producto ${codigoKilroy}`, codigo: codigoKilroy, fecha_inicio, fecha_fin: null, habitacion }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: null, confianza: 0 };
  f.pax = { valor: pax, confianza: 1 };
  return f;
}

const lineas = (cuerpo: string) => cuerpo.split("\n").map((x) => x.replace(/^\d+\) /, ""));
const renglonesTrek = (cuerpos: string[]) => cuerpos.flatMap(lineas).filter((l) => l.startsWith("Alojamiento en el trek:"));
/** "Alojamiento: X" → [X, su renglón "Habitación: …"]. */
function habitaciones(cuerpos: string[]): Array<[string, string]> {
  const r: Array<[string, string]> = [];
  for (const c of cuerpos) {
    const l = lineas(c);
    l.forEach((x, i) => {
      if (x.startsWith("Alojamiento: ")) r.push([x.replace("Alojamiento: ", ""), l.slice(i + 1, i + 5).find((y) => y.startsWith("Habitación:")) ?? "(sin renglón)"]);
    });
  }
  return r;
}

interface Caso {
  producto: string;
  codigo: string;
  habitacion: string;
  pax: number;
  inicio: string;
  hab: string;
  /** El aviso de cada alojamiento ("hotel" → con su nombre). */
  aviso: ((hotel: string) => string) | null;
  trek?: string;
  avisoTrek?: RegExp | null;
}

const CASOS: Caso[] = [
  { producto: "BRARCH26", codigo: "HI_TRAVEL_BRARCH26-677", habitacion: "Budget Hotel", pax: 2, inicio: "2027-04-07", hab: "Habitación: DBL Standard con desayuno", aviso: () => AVISO_DBL },
  { producto: "BRARCH26", codigo: "HI_TRAVEL_BRARCH26-677", habitacion: "Budget Hotel", pax: 1, inicio: "2027-05-07", hab: "Habitación: SGL Standard con desayuno", aviso: () => AVISO_SGL },
  { producto: "BRARCH26", codigo: "HI_TRAVEL_BRARCH26-677", habitacion: "2 SGLs - Budget Hotel", pax: 2, inicio: "2027-06-07", hab: "Habitación: 2 SGL Standard con desayuno", aviso: null },
  {
    producto: "ARCH31",
    codigo: "HI_TRAVEL_ARCH31-677",
    habitacion: "Hostel",
    pax: 2,
    inicio: "2027-07-07",
    hab: "Habitación: a confirmar (dorm / DBL / SGL), con desayuno",
    aviso: (h) => `La reserva no dice si en ${h} es dorm, DBL o SGL: completalo antes de enviar y revisalo con el vendedor.`,
  },
  { producto: "ARCH33", codigo: "HI_ARGENTINA_W_TREK_ARCH_33-677", habitacion: "Dormitory - Hostel and W-Trek Tent", pax: 2, inicio: "2027-08-01", hab: "Habitación: dorm compartido, con desayuno", aviso: null, trek: "Alojamiento en el trek: Tent DBL", avisoTrek: null },
  { producto: "ARCH33", codigo: "HI_ARGENTINA_W_TREK_ARCH_33-677", habitacion: "Dormitory - Hostel and W-Trek Tent", pax: 1, inicio: "2027-09-01", hab: "Habitación: dorm compartido, con desayuno", aviso: null, trek: TREK_A_CONFIRMAR, avisoTrek: /^Falta el tipo de alojamiento del .*\(1 pax\): Tent SGL es mucho más caro que el Refugio Dorm; revisalo con el vendedor\.$/ },
  { producto: "CH10", codigo: "HI_TRAVEL_CH10-677", habitacion: "Single Room - Hotel 3*", pax: 1, inicio: "2027-10-01", hab: "Habitación: SGL Standard con desayuno", aviso: null, trek: TREK_A_CONFIRMAR, avisoTrek: /^Falta el tipo de alojamiento del .*\(1 pax\): Tent SGL es mucho más caro que el Refugio Dorm; revisalo con el vendedor\.$/ },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-21 — la habitación según los pax, en la base de pruebas", { timeout: 180_000 }, () => {
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
    it(`${caso.producto} «${caso.habitacion}» con ${caso.pax} pax: «${caso.hab}»${caso.trek ? ` · «${caso.trek}»` : ""}`, async () => {
      const { mail } = await guardarMailRecibido(mailDePrueba("Kilroy"), admin);
      const deps = await cargarDependenciasReservas(admin);
      const f = ficha(`DK9321${i}${SUFIJO}/test`, caso.codigo, caso.inicio, caso.habitacion, caso.pax);
      const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
      const { data, error } = await admin.from("reserva").select("estado, pax, producto:producto_id(codigo)").eq("id", c.reserva.id).single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { estado: string; pax: number | null; producto: { codigo: string } | null };
      expect([fila.producto?.codigo, fila.estado, fila.pax]).toEqual([caso.producto, "recibida", caso.pax]);
      const r = await armarYGuardarPedidos(admin, c.reserva.id);
      if (!r.ok) throw new Error(r.error);
      const { pedidos } = await cargarPedidos(admin, c.reserva.id);
      const cuerpos = pedidos.map((p) => p.cuerpo);
      const habs = habitaciones(cuerpos);
      const conAlojamiento = pedidos.filter((p) => p.cuerpo.includes("Alojamiento: "));
      const avisos = conAlojamiento.flatMap((p) => p.avisos);
      console.log(`[M3-21] ${caso.producto} «${caso.habitacion}» ${caso.pax} pax: ${habs.map(([h, x]) => `${h} → ${x}`).join(" | ")}\n  avisos: ${[...new Set(pedidos.flatMap((p) => p.avisos))].join(" | ")}`);
      expect(habs.length).toBeGreaterThan(0);
      for (const [hotel, x] of habs) {
        expect(x).toBe(caso.hab);
        if (caso.aviso) expect(avisos).toContain(caso.aviso(hotel));
      }
      if (!caso.aviso) expect(avisos.filter((a) => /tipo de habitación|dorm, DBL o SGL/.test(a))).toEqual([]);
      // Los avisos son internos: el texto al proveedor no habla del vendedor.
      for (const c of cuerpos) expect(c).not.toMatch(/vendedor|no dice/i);
      if (caso.trek) {
        const trekPedido = pedidos.find((p) => /W[\s-]?Trek/i.test(p.cuerpo))!;
        const bloque = trekPedido.cuerpo.slice(trekPedido.cuerpo.search(/W[\s-]?Trek/i)).split("\n\n")[0];
        console.log(`[M3-21] ${caso.producto} trek:\n${bloque}\n  avisos del trek: ${trekPedido.avisos.filter((a) => /alojamiento del/i.test(a)).join(" | ")}`);
        expect(renglonesTrek(cuerpos)).toEqual([caso.trek]);
        const delTrek = trekPedido.avisos.filter((a) => /alojamiento del/i.test(a));
        if (caso.avisoTrek) expect(delTrek.some((a) => caso.avisoTrek!.test(a))).toBe(true);
        else expect(delTrek).toEqual([]);
      }
    });
  });

  [2, 1].forEach((pax) => {
    it(`SPAP05 de Journaway (Tayka, sin habitación) con ${pax} pax → ${pax === 2 ? "DBL" : "SGL"} y el aviso`, async () => {
      const prod = await admin.from("producto").select("id").eq("codigo", "SPAP05").single();
      if (prod.error) throw new Error(prod.error.message);
      const detalle = await cargarProducto(admin, prod.data.id);
      const componentes = componentesDeLaReserva(detalle, "2027-10-04", { finalPuertoNatales: false, proveedorTransferPNT: null });
      const { mail } = await guardarMailRecibido({ ...mailDePrueba("Journaway"), remitente: "bookings@journaway.com" }, admin);
      const pasajeros = [
        { nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" },
        { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
      ].slice(0, pax);
      const { reserva } = await crearReserva(
        { agencia: "Journaway", mailRecibidoId: mail.id, estado: "recibida", pax, pasajeros, habitacion: null, productoId: prod.data.id, fechaInicio: "2027-10-04", fechaFin: "2027-10-11", componentes, bookingIdOriginal: null, dePrueba: true },
        admin,
      );
      const r = await armarYGuardarPedidos(admin, reserva.id);
      if (!r.ok) throw new Error(r.error);
      const { pedidos } = await cargarPedidos(admin, reserva.id);
      const habs = habitaciones(pedidos.map((p) => p.cuerpo));
      const avisos = pedidos.filter((p) => p.cuerpo.includes("Alojamiento: ")).flatMap((p) => p.avisos);
      console.log(`[M3-21] SPAP05 ${pax} pax: ${habs.map(([h, x]) => `${h} → ${x}`).join(" | ")} · avisos: ${[...new Set(avisos)].join(" | ")}`);
      expect(habs.length).toBeGreaterThan(0);
      for (const [, x] of habs) expect(x).toBe(`Habitación: ${pax === 2 ? "DBL" : "SGL"} Standard con desayuno`);
      expect(avisos).toContain(pax === 2 ? AVISO_DBL : AVISO_SGL);
      for (const p of pedidos) expect(p.cuerpo).not.toMatch(/vendedor/i);
    });
  });

  it("sin sesión no se ven los borradores ni las tareas (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
    const tareas = await anonimo.from("reserva_tarea").select("id").limit(1);
    expect(tareas.data ?? []).toEqual([]);
  });
});
