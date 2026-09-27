import { describe, expect, it } from "vitest";
import { armarFilasServicio, crearIndiceProveedores } from "./proveedores";
import type { ServicioLeido } from "./linea";

// Spec M1-04 §3 #6 y #7: emparejado de Service Provider / Booking Supplier
// contra `proveedor.nombre_normalizado` (M1-03), sin fuzzy-matching y sin
// crear proveedores nuevos.

const PROVEEDORES = [
  { id: "p-dann", nombre_normalizado: "dann inn foz" },
  { id: "p-nacional", nombre_normalizado: "nacional inn" },
  { id: "p-cuenca", nombre_normalizado: "cuenca del plata" },
  // mismo nombre en dos destinos → ambiguo, no se elige uno al azar
  { id: "p-ds-1", nombre_normalizado: "design suites" },
  { id: "p-ds-2", nombre_normalizado: "design suites" },
];

function servicio(parcial: Partial<ServicioLeido> & Pick<ServicioLeido, "opciones">): ServicioLeido {
  return { tipo: "alojamiento", descripcion: "línea del Excel", noches: null, nivel: null, fila: 10, ...parcial };
}

describe("armarFilasServicio — emparejado de proveedores (spec M1-04 §3 #6)", () => {
  it("Booking Supplier distinto del Service Provider → dos proveedores distintos, no fusionados", () => {
    const indice = crearIndiceProveedores(PROVEEDORES);
    const [fila] = armarFilasServicio(
      [
        servicio({
          nivel: "Hotel 3*",
          opciones: [{ prioridad: 1, serviceProvider: "Dann Inn  Foz", bookingSupplier: "NACIONAL INN" }],
        }),
      ],
      indice,
    );
    expect(fila).toMatchObject({
      orden: 1,
      prioridad: 1,
      tipo_servicio: "alojamiento",
      nivel: "Hotel 3*",
      fila_excel: 10,
      service_provider_id: "p-dann",
      booking_supplier_id: "p-nacional",
      service_provider_nombre: "Dann Inn  Foz",
      booking_supplier_nombre: "NACIONAL INN",
      proveedor_sin_resolver: false,
    });
  });

  it("opciones \"/\" → mismo `orden` (mismo servicio), prioridad 1-2-3 preservada", () => {
    const filas = armarFilasServicio(
      [
        servicio({
          opciones: [
            { prioridad: 1, serviceProvider: "Beer Hostel", bookingSupplier: "Cuenca del Plata" },
            { prioridad: 2, serviceProvider: "Hostel Inn", bookingSupplier: "Cuenca del Plata" },
            { prioridad: 3, serviceProvider: "Mango Hostel", bookingSupplier: "Cuenca del Plata" },
          ],
        }),
        servicio({ tipo: "excursion", opciones: [{ prioridad: 1, serviceProvider: "Cuenca del Plata", bookingSupplier: "Cuenca del Plata" }] }),
      ],
      crearIndiceProveedores(PROVEEDORES),
    );
    expect(filas.map((f) => [f.orden, f.prioridad, f.service_provider_nombre])).toEqual([
      [1, 1, "Beer Hostel"],
      [1, 2, "Hostel Inn"],
      [1, 3, "Mango Hostel"],
      [2, 1, "Cuenca del Plata"],
    ]);
  });
});

