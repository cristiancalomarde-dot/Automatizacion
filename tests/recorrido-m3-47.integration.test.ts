// @vitest-environment node
//
// Spec M3-47 — verificación 3 (regla #5): el recorrido. Una reserva como la real
// DK1587388 (Kilroy, HI_TRAVEL_BR18-677, 2 pax, Dormitory - Hostel, 28 ene → 4
// feb 2027) y otra igual en Hotel 3* llegan por el flujo de M2 (mail → lectura →
// emparejado → reserva, en modo prueba y con la IA FALSA: no gasta) contra la
// BASE DE PRUEBAS con BR18 cargado (catalogo-m3-47.integration.test.ts), quedan
// recibidas y arman los borradores y las tareas.
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

const CASOS = [
  { clave: "Dorm Hostel", numero: `DK93471${SUFIJO}/test`, habitacion: "Dormitory - Hostel", inicio: "2027-01-28", fin: "2027-02-04" },
  // Otra semana: con las mismas fechas y pax sería "posible duplicada" (y es correcto que lo sea).
  { clave: "Hotel 3*", numero: `DK93472${SUFIJO}/test`, habitacion: "Double Room - Hotel 3*", inicio: "2027-03-04", fin: "2027-03-11" },
];

function ficha({ numero, habitacion, inicio, fin }: (typeof CASOS)[number]) {
  const producto = { nombre: "Salvador and Chapada Diamantina Eco Adventure", codigo: "HI_TRAVEL_BR18-677", fecha_inicio: inicio, fecha_fin: fin, habitacion };
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

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-47 — recorrido: una BR18 de Kilroy, recibida y con sus pedidos", { timeout: 300_000 }, () => {
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
        messageId: `<m3-47-${randomUUID()}@prueba.hitravel.local>`,
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

  it.each(CASOS.map((c) => c.clave))("%s: entra recibida, con BR18 reconocido por su código Kilroy", (clave) => {
    const a = armadas.get(clave)!;
    expect([a.producto, a.estado, a.motivos]).toEqual(["BR18", "recibida", []]);
  });

  it("Dorm Hostel: el recorrido de la ficha §1, para 2 pasajeros", () => {
    const { pedidos, tareas } = armadas.get("Dorm Hostel")!;
    const textos = pedidos.map((p) => [p.destinatarios.join(","), [...p.cuerpo.matchAll(/IN: [^\n]+\nOUT: [^\n]+/g)].map((m) => m[0])]);
    expect(textos).toEqual([
      ["hi@laranjeirashostel.com.br", ["IN: 28 jan 2027\nOUT: 31 jan 2027 (3 noites)", "IN: 3 fev 2027\nOUT: 4 fev 2027 (1 noite)"]],
      ["contatobahiatransfer@gmail.com", []],
      ["alberguechapada@hotmail.com", ["IN: 31 jan 2027\nOUT: 3 fev 2027 (3 noites)"]],
    ]);
    const [, bahia] = pedidos;
    expect(bahia.cuerpo).toContain("Escrevemos da HI Travel");
    expect(bahia.cuerpo).toMatch(/Aeropuerto Salvador - Hostel Laranjeiras\n[^\n]*28 jan 2027/);
    expect(bahia.cuerpo).toMatch(/Hostel Laranjeiras - SSA Airport\n[^\n]*4 fev 2027/);
    // Owner (2026-11-03): los dos hostels no ofrecen desayuno.
    for (const p of [pedidos[0], pedidos[2]]) expect(p.cuerpo, p.destinatarios.join()).not.toMatch(/caf[eé] da manh|desayuno/i);
    for (const p of pedidos) expect(p.asunto, p.destinatarios.join()).toMatch(/ x 2 /);
    expect(tareas.map((t) => `${t.tipo}: ${t.texto.replace(/ \([^)]*\)/, "")}`)).toEqual([
      "whatsapp: Contactar por WhatsApp a Cassi Turismo: Praia do Forte full day, 30 ene 2027",
      "emitir_boleto: Emitir pasaje: Bus Salvador – Lençóis, 31 ene 2027",
      "whatsapp: Contactar por WhatsApp a Chapada Backpackers: Excursion Full Day Chapada 4 Ps, 1 feb 2027",
      "emitir_boleto: Emitir pasaje: Bus Lençóis – Salvador, 3 feb 2027",
    ]);
  });

  it("Hotel 3*: los hoteles del nivel, y el traslado llega a Pousada do Pilar", () => {
    const { pedidos } = armadas.get("Hotel 3*")!;
    expect(pedidos.map((p) => p.destinatarios.join(","))).toEqual(["info@pousadadopilar.com.br", "contatobahiatransfer@gmail.com", "terradosdiamantes@gmail.com"]);
    expect(pedidos[1].cuerpo).toContain("Pousada do Pilar - SSA Airport");
    // Los hoteles siguen con desayuno: la excepción es solo de los dos hostels.
    expect(pedidos[0].cuerpo).toContain("com café da manhã");
    expect(pedidos[2].cuerpo).toContain("com café da manhã");
  });
});
