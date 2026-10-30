// @vitest-environment node
//
// Spec M3-33 — verificación 3 (regla #5): el recorrido. El mail de ejemplo de
// Kilroy DK1576932 (ARCH33 con el W Trek Standard + el Overland de CHB31), con la
// habitación del ARCH33 como la de DK1594177 ("Double Room - Hostel and W-Trek Tent"),
// entra por el flujo de M2 (mail → lectura → emparejado → reservas, en modo prueba y
// con la IA FALSA: no gasta) contra la BASE DE PRUEBAS. Las reservas quedan recibidas
// y arman sus pedidos: el del W Trek a Las Torres dice, debajo de "Alojamiento en el
// trek: Tent DBL", "Refugios: Central (…) – Central (…) – Francés (…) – Paine Grande (…)"
// con las fechas de esa parte del tour; el Overland no lleva refugios. "Volver a armar"
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
/** Una referencia por corrida: no choca con otra corrida (ni con los tests de M2 que usan DK1576932). */
const REF = `DK33${String(Date.now()).slice(-5)}`;
const HABITACION = "Double Room - Hostel and W-Trek Tent";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const lineas = (cuerpo: string) => cuerpo.split("\n").map((l) => l.replace(/^\d+\) /, ""));

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-33 — recorrido: el W Trek de ARCH33 dice sus refugios", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  let reservas: Array<{ id: string; estado: string; producto: string | null }>;
  const pedidos = new Map<string, PedidoGuardado[]>();

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await importarCodigosAgencias(admin, readFileSync(join(RAIZ, "data", "codigos-agencias.csv"), "utf-8"));
    deps = await cargarDependenciasReservas(admin);

    const texto = readFileSync(join(RAIZ, "src/lib/reservas/__fixtures__/mails/kilroy-dk1576932.txt"), "utf-8")
      .replaceAll("DK1576932", REF)
      .replace("Type: Dormitory - Hostel and W-Trek Tent", `Type: ${HABITACION}`);
    const mail = parsearMailDeTexto(texto);
    const f = JSON.parse(JSON.stringify(fichaGrabada("kilroy-dk1576932")).replaceAll("DK1576932", REF)) as { productos: Array<Record<string, unknown>> };
    f.productos[0].habitacion = HABITACION;
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (m, ctx) =>
      leerMailConIA(m, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-33-${randomUUID()}@prueba.hitravel.local>`,
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
    reservas = [];
    for (const { reservaId } of r.pedidos) {
      const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", reservaId).single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
      reservas.push({ id: reservaId, estado: fila.estado, producto: fila.producto?.codigo ?? null });
      const armado = await armarYGuardarPedidos(admin, reservaId);
      if (!armado.ok) throw new Error(armado.error);
      pedidos.set(reservaId, (await cargarPedidos(admin, reservaId)).pedidos);
    }
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  const de = (codigo: string) => pedidos.get(reservas.find((x) => x.producto === codigo)!.id)!;

  it("quedan dos reservas recibidas: ARCH33 y CHB31", () => {
    expect(reservas.map(({ producto, estado }) => [producto, estado]).sort()).toEqual([["ARCH33", "recibida"], ["CHB31", "recibida"]]);
  });

  it("el pedido del W Trek a Las Torres dice los refugios con las fechas de esa parte del tour", () => {
    const p = de("ARCH33").find((x) => /W[\s-]?Trek/i.test(x.cuerpo))!;
    const bloque = p.cuerpo.slice(p.cuerpo.search(/W[\s-]?Trek/i)).split("\n\n")[0];
    console.log(`[M3-33] recorrido ARCH33 (${p.proveedores.join(", ")}):\n${bloque}`);
    expect(p.proveedores.join(" ")).toMatch(/Las Torres/i);
    const l = lineas(bloque);
    expect(l[1]).toMatch(/^Desde: .* · Hasta: /);
    expect(l[2]).toBe("Alojamiento en el trek: Tent DBL");
    const m = l[1].match(/^Desde: (\d+) (\w+) (\d{4})/)!;
    const inicio = `${m[3]}-${String(MESES.indexOf(m[2]) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const noches = ["Central", "Central", "Francés", "Paine Grande"].map((r, i) => {
      const d = new Date(`${inicio}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return `${r} (${d.getUTCDate()} ${MESES[d.getUTCMonth()]})`;
    });
    expect(l[3]).toBe(`Refugios: ${noches.join(" – ")}`);
    expect(de("ARCH33").flatMap((x) => lineas(x.cuerpo)).filter((x) => x.startsWith("Refugios:"))).toHaveLength(1);
    expect(de("ARCH33").flatMap((x) => x.avisos).filter((a) => /Refugios del W Trek sin cargar/.test(a))).toEqual([]);
  });

  it("el Overland de CHB31 no lleva refugios ni renglón del trek", () => {
    const cuerpos = de("CHB31").map((p) => p.cuerpo).join("\n");
    expect(cuerpos).not.toContain("Refugios:");
    expect(cuerpos).not.toContain("Alojamiento en el trek");
  });

  it("volver a armar deja los borradores sin editar con lo mismo", async () => {
    for (const { id } of reservas) {
      const antes = pedidos.get(id)!.map((p) => p.cuerpo).sort();
      const r = await armarYGuardarPedidos(admin, id);
      if (!r.ok) throw new Error(r.error);
      const despues = (await cargarPedidos(admin, id)).pedidos.map((p) => p.cuerpo).sort();
      expect(despues).toEqual(antes);
    }
  });
});
