// @vitest-environment node
//
// Spec M3-48 — verificación 3 (regla #5): el recorrido. Una reserva como la BR04
// real (Kilroy, HI_TRAVEL_BR04-677, 2 pax, Dormitory - Hostel, 26 may → 9 jun
// 2027), otra igual en Hotel 3* y una BR03 llegan por el flujo de M2 (mail →
// lectura → emparejado → reserva, en modo prueba y con la IA FALSA: no gasta)
// contra la BASE DE PRUEBAS con BR03 y BR04 cargados
// (catalogo-m3-48.integration.test.ts), quedan recibidas y arman borradores y tareas.
//
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9).
// Lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos, type PedidoGuardado, type TareaGuardada } from "@/lib/pedidos/guardar";
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
const SUFIJO = String(Date.now()).slice(-2);

const BR03 = { tour: "BR03", kilroy: "HI_TRAVEL_BR03-677", nombre: "Rio, Paraty and Ilha Grande" };
const BR04 = { tour: "BR04", kilroy: "HI_TRAVEL_BR04-677", nombre: "Iguazu Falls to Rio + Paraty and Ilha Grande" };
const CASOS = [
  { clave: "BR04 Dorm Hostel", ...BR04, numero: `DK93481${SUFIJO}/test`, habitacion: "Dormitory - Hostel", inicio: "2027-05-26", fin: "2027-06-09" },
  // Otra semana: con las mismas fechas y pax sería "posible duplicada" (y es correcto que lo sea).
  { clave: "BR04 Hotel 3*", ...BR04, numero: `DK93482${SUFIJO}/test`, habitacion: "Double Room - Hotel 3*", inicio: "2027-07-07", fin: "2027-07-21" },
  // Owner 2026-11-03: el Budget de Foz en BR04 es el Nacional Inn Foz 3* (306), no el Budget de OD010B.
  { clave: "BR04 Budget", ...BR04, numero: `DK93484${SUFIJO}/test`, habitacion: "Double Room - Budget Hotel", inicio: "2027-08-04", fin: "2027-08-18" },
  { clave: "BR03 Single Hostel", ...BR03, numero: `DK93483${SUFIJO}/test`, habitacion: "Single Room - Hostel", inicio: "2027-03-03", fin: "2027-03-11" },
];

