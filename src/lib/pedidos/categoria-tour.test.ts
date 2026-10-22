// Spec M3-14 — en los tours, la categoría vendida elige el hotel de cada parte: la equivalencia
// de data/categorias-tour.csv (tour, categoría, componente) si existe; si no, el mismo nivel si el
// componente lo tiene; si no y es Budget Hotel, el Hotel 3* (owner 2026-10-22).
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { cargarCategoriasTour } from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoCon, componente, parte, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { CatalogoParaPedidos, ResultadoArmado } from "./tipos";
import type { ComponenteTour, DetalleProducto } from "@/lib/catalogo/tipos";

const plantilla = cargarPlantilla();
const categoriasTour = cargarCategoriasTour();

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const PAQUETE_105 =
  "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata\nIncludes: Transfer in + Out, Excursion Cataratas Argentinas, Excursion Cataratas Brasileras";

const nacionalInn = proveedor("prov-nacional", "Nacional Inn Copacabana", ["reservas@nacionalinn.test"]);
const budgetRio = proveedor("prov-budget-rio", "Budget Rio", ["reservas@budgetrio.test"]);
const kauSiAike = proveedor("prov-kau", "Kau Si Aike", ["reservas@kau.test"]);
const chalten3 = proveedor("prov-ch3", "Hotel 3 Chalten", ["reservas@ch3.test"]);
const budgetMza = proveedor("prov-budget-mza", "Budget Mendoza", ["reservas@budgetmza.test"]);
const mza3 = proveedor("prov-mza3", "Hotel 3 Mendoza", ["reservas@mza3.test"]);

