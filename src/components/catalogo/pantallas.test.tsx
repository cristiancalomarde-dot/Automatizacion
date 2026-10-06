// @vitest-environment jsdom
//
// Spec M1-06 — verificación 1: las pantallas con datos de prueba (consultas
// mockeadas), incluidos los tres estados de cada una (carga / error / vacío).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const consultas = vi.hoisted(() => ({
  cargarCatalogo: vi.fn(),
  cargarProducto: vi.fn(),
  cargarDirectorio: vi.fn(),
  cargarProveedor: vi.fn(),
  cargarPendientes: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalogo/consultas", () => consultas);
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/catalogo" }));

import {
  antarctica,
  catalogo,
  chb31,
  directorio,
  od010a,
  pendientes,
  tourConTourAdentro,
  unServicio,
} from "@/lib/catalogo/fixtures.test-utils";
import { CatalogoPantalla } from "./catalogo-pantalla";
import { DetalleProductoPantalla } from "./detalle-producto-pantalla";
import { DirectorioPantalla } from "./directorio-pantalla";
import { DetalleProveedorPantalla } from "./detalle-proveedor-pantalla";
import { PendientesPantalla } from "./pendientes-pantalla";

const nunca = () => new Promise(() => {});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Catálogo de productos (#1, #2, #10, #12)", () => {
  it("mientras carga muestra el esqueleto de tabla, no una pantalla en blanco", () => {
    consultas.cargarCatalogo.mockImplementation(nunca);
    render(<CatalogoPantalla />);
    expect(screen.getByRole("status", { name: "Cargando el catálogo" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("una fila por producto con código, nombre, ciudades, proveedores y última edición", async () => {
    consultas.cargarCatalogo.mockResolvedValue(catalogo);
    render(<CatalogoPantalla />);
    const tabla = await screen.findByRole("table");
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(3);
    const od010aFila = filas.find((f) => within(f).queryByText("OD010A"))!;
    expect(within(od010aFila).getByText("Iguazu Falls on a Shoestring Argentina")).toBeInTheDocument();
    expect(within(od010aFila).getByText("IGR")).toBeInTheDocument();
    expect(within(od010aFila).getByText("2")).toBeInTheDocument();
    expect(within(od010aFila).getByText(/27\/09\/2026/)).toBeInTheDocument();
    expect(within(od010aFila).getByText(/160955/)).toBeInTheDocument();
    const od022Fila = filas.find((f) => within(f).queryByText("OD022"))!;
    expect(within(od022Fila).getByText("1 pendiente")).toBeInTheDocument();
  });

  it("buscar CHB31 u 'overland' deja solo el Overland; sin coincidencias avisa", async () => {
    consultas.cargarCatalogo.mockResolvedValue(catalogo);
    render(<CatalogoPantalla />);
    const buscador = await screen.findByLabelText("Buscar por código o nombre");

    fireEvent.change(buscador, { target: { value: "CHB31" } });
    let filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(1);
    expect(within(filas[0]).getByText("Overland San Pedro de Atacama to Uyuni, end in La Paz")).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: "overland" } });
    filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(1);

    fireEvent.change(buscador, { target: { value: "zzz" } });
    expect(screen.getByText("Ningún producto coincide con la búsqueda.")).toBeInTheDocument();
  });

  it("la fila entera lleva al detalle del producto", async () => {
    consultas.cargarCatalogo.mockResolvedValue(catalogo);
    render(<CatalogoPantalla />);
    fireEvent.click(await screen.findByText("Overland San Pedro de Atacama to Uyuni, end in La Paz"));
    expect(push).toHaveBeenCalledWith("/catalogo/prod-chb31");
  });

  it("#10 catálogo vacío: el texto exacto + 'Cargar productos', sin tabla ni error", async () => {
    consultas.cargarCatalogo.mockResolvedValue([]);
    render(<CatalogoPantalla />);
    expect(
      await screen.findByText(
        "El catálogo está vacío. Sin productos cargados, las reservas no se pueden emparejar.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargar productos" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("No pudimos cargar el catálogo.")).toBeNull();
  });

  it("#12 si la consulta falla: mensaje de error y 'Reintentar' repite la consulta", async () => {
    consultas.cargarCatalogo.mockRejectedValueOnce(new Error("red")).mockResolvedValueOnce(catalogo);
    render(<CatalogoPantalla />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar el catálogo.");
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(consultas.cargarCatalogo).toHaveBeenCalledTimes(2);
  });
});

describe("Detalle de producto simple (#3, #5, #6, #14, #15, #17)", () => {
  it("agrupa por nivel con prioridades, muestra mails sin clic extra, el origen en el Excel y los códigos", async () => {
    consultas.cargarProducto.mockResolvedValue(od010a);
    render(<DetalleProductoPantalla id="prod-od010a" />);

    await screen.findByRole("heading", { name: /Iguazu Falls on a Shoestring Argentina/ });
    const tabla = screen.getByRole("table", { name: "Alojamiento por nivel" });
    const texto = tabla.textContent ?? "";
    expect(texto.indexOf("Hostel")).toBeLessThan(texto.indexOf("Budget Hotel"));
    expect(within(tabla).getByText("No ofrecido")).toBeInTheDocument();
    expect(texto.indexOf("Hotel 3* El Pueblito")).toBeLessThan(texto.indexOf("Botanica"));
    expect(within(tabla).getByText("1ª opción")).toBeInTheDocument();
    expect(within(tabla).getByText("2ª opción")).toBeInTheDocument();

    expect(screen.getAllByText("reservas3@cuencadelplata.com").length).toBeGreaterThan(0);
    expect(screen.getByText("beerhotel@cervezaholy.com", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("Excel de paquetes, fila 12").length).toBe(2);
    expect(screen.getAllByText("Con mail").length).toBeGreaterThan(0);
    expect(screen.getByText("Paquete Receptvo 105 Premium")).toBeInTheDocument();

    const codigos = screen.getByRole("table", { name: "Códigos de agencia" });
    expect(within(codigos).getByText("160955")).toBeInTheDocument();
    expect(within(codigos).getByText("Iguazu Falls on a Shoestring (3N)")).toBeInTheDocument();

    const enlace = screen.getAllByRole("link", { name: "Cuenca Del Plata (Natalia )" })[0];
    expect(enlace).toHaveAttribute("href", "/proveedores/prov-cuenca");
  });

  it("#15 estados escritos: manual, WhatsApp, sin resolver con motivo, opcional", async () => {
    consultas.cargarProducto.mockResolvedValue({
      ...od010a,
      servicios: [
        ...chb31.componentes[0].producto!.servicios,
        unServicio({
          tipo: "excursion",
          orden: 9,
          opcional: true,
          sinResolver: true,
          descripcion: "Optional Excursion: Kayak. Booking Supplier: Nadie",
          bookingSupplierNombre: "Nadie",
        }),
      ],
    });
    render(<DetalleProductoPantalla id="prod-od030" />);
    expect(await screen.findByText("Manual en sistema propio")).toBeInTheDocument();
    expect(screen.getByText("Se reserva a mano en Transvipp.")).toBeInTheDocument();
    expect(screen.getByText("Por WhatsApp (pedido a mano)")).toBeInTheDocument();
    expect(screen.getByText("Sin resolver")).toBeInTheDocument();
    expect(screen.getByText(/«Nadie» no está en el directorio/)).toBeInTheDocument();
    expect(screen.getByText("Opcional")).toBeInTheDocument();
  });

  it("#6 sin ningún proveedor: aviso 'No se le podrán armar pedidos' en vez de una lista vacía", async () => {
    consultas.cargarProducto.mockResolvedValue({ ...od010a, servicios: [] });
    render(<DetalleProductoPantalla id="prod-x" />);
    expect(await screen.findByText(/No se le podrán armar pedidos/)).toBeInTheDocument();
  });

  it("error: 'No pudimos abrir este producto' con Reintentar y Volver al catálogo", async () => {
    consultas.cargarProducto.mockRejectedValueOnce(new Error("red")).mockResolvedValueOnce(od010a);
    render(<DetalleProductoPantalla id="prod-od010a" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos abrir este producto.");
    expect(screen.getByRole("link", { name: "Volver al catálogo" })).toHaveAttribute("href", "/catalogo");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("heading", { name: /Iguazu Falls/ });
  });

  it("mientras carga: esqueleto de las zonas", () => {
    consultas.cargarProducto.mockImplementation(nunca);
    render(<DetalleProductoPantalla id="prod-od010a" />);
    expect(screen.getByRole("status", { name: "Cargando el producto" })).toBeInTheDocument();
  });
});

describe("Detalle de tour compuesto (#4, #16)", () => {
  it("día por día: paquetes con proveedor y mail, tramo de bus sin proveedor, bus propio del tour", async () => {
    consultas.cargarProducto.mockResolvedValue(chb31);
    render(<DetalleProductoPantalla id="prod-chb31" />);

    const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" });
    const texto = itinerario.textContent ?? "";
    expect(texto.indexOf("OD030")).toBeLessThan(texto.indexOf("San Pedro de Atacama – Uyuni"));
    expect(texto.indexOf("San Pedro de Atacama – Uyuni")).toBeLessThan(texto.indexOf("Imperio Inca"));
    expect(within(itinerario).getByRole("link", { name: "OD030" })).toHaveAttribute("href", "/catalogo/prod-od030");
    expect(within(itinerario).getByText("horizonteatacamareserva@gmail.com")).toBeInTheDocument();
    expect(within(itinerario).getByText("Tramo externo pendiente de emitir")).toBeInTheDocument();
    expect(within(itinerario).getByText("Pasaje que emite HI Travel. Sin proveedor.")).toBeInTheDocument();
    expect(within(itinerario).getByText("Bus nocturno")).toBeInTheDocument();
    expect(within(itinerario).getByText("Transfer de llegada")).toBeInTheDocument();
    expect(within(itinerario).getByText("3 noches")).toBeInTheDocument();
    expect(within(itinerario).getAllByText("Día 1").length).toBeGreaterThan(0);
    expect(within(itinerario).getByText("Día 6")).toBeInTheDocument();
    expect(screen.queryByText(/No se le podrán armar pedidos/)).toBeNull();
  });

  it("un componente que es otro tour es un enlace a ese tour", async () => {
    consultas.cargarProducto.mockResolvedValue(tourConTourAdentro);
    render(<DetalleProductoPantalla id="prod-5c01" />);
    const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" });
    expect(within(itinerario).getByRole("link", { name: "CHB31" })).toHaveAttribute("href", "/catalogo/prod-chb31");
    expect(within(itinerario).getByText("Es un tour. Ver su itinerario completo.")).toBeInTheDocument();
    expect(within(itinerario).getByText("Día 22")).toBeInTheDocument();
  });
});

describe("Directorio de proveedores (#7, #8, #11, #12)", () => {
  it("una fila por proveedor; la fila sin mail se marca con etiqueta escrita", async () => {
    consultas.cargarDirectorio.mockResolvedValue(directorio);
    render(<DirectorioPantalla />);
    const tabla = await screen.findByRole("table");
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(3);
    const fila = filas.find((f) => within(f).queryByText("Antarctica Hostel"))!;
    expect(within(fila).getByText("Sin mail")).toBeInTheDocument();
    expect(within(fila).getByText(/WSP: \+54 9 2901 58-4652/)).toBeInTheDocument();
    expect(within(fila).getByText("USHUAIA")).toBeInTheDocument();
    const filaCuenca = filas.find((f) => within(f).queryByText("Cuenca Del Plata (Natalia )"))!;
    expect(within(filaCuenca).getByText("reservas3@cuencadelplata.com")).toBeInTheDocument();
    expect(within(filaCuenca).getByText("5")).toBeInTheDocument();
    expect(within(filaCuenca).getByText("Mail")).toBeInTheDocument();
  });

  it("#8 filtro 'Proveedores sin mail' se activa y se desactiva", async () => {
    consultas.cargarDirectorio.mockResolvedValue(directorio);
    render(<DirectorioPantalla />);
    await screen.findByRole("table");
    const filtro = screen.getByRole("button", { name: /Proveedores sin mail/ });

    fireEvent.click(filtro);
    expect(filtro).toHaveAttribute("aria-pressed", "true");
    let filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringContaining("Aji Verde"),
      expect.stringContaining("Antarctica Hostel"),
    ]);

    fireEvent.click(filtro);
    filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(3);
  });

  it("#11 directorio vacío: texto exacto + 'Agregar proveedor', sin tabla", async () => {
    consultas.cargarDirectorio.mockResolvedValue([]);
    render(<DirectorioPantalla />);
    expect(
      await screen.findByText("No hay proveedores cargados. Se necesitan para poder mandarles los pedidos."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar proveedor" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("#12 falla: mensaje de error y Reintentar repite", async () => {
    consultas.cargarDirectorio.mockRejectedValueOnce(new Error("red")).mockResolvedValueOnce(directorio);
    render(<DirectorioPantalla />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar el directorio.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("table");
    expect(consultas.cargarDirectorio).toHaveBeenCalledTimes(2);
  });

  it("mientras carga: esqueleto de tabla", () => {
    consultas.cargarDirectorio.mockImplementation(nunca);
    render(<DirectorioPantalla />);
    expect(screen.getByRole("status", { name: "Cargando el directorio" })).toBeInTheDocument();
  });
});

describe("Detalle de proveedor (#9)", () => {
  it("solo lectura: datos, aviso de dónde completar el mail y productos donde aparece", async () => {
    consultas.cargarProveedor.mockResolvedValue(antarctica);
    render(<DetalleProveedorPantalla id="prov-antarctica" />);
    await screen.findByRole("heading", { name: "Antarctica Hostel" });
    expect(screen.getByText(/no tiene mail cargado\. Se completa en el Excel de proveedores/)).toBeInTheDocument();
    expect(screen.getByText("USHUAIA")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OD022" })).toHaveAttribute("href", "/catalogo/prod-od022");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Guardar/ })).toBeNull();
  });

  it("error: 'No pudimos abrir este proveedor' con Volver al directorio", async () => {
    consultas.cargarProveedor.mockRejectedValue(new Error("red"));
    render(<DetalleProveedorPantalla id="prov-x" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos abrir este proveedor.");
    expect(screen.getByRole("link", { name: "Volver al directorio" })).toHaveAttribute("href", "/proveedores");
  });
});

describe("Pendientes (#18)", () => {
  it("lista lo que falta con el producto, el Excel y la fila", async () => {
    consultas.cargarPendientes.mockResolvedValue(pendientes);
    render(<PendientesPantalla />);
    const tabla = await screen.findByRole("table");
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(2);
    expect(within(filas[0]).getByRole("link", { name: "OD019" })).toHaveAttribute("href", "/catalogo/prod-od019");
    expect(within(filas[0]).getByText("NH Cordillera")).toBeInTheDocument();
    expect(within(filas[0]).getByText("Falta el mail: el owner lo está averiguando")).toBeInTheDocument();
    expect(within(filas[0]).getByText("Excel de proveedores")).toBeInTheDocument();
    expect(within(filas[0]).getByText("Excel de paquetes, fila 83")).toBeInTheDocument();
    expect(within(filas[1]).getByRole("link", { name: "Antarctica Hostel" })).toHaveAttribute(
      "href",
      "/proveedores/prov-antarctica",
    );
  });

  it("sin pendientes lo dice; si falla, error con Reintentar", async () => {
    consultas.cargarPendientes.mockResolvedValueOnce([]);
    const { unmount } = render(<PendientesPantalla />);
    expect(await screen.findByText("No hay pendientes. Todos los servicios tienen a quién pedírselos.")).toBeInTheDocument();
    unmount();

    consultas.cargarPendientes.mockRejectedValueOnce(new Error("red"));
    render(<PendientesPantalla />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los pendientes.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled());
  });
});
