// @vitest-environment jsdom
//
// Spec M3-06 — verificación 3 (el recorrido con las pantallas reales): sobre
// la BASE DE PRUEBAS y con la sesión de una persona del equipo, las páginas,
// las pantallas y las server actions de verdad (solo se reemplaza de dónde
// sale el cliente de Supabase: la sesión de prueba).
//
// Damián entra a "Mi nombre para la firma", guarda "Damián · Operaciones" y,
// al volver a entrar, lo ve guardado; la pantalla de pedidos firma con él.
// Abre una reserva sin responsable, la toma, se la pasa a Leticia y la vuelve
// a tomar (con la pregunta "La lleva Leticia. ¿La tomás vos?"), con el
// historial. En la lista, "Mis reservas" muestra la suya y no la de Leticia, y
// combinado con el buscador filtra las dos cosas. Lo creado se borra.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
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
  useSearchParams: () => new URLSearchParams("prueba=1"),
  redirect: (destino: string) => {
    throw new Error(`redirect:${destino}`);
  },
}));
vi.mock("@/components/pedidos/pedidos-pantalla", () => ({ PedidosPantalla: () => null }));

import MiFirmaPage from "@/app/(app)/mi-firma/page";
import PedidosPage from "@/app/(app)/reservas/[id]/pedidos/page";
import { DetalleReservaPantalla } from "@/components/reservas/detalle-reserva-pantalla";
import { ListaReservasPantalla } from "@/components/reservas/lista-reservas-pantalla";

const F = TEXTOS.miFirma;
const R = TEXTOS.reserva.responsable;
const L = TEXTOS.reservas.responsable;
const ESPERA = { timeout: 60_000 };
const PREFIJO = "[test M3-06 recorrido]";
const FIRMA = "Damián · Operaciones";
const LETICIA = "Leticia Recorrido M3-06";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

