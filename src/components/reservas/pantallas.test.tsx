// @vitest-environment jsdom
//
// Spec M2-05 — verificación 1: la lista y el detalle de reservas con datos
// simulados (consultas mockeadas), con sus estados de carga, error y vacío, y
// las pruebas de lo que no debe pasar (#4, #6, #13, #14, #16, #17).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarReservas: vi.fn(),
  cargarReserva: vi.fn(),
  urlDelPdf: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/reservas/consultas", () => consultas);
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/reservas" }));

import {
  IDS,
  PRODUCTOS,
  cuerpoPeligroso,
  detalle,
  listaReservas,
  mail,
  reservaDosMails,
  reservaKilroy,
  reservaRevision,
  reservaSinProducto,
  reservaTour,
  reservaVacia,
} from "@/lib/reservas/fixtures.test-utils";
import { formatearFechaHora } from "@/lib/formato";
import { ListaReservasPantalla } from "./lista-reservas-pantalla";
import { DetalleReservaPantalla } from "./detalle-reserva-pantalla";

const nunca = () => new Promise(() => {});
const BOTONES_PERMITIDOS = /^(Reintentar|Ver mail|Abrir el PDF|(Estado|Agencia|Número de la agencia|Producto|Fechas del viaje|Pax|Llegó)( [↑↓])?)$/;

