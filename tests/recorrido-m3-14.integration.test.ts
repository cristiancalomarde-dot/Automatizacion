// @vitest-environment node
//
// Spec M3-14 — verificación 3 (regla #5): el recorrido. Un mail de Kilroy de
// BRARCH26 con habitación "Budget Hotel" entra por el flujo de M2 (mail → lectura
// → emparejado → reserva, en modo prueba y con la IA FALSA: no gasta) contra la
// BASE DE PRUEBAS, queda recibido y arma sus pedidos con el hotel de la categoría:
// en Iguazú El Pueblito (Hotel 3*: OD010A no tiene Budget) y el pedido a Cuenca del
// Plata lo nombra; en Río el 3* del paquete (data/categorias-tour.csv); ninguna
// tarea "Elegir el hotel de…". "Volver a armar" reemplaza los borradores sin editar.
//
// Mail y pasajeros sintéticos, con número de reserva de test (empieza con 9).
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos, type PedidoGuardado } from "@/lib/pedidos/guardar";
import type { TareaArmada } from "@/lib/pedidos/tipos";
import { clienteFalso, registroFalso, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { procesarMail as procesarMailReal, type OpcionesProceso } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
/** Un sufijo por corrida: el número de reserva no choca con otra corrida a medio borrar. */
const SUFIJO = String(Date.now()).slice(-2);
const NUMERO = `DK93141${SUFIJO}/test`;
const INICIO = "2027-07-03";
const FIN = "2027-07-19";

function ficha() {
  const producto = { nombre: "Rio de Janeiro to Santiago", codigo: "HI_TRAVEL_BRARCH26-677", fecha_inicio: INICIO, fecha_fin: FIN, habitacion: "Double Room - Budget Hotel" };
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "Kilroy", confianza: 1 },
    numero_reserva: { valor: NUMERO, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [{ ...producto, noches: null, punto_recogida: null, opcionales: [], confianza: 1 }],
    fecha_inicio: { valor: INICIO, confianza: 1 },
    fecha_fin: { valor: FIN, confianza: 1 },
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

const renglon = (cuerpo: string, empieza: string) => cuerpo.split("\n").find((l) => l.startsWith(empieza)) ?? "";

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-14 — recorrido: BRARCH26 Budget de Kilroy llega por mail y pide el hotel de la categoría", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let soltarBloqueo: () => void;
  let reserva: { id: string; estado: string; producto: string | null; habitacion: string | null };
  let pedidos: PedidoGuardado[];
  let tareas: TareaArmada[];

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const deps = await cargarDependenciasReservas(admin);
    const f = ficha();
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (mail, ctx) =>
      leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-14-${randomUUID()}@prueba.hitravel.local>`,
      remitente: "aarhus@kilroy.dk",
      asunto: `${NUMERO} - NEW BOOKING - KILROY booking request`,
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
    if (r.estado !== "procesado") throw new Error(`El mail no se procesó: ${r.estado}`);
    expect(r.pedidos).toHaveLength(1);
    const { data, error } = await admin.from("reserva").select("id, estado, habitacion, producto:producto_id(codigo)").eq("id", r.pedidos[0].reservaId).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { id: string; estado: string; habitacion: string | null; producto: { codigo: string } | null };
    reserva = { ...fila, producto: fila.producto?.codigo ?? null };

    const armado = await armarYGuardarPedidos(admin, reserva.id);
    if (!armado.ok) throw new Error(armado.error);
    tareas = armado.tareas;
    pedidos = (await cargarPedidos(admin, reserva.id)).pedidos;
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  it("el mail queda recibido como BRARCH26, con Budget Hotel", () => {
    expect(reserva).toMatchObject({ producto: "BRARCH26", estado: "recibida", habitacion: "Double Room - Budget Hotel" });
  });

  it("ninguna tarea 'Elegir el hotel de…'", () => {
    expect(tareas.filter((t) => t.texto.startsWith("Elegir el hotel"))).toEqual([]);
  });

  it("Iguazú: el borrador a Cuenca del Plata pide El Pueblito y lo nombra en el TRF IN, las excursiones y el TRF OUT", () => {
    const c = pedidos.find((p) => p.cuerpo.includes("TRF IN"))!;
    expect(c.destinatarios).toEqual(["reservas8@cuencadelplata.com"]);
    expect(c.cuerpo).toContain("Alojamiento: Hotel 3* El Pueblito");
    const hotel = "Hotel 3* El Pueblito (Iguazú) · hotel a confirmar";
    expect(renglon(c.cuerpo, "TRF IN")).toContain(`Drop off: ${hotel}`);
    expect(renglon(c.cuerpo, "Lado argentino")).toContain(`Pick up y drop off: ${hotel}`);
    expect(renglon(c.cuerpo, "TRF OUT")).toContain(`Pick up: ${hotel}`);
    expect(c.cuerpo).not.toContain("alojamiento a confirmar");
  });

  it("Río: el hotel es el 3* del paquete (National Inn Copacabana o Copacabana Mar)", () => {
    // M3-32: el hotel es de Río de Janeiro: su pedido va en portugués ("Hospedagem").
    expect(pedidos.some((p) => /Hospedagem: .*(Nacional Inn|National Inn|Copacabana Mar)/i.test(p.cuerpo))).toBe(true);
  });

  it("volver a armar reemplaza los borradores sin editar con lo mismo", async () => {
    const otra = await armarYGuardarPedidos(admin, reserva.id);
    if (!otra.ok) throw new Error(otra.error);
    expect(otra.guardado.conservados).toBe(0);
    const despues = (await cargarPedidos(admin, reserva.id)).pedidos;
    expect(despues.map((p) => p.cuerpo).sort()).toEqual(pedidos.map((p) => p.cuerpo).sort());
  });
});
