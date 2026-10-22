/**
 * M3-13 fila 4: las opciones del pasajero como regla de datos (`data/opciones-pasajero.csv`,
 * owner 2026-10-22). En Buenos Aires (OD018), "bike" → el Bike Tour (La Bicicleta Naranja) en
 * lugar del City Tour; en Mendoza (OD019), "rafting" → a Huentata solo Bodegas (sin Alta Montaña)
 * y a Kahuak el rafting. Sin elección, como hoy. Vale suelto o dentro de un tour (BRARCH26).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { ARCHIVO_OPCIONES_PASAJERO, conProveedores, leerOpcionesPasajero } from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { catalogoCon, componente, parte, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { CatalogoParaPedidos, OpcionDelPasajero, ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const reglasDelArchivo = leerOpcionesPasajero(readFileSync(ARCHIVO_OPCIONES_PASAJERO, "utf8"));

const PR = {
  summa: proveedor("prov-summa", "Grupo Summa", ["reservas@gruposumma.test"]),
  naranja: proveedor("prov-naranja", "La Bicicleta Naranja", ["info@labicicletanaranja.test"]),
  huentata: proveedor("prov-huentata", "Huentata", ["ventas@huentata.test"]),
  kahuak: proveedor("prov-kahuak", "KAHUAK", ["reservas@kahuak.test", "agencias@kahuak.test"]),
  milhouse: proveedor("prov-milhouse", "Milhouse Avenue Hostel", ["melina@milhouse.test"]),
  lagares: proveedor("prov-lagares", "Hostel Lagares Mendoza", ["reservas@lagares.test"]),
};

/** Las reglas del archivo con el proveedor del directorio (lo que hace `cargar.ts` con la base). */
const reglas = conProveedores(reglasDelArchivo, [PR.kahuak]);

const od018 = producto(
  "prod-od018",
  "OD018",
  [
    servicio({ productoId: "prod-od018", tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Milhouse Avenue", bookingSupplier: PR.milhouse }),
    servicio({
      productoId: "prod-od018",
      tipo: "excursion",
      orden: 5,
      prioridad: 1,
      descripcion: "Excursion: City Tour / Bike Tour. Booking Supplier: Grupo Summa / La Bicicleta Naranja",
      serviceProviderNombre: "City Tour",
      bookingSupplier: PR.summa,
    }),
    servicio({
      productoId: "prod-od018",
      tipo: "excursion",
      orden: 5,
      prioridad: 2,
      descripcion: "Excursion: City Tour / Bike Tour. Booking Supplier: Grupo Summa / La Bicicleta Naranja",
      serviceProviderNombre: "Bike Tour",
      bookingSupplier: PR.naranja,
    }),
  ],
  { destino: "BUE" },
);

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
      serviceProviderNombre: "Bodegas half Day and Alta Montaña",
      bookingSupplier: PR.huentata,
    }),
  ],
  { destino: "MDZ" },
);

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

function suelto(prod: typeof od018, pedidosEspeciales: string | null, conReglas: readonly OpcionDelPasajero[] = reglas) {
  const catalogo: CatalogoParaPedidos = { ...catalogoCon([prod]), opcionesPasajero: conReglas };
  const r = reserva({ productoId: prod.id, habitacion: "Hostel Dorm", pedidosEspeciales, fechaInicio: "2027-03-18", fechaFin: "2027-03-20" });
  return ok(armarPedidos(r, catalogo, plantilla));
}

const a = (r: ReturnType<typeof ok>, mail: string) => r.pedidos.find((p) => p.destinatarios.includes(mail));
const BIKE = "Choice of tour in Buenos Aires: bike tour";
const RAFTING = "Choice of tour in Mendoza: rafting";

describe("data/opciones-pasajero.csv (fila 4)", () => {
  it("trae las reglas de Buenos Aires (bike) y Mendoza (rafting), con Kahuak para el rafting", () => {
    expect(reglasDelArchivo).toEqual([
      { codigo: "OD018", orden: 5, eleccion: "bike", accion: "elegir", servicio: "Bike Tour", proveedor: null },
      { codigo: "OD019", orden: 5, eleccion: "rafting", accion: "renombrar", servicio: "Bodegas half Day", proveedor: null },
      { codigo: "OD019", orden: 5, eleccion: "rafting", accion: "agregar", servicio: "Rafting", proveedor: "Kahuak" },
    ]);
  });

  it("rechaza un archivo mal armado", () => {
    expect(() => leerOpcionesPasajero("otra,cosa\n")).toThrow(/primera fila/);
    const cab = "codigo,orden,eleccion,accion,servicio,proveedor,nota\n";
    expect(() => leerOpcionesPasajero(`${cab}OD018,x,bike,elegir,Bike Tour,,n\n`)).toThrow(/fila 2/);
    expect(() => leerOpcionesPasajero(`${cab}OD018,5,bike,borrar,Bike Tour,,n\n`)).toThrow(/fila 2/);
    expect(() => leerOpcionesPasajero(`${cab}OD019,5,rafting,agregar,Rafting,,n\n`)).toThrow(/fila 2.*proveedor/);
  });

  it("el proveedor se busca en el directorio sin mayúsculas ni acentos (KAHUAK)", () => {
    const [, , rafting] = reglas;
    expect(rafting.proveedorDelDirectorio?.id).toBe("prov-kahuak");
    expect(conProveedores(reglasDelArchivo, [])[2].proveedorDelDirectorio).toBeNull();
  });
});