function ficha({ kilroy, nombre, numero, habitacion, inicio, fin }: (typeof CASOS)[number]) {
  const producto = { nombre, codigo: kilroy, fecha_inicio: inicio, fecha_fin: fin, habitacion };
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "Kilroy", confianza: 1 },
    numero_reserva: { valor: numero, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [{ ...producto, noches: null, punto_recogida: null, opcionales: [], confianza: 1 }],
    fecha_inicio: { valor: inicio, confianza: 1 },
    fecha_fin: { valor: fin, confianza: 1 },
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

interface Armada {
  estado: string;
  producto: string | null;
  motivos: string[];
  pedidos: PedidoGuardado[];
  tareas: TareaGuardada[];
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-48 — recorrido: BR03 y BR04 de Kilroy, recibidas y con sus pedidos", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  const armadas = new Map<string, Armada>();

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    deps = await cargarDependenciasReservas(admin);
    for (const c of CASOS) {
      const f = ficha(c);
      const { cliente } = clienteFalso(respuestaCon(f));
      const { registro: uso } = registroFalso();
      const leer: OpcionesProceso["leer"] = (mail, ctx) =>
        leerMailConIA(mail, { cliente, registro: uso, mes: "2026-11", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
      const entrada: MailEntrada = {
        origen: "archivo",
        messageId: `<m3-48-${randomUUID()}@prueba.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${c.numero} - NEW BOOKING - KILROY booking request`,
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
      expect(r.estado, c.clave).toBe("procesado");
      if (r.estado !== "procesado") continue;
      const id = r.pedidos[0].reservaId;
      const { data, error } = await admin.from("reserva").select("estado, motivos_revision, producto:producto_id(codigo)").eq("id", id).single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { estado: string; motivos_revision: string[] | null; producto: { codigo: string } | null };
      const armado = await armarYGuardarPedidos(admin, id);
      if (!armado.ok) throw new Error(`${c.clave}: ${armado.error} (${(fila.motivos_revision ?? []).join(" | ")})`);
      armadas.set(c.clave, { estado: fila.estado, producto: fila.producto?.codigo ?? null, motivos: fila.motivos_revision ?? [], ...(await cargarPedidos(admin, id)) });
    }
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  it.each(CASOS.map((c) => [c.clave, c.tour]))("%s: entra recibida, con %s reconocido por su código Kilroy", (clave, tour) => {
    const a = armadas.get(clave)!;
    expect([a.producto, a.estado, a.motivos]).toEqual([tour, "recibida", []]);
  });

  it("BR04 Dorm Hostel: los pedidos y las tareas, para 2 pasajeros", () => {
    const { pedidos, tareas } = armadas.get("BR04 Dorm Hostel")!;
    expect(pedidos.map((p) => p.destinatarios.join(","))).toEqual([
      "hostelsbambu@gmail.com",
      "reservas8@cuencadelplata.com",
      "reservas@paratytours.com.br",
      "reservas@holandeshostel.com.br",
      "perez@local55.com",
      "buziostransfer@hotmail.com",
    ]);
    expect(pedidos.filter((p) => p.sin_destinatario)).toEqual([]);
    for (const p of pedidos) expect(p.asunto, p.destinatarios.join()).toMatch(/ x 2 /);
    expect(tareas.map((t) => `${t.tipo}: ${t.texto}`)).toEqual([
      "emitir_boleto: Emitir pasaje: Bus Foz do Iguaçu – São Paulo Barra Funda, en Plataforma10, 29 may 2027",
      expect.stringMatching(/^whatsapp: Contactar por WhatsApp a Fujima Hostel.*IN 30 may 2027, OUT 1 jun 2027/),
      "emitir_boleto: Emitir pasaje: Bus São Paulo Tietê – Paraty, en Plataforma10, 1 jun 2027",
      "reservar_a_mano: Reservar a mano en Che Lagarto: Che Lagarto (dorm compartido), IN 1 jun 2027, OUT 3 jun 2027. Si no hay lugar: Casa do Rio, Casa Viva, Agatha",
    ]);
  });

  it("BR04 Hotel 3*: el 3* de cada destino, también el Nacional Inn Foz de la tabla de costos (no el Budget de OD010B)", () => {
    const { pedidos, tareas } = armadas.get("BR04 Hotel 3*")!;
    const cuerpos = pedidos.map((p) => p.cuerpo).join("\n");
    const hoteles = [...cuerpos.matchAll(/(?:Hospedagem|Alojamiento): ([^\n]+)/g)].map((m) => m[1]);
    const whatsapp = tareas.filter((t) => t.tipo === "whatsapp").map((t) => t.texto).join(" ");
    expect(hoteles).toEqual(["Nacional Inn Foz 3*", "National Inn Copacabana", "Soos Hotel Collection", "Pousada do Corsario Paraty", "Pousada Aquarela do Mar"]);
    expect(whatsapp).toBe("");
    expect(tareas.some((t) => t.tipo === "reservar_a_mano")).toBe(false);
    expect(pedidos.find((p) => p.destinatarios.includes("reservasparaty@pousadacorsario.com.br"))!.cuerpo).toContain("com café da manhã");
  });

  it("BR04 Budget: los mismos hoteles que Hotel 3*: en Foz el Nacional Inn Foz 3*, no el Dann Inn", () => {
    const { pedidos } = armadas.get("BR04 Budget")!;
    const hoteles = [...pedidos.map((p) => p.cuerpo).join("\n").matchAll(/(?:Hospedagem|Alojamiento): ([^\n]+)/g)].map((m) => m[1]);
    expect(hoteles).toEqual(["Nacional Inn Foz 3*", "National Inn Copacabana", "Soos Hotel Collection", "Pousada do Corsario Paraty", "Pousada Aquarela do Mar"]);
    expect(pedidos.map((p) => p.cuerpo).join("\n")).not.toContain("Dann Inn");
  });

  it("BR03 Single Hostel: Río, Che Lagarto a mano, Holandes y los tres traslados con Paraty Tours", () => {
    const { pedidos, tareas } = armadas.get("BR03 Single Hostel")!;
    const paraty = pedidos.find((p) => p.destinatarios.includes("reservas@paratytours.com.br"))!.cuerpo;
    expect(paraty).toContain("Transfer: Rio de Janeiro – Paraty\nData: 6 mar 2027");
    expect(paraty).toContain("Transfer: Paraty – Ilha Grande\nData: 8 mar 2027");
    expect(paraty).toContain("Transfer: Ilha Grande – Rio de Janeiro\nData: 11 mar 2027");
    expect(paraty.match(/Transfer: /g)).toHaveLength(3);
    expect(tareas.filter((t) => t.tipo === "reservar_a_mano").map((t) => t.texto)).toEqual([expect.stringMatching(/^Reservar a mano en Che Lagarto: Che Lagarto \(.*\), IN 6 mar 2027, OUT 8 mar 2027\. Si no hay lugar: Casa do Rio, Casa Viva, Agatha$/)]);
    expect(pedidos.find((p) => p.destinatarios.includes("reservas@holandeshostel.com.br"))!.cuerpo).toContain("IN: 8 mar 2027\nOUT: 11 mar 2027 (3 noites)");
  });
});
