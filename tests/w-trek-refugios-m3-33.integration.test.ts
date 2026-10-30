// @vitest-environment node
//
// Spec M3-33 — verificación 2 (integración contra la BASE DE PRUEBAS): con el catálogo
// real, el pedido del W Trek (CH11 y CH10 sueltos, y dentro de ARCH33 y ARCH33EXP) lleva,
// debajo del renglón de M3-19, "Refugios: Central (1 mar) – …" según la variante de
// data/w-trek-refugios.csv, con las fechas desde el inicio del trek en la reserva (en los
// tours, el de esa parte). El renglón de M3-19 no cambia. Sin sesión no se ve nada (RLS).
// Lo que crea este archivo lleva `de_prueba = true` y se borra al final (solo lo suyo). No se envía nada (#4).
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

const PREFIJO = "[test M3-33]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-33.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-29T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

function ficha(numero: string, codigoKilroy: string, fecha_inicio: string, habitacion: string): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre: `Producto ${codigoKilroy}`, codigo: codigoKilroy, fecha_inicio, fecha_fin: null, habitacion }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: null, confianza: 0 };
  return f;
}

const lineas = (cuerpo: string) => cuerpo.split("\n").map((x) => x.replace(/^\d+\) /, ""));

/** "Desde: 3 mar 2027 · Hasta: …" → "2027-03-03". */
function inicioDelBloque(l: string[]): string {
  const m = l.find((x) => x.startsWith("Desde: "))!.match(/^Desde: (\d+) (\w+) (\d{4})/)!;
  return `${m[3]}-${String(MESES.indexOf(m[2]) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function esperado(refugios: string[], inicio: string): string {
  return `Refugios: ${refugios
    .map((r, i) => {
      const d = new Date(`${inicio}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return `${r} (${d.getUTCDate()} ${MESES[d.getUTCMonth()]})`;
    })
    .join(" – ")}`;
}

const EXPRESS = ["Central", "Francés", "Francés"];
const STANDARD = ["Central", "Central", "Francés", "Paine Grande"];

const CASOS = [
  { codigo: "HI_ARGENTINA_W_TREK_CH_11-677", producto: "CH11", inicio: "2027-03-01", refugios: EXPRESS },
  { codigo: "HI_TRAVEL_CH10-677", producto: "CH10", inicio: "2027-04-01", refugios: STANDARD },
  { codigo: "HI_ARGENTINA_W_TREK_ARCH_33-677", producto: "ARCH33", inicio: "2027-02-25", refugios: STANDARD },
  { codigo: "HI_TRAVEL_ARCH_EXP-677", producto: "ARCH33EXP", inicio: "2027-03-27", refugios: EXPRESS },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-33 — los refugios del W Trek en el pedido, en la base de pruebas", { timeout: 180_000 }, () => {
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
    it(`${caso.producto}: el pedido a Las Torres dice los refugios con sus fechas`, async () => {
      const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
      const deps = await cargarDependenciasReservas(admin);
      const f = ficha(`DK9333${i}${SUFIJO}/test`, caso.codigo, caso.inicio, "Double Room - Hostel and W-Trek Tent");
      const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
      const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", c.reserva.id).single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
      expect([fila.producto?.codigo, fila.estado]).toEqual([caso.producto, "recibida"]);
      const r = await armarYGuardarPedidos(admin, c.reserva.id);
      if (!r.ok) throw new Error(r.error);
      const { pedidos } = await cargarPedidos(admin, c.reserva.id);
      const trek = pedidos.find((p) => /W[\s-]?Trek/i.test(p.cuerpo))!;
      const bloque = trek.cuerpo.slice(trek.cuerpo.search(/W[\s-]?Trek/i)).split("\n\n")[0];
      // CH11: el pedido entero a Las Torres, tal como sale; los demás, el bloque del W Trek.
      console.log(`[M3-33] ${caso.producto}:\n${caso.producto === "CH11" ? `Asunto: ${trek.asunto}\n${trek.cuerpo}` : bloque}`);
      const l = lineas(bloque);
      const k = l.indexOf("Alojamiento en el trek: Tent DBL");
      expect(k).toBeGreaterThan(0);
      expect(l[k + 1]).toBe(esperado(caso.refugios, inicioDelBloque(l)));
      // Un solo W Trek por paquete: un solo renglón de refugios y ningún aviso de "sin cargar".
      expect(pedidos.flatMap((p) => lineas(p.cuerpo)).filter((x) => x.startsWith("Refugios:"))).toHaveLength(1);
      expect(pedidos.flatMap((p) => p.avisos).filter((a) => /Refugios del W Trek sin cargar/.test(a))).toEqual([]);
    });
  });

  it("sin sesión no se ven los borradores (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
  });
});
