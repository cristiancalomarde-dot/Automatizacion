// @vitest-environment node
//
// Spec M3-10 — verificación 3 (regla #5): el recorrido. Una reserva de ejemplo
// de cada uno de los 6 productos nuevos llega por el flujo de M2 (mail →
// lectura → emparejado → reserva, en modo prueba y con la IA FALSA: no gasta)
// contra la BASE DE PRUEBAS con el catálogo de M3-10 cargado
// (catalogo-m3-10.integration.test.ts), queda RECIBIDA (ya no "para revisión")
// y arma sus borradores de pedido (M3-01).
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
import { REMITENTE_STATEMENT_TOURRADAR } from "@/lib/reservas/filtro-entrada";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { procesarMail as procesarMailReal, type OpcionesProceso } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
/** Un sufijo por corrida: los números de reserva no chocan con otra corrida a medio borrar. */
const SUFIJO = String(Date.now()).slice(-4);

interface ProductoFicha {
  nombre: string;
  codigo: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  habitacion: string;
}

function ficha(agencia: string, numero: string, productos: ProductoFicha[]) {
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: agencia, confianza: 1 },
    numero_reserva: { valor: numero, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: productos.map((p) => ({ ...p, noches: null, punto_recogida: null, opcionales: [], confianza: 1 })),
    fecha_inicio: { valor: productos[0].fecha_inicio, confianza: 1 },
    fecha_fin: { valor: productos[productos.length - 1].fecha_fin, confianza: 1 },
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
    ...f.productos.map((p) => `${p.nombre} ${p.codigo ?? ""} from ${p.fecha_inicio}${p.fecha_fin ? ` to ${p.fecha_fin}` : ""} - ${p.habitacion}`),
    `Passengers (2): ${f.pasajeros.map((p) => `${p.nombre} ${p.apellido}, ${p.nacionalidad}, ${p.fecha_nacimiento}`).join("; ")}`,
  ].join("\n");
}

/** Los mails de ejemplo: lo que reservaron las agencias (spec §1), con fechas y habitaciones de prueba. */
const KILROY_CH11_AR34 = `DK93101${SUFIJO.slice(-2)}`;
const KILROY_OD014 = `DK93102${SUFIJO.slice(-2)}`;
const KILROY_EXP = `DK93103${SUFIJO.slice(-2)}`;
const TR_ARBR23 = `93104${SUFIJO.slice(-2)}`;
const TR_ARUY01 = `93105${SUFIJO.slice(-2)}`;

const MAILS = [
  {
    nombre: "Kilroy CH11 + AR34",
    remitente: "aarhus@kilroy.dk",
    asunto: `${KILROY_CH11_AR34}/test - 2 NEW BOOKINGS - KILROY booking request`,
    ficha: ficha("Kilroy", `${KILROY_CH11_AR34}/test`, [
      { nombre: "W-Trek Express + Puerto Natales (5 nights) Self Guided", codigo: "HI_ARGENTINA_W_TREK_CH_11-677", fecha_inicio: "2027-01-10", fecha_fin: "2027-01-15", habitacion: "Double Room - Hotel 3*" },
      { nombre: "El Chalten + El Calafate, Glaciers and Trekking", codigo: "HI_ARGENTINA_AR34-677", fecha_inicio: "2027-01-16", fecha_fin: "2027-01-21", habitacion: "Double Room - Budget Hotel" },
    ]),
  },
  {
    nombre: "Kilroy OD014",
    remitente: "aarhus@kilroy.dk",
    asunto: `${KILROY_OD014}/test - NEW BOOKING - KILROY booking request`,
    ficha: ficha("Kilroy", `${KILROY_OD014}/test`, [
      { nombre: "El Calafate & El Chalten full day - 4 nights", codigo: "HI_ARGENTINA_OD014-677", fecha_inicio: "2027-02-01", fecha_fin: "2027-02-05", habitacion: "Dormitory - Hostel" },
    ]),
  },
  {
    nombre: "Kilroy ARCH33EXP",
    remitente: "aarhus@kilroy.dk",
    asunto: `${KILROY_EXP}/test - NEW BOOKING - KILROY booking request`,
    ficha: ficha("Kilroy", `${KILROY_EXP}/test`, [
      { nombre: "Patagonia, Trekking Paradise with W-Trek EXPRESS", codigo: "HI_TRAVEL_ARCH_EXP-677", fecha_inicio: "2027-02-10", fecha_fin: "2027-02-20", habitacion: "Double Room - Hostel" },
    ]),
  },
  {
    nombre: "TourRadar ARBR23",
    remitente: REMITENTE_STATEMENT_TOURRADAR,
    asunto: `Booking Statement ${TR_ARBR23} - 1 - vendorbill`,
    ficha: ficha("TourRadar", TR_ARBR23, [
      { nombre: "Buenos Aires to Rio de Janeiro 12 Days", codigo: "150104", fecha_inicio: "2027-03-01", fecha_fin: null, habitacion: "DOUBLE Hostel" },
    ]),
  },
  {
    nombre: "TourRadar ARUY01",
    remitente: REMITENTE_STATEMENT_TOURRADAR,
    asunto: `Booking Statement ${TR_ARUY01} - 1 - vendorbill`,
    ficha: ficha("TourRadar", TR_ARUY01, [
      { nombre: "Argentina and Uruguay, heart of the River Plate (7 days)", codigo: "317766", fecha_inicio: "2027-03-10", fecha_fin: null, habitacion: "DOUBLE Hotel 3*" },
    ]),
  },
];

