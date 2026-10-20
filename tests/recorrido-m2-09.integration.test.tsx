// @vitest-environment jsdom
//
// Spec M2-09 §4 — verificación 3 (las pantallas): los 4 .docx reales de
// Journaway por el modo prueba (M2-06) contra la BASE DE PRUEBAS, y la lista
// y el detalle reales con una sesión del equipo. La IA es falsa (contesta la
// ficha de cada mail): la corrida con la IA real es `npm run probar:mails --
// --journaway`, que deja el reporte en docs/sdd/diagnosticos/M2-09-journaway.md.
//
// El recorrido del owner: abre la lista y ve cuatro reservas "de prueba"
// (IGRE01, IGRE02, SPAP01 + SPAP03 en una sola con el número de viaje, y
// SPAP05: un mail = una reserva, owner 2026-10-17);
// abre SPAP05 y ve los 8 hoteles en la sección informativa, los tours con su
// pick up y el vuelo LA148. Lo que crea se borra al final (solo eso).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { correrModoPrueba } from "@/lib/modo-prueba/corrida";
import { listarArchivos } from "@/lib/modo-prueba/leer-archivo";
import { respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import type { FichaIA } from "@/lib/reservas/esquema-ficha";
import { leerMailConIA, type ClienteMensajesIA } from "@/lib/reservas/extraer";
import { fichaIAJournaway } from "./fixtures/journaway/fichas";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const cliente = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => cliente.actual }));
// M3-08: la lista llega por una server action, con el cliente del servidor (la misma sesión de prueba).
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => cliente.actual }));
// M3-08: los viajes de estos mails reales son de octubre de 2026 en adelante; "hoy" queda antes, para que ninguno cuente como terminado.
vi.mock("@/lib/reservas/lista/terminadas", async (original) => ({
  ...(await original<typeof import("@/lib/reservas/lista/terminadas")>()),
  hoyEnArgentina: () => "2026-01-01",
}));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/reservas",
  // La lista muestra las de prueba con ?prueba=1 (M2-06).
  useSearchParams: () => new URLSearchParams("prueba=1"),
}));

import { DetalleReservaPantalla } from "@/components/reservas/detalle-reserva-pantalla";
import { ListaReservasPantalla } from "@/components/reservas/lista-reservas-pantalla";

const MAILS = join(__dirname, "..", "Insumos", "Mails");
const DOCX = [
  "Reserva de Cliente Journaway  - Iguazu Fall Argentina Side.docx",
  "Reserva de Cliente Journaway - Iguazu Falls Brazilian Side.docx",
  "Reserva de Cliente Journaway - All San Pedro 4 days mas San Pedro Extension.docx",
  "Reserva de Cliente Journaway - San Pedro de Atacama and Uyuni Salt Flats in Tayka Hotels 7N8D  SPAP05.docx",
].map((n) => join(MAILS, n));
const CORRE = credencialesSupabaseDisponibles() && DOCX.every((d) => existsSync(d));
const ESPERA = { timeout: 30_000 };
const registro = crearRegistroDePrueba();

function fichaPara(texto: string): FichaIA {
  if (texto.includes("Trip Number")) return fichaIAJournaway("C");
  if (texto.includes("Tayka")) return fichaIAJournaway("D");
  if (texto.includes("Argentinean side")) return fichaIAJournaway("A");
  return fichaIAJournaway("B");
}

const ia = {
  messages: {
    create: vi.fn(async (p: { messages: Array<{ content: Array<{ text?: string }> }> }) =>
      respuestaCon(fichaPara(p.messages[0].content.map((b) => b.text ?? "").join("\n"))),
    ),
  },
} as unknown as ClienteMensajesIA;

const registroMes = (): RegistroUsoIA => ({ gastoDelMes: async () => 0, sumar: async () => {} });

