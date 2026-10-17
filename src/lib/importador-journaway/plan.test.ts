import { describe, expect, it } from "vitest";
import { crearIndiceProveedores } from "@/lib/importador-productos/proveedores";
import { parsearComposicion, parsearInternos } from "./composicion";
import { parsearNombres } from "./nombres";
import { planificarJournaway, verificarOtroCatalogo } from "./plan";
import type { FilaPlanilla } from "./planilla";
import { parsearProveedoresJournaway } from "./proveedores";

// Spec M2-08 §3 #2, #5-#8 y #10: qué se va a cargar, armado sin tocar la base.

function fila(codigo: string, tipo: string, destino: string, nombre: string, extra: Partial<FilaPlanilla> = {}): FilaPlanilla {
  return {
    fila: 2,
    codigo,
    tipo,
    destino,
    nombreTarifario: nombre,
    nombreMail: "",
    incluye: "",
    proveedorSugerido: "",
    origenProveedor: "",
    confirmado: "ok",
    comentario: "",
    celeste: true,
    ...extra,
  };
}

const PLANILLA: FilaPlanilla[] = [
  fila("SPAT01", "Traslado", "San Pedro de Atacama", "Regular shuttle Calama Airport - San Pedro - Calama Airport", { celeste: false }),
  fila("SPAE01", "Excursión", "San Pedro de Atacama", "Astrophotography Tour", { celeste: false, incluye: "9:00 pm a 11:30 pm" }),
  fila("SPAE05", "Excursión", "San Pedro de Atacama", "Salt Flats Route Tour"),
  fila("SPAP03", "Paquete", "San Pedro de Atacama", "Extension of Trip A"),
  fila("SPAP05", "Tour compuesto", "San Pedro de Atacama + Uyuni", "San Pedro de Atacama + Uyuni Salt Flats in Tayka Hotels 7N/8D"),
  fila("IGRP01", "Paquete", "Iguazú", "Package 1: Transfers & Excursions in Small Groups"),
  fila("PNTW01", "Trekking", "Torres del Paine", "W-Trek Standard with Grey Glacier 4 nights / 5 days"),
  fila("IPCH01", "Alojamiento", "Isla de Pascua", "Hotel Vai Moana, Hanga Roa", { incluye: "Standard o Hare Vaka" }),
];

const PROVEEDORES = parsearProveedoresJournaway(
  "codigo,proveedor,prioridad,modo,nota\n" +
    "SPAT01,Transvip,1,manual,\n" +
    "SPAE01,Horizonte atacama,1,alias,\n" +
    "SPAE05,Horizonte atacama,1,alias,\n" +
    "IGRP01,Paquete 105 Premium desde Foz,1,alias,\n" +
    "PNTW01,W trek VERTICE,1,alias,\n" +
    "IPCH01,\"Vai Moana, proveedor CL Mundo\",1,alias,\n" +
    "UYUO01,Imperio Inca,1,alias,\n",
);

const COMPOSICION = parsearComposicion(
  "paquete,orden,dia,componente,lado,nota\n" +
    "SPAP03,1,4,SPAE05,,\n" +
    "SPAP03,2,7,SPAT01,solo_salida,\n" +
    "SPAP05,1,1,SPAT01,solo_llegada,\n" +
    "SPAP05,2,1,SPAE01,,\n" +
    "SPAP05,3,5,UYUO01,,\n",
);

const INTERNOS = parsearInternos(
  "codigo,nombre,destino,orden,tipo,que_es,descripcion,noche_desde,noches,lugar,nota\n" +
    "UYUO01,Overland privado San Pedro – Uyuni en hoteles Tayka,UYU,1,excursion,Overland privado,Jeep 4x4 desde Hito Cajón,,,,\n" +
    "UYUO01,Overland privado San Pedro – Uyuni en hoteles Tayka,UYU,2,alojamiento,Tayka del Desierto,Noche 1,1,1,Tayka del Desierto,\n" +
    "UYUO01,Overland privado San Pedro – Uyuni en hoteles Tayka,UYU,3,bus,Bus Uyuni – La Paz,Nocturno,,,,\n",
);

