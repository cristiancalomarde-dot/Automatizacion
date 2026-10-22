/**
 * M3-11: en Puerto Natales el hostel se elige según la habitación (owner, 2026-10-09 y 2026-10-22).
 * Dorm → Puma Hostel, Last Hope (Factoria no tiene dorms); privada → Factoria, Last Hope, Puma Hostel;
 * sin habitación → el orden del Excel, como antes. La regla vive en `data/hostel-segun-habitacion.csv`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { ARCHIVO_HOSTEL_SEGUN_HABITACION, leerHostelSegunHabitacion } from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { catalogoCon, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { CatalogoParaPedidos, HostelSegunHabitacion, ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const reglas = leerHostelSegunHabitacion(readFileSync(ARCHIVO_HOSTEL_SEGUN_HABITACION, "utf8"));

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const H = {
  puma: proveedor("prov-puma", "Puma House", ["info@pumahouse.test"]),
  lastHope: proveedor("prov-lasthope", "Last Hope", ["hostel.last.hope@test.test"]),
  vertice: proveedor("prov-vertice", "W trek VERTICE", ["ventas@vertice.test"]),
  chalten: proveedor("prov-chalten", "Chalten Travel", ["agencias@chaltentravel.test"]),
};

/** Un paquete con los tres hostels en el orden del Excel (Puma, Last Hope, Factoria) y una excursión el día 2. */
function paquete(codigo: string, destino: string, nombres: [string, string, string] = ["Puma Hostel", "Last Hope", "Factoria"]) {
  const id = `prod-${codigo}`;
  const supl = [H.puma, H.lastHope, H.vertice];
  return producto(
    id,
    codigo,
    [
      ...nombres.map((n, i) =>
        servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, prioridad: i + 1, serviceProviderNombre: n, bookingSupplier: supl[i] }),
      ),
      servicio({ productoId: id, tipo: "excursion", orden: 2, descripcion: "Full day Torres del Paine", bookingSupplier: H.chalten }),
    ],
    { destino },
  );
}

function armar(habitacion: string | null, prod = paquete("OD017", "PNT"), conReglas: readonly HostelSegunHabitacion[] = reglas) {
  const catalogo: CatalogoParaPedidos = { ...catalogoCon([prod], [], [{ codigo: prod.codigo, orden: 2, dia: 2 }]), hostelSegunHabitacion: conReglas };
  return ok(armarPedidos(reserva({ productoId: prod.id, habitacion, fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogo, plantilla));
}

const hostel = (r: ReturnType<typeof ok>) => r.pedidos.find((p) => p.cuerpo.includes("Alojamiento:"))!;
const excursion = (r: ReturnType<typeof ok>) => r.pedidos.find((p) => p.cuerpo.includes("Torres del Paine"))!;

describe("data/hostel-segun-habitacion.csv (fila 1)", () => {
  it("trae las 2 reglas de Puerto Natales", () => {
    const pnt = reglas.filter((r) => r.destino === "PNT");
    expect(pnt).toHaveLength(2);
    expect(pnt.find((r) => r.habitacion === "dorm")?.orden).toEqual(["Puma Hostel", "Last Hope"]);
    expect(pnt.find((r) => r.habitacion === "privada")?.orden).toEqual(["Factoria", "Last Hope", "Puma Hostel"]);
  });

  it("rechaza un archivo mal armado", () => {
    expect(() => leerHostelSegunHabitacion("otra,cosa\n")).toThrow(/primera fila/);
    expect(() => leerHostelSegunHabitacion("destino,habitacion,orden,nota\nPNT,suite,Puma Hostel,x\n")).toThrow(/fila 2/);
    expect(() => leerHostelSegunHabitacion("destino,habitacion,orden,nota\nPNT,dorm,,x\n")).toThrow(/fila 2/);
  });
});

describe("armarPedidos — Puerto Natales: el hostel según la habitación (filas 2 a 5)", () => {
  it("Dorm → Puma Hostel, avisando que la otra es Last Hope (Factoria no se ofrece)", () => {
    const p = hostel(armar("Dormitory - Hostel"));
    expect(p.destinatarios).toEqual(["info@pumahouse.test"]);
    expect(p.cuerpo).toContain("Alojamiento: Puma Hostel");
    const aviso = p.avisos.join("\n");
    expect(aviso).toContain("otras: Last Hope)");
    expect(aviso).not.toContain("Factoria");
  });

  it("doble → Factoria, avisando las otras: Last Hope, Puma Hostel", () => {
    const p = hostel(armar("Double Room - Hostel"));
    expect(p.destinatarios).toEqual(["ventas@vertice.test"]);
    expect(p.cuerpo).toContain("Alojamiento: Factoria");
    expect(p.avisos.join("\n")).toContain("otras: Last Hope, Puma Hostel)");
  });

  it.each(["Twin Room - Hostel", "Single Room - Hostel", "Triple Room - Hostel"])("%s (privada) → Factoria", (hab) => {
    expect(hostel(armar(hab)).destinatarios).toEqual(["ventas@vertice.test"]);
  });

  it("sin habitación → Puma Hostel, el orden del Excel como antes", () => {
    const prod = paquete("OD017", "PNT");
    const catalogo: CatalogoParaPedidos = { ...catalogoCon([prod]), hostelSegunHabitacion: reglas };
    const r = ok(armarPedidos(reserva({ productoId: prod.id, habitacion: null, fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogo, plantilla));
    const p = hostel(r);
    expect(p.destinatarios).toEqual(["info@pumahouse.test"]);
    expect(p.avisos.join("\n")).toContain("se tomó la primera opción del catálogo (otras: Last Hope, Factoria)");
  });

  it("con doble, el pick up de la excursión dice Factoria (la estadía a confirmar es la elegida)", () => {
    const p = excursion(armar("Double Room - Hostel"));
    expect(p.cuerpo).toMatch(/Pick up[^:\n]*: Factoria \(Puerto Natales\) · hotel a confirmar/);
    expect(p.cuerpo).not.toContain("Puma");
  });

  it("otro destino con doble sigue con la primera opción del Excel", () => {
    const p = hostel(armar("Double Room - Hostel", paquete("OD099", "FTE")));
    expect(p.destinatarios).toEqual(["info@pumahouse.test"]);
  });

  it("un nombre de la regla que no está en el catálogo se saltea; se usa lo que sí está, en el orden de la regla", () => {
    const prod = paquete("OD017", "PNT", ["Puma Hostel", "Last Hope", "Otro Hostel"]);
    const p = hostel(armar("Double Room - Hostel", prod));
    expect(p.destinatarios).toEqual(["hostel.last.hope@test.test"]);
    expect(p.avisos.join("\n")).toContain("otras: Puma Hostel)");
  });

  it("si ningún nombre de la regla está en el catálogo, el orden del Excel", () => {
    const prod = paquete("OD017", "PNT", ["Hostel A", "Hostel B", "Hostel C"]);
    const p = hostel(armar("Double Room - Hostel", prod));
    expect(p.destinatarios).toEqual(["info@pumahouse.test"]);
    expect(p.avisos.join("\n")).toContain("otras: Hostel B, Hostel C)");
  });

  it("sin reglas cargadas, todo como antes", () => {
    expect(hostel(armar("Double Room - Hostel", paquete("OD017", "PNT"), [])).destinatarios).toEqual(["info@pumahouse.test"]);
  });
});