function sinControlesDeEdicion() {
  expect(document.querySelectorAll("input, textarea, select")).toHaveLength(0);
  for (const b of screen.queryAllByRole("button")) expect(b.textContent?.trim()).toMatch(BOTONES_PERMITIDOS);
  expect(screen.queryByText(/Editar|Guardar|Resolver revisión|Armar pedidos|Descartar|Reprocesar/)).toBeNull();
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Lista -----------------------------------------------------------------------------

describe("lista de reservas (#2, #3, #4, #16)", () => {
  it("mientras carga muestra el esqueleto de tabla, nunca un spinner", () => {
    consultas.cargarReservas.mockImplementation(nunca);
    render(<ListaReservasPantalla />);
    expect(screen.getByRole("status", { name: "Cargando las reservas" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("si falla: el mensaje y Reintentar, que repite la consulta y muestra la tabla", async () => {
    consultas.cargarReservas.mockRejectedValueOnce(new Error("caída")).mockResolvedValueOnce(listaReservas);
    render(<ListaReservasPantalla />);
    expect(await screen.findByText("No pudimos cargar las reservas.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(consultas.cargarReservas).toHaveBeenCalledTimes(2);
  });

  it("sin reservas: el mensaje de vacío, sin tabla vacía ni error", async () => {
    consultas.cargarReservas.mockResolvedValue([]);
    render(<ListaReservasPantalla />);
    expect(
      await screen.findByText(
        "Todavía no entró ninguna reserva. Cuando llegue un mail a la casilla, va a aparecer acá.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("No pudimos cargar las reservas.")).toBeNull();
  });

  it("las 7 columnas pobladas, la más nueva arriba, fechas DD/MM/AAAA y pax entero", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    const encabezados = within(tabla).getAllByRole("columnheader").map((h) => h.textContent?.replace(/ [↑↓]$/, ""));
    expect(encabezados).toEqual(["Estado", "Agencia", "Número de la agencia", "Producto", "Fechas del viaje", "Pax", "Llegó"]);

    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas.map((f) => f.getAttribute("data-id"))).toEqual([IDS.revision, IDS.tour, IDS.sinProducto, IDS.kilroy]);

    const kilroy = within(filas[3]).getAllByRole("cell").map((c) => c.textContent);
    expect(kilroy[0]).toContain("recibida");
    expect(kilroy[1]).toBe("Kilroy");
    expect(kilroy[2]).toBe("DK1531608");
    expect(kilroy[3]).toBe("OD019 Iguazu Falls Combined");
    expect(kilroy[4]).toBe("12/03/2026 → 15/03/2026");
    expect(kilroy[5]).toBe("2");
    expect(kilroy[6]).toBe(formatearFechaHora("2026-10-10T09:00:00.000Z"));

    expect(within(filas[2]).getByText("Sin producto reconocido")).toBeInTheDocument();
  });

  it("tocar una fila abre el detalle", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    fireEvent.click(within(tabla).getByText("DK1562336"));
    expect(push).toHaveBeenCalledWith(`/reservas/${IDS.tour}`);
  });

  it("cada columna se ordena", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    fireEvent.click(within(tabla).getByRole("button", { name: "Pax" }));
    const pax = within(tabla)
      .getAllByRole("row")
      .slice(1)
      .map((f) => within(f).getAllByRole("cell")[5].textContent);
    expect(pax).toEqual(["1", "2", "2", "3"]);
    fireEvent.click(within(tabla).getByRole("button", { name: /Agencia/ }));
    const agencias = within(tabla)
      .getAllByRole("row")
      .slice(1)
      .map((f) => within(f).getAllByRole("cell")[1].textContent);
    expect(agencias).toEqual(["Kilroy", "Kilroy", "Kilroy", "TourRadar"]);
  });

  it("una para revisión: chip escrito + franja + triángulo; una recibida, nada de eso (#3)", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    const revision = tabla.querySelector(`tr[data-id="${IDS.revision}"]`) as HTMLElement;
    const recibida = tabla.querySelector(`tr[data-id="${IDS.kilroy}"]`) as HTMLElement;
    expect(within(revision).getByText("para revisión")).toBeInTheDocument();
    expect(revision).toHaveAttribute("data-atencion", "true");
    expect(revision.querySelector("[data-icono='triangulo']")).not.toBeNull();
    expect(within(recibida).queryByText("para revisión")).toBeNull();
    expect(recibida).not.toHaveAttribute("data-atencion");
    expect(recibida.querySelector("[data-icono='triangulo']")).toBeNull();

    const duplicada = tabla.querySelector(`tr[data-id="${IDS.sinProducto}"]`) as HTMLElement;
    expect(within(duplicada).getByText("posible duplicada")).toBeInTheDocument();
    expect(within(revision).queryByText("posible duplicada")).toBeNull();
  });

  it("las de prueba llevan el chip y la fila atenuada, todas; las reales no (#4)", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    render(<ListaReservasPantalla />);
    const tabla = await screen.findByRole("table");
    expect(screen.getByText("4 reservas · 2 de prueba")).toBeInTheDocument();
    for (const r of listaReservas) {
      const f = tabla.querySelector(`tr[data-id="${r.id}"]`) as HTMLElement;
      if (r.dePrueba) {
        expect(within(f).getByText("De prueba")).toBeInTheDocument();
        expect(f).toHaveAttribute("data-prueba", "true");
      } else {
        expect(within(f).queryByText("De prueba")).toBeNull();
        expect(f).not.toHaveAttribute("data-prueba");
      }
    }
  });

  it("el total sin reservas de prueba no las menciona", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas.filter((r) => !r.dePrueba));
    render(<ListaReservasPantalla />);
    expect(await screen.findByText("2 reservas")).toBeInTheDocument();
  });

  it("no hay nada que edite (#14)", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    render(<ListaReservasPantalla />);
    await screen.findByRole("table");
    sinControlesDeEdicion();
  });
});

// --- Detalle ---------------------------------------------------------------------------

describe("detalle: estados (#17)", () => {
  it("mientras carga, esqueleto de las zonas", () => {
    consultas.cargarReserva.mockImplementation(nunca);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    expect(screen.getByRole("status", { name: "Cargando la reserva" })).toBeInTheDocument();
  });

  it("si falla: el mensaje, Reintentar y Volver a las reservas", async () => {
    consultas.cargarReserva.mockRejectedValueOnce(new Error("caída")).mockResolvedValueOnce(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    expect(await screen.findByText("No pudimos abrir esta reserva.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Volver a las reservas" })[0]).toHaveAttribute("href", "/reservas");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("DK1531608")).toBeInTheDocument();
  });

  it("una reserva que no existe: el mensaje y Volver, sin pantalla en blanco", async () => {
    consultas.cargarReserva.mockResolvedValue(null);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    expect(await screen.findByText("Esta reserva no existe.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Volver a las reservas" })[0]).toHaveAttribute("href", "/reservas");
  });

  it("un id sin formato válido: no existe, sin consultar la base", async () => {
    render(<DetalleReservaPantalla id="no-es-un-id" />);
    expect(await screen.findByText("Esta reserva no existe.")).toBeInTheDocument();
    expect(consultas.cargarReserva).not.toHaveBeenCalled();
  });
});