describe("armarFilasServicio — proveedor sin resolver (spec M1-04 §3 #7)", () => {
  it("Service Provider inexistente → id null y el nombre del Excel queda guardado; con el Booking Supplier resuelto NO marca revisión (M1-04b §5)", () => {
    const [fila] = armarFilasServicio(
      [servicio({ opciones: [{ prioridad: 1, serviceProvider: "Hotel Fantasma", bookingSupplier: "Cuenca del Plata" }] })],
      crearIndiceProveedores(PROVEEDORES),
    );
    expect(fila).toMatchObject({
      service_provider_id: null,
      service_provider_nombre: "Hotel Fantasma",
      booking_supplier_id: "p-cuenca",
      proveedor_sin_resolver: false,
    });
  });

  it("no se hace fuzzy-matching: \"Cuenca del Plana\" / \"Cuenca\" no emparejan con \"Cuenca del Plata\"", () => {
    const filas = armarFilasServicio(
      [
        servicio({ opciones: [{ prioridad: 1, serviceProvider: "Cuenca del Plana", bookingSupplier: "Cuenca" }] }),
      ],
      crearIndiceProveedores(PROVEEDORES),
    );
    expect(filas[0]).toMatchObject({ service_provider_id: null, booking_supplier_id: null, proveedor_sin_resolver: true });
  });

  it("nombre que coincide con dos proveedores (distinto destino) → sin resolver, no se elige uno", () => {
    const [fila] = armarFilasServicio(
      [servicio({ opciones: [{ prioridad: 1, serviceProvider: "Design Suites", bookingSupplier: "Design Suites" }] })],
      crearIndiceProveedores(PROVEEDORES),
    );
    expect(fila).toMatchObject({ service_provider_id: null, booking_supplier_id: null, proveedor_sin_resolver: true });
  });

  it("Booking Supplier no escrito en el Excel → sin resolver (no se asume igual al Service Provider)", () => {
    const [fila] = armarFilasServicio(
      [servicio({ opciones: [{ prioridad: 1, serviceProvider: "Dann Inn Foz", bookingSupplier: null }] })],
      crearIndiceProveedores(PROVEEDORES),
    );
    expect(fila).toMatchObject({
      service_provider_id: "p-dann",
      booking_supplier_id: null,
      booking_supplier_nombre: null,
      proveedor_sin_resolver: true,
    });
  });

  it("nunca produce proveedores nuevos: solo filas de producto_servicio con ids del índice o null", () => {
    const idsValidos = new Set(PROVEEDORES.map((p) => p.id));
    const filas = armarFilasServicio(
      [servicio({ opciones: [{ prioridad: 1, serviceProvider: "Nuevo SA", bookingSupplier: "Otro Nuevo SRL" }] })],
      crearIndiceProveedores(PROVEEDORES),
    );
    for (const f of filas) {
      for (const id of [f.service_provider_id, f.booking_supplier_id]) {
        expect(id === null || idsValidos.has(id)).toBe(true);
      }
    }
  });
});

// Spec M1-04b §3 #3-#4: después del nombre exacto, la lista de equivalencias
// (`proveedor_alias`) revisada por el owner.
describe("armarFilasServicio — equivalencias de proveedores (spec M1-04b)", () => {
  const ALIAS = [
    { alias_normalizado: "cuenca del plana", proveedor_id: "p-cuenca", estado: "confirmado" as const, nota: "Typo" },
    // un alias que choca con un nombre exacto: gana el exacto
    { alias_normalizado: "nacional inn", proveedor_id: "p-otro", estado: "confirmado" as const, nota: null },
    { alias_normalizado: "beer", proveedor_id: "p-tangoinn", estado: "para_revisar" as const, nota: "Cambió de nombre" },
    { alias_normalizado: "tetris", proveedor_id: null, estado: "para_revisar" as const, nota: "Por WhatsApp" },
  ];
  const indice = crearIndiceProveedores(PROVEEDORES, ALIAS);

  function una(sp: string, bs: string | null) {
    return armarFilasServicio([servicio({ opciones: [{ prioridad: 1, serviceProvider: sp, bookingSupplier: bs }] })], indice)[0];
  }

  it("el typo 'Cuenca del Plana' se resuelve por alias a Cuenca del Plata (confirmado: sin flags)", () => {
    expect(una("El Pueblito", "Cuenca del  PLANA")).toMatchObject({
      booking_supplier_id: "p-cuenca",
      booking_supplier_nombre: "Cuenca del  PLANA",
      proveedor_sin_resolver: false,
      proveedor_para_revisar: false,
      proveedor_nota: null,
    });
  });

  it("primero el nombre exacto, después el alias", () => {
    expect(una("Dann Inn Foz", "Nacional Inn").booking_supplier_id).toBe("p-nacional");
  });

  it("alias para_revisar con proveedor → lo asigna, pero deja el flag de revisión y la nota", () => {
    expect(una("Beer", "Beer")).toMatchObject({
      service_provider_id: "p-tangoinn",
      booking_supplier_id: "p-tangoinn",
      proveedor_sin_resolver: false,
      proveedor_para_revisar: true,
      proveedor_nota: "Cambió de nombre",
    });
  });

  it("alias sin proveedor → el servicio queda sin resolver, con la nota visible", () => {
    expect(una("Tetris", "Tetris")).toMatchObject({
      service_provider_id: null,
      booking_supplier_id: null,
      proveedor_sin_resolver: true,
      proveedor_para_revisar: true,
      proveedor_nota: "Por WhatsApp",
    });
  });

  it("nombre sin exacto ni alias → sin resolver, sin nota", () => {
    expect(una("Hotel Fantasma", "Hotel Fantasma")).toMatchObject({
      booking_supplier_id: null,
      proveedor_sin_resolver: true,
      proveedor_para_revisar: false,
      proveedor_nota: null,
    });
  });
});