/** OD010A: Hostel y Hotel 3* (sin Budget), y el Paquete 105 Premium de Cuenca del Plata. */
const od010a = producto("prod-od010a", "OD010A", [
  servicio({ productoId: "prod-od010a", tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Beer Hostel", bookingSupplier: P.ajiVerde }),
  servicio({ productoId: "prod-od010a", tipo: "alojamiento", nivel: "Hotel 3*", orden: 2, serviceProviderNombre: "Hotel 3* El Pueblito", bookingSupplier: P.pueblito }),
  servicio({ productoId: "prod-od010a", tipo: "excursion", orden: 4, descripcion: PAQUETE_105, serviceProviderNombre: "Paquete Receptvo 105 Premium", bookingSupplier: P.cuenca }),
], { destino: "IGR" });

/** OD032 (Río): tiene Budget y Hotel 3*; en los tours el archivo dice Budget = Hotel 3*. */
const od032 = producto("prod-od032", "OD032", [
  servicio({ productoId: "prod-od032", tipo: "alojamiento", nivel: "Budget Hotel", orden: 1, serviceProviderNombre: "Budget Rio", bookingSupplier: budgetRio }),
  servicio({ productoId: "prod-od032", tipo: "alojamiento", nivel: "Hotel 3*", orden: 2, serviceProviderNombre: "Nacional Inn Copacabana", bookingSupplier: nacionalInn }),
], { destino: "RIO" });

/** OD028X (Mendoza, inventado): tiene Budget propio y no está en el archivo. */
const od028x = producto("prod-od028x", "OD028X", [
  servicio({ productoId: "prod-od028x", tipo: "alojamiento", nivel: "Budget Hotel", orden: 1, serviceProviderNombre: "Budget Mendoza", bookingSupplier: budgetMza }),
  servicio({ productoId: "prod-od028x", tipo: "alojamiento", nivel: "Hotel 3*", orden: 2, serviceProviderNombre: "Hotel 3 Mendoza", bookingSupplier: mza3 }),
], { destino: "MDZ" });

/** OD033 (El Chaltén): Budget (Kau Si Aike) y Hotel 3*; en ARCH33 el 3* del tour es el Budget. */
const od033 = producto("prod-od033", "OD033", [
  servicio({ productoId: "prod-od033", tipo: "alojamiento", nivel: "Budget Hotel", orden: 1, serviceProviderNombre: "Kau Si Aike", bookingSupplier: kauSiAike }),
  servicio({ productoId: "prod-od033", tipo: "alojamiento", nivel: "Hotel 3*", orden: 2, serviceProviderNombre: "Hotel 3 Chalten", bookingSupplier: chalten3 }),
], { destino: "FTE" });

function tourCon(codigo: string, paquetes: DetalleProducto[]): { tour: DetalleProducto; comps: ComponenteTour[] } {
  const comps = paquetes.map((p, i) => componente(`comp-${codigo}-${p.codigo}`, i + 1, 1 + i * 3, 3, p));
  return { tour: producto(`prod-${codigo.toLowerCase()}`, codigo, [], { esTour: true, componentes: comps }), comps };
}

const dia = (n: number) => `2027-03-${String(n).padStart(2, "0")}`;

function armarTour(codigo: string, paquetes: DetalleProducto[], habitacion: string, catalogoExtra: Partial<CatalogoParaPedidos> = { categoriasTour }) {
  const { tour, comps } = tourCon(codigo, paquetes);
  const partes = comps.map((c, i) =>
    parte({ id: `p${i + 1}`, orden: i + 1, tipo: "paquete", productoId: c.producto!.id, productoComponenteId: c.id, fechaInicio: dia(1 + i * 3), fechaFin: dia(4 + i * 3) }),
  );
  const r = reserva({ productoId: tour.id, fechaInicio: dia(1), fechaFin: dia(1 + paquetes.length * 3), habitacion, partes });
  return ok(armarPedidos(r, { ...catalogoCon([tour, ...paquetes]), ...catalogoExtra }, plantilla));
}

const sinElegir = (r: ReturnType<typeof ok>) => r.tareas.filter((t) => t.texto.startsWith("Elegir el hotel"));
const pedidoA = (r: ReturnType<typeof ok>, id: string) => r.pedidos.filter((p) => p.proveedores.some((x) => x.id === id));
const renglon = (cuerpo: string, empieza: string) => cuerpo.split("\n").find((l) => l.startsWith(empieza)) ?? "";

describe("M3-14 — la categoría del tour elige el hotel de cada parte", () => {
  it("el archivo de verdad se lee (BRARCH26 Budget → OD010A Hotel 3*)", () => {
    expect(categoriasTour).toContainEqual({ tour: "BRARCH26", categoriaTour: "Budget Hotel", componente: "OD010A", categoriaPaquete: "Hotel 3*" });
  });

  it("1. BRARCH26 'Budget Hotel': OD010A pide El Pueblito, OD032 Nacional Inn, un componente con Budget propio pide su Budget", () => {
    const r = armarTour("BRARCH26", [od010a, od032, od028x], "Double Room - Budget Hotel");
    expect(sinElegir(r)).toEqual([]);
    expect(pedidoA(r, P.pueblito.id)).toHaveLength(1);
    expect(pedidoA(r, nacionalInn.id)).toHaveLength(1);
    expect(pedidoA(r, budgetRio.id)).toHaveLength(0);
    expect(pedidoA(r, budgetMza.id)).toHaveLength(1);
    expect(pedidoA(r, mza3.id)).toHaveLength(0);
  });

  it("1b. sin el archivo, la regla general: Budget → Hotel 3* donde el componente no tiene Budget", () => {
    const r = armarTour("ZZTOUR", [od010a, od032], "Double Room - Budget Hotel", {});
    expect(sinElegir(r)).toEqual([]);
    expect(pedidoA(r, P.pueblito.id)).toHaveLength(1);
    // OD032 tiene Budget propio y no hay archivo: su Budget.
    expect(pedidoA(r, budgetRio.id)).toHaveLength(1);
  });

  it("2. el pedido a Cuenca del Plata de BRARCH26 Budget dice El Pueblito (no 'alojamiento a confirmar')", () => {
    const r = armarTour("BRARCH26", [od010a, od032], "Double Room - Budget Hotel");
    const c = r.pedidos.find((p) => p.cuerpo.includes("TRF IN"))!.cuerpo;
    expect(renglon(c, "TRF IN")).toContain("Drop off: Hotel 3* El Pueblito (Iguazú) · hotel a confirmar");
    expect(c).not.toContain("alojamiento a confirmar");
  });

  it("3. ARCH33 'Hotel 3*': en El Chaltén pide el Budget del paquete (Kau Si Aike), sin tarea", () => {
    const r = armarTour("ARCH33", [od033], "Double Room - Hotel 3*");
    expect(sinElegir(r)).toEqual([]);
    expect(pedidoA(r, kauSiAike.id)).toHaveLength(1);
    expect(pedidoA(r, chalten3.id)).toHaveLength(0);
  });

  it("3b. tour de adentro (5C01 → CHB31 → OD030): Budget → Hotel in SPA → Hotel 3*", () => {
    const id = "prod-od030x";
    const don = proveedor("prov-don", "Don Raul", ["reservas@donraul.test"]);
    const otro = proveedor("prov-otro", "Otro Hostel", ["reservas@otro.test"]);
    const od030 = producto(id, "OD030", [
      servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Otro Hostel", bookingSupplier: otro }),
      servicio({ productoId: id, tipo: "alojamiento", nivel: "Hotel 3*", orden: 2, serviceProviderNombre: "Don Raul", bookingSupplier: don }),
    ], { destino: "UYU" });
    const compOd030 = componente("comp-chb31-od030", 1, 1, 2, od030);
    const chb31 = producto("prod-chb31x", "CHB31", [], { esTour: true, componentes: [compOd030] });
    const compChb31: ComponenteTour = { ...componente("comp-5c01-chb31", 1, 1, 2, chb31), producto: chb31 };
    const tour = producto("prod-5c01", "5C01", [], { esTour: true, componentes: [compChb31] });
    const r = ok(
      armarPedidos(
        reserva({
          productoId: tour.id, fechaInicio: "2027-03-01", fechaFin: "2027-03-03", habitacion: "Double Room - Budget Hotel",
          partes: [parte({ id: "p1", orden: 1, tipo: "paquete", productoId: id, productoComponenteId: compOd030.id, fechaInicio: "2027-03-01", fechaFin: "2027-03-03" })],
        }),
        { ...catalogoCon([tour, od030]), categoriasTour },
        plantilla,
      ),
    );
    expect(sinElegir(r)).toEqual([]);
    expect(pedidoA(r, don.id)).toHaveLength(1);
  });

  it("4. un paquete suelto no cambia: 'Budget Hotel' sin Budget en el paquete sigue pidiendo elegir", () => {
    const r = ok(
      armarPedidos(
        reserva({ productoId: od010a.id, fechaInicio: "2027-03-01", fechaFin: "2027-03-04", habitacion: "Double Room - Budget Hotel" }),
        { ...catalogoCon([od010a]), categoriasTour },
        plantilla,
      ),
    );
    expect(sinElegir(r)).toHaveLength(1);
  });
});
