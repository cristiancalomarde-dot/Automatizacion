// @vitest-environment jsdom
//
// Spec M3-07 filas 1, 2, 3, 5, 6, 7 y 8 (y §4): "Corregir vuelos" y los datos
// dudosos en el detalle de la reserva. La server action está simulada; la de
// verdad se prueba en la integración y en el recorrido (V2 y V3).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(async () => new Map()),
  cargarRevision: vi.fn(async () => null),
}));
const acciones = vi.hoisted(() => ({ corregirVuelosDeReserva: vi.fn(), marcarDatoRevisado: vi.fn(), corregirDatoDeReserva: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => ({ marcarReservaDePrueba: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-producto", () => ({ confirmarProductoDeReserva: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-responsable", () => ({ tomarEstaReserva: vi.fn(), pasarlaAOtro: vi.fn() }));
vi.mock("@/app/(app)/reservas/[id]/acciones-corregir", () => acciones);
vi.mock("@/lib/reservas/consultas", () => consultas);
vi.mock("@/lib/usuarios/equipo", () => ({ cargarEquipo: vi.fn(async () => ({ yo: null, personas: [] })) }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/reservas" }));

import { versionParaCorregir } from "@/lib/reservas/corregir/decidir";
import { MOTIVOS_EMPAREJADO as M } from "@/lib/reservas/emparejar/motivos";
import { detalle, mail } from "@/lib/reservas/fixtures.test-utils";
import type { DetalleReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const T = TEXTOS.reserva.corregir;
const ID = "77777777-7777-4777-8777-777777777707";

/** El caso real (DK1595221): la IA tomó "Departure flight: H2253 … from CJC" como llegada. */
const comoLlegada = {
  numero: "H2253",
  aerolinea: null,
  origen: null,
  destino: "CJC",
  fechaSalida: null,
  horaSalida: null,
  fechaLlegada: "2027-03-18",
  horaLlegada: "08:44",
};
const llegadaLPB = { ...comoLlegada, numero: "LA2120", destino: "LPB", fechaLlegada: "2027-03-10", horaLlegada: "10:05" };

const reserva = (extra: Partial<DetalleReserva> = {}) =>
  detalle({
    id: ID,
    estado: "recibida",
    fechaInicio: "2027-03-10",
    fechaFin: "2027-03-18",
    vuelos: [comoLlegada, llegadaLPB],
    mails: [mail({ cuerpo: "Please book BOCHI04R for 2 pax.\nDeparture flight: H2253 ETA 18MAR27 08.44 from CJC\nThanks" })],
    ...extra,
  });

const okRecibida = { ok: true, estado: "recibida", motivos: [], avisos: [] };

beforeEach(() => {
  vi.clearAllMocks();
});

async function abrir(r: DetalleReserva = reserva()) {
  consultas.cargarReserva.mockResolvedValue(r);
  render(<DetalleReservaPantalla id={ID} />);
  return screen.findByTestId("vuelos-reserva");
}

async function abrirFormulario(r?: DetalleReserva) {
  const vuelos = await abrir(r);
  fireEvent.click(within(vuelos).getByRole("button", { name: T.corregirVuelos }));
  return screen.getByRole("region", { name: T.titulo });
}

const fila = (form: HTMLElement, n: number) => within(form).getByRole("group", { name: T.vuelo(n) });

describe("M3-07 fila 1 — 'Corregir vuelos' en el detalle", () => {
  it("cada vuelo como llegada o salida; muestra lo que dice el mail sobre vuelos", async () => {
    const form = await abrirFormulario();
    const uno = fila(form, 1);
    expect(within(uno).getByLabelText(T.lado)).toHaveValue("llegada");
    expect(within(uno).getByLabelText(T.numero)).toHaveValue("H2253");
    expect(within(uno).getByLabelText(T.aeropuerto)).toHaveValue("CJC");
    expect(within(uno).getByLabelText(T.fecha)).toHaveValue("2027-03-18");
    expect(within(uno).getByLabelText(T.hora)).toHaveValue("08:44");
    const delMail = within(form).getByRole("note", { name: T.delMail });
    expect(within(delMail).getByText("Departure flight: H2253 ETA 18MAR27 08.44 from CJC")).toBeInTheDocument();
  });

  it("editar un vuelo (pasarlo a salida), agregar otro y sacar uno → se guarda eso, con 'Guardando…' y el 'Listo' arriba", async () => {
    let terminar: (v: unknown) => void = () => {};
    acciones.corregirVuelosDeReserva.mockReturnValue(new Promise((r) => (terminar = r)));
    const form = await abrirFormulario();

    fireEvent.change(within(fila(form, 1)).getByLabelText(T.lado), { target: { value: "salida" } });
    fireEvent.click(within(fila(form, 2)).getByRole("button", { name: `${T.sacar} (${T.vuelo(2)})` }));
    fireEvent.click(within(form).getByRole("button", { name: T.agregar }));
    const nuevo = fila(form, 2);
    fireEvent.change(within(nuevo).getByLabelText(T.numero), { target: { value: "la2120" } });
    fireEvent.change(within(nuevo).getByLabelText(T.aeropuerto), { target: { value: "lpb" } });
    fireEvent.change(within(nuevo).getByLabelText(T.fecha), { target: { value: "2027-03-10" } });
    fireEvent.change(within(nuevo).getByLabelText(T.hora), { target: { value: "10:05" } });
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));

    expect(await within(form).findByRole("button", { name: T.guardando })).toBeDisabled();
    expect(acciones.corregirVuelosDeReserva).toHaveBeenCalledWith({
      reservaId: ID,
      version: versionParaCorregir({ ...reserva(), notas: [] }),
      nota: null,
      vuelos: [
        expect.objectContaining({ lado: "salida", ladoOriginal: "llegada", numero: "H2253", aeropuerto: "CJC", fecha: "2027-03-18", hora: "08:44" }),
        expect.objectContaining({ lado: "llegada", ladoOriginal: null, numero: "LA2120", aeropuerto: "LPB", fecha: "2027-03-10", hora: "10:05" }),
      ],
    });

    terminar({ ok: true, estado: "recibida", motivos: [], avisos: [] });
    expect(await screen.findByTestId("producto-confirmado")).toHaveTextContent(T.listo);
    expect(consultas.cargarReserva).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["cerrada", { estado: "cerrada" as const }],
    ["descartada", { estado: "descartada" as const }],
    ["cancelada por la agencia", { cancelacion: true }],
  ])("%s: no hay 'Corregir vuelos'", async (_caso, extra) => {
    const vuelos = await abrir(reserva(extra));
    expect(within(vuelos).queryByRole("button", { name: T.corregirVuelos })).toBeNull();
  });

  it("'Cancelar' cierra el formulario sin guardar", async () => {
    const form = await abrirFormulario();
    fireEvent.click(within(form).getByRole("button", { name: T.cancelar }));
    expect(screen.queryByRole("region", { name: T.titulo })).toBeNull();
    expect(acciones.corregirVuelosDeReserva).not.toHaveBeenCalled();
  });
});

describe("M3-07 fila 2 — validación en llano", () => {
  it("hora, aeropuerto y fecha mal escritos: dice qué está mal en cada campo y no guarda", async () => {
    const form = await abrirFormulario();
    const uno = fila(form, 1);
    fireEvent.change(within(uno).getByLabelText(T.hora), { target: { value: "08.44" } });
    fireEvent.change(within(uno).getByLabelText(T.aeropuerto), { target: { value: "CALAMA" } });
    fireEvent.change(within(uno).getByLabelText(T.fecha), { target: { value: "" } });
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));

    expect(within(uno).getByText(T.errores.hora)).toBeInTheDocument();
    expect(within(uno).getByText(T.errores.aeropuerto)).toBeInTheDocument();
    expect(within(uno).getByText(T.errores.faltaFecha)).toBeInTheDocument();
    expect(within(uno).getByLabelText(T.hora)).toHaveAttribute("aria-invalid", "true");
    expect(within(uno).getByLabelText(T.hora)).toHaveAccessibleDescription(T.errores.hora);
    expect(acciones.corregirVuelosDeReserva).not.toHaveBeenCalled();

    // Al corregirlo, el mensaje se va.
    fireEvent.change(within(uno).getByLabelText(T.hora), { target: { value: "08:44" } });
    expect(within(uno).queryByText(T.errores.hora)).toBeNull();
  });
});

describe("M3-07 fila 3 — la nota del operativo", () => {
  it("viaja con los vuelos y aparece en el detalle al volver a leerlo", async () => {
    acciones.corregirVuelosDeReserva.mockResolvedValue(okRecibida);
    const form = await abrirFormulario();
    fireEvent.change(within(form).getByLabelText(T.nota), { target: { value: "  Llegan a La Paz por tierra " } });
    consultas.cargarReserva.mockResolvedValue(reserva({ notas: ["Llegan a La Paz por tierra"] }));
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));

    await waitFor(() => expect(acciones.corregirVuelosDeReserva).toHaveBeenCalledWith(expect.objectContaining({ nota: "Llegan a La Paz por tierra" })));
    expect(await screen.findByTestId("notas-reserva")).toHaveTextContent("Llegan a La Paz por tierra");
  });

  it("una nota larga no se guarda", async () => {
    const form = await abrirFormulario();
    fireEvent.change(within(form).getByLabelText(T.nota), { target: { value: "x".repeat(201) } });
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));
    expect(within(form).getByText(T.errores.notaLarga(200))).toBeInTheDocument();
    expect(acciones.corregirVuelosDeReserva).not.toHaveBeenCalled();
  });
});

