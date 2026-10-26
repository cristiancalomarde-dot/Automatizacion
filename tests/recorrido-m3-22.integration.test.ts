// @vitest-environment node
//
// Spec M3-22 — verificación 3 (regla #5): el recorrido. Dos reservas de ejemplo
// de Kilroy con habitación privada en Puerto Natales llegan por el flujo de M2
// (mail → lectura → emparejado → reserva, en modo prueba y con la IA FALSA: no
// gasta) contra la BASE DE PRUEBAS, quedan recibidas y arman sus borradores:
// ARCH31 (como DK1592913) y CH10 (con el W Trek). El alojamiento en Factoria sale
// en su propio pedido a "Factoria (hostel de Vertice)", nada de Factoria va a
// Vértice, y el W Trek sigue en su pedido aparte. Volver a armar deja lo mismo.
//
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9).
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
// No se envía nada (#4).
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
const FACTORIA = "Factoria (hostel de Vertice)";
const VERTICE = "VERTICE Travel: W Trek Standard con Grey";
const LAS_TORRES = "LAS TORRES: W Trek Standard y W Trek Express";

function ficha(numero: string, nombre: string, codigo: string, habitacion: string, fecha_inicio: string) {
  const producto = { nombre, codigo, fecha_inicio, fecha_fin: null, habitacion };
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "Kilroy", confianza: 1 },
    numero_reserva: { valor: numero, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [{ ...producto, noches: null, punto_recogida: null, opcionales: [], confianza: 1 }],
    fecha_inicio: { valor: producto.fecha_inicio, confianza: 1 },
    fecha_fin: { valor: null, confianza: 0 },
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
    ...f.productos.map((p) => `${p.nombre} ${p.codigo} from ${p.fecha_inicio} - ${p.habitacion}`),
    `Passengers (2): ${f.pasajeros.map((p) => `${p.nombre} ${p.apellido}, ${p.nacionalidad}, ${p.fecha_nacimiento}`).join("; ")}`,
  ].join("\n");
}

const MAILS = [
  { producto: "ARCH31", nombre: "Patagonia Highlights - 9 Days (Start Argentina)", codigo: "HI_ARGENTINA_ARCH31-677", habitacion: "Double Room - Hostel", numero: `DK93221${SUFIJO}/test`, inicio: "2027-03-08" },
  { producto: "CH10", nombre: "W Trek & Puerto Natales", codigo: "HI_TRAVEL_CH10-677", habitacion: "Twin Room - Hostel", numero: `DK93222${SUFIJO}/test`, inicio: "2027-04-12" },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-22 — recorrido: el alojamiento en Factoria llega por mail y se pide a Factoria", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  const reservas = new Map<string, { id: string; estado: string; producto: string | null }>();
  const mailDe = new Map<string, string[]>();

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const prov = await admin.from("proveedor").select("nombre,mails").in("nombre", [FACTORIA, VERTICE, LAS_TORRES]);
    if (prov.error) throw new Error(prov.error.message);
    for (const p of prov.data ?? []) mailDe.set(p.nombre, [...new Set(((p.mails ?? []) as string[]).map((m) => m.trim().toLowerCase()))]);
    deps = await cargarDependenciasReservas(admin);
    for (const m of MAILS) {
      const f = ficha(m.numero, m.nombre, m.codigo, m.habitacion, m.inicio);
      const { cliente } = clienteFalso(respuestaCon(f));
      const { registro: uso } = registroFalso();
      const leer: OpcionesProceso["leer"] = (mail, ctx) =>
        leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
      const entrada: MailEntrada = {
        origen: "archivo",
        messageId: `<m3-22-${randomUUID()}@prueba.hitravel.local>`,
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
      expect(r.estado, m.producto).toBe("procesado");
      if (r.estado !== "procesado") continue;
      for (const p of r.pedidos) {
        const { data, error } = await admin.from("reserva").select("id, estado, producto:producto_id(codigo)").eq("id", p.reservaId).single();
        if (error) throw new Error(error.message);
        const fila = data as unknown as { id: string; estado: string; producto: { codigo: string } | null };
        reservas.set(m.producto, { id: fila.id, estado: fila.estado, producto: fila.producto?.codigo ?? null });
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

  it("las dos reservas quedan recibidas con su producto", () => {
    expect([...reservas.entries()].map(([k, r]) => [k, r.producto, r.estado])).toEqual([
      ["ARCH31", "ARCH31", "recibida"],
      ["CH10", "CH10", "recibida"],
    ]);
  });

  it.each([
    ["ARCH31", null],
    ["CH10", LAS_TORRES],
  ])("%s: el alojamiento en Factoria va en su pedido a Factoria; nada de Factoria a Vértice; el W Trek aparte", async (producto, trek) => {
    const r = reservas.get(producto)!;
    const armado = await armarYGuardarPedidos(admin, r.id);
    if (!armado.ok) throw new Error(armado.error);
    const { pedidos } = await cargarPedidos(admin, r.id);
    const factoria = pedidos.filter((p) => p.cuerpo.includes("Alojamiento: Factoria"));
    expect(factoria).toHaveLength(1);
    expect(factoria[0].destinatarios).toEqual(mailDe.get(FACTORIA));
    expect(factoria[0].estado).toBe("borrador");
    expect(factoria[0].cuerpo).not.toMatch(/W[\s-]?Trek/i);
    expect(pedidos.some((p) => p.destinatarios.some((m) => mailDe.get(VERTICE)!.includes(m)))).toBe(false);
    if (trek) {
      const delTrek = pedidos.filter((p) => /W[\s-]?Trek/i.test(p.cuerpo));
      expect(delTrek).toHaveLength(1);
      expect(delTrek[0].destinatarios).toEqual(mailDe.get(trek));
      expect(delTrek[0]).not.toBe(factoria[0]);
    }
    // Volver a armar: el borrador sin editar queda igual.
    const otra = await armarYGuardarPedidos(admin, r.id);
    if (!otra.ok) throw new Error(otra.error);
    const despues = (await cargarPedidos(admin, r.id)).pedidos.map((p) => `${p.destinatarios.join(",")}|${p.cuerpo}`).sort();
    expect(despues).toEqual(pedidos.map((p) => `${p.destinatarios.join(",")}|${p.cuerpo}`).sort());
  });
});
