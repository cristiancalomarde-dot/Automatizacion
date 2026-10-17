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
  tourConTourAdentroDesplegado,
  ch10,
  arch33,
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

  it("spec M2-08 #11: chip 'Journaway', sin sus nombres largos debajo del código; 'journaway' en el buscador deja solo esos", async () => {
    const spae05 = {
      ...catalogo[2],
      id: "prod-spae05",
      codigo: "SPAE05",
      nombre: "Salt Flats Route Tour (Trip F)",
      destino: "SPA",
      cantidadPendientes: 0,
      codigosExternos: [
        { agencia: "Journaway", codigo: "SPAE05", nombreExterno: null },
        { agencia: "Journaway", codigo: "salt flats route tour", nombreExterno: "Salt Flats Route Tour" },
      ],
    };
    consultas.cargarCatalogo.mockResolvedValue([...catalogo, spae05]);
    render(<CatalogoPantalla />);
    const tabla = await screen.findByRole("table");
    const fila = within(tabla).getAllByRole("row").find((f) => within(f).queryByText("SPAE05"))!;
    expect(within(fila).getByText("Journaway")).toBeInTheDocument();
    expect(within(fila).queryByText(/salt flats route tour$/i)).toBeNull();
    expect(within(fila).queryByText(/Journaway SPAE05/)).toBeNull();
    const od010aFila = within(tabla).getAllByRole("row").find((f) => within(f).queryByText("OD010A"))!;
    expect(within(od010aFila).getByText(/TourRadar 160955/)).toBeInTheDocument();
    expect(within(od010aFila).queryByText("Journaway")).toBeNull();

    fireEvent.change(screen.getByLabelText("Buscar por código o nombre"), { target: { value: "journaway" } });
    const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(1);
    expect(within(filas[0]).getByText("SPAE05")).toBeInTheDocument();
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

describe("Noches por servicio y tours dentro de tours (spec M1-07 #9, #10)", () => {
  it("CH10 solo se ve día por día en tres partes, sin bus ni traslado de salida", async () => {
    consultas.cargarProducto.mockResolvedValue(ch10);
    render(<DetalleProductoPantalla id="prod-ch10" />);
    const tabla = await screen.findByRole("table", { name: "Día por día" });
    expect(within(tabla).getByText("Día 1 · 1 noche en Puerto Natales")).toBeInTheDocument();
    expect(within(tabla).getByText("Día 2 · W Trek Standard, 4 noches en refugios (Las Torres)")).toBeInTheDocument();
    expect(within(tabla).getByText("Día 6 · 1 noche en Puerto Natales")).toBeInTheDocument();
    const texto = tabla.textContent ?? "";
    expect(texto.indexOf("Día 1 ·")).toBeLessThan(texto.indexOf("Día 2 ·"));
    expect(texto.indexOf("Día 2 ·")).toBeLessThan(texto.indexOf("Día 6 ·"));
    // Las dos noches de Puerto Natales se piden con las mismas opciones de hotel.
    expect(within(tabla).getAllByRole("row").filter((f) => f.textContent?.includes("Big Sur"))).toHaveLength(2);
    expect(screen.queryByText(/Punta Arenas|Kupos/)).toBeNull();
    expect(screen.queryByRole("table", { name: "Alojamiento por nivel" })).toBeNull();
  });

  it("dentro de ARCH33, las tres partes de CH10 van con los días del tour (6, 7 y 11) y al final la salida de Puerto Natales", async () => {
    consultas.cargarProducto.mockResolvedValue(arch33);
    render(<DetalleProductoPantalla id="prod-arch33" />);
    const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" });
    const filas = within(itinerario).getAllByRole("row");
    const fila = (texto: string) => filas.find((f) => f.textContent?.includes(texto));
    expect(fila("1 noche en Puerto Natales")?.textContent).toContain("Día 6");
    expect(fila("W Trek Standard, 4 noches en refugios (Las Torres)")?.textContent).toContain("Día 7");
    expect(filas.filter((f) => f.textContent?.includes("1 noche en Puerto Natales")).map((f) => (f as HTMLTableRowElement).cells[0].textContent)).toEqual(["Día 6", "Día 11"]);
    const ultima = filas[filas.length - 1].textContent ?? "";
    expect(ultima).toContain("Día 12");
    expect(ultima).toContain("Patagonia Planet");
    expect(ultima).toContain("Kupos.cl");
  });

  it("un paquete sin noches por servicio se ve como antes", async () => {
    consultas.cargarProducto.mockResolvedValue(od010a);
    render(<DetalleProductoPantalla id="prod-od010a" />);
    await screen.findByRole("table", { name: "Alojamiento por nivel" });
    expect(screen.queryByRole("table", { name: "Día por día" })).toBeNull();
  });

  it("el tour de adentro se despliega con los días del tour de afuera, y el link se mantiene", async () => {
    consultas.cargarProducto.mockResolvedValue(tourConTourAdentroDesplegado);
    render(<DetalleProductoPantalla id="prod-5c01" />);
    const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" });
    expect(within(itinerario).getByRole("link", { name: "CHB31" })).toHaveAttribute("href", "/catalogo/prod-chb31");
    const filas = within(itinerario).getAllByRole("row");
    const diaDe = (texto: string) => (filas.find((f) => f.textContent?.includes(texto)) as HTMLTableRowElement | undefined)?.cells[0].textContent;
    expect(diaDe("OD030")).toBe("Día 22");
    expect(diaDe("COMPBO20")).toBe("Día 25");
    expect(diaDe("Imperio Inca")).toBe("Día 27");
    expect(within(itinerario).queryByText("Es un tour. Ver su itinerario completo.")).toBeNull();
  });
});

describe("Traslados según el tour y servicios a pedido (spec M1-08 #5, #6, #9)", () => {
  const greeters = { id: "prov-greeters", nombre: "GREETERS", mails: ["r@greeters.com"], canal: "mail" as const, telefono: null };
  const imperio = { id: "prov-imperio", nombre: "Imperio Inca", mails: ["r@imperio.com"], canal: "mail" as const, telefono: null };
  function paquete(id: string, codigo: string, dia: number, servicios: ReturnType<typeof unServicio>[]) {
    return {
      orden: dia,
      tipo: "paquete" as const,
      diaDesde: dia,
      noches: 2,
      nocturno: null,
      transferIn: false,
      transferOut: false,
      descripcionRuta: null,
      producto: { id, codigo, nombre: `Paquete ${codigo}`, ciudades: [], destino: null, updatedAt: "2026-10-10T10:00:00Z", esTour: false, servicios },
    };
  }
  const tour = {
    ...chb31,
    id: "prod-5c01",
    codigo: "5C01",
    servicios: [],
    componentes: [
      paquete("prod-od020", "OD020", 11, [
        unServicio({
          productoId: "prod-od020",
          tipo: "traslado",
          orden: 6,
          descripcion: "Transfer EZE o AEP - Hotel - EZE o AEP. Booking Supplier: Greeters",
          bookingSupplierNombre: "Greeters",
          bookingSupplier: greeters,
          sentido: "ida_y_vuelta",
          ajusteTour: { accion: "anular", texto: null, motivo: "Llega en bus desde Iguazú y sale en bus a Mendoza.", origen: "regla" },
        }),
      ]),
      paquete("prod-od018", "OD018", 13, [
        unServicio({
          productoId: "prod-od018",
          tipo: "traslado",
          orden: 6,
          descripcion: "Transfer EZE o AEP - Hotel - EZE o AEP. Booking Supplier: Greeters",
          bookingSupplierNombre: "Greeters",
          bookingSupplier: greeters,
          ajusteTour: { accion: "solo_llegada", texto: null, motivo: "Sale en bus a Puerto Madryn.", origen: "regla" },
        }),
      ]),
      paquete("prod-od031", "OD031", 28, [
        unServicio({
          productoId: "prod-od031",
          tipo: "traslado",
          orden: 3,
          descripcion: "Transfer La Paz Airport - La Paz Accommodation: Booking Supplier: Imperio Inca",
          bookingSupplierNombre: "Imperio Inca",
          bookingSupplier: imperio,
          ajusteTour: { accion: "reemplazar", texto: "Transfer terminal de buses de La Paz - alojamiento en La Paz", motivo: "Llega en bus desde Uyuni: el traslado es desde la terminal de buses.", origen: "excepcion" },
        }),
      ]),
      paquete("prod-od030", "OD030", 30, [
        unServicio({
          productoId: "prod-od030",
          tipo: "traslado",
          orden: 3,
          descripcion: "Transfer in CJC - Accommodation in San Pedro de Atacama. Booking Supplier: Transvipp",
          reservaManual: true,
          bookingSupplierNombre: "Transvipp",
          ajusteTour: { accion: "invertir", texto: "Transfer alojamiento en San Pedro de Atacama - aeropuerto de Calama (CJC)", motivo: "En este tour el traslado es de salida, de San Pedro al aeropuerto de Calama.", origen: "excepcion" },
        }),
      ]),
    ],
  };

  function filaCon(tabla: HTMLElement, texto: string) {
    return within(tabla).getAllByRole("row").find((f) => f.textContent?.includes(texto)) as HTMLTableRowElement;
  }

  it("dentro del tour: el anulado aparece tachado con el motivo, el reemplazado con su texto nuevo y el de un solo lado con su marca", async () => {
    consultas.cargarProducto.mockResolvedValue(tour);
    render(<DetalleProductoPantalla id="prod-5c01" />);
    const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" });

    const od020 = filaCon(itinerario, "EZE o AEP - Hotel - EZE o AEP");
    expect(od020.textContent).toContain("No se pide en este tour");
    expect(od020.textContent).toContain("Llega en bus desde Iguazú y sale en bus a Mendoza.");
    expect(within(od020).getByText("Transfer EZE o AEP - Hotel - EZE o AEP").tagName).toBe("S");

    const od018 = within(itinerario).getAllByRole("row").filter((f) => f.textContent?.includes("EZE o AEP"))[1];
    expect(od018.textContent).toContain("Solo llegada");
    expect(od018.textContent).toContain("Sale en bus a Puerto Madryn.");

    const od031 = filaCon(itinerario, "terminal de buses de La Paz");
    expect(od031.textContent).toContain("Cambiado en este tour");
    expect(od031.textContent).toContain("En el Excel: Transfer La Paz Airport - La Paz Accommodation");

    const od030 = filaCon(itinerario, "aeropuerto de Calama (CJC)");
    expect(od030.textContent).toContain("Sentido invertido");
  });

  it("el paquete abierto solo sigue mostrando todos sus servicios, con la marca a pedido o según la reserva", async () => {
    consultas.cargarProducto.mockResolvedValue({
      ...od010a,
      codigo: "OD016",
      servicios: [
        unServicio({
          tipo: "traslado",
          orden: 5,
          descripcion: "Transfer El Calafate Accommodation - FTE Airport. Booking Supplier: Chalten Travel",
          bookingSupplier: greeters,
          aPedido: "a_pedido",
          aPedidoNota: "el traslado de salida es opcional",
        }),
        unServicio({
          tipo: "traslado",
          orden: 4,
          descripcion: "Transfers: Remis Mendoza. Booking Booking Supplier: Remis Mendoza",
          bookingSupplier: greeters,
          aPedido: "segun_reserva",
          aPedidoNota: "solo si el paquete es CON traslados",
        }),
      ],
    });
    render(<DetalleProductoPantalla id="prod-od016" />);
    const tabla = await screen.findByRole("table", { name: "Servicios" });
    const salida = filaCon(tabla, "El Calafate Accommodation - FTE Airport");
    expect(salida.textContent).toContain("A pedido");
    expect(salida.textContent).toContain("el traslado de salida es opcional");
    expect(filaCon(tabla, "Remis Mendoza").textContent).toContain("Según la reserva");
    expect(screen.queryByText("No se pide en este tour")).toBeNull();
  });

  it("OD010D solo, día por día: noches 1-2 en Foz y la 3 en Puerto Iguazú", async () => {
    const foz = { nocheDesde: 1, noches: 2, lugar: "Foz do Iguaçu (lado brasileño)" };
    const arg = { nocheDesde: 3, noches: 1, lugar: "Puerto Iguazú (lado argentino)" };
    consultas.cargarProducto.mockResolvedValue({
      ...od010a,
      codigo: "OD010D",
      servicios: [
        unServicio({ orden: 3, nivel: "Hotel 3*", serviceProviderNombre: "Nacional inn Foz", tramosNoches: [foz] }),
        unServicio({ orden: 4, nivel: "Hotel 3*", serviceProviderNombre: "El Pueblito", tramosNoches: [arg] }),
        unServicio({ orden: 7, tipo: "excursion", descripcion: "Excursion: Paquete Receptvo 105 Premium x Foz. Booking Supplier: Cuenca del Plata" }),
      ],
    });
    render(<DetalleProductoPantalla id="prod-od010d" />);
    const tabla = await screen.findByRole("table", { name: "Día por día" });
    expect(within(tabla).getByText("Día 1 · 2 noches en Foz do Iguaçu (lado brasileño)")).toBeInTheDocument();
    expect(within(tabla).getByText("Día 3 · 1 noche en Puerto Iguazú (lado argentino)")).toBeInTheDocument();
    expect(filaCon(tabla, "El Pueblito")).toBeDefined();
  });
});
