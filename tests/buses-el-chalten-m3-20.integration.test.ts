// @vitest-environment node
//
// Spec M3-20 — verificación 2 (integración contra la BASE DE PRUEBAS): con el
// catálogo real y las reglas de data/buses-el-chalten.csv, el pedido a Chalten
// Travel de AR34 (como DK1594177) sale con el round trip en dos renglones (ida el
// día 1 con el vuelo, vuelta el día que sale de El Chaltén a las 8:00 am) y el de
// OD033 dentro de ARCH31 (como DK1592913), ARCH33 y ARCH33EXP con el bus regular
// aeropuerto FTE → El Chaltén y el public bus de vuelta a las 8:00 am. Un vuelo
// que llega después de las 17 hs deja el aviso interno en el borrador. Sin las
// reglas sale como antes (se imprime el antes y el después). Sin sesión no se ve
// nada (RLS). Lo que crea lleva `de_prueba = true` y se borra al final (solo lo
// suyo). No se envía nada (#4).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { fichaDePrueba } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const PREFIJO = "[test M3-20]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);
const AVISO =
  "El vuelo llega después de las 17 hs: puede no haber bus a El Chaltén. Revisalo con el vendedor de la agencia (traslado privado, más caro; o shuttle de Las Lengas).";
const IDA = "Bus regular El Calafate Airport → El Chaltén (terminal)";
const VUELTA_AR34 = "Bus regular El Chaltén → El Calafate (ciudad)";
const VUELTA_OD033 = "Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station";

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-20.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-23T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

/** Una ficha de lectura (M2-02) de Kilroy con un producto y, si va, el vuelo que llega a FTE. */
function ficha(numero: string, codigoKilroy: string, fecha_inicio: string, fecha_fin: string | null, horaLlegada: string | null): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre: `Producto ${codigoKilroy}`, codigo: codigoKilroy, fecha_inicio, fecha_fin, habitacion: "Double Room - Hostel" }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: fecha_fin, confianza: fecha_fin ? 1 : 0 };
  f.vuelos = horaLlegada
    ? [{ numero: "AR1840", aerolinea: "Aerolíneas Argentinas", origen: "AEP", destino: "FTE", fecha_salida: fecha_inicio, hora_salida: "05:30", fecha_llegada: fecha_inicio, hora_llegada: horaLlegada, confianza: 1 }]
    : [];
  return f;
}

/** Los renglones sin la numeración de cada servicio ("1) …"). */
const lineas = (cuerpo: string) => cuerpo.split("\n").map((x) => x.replace(/^\d+\) /, ""));
/** El servicio que empieza con ese renglón, hasta la línea en blanco. */
function bloque(cuerpo: string, primero: string): string[] {
  const l = lineas(cuerpo);
  const i = l.indexOf(primero);
  if (i < 0) return [];
  const fin = l.indexOf("", i);
  return l.slice(i, fin < 0 ? undefined : fin);
}

