// @vitest-environment node
//
// Spec M3-25 — verificación 3 (regla #5): el recorrido. Una reserva de ejemplo de
// AR10 como la TourRadar #1389186 (2 pax, Double Hostel, salida 19 dic 2026)
// llega por el flujo de M2 (statement de TourRadar → lectura → emparejado →
// reserva, en modo prueba y con la IA FALSA: no gasta) contra la BASE DE
// PRUEBAS, queda recibida y arma sus borradores con las correcciones de la
// revisión del owner: La Ciénaga solo el traslado de llegada, Rumbo Sur solo el
// de salida y el Beagle sin pick up, y los buses de El Chaltén en el mail a
// Chalten Travel (el del OD033), con fecha y horario.
//
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9).
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
// No se envía nada (#4). Con M3_25_MUESTRA=<archivo> deja los pedidos armados en ese archivo.
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

const CASOS = [{ clave: "DBL Hostel", numero: `9138${SUFIJO}5`, habitacion: "Double Hostel" }];

interface Armado {
  id: string;
  estado: string;
  producto: string | null;
  motivos: string[];
  pedidos: Array<{ destinatarios: string[]; asunto: string; cuerpo: string; avisos: string[]; sinDestinatario: string | null }>;
  tareas: string[];
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-25 — recorrido: AR10 como la #1389186, con las correcciones de la revisión del owner", { timeout: 600_000 }, () => {
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
        messageId: `<m3-25-${randomUUID()}@prueba.hitravel.local>`,
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
    if (process.env.M3_25_MUESTRA) writeFileSync(process.env.M3_25_MUESTRA, JSON.stringify(Object.fromEntries(armados), null, 2));
  }, 600_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  const a = () => armados.get("DBL Hostel")!;
  const cuerpoDe = (mail: string) => a().pedidos.find((p) => p.destinatarios.includes(mail))?.cuerpo ?? "";

  it("la reserva queda recibida como AR10", () => {
    expect(a()).toMatchObject({ producto: "AR10", estado: "recibida", motivos: [] });
  });

  it("fila 1: a La Ciénaga, solo el traslado de llegada", () => {
    const cuerpo = cuerpoDe("florencia@lacienagaturismo.com.ar");
    // M3-28 (owner, 2026-10-28): el traslado de un solo lado, con el nombre de la ciudad y guion.
    expect(cuerpo).toContain("Traslado de llegada: Transfer in Aeropuerto Salta - Alojamiento\nFecha: 19 dic 2026\nVuelo pendiente");
    expect(cuerpo).not.toMatch(/Accommodation - SLA|Traslado de salida/);
  });

  it("filas 2 y 3: a Rumbo Sur, solo el traslado de salida y el Beagle sin datos de pick up", () => {
    const cuerpo = cuerpoDe("emiliao@rumbosur.com.ar");
    expect(cuerpo).toContain("Traslado de salida: Transfer out Alojamiento en Ushuaia - Aeropuerto Ushuaia\nFecha: 8 ene 2027\nVuelo pendiente");
    expect(cuerpo).not.toMatch(/Round Trip|Traslado de llegada/);
    expect(cuerpo).toContain("Excursión: Beagle Channel Boat Trip, 3 hours, no transfer to port\nFecha: 7 ene 2027\nServicio: regular · Idioma: inglés\n\n");
  });

  it("fila 4: un solo mail a Chalten Travel con Rancho Grande y los dos buses de El Chaltén, con fecha y horario", () => {
    const chalten = a().pedidos.filter((p) => p.destinatarios.includes("agencias@chaltentravel.com"));
    expect(chalten).toHaveLength(1);
    expect(chalten[0].cuerpo).toContain("Bus: Bariloche – El Chaltén\nFecha: 30 dic 2026 · Horario: 8:30 am (llega el 31 dic 2026)");
    expect(chalten[0].cuerpo).toContain("Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station\nFecha: 2 ene 2027 · Horario: 8:00 am");
    expect(chalten[0].cuerpo).toContain("Alojamiento: Rancho Grande");
    expect(a().tareas.filter((t) => t.includes("Bariloche – El Chaltén"))).toEqual([]);
  });
});
