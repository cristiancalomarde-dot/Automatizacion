// @vitest-environment node
//
// Spec M3-23 — verificación 3 (regla #5): el recorrido. Dos reservas de
// ejemplo de AR10 (2 pax, salida 19 dic 2026: DBL Hostel como la #1389186 y
// DBL Hotel 3*) llegan por el flujo de M2 (statement de TourRadar → lectura →
// emparejado por el nombre → reserva, en modo prueba y con la IA FALSA: no
// gasta) contra la BASE DE PRUEBAS con AR10 cargado
// (catalogo-m3-23.integration.test.ts), quedan RECIBIDAS y arman sus
// borradores de pedido (M3-01).
//
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9).
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
// Con M3_23_MUESTRA=<archivo> deja los pedidos armados en ese archivo (para el reporte).
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos } from "@/lib/pedidos/guardar";
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
const SUFIJO = String(Date.now()).slice(-2);

function ficha(numero: string, habitacion: string) {
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "TourRadar", confianza: 1 },
    numero_reserva: { valor: numero, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    // El statement no trae el número de tour: se reconoce por el nombre (data/codigos-tourradar.csv).
    productos: [
      { nombre: "Full Argentina Adventure – 21 Days", codigo: null, fecha_inicio: "2026-12-19", fecha_fin: null, habitacion, noches: null, punto_recogida: null, opcionales: [], confianza: 1 },
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

function cuerpo(f: ReturnType<typeof ficha>): string {
  return [
    "Mail sintético de prueba (sin datos de nadie).",
    `Booking ${f.numero_reserva.valor}`,
    ...f.productos.map((p) => `2 ${p.nombre} from ${p.fecha_inicio} - 2 ${p.habitacion}`),
    `Passengers (2): ${f.pasajeros.map((p) => `${p.nombre} ${p.apellido}, ${p.nacionalidad}, ${p.fecha_nacimiento}`).join("; ")}`,
  ].join("\n");
}

const CASOS = [
  { clave: "DBL Hostel", numero: `9138${SUFIJO}1`, habitacion: "Double Hostel" },
  { clave: "DBL Hotel 3*", numero: `9138${SUFIJO}2`, habitacion: "Double Hotel 3*" },
];

interface Armado {
  id: string;
  estado: string;
  producto: string | null;
  motivos: string[];
  pedidos: Array<{ destinatarios: string[]; asunto: string; cuerpo: string; avisos: string[]; sinDestinatario: string | null }>;
  tareas: string[];
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-23 — recorrido: AR10 por TourRadar, recibida y con sus pedidos", { timeout: 600_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  const armados = new Map<string, Armado>();

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    deps = await cargarDependenciasReservas(admin);
    for (const c of CASOS) {
      const f = ficha(c.numero, c.habitacion);
      const { cliente } = clienteFalso(respuestaCon(f));
      const { registro: uso } = registroFalso();
      const leer: OpcionesProceso["leer"] = (mail, ctx) =>
        leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
      const entrada: MailEntrada = {
        origen: "archivo",
        messageId: `<m3-23-${randomUUID()}@prueba.hitravel.local>`,
        remitente: REMITENTE_STATEMENT_TOURRADAR,
        asunto: `Booking Statement ${c.numero} - 1 - vendorbill`,
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
      const { data, error } = await admin
        .from("reserva")
        .select("id, estado, motivos_revision, producto:producto_id(codigo)")
        .eq("id", r.pedidos[0].reservaId)
        .single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { id: string; estado: string; motivos_revision: string[] | null; producto: { codigo: string } | null };
      const armado = await armarYGuardarPedidos(admin, fila.id);
      if (!armado.ok) throw new Error(`${c.clave}: ${armado.error} (${fila.estado}: ${(fila.motivos_revision ?? []).join(" | ")})`);
      armados.set(c.clave, {
        id: fila.id,
        estado: fila.estado,
        producto: fila.producto?.codigo ?? null,
        motivos: fila.motivos_revision ?? [],
        pedidos: armado.pedidos.map((p) => ({ destinatarios: p.destinatarios, asunto: p.asunto, cuerpo: p.cuerpo, avisos: p.avisos, sinDestinatario: p.sinDestinatario ?? null })),
        tareas: armado.tareas.map((t) => `${t.tipo}: ${t.texto}`),
      });
      // Las dos son de la misma agencia, producto, fecha y pax: sin borrar la primera, la segunda sería "posible duplicada".
      await registro.limpiar(admin);
    }
    if (process.env.M3_23_MUESTRA) writeFileSync(process.env.M3_23_MUESTRA, JSON.stringify(Object.fromEntries(armados), null, 2));
  }, 600_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  it("el statement se reconoce como AR10 por el nombre y la reserva queda recibida, no para revisión", () => {
    for (const c of CASOS) expect(armados.get(c.clave), c.clave).toMatchObject({ producto: "AR10", estado: "recibida", motivos: [] });
  });

  it("las únicas tareas son los boletos de bus que emite HI Travel (4, con su fecha; M3-25: Bariloche – El Chaltén va a Chalten Travel) y, en Hostel, el WhatsApp de Lagares (Mendoza); ningún 'revisar a mano'", () => {
    expect(armados.get("DBL Hostel")!.tareas.filter((t) => !t.startsWith("emitir_boleto"))).toEqual([
      "whatsapp: Contactar por WhatsApp a Hostel Lagares Mendoza: Lagares Hostel (doble), IN 24 dic 2026, OUT 26 dic 2026",
    ]);
    expect(armados.get("DBL Hotel 3*")!.tareas.filter((t) => !t.startsWith("emitir_boleto"))).toEqual([]);
    for (const c of CASOS) {
      expect(armados.get(c.clave)!.tareas.filter((t) => t.startsWith("emitir_boleto")), c.clave).toEqual([
        "emitir_boleto: Emitir boleto: Salta – Mendoza, 23 dic 2026",
        "emitir_boleto: Emitir boleto: Mendoza – Bariloche, 26 dic 2026",
        "emitir_boleto: Emitir boleto: El Calafate – Río Gallegos, 5 ene 2027",
        "emitir_boleto: Emitir boleto: Río Gallegos – Ushuaia, 5 ene 2027",
      ]);
      expect(armados.get(c.clave)!.pedidos.filter((p) => p.sinDestinatario || p.destinatarios.length === 0), c.clave).toEqual([]);
    }
  });

  it("DBL Hostel: cada hostel a su proveedor (Trotamundos, Purmamarca, Mendoza, Periko's, El Chaltén, El Calafate, Ushuaia)", () => {
    const a = armados.get("DBL Hostel")!;
    const casillas = a.pedidos.map((p) => p.destinatarios.join(",")).sort();
    expect(casillas).toEqual(
      expect.arrayContaining(["trotamundoshostelsalta@gmail.com", "consultas@postadepurmamarca.com.ar", "infoperikos@gmail.com,denalibarilochesrl@gmail.com"]),
    );
  });

  it("DBL Hotel 3*: Inkai en Salta, Kenton en Bariloche y el Budget del OD033 en El Chaltén", () => {
    const a = armados.get("DBL Hotel 3*")!;
    const casillas = a.pedidos.map((p) => p.destinatarios.join(",")).sort();
    expect(casillas).toEqual(expect.arrayContaining(["info@hotelinkai.com", "consultas@postadepurmamarca.com.ar", "reservas@kentonpalace.com.ar", "hosteriakausiaike@gmail.com"]));
  });

  it("fechas: Salta en dos estadías, Purmamarca la noche del 20, El Calafate con Torres del Paine el 3 ene y Perito Moreno el 4, Ushuaia con el Parque el 6 y lobos el 7", () => {
    for (const c of CASOS) {
      const cuerpos = armados.get(c.clave)!.pedidos.map((p) => p.cuerpo).join("\n=====\n");
      expect(cuerpos, c.clave).toContain("IN: 19 dic 2026\nOUT: 20 dic 2026 (1 noche)");
      expect(cuerpos, c.clave).toContain("IN: 20 dic 2026\nOUT: 21 dic 2026 (1 noche)");
      expect(cuerpos, c.clave).toContain("IN: 21 dic 2026\nOUT: 23 dic 2026 (2 noches)");
      expect(cuerpos, c.clave).toMatch(/Torres del Paine[^\n]*\nFecha: 3 ene 2027/);
      expect(cuerpos, c.clave).toMatch(/Perito Moreno[^\n]*\nFecha: 4 ene 2027/);
      expect(cuerpos, c.clave).toMatch(/Tierra del Fuego[^\n]*\nFecha: 6 ene 2027/);
      expect(cuerpos, c.clave).toMatch(/Beagle[^\n]*\nFecha: 7 ene 2027/);
      // La Ciénaga: Salinas sale del alojamiento de Salta y termina en Purmamarca; Humahuaca, al revés.
      expect(cuerpos, c.clave).toMatch(/Excursión: Salinas y Purmamarca\nFecha: 20 dic 2026\n[^\n]*\nPick up: [^\n]*\(Salta\)[^\n]* · Drop off: Posta de Purmamarca \(Purmamarca\)/);
      expect(cuerpos, c.clave).toMatch(/Excursión: Humahuaca\nFecha: 21 dic 2026\n[^\n]*\nPick up: Posta de Purmamarca \(Purmamarca\)[^\n]* · Drop off: [^\n]*\(Salta\)/);
    }
  });
});