describe("armarPedidos — Buenos Aires (OD018): bike tour", () => {
  it("con 'bike' el pedido va a La Bicicleta Naranja como Bike Tour, y nada de City Tour a Grupo Summa", () => {
    const r = suelto(od018, BIKE);
    const naranja = a(r, "info@labicicletanaranja.test");
    expect(naranja?.cuerpo).toContain("Excursión: Bike Tour");
    expect(naranja?.cuerpo).not.toContain("City Tour");
    expect(a(r, "reservas@gruposumma.test")).toBeUndefined();
    expect(naranja?.avisos.join("\n")).toContain("Bike Tour: lo eligió el pasajero (otras: City Tour).");
  });

  it("sin elección (o con city tour) va el City Tour a Grupo Summa, como hoy", () => {
    for (const pedidos of [null, "Choice of tour in Buenos Aires: city tour"]) {
      const r = suelto(od018, pedidos);
      expect(a(r, "reservas@gruposumma.test")?.cuerpo, String(pedidos)).toContain("Excursión: City Tour / Bike Tour");
      expect(a(r, "info@labicicletanaranja.test"), String(pedidos)).toBeUndefined();
    }
  });

  it("sin reglas cargadas, todo como antes aunque diga bike", () => {
    const r = suelto(od018, BIKE, []);
    expect(a(r, "reservas@gruposumma.test")).toBeDefined();
    expect(a(r, "info@labicicletanaranja.test")).toBeUndefined();
  });
});

describe("armarPedidos — Mendoza (OD019): rafting", () => {
  it("con 'rafting' a Huentata solo Bodegas (sin Alta Montaña) y a Kahuak el Rafting, con la fecha de la estadía", () => {
    const r = suelto(od019, RAFTING);
    const huentata = a(r, "ventas@huentata.test")!;
    expect(huentata.cuerpo).toContain("Excursión: Bodegas half Day");
    expect(huentata.cuerpo).not.toMatch(/Alta Monta/);
    const kahuak = a(r, "reservas@kahuak.test")!;
    expect(kahuak.destinatarios).toEqual(["reservas@kahuak.test", "agencias@kahuak.test"]);
    expect(kahuak.proveedores).toEqual([{ id: "prov-kahuak", nombre: "KAHUAK" }]);
    expect(kahuak.cuerpo).toContain("Excursión: Rafting");
    expect(kahuak.cuerpo).toContain("Fecha: a coordinar (estadía del 18 al 20 mar 2027)");
    expect(kahuak.cuerpo).toContain("Pick up y drop off: Lagares Hostel (Mendoza) · hotel a confirmar");
    expect(kahuak.cuerpo).not.toContain("Bodegas");
  });

  it("sin elección, Huentata con Bodegas y Alta Montaña y nada a Kahuak, como hoy", () => {
    const r = suelto(od019, null);
    expect(a(r, "ventas@huentata.test")?.cuerpo).toContain("Alta Montaña");
    expect(a(r, "reservas@kahuak.test")).toBeUndefined();
  });

  it("si Kahuak no está en el directorio, el rafting queda como tarea para pedir a mano", () => {
    const r = suelto(od019, RAFTING, conProveedores(reglasDelArchivo, []));
    expect(a(r, "ventas@huentata.test")?.cuerpo).toContain("Excursión: Bodegas half Day");
    const tarea = r.tareas.find((t) => t.texto.includes("Rafting"));
    expect(tarea?.tipo).toBe("revisar");
    expect(tarea?.texto).toBe("Pedir a mano: Rafting (OD019): el pasajero eligió rafting, pero Kahuak no está en el directorio de proveedores.");
  });
});

describe("armarPedidos — dentro de BRARCH26: bike + rafting", () => {
  const brarch26 = producto("prod-brarch26", "BRARCH26", [], {
    esTour: true,
    componentes: [componente("comp-od018", 3, 9, 3, od018), componente("comp-od019", 4, 13, 2, od019)],
  });
  const catalogo: CatalogoParaPedidos = { ...catalogoCon([brarch26, od018, od019]), opcionesPasajero: reglas };
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

  it("bike → La Bicicleta Naranja; rafting → Huentata solo Bodegas y Kahuak con el rafting", () => {
    const r = ok(armarPedidos(reservaTour(`${BIKE}\n${RAFTING}`), catalogo, plantilla));
    expect(a(r, "info@labicicletanaranja.test")?.cuerpo).toContain("Excursión: Bike Tour");
    expect(a(r, "reservas@gruposumma.test")).toBeUndefined();
    expect(a(r, "ventas@huentata.test")?.cuerpo).toContain("Excursión: Bodegas half Day");
    expect(a(r, "ventas@huentata.test")?.cuerpo).not.toMatch(/Alta Monta/);
    expect(a(r, "reservas@kahuak.test")?.cuerpo).toContain("Excursión: Rafting");
    expect(a(r, "reservas@kahuak.test")?.cuerpo).toContain("estadía del 22 al 24 mar 2027");
  });

  it("sin elección, como hoy: City Tour a Grupo Summa y Huentata con Alta Montaña", () => {
    const r = ok(armarPedidos(reservaTour(null), catalogo, plantilla));
    expect(a(r, "reservas@gruposumma.test")).toBeDefined();
    expect(a(r, "info@labicicletanaranja.test")).toBeUndefined();
    expect(a(r, "ventas@huentata.test")?.cuerpo).toContain("Alta Montaña");
    expect(a(r, "reservas@kahuak.test")).toBeUndefined();
  });
});