interface ReservaCreada {
  id: string;
  estado: string;
  producto: string | null;
  motivos: string[];
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-10 — recorrido: una reserva de cada producto nuevo, recibida y con sus pedidos", { timeout: 600_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  const reservas = new Map<string, ReservaCreada>();
  const llamadasIA: number[] = [];

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    deps = await cargarDependenciasReservas(admin);
    for (const m of MAILS) {
      const { cliente, create } = clienteFalso(respuestaCon(m.ficha));
      const { registro: uso } = registroFalso();
      const leer: OpcionesProceso["leer"] = (mail, ctx) =>
        leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
      const entrada: MailEntrada = {
        origen: "archivo",
        messageId: `<m3-10-${randomUUID()}@prueba.hitravel.local>`,
        remitente: m.remitente,
        asunto: m.asunto,
        cuerpoTexto: cuerpo(m.ficha),
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
      expect(r.estado, m.nombre).toBe("procesado");
      llamadasIA.push(create.mock.calls.length);
      if (r.estado !== "procesado") continue;
      for (const p of r.pedidos) {
        const { data, error } = await admin
          .from("reserva")
          .select("id, estado, motivos_revision, producto:producto_id(codigo)")
          .eq("id", p.reservaId)
          .single();
        if (error) throw new Error(error.message);
        const fila = data as unknown as { id: string; estado: string; motivos_revision: string[] | null; producto: { codigo: string } | null };
        const motivos = fila.motivos_revision ?? [];
        reservas.set(fila.producto?.codigo ?? `${m.nombre} sin producto`, { id: fila.id, estado: fila.estado, producto: fila.producto?.codigo ?? null, motivos });
      }
    }
  }, 600_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  it("cada mail se lee una vez (IA falsa) y deja su reserva con el producto del catálogo", () => {
    expect(llamadasIA).toEqual([1, 1, 1, 1, 1]);
    expect([...reservas.keys()].sort()).toEqual(["AR34", "ARBR23", "ARCH33EXP", "ARUY01", "CH11", "OD014"]);
  });

  it("las 6 quedan recibidas, no para revisión", () => {
    for (const [codigo, r] of reservas) expect({ codigo, estado: r.estado, motivos: r.motivos }).toEqual({ codigo, estado: "recibida", motivos: [] });
  });

