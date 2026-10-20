// @vitest-environment jsdom
//
// Spec M3-07 — verificación 3 (el recorrido con las pantallas reales): sobre
// la BASE DE PRUEBAS y con la sesión de una persona del equipo, el detalle de
// la reserva y las server actions de verdad (solo se reemplaza de dónde sale
// el cliente de Supabase: la sesión de prueba).
//
// El caso que lo motivó (DK1595221, BOCHI04R): Kilroy escribió "Departure
// flight: H2253 ETA 18MAR27 08.44 from CJC" y la IA lo guardó como llegada,
// con "La IA no está segura de: vuelos" (y de pax). La persona corrige el
// vuelo a salida copiando del mail, deja una nota, marca el pax como bien y la
// reserva queda recibida, con "Armar pedidos" y el historial. Después: el
// conflicto (alguien la cambió mientras tanto) y una ya pedida, con un pedido
// enviado, donde el aviso dice a quién avisarle. Todo es de prueba y se borra.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { MOTIVOS_EMPAREJADO as M } from "@/lib/reservas/emparejar/motivos";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { ReservaEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
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

const T = TEXTOS.reserva.corregir;
const ESPERA = { timeout: 60_000 };
const PREFIJO = "[test M3-07 recorrido]";
const LINEA_DEL_MAIL = "Departure flight: H2253 ETA 18MAR27 08.44 from CJC";
const COMO_LLEGADA = { numero: "H2253", aerolinea: null, origen: null, destino: "CJC", fecha_salida: null, hora_salida: null, fecha_llegada: "2027-03-18", hora_llegada: "08:44", confianza: 0.6 };
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

