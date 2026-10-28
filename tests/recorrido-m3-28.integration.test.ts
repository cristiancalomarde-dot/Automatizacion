// @vitest-environment node
//
// Spec M3-28 — verificación 3 (regla #5): el recorrido. Una reserva de Kilroy como
// DK1595221 (BOCHI04R + OD010A, 2 pax) llega por el flujo de M2 (mail → lectura →
// emparejado → reserva, en modo prueba y con la IA FALSA: no gasta) contra la BASE
// DE PRUEBAS, queda recibida y arma sus borradores con los textos de la segunda
// revisión del owner (2026-10-28): asunto "Solicitud de reserva – <pasajero> x 2 –
// <fechas>" sin códigos, el 105 Premium de Cuenca del Plata sin "regular" en los
// transfers y Transvip con una p.
//
// Fila 2 (por qué DK1595221 mostraba los códigos): Kilroy da UNA reserva por producto,
// las dos con el mismo número; la de OD010A tiene exactamente los pedidos a Beer Hotel
// (Tangoinn) y a Cuenca del Plata. El armado de hoy no pone códigos en ningún pedido.
// Un borrador armado ANTES de M3-16 (con la plantilla de entonces) los tiene ("Reserva
// Ana x2 · OD010A · Ref. DK…"); "Volver a armar" en ESA reserva lo reemplaza si nadie
// lo editó, pero si alguien lo editó lo conserva tal cual hasta "Rearmar todo".
//
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9).
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
// No se envía nada (#4). Con M3_28_MUESTRA=<archivo> deja los pedidos armados en ese archivo.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { cargarPlantilla, leerPlantilla } from "@/lib/pedidos/plantilla";
import { guardarEdicionDePedido, prepararPedidos } from "@/lib/pedidos/revision";
import { clienteFalso, registroFalso, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { procesarMail as procesarMailReal, type OpcionesProceso } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
const SUFIJO = String(Date.now()).slice(-2);
const NUMERO = `DK95952${SUFIJO}/test`;
const CUENCA = "reservas8@cuencadelplata.com";

/** La plantilla de antes de M3-16 (commit a79220a~1): el asunto con el producto y el número de la agencia. */
const PLANTILLA_VIEJA = leerPlantilla(
  ["## Asunto", "Reserva {{pasajero}} x{{pax}} · {{producto}}{{referencia}}", "## Cuerpo", "{{servicios}}", "", "{{pasajeros}}", "## Firma", "{{nombre_de_quien_envia}}"].join("\n"),
);

function ficha() {
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "Kilroy", confianza: 1 },
    numero_reserva: { valor: NUMERO, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [
      { nombre: "Bolivia and Chile Overland", codigo: "HI_TRAVEL_BOCHI04R-677", fecha_inicio: "2027-03-10", fecha_fin: "2027-03-18", habitacion: "Double Room - Hostel", noches: null, punto_recogida: null, opcionales: [], confianza: 1 },
      { nombre: "Iguazu Falls - 4 Days", codigo: "HI_ARGENTINA_OD010A-677", fecha_inicio: "2027-03-18", fecha_fin: "2027-03-21", habitacion: "Double Room - Hostel", noches: null, punto_recogida: null, opcionales: [], confianza: 1 },
    ],
    fecha_inicio: { valor: "2027-03-10", confianza: 1 },
    fecha_fin: { valor: "2027-03-21", confianza: 1 },
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

function cuerpo(f: ReturnType<typeof ficha>): string {
  return [
    "Mail sintético de prueba (sin datos de nadie).",
    `Booking ${f.numero_reserva.valor}`,
    ...f.productos.map((p) => `${p.nombre} ${p.codigo} from ${p.fecha_inicio} to ${p.fecha_fin} - ${p.habitacion}`),
    `Passengers (2): ${f.pasajeros.map((p) => `${p.nombre} ${p.apellido}, ${p.nacionalidad}, ${p.fecha_nacimiento}`).join("; ")}`,
  ].join("\n");
}

const CODIGOS = /DK9595|BOCHI04R|OD010A|OD030|Ref\./;

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-28 — recorrido: una reserva como DK1595221 (BOCHI04R + OD010A) arma sus pedidos con los textos nuevos", { timeout: 600_000 }, () => {
  let admin: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  type Armado = Extract<Awaited<ReturnType<typeof armarYGuardarPedidos>>, { ok: true }>;
  const reservas = new Map<string, { id: string; estado: string; producto: string | null; motivos: string[]; armado: Armado }>();
  const todos = () => [...reservas.values()].flatMap((r) => r.armado.pedidos);

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const sesion = await crearSesionDePrueba();
    equipo = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { data: yo } = await equipo.auth.getUser();
    usuarioId = yo.user!.id;
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: yo.user!.email, nombre: "Test M3-28" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);

    deps = await cargarDependenciasReservas(admin);
    const f = ficha();
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (mail, ctx) =>
      leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-28-${randomUUID()}@prueba.hitravel.local>`,
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
    expect(r.estado).toBe("procesado");
    if (r.estado !== "procesado") return;
    // Kilroy: una reserva por producto, las dos con el mismo número (como DK1595221 en la real).
    for (const p of r.pedidos) {
      const { data, error } = await admin
        .from("reserva")
        .select("id, estado, motivos_revision, producto:producto_id(codigo)")
        .eq("id", p.reservaId)
        .single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { id: string; estado: string; motivos_revision: string[] | null; producto: { codigo: string } | null };
      const datos = { id: fila.id, estado: fila.estado, producto: fila.producto?.codigo ?? null, motivos: fila.motivos_revision ?? [] };
      const a = await armarYGuardarPedidos(admin, fila.id);
      if (!a.ok) throw new Error(`${datos.producto}: ${a.error} (${fila.estado}: ${datos.motivos.join(" | ")})`);
      reservas.set(datos.producto ?? fila.id, { ...datos, armado: a });
    }
    if (process.env.M3_28_MUESTRA) {
      const muestra = [...reservas.values()].map(({ armado: a, ...datos }) => ({
        ...datos,
        pedidos: a.pedidos.map((p) => ({ a: p.destinatarios, proveedores: p.proveedores.map((x) => x.nombre), asunto: p.asunto, cuerpo: p.cuerpo, avisos: p.avisos })),
        tareas: a.tareas.map((t) => `${t.tipo}: ${t.texto}`),
        avisos: a.avisos,
      }));
      writeFileSync(process.env.M3_28_MUESTRA, JSON.stringify(muestra, null, 2));
    }
  }, 600_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
      await borrarSesion?.();
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  const pedidoA = (mail: string) => todos().find((p) => p.destinatarios.includes(mail));
  const iguazu = () => reservas.get("OD010A")!;

  it("quedan dos reservas recibidas, BOCHI04R y OD010A (Kilroy: una por producto)", () => {
    expect([...reservas.values()].map((r) => [r.producto, r.estado]).sort()).toEqual([
      ["BOCHI04R", "recibida"],
      ["OD010A", "recibida"],
    ]);
  });

  it("filas 1 y 2: todos los asuntos dicen 'Ana Prueba x 2' y ninguno lleva el número de Kilroy ni códigos", () => {
    expect(todos().length).toBeGreaterThan(2);
    for (const p of todos()) {
      expect(p.asunto).toMatch(/^Solicitud de reserva – Ana Prueba x 2 – \d/);
      expect(p.asunto).not.toMatch(CODIGOS);
    }
    expect(pedidoA(CUENCA)!.asunto).toMatch(/^Solicitud de reserva – Ana Prueba x 2 – \d+ (al \d+ )?mar 2027$/);
  });

  it("fila 3: en el pedido a Cuenca del Plata (Paquete 105 Premium) los transfers no dicen 'regular'", () => {
    const c = pedidoA(CUENCA)!.cuerpo;
    expect(c).toContain("Paquete 105 Premium");
    const trf = c.split("\n").filter((l) => /^TRF (IN|OUT)/.test(l));
    expect(trf).toHaveLength(2);
    for (const l of trf) expect(l).toMatch(/^TRF (IN|OUT): /);
    expect(c).not.toMatch(/regular/i);
  });

  it("fila 4: el traslado de Transvip de BOCHI04R es una tarea con 'Transvip', con una p", () => {
    const bochi = reservas.get("BOCHI04R")!.armado;
    const transvip = bochi.tareas.filter((t) => /transvip/i.test(t.texto));
    expect(transvip.length).toBeGreaterThan(0);
    for (const t of transvip) expect(t.texto).toMatch(/Reservar a mano en Transvip: /);
    expect(JSON.stringify([...reservas.values()].map((r) => r.armado))).not.toMatch(/Transvipp/i);
  });

  it("fila 2: un borrador de antes de M3-16 muestra los códigos; 'Volver a armar' lo limpia si nadie lo editó", async () => {
    // Como en producción antes del 2026-10-23: armado con la plantilla vieja.
    const viejo = await armarYGuardarPedidos(admin, iguazu().id, { plantilla: PLANTILLA_VIEJA });
    if (!viejo.ok) throw new Error(viejo.error);
    const antes = (await cargarPedidos(admin, iguazu().id)).pedidos.find((p) => p.destinatarios.includes(CUENCA))!;
    // El síntoma de DK1595221: el código del producto y el número de Kilroy, en los dos pedidos de esa reserva.
    expect(antes.asunto).toMatch(/^Reserva Ana Prueba x2 · OD010A · Ref\. DK9595/);
    const deIguazu = (await cargarPedidos(admin, iguazu().id)).pedidos;
    expect(deIguazu.map((p) => p.proveedores.join(", ")).sort()).toEqual(
      iguazu()
        .armado.pedidos.map((p) => p.proveedores.map((x) => x.nombre).join(", "))
        .sort(),
    );
    for (const p of deIguazu) expect(p.asunto).toMatch(CODIGOS);

    const otraVez = await armarYGuardarPedidos(admin, iguazu().id, { plantilla: cargarPlantilla() });
    if (!otraVez.ok) throw new Error(otraVez.error);
    const despues = (await cargarPedidos(admin, iguazu().id)).pedidos;
    for (const p of despues) expect(p.asunto).not.toMatch(CODIGOS);
  });

  it("fila 2: si ese borrador viejo se editó, 'Volver a armar' lo conserva con los códigos; 'Rearmar todo' lo reemplaza", async () => {
    const viejo = await armarYGuardarPedidos(admin, iguazu().id, { plantilla: PLANTILLA_VIEJA });
    if (!viejo.ok) throw new Error(viejo.error);
    const pedidos = (await cargarPedidos(admin, iguazu().id)).pedidos;
    const cuenca = pedidos.find((p) => p.destinatarios.includes(CUENCA))!;
    const beer = pedidos.find((p) => /beer/i.test(p.destinatarios.join(",")) || /beer/i.test(p.proveedores.join(",")));
    for (const p of [cuenca, beer].filter((x): x is NonNullable<typeof x> => !!x)) {
      const e = await guardarEdicionDePedido(equipo, { pedidoId: p.id, asunto: p.asunto, cuerpo: `${p.cuerpo}\n\nPD: editado a mano.` });
      expect(e.ok).toBe(true);
    }

    // "Volver a armar" (conservar los editados): el asunto con los códigos sigue ahí.
    const volver = await prepararPedidos(equipo, iguazu().id);
    if (!volver.ok) throw new Error(volver.error);
    const conservado = volver.pedidos.find((p) => p.id === cuenca.id)!;
    expect(conservado.editado).toBe(true);
    expect(conservado.asunto).toMatch(/^Reserva Ana Prueba x2 · OD010A · Ref\. DK9595/);
    for (const p of volver.pedidos.filter((x) => !x.editado)) expect(p.asunto).not.toMatch(CODIGOS);

    // "Rearmar todo": el asunto nuevo, sin códigos, en todos.
    const todo = await prepararPedidos(equipo, iguazu().id, { reemplazarEditados: true });
    if (!todo.ok) throw new Error(todo.error);
    for (const p of todo.pedidos) {
      expect(p.editado).toBe(false);
      expect(p.asunto).toMatch(/^Solicitud de reserva – Ana Prueba x 2/);
      expect(p.asunto).not.toMatch(CODIGOS);
    }
  });
});
