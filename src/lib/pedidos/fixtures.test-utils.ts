/**
 * Datos de prueba de los pedidos (M3-01), con la forma del catálogo y las
 * reservas reales pero con pasajeros inventados (#1). Solo tests.
 */
import type { ComponenteTour, DetalleProducto, ProveedorResumen, Servicio } from "@/lib/catalogo/tipos";
import type { CatalogoParaPedidos, ParteParaPedidos, ReservaParaPedidos } from "./tipos";

export function proveedor(id: string, nombre: string, mails: string[], canal: ProveedorResumen["canal"] = "mail", telefono: string | null = null): ProveedorResumen {
  return { id, nombre, mails, canal, telefono };
}

export const P = {
  cuenca: proveedor("prov-cuenca", "Paquete 105 Premium desde Foz IGRP01", ["Reservas8@CuencaDelPlata.com "]),
  cuencaArg: proveedor("prov-cuenca-arg", "Excursion Lado Argentino Premium IGRE01", ["reservas8@cuencadelplata.com"]),
  cuencaBra: proveedor("prov-cuenca-bra", "Excursion Lado Brasilero Premium IGRE02", ["reservas8@cuencadelplata.com"]),
  pueblito: proveedor("prov-pueblito", "Cuenca del Plata (El Pueblito)", ["reservas8@cuencadelplata.com"]),
  dannInn: proveedor("prov-dann", "Nacional Inn Foz", ["reservas@nacionalinn.test", "rio@nacionalinn.test"]),
  backpackers: proveedor("prov-backpackers", "Backpacker San Pedro Hostel", [], "whatsapp", "+56 9 1111 2222"),
  ajiVerde: proveedor("prov-aji", "Aji Verde", [], "whatsapp"),
  donRaul: proveedor("prov-donraul", "Hotel Don Raul", ["reservas@donraul.test"]),
  horizonte: proveedor("prov-horizonte", "Horizonte Atacama", ["reservas@horizonte.test"]),
  imperio: proveedor("prov-imperio", "Imperio Inca", ["reservas@imperioinca.test"]),
  chalten: proveedor("prov-chalten", "Chalten Travel", ["agencias@chaltentravel.test"]),
  sinMail: proveedor("prov-sinmail", "Hostel Sin Mail", [], "mail"),
  habitas: proveedor("prov-habitas", "Our Habitas Atacama", ["reservas@habitas.test"]),
};

let n = 0;
export function servicio(parcial: Partial<Servicio> & Pick<Servicio, "tipo" | "productoId">): Servicio {
  n += 1;
  return {
    id: `svc-${n}`,
    nivel: null,
    orden: n,
    prioridad: 1,
    descripcion: null,
    opcional: false,
    reservaManual: false,
    sinResolver: false,
    paraRevisar: false,
    nota: null,
    filaExcel: null,
    serviceProviderNombre: null,
    bookingSupplierNombre: null,
    serviceProvider: null,
    bookingSupplier: null,
    ...parcial,
  };
}

export function producto(id: string, codigo: string, servicios: Servicio[], extra: Partial<DetalleProducto> = {}): DetalleProducto {
  return {
    id,
    codigo,
    nombre: codigo,
    ciudades: [],
    destino: null,
    updatedAt: "2026-10-19T00:00:00Z",
    esTour: false,
    codigosExternos: [],
    servicios,
    componentes: [],
    ...extra,
  };
}

export function componente(id: string, orden: number, diaDesde: number, noches: number, prod: DetalleProducto): ComponenteTour {
  return {
    id,
    orden,
    tipo: "paquete",
    diaDesde,
    noches,
    nocturno: null,
    transferIn: false,
    transferOut: false,
    descripcionRuta: null,
    producto: { ...prod, esTour: false, servicios: prod.servicios },
  };
}

export function parte(parcial: Partial<ParteParaPedidos> & Pick<ParteParaPedidos, "id" | "orden" | "tipo">): ParteParaPedidos {
  return {
    productoId: null,
    productoComponenteId: null,
    descripcionRuta: null,
    textoAgencia: null,
    fechaInicio: null,
    fechaFin: null,
    esTarea: false,
    productoServicioId: null,
    proveedorId: null,
    pickUp: null,
    ...parcial,
  };
}

