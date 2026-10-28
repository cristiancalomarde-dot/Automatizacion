// @vitest-environment node
//
// Spec M3-12 — verificación 3 (regla #5): el recorrido. Dos reservas de Kilroy
// de Iguazú llegan por el flujo de M2 (mail → lectura → emparejado → reserva,
// en modo prueba y con la IA FALSA: no gasta) contra la BASE DE PRUEBAS,
// quedan recibidas y arman el borrador a Cuenca del Plata con el hotel de cada
// día y como 105 Premium: OD010B (el código real de Kilroy "Start in Brazil",
// Foz) y OD010D (combinado: dos noches en Foz y la tercera en Puerto Iguazú;
// el día del cruce, pick up en un hotel y drop off en el otro).
//
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9).
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { clienteFalso, registroFalso, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { procesarMail as procesarMailReal, type OpcionesProceso } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
/** Un sufijo por corrida: los números de reserva no chocan con otra corrida a medio borrar. */
const SUFIJO = String(Date.now()).slice(-2);

function ficha(numero: string, nombre: string, codigo: string, habitacion: string, fecha_inicio: string, fecha_fin: string) {
  const producto = { nombre, codigo, fecha_inicio, fecha_fin, habitacion };
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "Kilroy", confianza: 1 },
    numero_reserva: { valor: numero, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [{ ...producto, noches: null, punto_recogida: null, opcionales: [], confianza: 1 }],
    fecha_inicio: { valor: producto.fecha_inicio, confianza: 1 },
    fecha_fin: { valor: producto.fecha_fin, confianza: 1 },
    pax: { valor: 2, confianza: 1 },
    pasajeros: [
      { nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17", confianza: 1 },
      { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03", confianza: 1 },
    ],
    vuelos: [],
    hoteles_agencia: [],
    todos_hoteles_agencia: { valor: false, confianza: 1 },
    pedidos_especiales: [],
    pdf_ilegible: false,
    aviso: null,
  };
}

/** El texto del mail sintético: lo que la IA "leyó" tiene que estar escrito (los controles de M2-02). */
function cuerpo(f: ReturnType<typeof ficha>): string {
  return [
    "Mail sintético de prueba (sin datos de nadie).",
    `Booking ${f.numero_reserva.valor}`,
    ...f.productos.map((p) => `${p.nombre} ${p.codigo} from ${p.fecha_inicio} to ${p.fecha_fin} - ${p.habitacion}`),
    `Passengers (2): ${f.pasajeros.map((p) => `${p.nombre} ${p.apellido}, ${p.nacionalidad}, ${p.fecha_nacimiento}`).join("; ")}`,
  ].join("\n");
}

const MAILS = [
  {
    clave: "OD010B",
    numero: `DK93131${SUFIJO}/test`,
    nombre: "Iguazu Falls on a Shoestring - 4 Days - Start in Brazil",
    codigo: "HI_ARGENTINA_IGUAZU_BR_4DAYS-677",
    habitacion: "Double Room - Hostel",
    inicio: "2027-04-10",
    fin: "2027-04-13",
  },
  {
    clave: "OD010D",
    numero: `DK93132${SUFIJO}/test`,
    nombre: "Iguazu Falls Combined - Start in Brazil",
    codigo: "HI_ARGENTINA_OD010D-677",
    habitacion: "Double Room - Hostel",
    inicio: "2027-05-10",
    fin: "2027-05-13",
  },
];

const renglon = (cuerpo: string, empieza: string) => cuerpo.split("\n").find((l) => l.startsWith(empieza)) ?? "";

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-12 — recorrido: Iguazú de Kilroy llega por mail y el pedido a Cuenca del Plata lleva el hotel de cada día", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  const reservas = new Map<string, { id: string; estado: string; producto: string | null }>();

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    deps = await cargarDependenciasReservas(admin);
    for (const m of MAILS) {
      const f = ficha(m.numero, m.nombre, m.codigo, m.habitacion, m.inicio, m.fin);
      const { cliente } = clienteFalso(respuestaCon(f));
      const { registro: uso } = registroFalso();
      const leer: OpcionesProceso["leer"] = (mail, ctx) =>
        leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
      const entrada: MailEntrada = {
        origen: "archivo",
        messageId: `<m3-12-${randomUUID()}@prueba.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${m.numero} - NEW BOOKING - KILROY booking request`,
        cuerpoTexto: cuerpo(f),
        adjuntos: [],
        dePrueba: true,
      };
      const r = await procesarMail(entrada, {
        admin,
        leer: (mail, ctx) => {
          registro.mail(ctx.mailRecibidoId);
          return leer(mail, ctx);
        },
        deps: () => deps,
        llamadas: crearRegistroLlamadasSupabase(admin),
        dePrueba: true,
        alcance: () => registro.mails,
      });
      expect(r.estado, m.clave).toBe("procesado");
      if (r.estado !== "procesado") continue;
      for (const p of r.pedidos) {
        const { data, error } = await admin.from("reserva").select("id, estado, producto:producto_id(codigo)").eq("id", p.reservaId).single();
        if (error) throw new Error(error.message);
        const fila = data as unknown as { id: string; estado: string; producto: { codigo: string } | null };
        reservas.set(m.clave, { id: fila.id, estado: fila.estado, producto: fila.producto?.codigo ?? null });
      }
    }
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  async function pedidoCuenca(clave: string) {
    const r = reservas.get(clave)!;
    const armado = await armarYGuardarPedidos(admin, r.id);
    if (!armado.ok) throw new Error(armado.error);
    const guardado = await cargarPedidos(admin, r.id);
    const p = guardado.pedidos.find((x) => x.cuerpo.includes("TRF IN"))!;
    expect(p.destinatarios).toEqual(["reservas8@cuencadelplata.com"]);
    expect(p.estado).toBe("borrador");
    return p.cuerpo;
  }

  it("las dos reservas quedan recibidas con su producto", () => {
    expect([...reservas.entries()].map(([k, r]) => [k, r.producto, r.estado])).toEqual([
      ["OD010B", "OD010B", "recibida"],
      ["OD010D", "OD010D", "recibida"],
    ]);
  });

  it("OD010B: el borrador a Cuenca del Plata es el 105 Premium y lleva Bambu Hostel Foz en cada renglón", async () => {
    const c = await pedidoCuenca("OD010B");
    const hotel = "Bambu Hostel Foz (Iguazú) · hotel a confirmar";
    expect(c).toContain("Paquete 105 Premium x Foz");
    // M3-28 (owner, 2026-10-28): en el 105 Premium los transfers no dicen "regular".
    expect(renglon(c, "TRF IN")).toBe(`TRF IN: 10 abr 2027 · Bus o vuelo pendiente · Drop off: ${hotel}`);
    expect(renglon(c, "Lado argentino")).toBe(`Lado argentino, Premium, en inglés: 11 abr 2027 · Pick up y drop off: ${hotel}`);
    expect(renglon(c, "Lado brasileño")).toBe(`Lado brasileño, Premium, en inglés: 12 abr 2027 · Pick up y drop off: ${hotel}`);
    expect(renglon(c, "TRF OUT")).toBe(`TRF OUT: 13 abr 2027 · Bus o vuelo pendiente · Pick up: ${hotel}`);
  });

  it("OD010D: el día del cruce, pick up en Bambu Foz y drop off en Beer Hostel (Puerto Iguazú)", async () => {
    const c = await pedidoCuenca("OD010D");
    const foz = "Bambu Foz (Foz do Iguaçu) · hotel a confirmar";
    const beer = "Beer Hostel (Puerto Iguazú) · hotel a confirmar";
    expect(renglon(c, "TRF IN")).toBe(`TRF IN: 10 may 2027 · Bus o vuelo pendiente · Drop off: ${foz}`);
    expect(renglon(c, "Lado brasileño")).toBe(`Lado brasileño, Premium, en inglés: 11 may 2027 · Pick up y drop off: ${foz}`);
    expect(renglon(c, "Lado argentino")).toBe(`Lado argentino, Premium, en inglés: 12 may 2027 · Pick up: ${foz} · Drop off: ${beer}`);
    expect(c).toContain("Ese día cruzan: el drop off es en el hotel de Argentina.");
    expect(renglon(c, "TRF OUT")).toBe(`TRF OUT: 13 may 2027 · Bus o vuelo pendiente · Pick up: ${beer}`);
  });
});
