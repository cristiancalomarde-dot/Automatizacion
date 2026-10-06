/**
 * Datos de prueba para los tests de las pantallas de M1-06, con la forma de
 * los datos reales (OD010A, OD030, CHB31, Antarctica Hostel…). Solo tests.
 */
import type {
  DetalleProducto,
  DetalleProveedor,
  FilaCatalogo,
  FilaDirectorio,
  Pendiente,
  ProveedorResumen,
  Servicio,
} from "./tipos";

export const cuenca: ProveedorResumen = {
  id: "prov-cuenca",
  nombre: "Cuenca Del Plata (Natalia )",
  mails: ["reservas3@cuencadelplata.com"],
  canal: "mail",
  telefono: null,
};
export const tangoinn: ProveedorResumen = {
  id: "prov-tangoinn",
  nombre: "Tangoinn Bed & Brewery IGR",
  mails: ["beerhotel@tangoinn.com", "beerhotel@cervezaholy.com"],
  canal: "mail",
  telefono: null,
};
export const ajiVerde: ProveedorResumen = {
  id: "prov-aji",
  nombre: "Aji Verde",
  mails: [],
  canal: "whatsapp",
  telefono: null,
};
export const imperioInca: ProveedorResumen = {
  id: "prov-imperio",
  nombre: "Imperio Inca",
  mails: [],
  canal: "whatsapp",
  telefono: null,
};

let contador = 0;
export function unServicio(parcial: Partial<Servicio>): Servicio {
  contador += 1;
  return {
    id: `svc-${contador}`,
    productoId: "prod-od010a",
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
    filaExcel: null,
    serviceProviderNombre: null,
    bookingSupplierNombre: null,
    serviceProvider: null,
    bookingSupplier: null,
    ...parcial,
  };
}

export const catalogo: FilaCatalogo[] = [
  {
    id: "prod-chb31",
    codigo: "CHB31",
    nombre: "Overland San Pedro de Atacama to Uyuni, end in La Paz",
    ciudades: ["San Pedro de Atacama", "Uyuni", "La Paz"],
    destino: null,
    updatedAt: "2026-10-06T10:27:05Z",
    esTour: true,
    codigosExternos: [{ agencia: "HI Travel", codigo: "CHB31", nombreExterno: null }],
    cantidadProveedores: 7,
    cantidadPendientes: 0,
  },
  {
    id: "prod-od010a",
    codigo: "OD010A",
    nombre: "Iguazu Falls on a Shoestring Argentina",
    ciudades: [],
    destino: "IGR",
    updatedAt: "2026-09-27T12:00:00Z",
    esTour: false,
    codigosExternos: [
      { agencia: "HI Travel", codigo: "OD010A", nombreExterno: null },
      { agencia: "TourRadar", codigo: "160955", nombreExterno: "Iguazu Falls on a Shoestring (3N)" },
    ],
    cantidadProveedores: 2,
    cantidadPendientes: 0,
  },
  {
    id: "prod-od022",
    codigo: "OD022",
    nombre: "Ushuaia, end of the World",
    ciudades: [],
    destino: "USH",
    updatedAt: "2026-10-05T12:00:00Z",
    esTour: false,
    codigosExternos: [],
    cantidadProveedores: 6,
    cantidadPendientes: 1,
  },
];

export const od010a: DetalleProducto = {
  id: "prod-od010a",
  codigo: "OD010A",
  nombre: "Iguazu Falls on a Shoestring Argentina",
  ciudades: [],
  destino: "IGR",
  updatedAt: "2026-09-27T12:00:00Z",
  esTour: false,
  codigosExternos: catalogo[1].codigosExternos,
  componentes: [],
  servicios: [
    unServicio({
      nivel: "Hostel",
      orden: 1,
      filaExcel: 5,
      serviceProviderNombre: "Beer Hostel",
      bookingSupplierNombre: "Beer Hostel",
      serviceProvider: tangoinn,
      bookingSupplier: tangoinn,
    }),
    unServicio({
      nivel: "Hotel 3*",
      orden: 2,
      prioridad: 1,
      filaExcel: 12,
      serviceProviderNombre: "Hotel 3* El Pueblito",
      bookingSupplierNombre: "Cuenca del Plata",
      bookingSupplier: cuenca,
    }),
    unServicio({
      nivel: "Hotel 3*",
      orden: 2,
      prioridad: 2,
      filaExcel: 12,
      serviceProviderNombre: "Botanica",
      bookingSupplierNombre: "Cuenca del Plata",
      bookingSupplier: cuenca,
    }),
    unServicio({
      nivel: "Hotel 4*",
      orden: 3,
      filaExcel: 15,
      serviceProviderNombre: "Hotel 4*: La Aldea de la Selva",
      bookingSupplierNombre: "Cuenca del Plata",
      bookingSupplier: cuenca,
    }),
    unServicio({
      tipo: "excursion",
      orden: 4,
      filaExcel: 20,
      descripcion:
        "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata\nIncludes: Transfer in + Out",
      serviceProviderNombre: "Paquete Receptvo 105 Premium",
      bookingSupplierNombre: "Cuenca del Plata",
      bookingSupplier: cuenca,
    }),
  ],
};

