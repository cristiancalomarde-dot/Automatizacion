// @vitest-environment node
//
// Spec M3-15 — verificación 3 (regla #5): el recorrido. El mail de ejemplo de
// Adventure360 (BRARCH26) entra por el flujo de M2 (mail → lectura → emparejado
// → reserva, en modo prueba y con la IA FALSA: no gasta) contra la BASE DE
// PRUEBAS dos veces: con bike + rafting y sin elección. Cada reserva queda
// recibida y arma sus pedidos:
// - con bike: el Bike Tour a La Bicicleta Naranja con el punto de encuentro (sin pick up);
// - Mendoza: Bodegas half Day el día 1 por la tarde (Huentata) y la excursión de
//   día entero el día 2 (Alta Montaña a Huentata o, con rafting, el Rafting a KAHUAK),
//   contados desde el inicio de la parte de Mendoza.
//
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { fechaCorta, sumarDias } from "@/lib/pedidos/formato";
import { armarYGuardarPedidos, cargarPedidos, type PedidoGuardado } from "@/lib/pedidos/guardar";
import { clienteFalso, fichaGrabada, registroFalso, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { importarCodigosAgencias } from "@/lib/reservas/emparejar/codigos-agencias";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { parsearMailDeTexto } from "@/lib/reservas/mail-de-texto";
import { procesarMail as procesarMailReal, type OpcionesProceso } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
const RAIZ = join(__dirname, "..");
/** Un mes por corrida (enero a diciembre de 2027): no choca con otra corrida a medio borrar (posible duplicada). */
const MES = (Date.now() % 12) + 1;
const MESES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ELECCIONES = /^Choice of tour in .*$\n?/gm;

interface Armado {
  reserva: { id: string; estado: string; producto: string | null };
  /** El primer día de la parte de Mendoza (OD019) de la reserva. */
  mendoza: string;
  pedidos: PedidoGuardado[];
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-15 — recorrido: BRARCH26 con Mendoza día 1 / día 2 y el Bike Tour con punto de encuentro", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  let conEleccion: Armado;
  let sinEleccion: Armado;

  /** El mail de ejemplo con la llegada de esta corrida; sin las elecciones si `elige` es false. */
  async function recorrer(llegada: string, elige: boolean): Promise<Armado> {
    let texto = readFileSync(join(RAIZ, "src/lib/reservas/__fixtures__/mails/adventure360-brarch26.txt"), "utf-8").replace(
      "Arrival date: 10th November 2026",
      `Arrival date: ${Number(llegada.slice(8))}th ${MESES[Number(llegada.slice(5, 7)) - 1]} 2027`,
    );
    if (!elige) texto = texto.replace(ELECCIONES, "");
    const mail = parsearMailDeTexto(texto);
    // Lo que "leyó" la IA falsa: la respuesta grabada del mail, con la misma fecha (y sin las elecciones si no las hay).
    const f = fichaGrabada("adventure360-brarch26") as {
      productos: Array<Record<string, unknown>>;
      fecha_inicio: { valor: string };
      pedidos_especiales: Array<{ texto: string }>;
    };
    f.productos[0].fecha_inicio = llegada;
    f.fecha_inicio.valor = llegada;
    if (!elige) f.pedidos_especiales = f.pedidos_especiales.filter((p) => !p.texto.startsWith("Choice of tour"));
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (m, ctx) =>
      leerMailConIA(m, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-15-${randomUUID()}@prueba.hitravel.local>`,
      remitente: mail.remitente,
      asunto: mail.asunto,
      fechaMail: mail.fechaMail,
      cuerpoTexto: mail.cuerpoTexto,
      adjuntos: [],
      dePrueba: true,
    };
    const r = await procesarMail(entrada, {
      admin,
      leer: (m, ctx) => {
        registro.mail(ctx.mailRecibidoId);
        return leer(m, ctx);
      },
      deps: () => deps,
      llamadas: crearRegistroLlamadasSupabase(admin),
      dePrueba: true,
      alcance: () => registro.mails,
    });
    if (r.estado !== "procesado") throw new Error(`El mail no se procesó: ${r.estado}`);
    expect(r.pedidos).toHaveLength(1);
    const { data, error } = await admin.from("reserva").select("id, estado, producto:producto_id(codigo)").eq("id", r.pedidos[0].reservaId).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { id: string; estado: string; producto: { codigo: string } | null };
    const partes = await admin.from("reserva_componente").select("fecha_inicio, producto:producto_id(codigo)").eq("reserva_id", fila.id);
    if (partes.error) throw new Error(partes.error.message);
    const mendoza = (partes.data as unknown as Array<{ fecha_inicio: string | null; producto: { codigo: string } | null }>).find(
      (p) => p.producto?.codigo === "OD019",
    )?.fecha_inicio;
    if (!mendoza) throw new Error("La reserva no tiene la parte de Mendoza (OD019) con fecha.");

    const armado = await armarYGuardarPedidos(admin, fila.id);
    if (!armado.ok) throw new Error(armado.error);
    return { reserva: { id: fila.id, estado: fila.estado, producto: fila.producto?.codigo ?? null }, mendoza, pedidos: (await cargarPedidos(admin, fila.id)).pedidos };
  }

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await importarCodigosAgencias(admin, readFileSync(join(RAIZ, "data", "codigos-agencias.csv"), "utf-8"));
    deps = await cargarDependenciasReservas(admin);
    const mes = String(MES).padStart(2, "0");
    conEleccion = await recorrer(`2027-${mes}-11`, true);
    sinEleccion = await recorrer(`2027-${mes}-13`, false);
    if (process.env.MOSTRAR_PEDIDOS) {
      for (const [que, a] of [["con bike + rafting", conEleccion], ["sin elección", sinEleccion]] as const) {
        for (const p of a.pedidos.filter((x) => x.proveedores.some((n) => /naranja|summa|huentata|kahuak/i.test(n)))) {
          console.log(`--- ${que} · ${p.proveedores.join(", ")} (Mendoza desde ${a.mendoza})\n${p.cuerpo}\n`);
        }
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

  const de = (a: Armado, proveedor: string) => a.pedidos.find((p) => p.proveedores.some((x) => x.toLowerCase() === proveedor.toLowerCase()));

  it("las dos reservas quedan recibidas como BRARCH26", () => {
    expect(conEleccion.reserva).toMatchObject({ producto: "BRARCH26", estado: "recibida" });
    expect(sinEleccion.reserva).toMatchObject({ producto: "BRARCH26", estado: "recibida" });
  });

  it("con bike: el Bike Tour a La Bicicleta Naranja con el punto de encuentro, sin pick up", () => {
    const naranja = de(conEleccion, "La Bicicleta Naranja")!;
    expect(naranja.cuerpo).toContain("Excursión: Bike Tour");
    expect(naranja.cuerpo).toContain("Punto de encuentro: Pasaje Giuffra 370, San Telmo (el pasajero va directo)");
    expect(naranja.cuerpo).not.toMatch(/Pick up/);
  });

  it("sin elección: el City Tour a Grupo Summa sigue con pick up en el hotel", () => {
    const summa = de(sinEleccion, "Grupo Summa")!;
    expect(summa.cuerpo).toMatch(/Pick up( y drop off)?: /);
    expect(summa.cuerpo).not.toContain("Punto de encuentro");
  });

  it("con rafting: Huentata solo Bodegas el día 1 por la tarde y KAHUAK el Rafting el día 2 de Mendoza", () => {
    const { mendoza } = conEleccion;
    const huentata = de(conEleccion, "Huentata")!;
    expect(huentata.cuerpo).toContain(`Excursión: Bodegas half Day\nFecha: ${fechaCorta(mendoza)}, por la tarde (14:30 aprox.)`);
    expect(huentata.cuerpo).not.toMatch(/Alta Monta/);
    const kahuak = de(conEleccion, "KAHUAK")!;
    expect(kahuak.cuerpo).toContain(`Excursión: Rafting\nFecha: ${fechaCorta(sumarDias(mendoza, 1))}\n`);
    expect(kahuak.cuerpo).not.toContain("a coordinar");
  });

  it("sin elección: Huentata con Bodegas el día 1 por la tarde y Alta Montaña el día 2, nada a KAHUAK", () => {
    const { mendoza } = sinEleccion;
    const huentata = de(sinEleccion, "Huentata")!;
    expect(huentata.cuerpo).toContain(`Excursión: Bodegas half Day\nFecha: ${fechaCorta(mendoza)}, por la tarde (14:30 aprox.)`);
    expect(huentata.cuerpo).toContain(`Excursión: Alta Montaña\nFecha: ${fechaCorta(sumarDias(mendoza, 1))}\n`);
    expect(huentata.cuerpo).not.toContain("Fecha: a coordinar");
    expect(de(sinEleccion, "KAHUAK")).toBeUndefined();
  });

  it("volver a armar deja los borradores sin editar con lo mismo", async () => {
    const antes = conEleccion.pedidos.map((p) => p.cuerpo).sort();
    const r = await armarYGuardarPedidos(admin, conEleccion.reserva.id);
    if (!r.ok) throw new Error(r.error);
    const despues = (await cargarPedidos(admin, conEleccion.reserva.id)).pedidos.map((p) => p.cuerpo).sort();
    expect(despues).toEqual(antes);
  });
});