describe("M3-07 filas 4 y 5 — 'La IA no está segura de: …'", () => {
  const enRevision = () => reserva({ estado: "para_revision", motivos: [M.dudosos(["vuelos", "pax"])] });

  it("el recuadro con 'Corregir vuelos' para los vuelos y 'Está bien así' / 'Corregir' para los demás", async () => {
    await abrir(enRevision());
    const recuadro = screen.getByRole("region", { name: T.dudosos("cantidad de pasajeros, vuelos") });
    const vuelos = within(recuadro).getByTestId("dudoso-vuelos");
    expect(within(vuelos).queryByRole("button", { name: /Está bien así/ })).toBeNull();
    fireEvent.click(within(vuelos).getByRole("button", { name: T.corregirVuelos }));
    expect(screen.getByRole("region", { name: T.titulo })).toBeInTheDocument();
    const pax = within(recuadro).getByTestId("dudoso-pax");
    expect(within(pax).getByRole("button", { name: `${T.estaBien}: cantidad de pasajeros` })).toBeInTheDocument();
    expect(within(pax).getByRole("button", { name: `${T.corregirDato}: cantidad de pasajeros` })).toBeInTheDocument();
  });

  it("'Está bien así' en pax lo saca de los dudosos; el 'Listo' dice por qué sigue para revisión", async () => {
    acciones.marcarDatoRevisado.mockResolvedValue({ ok: true, estado: "para_revision", motivos: [M.dudosos(["vuelos"])], avisos: [] });
    await abrir(enRevision());
    consultas.cargarReserva.mockResolvedValue(reserva({ estado: "para_revision", motivos: [M.dudosos(["vuelos"])] }));
    fireEvent.click(screen.getByRole("button", { name: `${T.estaBien}: cantidad de pasajeros` }));

    expect(acciones.marcarDatoRevisado).toHaveBeenCalledWith({ reservaId: ID, version: versionParaCorregir({ ...enRevision(), notas: [] }), dato: "pax" });
    const listo = await screen.findByTestId("producto-confirmado");
    expect(listo).toHaveTextContent(/^Listo: sigue para revisión por: /);
    expect(listo).toHaveTextContent("vuelos");
    expect(await screen.findByRole("region", { name: T.dudosos("vuelos") })).toBeInTheDocument();
  });

  it("corregir los vuelos cuando era lo único dudoso: 'Listo: la reserva quedó recibida'", async () => {
    acciones.corregirVuelosDeReserva.mockResolvedValue(okRecibida);
    const form = await abrirFormulario(reserva({ estado: "para_revision", motivos: [M.dudosos(["vuelos"])] }));
    fireEvent.change(within(fila(form, 1)).getByLabelText(T.lado), { target: { value: "salida" } });
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));
    expect(await screen.findByTestId("producto-confirmado")).toHaveTextContent(T.listoRecibida);
  });

  it("corregir el pax: valida y manda el número", async () => {
    acciones.corregirDatoDeReserva.mockResolvedValue(okRecibida);
    await abrir(reserva({ estado: "para_revision", motivos: [M.dudosos(["pax"])] }));
    fireEvent.click(screen.getByRole("button", { name: `${T.corregirDato}: cantidad de pasajeros` }));
    const campo = screen.getByLabelText(T.pax);
    fireEvent.change(campo, { target: { value: "0" } });
    fireEvent.click(within(screen.getByTestId("dudoso-pax")).getByRole("button", { name: T.guardar }));
    expect(screen.getByText(T.errores.pax)).toBeInTheDocument();
    expect(acciones.corregirDatoDeReserva).not.toHaveBeenCalled();

    fireEvent.change(campo, { target: { value: "3" } });
    fireEvent.click(within(screen.getByTestId("dudoso-pax")).getByRole("button", { name: T.guardar }));
    await waitFor(() => expect(acciones.corregirDatoDeReserva).toHaveBeenCalledWith(expect.objectContaining({ dato: "pax", pax: 3 })));
  });

  it("los pasajeros solo se marcan como revisados (editarlos queda para otra pieza)", async () => {
    await abrir(reserva({ estado: "para_revision", motivos: [M.dudosos(["pasajeros"])] }));
    const item = screen.getByTestId("dudoso-pasajeros");
    expect(within(item).getByRole("button", { name: `${T.estaBien}: pasajeros` })).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: /^Corregir/ })).toBeNull();
  });
});