export const od030Servicios: Servicio[] = [
  unServicio({
    productoId: "prod-od030",
    nivel: "Hostel",
    orden: 1,
    filaExcel: 796,
    serviceProviderNombre: "Aji Verde",
    bookingSupplierNombre: "Avi Verde",
    serviceProvider: ajiVerde,
    bookingSupplier: ajiVerde,
  }),
  unServicio({
    productoId: "prod-od030",
    tipo: "traslado",
    orden: 3,
    filaExcel: 808,
    reservaManual: true,
    descripcion: "Transfer in CJC - Accommodation in San Pedro de Atacama. Booking Supplier: Transvipp",
    bookingSupplierNombre: "Transvipp",
  }),
  unServicio({
    productoId: "prod-od030",
    tipo: "excursion",
    orden: 4,
    filaExcel: 809,
    descripcion: "Excursion: Geisers del Tatio. Booking Supplier: Horizonte Atacama",
    bookingSupplierNombre: "Horizonte Atacama",
    bookingSupplier: {
      id: "prov-horizonte",
      nombre: "Horizonte atacama",
      mails: ["horizonteatacamareserva@gmail.com"],
      canal: "mail",
      telefono: null,
    },
  }),
];

export const chb31: DetalleProducto = {
  id: "prod-chb31",
  codigo: "CHB31",
  nombre: "Overland San Pedro de Atacama to Uyuni, end in La Paz",
  ciudades: ["San Pedro de Atacama", "Uyuni", "La Paz"],
  destino: null,
  updatedAt: "2026-10-06T10:27:05Z",
  esTour: true,
  codigosExternos: [{ agencia: "HI Travel", codigo: "CHB31", nombreExterno: null }],
  servicios: [
    unServicio({
      productoId: "prod-chb31",
      tipo: "bus",
      orden: 1,
      descripcion:
        "Bus Uyuni – La Paz (nocturno, sale el día 6 del tour). Booking Supplier: Imperio Inca",
      serviceProviderNombre: "Bus Uyuni – La Paz",
      bookingSupplierNombre: "Imperio Inca",
      bookingSupplier: imperioInca,
    }),
  ],
  componentes: [
    {
      orden: 1,
      tipo: "paquete",
      diaDesde: 1,
      noches: 3,
      nocturno: null,
      transferIn: true,
      transferOut: false,
      descripcionRuta: null,
      producto: {
        id: "prod-od030",
        codigo: "OD030",
        nombre: "San Pedro de Atacama Explorer",
        ciudades: [],
        destino: "SPA",
        updatedAt: "2026-10-05T12:00:00Z",
        esTour: false,
        servicios: od030Servicios,
      },
    },
    {
      orden: 2,
      tipo: "tramo_bus",
      diaDesde: 4,
      noches: null,
      nocturno: true,
      transferIn: false,
      transferOut: false,
      descripcionRuta: "San Pedro de Atacama – Uyuni",
      producto: null,
    },
  ],
};

export const tourConTourAdentro: DetalleProducto = {
  ...chb31,
  id: "prod-5c01",
  codigo: "5C01",
  nombre: "5 Countries: Rio de Janeiro to la Paz",
  servicios: [],
  componentes: [
    {
      orden: 14,
      tipo: "paquete",
      diaDesde: 22,
      noches: 6,
      nocturno: null,
      transferIn: false,
      transferOut: false,
      descripcionRuta: null,
      producto: {
        id: "prod-chb31",
        codigo: "CHB31",
        nombre: chb31.nombre,
        ciudades: chb31.ciudades,
        destino: null,
        updatedAt: chb31.updatedAt,
        esTour: true,
        servicios: [],
      },
    },
  ],
};

export const directorio: FilaDirectorio[] = [
  {
    id: "prov-antarctica",
    nombre: "Antarctica Hostel",
    mails: [],
    canal: null,
    telefono: null,
    aclaraciones: "Categoría: Hostel\nAclaraciones: WSP: +54 9 2901 58-4652",
    ciudad: "USHUAIA",
    cantidadProductos: 1,
  },
  { ...cuenca, aclaraciones: null, ciudad: "IGUAZU", cantidadProductos: 5 },
  { ...ajiVerde, aclaraciones: null, ciudad: "SAN PEDRO", cantidadProductos: 1 },
];

export const antarctica: DetalleProveedor = {
  ...directorio[0],
  productos: [{ id: "prod-od022", codigo: "OD022", nombre: "Ushuaia, end of the World", rol: "booking_supplier" }],
};

export const pendientes: Pendiente[] = [
  {
    servicioId: "svc-nh",
    producto: { id: "prod-od019", codigo: "OD019", nombre: "Mendoza Mountains and Wineries" },
    servicio: "Accommodation: 4* NH Cordillera / Hotel MOD. Booking Supplier: NH Cordillera / Hotel MOD",
    proveedorNombre: "NH Cordillera",
    proveedorId: null,
    motivo: "Falta el mail: el owner lo está averiguando",
    filaExcel: 83,
  },
  {
    servicioId: "svc-antarctica",
    producto: { id: "prod-od022", codigo: "OD022", nombre: "Ushuaia, end of the World" },
    servicio: "Accommodation: Anum Hostel / Antarctica Hostel. Booking Supplier: Anum Hostel / Antarctica Hostel",
    proveedorNombre: "Antarctica Hostel",
    proveedorId: "prov-antarctica",
    motivo: "«Antarctica Hostel» no tiene mail ni WhatsApp. Se completa en el Excel de proveedores.",
    filaExcel: 136,
  },
];
