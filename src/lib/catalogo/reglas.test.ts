import { describe, expect, it } from "vitest";
import {
  agruparAlojamientoPorNivel,
  agruparPorOrden,
  diaDeServicioDelTour,
  duracionTour,
  estadoServicio,
  esPendiente,
  filtrarCatalogo,
  filtrarDirectorio,
  normalizarTexto,
  queEs,
  proveedoresDeServicios,
  tieneMail,
} from "./reglas";
import type { FilaCatalogo, FilaDirectorio, ProveedorResumen, Servicio } from "./tipos";

const conMail: ProveedorResumen = {
  id: "p-cuenca",
  nombre: "Cuenca del Plata",
  mails: ["reservas3@cuencadelplata.com"],
  canal: "mail",
  telefono: null,
};
const porWhatsapp: ProveedorResumen = {
  id: "p-aji",
  nombre: "Aji Verde",
  mails: [],
  canal: "whatsapp",
  telefono: null,
};
const sinContacto: ProveedorResumen = {
  id: "p-antarctica",
  nombre: "Antarctica Hostel",
  mails: [],
  canal: null,
  telefono: null,
};

function servicio(parcial: Partial<Servicio>): Servicio {
  return {
    id: Math.random().toString(36).slice(2),
    productoId: "prod",
    tipo: "alojamiento",
    nivel: null,
    orden: 1,
    prioridad: 1,
    descripcion: null,
    opcional: false,
    reservaManual: false,
    sinResolver: false,
    paraRevisar: false,
    nota: null,
    filaExcel: 10,
    serviceProviderNombre: null,
    bookingSupplierNombre: null,
    serviceProvider: null,
    bookingSupplier: null,
    ...parcial,
  };
}

describe("estadoServicio (spec M1-06 #15)", () => {
  it("con mail cuando el Booking Supplier tiene mail", () => {
    expect(estadoServicio(servicio({ bookingSupplier: conMail })).tipo).toBe("con_mail");
  });

  it("por WhatsApp cuando el Booking Supplier se contacta por WhatsApp", () => {
    expect(estadoServicio(servicio({ bookingSupplier: porWhatsapp })).tipo).toBe("whatsapp");
  });

  it("manual cuando se reserva en un sistema propio (Transvip), con el nombre del sistema", () => {
    const estado = estadoServicio(
      servicio({ reservaManual: true, bookingSupplierNombre: "Transvipp" }),
    );
    expect(estado).toEqual({ tipo: "manual", motivo: "Se reserva a mano en Transvipp." });
  });

  it("sin resolver con la nota del importador como motivo", () => {
    const estado = estadoServicio(
      servicio({
        sinResolver: true,
        paraRevisar: true,
        nota: "Falta el mail: el owner lo está averiguando",
        bookingSupplierNombre: "NH Cordillera",
      }),
    );
    expect(estado).toEqual({
      tipo: "sin_resolver",
      motivo: "Falta el mail: el owner lo está averiguando",
    });
  });

  it("sin resolver cuando el proveedor del Excel no está en el directorio", () => {
    const estado = estadoServicio(
      servicio({ sinResolver: true, bookingSupplierNombre: "O Hostel GRU" }),
    );
    expect(estado.tipo).toBe("sin_resolver");
    expect(estado.motivo).toContain("«O Hostel GRU» no está en el directorio");
    expect(estado.motivo).toContain("Excel de proveedores");
  });

  it("sin resolver cuando el proveedor existe pero no tiene mail ni WhatsApp", () => {
    const estado = estadoServicio(servicio({ bookingSupplier: sinContacto }));
    expect(estado.tipo).toBe("sin_resolver");
    expect(estado.motivo).toContain("«Antarctica Hostel» no tiene mail ni WhatsApp");
  });

  it("esPendiente: solo los sin resolver", () => {
    expect(esPendiente(servicio({ bookingSupplier: sinContacto }))).toBe(true);
    expect(esPendiente(servicio({ bookingSupplier: conMail }))).toBe(false);
    expect(esPendiente(servicio({ reservaManual: true, bookingSupplierNombre: "Kupos.cl" }))).toBe(
      false,
    );
  });
});