// M3-26 (owner, 2026-10-28): el renglón del vuelo va completo (sale y llega).
const CASOS = [
  {
    nombre: "AR34 como DK1594177 (5 al 10 mar, AR1840 08:40)",
    codigo: "HI_ARGENTINA_AR34-677",
    producto: "AR34",
    inicio: "2027-03-05",
    fin: "2027-03-10",
    hora: "08:40",
    ida: [IDA, "Fecha: 5 mar 2027 · Horario: según la llegada del vuelo", "Vuelo: AR1840 (Aerolíneas Argentinas) – sale Buenos Aires (AEP) 5 mar 05:30 hs – llega El Calafate (FTE) 5 mar 08:40 hs"],
    vuelta: [VUELTA_AR34, "Fecha: 8 mar 2027 · Horario: 8:00 am"],
    aviso: false,
  },
  {
    nombre: "ARCH31 como DK1592913 (El Chaltén del 10 al 13 mar, AR1840 08:40)",
    codigo: "HI_ARGENTINA_ARCH31-677",
    producto: "ARCH31",
    inicio: "2027-03-10",
    fin: null,
    hora: "08:40",
    ida: [IDA, "Fecha: 10 mar 2027 · Horario: según la llegada del vuelo", "Vuelo: AR1840 (Aerolíneas Argentinas) – sale Buenos Aires (AEP) 10 mar 05:30 hs – llega El Calafate (FTE) 10 mar 08:40 hs"],
    vuelta: [VUELTA_OD033, "Fecha: 13 mar 2027 · Horario: 8:00 am"],
    aviso: false,
  },
  {
    nombre: "ARCH33 con el vuelo que llega a las 18:30",
    codigo: "ARCH33",
    producto: "ARCH33",
    inicio: "2027-04-10",
    fin: null,
    hora: "18:30",
    ida: [IDA, "Fecha: 10 abr 2027 · Horario: según la llegada del vuelo", "Vuelo: AR1840 (Aerolíneas Argentinas) – sale Buenos Aires (AEP) 10 abr 05:30 hs – llega El Calafate (FTE) 10 abr 18:30 hs"],
    vuelta: [VUELTA_OD033, "Fecha: 13 abr 2027 · Horario: 8:00 am"],
    aviso: true,
  },
  {
    nombre: "ARCH33EXP sin vuelo",
    codigo: "HI_TRAVEL_ARCH_EXP-677",
    producto: "ARCH33EXP",
    inicio: "2027-05-10",
    fin: null,
    hora: null,
    ida: [IDA, "Fecha: 10 may 2027 · Horario: según la llegada del vuelo", "Vuelo pendiente"],
    vuelta: [VUELTA_OD033, "Fecha: 13 may 2027 · Horario: 8:00 am"],
    aviso: false,
  },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-20 — buses de El Chaltén, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;

  async function crear(caso: (typeof CASOS)[number], i: number): Promise<string> {
    const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
    const deps = await cargarDependenciasReservas(admin);
    const f = ficha(`DK9320${i}${SUFIJO}/test`, caso.codigo, caso.inicio, caso.fin, caso.hora);
    const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
    const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", c.reserva.id).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
    expect([fila.producto?.codigo, fila.estado]).toEqual([caso.producto, "recibida"]);
    return c.reserva.id;
  }

  async function armar(reservaId: string, sinReglas = false) {
    const r = await armarYGuardarPedidos(admin, reservaId, sinReglas ? { busesElChalten: [] } : {});
    if (!r.ok) throw new Error(r.error);
    return (await cargarPedidos(admin, reservaId)).pedidos;
  }

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
  });

  afterAll(async () => {
    await registro.limpiar(admin);
  }, 120_000);

  CASOS.forEach((caso, i) => {
    it(caso.nombre, async () => {
      const id = await crear(caso, i);
      const chalten = (ps: Awaited<ReturnType<typeof armar>>) => ps.find((p) => p.destinatarios.some((d) => /chaltentravel/i.test(d)))!;
      const antes = chalten(await armar(id, true));
      console.log(`[M3-20] ${caso.nombre} — ANTES (sin las reglas), a ${antes.destinatarios.join(", ")}:\n${antes.cuerpo}\n`);
      const despues = chalten(await armar(id));
      console.log(`[M3-20] ${caso.nombre} — DESPUÉS:\n${despues.cuerpo}\n  avisos del borrador: ${JSON.stringify(despues.avisos)}\n`);

      expect(bloque(despues.cuerpo, IDA)).toEqual(caso.ida);
      expect(bloque(despues.cuerpo, caso.vuelta[0])).toEqual(caso.vuelta);
      expect(despues.cuerpo).not.toContain("Traslado de llegada: Transfer El Calafate Airport to El Chalten");
      expect(despues.cuerpo).not.toContain("Round Trip FTE Airport");
      expect(despues.cuerpo).not.toContain("17 hs");
      if (caso.aviso) expect(despues.avisos).toContain(AVISO);
      else expect(despues.avisos).not.toContain(AVISO);
      // Lo demás del pedido no cambia: los mismos renglones salvo los del bus.
      const sinBuses = (c: string) =>
        c.split("\n\n").filter((s) => !/Chalten|Chaltén|Round Trip FTE/.test(s.split("\n")[0])).map((s) => s.replace(/^\d+\) /, ""));
      expect(sinBuses(despues.cuerpo)).toEqual(sinBuses(antes.cuerpo));
      // Volver a armar deja el borrador sin editar con lo mismo.
      expect(chalten(await armar(id)).cuerpo).toBe(despues.cuerpo);
    });
  });

  it("sin sesión no se ven los borradores ni las tareas (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
    const tareas = await anonimo.from("reserva_tarea").select("id").limit(1);
    expect(tareas.data ?? []).toEqual([]);
  });
});