const NOMBRES = parsearNombres(
  "codigo,nombre,origen,nota\n" +
    "SPAE05,Salt Flats Route Tour,tarifario,\n" +
    "SPAE05,\"San Pedro de Atacama: Tour to the Quepiaco River, Monjes de la Pacana, and the Salt Flats\",mail de ejemplo,\n" +
    "SPAE01,Astronomy Tour in the Atacama Desert,mail de ejemplo,\n" +
    "UYUO01,Siloli: Full-day tour to the Siloli Desert & the Black Lagoon,mail de ejemplo,\n" +
    "SPAT01,Regular shuttle Calama Airport - San Pedro - Calama Airport,tarifario,\n" +
    "SPAP03,Extension of Trip A,tarifario,\n" +
    "SPAP05,San Pedro de Atacama + Uyuni Salt Flats in Tayka Hotels 7N/8D,tarifario,\n" +
    "IGRP01,Package 1: Transfers & Excursions in Small Groups,tarifario,\n" +
    "PNTW01,W-Trek Standard with Grey Glacier 4 nights / 5 days,tarifario,\n" +
    "IPCH01,\"Hotel Vai Moana, Hanga Roa\",tarifario,\n",
);

const INDICE = crearIndiceProveedores([
  { id: "p-horizonte", nombre_normalizado: "horizonte atacama", ciudad: "SAN PEDRO DE ATACAMA" },
  { id: "p-105", nombre_normalizado: "paquete 105 premium desde foz", ciudad: "IGUAZU" },
  { id: "p-vertice", nombre_normalizado: "w trek vertice", ciudad: "PUERTO NATALES" },
  { id: "p-vaimoana", nombre_normalizado: "vai moana, proveedor cl mundo", ciudad: "ISLA DE PASCUA" },
  { id: "p-imperio", nombre_normalizado: "imperio inca", ciudad: "BOLIVIA" },
]);

function planEntero(cambios: Partial<Parameters<typeof planificarJournaway>[0]> = {}) {
  return planificarJournaway({
    planilla: PLANILLA,
    proveedores: PROVEEDORES,
    composicion: COMPOSICION,
    internos: INTERNOS,
    nombres: NOMBRES,
    indice: INDICE,
    ...cambios,
  });
}

