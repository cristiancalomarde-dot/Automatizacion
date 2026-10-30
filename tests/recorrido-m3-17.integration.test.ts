// @vitest-environment node
//
// Spec M3-17 — verificación 3 (regla #5): el recorrido. El mail de ejemplo de
// Adventure360 (BRARCH26) entra por el flujo de M2 (mail → lectura → emparejado
// → reserva, en modo prueba y con la IA FALSA: no gasta) contra la BASE DE
// PRUEBAS. La reserva queda recibida y arma sus pedidos con las excursiones en su
// día fijo, contado desde el inicio de cada componente (data/dias-servicio.csv):
// - Río (OD032): Big Dude el día 2;
// - Iguazú (OD010A, 105 Premium): lado argentino el día 2 y brasileño el día 3;
// - Buenos Aires (OD018): Tango el día 3, por la noche;
// - Santiago (OD029): Bike Tour el día 2.
// "Volver a armar" deja los borradores sin editar con lo mismo. No se envía nada (#4).
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
/** Un mes por corrida (enero a diciembre de 2027): no choca con otra corrida a medio borrar. */
const MES = (Date.now() % 12) + 1;
const MESES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-17 — recorrido: BRARCH26 con cada excursión en su día fijo", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  let reservaId: string;
  let estado: { estado: string; producto: string | null };
  let pedidos: PedidoGuardado[];
  /** El primer día de cada componente de la reserva. */
  const inicio: Record<string, string> = {};

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
      messageId: `<m3-17-${randomUUID()}@prueba.hitravel.local>`,
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
    const partes = await admin.from("reserva_componente").select("fecha_inicio, producto:producto_id(codigo)").eq("reserva_id", reservaId);
    if (partes.error) throw new Error(partes.error.message);
    for (const p of partes.data as unknown as Array<{ fecha_inicio: string | null; producto: { codigo: string } | null }>) {
      if (p.producto && p.fecha_inicio) inicio[p.producto.codigo] = p.fecha_inicio;
    }
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

  /** El cuerpo del pedido que tiene ese renglón. */
  const conRenglon = (empieza: string) => pedidos.find((p) => p.cuerpo.split("\n").some((l) => l.replace(/^\d+\) /, "").startsWith(empieza)))?.cuerpo ?? "";
  const dia = (codigo: string, n: number) => fechaCorta(sumarDias(inicio[codigo], n - 1));

  it("la reserva queda recibida como BRARCH26, con Río, Iguazú, Buenos Aires y Santiago", () => {
    expect(estado).toMatchObject({ producto: "BRARCH26", estado: "recibida" });
    for (const c of ["OD032", "OD010A", "OD018", "OD029"]) expect(inicio[c], c).toBeTruthy();
  });

  // M3-32: Big Dude es de Río de Janeiro: su pedido va en portugués.
  it("Río: Big Dude el día 2", () => {
    expect(conRenglon("Passeio: Big Dude")).toContain(`Passeio: Big Dude\nData: ${fechaCorta(sumarDias(inicio.OD032, 1), "pt")}\n`);
  });

  it("Iguazú: lado argentino el día 2 y brasileño el día 3", () => {
    const c = conRenglon("Lado argentino").split("\n");
    expect(c.find((l) => l.startsWith("Lado argentino"))).toContain(`: ${dia("OD010A", 2)} ·`);
    expect(c.find((l) => l.startsWith("Lado brasileño"))).toContain(`: ${dia("OD010A", 3)} ·`);
  });

  it("Buenos Aires: el Tango el día 3, por la noche", () => {
    expect(conRenglon("Excursión: Tango Show")).toContain(`Excursión: Tango Show with dinner, drinks and transfers\nFecha: ${dia("OD018", 3)}, por la noche\n`);
  });

  // El de Buenos Aires (La Bicicleta Naranja, si eligió bike) también se llama "Bike Tour": el de Santiago es el de Bicicleta Verde.
  const bikeSantiago = () => pedidos.find((p) => p.proveedores.some((x) => /bicicleta verde/i.test(x)))?.cuerpo ?? "";

  it("Santiago: Bike Tour el día 2", () => {
    expect(bikeSantiago()).toContain(`Excursión: Bike Tour\nFecha: ${dia("OD029", 2)}\n`);
  });

  it("ninguna de esas excursiones queda a coordinar", () => {
    for (const r of ["Passeio: Big Dude", "Lado argentino", "Excursión: Tango Show"]) {
      expect(conRenglon(r), r).toBeTruthy();
      expect(conRenglon(r), r).not.toMatch(/Fecha: a coordinar|Data: a combinar/);
    }
    expect(bikeSantiago()).not.toContain("Fecha: a coordinar");
  });

  it("volver a armar deja los borradores sin editar con lo mismo", async () => {
    const antes = pedidos.map((p) => p.cuerpo).sort();
    const r = await armarYGuardarPedidos(admin, reservaId);
    if (!r.ok) throw new Error(r.error);
    const despues = (await cargarPedidos(admin, reservaId)).pedidos.map((p) => p.cuerpo).sort();
    expect(despues).toEqual(antes);
  });
});
