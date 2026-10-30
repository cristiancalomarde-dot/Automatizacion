// @vitest-environment jsdom
//
// Spec M3-27 — verificación 3 (regla #5): el recorrido. Reservas de AR10 llegan por el flujo de M2
// (statement de TourRadar → lectura con la IA FALSA → emparejado por el nombre → reserva recibida)
// contra la BASE DE PRUEBAS, y una persona del equipo (sesión real) abre el detalle. AR10 toma el bus
// Bariloche → El Chaltén el día 12 (data/tramos-se-piden-a.csv):
// - sale el vie 30 oct 2026 → el bus cae el mar 10 nov, día sin salida: el bloque amarillo "Revisar
//   antes de pedir" lo avisa con las próximas salidas;
// - corrida al dom 1 nov 2026 → el bus cae el jue 12 nov, día con salida: el aviso desaparece;
// - sale el sáb 20 feb 2027 → el bus cae el mié 3 mar 2027, fuera del calendario cargado: avisa que
//   hay que confirmar con Chalten Travel.
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9). Todo lo que crea
// lleva la marca de prueba y se borra al terminar, solo eso. No se envía nada (#4).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { clienteFalso, registroFalso, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { REMITENTE_STATEMENT_TOURRADAR } from "@/lib/reservas/filtro-entrada";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { procesarMail as procesarMailReal } from "@/lib/reservas/procesar-mail";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const cliente = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => cliente.actual }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => cliente.actual }));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams(),
}));

import { DetalleReservaPantalla } from "@/components/reservas/detalle-reserva-pantalla";

const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
const SUFIJO = String(Date.now()).slice(-3);
const ESPERA = { timeout: 120_000 };
const DEL_BUS = /Bariloche (→|↔) El Chaltén/;

function ficha(numero: string, inicio: string) {
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "TourRadar", confianza: 1 },
    numero_reserva: { valor: numero, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [
      { nombre: "Full Argentina Adventure – 21 Days", codigo: null, fecha_inicio: inicio, fecha_fin: null, habitacion: "Double Hostel", noches: null, punto_recogida: null, opcionales: [], confianza: 1 },
    ],
    fecha_inicio: { valor: inicio, confianza: 1 },
    fecha_fin: { valor: null, confianza: 0 },
    pax: { valor: 2, confianza: 1 },
    pasajeros: [
      { nombre: "Ana", apellido: "Prueba", nacionalidad: "Australia", fecha_nacimiento: "1990-05-17", confianza: 1 },
      { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Australia", fecha_nacimiento: "1991-02-03", confianza: 1 },
    ],
    vuelos: [],
    hoteles_agencia: [],
    todos_hoteles_agencia: { valor: false, confianza: 1 },
    pedidos_especiales: [],
    pdf_ilegible: false,
    aviso: null,
  };
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-27 — recorrido: el calendario del bus Bariloche → El Chaltén en el detalle de AR10", { timeout: 600_000 }, () => {
  let admin: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let soltarBloqueo: () => void;
  let deps: DependenciasReservas;

  async function llega(numero: string, inicio: string): Promise<string> {
    const f = ficha(numero, inicio);
    const { cliente: ia } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const r = await procesarMail(
      {
        origen: "archivo",
        messageId: `<m3-27-recorrido-${randomUUID()}@prueba.hitravel.local>`,
        remitente: REMITENTE_STATEMENT_TOURRADAR,
        asunto: `Booking Statement ${numero} - 1 - vendorbill`,
        cuerpoTexto: `Mail sintético de prueba (sin datos de nadie).\nBooking ${numero}\n2 Full Argentina Adventure – 21 Days from ${inicio} - 2 Double Hostel`,
        adjuntos: [],
        dePrueba: true,
      },
      {
        admin,
        leer: (mail, ctx) => {
          registro.mail(ctx.mailRecibidoId);
          return leerMailConIA(mail, { cliente: ia, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
        },
        deps: () => deps,
        llamadas: crearRegistroLlamadasSupabase(admin),
        dePrueba: true,
        alcance: () => registro.mails,
      },
    );
    if (r.estado !== "procesado") throw new Error(`El statement no se procesó: ${r.estado}`);
    const id = r.pedidos[0].reservaId;
    const { data, error } = await admin.from("reserva").select("estado, producto:producto_id(codigo)").eq("id", id).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { estado: string; producto: { codigo: string } | null };
    expect([fila.producto?.codigo, fila.estado]).toEqual(["AR10", "recibida"]);
    return id;
  }

  /** Las líneas del bloque amarillo (vacío si no aparece), después de que el bloque termina de calcularse. */
  async function avisosDelDetalle(id: string): Promise<string[]> {
    render(<DetalleReservaPantalla id={id} />);
    await screen.findByTestId("encabezado-reserva", {}, ESPERA);
    let bloque: HTMLElement | null = null;
    try {
      bloque = await screen.findByTestId("revisar-antes-de-pedir", {}, { timeout: 20_000 });
    } catch {
      bloque = null;
    }
    expect(screen.queryByTestId("revisar-antes-error")).toBeNull();
    const lineas = bloque ? within(bloque).getAllByRole("listitem").map((li) => li.textContent ?? "") : [];
    if (bloque) expect(bloque.closest("[role='status']")!.className).toMatch(/aviso_aviso/);
    cleanup();
    return lineas;
  }

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const sesion = await crearSesionDePrueba();
    equipo = sesion.cliente;
    borrarSesion = sesion.borrar;
    cliente.actual = equipo;
    deps = await cargarDependenciasReservas(admin);
  }, 600_000);

  afterAll(async () => {
    cleanup();
    try {
      await registro.limpiar(admin);
      await borrarSesion?.();
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  it("sale el 30 oct 2026: el bus cae el mar 10 nov, día sin salida, y el bloque amarillo lo avisa", async () => {
    const lineas = await avisosDelDetalle(await llega(`9127${SUFIJO}1`, "2026-10-30"));
    console.log(`[M3-27 recorrido] 30 oct 2026, Revisar antes de pedir:\n  ${lineas.join("\n  ")}`);
    expect(lineas.filter((l) => DEL_BUS.test(l))).toEqual([
      "El bus Bariloche → El Chaltén cae el mar 10 nov 2026 y ese día no sale (sale 12, 14, 16 nov…).",
    ]);
    // La reserva se borra antes de la siguiente (si no, la siguiente podría ser "posible duplicada").
    await registro.limpiar(admin);
  });

  it("corrida al 1 nov 2026: el bus cae el jue 12 nov, día con salida, y el aviso desaparece", async () => {
    const lineas = await avisosDelDetalle(await llega(`9127${SUFIJO}2`, "2026-11-01"));
    console.log(`[M3-27 recorrido] 1 nov 2026, Revisar antes de pedir:\n  ${lineas.join("\n  ")}`);
    expect(lineas.filter((l) => DEL_BUS.test(l))).toEqual([]);
    await registro.limpiar(admin);
  });

  it("sale el 20 feb 2027: el bus cae el mié 3 mar 2027, fuera del calendario, y avisa que hay que confirmar", async () => {
    const lineas = await avisosDelDetalle(await llega(`9127${SUFIJO}3`, "2027-02-20"));
    console.log(`[M3-27 recorrido] 20 feb 2027, Revisar antes de pedir:\n  ${lineas.join("\n  ")}`);
    expect(lineas.filter((l) => DEL_BUS.test(l))).toEqual([
      "Calendario del bus Bariloche ↔ El Chaltén sin cargar para el mié 3 mar 2027: confirmar con Chalten Travel.",
    ]);
  });
});