(credencialesSupabaseDisponibles() ? describe : describe.skip)("recorrido de corregir vuelos (spec M3-07, V3)", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  let bochi: string;

  async function reserva(extra: Partial<ReservaEntrada> = {}): Promise<string> {
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-07-recorrido.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-20T12:00:00.000Z",
        cuerpoTexto: `Dear HI Travel,\nPlease book BOCHI04R for 2 pax.\n${LINEA_DEL_MAIL}\nBest regards`,
        agencia: "Kilroy",
        dePrueba: true,
      },
      admin,
    );
    const { reserva: r } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        bookingId: `DK307${randomUUID().slice(0, 8)}`,
        estado: "para_revision",
        motivosRevision: [M.dudosos(["pax", "vuelos"])],
        productoId: bochi,
        productoTextoAgencia: "BOCHI04R",
        fechaInicio: "2027-03-10",
        fechaFin: "2027-03-18",
        pax: 2,
        vuelos: [COMO_LLEGADA],
        datosExtraidos: { tipo_mail: { valor: "reserva_nueva", confianza: 1 } } as unknown as FichaLectura,
        dePrueba: true,
        ...extra,
      },
      admin,
    );
    return r.id;
  }

  const leer = async (id: string) => (await admin.from("reserva").select("*").eq("id", id).single()).data!;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const sesion = await crearSesionDePrueba();
    cliente.actual = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { data } = await sesion.cliente.auth.getUser();
    usuarioId = data.user!.id;
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-07 recorrido" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    const p = await admin.from("producto").select("id").eq("codigo", "BOCHI04R").single();
    if (p.error) throw new Error(p.error.message);
    bochi = p.data.id;
  }, 120_000);

  afterEach(() => cleanup());

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    } finally {
      await borrarSesion?.();
    }
  }, 120_000);

  it("1. el caso de Kilroy: la salida de Calama guardada como llegada se corrige, el pax se marca como bien y queda recibida", async () => {
    const id = await reserva();
    render(<DetalleReservaPantalla id={id} />);

    const recuadro = await screen.findByRole("region", { name: T.dudosos("cantidad de pasajeros, vuelos") }, ESPERA);
    expect(screen.getByRole("button", { name: TEXTOS.reserva.armarPedidos })).toBeDisabled();
    // Como llegada, el traslado de salida de OD030 no tiene su vuelo.
    expect(screen.getByTestId("avisos-vuelo")).toHaveTextContent("Falta el vuelo de salida de Calama (CJC) para el traslado de OD030");

    fireEvent.click(within(within(recuadro).getByTestId("dudoso-vuelos")).getByRole("button", { name: T.corregirVuelos }));
    const form = screen.getByRole("region", { name: T.titulo });
    expect(within(within(form).getByRole("note", { name: T.delMail })).getByText(LINEA_DEL_MAIL)).toBeInTheDocument();
    const vuelo = within(form).getByRole("group", { name: T.vuelo(1) });
    expect(within(vuelo).getByLabelText(T.lado)).toHaveValue("llegada");
    fireEvent.change(within(vuelo).getByLabelText(T.lado), { target: { value: "salida" } });
    fireEvent.change(within(form).getByLabelText(T.nota), { target: { value: "Vuelven a Santiago desde Calama" } });
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));

    const listo = await screen.findByTestId("producto-confirmado", {}, ESPERA);
    expect(listo).toHaveTextContent(/^Listo: sigue para revisión por: .*cantidad de pasajeros/);
    expect(await screen.findByRole("region", { name: T.dudosos("cantidad de pasajeros") }, ESPERA)).toBeInTheDocument();
    expect(screen.getByTestId("notas-reserva")).toHaveTextContent("Vuelven a Santiago desde Calama");
    expect(screen.getByTestId("historial-correcciones")).toHaveTextContent(
      T.historialVuelos("Test M3-07 recorrido", "salida H2253 de CJC 18/03/2027 08:44", true),
    );
    expect(screen.queryByTestId("avisos-vuelo")).toBeNull();
    const guardada = await leer(id);
    expect(guardada.vuelos).toEqual([
      { numero: "H2253", aerolinea: null, origen: "CJC", destino: null, fecha_salida: "2027-03-18", hora_salida: "08:44", fecha_llegada: null, hora_llegada: null, confianza: 1 },
    ]);
    expect(guardada.motivos_revision).toEqual([M.dudosos(["pax"])]);

    fireEvent.click(screen.getByRole("button", { name: `${T.estaBien}: cantidad de pasajeros` }));
    expect(await screen.findByText(T.listoRecibida, {}, ESPERA)).toBeInTheDocument();
    const enlace = await screen.findByRole("link", { name: TEXTOS.reserva.armarPedidos }, ESPERA);
    expect(enlace).toHaveAttribute("href", `/reservas/${id}/pedidos`);
    expect(screen.queryByTestId("datos-dudosos")).toBeNull();
    expect(screen.getByTestId("historial-correcciones")).toHaveTextContent(T.historialRevisado("Test M3-07 recorrido", "cantidad de pasajeros"));
    expect((await leer(id)).estado).toBe("recibida");
  });

  it("2. si alguien la cambió desde que se abrió, no pisa: 'Alguien la cambió: volvé a cargar' y la vuelve a leer", async () => {
    const id = await reserva({ motivosRevision: [M.dudosos(["vuelos"])] });
    render(<DetalleReservaPantalla id={id} />);
    const vuelos = await screen.findByTestId("vuelos-reserva", {}, ESPERA);
    fireEvent.click(within(vuelos).getByRole("button", { name: T.corregirVuelos }));
    const form = screen.getByRole("region", { name: T.titulo });
    fireEvent.change(within(within(form).getByRole("group", { name: T.vuelo(1) })).getByLabelText(T.lado), { target: { value: "salida" } });

    // Mientras tanto, otra persona le cambió el pax.
    const otro = await admin.from("reserva").update({ pax: 3 }).eq("id", id);
    if (otro.error) throw new Error(otro.error.message);

    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));
    expect(await within(form).findByText(T.cambio, {}, ESPERA)).toBeInTheDocument();
    expect((await leer(id)).vuelos).toEqual([COMO_LLEGADA]);

    fireEvent.click(within(form).getByRole("button", { name: T.volverACargar }));
    const datos = await screen.findByTestId("datos-reserva", {}, ESPERA);
    expect(within(datos).getByText("3")).toBeInTheDocument();
  });

  it("3. ya pedida, con un pedido enviado: corregir el vuelo avisa a quién hay que contarle", async () => {
    const id = await reserva({ estado: "recibida", motivosRevision: [], vuelos: [] });
    const pedido = await admin.from("reserva_pedido").insert({
      reserva_id: id,
      casilla: "traslados@prueba.test",
      destinatarios: ["traslados@prueba.test"],
      proveedores: ["Traslados de prueba"],
      asunto: "Reserva",
      cuerpo: "Traslado de salida: Hotel - Aeropuerto Calama\nFecha: 18/03\nVuelo pendiente",
      firma: "{{nombre_de_quien_envia}}",
      estado: "enviado",
      enviado_en: "2026-10-20T12:00:00.000Z",
      enviado_por_nombre: "Test M3-07 recorrido",
      message_id: `<${randomUUID()}@test-m3-07-recorrido.hitravel.local>`,
    });
    if (pedido.error) throw new Error(pedido.error.message);
    const pedida = await admin.from("reserva").update({ estado: "pedido_a_proveedor" }).eq("id", id);
    if (pedida.error) throw new Error(pedida.error.message);

    render(<DetalleReservaPantalla id={id} />);
    const vuelos = await screen.findByTestId("vuelos-reserva", {}, ESPERA);
    expect(screen.queryByTestId("avisos-cambio-vuelo")).toBeNull();
    fireEvent.click(within(vuelos).getByRole("button", { name: T.corregirVuelos }));
    const form = screen.getByRole("region", { name: T.titulo });
    fireEvent.click(within(form).getByRole("button", { name: T.agregar }));
    const nuevo = within(form).getByRole("group", { name: T.vuelo(1) });
    fireEvent.change(within(nuevo).getByLabelText(T.lado), { target: { value: "salida" } });
    fireEvent.change(within(nuevo).getByLabelText(T.numero), { target: { value: "h2253" } });
    fireEvent.change(within(nuevo).getByLabelText(T.aeropuerto), { target: { value: "cjc" } });
    fireEvent.change(within(nuevo).getByLabelText(T.fecha), { target: { value: "2027-03-18" } });
    fireEvent.change(within(nuevo).getByLabelText(T.hora), { target: { value: "8:44" } });
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));

    expect(await screen.findByText(T.listo, {}, ESPERA)).toBeInTheDocument();
    expect(await screen.findByTestId("avisos-cambio-vuelo", {}, ESPERA)).toHaveTextContent(T.avisoPedidoEnviado("Traslados de prueba"));
    const guardada = await leer(id);
    expect(guardada.estado).toBe("pedido_a_proveedor");
    expect(guardada.vuelos).toEqual([
      { numero: "H2253", aerolinea: null, origen: "CJC", destino: null, fecha_salida: "2027-03-18", hora_salida: "08:44", fecha_llegada: null, hora_llegada: null, confianza: 1 },
    ]);
  });

  it("4. ARCH31 con las fechas dudosas: correr el tour corre las partes; agregar una noche avisa que hay que revisarlas", async () => {
    const p = await admin.from("producto").select("id").eq("codigo", "ARCH31").single();
    if (p.error) throw new Error(p.error.message);
    const detalle = (await cargarProducto(admin, p.data.id))!;
    const conPartes = () =>
      reserva({
        motivosRevision: [M.dudosos(["fechas"])],
        productoId: p.data.id,
        productoTextoAgencia: "ARCH31",
        fechaInicio: "2027-01-10",
        fechaFin: "2027-01-17",
        vuelos: [],
        componentes: componentesDeLaReserva(detalle, "2027-01-10", { finalPuertoNatales: false, proveedorTransferPNT: null }),
      });
    const partes = async (id: string) =>
      ((await admin.from("reserva_componente").select("orden,fecha_inicio,fecha_fin").eq("reserva_id", id).order("orden")).data ?? []).map(
        (x) => [x.fecha_inicio, x.fecha_fin],
      );
    const corregirFechas = async (inicio: string, fin: string) => {
      fireEvent.click(await screen.findByRole("button", { name: `${T.corregirDato}: fechas` }, ESPERA));
      fireEvent.change(screen.getByLabelText(T.fechaInicio), { target: { value: inicio } });
      fireEvent.change(screen.getByLabelText(T.fechaFin), { target: { value: fin } });
      fireEvent.click(within(screen.getByTestId("dudoso-fechas")).getByRole("button", { name: T.guardar }));
      return screen.findByTestId("producto-confirmado", {}, ESPERA);
    };

    // El vendedor corrió el comienzo del tour dos días: las partes van con él.
    const corrida = await conPartes();
    const antes = await partes(corrida);
    render(<DetalleReservaPantalla id={corrida} />);
    const listo = await corregirFechas("2027-01-12", "2027-01-19");
    expect(listo).toHaveTextContent(T.listoRecibida);
    expect(listo).not.toHaveTextContent(T.avisoDuracion(7, 8));
    const mas2 = (f: string | null) => (f ? new Date(Date.parse(`${f}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10) : f);
    expect(await partes(corrida)).toEqual(antes.map(([i, f]) => [mas2(i), mas2(f)]));
    expect(await screen.findByTestId("historial-correcciones", {}, ESPERA)).toHaveTextContent(
      `${T.historialCorregido("Test M3-07 recorrido", "fechas")} y ${T.historialCorrio(2)}`,
    );
    cleanup();

    // La agencia agregó una noche: las partes no se mueven solas y lo avisa.
    const extra = await conPartes();
    const sinTocar = await partes(extra);
    render(<DetalleReservaPantalla id={extra} />);
    expect(await corregirFechas("2027-01-12", "2027-01-20")).toHaveTextContent(T.avisoDuracion(7, 8));
    expect(await partes(extra)).toEqual(sinTocar);
    expect((await leer(extra)).fecha_fin).toBe("2027-01-20");
  });
});
