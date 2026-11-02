// @vitest-environment node
//
// Spec M3-45 — verificación 2 (integración contra la BASE DE PRUEBAS): una OD010B de Kilroy (Iguazú, El
// Pueblito + Paquete 105 Premium de Cuenca del Plata) con el vuelo de llegada a las 23:50 y el de salida a
// las 15:00, con el catálogo y el directorio reales y la regla de data/traslados-nocturnos.csv:
// - el armado da el aviso de traslado nocturno de la llegada (no el de la salida) en el itinerario y como
//   aviso interno en el borrador a Cuenca del Plata; el texto al proveedor no cambia;
// - el bloque "Revisar antes de pedir" del detalle lo calcula con la sesión del equipo; sin sesión, nada (RLS).
// Lo que crea este archivo lleva `de_prueba = true` y se borra al final (solo lo suyo). No se envía nada (#4).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { cargarReglasItinerario } from "@/lib/pedidos/cargar";
import { avisosDelItinerarioDeLaReserva } from "@/lib/pedidos/itinerario-reserva";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { fichaDePrueba } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M3-45]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const NUMERO = `DK9345${String(Date.now()).slice(-3)}/test`;
const AVISO_LLEGADA =
  "Traslado nocturno (vuelo LA4410, llega 23:50): Cuenca del Plata lo hace solo en privado, con tarifa privada. Confirmar con la agencia antes de pedir.";

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-45.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-11-01T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

function ficha(): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: NUMERO, limpio: NUMERO.split("/")[0], confianza: 1 };
  f.productos = [
    { ...f.productos[0], nombre: "Iguazu Falls on a Shoestring - 4 Days - Start in Brazil", codigo: "HI_ARGENTINA_IGUAZU_BR_4DAYS-677", fecha_inicio: "2027-03-10", fecha_fin: null, habitacion: "Double Room - Hostel" },
  ];
  f.fecha_inicio = { valor: "2027-03-10", confianza: 1 };
  f.fecha_fin = { valor: null, confianza: 0 };
  f.vuelos = [
    { numero: "LA4410", aerolinea: "LATAM", origen: "GRU", destino: "IGU", fecha_salida: "2027-03-10", hora_salida: "21:30", fecha_llegada: "2027-03-10", hora_llegada: "23:50", confianza: 1 },
    { numero: "LA4411", aerolinea: "LATAM", origen: "IGU", destino: "GRU", fecha_salida: "2027-03-13", hora_salida: "15:00", fecha_llegada: "2027-03-13", hora_llegada: "16:45", confianza: 1 },
  ];
  return f;
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-45 — traslado nocturno de Cuenca del Plata, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let reservaId: string;

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
    const sesion = await crearSesionDePrueba();
    equipo = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
    const deps = await cargarDependenciasReservas(admin);
    const [c] = await crearReservasDelMail(ficha(), { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
    reservaId = c.reserva.id;
    const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", reservaId).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
    expect([fila.producto?.codigo, fila.estado]).toEqual(["OD010B", "recibida"]);
  }, 180_000);

  afterAll(async () => {
    await registro.limpiar(admin);
    await borrarSesion?.();
  }, 120_000);

  it("el armado avisa la llegada de las 23:50 (no la salida de las 15:00) y el borrador a Cuenca lo guarda", async () => {
    const sinRegla = await armarYGuardarPedidos(admin, reservaId, { itinerario: { ...cargarReglasItinerario(), trasladosNocturnos: [] } });
    if (!sinRegla.ok) throw new Error(sinRegla.error);
    const cuencaAntes = (await cargarPedidos(admin, reservaId)).pedidos.find((p) => p.destinatarios.some((m) => /cuencadelplata/i.test(m)))!;
    console.log(`[M3-45] ANTES (sin la regla): itinerario ${JSON.stringify(sinRegla.itinerario)}`);
    expect(sinRegla.itinerario.filter((a) => a.startsWith("Traslado nocturno"))).toEqual([]);

    const r = await armarYGuardarPedidos(admin, reservaId);
    if (!r.ok) throw new Error(r.error);
    console.log(`[M3-45] DESPUÉS: itinerario:\n  ${r.itinerario.join("\n  ")}`);
    expect(r.itinerario.filter((a) => a.startsWith("Traslado nocturno"))).toEqual([AVISO_LLEGADA]);
    const guardados = (await cargarPedidos(admin, reservaId)).pedidos;
    const cuenca = guardados.find((p) => p.destinatarios.some((m) => /cuencadelplata/i.test(m)))!;
    console.log(`[M3-45] borrador a ${cuenca.proveedores.join(", ")}: avisos ${JSON.stringify(cuenca.avisos)}`);
    expect(cuenca.avisos).toContain(AVISO_LLEGADA);
    expect(cuenca.cuerpo).toBe(cuencaAntes.cuerpo);
    for (const p of guardados.filter((x) => x !== cuenca)) expect(p.avisos).not.toContain(AVISO_LLEGADA);
  });

  it("el bloque del detalle lo calcula con la sesión del equipo; sin sesión, nada (RLS)", async () => {
    const r = await avisosDelItinerarioDeLaReserva(equipo, reservaId);
    if (!r.ok) throw new Error(r.error);
    expect(r.avisos.filter((a) => a.startsWith("Traslado nocturno"))).toEqual([AVISO_LLEGADA]);
    expect(await avisosDelItinerarioDeLaReserva(anonimo, reservaId)).toMatchObject({ ok: false, sinSesion: true });
  });
});