describe("agruparAlojamientoPorNivel (spec M1-06 #14)", () => {
  it("muestra los 4 niveles, los vacantes como no ofrecidos, y las opciones por prioridad", () => {
    const servicios = [
      servicio({ nivel: "Hotel 4*", orden: 3, serviceProviderNombre: "La Aldea" }),
      servicio({ nivel: "Hotel 3*", orden: 2, prioridad: 2, serviceProviderNombre: "Botánica" }),
      servicio({ nivel: "Hostel", orden: 1, serviceProviderNombre: "Beer" }),
      servicio({ nivel: "Hotel 3*", orden: 2, prioridad: 1, serviceProviderNombre: "El Pueblito" }),
      servicio({ tipo: "excursion", orden: 4, serviceProviderNombre: "Receptivo" }),
    ];

    const niveles = agruparAlojamientoPorNivel(servicios);

    expect(niveles.map((n) => [n.nivel, n.ofrecido])).toEqual([
      ["Hostel", true],
      ["Budget Hotel", false],
      ["Hotel 3*", true],
      ["Hotel 4*", true],
    ]);
    const tres = niveles.find((n) => n.nivel === "Hotel 3*")!;
    expect(tres.servicios.map((s) => s.serviceProviderNombre)).toEqual(["El Pueblito", "Botánica"]);
  });

  it("niveles propios (Glamping) sin inventar los 4 estándar si el producto no los usa", () => {
    const niveles = agruparAlojamientoPorNivel([
      servicio({ nivel: "Glamping c/MAP", orden: 2 }),
      servicio({ nivel: "Glamping c/desayuno", orden: 1 }),
    ]);
    expect(niveles.map((n) => n.nivel)).toEqual(["Glamping c/desayuno", "Glamping c/MAP"]);
  });

  it("un alojamiento sin nivel va a un grupo propio al final", () => {
    const niveles = agruparAlojamientoPorNivel([
      servicio({ nivel: null, orden: 5 }),
      servicio({ nivel: "Hostel", orden: 1 }),
    ]);
    expect(niveles.at(-1)?.nivel).toBeNull();
  });
});

describe("agruparPorOrden", () => {
  it("junta las alternativas de un mismo servicio, ordenadas por prioridad", () => {
    const grupos = agruparPorOrden([
      servicio({ tipo: "excursion", orden: 4, prioridad: 2, serviceProviderNombre: "B" }),
      servicio({ tipo: "traslado", orden: 3 }),
      servicio({ tipo: "excursion", orden: 4, prioridad: 1, serviceProviderNombre: "A" }),
    ]);
    expect(grupos.map((g) => g.map((s) => s.orden))).toEqual([[3], [4, 4]]);
    expect(grupos[1].map((s) => s.serviceProviderNombre)).toEqual(["A", "B"]);
  });
});

describe("proveedoresDeServicios (spec M1-06 #1)", () => {
  it("cuenta cada proveedor una sola vez aunque aparezca en varios servicios", () => {
    const ids = proveedoresDeServicios([
      servicio({ bookingSupplier: conMail, serviceProvider: conMail }),
      servicio({ bookingSupplier: conMail }),
    ]);
    expect(ids.size).toBe(1);
  });
});

describe("tours", () => {
  it("diaDeServicioDelTour lee el día de la descripción del bus con proveedor", () => {
    expect(
      diaDeServicioDelTour(
        "Bus Uyuni – La Paz (nocturno, sale el día 6 del tour). Booking Supplier: Imperio Inca",
      ),
    ).toBe(6);
    expect(diaDeServicioDelTour("Bus sin día")).toBeNull();
  });

  it("duracionTour = último día de inicio + sus noches", () => {
    expect(
      duracionTour([
        { diaDesde: 1, noches: 3 },
        { diaDesde: 28, noches: 2 },
        { diaDesde: 21, noches: null },
      ]),
    ).toBe(30);
  });
});