(credencialesSupabaseDisponibles() ? describe : describe.skip)("recorrido de firma y responsable (spec M3-06, V3)", { timeout: 240_000 }, () => {
  let admin: SupabaseClient;
  let damian: { id: string; cliente: SupabaseClient; borrar: () => Promise<void> };
  let leticia: { id: string; borrar: () => Promise<void> };
  const numeros: string[] = [];

  async function reserva(): Promise<string> {
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
        messageId: `<${randomUUID()}@test-m3-06-recorrido.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} pedido sintético`,
        fechaMail: "2026-10-20T12:00:00.000Z",
        cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
        agencia: "Kilroy",
        dePrueba: true,
      },
      admin,
    );
    const numero = `DK306${randomUUID().slice(0, 6)}`;
    numeros.push(numero);
    const { reserva: r } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        estado: "recibida",
        pax: 1,
        pasajeros: [{ nombre: "Ana", apellido: `Recorrido${numeros.length}` }],
        bookingIdOriginal: numero,
        fechaInicio: "2027-04-02",
        fechaFin: "2027-04-05",
        dePrueba: true,
      },
      admin,
    );
    return r.id;
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const alta = async (nombre: string | null) => {
      const sesion = await crearSesionDePrueba();
      const { data } = await sesion.cliente.auth.getUser();
      const r = await admin.from("usuario").insert({ id: data.user!.id, email: data.user!.email, nombre });
      if (r.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${r.error.message}`);
      return { id: data.user!.id, cliente: sesion.cliente, borrar: sesion.borrar };
    };
    const d = await alta(null);
    cliente.actual = d.cliente;
    damian = d;
    leticia = await alta(LETICIA);
  }, 120_000);

  afterEach(() => cleanup());

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
      for (const p of [damian, leticia]) if (p) await admin.from("usuario").delete().eq("id", p.id);
    } finally {
      await damian?.borrar();
      await leticia?.borrar();
    }
  }, 120_000);

  it("1. Mi nombre para la firma: guardarlo, volver a entrar y verlo; la pantalla de pedidos firma con él", async () => {
    render(await MiFirmaPage());
    const campo = screen.getByRole("textbox", { name: F.campo }) as HTMLInputElement;
    // Sin nombre de Google en la cuenta de prueba: propone lo previo a la @.
    expect(campo.value).toMatch(/^test-m1-06-/);
    fireEvent.change(campo, { target: { value: FIRMA } });
    fireEvent.click(screen.getByRole("button", { name: F.guardar }));
    expect(await screen.findByText(F.listo, {}, ESPERA)).toBeInTheDocument();
    cleanup();

    render(await MiFirmaPage());
    expect((screen.getByRole("textbox", { name: F.campo }) as HTMLInputElement).value).toBe(FIRMA);
    expect(screen.getByText(F.vistaPrevia(FIRMA))).toBeInTheDocument();

    const pedidos = (await PedidosPage({ params: Promise.resolve({ id: randomUUID() }) })) as { props: { firmante: string } };
    expect(pedidos.props.firmante).toBe(FIRMA);
  });

  it("2. el detalle: tomar, pasarla a Leticia y volver a tomarla (con la pregunta), con el historial", async () => {
    const id = await reserva();
    render(<DetalleReservaPantalla id={id} />);
    let zona = await screen.findByRole("region", { name: R.titulo }, ESPERA);
    expect(within(zona).getByText(R.sinResponsable)).toBeInTheDocument();

    fireEvent.click(within(zona).getByRole("button", { name: R.tomar }));
    expect(await screen.findByText(R.listoTomada, {}, ESPERA)).toBeInTheDocument();
    zona = await screen.findByRole("region", { name: R.titulo }, ESPERA);
    expect(within(zona).getByText(R.etiqueta(FIRMA))).toBeInTheDocument();
    // Ya es mía: no se ofrece tomarla.
    await waitFor(() => expect(within(zona).queryByRole("button", { name: R.tomar })).toBeNull(), ESPERA);

    fireEvent.click(within(zona).getByRole("button", { name: R.pasar }));
    const lista = await within(zona).findByRole("combobox", { name: R.aQuien }, ESPERA);
    fireEvent.change(lista, { target: { value: leticia.id } });
    fireEvent.click(within(zona).getByRole("button", { name: R.pasarA(LETICIA) }));
    expect(await screen.findByText(R.listoPasada(LETICIA), {}, ESPERA)).toBeInTheDocument();
    zona = await screen.findByRole("region", { name: R.titulo }, ESPERA);
    expect(within(zona).getByText(R.etiqueta(LETICIA))).toBeInTheDocument();

    fireEvent.click(await within(zona).findByRole("button", { name: R.tomar }, ESPERA));
    const pregunta = within(zona).getByRole("group", { name: R.dialogoTomar });
    expect(pregunta).toHaveTextContent(R.preguntaTomar(LETICIA));
    fireEvent.click(within(pregunta).getByRole("button", { name: R.siTomar }));
    expect(await screen.findByText(R.listoTomada, {}, ESPERA)).toBeInTheDocument();
    zona = await screen.findByRole("region", { name: R.titulo }, ESPERA);
    expect(within(zona).getByText(R.etiqueta(FIRMA))).toBeInTheDocument();

    const historial = within(zona).getByRole("list", { name: R.historial });
    const lineas = within(historial).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(lineas).toHaveLength(3);
    expect(lineas[0]).toContain(R.historialTomo(FIRMA));
    expect(lineas[1]).toContain(R.historialPaso(FIRMA, LETICIA));
    expect(lineas[2]).toContain(R.historialTomo(FIRMA));
    const autores = (await admin.from("evento_reserva").select("tipo,autor_id").eq("reserva_id", id).neq("tipo", "creada").order("created_at")).data;
    expect(autores?.map((e) => e.autor_id)).toEqual([damian.id, damian.id, damian.id]);
  });

  it("3. la lista: el responsable en cada fila y 'Mis reservas', también combinado con el buscador", async () => {
    const mia = await reserva();
    const deLeticia = await reserva();
    const [numeroMia, numeroLeticia] = numeros.slice(-2);
    const tomar = await damian.cliente.rpc("asignar_responsable", { p_reserva: mia, p_responsable: damian.id, p_esperado: null });
    expect(tomar.error).toBeNull();
    const pasar = await damian.cliente.rpc("asignar_responsable", { p_reserva: deLeticia, p_responsable: leticia.id, p_esperado: null });
    expect(pasar.error).toBeNull();

    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table", {}, ESPERA);
    const fila = (id: string) => tabla.querySelector(`tr[data-id="${id}"]`) as HTMLElement | null;
    expect(within(fila(mia)!).getByText(FIRMA)).toBeInTheDocument();
    expect(within(fila(deLeticia)!).getByText(LETICIA)).toBeInTheDocument();

    await screen.findByRole("option", { name: L.mias }, ESPERA);
    const filtro = screen.getByRole("combobox", { name: L.filtro });
    fireEvent.change(filtro, { target: { value: "mias" } });
    const tablaMias = screen.getByRole("table");
    expect(tablaMias.querySelector(`tr[data-id="${mia}"]`)).not.toBeNull();
    expect(tablaMias.querySelector(`tr[data-id="${deLeticia}"]`)).toBeNull();

    // Con el número de la de Leticia en el buscador y "Mis reservas": ninguna.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: numeroLeticia } });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(L.sinCoincidencias)).toBeInTheDocument();
    // Con el de la mía: solo esa.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: numeroMia } });
    expect(within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.getAttribute("data-id"))).toEqual([mia]);
    // Y Leticia como persona del filtro: la suya.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.change(filtro, { target: { value: `persona:${leticia.id}` } });
    const deElla = within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.getAttribute("data-id"));
    expect(deElla).toContain(deLeticia);
    expect(deElla).not.toContain(mia);
  });
});
