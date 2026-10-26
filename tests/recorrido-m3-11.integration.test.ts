// @vitest-environment node
//
// Spec M3-11 — verificación 3 (regla #5): el recorrido. Dos reservas de ejemplo
// OD017 (Puerto Natales) llegan por el flujo de M2 (mail → lectura →
// emparejado → reserva, en modo prueba y con la IA FALSA: no gasta) contra la
// BASE DE PRUEBAS, quedan recibidas y arman sus borradores: con "Double Room -
// Hostel" el hostel va a Factoria y con "Dormitory - Hostel" a Puma Hostel.
//
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9).
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
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

function ficha(numero: string, habitacion: string, fecha_inicio: string, fecha_fin: string) {
  const producto = { nombre: "Puerto Natales & Torres del Paine Adventure", codigo: "HI_ARGENTINA_OD017-677", fecha_inicio, fecha_fin, habitacion };
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
  // Fechas distintas: con la misma fecha, agencia, producto y pax la segunda quedaría como posible duplicada (M2).
  { habitacion: "Double Room - Hostel", numero: `DK93111${SUFIJO}/test`, inicio: "2027-02-10", fin: "2027-02-14" },
  { habitacion: "Dormitory - Hostel", numero: `DK93112${SUFIJO}/test`, inicio: "2027-03-10", fin: "2027-03-14" },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-11 — recorrido: OD017 llega por mail y pide el hostel según la habitación", { timeout: 300_000 }, () => {
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
    const prod = await admin.from("producto").select("id").eq("codigo", "OD017").single();
    if (prod.error) throw new Error(prod.error.message);
    const detalle = await cargarProducto(admin, prod.data.id);
    for (const s of detalle.servicios.filter((x) => x.tipo === "alojamiento" && x.nivel === "Hostel")) {
      mailDe.set(s.serviceProviderNombre ?? "", [...new Set((s.bookingSupplier?.mails ?? []).map((m) => m.trim().toLowerCase()))]);
    }
    // M3-22: Factoria se le pide a Factoria (data/alojamiento-se-pide-a.csv), con su mail del directorio.
    const factoria = await admin.from("proveedor").select("mails").eq("nombre", "Factoria (hostel de Vertice)").single();
    if (factoria.error) throw new Error(factoria.error.message);
    mailDe.set("Factoria", [...new Set(((factoria.data.mails ?? []) as string[]).map((m) => m.trim().toLowerCase()))]);
    deps = await cargarDependenciasReservas(admin);
    for (const m of MAILS) {
      const f = ficha(m.numero, m.habitacion, m.inicio, m.fin);
      const { cliente } = clienteFalso(respuestaCon(f));
      const { registro: uso } = registroFalso();
      const leer: OpcionesProceso["leer"] = (mail, ctx) =>
        leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
      const entrada: MailEntrada = {
        origen: "archivo",
        messageId: `<m3-11-${randomUUID()}@prueba.hitravel.local>`,
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
      expect(r.estado, m.habitacion).toBe("procesado");
      if (r.estado !== "procesado") continue;
      for (const p of r.pedidos) {
        const { data, error } = await admin.from("reserva").select("id, estado, producto:producto_id(codigo)").eq("id", p.reservaId).single();
        if (error) throw new Error(error.message);
        const fila = data as unknown as { id: string; estado: string; producto: { codigo: string } | null };
        reservas.set(m.habitacion, { id: fila.id, estado: fila.estado, producto: fila.producto?.codigo ?? null });
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

  it("las dos reservas quedan recibidas con OD017", () => {
    expect([...reservas.entries()].map(([h, r]) => [h, r.producto, r.estado])).toEqual([
      ["Double Room - Hostel", "OD017", "recibida"],
      ["Dormitory - Hostel", "OD017", "recibida"],
    ]);
  });

  it.each([
    ["Double Room - Hostel", "Factoria", "Puma Hostel"],
    ["Dormitory - Hostel", "Puma Hostel", "Factoria"],
  ])("%s: el borrador del hostel va a %s (y nada a %s)", async (habitacion, elegido, noVa) => {
    const r = reservas.get(habitacion)!;
    const armado = await armarYGuardarPedidos(admin, r.id);
    if (!armado.ok) throw new Error(armado.error);
    const guardado = await cargarPedidos(admin, r.id);
    const hostel = guardado.pedidos.find((p) => p.cuerpo.includes("Alojamiento:"))!;
    expect(hostel.cuerpo).toContain(`Alojamiento: ${elegido}`);
    expect(hostel.destinatarios).toEqual(mailDe.get(elegido));
    expect(hostel.estado).toBe("borrador");
    expect(guardado.pedidos.some((p) => p.cuerpo.includes(`Alojamiento: ${noVa}`))).toBe(false);
  });
});
