// @vitest-environment node
//
// Spec M3-17 — verificación 2 (integración contra la BASE DE PRUEBAS):
// - cada regla nueva de data/dias-servicio.csv apunta a la excursión cargada con ese nombre
//   (codigo + orden del catálogo real);
// - dentro de los tours (ARCH31, AR09, BRARCH26) cada excursión sale con la fecha del día fijo,
//   contado desde el inicio de su componente, sin "a coordinar";
// - sin sesión no se ve nada (RLS).
// Lo que crea este archivo lleva `de_prueba = true` y se borra al final (solo lo suyo,
// registro-de-prueba.ts).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { cargarDiasServicio } from "@/lib/pedidos/cargar";
import { fechaCorta, sumarDias } from "@/lib/pedidos/formato";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { normalizarTexto } from "@/lib/catalogo/reglas";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { fichaDePrueba } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const PREFIJO = "[test M3-17]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);

/** El nombre de cada excursión de la tabla del owner (spec M3-17 §1), como está cargado. */
const NOMBRES: Record<string, string> = {
  "OD017#4": "Torres del Paine Full Day from Puerto Natales",
  "OD032#4": "Big Dude",
  "OD025#5": "Peninsula Valdes Full Day",
  "OD013#7": "Torres del Paine Full Day from El Calafate",
  "OD018#7": "Tango Show with dinner, drinks and transfers",
  "OD020#7": "Colonia Day Trip Circuito Historico",
  "OD022#5": "Beagle Channel Boat Trip",
  "OD022#6": "Tierra del Fuego National Park half Day",
  "OD029#4": "Bike Tour",
};

function mailDePrueba(agencia: string): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-17.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-23T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia,
    dePrueba: true,
  };
}

/** Una ficha de lectura (M2-02) con un tour, sobre la de ejemplo de Kilroy. */
function ficha(numero: string, agencia: string, codigo: string, fecha_inicio: string): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: agencia, confianza: 1 };
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre: `Tour ${codigo}`, codigo: agencia === "Kilroy" ? `HI_TRAVEL_${codigo}-677` : codigo, fecha_inicio, fecha_fin: null, habitacion: "Double Room - Budget Hotel" }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: null, confianza: 0 };
  return f;
}

