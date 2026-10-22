// @vitest-environment node
//
// Spec M3-13 — verificación 2 (integración contra la BASE DE PRUEBAS):
// - los códigos de `data/codigos-agencias.csv` se cargan (re-ejecutable) y el
//   emparejado de la base reconoce "Rio de Janeiro to Santiago" de Adventure360
//   como BRARCH26 (paso 2, sin IA);
// - una reserva de Adventure360 con bike + rafting queda recibida y arma: Bike
//   Tour a La Bicicleta Naranja (nada de City Tour a Grupo Summa), Huentata solo
//   con Bodegas y KAHUAK con el Rafting; sin elección, como hoy;
// - sin fecha de inicio ("TBC") queda para revisión con el motivo de la fecha;
// - sin sesión no se ve nada (RLS).
// Lo que crea este archivo lleva `de_prueba = true` y se borra al final (solo lo
// suyo, registro-de-prueba.ts). La fila de `codigo_externo` de Adventure360 es
// catálogo de la base de pruebas y queda (como los códigos de Kilroy).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { cargarCatalogoParaEmparejar } from "@/lib/reservas/emparejar/catalogo";
import { importarCodigosAgencias } from "@/lib/reservas/emparejar/codigos-agencias";
import { emparejarProducto } from "@/lib/reservas/emparejar/emparejar";
import { MOTIVOS_EMPAREJADO as M } from "@/lib/reservas/emparejar/motivos";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { fichaDePrueba } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const PREFIJO = "[test M3-13]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const CSV = readFileSync(join(process.cwd(), "data", "codigos-agencias.csv"), "utf-8");
/** Un mes por corrida (2027-01..12): las fechas no chocan con otra corrida a medio borrar (posible duplicada). */
const MES = String((Date.now() % 12) + 1).padStart(2, "0");

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-13.hitravel.local>`,
    remitente: "bookings@adventure360.com",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-22T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Adventure360",
    dePrueba: true,
  };
}

/** Una ficha de lectura de Adventure360: el tour por su nombre, sin número, Hostel Dorm y las elecciones. */
function ficha(fechaInicio: string | null, pedidos: string[]): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851", { pedidos });
  f.agencia = { valor: "Adventure360", confianza: 1 };
  f.numero_reserva = { valor: null, limpio: null, confianza: 0 };
  f.productos = [{ ...f.productos[0], nombre: "Rio de Janeiro to Santiago", codigo: null, fecha_inicio: fechaInicio, fecha_fin: null, habitacion: "Hostel Dorm" }];
  f.fecha_inicio = { valor: fechaInicio, confianza: fechaInicio ? 1 : 0 };
  f.fecha_fin = { valor: null, confianza: 0 };
  f.pax = { valor: 1, confianza: 1 };
  f.pasajeros = [{ nombre: "Tomas", apellido: "Pruebasen", nacionalidad: "British", fecha_nacimiento: "1999-03-03", confianza: 1 }];
  f.vuelos = [];
  return f;
}

const ELECCIONES = ["Choice of tour in Buenos Aires: bike tour", "Choice of tour in Mendoza: rafting"];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-13 — Adventure360 (BRARCH26) con bike y rafting, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;

  async function reservaDe(f: FichaLectura) {
    const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
    const deps = await cargarDependenciasReservas(admin);
    const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Adventure360", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
    const { data, error } = await admin.from("reserva").select("id, estado, motivos_revision, origen_emparejado, producto:producto_id(codigo)").eq("id", c.reserva.id).single();
    if (error) throw new Error(error.message);
    return data as unknown as { id: string; estado: string; motivos_revision: string[]; origen_emparejado: string | null; producto: { codigo: string } | null };
  }

  async function pedidosDe(id: string) {
    const r = await armarYGuardarPedidos(admin, id);
    if (!r.ok) throw new Error(r.error);
    const { pedidos } = await cargarPedidos(admin, id);
    return { pedidos, tareas: r.tareas, a: (proveedor: string) => pedidos.find((p) => p.proveedores.some((x) => x.toLowerCase() === proveedor.toLowerCase())) };
  }

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
    await importarCodigosAgencias(admin, CSV);
  }, 120_000);

  afterAll(async () => {
    await registro.limpiar(admin);
  }, 120_000);

  it("la carga de los códigos es re-ejecutable y el emparejado de la base da BRARCH26 por el nombre", async () => {
    expect(await importarCodigosAgencias(admin, CSV)).toEqual({ creados: 0, actualizados: 0, sinCambios: 1 });
    const catalogo = await cargarCatalogoParaEmparejar(admin);
    const r = await emparejarProducto({ nombre: "Rio de Janeiro to Santiago", codigo: null, fechaInicio: `2027-${MES}-02`, fechaFin: null }, { agencia: "Adventure360", catalogo });
    expect(r.producto?.codigo).toBe("BRARCH26");
    expect(r.origen).toBe("nombre");
    expect(r.llamada).toBeNull();
  });

  it("bike + rafting: recibida; Bike Tour a La Bicicleta Naranja, Huentata solo Bodegas y KAHUAK con el Rafting", async () => {
    const r = await reservaDe(ficha(`2027-${MES}-02`, ELECCIONES));
    expect([r.producto?.codigo, r.estado, r.origen_emparejado, r.motivos_revision]).toEqual(["BRARCH26", "recibida", "nombre", []]);
    const { a, pedidos } = await pedidosDe(r.id);
    const naranja = a("La Bicicleta Naranja")!;
    expect(naranja.destinatarios).toEqual(["info@labicicletanaranja.com.ar"]);
    expect(naranja.cuerpo).toContain("Excursión: Bike Tour");
    expect(a("Grupo Summa")).toBeUndefined();
    const huentata = a("Huentata")!;
    expect(huentata.cuerpo).toContain("Excursión: Bodegas half Day");
    expect(huentata.cuerpo).not.toMatch(/Alta Monta/);
    const kahuak = a("KAHUAK")!;
    expect(kahuak.destinatarios).toEqual(["reservas@kahuak.com.ar", "agencias@kahuak.com.ar", "receptivo@kahuak.com.ar"]);
    expect(kahuak.cuerpo).toContain("Excursión: Rafting");
    expect(kahuak.cuerpo).toMatch(/Fecha: a coordinar \(estadía del \d+ al \d+ \w+ 2027\)/);
    expect(kahuak.estado).toBe("borrador");
    // Ninguno sale sin destinatario.
    expect(pedidos.filter((p) => p.sin_destinatario)).toEqual([]);
  });

  it("sin elección, como hoy: City Tour a Grupo Summa, Huentata con Alta Montaña y nada a KAHUAK", async () => {
    const r = await reservaDe(ficha(`2027-${MES}-05`, []));
    expect(r.estado).toBe("recibida");
    const { a } = await pedidosDe(r.id);
    expect(a("Grupo Summa")).toBeDefined();
    expect(a("La Bicicleta Naranja")).toBeUndefined();
    expect(a("Huentata")?.cuerpo).toContain("Alta Montaña");
    expect(a("KAHUAK")).toBeUndefined();
  });

  it("sin fecha de inicio (TBC): para revisión, con el motivo de la fecha", async () => {
    const r = await reservaDe(ficha(null, ELECCIONES));
    expect(r.producto?.codigo).toBe("BRARCH26");
    expect(r.estado).toBe("para_revision");
    expect(r.motivos_revision).toEqual([M.sinFechaInicio]);
  });

  it("sin sesión no se ven las reservas ni los borradores (RLS)", async () => {
    const reservas = await anonimo.from("reserva").select("id").eq("agencia", "Adventure360").limit(1);
    expect(reservas.data ?? []).toEqual([]);
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
  });
});
