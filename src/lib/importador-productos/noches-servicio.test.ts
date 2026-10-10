import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsearNochesServicio, planNochesServicio, type ServicioDelPaquete } from "./noches-servicio";

const CSV = `paquete,servicio,noche_desde,noches,lugar,nota
CH10,alojamiento,1,1,Puerto Natales,antes del trek
CH10,W Trek Standard,2,4,refugios,
CH10,alojamiento,6,1,Puerto Natales,después del trek
`;

// Los servicios de CH10 tal como están cargados (M1-04d): Hostel (orden 1, 3 opciones),
// Hotel 3* (orden 2, 5 opciones) y el W Trek (orden 3).
const CH10: ServicioDelPaquete[] = [
  ...[1, 2, 3].map((prioridad) => ({ orden: 1, prioridad, tipo: "alojamiento", serviceProviderNombre: "Hostel" })),
  ...[1, 2, 3, 4, 5].map((prioridad) => ({ orden: 2, prioridad, tipo: "alojamiento", serviceProviderNombre: "Hotel" })),
  { orden: 3, prioridad: 1, tipo: "otro", serviceProviderNombre: "W Trek Standard" },
];

describe("noches de cada servicio de un paquete (spec M1-07 §3 #8)", () => {
  it("lee el archivo: paquete, servicio, noche de inicio, noches, lugar y nota", () => {
    const filas = parsearNochesServicio(CSV);
    expect(filas).toHaveLength(3);
    expect(filas[1]).toEqual({ paquete: "CH10", servicio: "W Trek Standard", nocheDesde: 2, noches: 4, lugar: "refugios" });
    expect(() => parsearNochesServicio("paquete,servicio,noche_desde,noches\nCH10,alojamiento,0,1\n")).toThrow(/fila 2/);
    expect(() => parsearNochesServicio("paquete,servicio,noche_desde,noches\nCH10,,1,1\n")).toThrow(/fila 2/);
  });

  it("CH10: los dos niveles de alojamiento van en la noche 1 y en la 6; el W Trek de la 2 a la 5", () => {
    const plan = planNochesServicio("CH10", parsearNochesServicio(CSV), CH10, 6);
    expect(plan.map((p) => [p.orden, p.nocheDesde, p.noches, p.lugar])).toEqual([
      [1, 1, 1, "Puerto Natales"],
      [1, 6, 1, "Puerto Natales"],
      [2, 1, 1, "Puerto Natales"],
      [2, 6, 1, "Puerto Natales"],
      [3, 2, 4, "refugios"],
    ]);
  });

  it("si la suma no da las noches del paquete, o se pisan, falla con un mensaje claro", () => {
    const corto = parsearNochesServicio(CSV).filter((f) => f.nocheDesde !== 6);
    expect(() => planNochesServicio("CH10", corto, CH10, 6)).toThrow(/CH10.*5 noches.*6/);
    const pisado = parsearNochesServicio(CSV.replace("CH10,W Trek Standard,2,4", "CH10,W Trek Standard,1,5"));
    expect(() => planNochesServicio("CH10", pisado, CH10, 6)).toThrow(/CH10.*noche 1/);
  });

  it("si el servicio no está en el paquete, falla con un mensaje claro", () => {
    const filas = parsearNochesServicio("paquete,servicio,noche_desde,noches\nCH10,W Trek Express,2,4\n");
    expect(() => planNochesServicio("CH10", filas, CH10, null)).toThrow(/CH10.*W Trek Express/);
  });

  it("el archivo real tiene CH10 en tres partes y OD010D por lado (M1-08)", () => {
    const filas = parsearNochesServicio(readFileSync("data/noches-servicio.csv", "utf-8"));
    expect(filas.map((f) => [f.paquete, f.servicio, f.nocheDesde, f.noches])).toEqual([
      ["CH10", "alojamiento", 1, 1],
      ["CH10", "W Trek Standard", 2, 4],
      ["CH10", "alojamiento", 6, 1],
      ["OD010D", "Bambu Foz", 1, 2],
      ["OD010D", "Beer Hostel", 3, 1],
      ["OD010D", "Nacional inn Foz", 1, 2],
      ["OD010D", "El Pueblito", 3, 1],
      ["OD010D", "Taroba", 1, 2],
      ["OD010D", "La Aldea", 3, 1],
    ]);
    expect(planNochesServicio("OD010D", filas, OD010D, 3)).toHaveLength(6);
  });

  // M1-08 §3 #5: Iguazú combined, noches 1-2 del lado brasileño y 3 del argentino.
  // Cada nivel trae sus dos hoteles como servicios separados (el "+" de la línea).
  const OD010D: ServicioDelPaquete[] = [
    { orden: 1, prioridad: 1, tipo: "alojamiento", nivel: "Hostel", serviceProviderNombre: "Bambu Foz" },
    { orden: 2, prioridad: 1, tipo: "alojamiento", nivel: "Hostel", serviceProviderNombre: "Beer Hostel" },
    { orden: 3, prioridad: 1, tipo: "alojamiento", nivel: "Hotel 3*", serviceProviderNombre: "Nacional inn Foz" },
    { orden: 4, prioridad: 1, tipo: "alojamiento", nivel: "Hotel 3*", serviceProviderNombre: "El Pueblito" },
    { orden: 5, prioridad: 1, tipo: "alojamiento", nivel: "Hotel 4*", serviceProviderNombre: "Taroba" },
    { orden: 6, prioridad: 1, tipo: "alojamiento", nivel: "Hotel 4*", serviceProviderNombre: "La Aldea" },
    { orden: 7, prioridad: 1, tipo: "excursion", nivel: null, serviceProviderNombre: "Paquete Receptvo 105 Premium x Foz" },
  ];
  const CSV_OD010D = `paquete,servicio,noche_desde,noches,lugar,nota
OD010D,Bambu Foz,1,2,Foz do Iguaçu,
OD010D,Beer Hostel,3,1,Puerto Iguazú,
OD010D,Nacional inn Foz,1,2,Foz do Iguaçu,
OD010D,El Pueblito,3,1,Puerto Iguazú,
OD010D,Taroba,1,2,Foz do Iguaçu,
OD010D,La Aldea,3,1,Puerto Iguazú,
`;

  it("OD010D: cada nivel suma sus dos hoteles (2 noches en Foz + 1 en Puerto Iguazú)", () => {
    const plan = planNochesServicio("OD010D", parsearNochesServicio(CSV_OD010D), OD010D, 3);
    expect(plan.map((p) => [p.orden, p.nocheDesde, p.noches])).toEqual([
      [1, 1, 2], [2, 3, 1], [3, 1, 2], [4, 3, 1], [5, 1, 2], [6, 3, 1],
    ]);
    // dentro de un nivel, que no se pisen y que sumen las noches del paquete
    const pisado = parsearNochesServicio(CSV_OD010D.replace("OD010D,Beer Hostel,3,1", "OD010D,Beer Hostel,2,2"));
    expect(() => planNochesServicio("OD010D", pisado, OD010D, 3)).toThrow(/OD010D.*noche 2/);
    const corto = parsearNochesServicio(CSV_OD010D.replace("OD010D,El Pueblito,3,1,Puerto Iguazú,\n", ""));
    expect(() => planNochesServicio("OD010D", corto, OD010D, 3)).toThrow(/OD010D.*2 noches.*3/);
  });
});