describe("planificarJournaway", () => {
  const plan = planEntero();
  const producto = (codigo: string) => plan.productos.find((p) => p.codigo === codigo)!;

  it("cada fila que no es un paquete armado es un producto simple con un servicio; se suma el Overland interno", () => {
    expect(plan.productos.map((p) => p.codigo).sort()).toEqual(
      ["IGRP01", "IPCH01", "PNTW01", "SPAE01", "SPAE05", "SPAP03", "SPAP05", "SPAT01", "UYUO01"].sort(),
    );
    expect(producto("SPAE01").servicios).toHaveLength(1);
    expect(producto("SPAE01").servicios[0]).toMatchObject({
      orden: 1,
      prioridad: 1,
      tipo_servicio: "excursion",
      descripcion: "Astrophotography Tour\n9:00 pm a 11:30 pm",
      service_provider_nombre: "Astrophotography Tour",
      booking_supplier_nombre: "Horizonte atacama",
      booking_supplier_id: "p-horizonte",
      proveedor_sin_resolver: false,
      reserva_manual: false,
    });
    expect(producto("SPAE01")).toMatchObject({ destino: "SPA", ciudades: [], componentes: [] });
  });

  it("tipos: Paquete simple → excursión entera al proveedor; Trekking → como el W Trek de CH10; Alojamiento con el hotel", () => {
    expect(producto("IGRP01").servicios[0]).toMatchObject({ tipo_servicio: "excursion", booking_supplier_id: "p-105" });
    expect(producto("PNTW01").servicios[0]).toMatchObject({ tipo_servicio: "otro", booking_supplier_id: "p-vertice" });
    expect(producto("IPCH01").servicios[0]).toMatchObject({
      tipo_servicio: "alojamiento",
      service_provider_nombre: "Hotel Vai Moana, Hanga Roa",
      booking_supplier_id: "p-vaimoana",
    });
  });

  it("un traslado guarda su sentido y uno manual (Transvip) no queda sin resolver", () => {
    expect(producto("SPAT01").servicios[0]).toMatchObject({
      tipo_servicio: "traslado",
      sentido: "ida_y_vuelta",
      reserva_manual: true,
      booking_supplier_id: null,
      proveedor_sin_resolver: false,
    });
  });

  it("el Overland interno lleva todos sus servicios al proveedor del archivo, con las noches", () => {
    const uyu = producto("UYUO01");
    expect(uyu).toMatchObject({ nombre: "Overland privado San Pedro – Uyuni en hoteles Tayka", destino: "UYU", celeste: false });
    expect(uyu.servicios.map((s) => [s.orden, s.tipo_servicio, s.service_provider_nombre, s.booking_supplier_id])).toEqual([
      [1, "excursion", "Overland privado", "p-imperio"],
      [2, "alojamiento", "Tayka del Desierto", "p-imperio"],
      [3, "bus", "Bus Uyuni – La Paz", "p-imperio"],
    ]);
    expect(uyu.noches).toEqual([{ orden: 2, nocheDesde: 1, noches: 1, lugar: "Tayka del Desierto" }]);
  });

  it("los paquetes armados no tienen servicios propios: sus partes en orden, con día y sin la regla de buses", () => {
    expect(producto("SPAP05").servicios).toEqual([]);
    expect(producto("SPAP05").componentes).toEqual([
      { orden: 1, dia: 1, codigo: "SPAT01" },
      { orden: 2, dia: 1, codigo: "SPAE01" },
      { orden: 3, dia: 5, codigo: "UYUO01" },
    ]);
    expect(producto("SPAP05")).toMatchObject({ destino: "SPA", ciudades: ["San Pedro de Atacama", "Uyuni"] });
  });

  it("el lado del traslado sale solo de la composición, como ajuste de excepción del servicio del traslado", () => {
    expect(producto("SPAP05").ajustes).toEqual([
      { paquete: "SPAT01", orden: 1, accion: "solo_llegada", motivo: expect.stringMatching(/solo .*llegada/i) },
    ]);
    expect(producto("SPAP03").ajustes).toEqual([
      { paquete: "SPAT01", orden: 1, accion: "solo_salida", motivo: expect.stringMatching(/solo .*salida/i) },
    ]);
  });

  it("los nombres de Journaway van limpios en el código y tal cual en el nombre; los celestes llevan además su código", () => {
    expect(producto("SPAE05").codigos).toEqual([
      { codigo: "SPAE05", nombreExterno: null },
      { codigo: "salt flats route tour", nombreExterno: "Salt Flats Route Tour" },
      {
        codigo: "tour to the quepiaco river, monjes de la pacana, and the salt flats",
        nombreExterno: "San Pedro de Atacama: Tour to the Quepiaco River, Monjes de la Pacana, and the Salt Flats",
      },
    ]);
    expect(producto("SPAE01").codigos).toEqual([
      { codigo: "astronomy tour in the atacama desert", nombreExterno: "Astronomy Tour in the Atacama Desert" },
    ]);
    expect(producto("SPAT01").codigos).toEqual([
      {
        codigo: "regular shuttle calama airport - san pedro - calama airport",
        nombreExterno: "Regular shuttle Calama Airport - San Pedro - Calama Airport",
      },
    ]);
  });

  it("una parte que no existe (SPAE99) corta antes de escribir", () => {
    const composicion = parsearComposicion("paquete,orden,dia,componente,lado,nota\nSPAP03,1,4,SPAE99,,\n");
    expect(() => planEntero({ composicion })).toThrow(/SPAE99.*no existe/);
  });

  it("un lado en una parte que no es un traslado corta antes de escribir", () => {
    const composicion = parsearComposicion("paquete,orden,dia,componente,lado,nota\nSPAP03,1,4,SPAE05,solo_salida,\nSPAP05,1,1,UYUO01,,\n");
    expect(() => planEntero({ composicion })).toThrow(/SPAE05.*no es un traslado/);
  });

  it("un tour compuesto de la planilla sin armado, o un nombre de un código que no existe, cortan antes de escribir", () => {
    const composicion = COMPOSICION.filter((c) => c.paquete !== "SPAP05");
    expect(() => planEntero({ composicion })).toThrow(/SPAP05.*no tiene partes/);
    const nombres = parsearNombres("codigo,nombre,origen,nota\nZZZ01,Algo,tarifario,\n");
    expect(() => planEntero({ nombres })).toThrow(/ZZZ01.*no existe/);
  });

  it("un producto sin ningún nombre de Journaway corta antes de escribir (todos llevan al menos el del tarifario)", () => {
    const nombres = NOMBRES.filter((n) => n.codigo !== "SPAT01");
    expect(() => planEntero({ nombres })).toThrow(/SPAT01.*ningún nombre/);
  });
});

describe("verificarOtroCatalogo", () => {
  it("un código de la planilla que ya existe y no es de Journaway corta con un mensaje claro", () => {
    expect(() => verificarOtroCatalogo(["OD030", "SPAE05"], [{ codigo: "OD030", deJournaway: false }])).toThrow(
      "OD030 ya es un producto de otro catálogo",
    );
  });

  it("uno que ya es de Journaway (segunda corrida) o que no existe, pasa", () => {
    expect(() => verificarOtroCatalogo(["SPAE05", "SPAE01"], [{ codigo: "SPAE05", deJournaway: true }])).not.toThrow();
  });
});