(CORRE ? describe : describe.skip)("recorrido de las reservas de Journaway (spec M2-09 §4, V3)", { timeout: 240_000 }, () => {
  let admin: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let soltarBloqueo: () => void;
  let deps: DependenciasReservas;
  const porCodigo = new Map<string, string[]>();

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let conSesion: SupabaseClient;
    ({ cliente: conSesion, borrar: borrarSesion } = await crearSesionDePrueba());
    cliente.actual = conSesion;
    deps = await cargarDependenciasReservas(admin);
    const propios: string[] = [];
    const r = await correrModoPrueba(listarArchivos(DOCX), {
      admin,
      registroUso: registroMes(),
      alcance: () => propios,
      leer: (mail, ctx) => {
        registro.mail(ctx.mailRecibidoId);
        propios.push(ctx.mailRecibidoId);
        return leerMailConIA(mail, { cliente: ia, registro: ctx.registro, mes: "2026-10", mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
      },
      deps: () => deps,
    });
    for (const a of r.archivos) registro.mail(a.mailRecibidoId);
    const ids = r.archivos.map((a) => a.mailRecibidoId).filter((x): x is string => !!x);
    const { data } = await admin.from("reserva").select("id,producto:producto_id(codigo)").in("mail_recibido_id", ids);
    for (const x of (data ?? []) as unknown as Array<{ id: string; producto: { codigo: string } | null }>) {
      const c = x.producto?.codigo ?? "sin producto";
      porCodigo.set(c, [...(porCodigo.get(c) ?? []), x.id]);
    }
    // Hasta 5 minutos esperando el candado de datos de prueba más la corrida del modo prueba.
  }, 540_000);

  afterEach(() => cleanup());

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      await borrarSesion?.();
      soltarBloqueo?.();
    }
  }, 120_000);

  it("1. la lista muestra las cuatro reservas de prueba: IGRE01, IGRE02, SPAP01 + SPAP03 (Trip 62992) y SPAP05", async () => {
    expect([...porCodigo.keys()].sort()).toEqual(["IGRE01", "IGRE02", "SPAP01", "SPAP05"]);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table", {}, ESPERA);
    for (const [codigo, [id]] of porCodigo) {
      const fila = tabla.querySelector(`tr[data-id="${id}"]`) as HTMLElement;
      expect(fila, codigo).toBeTruthy();
      expect(within(fila).getByText(codigo)).toBeInTheDocument();
      expect(within(fila).getByText("recibida")).toBeInTheDocument();
    }
    const spap01 = tabla.querySelector(`tr[data-id="${porCodigo.get("SPAP01")![0]}"]`) as HTMLElement;
    expect(spap01.textContent).toContain("Trip 62992");
    expect(spap01.textContent).toContain("+ SPAP03");
  }, 120_000);

  it("2. SPAP05: los 8 hoteles en la sección informativa, los tours con su pick up y el vuelo LA148 del traslado de llegada", async () => {
    render(<DetalleReservaPantalla id={porCodigo.get("SPAP05")![0]} />);
    const hoteles = await screen.findByTestId("hoteles-agencia", {}, ESPERA);
    expect(within(hoteles).getAllByRole("row")).toHaveLength(9);
    for (const h of ["Hub Providencia", "Our Habitas Atacama", "Saska Boutique"]) expect(within(hoteles).getByText(h)).toBeInTheDocument();
    const partes = screen.getByRole("table", { name: "Partes del tour" });
    expect(within(partes).getAllByText("Our Habitas Atacama")).toHaveLength(4);
    expect(within(partes).getByText("Tayka del Desierto Hotel / Tayka del Sal Hotel")).toBeInTheDocument();
    const vuelos = screen.getByRole("table", { name: "Vuelos" });
    expect(within(vuelos).getByText("LA148")).toBeInTheDocument();
    expect(screen.getByTestId("encabezado-reserva").textContent).toContain("Journaway no mandó número de viaje");
    expect(screen.queryByTestId("avisos-vuelo")).toBeNull();
    expect(screen.getByTestId("notas-reserva").textContent).toContain("pasaportes");
  }, 120_000);

  it("3. SPAP01 trae el número de viaje y su traslado dice que la salida va con SPAP03; IGRE01 lleva la nota de half-day", async () => {
    render(<DetalleReservaPantalla id={porCodigo.get("SPAP01")![0]} />);
    const encabezado = await screen.findByTestId("encabezado-reserva", {}, ESPERA);
    expect(encabezado.textContent).toContain("62992");
    expect(screen.getByRole("table", { name: "Partes del tour" }).textContent).toContain("Solo la llegada: la salida va con SPAP03");
    expect(screen.queryByTestId("hoteles-agencia")).toBeNull();
    cleanup();
    render(<DetalleReservaPantalla id={porCodigo.get("IGRE01")![0]} />);
    const notas = await screen.findByTestId("notas-reserva", {}, ESPERA);
    expect(notas.textContent).toContain("Journaway lo llama half-day; es el full day");
  }, 120_000);
});