describe("detalle: encabezado, marcas y motivos (#4, #5, #6)", () => {
  it("encabezado de una reserva de Kilroy y el enlace para volver", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const titulo = await screen.findByRole("heading", { level: 1 });
    expect(titulo).toHaveTextContent("DK1531608");
    const encabezado = screen.getByTestId("encabezado-reserva");
    expect(within(encabezado).getByText("recibida")).toBeInTheDocument();
    expect(within(encabezado).getByText("Kilroy")).toBeInTheDocument();
    expect(within(encabezado).getByText(formatearFechaHora(reservaKilroy.llego))).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Volver a las reservas" })[0]).toHaveAttribute("href", "/reservas");
  });

  it("una reserva de prueba lleva el aviso arriba de todo y el chip; una real, ninguno", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaRevision);
    const { unmount } = render(<DetalleReservaPantalla id={IDS.revision} />);
    const aviso = await screen.findByText(
      "Reserva de prueba. Se cargó para revisar cómo se leen los mails. No es una reserva real.",
    );
    expect(screen.getByText("De prueba")).toBeInTheDocument();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(aviso.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/Reserva de prueba/)).toBeNull();
    expect(screen.queryByText("De prueba")).toBeNull();
  });

  it("cada motivo en su frase con su detalle concreto, uno por renglón, y la genérica para el que no tiene", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaRevision);
    render(<DetalleReservaPantalla id={IDS.revision} />);
    const motivos = await screen.findByTestId("motivos-revision");
    expect(within(motivos).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Faltan los datos de vuelo, y el producto incluye traslados. Vuelo de llegada a Puerto Iguazú (IGR), para el traslado de OD019.",
      "No se pudo reconocer el producto con seguridad. Revisá el mail para confirmar cuál es. La agencia lo pide como Iguazu. Podría ser OD010A.",
      "Esta reserva necesita que alguien la revise.",
    ]);
    expect(within(motivos).getByText("Faltan los datos de vuelo, y el producto incluye traslados.")).toBeInTheDocument();
    expect(within(motivos).getByText("Vuelo de llegada a Puerto Iguazú (IGR), para el traslado de OD019.")).toBeInTheDocument();
    expect(within(screen.getByTestId("encabezado-reserva")).getByText("para revisión")).toBeInTheDocument();
  });

  it("no se ve ningún código interno, jerga, número de confianza ni ruta", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaRevision);
    render(<DetalleReservaPantalla id={IDS.revision} />);
    await screen.findByTestId("motivos-revision");
    const visible = (document.body.textContent ?? "").replace(cuerpoDelMailVisible(), "");
    for (const p of [/falta_vuelo/, /codigo_nuevo/, /_/, /Owner/i, /\bM[1-9]\b/, /data\//, /\bIA\b/, /0[.,]62/, /\.csv|\.ts\b/]) {
      expect(visible, String(p)).not.toMatch(p);
    }
  });

  it("posible duplicada: chip y enlace a la reserva parecida", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaSinProducto);
    render(<DetalleReservaPantalla id={IDS.sinProducto} />);
    const enlace = await screen.findByRole("link", { name: "Ver la reserva parecida" });
    expect(enlace).toHaveAttribute("href", `/reservas/${IDS.kilroy}`);
    expect(within(screen.getByTestId("encabezado-reserva")).getByText("posible duplicada")).toBeInTheDocument();
    expect(screen.getByText("Esta reserva se parece a otra (misma agencia, producto y fechas). Revisala antes de seguir.")).toBeInTheDocument();
  });

  it("una reserva recibida no tiene aviso de revisión", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByTestId("motivos-revision")).toBeNull();
  });
});

function cuerpoDelMailVisible(): string {
  return screen.queryByTestId("cuerpo-mail")?.textContent ?? "\u0000";
}

