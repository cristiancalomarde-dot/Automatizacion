// @vitest-environment node
//
// Spec M3-21 — verificación 3 (regla #5): el recorrido. El mail de ejemplo de
// Kilroy DK1576932 (ARCH33 con "Dormitory - Hostel and W-Trek Tent" + el Overland de
// CHB31) entra por el flujo de M2 (mail → lectura → emparejado → reservas, en modo
// prueba y con la IA FALSA: no gasta) contra la BASE DE PRUEBAS, dos veces: tal cual
// (2 pax) y como si fuera de 1 pax. Con 2 pax la carpa sin cantidad es "Tent DBL";
// con 1 pax queda a confirmar con el aviso de que Tent SGL es mucho más caro (interno,
// no va en el texto). Los dorm del tour y el Overland no cambian. "Volver a armar"
// deja los borradores sin editar con lo mismo. No se envía nada (#4).
//
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { armarYGuardarPedidos, cargarPedidos, type PedidoGuardado } from "@/lib/pedidos/guardar";
import { cargarAlojamientosSinDesayuno } from "@/lib/pedidos/cargar";
import { sinDesayuno } from "@/lib/pedidos/formato";
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
const BASE = String(Date.now()).slice(-4);
const SIN_DESAYUNO = cargarAlojamientosSinDesayuno();
const TREK_A_CONFIRMAR = "Alojamiento en el trek: a confirmar (Refugio Dorm a compartir / Tent DBL / Tent SGL)";
const AVISO_1_PAX = /^Falta el tipo de alojamiento del W[\s-]?Trek.*\(1 pax\): Tent SGL es mucho más caro que el Refugio Dorm; revisalo con el vendedor\.$/;

const lineas = (cuerpo: string) => cuerpo.split("\n").map((l) => l.replace(/^\d+\) /, ""));

interface Corrida {
  reservas: Array<{ id: string; estado: string; producto: string | null }>;
  pedidos: Map<string, PedidoGuardado[]>;
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-21 — recorrido: la carpa del W Trek según los pax", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  const corridas = new Map<number, Corrida>();

  async function correr(pax: number): Promise<Corrida> {
    const ref = `DK2${pax}${BASE}${String(Math.floor(Math.random() * 10))}`;
    const texto = readFileSync(join(RAIZ, "src/lib/reservas/__fixtures__/mails/kilroy-dk1576932.txt"), "utf-8").replaceAll("DK1576932", ref);
    const mail = parsearMailDeTexto(texto);
    const f = JSON.parse(JSON.stringify(fichaGrabada("kilroy-dk1576932")).replaceAll("DK1576932", ref)) as {
      pax: { valor: number; confianza: number };
      pasajeros: unknown[];
    };
    f.pax = { valor: pax, confianza: 1 };
    f.pasajeros = f.pasajeros.slice(0, pax);
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (m, ctx) =>
      leerMailConIA(m, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-21-${randomUUID()}@prueba.hitravel.local>`,
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
    const corrida: Corrida = { reservas: [], pedidos: new Map() };
    for (const { reservaId } of r.pedidos) {
      const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", reservaId).single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
      corrida.reservas.push({ id: reservaId, estado: fila.estado, producto: fila.producto?.codigo ?? null });
      const armado = await armarYGuardarPedidos(admin, reservaId);
      if (!armado.ok) throw new Error(armado.error);
      corrida.pedidos.set(reservaId, (await cargarPedidos(admin, reservaId)).pedidos);
    }
    return corrida;
  }

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await importarCodigosAgencias(admin, readFileSync(join(RAIZ, "data", "codigos-agencias.csv"), "utf-8"));
    deps = await cargarDependenciasReservas(admin);
    corridas.set(2, await correr(2));
    corridas.set(1, await correr(1));
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  const de = (pax: number, codigo: string) => {
    const c = corridas.get(pax)!;
    return c.pedidos.get(c.reservas.find((x) => x.producto === codigo)!.id)!;
  };
  const trekDe = (pax: number) => de(pax, "ARCH33").find((x) => /W[\s-]?Trek/i.test(x.cuerpo))!;

  it("en cada corrida quedan dos reservas recibidas: ARCH33 y CHB31", () => {
    for (const pax of [2, 1]) {
      expect(corridas.get(pax)!.reservas.map(({ producto, estado }) => [producto, estado]).sort()).toEqual([["ARCH33", "recibida"], ["CHB31", "recibida"]]);
    }
  });

  it("2 pax: «Alojamiento en el trek: Tent DBL», sin aviso del trek", () => {
    const p = trekDe(2);
    const bloque = p.cuerpo.slice(p.cuerpo.search(/W[\s-]?Trek/i)).split("\n\n")[0];
    console.log(`[M3-21] recorrido ARCH33 2 pax:\n${bloque}`);
    expect(lineas(bloque)[2]).toBe("Alojamiento en el trek: Tent DBL");
    expect(p.avisos.filter((a) => /alojamiento del W/i.test(a))).toEqual([]);
  });

  it("1 pax: a confirmar y el aviso de que Tent SGL es mucho más caro (no va en el texto)", () => {
    const p = trekDe(1);
    const bloque = p.cuerpo.slice(p.cuerpo.search(/W[\s-]?Trek/i)).split("\n\n")[0];
    console.log(`[M3-21] recorrido ARCH33 1 pax:\n${bloque}\n  avisos: ${p.avisos.filter((a) => /alojamiento del W/i.test(a)).join(" | ")}`);
    expect(lineas(bloque)[2]).toBe(TREK_A_CONFIRMAR);
    expect(p.avisos.some((a) => AVISO_1_PAX.test(a))).toBe(true);
    for (const x of de(1, "ARCH33")) expect(x.cuerpo).not.toMatch(/vendedor|mucho más caro/);
  });

  it("los dorm del tour y el Overland no cambian", () => {
    for (const pax of [2, 1]) {
      const habs: Array<[string, string]> = [];
      for (const p of de(pax, "ARCH33")) {
        const l = lineas(p.cuerpo);
        l.forEach((x, i) => {
          if (x.startsWith("Alojamiento: ")) habs.push([x.replace("Alojamiento: ", ""), l.slice(i + 1, i + 5).find((y) => y.startsWith("Habitación:")) ?? "(sin renglón)"]);
        });
      }
      expect(habs.length).toBeGreaterThan(0);
      // M3-35: los sin desayuno (Puma Hostel) piden el dorm sin "con desayuno".
      for (const [hotel, h] of habs) expect(h).toBe(sinDesayuno(hotel, SIN_DESAYUNO) ? "Habitación: dorm compartido" : "Habitación: dorm compartido, con desayuno");
      const c = de(pax, "CHB31").map((p) => p.cuerpo).find((x) => x.includes("Overland"))!;
      expect(c.slice(c.indexOf("Overland")).split("\n\n")[0]).toContain("Habitación: DBL con baño compartido");
    }
  });

  it("volver a armar deja los borradores sin editar con lo mismo", async () => {
    for (const pax of [2, 1]) {
      const c = corridas.get(pax)!;
      for (const { id } of c.reservas) {
        const antes = c.pedidos.get(id)!.map((p) => p.cuerpo).sort();
        const r = await armarYGuardarPedidos(admin, id);
        if (!r.ok) throw new Error(r.error);
        const despues = (await cargarPedidos(admin, id)).pedidos.map((p) => p.cuerpo).sort();
        expect(despues).toEqual(antes);
      }
    }
  });
});
