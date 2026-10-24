// @vitest-environment node
//
// Spec M3-20 — verificación 3 (regla #5): el recorrido. El mail de ejemplo de
// Kilroy DK1576932 (ARCH33 + el Overland de CHB31) con un AR34 más (como
// DK1594177) y los vuelos a El Calafate (el del ARCH33 llega a las 18:30, el del
// AR34 a las 09:10) entra por el flujo de M2 (mail → lectura → emparejado →
// reservas, en modo prueba y con la IA FALSA: no gasta) contra la BASE DE PRUEBAS.
// Las reservas quedan recibidas y arman sus pedidos a Chalten Travel: en ARCH33
// la llegada desde el aeropuerto es "Bus regular El Calafate Airport → El
// Chaltén (terminal)" con el vuelo y el borrador avisa que el vuelo llega después
// de las 17 hs (el texto no); el public bus de vuelta dice "Horario: 8:00 am". En
// AR34 el round trip sale en dos renglones: ida el día 1 con su vuelo, vuelta el
// día que sale de El Chaltén (día 4) a las 8:00 am, sin aviso. "Volver a armar"
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
const REF = `DK20${String(Date.now()).slice(-5)}`;
const AVISO =
  "El vuelo llega después de las 17 hs: puede no haber bus a El Chaltén. Revisalo con el vendedor de la agencia (traslado privado, más caro; o shuttle de Las Lengas).";
const IDA = "Bus regular El Calafate Airport → El Chaltén (terminal)";