export function reserva(parcial: Partial<ReservaParaPedidos> = {}): ReservaParaPedidos {
  return {
    id: "res-1",
    estado: "recibida",
    agencia: "Kilroy",
    numero: null,
    productoId: null,
    otrosProductos: [],
    fechaInicio: null,
    fechaFin: null,
    pax: 2,
    pasajeros: [
      { nombre: "Ana", apellido: "Gómez", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" },
      { nombre: "Luis", apellido: "Pérez", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
    ],
    vuelos: [],
    habitacion: "Double Room - Hostel",
    pedidosEspeciales: null,
    hotelesAgencia: [],
    sinTrasladoDe: null,
    partes: [],
    ...parcial,
  };
}

export function catalogoCon(detalles: DetalleProducto[], proveedores: ProveedorResumen[] = [], dias: CatalogoParaPedidos["dias"] = []): CatalogoParaPedidos {
  return {
    detalles: new Map(detalles.map((d) => [d.id, d])),
    proveedores: new Map(proveedores.map((p) => [p.id, p])),
    dias,
  };
}

// --- OD010B: hotel El Pueblito + Paquete 105 x Foz, los dos a Cuenca del Plata ----------------

export const od010b = producto(
  "prod-od010b",
  "OD010B",
  [
    servicio({
      productoId: "prod-od010b",
      tipo: "alojamiento",
      nivel: "Hostel",
      orden: 1,
      prioridad: 1,
      descripcion: "Accommodation: El Pueblito Iguazu / Tetris. Booking Supplier: Cuenca del Plata / Tetris",
      serviceProviderNombre: "El Pueblito Iguazu",
      bookingSupplier: P.pueblito,
    }),
    servicio({
      productoId: "prod-od010b",
      tipo: "alojamiento",
      nivel: "Hostel",
      orden: 1,
      prioridad: 2,
      serviceProviderNombre: "Tetris",
      bookingSupplier: P.ajiVerde,
    }),
    servicio({
      productoId: "prod-od010b",
      tipo: "alojamiento",
      nivel: "Budget Hotel",
      orden: 2,
      serviceProviderNombre: "Dann Inn Foz",
      bookingSupplier: P.dannInn,
    }),
    servicio({
      productoId: "prod-od010b",
      tipo: "excursion",
      orden: 5,
      descripcion:
        "Excursion: Paquete Receptvo 105 Premium x Foz. Booking Supplier: Cuenca del Plata\nIncludes: Transfer in + Out, Excursion Cataratas Argentinas, Excursion Cataratas Brasileras",
      serviceProviderNombre: "Paquete Receptvo 105 Premium x Foz",
      bookingSupplier: P.cuenca,
    }),
  ],
  { destino: "IGR" },
);

export const reservaOd010b = reserva({
  productoId: od010b.id,
  fechaInicio: "2026-10-03",
  fechaFin: "2026-10-06",
  numero: "DK1234567/abcd",
});

// --- CHB31: OD030 (San Pedro Explorer) + COMPBO20 (Overland) + bus Uyuni – La Paz ------------

export const od030 = producto("prod-od030", "OD030", [
  servicio({ productoId: "prod-od030", tipo: "alojamiento", nivel: "Hostel", orden: 1, prioridad: 1, serviceProviderNombre: "San Pedro Backpackers", bookingSupplier: P.backpackers }),
  servicio({ productoId: "prod-od030", tipo: "alojamiento", nivel: "Hostel", orden: 1, prioridad: 2, serviceProviderNombre: "Aji Verde", bookingSupplier: P.ajiVerde }),
  servicio({ productoId: "prod-od030", tipo: "alojamiento", nivel: "Hotel 3*", orden: 2, serviceProviderNombre: "Hotel Don Raul", bookingSupplier: P.donRaul }),
  servicio({
    productoId: "prod-od030",
    tipo: "traslado",
    orden: 3,
    sentido: "llegada",
    reservaManual: true,
    descripcion: "Transfer in CJC - Accommodation in San Pedro de Atacama. Booking Supplier: Transvipp",
    bookingSupplierNombre: "Transvipp",
  }),
  servicio({
    productoId: "prod-od030",
    tipo: "excursion",
    orden: 4,
    descripcion: "Excursion: Geisers del Tatio. Booking Supplier: Horizonte Atacama",
    serviceProviderNombre: "Geisers del Tatio",
    bookingSupplier: P.horizonte,
  }),
], { destino: "SPA" });

export const compbo20 = producto("prod-compbo20", "COMPBO20", [
  servicio({
    productoId: "prod-compbo20",
    tipo: "otro",
    orden: 1,
    descripcion: "Overland San Pedro de Atacama to Uyuni. Booking Supplier: Imperio Inca",
    bookingSupplier: P.imperio,
  }),
], { destino: "UYU" });

export const busUyuniLaPaz = servicio({
  productoId: "prod-chb31",
  tipo: "bus",
  orden: 1,
  descripcion: "Bus Uyuni – La Paz (nocturno, sale el día 6 del tour). Booking Supplier: Imperio Inca",
  bookingSupplier: P.imperio,
});

export const chb31 = producto("prod-chb31", "CHB31", [busUyuniLaPaz], {
  esTour: true,
  componentes: [componente("comp-od030", 1, 1, 3, od030), componente("comp-compbo20", 2, 4, 2, compbo20)],
});

export const reservaChb31 = reserva({
  productoId: chb31.id,
  fechaInicio: "2027-01-18",
  fechaFin: "2027-01-24",
  partes: [
    parte({ id: "p1", orden: 1, tipo: "paquete", productoId: od030.id, productoComponenteId: "comp-od030", fechaInicio: "2027-01-18", fechaFin: "2027-01-21" }),
    parte({ id: "p2", orden: 2, tipo: "paquete", productoId: compbo20.id, productoComponenteId: "comp-compbo20", fechaInicio: "2027-01-21", fechaFin: "2027-01-23" }),
    parte({
      id: "p3",
      orden: 3,
      tipo: "servicio",
      descripcionRuta: "Bus Uyuni – La Paz",
      fechaInicio: "2027-01-23",
      fechaFin: "2027-01-24",
      productoServicioId: busUyuniLaPaz.id,
      proveedorId: P.imperio.id,
    }),
  ],
});

export const catalogoChb31 = catalogoCon([chb31, od030, compbo20], [P.imperio], [{ codigo: "OD030", orden: 4, dia: 3 }]);
