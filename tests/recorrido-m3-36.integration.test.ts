// @vitest-environment node
//
// Spec M3-36 — verificaciones 2 y 3 (regla #5): el recorrido. Una reserva de
// Kilroy del combinado de Iguazú que empieza en Argentina (OD010C, como la real
// DK1593147: 2 noches en Puerto Iguazú y 1 en Foz) llega por el flujo de M2
// (mail → lectura → emparejado → reserva, en modo prueba y con la IA FALSA: no
// gasta) contra la BASE DE PRUEBAS, queda recibida y arma los borradores: el de
// Cuenca del Plata con el hotel de cada día (el día del cruce, pick up en Beer y
// drop off en Bambu) y los de los dos hostels con sus noches.
//
// Antes carga en la base de pruebas las noches de OD010C de
// data/noches-servicio.csv (idempotente, solo ese paquete: lo mismo que hace
// `npm run importar:paquetes`). Mails y pasajeros sintéticos, con números de
// reserva de test (empiezan con 9). Lo que crea lleva la marca de prueba y se
// borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { cargarNochesServicio, parsearNochesServicio } from "@/lib/importador-productos/noches-servicio";
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

const MAIL = {
  numero: `DK93136${SUFIJO}/test`,
  nombre: "Iguazu Falls Combined (2 nights in Argentina 1 night in Brazil)",
  codigo: "HI_ARGENTINA_OD010C-677",
  habitacion: "Double Room - Hostel",
  inicio: "2027-01-30",
  fin: "2027-02-02",
};

function ficha() {
  const producto = { nombre: MAIL.nombre, codigo: MAIL.codigo, fecha_inicio: MAIL.inicio, fecha_fin: MAIL.fin, habitacion: MAIL.habitacion };
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "Kilroy", confianza: 1 },
    numero_reserva: { valor: MAIL.numero, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [{ ...producto, noches: null, punto_recogida: null, opcionales: [], confianza: 1 }],
    fecha_inicio: { valor: MAIL.inicio, confianza: 1 },
    fecha_fin: { valor: MAIL.fin, confianza: 1 },
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

const renglon = (texto: string, empieza: string) => texto.split("\n").find((l) => l.startsWith(empieza)) ?? "";

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-36 — recorrido: Iguazú combinado Argentina → Brasil, el día del cruce el drop off es en el hotel de Brasil", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  let reserva: { id: string; estado: string; producto: string | null } | null = null;

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const filas = parsearNochesServicio(readFileSync(resolve(__dirname, "..", "data", "noches-servicio.csv"), "utf-8")).filter((f) => f.paquete === "OD010C");
    await cargarNochesServicio({ admin, filas, nochesPaquete: () => 3 });
    deps = await cargarDependenciasReservas(admin);
    const f = ficha();
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (mail, ctx) =>
      leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-36-${randomUUID()}@prueba.hitravel.local>`,
      remitente: "aarhus@kilroy.dk",
      asunto: `${MAIL.numero} - NEW BOOKING - KILROY booking request`,
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
    expect(r.estado).toBe("procesado");
    if (r.estado !== "procesado") return;
    const [p] = r.pedidos;
    const { data, error } = await admin.from("reserva").select("id, estado, producto:producto_id(codigo)").eq("id", p.reservaId).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { id: string; estado: string; producto: { codigo: string } | null };
    reserva = { id: fila.id, estado: fila.estado, producto: fila.producto?.codigo ?? null };
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  /** Arma y guarda; devuelve lo que muestra el detalle de la reserva (los borradores guardados, tal cual). */
  async function pedidos() {
    const armado = await armarYGuardarPedidos(admin, reserva!.id);
    if (!armado.ok) throw new Error(armado.error);
    return (await cargarPedidos(admin, reserva!.id)).pedidos;
  }

  it("la reserva queda recibida con el producto OD010C", () => {
    expect(reserva && [reserva.producto, reserva.estado]).toEqual(["OD010C", "recibida"]);
  });

  it("el borrador a Cuenca del Plata: los 4 renglones con el hotel de cada día y el aviso del cruce a Brasil", async () => {
    const p = (await pedidos()).find((x) => x.cuerpo.includes("TRF IN"))!;
    expect(p.destinatarios).toEqual(["reservas8@cuencadelplata.com"]);
    expect(p.estado).toBe("borrador");
    const c = p.cuerpo;
    const beer = "Beer (Puerto Iguazú) · hotel a confirmar";
    const bambu = "Bambu (Foz do Iguaçu) · hotel a confirmar";
    expect(c).toContain("Paquete 105 Premium");
    expect(renglon(c, "TRF IN")).toBe(`TRF IN: 30 ene 2027 · Bus o vuelo pendiente · Drop off: ${beer}`);
    expect(renglon(c, "Lado argentino")).toBe(`Lado argentino, Premium, en inglés: 31 ene 2027 · Pick up y drop off: ${beer}`);
    expect(renglon(c, "Lado brasileño")).toBe(`Lado brasileño, Premium, en inglés: 1 feb 2027 · Pick up: ${beer} · Drop off: ${bambu}`);
    expect(renglon(c, "Ese día cruzan")).toBe(
      "Ese día cruzan: el drop off es en el hotel de Brasil. Los pasajeros hacen check out y llevan el equipaje a la excursión (lo dejan en los lockers del parque nacional).",
    );
    expect(renglon(c, "TRF OUT")).toBe(`TRF OUT: 2 feb 2027 · Bus o vuelo pendiente · Pick up: ${bambu}`);
  });

  it("los hostels se piden por sus noches: Beer del 30 ene al 1 feb y Bambu del 1 al 2 feb (en el idioma de hoy)", async () => {
    const lista = await pedidos();
    const beer = lista.find((x) => x.cuerpo.includes("Alojamiento: Beer"))!.cuerpo;
    expect(beer).toContain("IN: 30 ene 2027\nOUT: 1 feb 2027 (2 noches)");
    const bambu = lista.find((x) => x.cuerpo.includes("Alojamiento: Bambu"))!.cuerpo;
    expect(bambu).toContain("IN: 1 feb 2027\nOUT: 2 feb 2027 (1 noche)");
    expect(bambu).toContain("Les escribimos desde HI Travel");
  });
});