/** Qué se espera de cada tour: la excursión, el componente y el día (el proveedor sale del directorio). */
const CASOS = [
  { tour: "ARCH31", inicio: "2027-03-02", esperado: [{ excursion: NOMBRES["OD017#4"], componente: "OD017", dia: 2 }] },
  {
    tour: "AR09",
    inicio: "2027-04-02",
    agencia: "HI Travel",
    esperado: [
      { excursion: NOMBRES["OD018#7"], componente: "OD018", dia: 3 },
      { excursion: NOMBRES["OD025#5"], componente: "OD025", dia: 2 },
      { excursion: NOMBRES["OD013#7"], componente: "OD013", dia: 3 },
      { excursion: NOMBRES["OD022#5"], componente: "OD022", dia: 3 },
      { excursion: NOMBRES["OD022#6"], componente: "OD022", dia: 2 },
    ],
  },
  {
    tour: "BRARCH26",
    inicio: "2027-05-04",
    esperado: [
      { excursion: NOMBRES["OD032#4"], componente: "OD032", dia: 2 },
      { excursion: NOMBRES["OD018#7"], componente: "OD018", dia: 3 },
      { excursion: NOMBRES["OD029#4"], componente: "OD029", dia: 2 },
      { excursion: "Lado argentino", componente: "OD010A", dia: 2 },
      { excursion: "Lado brasileño", componente: "OD010A", dia: 3 },
    ],
  },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-17 — excursiones con día fijo, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
  });

  afterAll(async () => {
    await registro.limpiar(admin);
  }, 120_000);

  async function servicios(codigo: string) {
    const { data, error } = await admin.from("producto").select("producto_servicio(orden, descripcion, service_provider_nombre)").eq("codigo", codigo).single();
    if (error) throw new Error(`${codigo}: ${error.message}`);
    return (data as unknown as { producto_servicio: Array<{ orden: number; descripcion: string | null; service_provider_nombre: string | null }> }).producto_servicio;
  }

  it("cada regla nueva apunta a la excursión cargada con ese nombre", async () => {
    for (const [clave, nombre] of Object.entries(NOMBRES)) {
      const [codigo, orden] = clave.split("#");
      expect(cargarDiasServicio().some((d) => d.codigo === codigo && d.orden === Number(orden)), clave).toBe(true);
      const texto = normalizarTexto(
        (await servicios(codigo))
          .filter((s) => s.orden === Number(orden))
          .map((s) => `${s.descripcion} ${s.service_provider_nombre ?? ""}`)
          .join(" "),
      );
      expect(texto, clave).toContain(normalizarTexto(nombre));
    }
    for (const d of cargarDiasServicio().filter((x) => /^OD01[01]/.test(x.codigo) && x.servicio)) {
      const texto = normalizarTexto((await servicios(d.codigo)).filter((s) => s.orden === d.orden).map((s) => s.descripcion ?? "").join(" "));
      expect(texto, `${d.codigo} ${d.servicio}`).toContain(normalizarTexto(d.servicio!));
    }
  });

  CASOS.forEach((caso, i) => {
    it(`${caso.tour}: cada excursión con su día fijo desde el inicio de su componente`, async () => {
      const agencia = caso.agencia ?? "Kilroy";
      const { mail } = await guardarMailRecibido(mailDePrueba(agencia), admin);
      const deps = await cargarDependenciasReservas(admin);
      const f = ficha(`DK9317${i}${SUFIJO}/test`, agencia, caso.tour, caso.inicio);
      const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia, deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
      const r = await armarYGuardarPedidos(admin, c.reserva.id);
      if (!r.ok) throw new Error(r.error);
      const { pedidos } = await cargarPedidos(admin, c.reserva.id);
      const partes = await admin.from("reserva_componente").select("fecha_inicio, producto:producto_id(codigo)").eq("reserva_id", c.reserva.id);
      const inicioDe = (codigo: string) =>
        (partes.data as unknown as Array<{ fecha_inicio: string | null; producto: { codigo: string } | null }>).find((p) => p.producto?.codigo === codigo)?.fecha_inicio;
      for (const e of caso.esperado) {
        const desde = inicioDe(e.componente);
        expect(desde, `${caso.tour}: la parte ${e.componente} con fecha`).toBeTruthy();
        // El renglón de la excursión: "1) Excursión: X…" / "Excursión: X…" o "Lado argentino, …".
        // M3-32: a un proveedor de Brasil (Big Dude, en Río), "Passeio: X" y la fecha en portugués.
        const esLaExcursion = (l: string) =>
          e.excursion.startsWith("Lado")
            ? l.replace(/^\d+\) /, "").startsWith(e.excursion)
            : [`Excursión: ${e.excursion}`, `Passeio: ${e.excursion}`].some((x) => l.replace(/^\d+\) /, "").startsWith(x));
        const pedido = pedidos.find((p) => p.cuerpo.split("\n").some(esLaExcursion));
        expect(pedido, `${caso.tour}: pedido con ${e.excursion}`).toBeTruthy();
        const lineas = pedido!.cuerpo.split("\n");
        const desdeLinea = lineas.findIndex(esLaExcursion);
        // "Excursión: X\nFecha: …" (dos renglones) o "Lado argentino, …: 4 oct 2026 · …" (uno).
        const bloque = lineas.slice(desdeLinea, desdeLinea + (e.excursion.startsWith("Lado") ? 1 : 2)).join("\n");
        console.log(`[M3-17] ${caso.tour} ${e.componente} desde ${desde}: ${bloque.replace(/\n/g, " | ")}`);
        const idioma = pedido!.cuerpo.startsWith("Olá") ? "pt" : "es";
        expect(bloque, `${caso.tour}: ${e.excursion}`).toContain(fechaCorta(sumarDias(desde!, e.dia - 1), idioma));
        expect(bloque).not.toMatch(/a coordinar|a combinar/);
      }
    });
  });

  it("sin sesión no se ven los borradores ni las tareas (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
    const tareas = await anonimo.from("reserva_tarea").select("id").limit(1);
    expect(tareas.data ?? []).toEqual([]);
  });
});