describe("detalle: producto y partes del tour (#7, #8)", () => {
  it("el producto enlaza a su ficha del catálogo", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const enlace = await screen.findByRole("link", { name: /OD019/ });
    expect(enlace).toHaveAttribute("href", `/catalogo/${PRODUCTOS.od019.id}`);
    expect(screen.getByText("Iguazu Falls Combined")).toBeInTheDocument();
  });

  it("sin producto: el texto y lo que dijo el mail, sin enlace", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaSinProducto);
    render(<DetalleReservaPantalla id={IDS.sinProducto} />);
    const seccion = await screen.findByTestId("producto-reserva");
    expect(within(seccion).getByText("Sin producto reconocido")).toBeInTheDocument();
    expect(within(seccion).getByText("En el mail: «Iguazu Falls on a Shoestring (3N)»")).toBeInTheDocument();
    expect(within(seccion).queryByRole("link")).toBeNull();
  });

  it("un tour: sus partes en orden, cada paquete enlaza a su ficha y el bus lleva su etiqueta", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaTour);
    render(<DetalleReservaPantalla id={IDS.tour} />);
    const tabla = await screen.findByRole("table", { name: "Partes del tour" });
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(3);
    expect(within(filas[0]).getByRole("link", { name: "CH01" })).toHaveAttribute("href", `/catalogo/${PRODUCTOS.ch01.id}`);
    expect(filas[0]).toHaveTextContent("02/04/2026 → 05/04/2026");
    expect(filas[1]).toHaveTextContent("San Pedro de Atacama → Uyuni");
    expect(within(filas[1]).getByText("Tramo externo pendiente de emitir")).toBeInTheDocument();
    expect(within(filas[2]).getByRole("link", { name: "BO01" })).toHaveAttribute("href", `/catalogo/${PRODUCTOS.bo01.id}`);
  });

  it("un producto simple no muestra la sección de partes", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("table", { name: "Partes del tour" })).toBeNull();
  });
});

describe("detalle: datos y vuelos (#9, #10)", () => {
  it("con todos los datos, se ven todos", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const datos = await screen.findByTestId("datos-reserva");
    for (const t of ["12/03/2026", "15/03/2026", "2", "Ana Prueba", "Juan Ejemplo", "Doble", "Vegetariano"]) {
      expect(within(datos).getByText(t)).toBeInTheDocument();
    }
  });

  it("una reserva que no se pudo leer: cada dato muestra —, nunca null ni un hueco", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaVacia);
    render(<DetalleReservaPantalla id={IDS.vacia} />);
    const datos = await screen.findByTestId("datos-reserva");
    const valores = Array.from(datos.querySelectorAll("dd")).map((dd) => dd.textContent);
    expect(valores).toHaveLength(6);
    for (const v of valores) expect(v).toBe("—");
    expect(document.body.textContent).not.toMatch(/null|undefined|NaN/);
    expect(screen.getByText("El mail no trae datos de vuelo.")).toBeInTheDocument();
  });

  it("la hora del vuelo es la del mail, sin convertir", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaTour);
    render(<DetalleReservaPantalla id={IDS.tour} />);
    const tabla = await screen.findByRole("table", { name: "Vuelos" });
    const fila = within(tabla).getAllByRole("row")[1];
    expect(fila).toHaveTextContent("LA8020");
    expect(fila).toHaveTextContent("LATAM");
    expect(fila).toHaveTextContent("SCL · 02/04/2026 12:10");
    expect(fila).toHaveTextContent("CJC · 02/04/2026 14:35");
  });

  it("sin vuelos: el texto", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    expect(await screen.findByText("El mail no trae datos de vuelo.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Vuelos" })).toBeNull();
  });
});

