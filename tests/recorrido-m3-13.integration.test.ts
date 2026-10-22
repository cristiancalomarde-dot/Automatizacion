// @vitest-environment node
//
// Spec M3-13 — verificación 3 (regla #5): el recorrido. El mail de ejemplo de
// Adventure360 (15/10, con el pasajero inventado y una fecha de llegada en vez de
// "TBC") entra por el flujo de M2 (mail → lectura → emparejado → reserva, en modo
// prueba y con la IA FALSA: no gasta) contra la BASE DE PRUEBAS, queda recibida
// como BRARCH26 y arma sus pedidos con el Bike Tour (La Bicicleta Naranja) y el
// rafting (Huentata solo Bodegas, KAHUAK el Rafting).
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
/** Un día por corrida (enero a diciembre de 2027): no choca con otra corrida a medio borrar (posible duplicada). */
const MES = (Date.now() % 12) + 1;
const MESES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LLEGADA = `2027-${String(MES).padStart(2, "0")}-10`;

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-13 — recorrido: el mail de Adventure360 llega, queda BRARCH26 y pide bike tour y rafting", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  let reserva: { id: string; estado: string; agencia: string; producto: string | null; habitacion: string | null };
  let pedidos: PedidoGuardado[];

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await importarCodigosAgencias(admin, readFileSync(join(RAIZ, "data", "codigos-agencias.csv"), "utf-8"));
    deps = await cargarDependenciasReservas(admin);

    // El mail de ejemplo, con la fecha de llegada de esta corrida ("10th <mes> 2027", como escribe Adventure360).
    const texto = readFileSync(join(RAIZ, "src/lib/reservas/__fixtures__/mails/adventure360-brarch26.txt"), "utf-8").replace(
      "Arrival date: 10th November 2026",
      `Arrival date: 10th ${MESES[MES - 1]} 2027`,
    );
    const mail = parsearMailDeTexto(texto);
    // Lo que "leyó" la IA falsa: la respuesta grabada del mail, con la misma fecha.
    const f = fichaGrabada("adventure360-brarch26") as { productos: Array<Record<string, unknown>>; fecha_inicio: { valor: string } };
    f.productos[0].fecha_inicio = LLEGADA;
    f.fecha_inicio.valor = LLEGADA;
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (m, ctx) =>
      leerMailConIA(m, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-13-${randomUUID()}@prueba.hitravel.local>`,
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
    const { data, error } = await admin
      .from("reserva")
      .select("id, estado, agencia, habitacion, producto:producto_id(codigo)")
      .eq("id", r.pedidos[0].reservaId)
      .single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { id: string; estado: string; agencia: string; habitacion: string | null; producto: { codigo: string } | null };
    reserva = { ...fila, producto: fila.producto?.codigo ?? null };

    const armado = await armarYGuardarPedidos(admin, reserva.id);
    if (!armado.ok) throw new Error(armado.error);
    pedidos = (await cargarPedidos(admin, reserva.id)).pedidos;
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  const a = (proveedor: string) => pedidos.find((p) => p.proveedores.some((x) => x.toLowerCase() === proveedor.toLowerCase()));

  it("el mail de Adventure360 queda recibido como BRARCH26, con Hostel Dorm", () => {
    expect(reserva).toMatchObject({ agencia: "Adventure360", producto: "BRARCH26", estado: "recibida", habitacion: "Hostel Dorm" });
  });

  it("Buenos Aires: el Bike Tour a La Bicicleta Naranja y nada de City Tour a Grupo Summa", () => {
    expect(a("La Bicicleta Naranja")?.cuerpo).toContain("Excursión: Bike Tour");
    expect(a("Grupo Summa")).toBeUndefined();
  });

  it("Mendoza: a Huentata solo Bodegas y a KAHUAK el Rafting, con la estadía en Mendoza", () => {
    expect(a("Huentata")?.cuerpo).toContain("Excursión: Bodegas half Day");
    expect(a("Huentata")?.cuerpo).not.toMatch(/Alta Monta/);
    const kahuak = a("KAHUAK")!;
    expect(kahuak.cuerpo).toContain("Excursión: Rafting");
    expect(kahuak.cuerpo).toMatch(/Pick up y drop off: .* \(Mendoza\)/);
    expect(kahuak.estado).toBe("borrador");
  });

  it("los demás pedidos del tour siguen saliendo (Río, Iguazú, Buenos Aires, Mendoza, Santiago)", () => {
    expect(pedidos.length).toBeGreaterThan(5);
    expect(pedidos.some((p) => p.cuerpo.includes("TRF IN"))).toBe(true);
  });
});
