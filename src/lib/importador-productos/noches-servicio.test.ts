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

  it("el archivo real tiene CH10 en tres partes", () => {
    const filas = parsearNochesServicio(readFileSync("data/noches-servicio.csv", "utf-8"));
    expect(filas.map((f) => [f.paquete, f.servicio, f.nocheDesde, f.noches])).toEqual([
      ["CH10", "alojamiento", 1, 1],
      ["CH10", "W Trek Standard", 2, 4],
      ["CH10", "alojamiento", 6, 1],
    ]);
  });
});