  it("cada una arma sus borradores; las únicas tareas son las que avisa el reporte (boletos que emite HI Travel, Oxford sin mail)", async () => {
    const resumen: Record<string, { casillas: string[]; tareas: string[]; sinDestinatario: string[] }> = {};
    let oxford = "";
    for (const [codigo, r] of reservas) {
      const armado = await armarYGuardarPedidos(admin, r.id);
      if (!armado.ok) throw new Error(`${codigo}: ${armado.error}`);
      const guardado = await cargarPedidos(admin, r.id);
      expect(guardado.pedidos.length, codigo).toBe(armado.pedidos.length);
      expect(guardado.pedidos.every((p) => p.estado === "borrador" && p.de_prueba), codigo).toBe(true);
      resumen[codigo] = {
        casillas: armado.pedidos.map((p) => p.destinatarios.join(",") || "(sin mail)").sort(),
        tareas: armado.tareas.map((t) => `${t.tipo}: ${t.texto.replace(/, (IN )?\d+ \w+ \d{4}.*$/, "")}`),
        sinDestinatario: armado.pedidos.filter((p) => p.sinDestinatario).map((p) => p.sinDestinatario!),
      };
      oxford ||= armado.tareas.find((t) => t.texto.includes("Hotel Oxford"))?.texto ?? "";
    }
    expect(resumen.CH11.casillas).toEqual(["carmen.munoz@lastorres.com", "reservas@hotelbigsur.cl"]);
    expect(resumen.CH11.tareas).toEqual([]);
    expect(resumen.AR34.casillas).toEqual(["agencias@chaltentravel.com", "hosteriakausiaike@gmail.com", "reservas@glaciar.com"]);
    expect(resumen.AR34.tareas).toEqual([]);
    expect(resumen.OD014.casillas).toEqual(["agencias@chaltentravel.com", "contacto@southroad.com.ar,bue@southroad.com.ar", "reservas@glaciar.com"]);
    expect(resumen.OD014.tareas).toEqual([]);
    expect(resumen.ARCH33EXP.tareas).toEqual(["emitir_boleto: Emitir boleto: El Calafate – Puerto Natales", "emitir_boleto: Emitir boleto: Bus Puerto Natales – Punta Arenas"]);
    expect(resumen.ARCH33EXP.casillas).toEqual(["agencias@chaltentravel.com", "carmen.munoz@lastorres.com", "info@pumahouse.com", "reservas@glaciar.com"]);
    expect(resumen.ARBR23.casillas).toEqual([
      "beerhotel@tangoinn.com,beerhotel@cervezaholy.com",
      "buziostransfer@hotmail.com",
      "info@greetersba.com",
      "melina@milhousehostel.com",
      "perez@local55.com",
      "reservas8@cuencadelplata.com",
      "reservas@gruposumma.tur.ar",
      "reservas@maderotango.com.ar",
    ]);
    expect(resumen.ARBR23.tareas).toEqual(["emitir_boleto: Emitir boleto: Buenos Aires – Iguazú", "emitir_boleto: Emitir boleto: Iguazú – Río de Janeiro"]);
    expect(resumen.ARUY01.tareas).toEqual([
      "emitir_boleto: Emitir boleto: Ferry Buenos Aires – Colonia del Sacramento",
      "emitir_boleto: Emitir boleto: Bus regular Colonia - Montevideo (terminal de buses Tres Cruces)",
      "revisar: Pedir a mano: Hotel Oxford Montevideo (OD040)",
    ]);
    expect(resumen.ARUY01.casillas).toEqual([
      "info@greetersba.com",
      "natalyp@viajerohostels.com,dfarinati@viajerohostels.com",
      "operaciones@dcomtravel.com,macarena.perez@dcomtravel.com",
      "reservas@dazzlermaipu.com",
      "reservas@gruposumma.tur.ar",
      "reservas@maderotango.com.ar",
    ]);
    expect(oxford).toMatch(/^Pedir a mano: Hotel Oxford Montevideo \(OD040\), IN 14 mar 2027, OUT 16 mar 2027\. .*Sin mail: pedilo a mano/);
    // Ningún otro "revisar a mano" en ninguno de los 6.
    const revisar = Object.entries(resumen).flatMap(([c, r]) => r.tareas.filter((t) => t.startsWith("revisar")).map((t) => `${c} ${t}`));
    expect(revisar).toHaveLength(1);
    for (const r of Object.values(resumen)) expect(r.sinDestinatario).toEqual([]);
  });

  it("AR34 pide cada estadía a su proveedor con sus fechas, el Perito Moreno el día 5 y avisa que el Fitz Camp es opcional", async () => {
    const r = reservas.get("AR34")!;
    const armado = await armarYGuardarPedidos(admin, r.id);
    if (!armado.ok) throw new Error(armado.error);
    const kau = armado.pedidos.find((p) => p.destinatarios.includes("hosteriakausiaike@gmail.com"))!;
    expect(kau.cuerpo).toContain("IN: 16 ene 2027");
    expect(kau.cuerpo).toContain("OUT: 19 ene 2027 (3 noches)");
    const glaciar = armado.pedidos.find((p) => p.destinatarios.includes("reservas@glaciar.com"))!;
    expect(glaciar.cuerpo).toContain("IN: 19 ene 2027");
    expect(glaciar.cuerpo).toContain("OUT: 21 ene 2027 (2 noches)");
    const chalten = armado.pedidos.find((p) => p.destinatarios.includes("agencias@chaltentravel.com"))!;
    expect(chalten.cuerpo).toMatch(/Perito Moreno Glaciar Excursion\nFecha: 20 ene 2027/);
    expect(armado.avisos.join(" ")).toMatch(/2nd Night at Fitz Camp.*opcional/);
  });
});