describe("M3-07 fila 6 — los pedidos ya enviados", () => {
  it("si el vuelo cambió después de enviar el pedido, el aviso en el detalle", async () => {
    await abrir(reserva({ estado: "pedido_a_proveedor", avisarCambioDeVuelo: ["Ayllu Transfers"] }));
    expect(screen.getByTestId("avisos-cambio-vuelo")).toHaveTextContent(T.avisoPedidoEnviado("Ayllu Transfers"));
  });
});

describe("M3-07 fila 7 — historial", () => {
  it("'<persona> corrigió los vuelos: …' y '<persona> marcó como revisado: …'", async () => {
    await abrir(
      reserva({
        correcciones: [
          {
            tipo: "vuelos",
            fecha: "2026-10-20T13:00:00.000Z",
            persona: "Damián",
            vuelos: [{ lado: "salida", numero: "H2253", aeropuerto: "CJC", fecha: "2027-03-18", hora: "08:44" }],
            dato: null,
            nota: true,
          },
          { tipo: "revisado", fecha: "2026-10-20T13:05:00.000Z", persona: "Damián", vuelos: [], dato: "pax", nota: false },
        ],
      }),
    );
    const historial = screen.getByTestId("historial-correcciones");
    expect(historial).toHaveTextContent(T.historialVuelos("Damián", "salida H2253 de CJC 18/03/2027 08:44", true));
    expect(historial).toHaveTextContent(T.historialRevisado("Damián", "cantidad de pasajeros"));
  });
});