describe("búsqueda y filtros (spec M1-06 #2, #8)", () => {
  const fila = (codigo: string, nombre: string, externos: string[] = []): FilaCatalogo => ({
    id: codigo,
    codigo,
    nombre,
    ciudades: [],
    destino: null,
    updatedAt: "2026-10-06T00:00:00Z",
    esTour: false,
    codigosExternos: externos.map((c) => ({ agencia: "TourRadar", codigo: c, nombreExterno: null })),
    cantidadProveedores: 0,
    cantidadPendientes: 0,
  });
  const filas = [
    fila("CHB31", "Overland San Pedro de Atacama to Uyuni, end in La Paz"),
    fila("OD030", "San Pedro de Atacama Explorer"),
    fila("OD010A", "Iguazu Falls on a Shoestring Argentina", ["160955"]),
  ];

  it("por código, sin distinguir mayúsculas", () => {
    expect(filtrarCatalogo(filas, "chb31").map((f) => f.codigo)).toEqual(["CHB31"]);
  });

  it("por parte del nombre", () => {
    expect(filtrarCatalogo(filas, "overland").map((f) => f.codigo)).toEqual(["CHB31"]);
  });

  it("por código de agencia", () => {
    expect(filtrarCatalogo(filas, "160955").map((f) => f.codigo)).toEqual(["OD010A"]);
  });

  it("búsqueda vacía devuelve todo", () => {
    expect(filtrarCatalogo(filas, "  ")).toHaveLength(3);
  });

  it("normalizarTexto ignora tildes", () => {
    expect(normalizarTexto("São Paulo Río")).toBe("sao paulo rio");
  });

  const prov = (nombre: string, mails: string[], ciudad: string | null = null): FilaDirectorio => ({
    id: nombre,
    nombre,
    mails,
    canal: mails.length ? "mail" : null,
    telefono: null,
    aclaraciones: null,
    ciudad,
    cantidadProductos: 0,
  });

  it("filtro sin mail deja solo los que no tienen mail", () => {
    const directorio = [prov("A", ["a@x.com"]), prov("B", []), prov("C", [], "USHUAIA")];
    expect(filtrarDirectorio(directorio, { soloSinMail: true, busqueda: "" }).map((p) => p.nombre)).toEqual([
      "B",
      "C",
    ]);
    expect(filtrarDirectorio(directorio, { soloSinMail: false, busqueda: "ushu" }).map((p) => p.nombre)).toEqual([
      "C",
    ]);
    expect(tieneMail(directorio[0])).toBe(true);
  });
});

describe("queEs: el nombre corto de un servicio", () => {
  it("alojamiento: el hotel", () => {
    expect(queEs(servicio({ serviceProviderNombre: "Hotel don raul", descripcion: "Accommodation: ..." }))).toBe(
      "Hotel don raul",
    );
  });
  it("otros: la descripción hasta el Booking Supplier, sin el prefijo de tipo", () => {
    expect(
      queEs(
        servicio({
          tipo: "excursion",
          descripcion: "Excursion: Geisers del Tatio. Booking Supplier: Horizonte Atacama",
        }),
      ),
    ).toBe("Geisers del Tatio");
    expect(
      queEs(
        servicio({
          tipo: "traslado",
          descripcion: "Transfer in CJC - Accommodation in San Pedro de Atacama. Booking Supplier: Transvipp",
        }),
      ),
    ).toBe("Transfer in CJC - Accommodation in San Pedro de Atacama");
    expect(
      queEs(
        servicio({
          tipo: "excursion",
          descripcion: "Excursion: Paquete 105. Booking Supplier: Cuenca\nIncludes: Transfer in + Out",
        }),
      ),
    ).toBe("Paquete 105");
  });
});
