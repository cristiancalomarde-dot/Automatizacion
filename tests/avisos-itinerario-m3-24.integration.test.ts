// @vitest-environment node
//
// Spec M3-24 — verificación 2 (integración contra la BASE DE PRUEBAS): una AR10 como la #1389186
// (2 pax, DBL Hostel, salida 19 dic 2026) llega por el flujo de M2 (statement de TourRadar, IA FALSA:
// no gasta), queda recibida y, con el catálogo real y las reglas de data/blackouts.csv,
// data/fechas-especiales.csv y data/dias-bus.csv:
// - el armado da los tres avisos del itinerario (Navidad en Bodegas y Alta Montaña, el bus Río
//   Gallegos → Ushuaia del martes 5 ene) y los guarda como aviso interno en el borrador a Huentata;
// - sin las reglas, el armado queda como antes (se imprime el antes y el después);
// - el bloque del detalle los calcula con la sesión del equipo; sin sesión, nada (RLS).
// Mails y pasajeros sintéticos; todo lleva la marca de prueba y se borra al terminar (solo lo suyo).
// No se envía nada (#4).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { SIN_REGLAS } from "@/lib/pedidos/itinerario";
import { avisosDelItinerarioDeLaReserva } from "@/lib/pedidos/itinerario-reserva";
import { clienteFalso, registroFalso, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { REMITENTE_STATEMENT_TOURRADAR } from "@/lib/reservas/filtro-entrada";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { procesarMail as procesarMailReal } from "@/lib/reservas/procesar-mail";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
const NUMERO = `9124${String(Date.now()).slice(-3)}`;

const NAVIDAD_BODEGAS = /^Bodegas[^\n]* \(Mendoza\) cae jueves 24 dic 2026, Navidad: confirmá con el proveedor que opera\.$/;
const NAVIDAD_ALTA = /^Alta Montaña[^\n]* \(Mendoza\) cae viernes 25 dic 2026, Navidad: confirmá con el proveedor que opera\.$/;
const BUS_RGL = "El bus Río Gallegos → Ushuaia cae martes 5 ene 2027; según la planilla sale lun/mié/vie.";

/** La ficha de lectura (M2-02) de un statement de TourRadar de AR10, como la #1389186 (datos inventados). */
function ficha() {
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "TourRadar", confianza: 1 },
    numero_reserva: { valor: NUMERO, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [
      { nombre: "Full Argentina Adventure – 21 Days", codigo: null, fecha_inicio: "2026-12-19", fecha_fin: null, habitacion: "Double Hostel", noches: null, punto_recogida: null, opcionales: [], confianza: 1 },
    ],
    fecha_inicio: { valor: "2026-12-19", confianza: 1 },
    fecha_fin: { valor: null, confianza: 0 },
    pax: { valor: 2, confianza: 1 },
    pasajeros: [
      { nombre: "Ana", apellido: "Prueba", nacionalidad: "Australia", fecha_nacimiento: "1990-05-17", confianza: 1 },
      { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Australia", fecha_nacimiento: "1991-02-03", confianza: 1 },
    ],
    vuelos: [],
    hoteles_agencia: [],
    todos_hoteles_agencia: { valor: false, confianza: 1 },
    pedidos_especiales: [],
    pdf_ilegible: false,
    aviso: null,
  };
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-24 — avisos del itinerario, en la base de pruebas", { timeout: 600_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let soltarBloqueo: () => void;
  let reservaId: string;

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
    const sesion = await crearSesionDePrueba();
    equipo = sesion.cliente;
    borrarSesion = sesion.borrar;

    const f = ficha();
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const deps = await cargarDependenciasReservas(admin);
    const r = await procesarMail(
      {
        origen: "archivo",
        messageId: `<m3-24-${randomUUID()}@prueba.hitravel.local>`,
        remitente: REMITENTE_STATEMENT_TOURRADAR,
        asunto: `Booking Statement ${NUMERO} - 1 - vendorbill`,
        cuerpoTexto: `Mail sintético de prueba (sin datos de nadie).\nBooking ${NUMERO}\n2 Full Argentina Adventure – 21 Days from 2026-12-19 - 2 Double Hostel`,
        adjuntos: [],
        dePrueba: true,
      },
      {
        admin,
        leer: (mail, ctx) => {
          registro.mail(ctx.mailRecibidoId);
          return leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
        },
        deps: () => deps,
        llamadas: crearRegistroLlamadasSupabase(admin),
        dePrueba: true,
        alcance: () => registro.mails,
      },
    );
    if (r.estado !== "procesado") throw new Error(`El statement no se procesó: ${r.estado}`);
    reservaId = r.pedidos[0].reservaId;
    const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", reservaId).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
    expect([fila.producto?.codigo, fila.estado]).toEqual(["AR10", "recibida"]);
  }, 600_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
      await borrarSesion?.();
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  it("el armado da los tres avisos en orden de fecha y el borrador a Huentata guarda los dos de Navidad", async () => {
    const antes = await armarYGuardarPedidos(admin, reservaId, { itinerario: SIN_REGLAS });
    if (!antes.ok) throw new Error(antes.error);
    const huentataAntes = (await cargarPedidos(admin, reservaId)).pedidos.find((p) => p.proveedores.some((x) => /huentata/i.test(x)))!;
    console.log(`[M3-24] ANTES (sin las reglas): itinerario ${JSON.stringify(antes.itinerario)}; avisos del borrador a Huentata ${JSON.stringify(huentataAntes.avisos)}`);
    expect(antes.itinerario).toEqual([]);

    const r = await armarYGuardarPedidos(admin, reservaId);
    if (!r.ok) throw new Error(r.error);
    console.log(`[M3-24] DESPUÉS: itinerario:\n  ${r.itinerario.join("\n  ")}`);
    expect(r.itinerario).toHaveLength(3);
    expect(r.itinerario[0]).toMatch(NAVIDAD_BODEGAS);
    expect(r.itinerario[1]).toMatch(NAVIDAD_ALTA);
    expect(r.itinerario[2]).toBe(BUS_RGL);

    const guardados = (await cargarPedidos(admin, reservaId)).pedidos;
    const huentata = guardados.find((p) => p.proveedores.some((x) => /huentata/i.test(x)))!;
    console.log(`[M3-24] DESPUÉS: avisos del borrador a Huentata ${JSON.stringify(huentata.avisos)}`);
    expect(huentata.avisos.filter((a) => NAVIDAD_BODEGAS.test(a) || NAVIDAD_ALTA.test(a))).toHaveLength(2);
    // Lo que no es de Huentata no lleva avisos del itinerario; y el texto al proveedor no cambia.
    for (const p of guardados.filter((x) => x !== huentata)) expect(p.avisos.filter((a) => r.itinerario.includes(a))).toEqual([]);
    expect(huentata.cuerpo).toBe(huentataAntes.cuerpo);
    expect(huentata.cuerpo).not.toMatch(/Navidad/);
    expect(huentataAntes.avisos.filter((a) => /Navidad/.test(a))).toEqual([]);
    expect(r.tareas).toEqual(antes.tareas);
  });

  it("el bloque del detalle los calcula con la sesión del equipo, sin escribir nada", async () => {
    const { count: antes } = await admin.from("reserva_pedido").select("id", { count: "exact", head: true }).eq("reserva_id", reservaId);
    const r = await avisosDelItinerarioDeLaReserva(equipo, reservaId);
    if (!r.ok) throw new Error(r.error);
    expect(r.avisos).toHaveLength(3);
    expect(r.avisos[0]).toMatch(NAVIDAD_BODEGAS);
    expect(r.avisos[2]).toBe(BUS_RGL);
    const { count: despues } = await admin.from("reserva_pedido").select("id", { count: "exact", head: true }).eq("reserva_id", reservaId);
    expect(despues).toBe(antes);
  });

  it("sin sesión no se calcula nada (RLS) y un id que no existe no devuelve avisos", async () => {
    expect(await avisosDelItinerarioDeLaReserva(anonimo, reservaId)).toMatchObject({ ok: false, sinSesion: true });
    expect(await avisosDelItinerarioDeLaReserva(equipo, randomUUID())).toEqual({ ok: false, error: "No existe la reserva." });
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("reserva_id", reservaId);
    expect(pedidos.data ?? []).toEqual([]);
  });
});
