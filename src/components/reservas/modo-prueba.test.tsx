// @vitest-environment jsdom
//
// Spec M2-06 — verificación 1 (pantallas con datos simulados): "Ver las de
// prueba", el vacío con solo reservas de prueba, la medición arriba de la
// lista (fila 14) y la marca del owner en el detalle, solo en las de prueba
// (fila 13), con su error.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
  cargarRevisiones: vi.fn(),
  cargarRevision: vi.fn(),
}));
const accion = vi.hoisted(() => ({ marcarReservaDePrueba: vi.fn() }));
const busqueda = vi.hoisted(() => ({ actual: "" }));

vi.mock("@/lib/reservas/consultas", () => consultas);
// M3-08: la lista llega del servidor (server action); acá, de la consulta reemplazada. "Hoy" antes de los viajes de los fixtures: ninguno terminó.
vi.mock("@/app/(app)/reservas/acciones-lista", () => ({
  cargarLaListaDeReservas: async () => ({ filas: await consultas.cargarReservas({}), esAdmin: false, hoy: "2026-01-01", agencias: [] }),
}));
vi.mock("@/app/(app)/reservas/[id]/acciones", () => accion);
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams(busqueda.actual),
}));

import { IDS, listaReservas, reservaKilroy, reservaRevision } from "@/lib/reservas/fixtures.test-utils";
import type { RevisionDePrueba } from "@/lib/reservas/tipos";
import { ListaReservasPantalla } from "./lista-reservas-pantalla";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const marca = (c: Partial<RevisionDePrueba> = {}): RevisionDePrueba => ({
  reservaId: IDS.revision,
  resultado: "bien",
  queMal: [],
  nota: null,
  autor: "Owner Prueba",
  fecha: "2026-10-15T13:00:00.000Z",
  ...c,
});

beforeEach(() => {
  vi.clearAllMocks();
  busqueda.actual = "";
  consultas.cargarRevisiones.mockResolvedValue(new Map());
  consultas.cargarRevision.mockResolvedValue(null);
});

describe("lista: las de prueba", () => {
  it("por defecto no se ven; el enlace 'Ver las de prueba (2)' las muestra", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    expect(tabla.querySelectorAll("tr[data-id]")).toHaveLength(2);
    expect(tabla.querySelector("tr[data-prueba]")).toBeNull();
    expect(screen.getByRole("link", { name: "Ver las de prueba (2)" })).toHaveAttribute("href", "/reservas?prueba=1");
    expect(screen.queryByText(/^Revisadas/)).toBeNull();
  });

  it("sin reservas reales pero con de prueba: el vacío lo dice, con el enlace para verlas", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas.filter((r) => r.dePrueba));
    render(<ListaReservasPantalla />);
    expect(await screen.findByText("Todavía no entraron reservas reales. Hay 2 de prueba.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver las de prueba" })).toHaveAttribute("href", "/reservas?prueba=1");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("con 'Ver las de prueba': todas, y arriba la medición (faltan por revisar, sin veredicto)", async () => {
    busqueda.actual = "prueba=1";
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    consultas.cargarRevisiones.mockResolvedValue(new Map([[IDS.revision, marca()]]));
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    expect(tabla.querySelectorAll("tr[data-id]")).toHaveLength(4);
    expect(await screen.findByText("Revisadas 1 de 2 · 0 mal (0%) · faltan 1 por revisar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ocultar las de prueba" })).toHaveAttribute("href", "/reservas");
  });

  it("con todas marcadas: el veredicto (más del 20% mal = se frena)", async () => {
    busqueda.actual = "prueba=1";
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    consultas.cargarRevisiones.mockResolvedValue(
      new Map([
        [IDS.revision, marca()],
        [IDS.sinProducto, marca({ reservaId: IDS.sinProducto, resultado: "mal", queMal: ["producto"] })],
      ]),
    );
    render(<ListaReservasPantalla />);
    expect(await screen.findByText("Revisadas 2 de 2 · 1 mal (50%) · se frena: no activar M2-07")).toBeInTheDocument();
  });

  it("si las marcas no cargan, lo dice y la lista se ve igual", async () => {
    busqueda.actual = "prueba=1";
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    consultas.cargarRevisiones.mockRejectedValue(new Error("caída"));
    render(<ListaReservasPantalla />);
    expect(await screen.findByText("No pudimos cargar las marcas de revisión de las reservas de prueba.")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("detalle: la marca del owner (fila 13)", () => {
  it("una reserva real no tiene botones para marcar", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByTestId("encabezado-reserva");
    expect(screen.queryByText("¿Quedó bien?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Está bien" })).toBeNull();
    expect(consultas.cargarRevision).not.toHaveBeenCalled();
  });

  it("una de prueba: 'Está bien' la marca y muestra quién y cuándo", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaRevision);
    accion.marcarReservaDePrueba.mockResolvedValue({ ok: true, revision: marca() });
    render(<DetalleReservaPantalla id={IDS.revision} />);
    expect(await screen.findByText("Todavía no la marcó nadie.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Está bien" }));
    await waitFor(() =>
      expect(accion.marcarReservaDePrueba).toHaveBeenCalledWith({ reservaId: IDS.revision, resultado: "bien", queMal: [], nota: null }),
    );
    expect(await screen.findByText(/^Marcada como bien por Owner Prueba el /)).toBeInTheDocument();
  });

  it("'Hay que corregir': pide qué está mal, con una nota, y lo guarda", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaRevision);
    accion.marcarReservaDePrueba.mockResolvedValue({ ok: true, revision: marca({ resultado: "mal", queMal: ["producto", "vuelos"], nota: "Era AR09" }) });
    render(<DetalleReservaPantalla id={IDS.revision} />);
    fireEvent.click(await screen.findByRole("button", { name: "Hay que corregir" }));
    const grupo = screen.getByRole("group", { name: "Qué está mal" });
    fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Marcá al menos una cosa que esté mal.")).toBeInTheDocument();
    expect(accion.marcarReservaDePrueba).not.toHaveBeenCalled();

    fireEvent.click(within(grupo).getByLabelText("Producto"));
    fireEvent.click(within(grupo).getByLabelText("Vuelos"));
    fireEvent.change(within(grupo).getByLabelText("Nota (opcional)"), { target: { value: "Era AR09" } });
    fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(accion.marcarReservaDePrueba).toHaveBeenCalledWith({
        reservaId: IDS.revision,
        resultado: "mal",
        queMal: ["producto", "vuelos"],
        nota: "Era AR09",
      }),
    );
    expect(await screen.findByText(/^Marcada para corregir \(producto, vuelos\) por Owner Prueba el /)).toBeInTheDocument();
  });

  it("si no se pudo guardar: el aviso, y la marca anterior queda como estaba", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaRevision);
    consultas.cargarRevision.mockResolvedValue(marca());
    accion.marcarReservaDePrueba.mockResolvedValue({ ok: false, error: "caída" });
    render(<DetalleReservaPantalla id={IDS.revision} />);
    expect(await screen.findByText(/^Marcada como bien por Owner Prueba/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hay que corregir" }));
    fireEvent.click(screen.getByLabelText("Fechas"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("No se pudo guardar la marca. La anterior queda como estaba.")).toBeInTheDocument();
    expect(screen.getByText(/^Marcada como bien por Owner Prueba/)).toBeInTheDocument();
  });
});
