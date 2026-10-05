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

// Spec M1-04d §3 #2-#4: las equivalencias dependen del destino del paquete y
// tienen modo (alias / por_service_provider / manual).
describe("armarFilasServicio — equivalencias por destino (spec M1-04d)", () => {
  const DIRECTORIO = [
    { id: "p-nacional-foz", nombre_normalizado: "nacional inn foz", ciudad: "BRASIL" },
    { id: "p-nacional-copa", nombre_normalizado: "nacional inn copacabana", ciudad: "BRASIL" },
    { id: "p-rumbo-ush", nombre_normalizado: "rumbo sur", ciudad: "USHUAIA", mails: ["a@rumbosur.com"] },
    { id: "p-rumbo-fte", nombre_normalizado: "rumbo sur", ciudad: "CALAFATE", mails: ["b@rumbosur.com"] },
    { id: "p-rincon", nombre_normalizado: "rincon del calafate", ciudad: "CALAFATE" },
    { id: "p-sent", nombre_normalizado: "sent", ciudad: "CALAFATE" },
    { id: "p-mirador", nombre_normalizado: "mirador del lago", ciudad: "CALAFATE" },
    { id: "p-parque", nombre_normalizado: "calafate parque", ciudad: "CALAFATE" },
    { id: "p-maipu", nombre_normalizado: "reservas dazzler maipu'", ciudad: "BUENOS AIRES" },
    { id: "p-sanmartin", nombre_normalizado: "dazzler san martin", ciudad: "BUENOS AIRES" },
    { id: "p-hayas", nombre_normalizado: "las hayas y los acebos", ciudad: "USHUAIA" },
    // mismo proveedor cargado dos veces (CHALTEN y EL CHALTEN), mismo contacto
    { id: "p-pioneros-1", nombre_normalizado: "pioneros del valle", ciudad: "CHALTEN", mails: ["r@pioneros.com"], canal: "mail" },
    { id: "p-pioneros-2", nombre_normalizado: "pioneros del valle", ciudad: "EL CHALTEN", mails: ["r@pioneros.com"], canal: "mail" },
  ];
  const ALIAS = [
    { destino: "IGR", alias_normalizado: "nacional inn", proveedor_id: "p-nacional-foz", estado: "confirmado" as const, nota: null, modo: "alias" as const },
    { destino: "RIO", alias_normalizado: "nacional inn", proveedor_id: "p-nacional-copa", estado: "confirmado" as const, nota: null, modo: "alias" as const },
    { destino: "FTE", alias_normalizado: "tremun", proveedor_id: null, estado: "confirmado" as const, nota: "Hotel por hotel", modo: "por_service_provider" as const },
    { destino: "FTE", alias_normalizado: "rincon del calafate", proveedor_id: "p-rincon", estado: "confirmado" as const, nota: null, modo: "alias" as const },
    { destino: "FTE", alias_normalizado: "sent", proveedor_id: "p-sent", estado: "confirmado" as const, nota: null, modo: "alias" as const },
    { destino: "FTE", alias_normalizado: "mirador del lago", proveedor_id: "p-mirador", estado: "confirmado" as const, nota: null, modo: "alias" as const },
    { destino: "FTE", alias_normalizado: "calafate parque", proveedor_id: "p-parque", estado: "confirmado" as const, nota: null, modo: "alias" as const },
    { destino: "USH", alias_normalizado: "tremun", proveedor_id: null, estado: "confirmado" as const, nota: null, modo: "por_service_provider" as const },
    { destino: "USH", alias_normalizado: "las hayas", proveedor_id: "p-hayas", estado: "confirmado" as const, nota: null, modo: "alias" as const },
    { destino: "BUE", alias_normalizado: "dazzler", proveedor_id: null, estado: "confirmado" as const, nota: null, modo: "por_service_provider" as const },
    { destino: "BUE", alias_normalizado: "dazzler maipu", proveedor_id: "p-maipu", estado: "confirmado" as const, nota: null, modo: "alias" as const },
    { destino: "BUE", alias_normalizado: "san martin", proveedor_id: "p-sanmartin", estado: "confirmado" as const, nota: null, modo: "alias" as const },
    { destino: "VLP", alias_normalizado: "kupos.cl", proveedor_id: null, estado: "confirmado" as const, nota: "Sistema online", modo: "manual" as const },
  ];
  const indice = crearIndiceProveedores(DIRECTORIO, ALIAS);

  function filas(destino: string, ...opciones: Array<[string, string | null]>) {
    return armarFilasServicio(
      [servicio({ opciones: opciones.map(([sp, bs], i) => ({ prioridad: i + 1, serviceProvider: sp, bookingSupplier: bs })) })],
      indice,
      destino,
    );
  }

  it("Nacional Inn depende del destino: en RIO es el de Copacabana, en IGR el de Foz", () => {
    expect(filas("RIO", ["National Inn Copacabana", "Nacional Inn"])[0].booking_supplier_id).toBe("p-nacional-copa");
    expect(filas("IGR", ["Nacional inn Foz", "Nacional Inn"])[0].booking_supplier_id).toBe("p-nacional-foz");
    // un alias de otro destino no aplica
    expect(filas("BUE", ["X", "Nacional Inn"])[0]).toMatchObject({ booking_supplier_id: null, proveedor_sin_resolver: true });
  });

  it("nombre repetido en el directorio: Rumbo Sur en USH es el de Ushuaia, en FTE el de Calafate", () => {
    expect(filas("USH", ["Beagle", "Rumbo Sur"])[0].booking_supplier_id).toBe("p-rumbo-ush");
    expect(filas("FTE", ["Minitrekking", "Rumbo Sur"])[0].booking_supplier_id).toBe("p-rumbo-fte");
    // sin destino no se elige uno
    expect(armarFilasServicio([servicio({ opciones: [{ prioridad: 1, serviceProvider: "x", bookingSupplier: "Rumbo Sur" }] })], indice)[0].booking_supplier_id).toBeNull();
  });

  it("el mismo proveedor cargado dos veces con el mismo contacto (CHALTEN / EL CHALTEN) se resuelve igual", () => {
    const [f] = filas("CHA", ["Pioneros del Valle", "Pioneros del Valle"]);
    expect(["p-pioneros-1", "p-pioneros-2"]).toContain(f.booking_supplier_id);
    expect(f.proveedor_sin_resolver).toBe(false);
  });

  it("Tremun se resuelve por hotel (OD013/OD016): cada opción con su propio proveedor", () => {
    const r = filas(
      "FTE",
      ["Holtel 3* Rincon del Calafate", "Tremun"],
      ["Hotel * Sent Calafate", "Tremun"],
      ["Hotel 4* Mirador del Lago", "Tremun"],
      ["Hotel 4* Calafate Parque", "Tremun"],
    );
    expect(r.map((f) => f.booking_supplier_id)).toEqual(["p-rincon", "p-sent", "p-mirador", "p-parque"]);
    expect(r.every((f) => !f.proveedor_sin_resolver && !f.proveedor_para_revisar)).toBe(true);
    expect(r.map((f) => f.booking_supplier_nombre)).toEqual(["Tremun", "Tremun", "Tremun", "Tremun"]);
  });

  it("Dazzler (OD018): \"Dazzler Maipu\" y \"San Martin\" quedan con proveedores distintos", () => {
    const r = filas("BUE", ["Dazzler Maipu", "Dazzler"], ["San Martin", "Dazzler"]);
    expect(r.map((f) => f.booking_supplier_id)).toEqual(["p-maipu", "p-sanmartin"]);
  });

  it("un hotel sin equivalencia queda sin resolver (no se inventa), con la nota de qué falta", () => {
    const [acebos, hayas] = filas("USH", ["Hotel 4* Los Acebos", "Tremun"], ["Hotel 4* Las Hayas", "Tremun"]);
    expect(acebos).toMatchObject({ booking_supplier_id: null, proveedor_sin_resolver: true });
    expect(acebos.proveedor_nota).toMatch(/Los Acebos/);
    expect(hayas.booking_supplier_id).toBe("p-hayas");
  });

  it("modo manual (Kupos.cl): sin proveedor, marcado manual y sin bandera de revisión", () => {
    const [f] = filas("VLP", ["Santiago - Valparaiso - Santiago", "Kupos.cl"]);
    expect(f).toMatchObject({
      booking_supplier_id: null,
      reserva_manual: true,
      proveedor_sin_resolver: false,
      proveedor_para_revisar: false,
    });
  });

  it("los servicios opcionales quedan marcados", () => {
    const [f] = armarFilasServicio(
      [servicio({ tipo: "excursion", opcional: true, opciones: [{ prioridad: 1, serviceProvider: "Canoa", bookingSupplier: "Sent" }] })],
      indice,
      "FTE",
    );
    expect(f).toMatchObject({ opcional: true, reserva_manual: false });
    expect(filas("FTE", ["x", "Sent"])[0].opcional).toBe(false);
  });
});

describe("armarFilasServicio — modo manual gana al nombre exacto (Buquebus, M1-04d)", () => {
  it("si el owner marcó el nombre como manual en ese destino, no se le escribe aunque esté en el directorio", () => {
    const indice = crearIndiceProveedores(
      [{ id: "p-buquebus", nombre_normalizado: "buquebus", ciudad: "BUENOS AIRES" }],
      [{ destino: "BUE", alias_normalizado: "buquebus", proveedor_id: null, estado: "confirmado", nota: "Sistema propio", modo: "manual" }],
    );
    const [bue] = armarFilasServicio([servicio({ tipo: "excursion", opciones: [{ prioridad: 1, serviceProvider: "Colonia", bookingSupplier: "Buquebus" }] })], indice, "BUE");
    expect(bue).toMatchObject({ booking_supplier_id: null, reserva_manual: true, proveedor_sin_resolver: false });
    // en otro destino sigue valiendo el nombre exacto
    const [mdz] = armarFilasServicio([servicio({ opciones: [{ prioridad: 1, serviceProvider: "x", bookingSupplier: "Buquebus" }] })], indice, "MDZ");
    expect(mdz).toMatchObject({ booking_supplier_id: "p-buquebus", reserva_manual: false });
  });
});