describe("detalle: el mail original (#11, #12, #13)", () => {
  it("remitente, asunto, llegada y el cuerpo completo", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const panel = await screen.findByTestId("mail-original");
    expect(within(panel).getByText(/aarhus@kilroy\.dk/)).toBeInTheDocument();
    expect(within(panel).getByText("DK1531608 - Iguazu Falls Combined - KILROY booking request")).toBeInTheDocument();
    expect(within(panel).getByText(formatearFechaHora("2026-10-12T14:20:00.000Z"))).toBeInTheDocument();
    expect(within(panel).getByTestId("cuerpo-mail").textContent).toBe(reservaKilroy.mails[0].cuerpo);
    expect(within(panel).queryByText("Llegó a la carpeta de spam")).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Abrir el PDF" })).toBeNull();
  });

  it("si llegó a spam, lo dice", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaSinProducto);
    render(<DetalleReservaPantalla id={IDS.sinProducto} />);
    expect(await screen.findByText("Llegó a la carpeta de spam")).toBeInTheDocument();
  });

  it("Abrir el PDF lo abre en otra pestaña con el enlace que caduca; deshabilitado mientras se prepara", async () => {
    let resolver: (url: string) => void = () => {};
    consultas.urlDelPdf.mockImplementation(() => new Promise<string>((r) => (resolver = r)));
    const ventana = { location: { href: "" }, opener: {} as unknown, close: vi.fn() };
    const abrir = vi.spyOn(window, "open").mockReturnValue(ventana as unknown as Window);
    consultas.cargarReserva.mockResolvedValue(reservaSinProducto);
    render(<DetalleReservaPantalla id={IDS.sinProducto} />);
    const boton = await screen.findByRole("button", { name: "Abrir el PDF" });
    fireEvent.click(boton);
    expect(boton).toBeDisabled();
    expect(consultas.urlDelPdf).toHaveBeenCalledWith(expect.anything(), reservaSinProducto.mails[0].pdfs[0].ruta);
    resolver("https://firmado.test/pdf?token=1");
    await waitFor(() => expect(ventana.location.href).toBe("https://firmado.test/pdf?token=1"));
    expect(abrir).toHaveBeenCalled();
    expect(ventana.opener).toBeNull();
    await waitFor(() => expect(boton).not.toBeDisabled());
    abrir.mockRestore();
  });

  it("el PDF que no abre: el mensaje", async () => {
    consultas.urlDelPdf.mockRejectedValue(new Error("sin permiso"));
    const ventana = { location: { href: "" }, opener: null, close: vi.fn() };
    const abrir = vi.spyOn(window, "open").mockReturnValue(ventana as unknown as Window);
    consultas.cargarReserva.mockResolvedValue(reservaSinProducto);
    render(<DetalleReservaPantalla id={IDS.sinProducto} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir el PDF" }));
    expect(await screen.findByText("No se pudo abrir el PDF. Probá de nuevo.")).toBeInTheDocument();
    expect(ventana.close).toHaveBeenCalled();
    abrir.mockRestore();
  });

  it("dos mails: en orden de llegada, el primero abierto y el otro con Ver mail", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaDosMails);
    render(<DetalleReservaPantalla id={IDS.dosMails} />);
    const panel = await screen.findByTestId("mail-original");
    const items = within(panel).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Mail que creó la reserva");
    expect(items[0]).toHaveTextContent("NEW BOOKING DK1562336");
    expect(items[1]).toHaveTextContent("NEW FLIGHT: DK1562336");
    expect(within(panel).getByTestId("cuerpo-mail").textContent).toBe("Primer mail de la reserva");
    fireEvent.click(within(items[1]).getByRole("button", { name: "Ver mail" }));
    expect(within(panel).getByTestId("cuerpo-mail").textContent).toBe("Segundo mail con los vuelos");
  });

  it("un solo mail: sin lista de mails", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaKilroy);
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const panel = await screen.findByTestId("mail-original");
    expect(within(panel).queryByRole("list")).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Ver mail" })).toBeNull();
  });

  it("un mail peligroso se ve como texto: ningún script, imagen ni enlace sale del mail", async () => {
    consultas.cargarReserva.mockResolvedValue(detalle({ id: IDS.kilroy, mails: [mail({ cuerpo: cuerpoPeligroso })] }));
    render(<DetalleReservaPantalla id={IDS.kilroy} />);
    const cuerpo = await screen.findByTestId("cuerpo-mail");
    expect(cuerpo.textContent).toBe(cuerpoPeligroso);
    expect(cuerpo.querySelectorAll("script, img, a, iframe")).toHaveLength(0);
    expect(document.querySelectorAll("script")).toHaveLength(0);
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(document.querySelector('a[href^="http"]')).toBeNull();
  });

  it("el detalle no tiene nada que edite (#14)", async () => {
    consultas.cargarReserva.mockResolvedValue(reservaSinProducto);
    render(<DetalleReservaPantalla id={IDS.sinProducto} />);
    await screen.findByTestId("mail-original");
    sinControlesDeEdicion();
  });
});
