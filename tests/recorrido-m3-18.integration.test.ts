// @vitest-environment node
//
// Spec M3-18 — verificación 3 (regla #5): el recorrido. El mail de ejemplo de
// Adventure360 (BRARCH26, habitación "Hostel Dorm") entra por el flujo de M2
// (mail → lectura → emparejado → reserva, en modo prueba y con la IA FALSA: no
// gasta) contra la BASE DE PRUEBAS. La reserva queda recibida y arma sus pedidos:
// cada alojamiento pide "Habitación: dorm compartido, con desayuno" (Standard y
// con desayuno, M3-18); las excursiones y los traslados no llevan desayuno.
// "Volver a armar" deja los borradores sin editar con lo mismo. No se envía nada (#4).
//
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
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
/** Un mes por corrida (enero a diciembre de 2027): no choca con otra corrida a medio borrar. */
const MES = (Date.now() % 12) + 1;
const MESES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Los renglones de un pedido sin la numeración de cada servicio ("1) Alojamiento: …"). */
const renglones = (cuerpo: string) => cuerpo.split("\n").map((l) => l.replace(/^\d+\) /, ""));

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-18 — recorrido: BRARCH26 pide cada alojamiento Standard con desayuno", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  let reservaId: string;
  let estado: { estado: string; producto: string | null };
  let pedidos: PedidoGuardado[];

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await importarCodigosAgencias(admin, readFileSync(join(RAIZ, "data", "codigos-agencias.csv"), "utf-8"));
    deps = await cargarDependenciasReservas(admin);

    const llegada = `2027-${String(MES).padStart(2, "0")}-15`;
    const texto = readFileSync(join(RAIZ, "src/lib/reservas/__fixtures__/mails/adventure360-brarch26.txt"), "utf-8").replace(
      "Arrival date: 10th November 2026",
      `Arrival date: 15th ${MESES[MES - 1]} 2027`,
    );
    const mail = parsearMailDeTexto(texto);
    const f = fichaGrabada("adventure360-brarch26") as { productos: Array<Record<string, unknown>>; fecha_inicio: { valor: string } };
    f.productos[0].fecha_inicio = llegada;
    f.fecha_inicio.valor = llegada;
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (m, ctx) =>
      leerMailConIA(m, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-18-${randomUUID()}@prueba.hitravel.local>`,
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
    reservaId = r.pedidos[0].reservaId;
    const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", reservaId).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
    estado = { estado: fila.estado, producto: fila.producto?.codigo ?? null };
    const armado = await armarYGuardarPedidos(admin, reservaId);
    if (!armado.ok) throw new Error(armado.error);
    pedidos = (await cargarPedidos(admin, reservaId)).pedidos;
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  it("la reserva queda recibida como BRARCH26", () => {
    expect(estado).toMatchObject({ producto: "BRARCH26", estado: "recibida" });
  });

  it("cada alojamiento pide «Habitación: dorm compartido, con desayuno»", () => {
    const habs: Array<[string, string]> = [];
    for (const p of pedidos) {
      const l = renglones(p.cuerpo);
      l.forEach((x, i) => {
        if (x.startsWith("Alojamiento: ")) habs.push([x, l.slice(i + 1, i + 5).find((y) => y.startsWith("Habitación:")) ?? "(sin renglón)"]);
      });
    }
    console.log(`[M3-18] recorrido BRARCH26: ${habs.map(([a, h]) => `${a} → ${h}`).join(" | ")}`);
    expect(habs.length).toBeGreaterThan(0);
    for (const [, h] of habs) expect(h).toBe("Habitación: dorm compartido, con desayuno");
  });

  it("solo los alojamientos llevan desayuno (ni excursiones ni traslados)", () => {
    for (const p of pedidos) {
      const l = renglones(p.cuerpo);
      l.forEach((x, i) => {
        if (/desayuno/.test(x)) {
          expect(x, x).toMatch(/^Habitación: /);
          // El renglón de habitación es del alojamiento de arriba.
          expect(l.slice(Math.max(0, i - 4), i).some((y) => y.startsWith("Alojamiento: ")), x).toBe(true);
        }
      });
    }
  });

  it("volver a armar deja los borradores sin editar con lo mismo", async () => {
    const antes = pedidos.map((p) => p.cuerpo).sort();
    const r = await armarYGuardarPedidos(admin, reservaId);
    if (!r.ok) throw new Error(r.error);
    const despues = (await cargarPedidos(admin, reservaId)).pedidos.map((p) => p.cuerpo).sort();
    expect(despues).toEqual(antes);
  });
});
