// @vitest-environment jsdom
//
// Spec M3-24 — verificación 3 (regla #5): el recorrido. Dos reservas de AR10 llegan por el flujo de M2
// (statement de TourRadar → lectura con la IA FALSA → emparejado por el nombre → reserva recibida)
// contra la BASE DE PRUEBAS, y una persona del equipo (sesión real) abre el detalle:
// - la #1389186-like (2 pax, DBL Hostel, sale el sábado 19 dic 2026) muestra arriba de todo, en
//   amarillo, "Revisar antes de pedir" con los tres tipos de aviso que el loop vio a mano: Bodegas
//   el 24 dic y Alta Montaña el 25 dic (Navidad) y el bus Río Gallegos → Ushuaia del martes 5 ene;
//   al armar los pedidos, el borrador a Huentata lleva los dos de Navidad como aviso interno;
// - una que sale el domingo 17 ene 2027 (sin feriados, el bus a Ushuaia cae miércoles) no muestra
//   el bloque.
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9). Todo lo que crea
// lleva la marca de prueba y se borra al terminar, solo eso. No se envía nada (#4).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { prepararPedidos } from "@/lib/pedidos/revision";
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

const AVISOS_1389186 = [
  "Bodegas half Day (Mendoza) cae jueves 24 dic 2026, Navidad: confirmá con el proveedor que opera.",
  "Alta Montaña (Mendoza) cae viernes 25 dic 2026, Navidad: confirmá con el proveedor que opera.",
  "El bus Río Gallegos → Ushuaia cae martes 5 ene 2027; según la planilla sale lun/mié/vie.",
];

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

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-24 — recorrido: Revisar antes de pedir en el detalle de AR10", { timeout: 600_000 }, () => {
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
        messageId: `<m3-24-recorrido-${randomUUID()}@prueba.hitravel.local>`,
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

  it("#1389186-like (19 dic 2026): el bloque amarillo arriba de todo, con los tres tipos de aviso; el borrador a Huentata los de Navidad", async () => {
    const id = await llega(`9124${SUFIJO}1`, "2026-12-19");
    const { container } = render(<DetalleReservaPantalla id={id} />);
    const bloque = await screen.findByTestId("revisar-antes-de-pedir", {}, ESPERA);
    const lineas = within(bloque).getAllByRole("listitem").map((li) => li.textContent);
    console.log(`[M3-24 recorrido] Revisar antes de pedir:\n  ${lineas.join("\n  ")}`);
    expect(within(bloque).getByText("Revisar antes de pedir")).toBeInTheDocument();
    expect(lineas).toEqual(AVISOS_1389186);
    expect(bloque.closest("[role='status']")!.className).toMatch(/aviso_aviso/);
    // Arriba de todo: el primer bloque del detalle.
    const primero = container.querySelector("[data-testid], [role='note'], [role='status']");
    expect(primero!.contains(bloque)).toBe(true);
    // El resto del detalle sigue igual (avisa, no frena).
    expect(await screen.findByTestId("encabezado-reserva")).toBeInTheDocument();
    cleanup();

    const pantalla = await prepararPedidos(equipo, id);
    if (!pantalla.ok) throw new Error(pantalla.error);
    const huentata = pantalla.pedidos.find((p) => p.proveedores.some((x) => /huentata/i.test(x)))!;
    console.log(`[M3-24 recorrido] avisos internos del borrador a Huentata: ${JSON.stringify(huentata.avisos)}`);
    expect(huentata.avisos).toEqual(expect.arrayContaining(AVISOS_1389186.slice(0, 2)));
    expect(huentata.cuerpo).not.toMatch(/Navidad/);
    expect(pantalla.tareas.map((t) => t.texto)).toContain("Emitir boleto: Río Gallegos – Ushuaia, 5 ene 2027");
    // La reserva se borra antes de la segunda (si no, la segunda podría ser "posible duplicada").
    await registro.limpiar(admin);
  });

  it("una AR10 sin problemas de fechas (17 ene 2027) no muestra el bloque", async () => {
    const id = await llega(`9124${SUFIJO}2`, "2027-01-17");
    render(<DetalleReservaPantalla id={id} />);
    await screen.findByTestId("encabezado-reserva", {}, ESPERA);
    // El bloque se calcula aparte: se espera a que termine (sin error ni avisos).
    await new Promise((r) => setTimeout(r, 15_000));
    expect(screen.queryByTestId("revisar-antes-error")).toBeNull();
    expect(screen.queryByTestId("revisar-antes-de-pedir")).toBeNull();
    const pantalla = await prepararPedidos(equipo, id);
    if (!pantalla.ok) throw new Error(pantalla.error);
    for (const p of pantalla.pedidos) expect(p.avisos.filter((a) => /Navidad|Año Nuevo|Carnaval|Semana Santa|blackout|según la planilla/.test(a))).toEqual([]);
  });
});