const lineas = (cuerpo: string) => cuerpo.split("\n").map((l) => l.replace(/^\d+\) /, ""));
function bloque(cuerpo: string, primero: string): string[] {
  const l = lineas(cuerpo);
  const i = l.indexOf(primero);
  if (i < 0) return [];
  const fin = l.indexOf("", i);
  return l.slice(i, fin < 0 ? undefined : fin);
}
const vuelo = (numero: string, fecha: string, hora: string) => ({
  numero,
  aerolinea: "Aerolíneas Argentinas",
  origen: "AEP",
  destino: "FTE",
  fecha_salida: fecha,
  hora_salida: "05:30",
  fecha_llegada: fecha,
  hora_llegada: hora,
  confianza: 1,
});

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-20 — recorrido: los buses de El Chaltén de ARCH33 y AR34", { timeout: 300_000 }, () => {
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

    // El mail con los vuelos escritos y un TOUR 3 (AR34): la lectura solo acepta lo que está en el texto.
    const texto = readFileSync(join(RAIZ, "src/lib/reservas/__fixtures__/mails/kilroy-dk1576932.txt"), "utf-8")
      .replaceAll("DK1576932", REF)
      .replace(/Flight info:\r?\nTOUR 2/, "Flight info:\nAR1840 Buenos Aires (AEP) - El Calafate (FTE) 23 Feb 2027 05:30 - 18:30\nTOUR 2")
      .replace(
        "PASSENGER INFORMATION",
        [
          "TOUR 3",
          "Tour name: El Chalten + El Calafate, Glaciers and Trekking",
          "Type: Double Room - Hostel",
          "Tour code: HI_ARGENTINA_AR34-677",
          "Start city: El Calafate",
          "Start date: 13 Mar 2027",
          "End city: El Calafate",
          "End date: 18 Mar 2027",
          `KILROY Reference.:${REF}/emhe`,
          "Flight info:",
          "AR1842 Buenos Aires (AEP) - El Calafate (FTE) 13 Mar 2027 05:30 - 09:10",
          "PASSENGER INFORMATION",
        ].join("\n"),
      );
    const mail = parsearMailDeTexto(texto);
    const f = JSON.parse(JSON.stringify(fichaGrabada("kilroy-dk1576932")).replaceAll("DK1576932", REF)) as {
      productos: Array<Record<string, unknown>>;
      vuelos: unknown[];
      fecha_fin: { valor: string | null; confianza: number };
    };
    // Un AR34 más, como DK1594177 (5 noches, de El Chaltén a El Calafate).
    f.productos.push({ ...f.productos[1], nombre: "El Chalten + El Calafate, Glaciers and Trekking", codigo: "HI_ARGENTINA_AR34-677", fecha_inicio: "2027-03-13", fecha_fin: "2027-03-18", habitacion: "Double Room - Hostel" });
    f.fecha_fin = { valor: "2027-03-18", confianza: 1 };
    f.vuelos = [vuelo("AR1840", "2027-02-23", "18:30"), vuelo("AR1842", "2027-03-13", "09:10")];
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (m, ctx) =>
      leerMailConIA(m, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-20-${randomUUID()}@prueba.hitravel.local>`,
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
      const { data, error } = await admin.from("reserva").select("estado, motivos_revision, producto:producto_id(codigo)").eq("id", reservaId).single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
      reservas.push({ id: reservaId, estado: fila.estado, producto: fila.producto?.codigo ?? null });
      if (fila.estado !== "recibida") {
        console.log(`[M3-20] ${fila.producto?.codigo} para revisión: ${JSON.stringify((data as { motivos_revision?: unknown }).motivos_revision)}`);
        continue;
      }
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

  const chalten = (codigo: string) => pedidos.get(reservas.find((x) => x.producto === codigo)!.id)!.find((p) => p.destinatarios.some((d) => /chaltentravel/i.test(d)))!;

  it("quedan tres reservas recibidas: ARCH33, CHB31 y AR34", () => {
    expect(reservas.map(({ producto, estado }) => [producto, estado]).sort()).toEqual([["AR34", "recibida"], ["ARCH33", "recibida"], ["CHB31", "recibida"]]);
  });

  it("ARCH33: bus regular desde el aeropuerto con el vuelo de las 18:30, public bus a las 8:00 am y el aviso solo en el borrador", () => {
    const p = chalten("ARCH33");
    console.log(`[M3-20] recorrido ARCH33 → Chalten Travel:\n${p.cuerpo}\n  avisos: ${JSON.stringify(p.avisos)}`);
    expect(bloque(p.cuerpo, IDA)).toEqual([IDA, "Fecha: 23 feb 2027 · Horario: según la llegada del vuelo", "Vuelo: AR1840 (FTE) llegada 18:30 hs"]);
    expect(bloque(p.cuerpo, "Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station")).toEqual([
      "Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station",
      "Fecha: 26 feb 2027 · Horario: 8:00 am",
    ]);
    expect(p.cuerpo).not.toContain("Traslado de llegada: Transfer El Calafate Airport to El Chalten");
    expect(p.avisos).toContain(AVISO);
    expect(p.cuerpo).not.toContain("17 hs");
  });

  it("AR34: el round trip en dos renglones (ida 13 mar con su vuelo, vuelta 16 mar a las 8:00 am), sin aviso", () => {
    const p = chalten("AR34");
    console.log(`[M3-20] recorrido AR34 → Chalten Travel:\n${p.cuerpo}\n  avisos: ${JSON.stringify(p.avisos)}`);
    expect(bloque(p.cuerpo, IDA)).toEqual([IDA, "Fecha: 13 mar 2027 · Horario: según la llegada del vuelo", "Vuelo: AR1842 (FTE) llegada 09:10 hs"]);
    expect(bloque(p.cuerpo, "Bus regular El Chaltén → El Calafate (ciudad)")).toEqual(["Bus regular El Chaltén → El Calafate (ciudad)", "Fecha: 16 mar 2027 · Horario: 8:00 am"]);
    expect(p.cuerpo).not.toContain("Round Trip FTE Airport");
    expect(p.avisos).not.toContain(AVISO);
  });

  it("el Overland de CHB31 no cambia (sin buses de El Chaltén)", () => {
    const cuerpos = pedidos.get(reservas.find((x) => x.producto === "CHB31")!.id)!.map((p) => p.cuerpo).join("\n");
    expect(cuerpos).toContain("Overland");
    expect(cuerpos).not.toContain("El Chaltén");
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