describe("M3-07 fila 8 y §4 — errores", () => {
  it("si alguien la cambió: 'Alguien la cambió: volvé a cargar' y 'Volver a cargar' la vuelve a leer", async () => {
    acciones.corregirVuelosDeReserva.mockResolvedValue({ ok: false, error: T.cambio, cambio: true });
    const form = await abrirFormulario();
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));
    expect(await within(form).findByText(T.cambio)).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: T.volverACargar }));
    await waitFor(() => expect(consultas.cargarReserva).toHaveBeenCalledTimes(2));
  });

  it("'No se pudo guardar: <motivo>' con 'Reintentar' (sin sesión, conexión)", async () => {
    acciones.corregirVuelosDeReserva
      .mockResolvedValueOnce({ ok: false, error: T.error(T.motivos.sinSesion), sinSesion: true })
      .mockResolvedValueOnce(okRecibida);
    const form = await abrirFormulario();
    fireEvent.click(within(form).getByRole("button", { name: T.guardar }));
    expect(await within(form).findByText(T.error(T.motivos.sinSesion))).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: T.reintentar }));
    expect(await screen.findByTestId("producto-confirmado")).toHaveTextContent(T.listo);
    expect(acciones.corregirVuelosDeReserva).toHaveBeenCalledTimes(2);
  });
});
