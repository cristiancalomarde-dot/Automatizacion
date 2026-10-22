/**
 * M3-15 (owner 2026-10-22), con las reglas reales de `data/`:
 * - Bike Tour (La Bicicleta Naranja, OD018): no tiene pick up; el pedido dice el punto de
 *   encuentro (`data/puntos-de-encuentro.csv`). El City Tour sigue con pick up en el hotel.
 * - Mendoza (OD019): Bodegas half Day el día 1 por la tarde y la excursión de día entero (Alta
 *   Montaña, o Rafting si lo eligió) el día 2 (`data/dias-servicio.csv`, por nombre de excursión).
 *   Dentro de un tour, el día se cuenta desde el inicio de la parte de Mendoza.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import {
  ARCHIVO_DIAS,
  ARCHIVO_OPCIONES_PASAJERO,
  ARCHIVO_PUNTOS_DE_ENCUENTRO,
  conProveedores,
  leerDiasServicio,
  leerOpcionesPasajero,
  leerPuntosDeEncuentro,
} from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { catalogoCon, componente, parte, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { CatalogoParaPedidos, ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const dias = leerDiasServicio(readFileSync(ARCHIVO_DIAS, "utf8"));
const puntos = leerPuntosDeEncuentro(readFileSync(ARCHIVO_PUNTOS_DE_ENCUENTRO, "utf8"));

const PR = {
  summa: proveedor("prov-summa", "Grupo Summa", ["reservas@gruposumma.test"]),
  naranja: proveedor("prov-naranja", "La Bicicleta Naranja", ["info@labicicletanaranja.test"]),
  huentata: proveedor("prov-huentata", "Huentata", ["ventas@huentata.test"]),
  kahuak: proveedor("prov-kahuak", "KAHUAK", ["reservas@kahuak.test"]),
  milhouse: proveedor("prov-milhouse", "Milhouse Avenue Hostel", ["melina@milhouse.test"]),
  lagares: proveedor("prov-lagares", "Hostel Lagares Mendoza", ["reservas@lagares.test"]),
};
const opciones = conProveedores(leerOpcionesPasajero(readFileSync(ARCHIVO_OPCIONES_PASAJERO, "utf8")), [PR.kahuak]);

const od018 = producto(
  "prod-od018",
  "OD018",
  [
    servicio({ productoId: "prod-od018", tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Milhouse Avenue", bookingSupplier: PR.milhouse }),
    ...(["City Tour", "Bike Tour"] as const).map((nombre, i) =>
      servicio({
        productoId: "prod-od018",
        tipo: "excursion",
        orden: 5,
        prioridad: i + 1,
        descripcion: "Excursion: City Tour / Bike Tour. Booking Supplier: Grupo Summa / La Bicicleta Naranja",
        serviceProviderNombre: nombre,
        bookingSupplier: i === 0 ? PR.summa : PR.naranja,
      }),
    ),
  ],
  { destino: "BUE" },
);

/** Como está en el catálogo: "Booking Booking Supplier" (el nombre limpio queda "… Alta Montaña. Booking"). */
const od019 = producto(
  "prod-od019",
  "OD019",
  [
    servicio({ productoId: "prod-od019", tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Lagares Hostel", bookingSupplier: PR.lagares }),
    servicio({
      productoId: "prod-od019",
      tipo: "excursion",
      orden: 5,
      descripcion: "Excursions: Bodegas half Day and Alta Montaña. Booking Booking Supplier: Huentata",
      bookingSupplier: PR.huentata,
    }),
  ],
  { destino: "MDZ" },
);

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const conReglas = (detalles: Parameters<typeof catalogoCon>[0]): CatalogoParaPedidos => ({
  ...catalogoCon(detalles, [], dias),
  opcionesPasajero: opciones,
  puntosDeEncuentro: puntos,
});

function suelto(prod: typeof od018, pedidosEspeciales: string | null, desde: string, hasta: string, catalogo = conReglas([prod])) {
  const r = reserva({ productoId: prod.id, habitacion: "Hostel Dorm", pedidosEspeciales, fechaInicio: desde, fechaFin: hasta });
  return ok(armarPedidos(r, catalogo, plantilla));
}

const a = (r: ReturnType<typeof ok>, mail: string) => r.pedidos.find((p) => p.destinatarios.includes(mail));
const BIKE = "Choice of tour in Buenos Aires: bike tour";
const RAFTING = "Choice of tour in Mendoza: rafting";
const PUNTO = "Punto de encuentro: Pasaje Giuffra 370, San Telmo (el pasajero va directo)";

describe("las reglas en data/ (fila 5)", () => {
  it("dias-servicio.csv: en OD019 Bodegas el día 1 por la tarde; Alta Montaña y Rafting el día 2", () => {
    const od019Dias = dias.filter((d) => d.codigo === "OD019");
    expect(od019Dias).toEqual([
      { codigo: "OD019", orden: 5, dia: 1, servicio: "Bodegas half Day", momento: "por la tarde (14:30 aprox.)" },
      { codigo: "OD019", orden: 5, dia: 2, servicio: "Alta Montaña" },
      { codigo: "OD019", orden: 5, dia: 2, servicio: "Rafting" },
    ]);
  });

  it("leerDiasServicio lee el formato nuevo y sigue leyendo el de antes", () => {
    const nuevo = "codigo,orden,dia,servicio,momento,nota\nOD019,5,1,Bodegas half Day,por la tarde,\"nota, con coma\"\nOD030,4,3,,,x\n";
    expect(leerDiasServicio(nuevo)).toEqual([
      { codigo: "OD019", orden: 5, dia: 1, servicio: "Bodegas half Day", momento: "por la tarde" },
      { codigo: "OD030", orden: 4, dia: 3 },
    ]);
    expect(leerDiasServicio("codigo,orden,dia,nota\nOD030,4,3,\"el Tatio, día 3\"\n")).toEqual([{ codigo: "OD030", orden: 4, dia: 3 }]);
  });

  it("puntos-de-encuentro.csv: el Bike Tour de OD018 en Pasaje Giuffra 370, San Telmo", () => {
    expect(puntos).toEqual([{ codigo: "OD018", orden: 5, servicio: "Bike Tour", punto: "Pasaje Giuffra 370, San Telmo" }]);
  });

  it("rechaza un archivo de puntos de encuentro mal armado", () => {
    expect(() => leerPuntosDeEncuentro("otra,cosa\n")).toThrow(/primera fila/);
    const cab = "codigo,orden,servicio,punto,nota\n";
    expect(() => leerPuntosDeEncuentro(`${cab}OD018,x,Bike Tour,Calle 1,n\n`)).toThrow(/fila 2/);
    expect(() => leerPuntosDeEncuentro(`${cab}OD018,5,Bike Tour,,n\n`)).toThrow(/fila 2/);
  });
});

describe("Buenos Aires (OD018): el Bike Tour con punto de encuentro (fila 1)", () => {
  it("con bike, el pedido a La Bicicleta Naranja dice el punto de encuentro y no 'Pick up'", () => {
    const naranja = a(suelto(od018, BIKE, "2027-03-18", "2027-03-21"), "info@labicicletanaranja.test")!;
    expect(naranja.cuerpo).toContain(`Excursión: Bike Tour\nFecha: a coordinar (estadía del 18 al 21 mar 2027)\nServicio: regular · Idioma: inglés\n${PUNTO}`);
    expect(naranja.cuerpo).not.toMatch(/Pick up/i);
  });

  it("sin elección, el City Tour sigue con pick up en el hotel", () => {
    const summa = a(suelto(od018, null, "2027-03-18", "2027-03-21"), "reservas@gruposumma.test")!;
    expect(summa.cuerpo).toContain("Pick up y drop off: Milhouse Avenue (Buenos Aires) · hotel a confirmar");
    expect(summa.cuerpo).not.toContain("Punto de encuentro");
  });

  it("el punto de encuentro gana aunque la agencia mande un pick up", () => {
    const catalogo = conReglas([od018]);
    const r = reserva({
      productoId: od018.id,
      habitacion: "Hostel Dorm",
      pedidosEspeciales: BIKE,
      partes: [parte({ id: "p", orden: 1, tipo: "paquete", productoId: od018.id, fechaInicio: "2027-03-18", fechaFin: "2027-03-21", pickUp: "Hotel X" })],
    });
    const naranja = a(ok(armarPedidos(r, catalogo, plantilla)), "info@labicicletanaranja.test")!;
    expect(naranja.cuerpo).toContain(PUNTO);
    expect(naranja.cuerpo).not.toMatch(/Pick up/i);
  });
});

describe("Mendoza (OD019): Bodegas el día 1 (tarde) y el día entero el día 2", () => {
  it("sin elección: a Huentata Bodegas el 22 por la tarde y Alta Montaña el 23 (fila 2)", () => {
    const huentata = a(suelto(od019, null, "2027-03-22", "2027-03-24"), "ventas@huentata.test")!;
    expect(huentata.cuerpo).toContain("1) Excursión: Bodegas half Day\nFecha: 22 mar 2027, por la tarde (14:30 aprox.)\nServicio: regular · Idioma: inglés\nPick up y drop off: Lagares Hostel (Mendoza)");
    expect(huentata.cuerpo).toContain("2) Excursión: Alta Montaña\nFecha: 23 mar 2027\nServicio: regular · Idioma: inglés\nPick up y drop off: Lagares Hostel (Mendoza)");
    expect(huentata.cuerpo).not.toContain("a coordinar");
    expect(huentata.avisos.join("\n")).not.toMatch(/Falta la fecha/);
    expect(huentata.partes.map((p) => p.fecha)).toEqual(["2027-03-22", "2027-03-23"]);
  });

  it("con rafting: Huentata solo Bodegas el día 1 (tarde) y Kahuak el Rafting el día 2 (fila 3)", () => {
    const r = suelto(od019, RAFTING, "2027-03-22", "2027-03-24");
    const huentata = a(r, "ventas@huentata.test")!;
    expect(huentata.cuerpo).toContain("Excursión: Bodegas half Day\nFecha: 22 mar 2027, por la tarde (14:30 aprox.)\n");
    expect(huentata.cuerpo).not.toMatch(/Alta Monta|1\)/);
    const kahuak = a(r, "reservas@kahuak.test")!;
    expect(kahuak.cuerpo).toContain("Excursión: Rafting\nFecha: 23 mar 2027\n");
    expect(kahuak.cuerpo).not.toContain("Bodegas");
  });

  it("sin las reglas de días, como antes: un renglón con la fecha a coordinar", () => {
    const catalogo = { ...conReglas([od019]), dias: [] };
    const huentata = a(suelto(od019, null, "2027-03-22", "2027-03-24", catalogo), "ventas@huentata.test")!;
    expect(huentata.cuerpo).toContain("Excursión: Bodegas half Day and Alta Montaña. Booking\nFecha: a coordinar (estadía del 22 al 24 mar 2027)");
  });

  describe("dentro de BRARCH26: el día se cuenta desde el inicio de Mendoza (fila 4)", () => {
    const brarch26 = producto("prod-brarch26", "BRARCH26", [], {
      esTour: true,
      componentes: [componente("comp-od018", 3, 9, 3, od018), componente("comp-od019", 4, 13, 2, od019)],
    });
    const reservaTour = (pedidosEspeciales: string | null) =>
      reserva({
        agencia: "Adventure360",
        productoId: brarch26.id,
        habitacion: "Hostel Dorm",
        pedidosEspeciales,
        fechaInicio: "2027-03-10",
        fechaFin: "2027-03-25",
        partes: [
          parte({ id: "p-bue", orden: 3, tipo: "paquete", productoId: od018.id, productoComponenteId: "comp-od018", fechaInicio: "2027-03-18", fechaFin: "2027-03-21" }),
          parte({ id: "p-mdz", orden: 4, tipo: "paquete", productoId: od019.id, productoComponenteId: "comp-od019", fechaInicio: "2027-03-22", fechaFin: "2027-03-24" }),
        ],
      });
    const catalogo = conReglas([brarch26, od018, od019]);

    it("bike + rafting: punto de encuentro en Buenos Aires; Bodegas el 22 (tarde) y Rafting el 23", () => {
      const r = ok(armarPedidos(reservaTour(`${BIKE}\n${RAFTING}`), catalogo, plantilla));
      expect(a(r, "info@labicicletanaranja.test")?.cuerpo).toContain(PUNTO);
      expect(a(r, "ventas@huentata.test")?.cuerpo).toContain("Excursión: Bodegas half Day\nFecha: 22 mar 2027, por la tarde (14:30 aprox.)");
      expect(a(r, "reservas@kahuak.test")?.cuerpo).toContain("Excursión: Rafting\nFecha: 23 mar 2027");
    });

    it("sin elección: City Tour con pick up; Bodegas el 22 (tarde) y Alta Montaña el 23", () => {
      const r = ok(armarPedidos(reservaTour(null), catalogo, plantilla));
      expect(a(r, "reservas@gruposumma.test")?.cuerpo).toContain("Pick up y drop off: Milhouse Avenue (Buenos Aires)");
      const huentata = a(r, "ventas@huentata.test")!.cuerpo;
      expect(huentata).toContain("Excursión: Bodegas half Day\nFecha: 22 mar 2027, por la tarde (14:30 aprox.)");
      expect(huentata).toContain("Excursión: Alta Montaña\nFecha: 23 mar 2027");
      expect(a(r, "reservas@kahuak.test")).toBeUndefined();
    });
  });
});
