import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { agruparProveedores, leerHojaContactos } from "@/lib/importador-proveedores/hoja";
import { leerFilasDelExcel } from "@/lib/importador-proveedores/importar";
import { resolverProveedor as resolverContacto } from "@/lib/importador-proveedores/resolver";
import { BLOQUES_SIN_SECCION_2, ubicarBloquesEnHoja } from "@/lib/importador-productos/bloque";
import { diagnosticarPaquetes } from "@/lib/importador-productos/diagnostico";
import { parsearEquivalencias, resolverEquivalencias } from "@/lib/importador-productos/equivalencias";
import { leerFilasPaquetes } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { planificarBloques } from "@/lib/importador-productos/plan";
import { armarFilasServicio, crearIndiceProveedores, resolverProveedor } from "@/lib/importador-productos/proveedores";
import { parsearRenglonesAgregados } from "@/lib/importador-productos/renglones-agregados";
import { armarPedidos } from "@/lib/pedidos/armar";
import { ARCHIVO_DIAS, ARCHIVO_HOSTEL_SEGUN_HABITACION, cargarAlojamientosSinDesayuno, leerCiudadesPortugues, leerDiasServicio, leerHostelSegunHabitacion } from "@/lib/pedidos/cargar";
import { catalogoCon, parte, producto, proveedor, reserva, servicio } from "@/lib/pedidos/fixtures.test-utils";
import { sinDesayuno } from "@/lib/pedidos/formato";
import { idiomaDeLaCiudad } from "@/lib/pedidos/idioma";
import { cargarPlantilla } from "@/lib/pedidos/plantilla";
import type { CatalogoParaPedidos, ResultadoArmado } from "@/lib/pedidos/tipos";
import { leerCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { armarTour, rutasDeServicios, type PaqueteConocido } from "./armado";
import { nombreDestino, primeraCiudad } from "./ciudades";
import { TOURS_PILOTO } from "./importar";
import { hayInsumosTours, leerInsumosTours } from "./insumos";
import { nochesBasePaquete } from "./noches-base";
import { leerTourRutas } from "./rutas";
import { ajustesDeTraslados, parsearTrasladosTour, type ServicioDePaquete } from "./traslados";
import { leerItinerario } from "./word";

// Spec M3-48: BR03 y BR04 con el Excel y el Word reales de Insumos/ (no están en Git).

const RAIZ = process.cwd();
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");
const RUTA_PROVEEDORES = resolve(RAIZ, "Insumos/Proveedores Hi Travel 2026 para IA.xlsx");
const HAY_EXCEL = existsSync(RUTA_PAQUETES);

const COMPBR02 = { codigo: "COMPBR02", destino: "PRY" };
const COMPBR11 = { codigo: "COMPBR11", destino: "ILH" };

const vacio = { data: [], error: null };
const consulta = { select: () => ({ range: async () => vacio }) };

async function diagnostico(paquetes: Array<{ codigo: string; destino: string }>) {
  return diagnosticarPaquetes({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- base en memoria, sin directorio
    admin: { from: () => consulta } as any,
    filas: leerFilasPaquetes(RUTA_PAQUETES),
    archivo: "paquetes.xls",
    paquetes,
    nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
  });
}

describe("M3-48 punto 1 — COMPBR02 y COMPBR11, con destino y nivel en todas sus líneas de alojamiento", () => {
  it("están en data/paquetes-piloto.csv con su destino", () => {
    expect(parsearPaquetesPiloto(dato("paquetes-piloto.csv"))).toEqual(expect.arrayContaining([COMPBR02, COMPBR11]));
  });

  it.each([
    ["Paraty", "PRY", "Paraty"],
    ["Ilha Grande", "ILH", "Ilha Grande"],
  ])("%s → %s", (texto, destino, nombre) => {
    expect(primeraCiudad(texto)).toBe(destino);
    expect(nombreDestino(destino)).toBe(nombre);
  });

  it("el Word de BR03 ya dice en qué destino es cada estadía", () => {
    const w = leerItinerario(["BR03 Rio (8 nights)", "Included", "-2 Nights accommodation in Paraty at selected Room", "-3 Nights accommodation in Ilha Grande at selected Room"], "BR03")!;
    expect(w.items).toMatchObject([
      { tipo: "estadia", noches: 2, destino: "PRY" },
      { tipo: "estadia", noches: 3, destino: "ILH" },
    ]);
  });

  it.skipIf(!HAY_EXCEL)("el diagnóstico los encuentra con Hostel y Hotel 3*, también las filas 1722 y 1728", async () => {
    const d = await diagnostico([COMPBR02, COMPBR11]);
    for (const codigo of ["COMPBR02", "COMPBR11"]) {
      const p = d.paquetes.find((x) => x.codigo === codigo)!;
      expect(p.encontrado, codigo).toBe(true);
      expect(p.bloqueNoCalza, codigo).toBe(false);
      const niveles = [...new Set(p.servicios.filter((s) => s.tipo === "alojamiento").map((s) => s.nivel))].sort();
      expect(niveles, codigo).toEqual(["Hostel", "Hotel 3*"]);
    }
  });
});

describe.skipIf(!HAY_EXCEL)("M3-48 punto 2 — los bloques se leen sin IA", () => {
  it("COMPBR02 tiene su sección 2: no entra en la lista de bloques sin sección 2", () => {
    expect(BLOQUES_SIN_SECCION_2.has("COMPBR02")).toBe(false);
  });

  it("ninguna fila pide IA ni queda para revisar (ni el 'BRL 100' de la fila 1736), y COMPBR02 termina en su título de la fila 1738", async () => {
    const filas = leerFilasPaquetes(RUTA_PAQUETES);
    const { ubicados, noUbicados } = ubicarBloquesEnHoja(filas, [COMPBR02, COMPBR11]);
    expect(noUbicados).toEqual([]);
    const interpretarIA = vi.fn(async () => null);
    const plan = await planificarBloques({
      filas,
      bloques: ubicados.map((u) => ({ bloque: u.bloque, rango: u.rango })),
      interpretarIA,
      nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
      renglonesAgregados: parsearRenglonesAgregados(dato("renglones-agregados.csv")),
    });
    expect(interpretarIA).not.toHaveBeenCalled();
    expect(plan.bloquesQueNecesitanIA).toEqual([]);
    for (const p of plan.productos) {
      expect(p.lineasParaRevisar, p.codigo).toEqual([]);
      expect(p.bloqueParaRevisar, p.codigo).toBe(false);
      expect(p.nivelesParaRevisar, p.codigo).toEqual([]);
    }
    const paraty = plan.productos.find((p) => p.codigo === "COMPBR02")!;
    expect(paraty.servicios.map((s) => s.fila)).toEqual([1722, 1728, 1734, 1735]);
    expect(paraty.servicios.map((s) => s.tipo)).toEqual(["alojamiento", "alojamiento", "traslado", "excursion"]);
  });
});

describe("M3-48 punto 3 — el orden de los hostels", () => {
  const reglas = leerHostelSegunHabitacion(readFileSync(resolve(RAIZ, ARCHIVO_HOSTEL_SEGUN_HABITACION), "utf-8"));
  const plantilla = cargarPlantilla();

  function ok(r: ResultadoArmado) {
    if (!r.ok) throw new Error(r.error);
    return r;
  }

  /** La línea de Paraty tal como la trae el Excel (Agatha antes que Casa Viva), los cuatro con contacto. */
  function paratyEnElOrdenDelExcel() {
    const id = "prod-COMPBR02";
    const nombres = ["Che Lagarto", "Casa do Rio", "Agatha", "Casa Viva"];
    return producto(
      id,
      "COMPBR02",
      nombres.map((n, i) =>
        servicio({
          productoId: id,
          tipo: "alojamiento",
          nivel: "Hostel",
          orden: 1,
          prioridad: i + 1,
          serviceProviderNombre: n,
          bookingSupplier: proveedor(`prov-${i}`, n, [`${i}@hostel.test`]),
        }),
      ),
      { destino: "PRY" },
    );
  }

  function armar(habitacion: string | null) {
    const prod = paratyEnElOrdenDelExcel();
    const catalogo: CatalogoParaPedidos = { ...catalogoCon([prod]), hostelSegunHabitacion: reglas };
    return ok(armarPedidos(reserva({ productoId: prod.id, habitacion, fechaInicio: "2027-06-01", fechaFin: "2027-06-03" }), catalogo, plantilla));
  }

  it("Paraty, con dorm o privada: Che Lagarto → Casa do Rio → Casa Viva → Agatha (no el orden del Excel)", () => {
    for (const habitacion of ["dorm", "privada"]) {
      expect(reglas.find((r) => r.destino === "PRY" && r.habitacion === habitacion)?.orden, habitacion).toEqual(["Che Lagarto", "Casa do Rio", "Casa Viva", "Agatha"]);
    }
  });

  it.each(["Dormitory - Hostel", "Single Room - Hostel"])("%s: el primero es Che Lagarto y los demás quedan como alternativa, en el orden del owner", (habitacion) => {
    const r = armar(habitacion);
    expect(r.pedidos.map((p) => p.destinatarios.join())).toEqual(["0@hostel.test"]);
    expect(r.pedidos[0].avisos.join(" ")).toContain("otras: Casa do Rio, Casa Viva, Agatha");
  });

  it.skipIf(!HAY_EXCEL)("Ilha Grande: el Excel ya dice Holandes Hostel → Che Lagarto Ilha Grande, y no hace falta regla", () => {
    const filas = leerFilasPaquetes(RUTA_PAQUETES);
    const { ubicados } = ubicarBloquesEnHoja(filas, [COMPBR11]);
    expect(reglas.some((r) => r.destino === "ILH")).toBe(false);
    return planificarBloques({
      filas,
      bloques: ubicados.map((u) => ({ bloque: u.bloque, rango: u.rango })),
      interpretarIA: null,
      nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
      renglonesAgregados: [],
    }).then(({ productos }) => {
      expect(productos[0].servicios[0].opciones).toEqual([
        { prioridad: 1, serviceProvider: "Holandes Hostel", bookingSupplier: "Holandes Hostel" },
        { prioridad: 2, serviceProvider: "Che Lagarto Ilha Grande", bookingSupplier: "Che Lagarto" },
      ]);
    });
  });
});

describe("M3-48 punto 4 — Che Lagarto como tarea, sin pedido", () => {
  it("una línea con reserva a mano da 'Reservar a mano en Che Lagarto' con su fecha, y ningún pedido", () => {
    const id = "prod-COMPBR02";
    const prod = producto(
      id,
      "COMPBR02",
      [servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, prioridad: 1, serviceProviderNombre: "Che Lagarto", bookingSupplierNombre: "Che Lagarto", bookingSupplier: null, reservaManual: true })],
      { destino: "PRY" },
    );
    const r = armarPedidos(reserva({ productoId: id, habitacion: "Dormitory - Hostel", fechaInicio: "2027-06-01", fechaFin: "2027-06-03" }), catalogoCon([prod]), cargarPlantilla());
    if (!r.ok) throw new Error(r.error);
    expect(r.pedidos).toEqual([]);
    expect(r.tareas.map((t) => [t.tipo, t.texto])).toEqual([
      ["reservar_a_mano", expect.stringMatching(/^Reservar a mano en Che Lagarto: Che Lagarto \(.*\), IN 1 jun 2027, OUT 3 jun 2027$/)],
    ]);
  });

  it("Che Lagarto está marcado manual en Paraty y en Ilha Grande, con la nota del owner", () => {
    const plataforma = parsearEquivalencias(dato("equivalencias-proveedores.csv")).filter((f) => f.alias_normalizado === "plataforma10" && f.modo === "manual");
    expect(plataforma.map((f) => f.destino)).toEqual(expect.arrayContaining(["CHAP", "IGR", "PRY", "SAO", "SSA"]));
    const manuales = parsearEquivalencias(dato("equivalencias-proveedores.csv")).filter((f) => f.alias_normalizado === "che lagarto");
    expect(manuales.map((f) => [f.destino, f.modo, f.estado]).sort()).toEqual([
      ["ILH", "manual", "confirmado"],
      ["PRY", "manual", "confirmado"],
    ]);
  });
});

describe.skipIf(!HAY_EXCEL || !existsSync(RUTA_PROVEEDORES))("M3-48 punto 5 — los nombres del Excel llegan a su proveedor", () => {
  async function directorio() {
    const grupos = agruparProveedores(leerHojaContactos(leerFilasDelExcel(RUTA_PROVEEDORES)));
    return Promise.all(grupos.map((g, i) => resolverContacto(g, null).then((r) => ({ ...r.registro, id: `p${i}` }))));
  }

  async function indiceReal() {
    const registros = await directorio();
    const alias = resolverEquivalencias(parsearEquivalencias(dato("equivalencias-proveedores.csv")), registros);
    return { registros, indice: crearIndiceProveedores(registros, alias) };
  }

  it.each([
    ["Pousada do Corsario Paraty", "PRY", "Pousada Corsario", "reservasparaty@pousadacorsario.com.br", null],
    ["Agatha", "PRY", "Hostel Agatha", null, "whatsapp"],
    ["Casa do Rio", "PRY", "Casa do Rio", "casadoriohostel@gmail.com", null],
    ["Casa Viva", "PRY", "Casa Viva", null, "whatsapp"],
    ["Paraty Tours", "PRY", "PARATY TOURS (Transfer regular Rio (alojamiento hoteles zona sur) - Angra - Ilha Grande / Ilha Grande - Angra - Paraty / Paraty - Rio de Janeiro (alojamiento hoteles zona sur)", "reservas@paratytours.com.br", null],
    ["Holandes Hostel", "ILH", "Holandes Hostel", "reservas@holandeshostel.com.br", null],
    ["Pousada Aquarela do Mar", "ILH", "Pousada Aquarela do Mar", "reservas@aquareladomar.com", null],
    ["Pousada Rubi", "ILH", "Pousada rubi", "rubipousada.ig@gmail.com", null],
  ])("%s (%s) → %s", async (nombre, destino, enDirectorio, mail, canal) => {
    const { registros, indice } = await indiceReal();
    const r = resolverProveedor(nombre, indice, { destino });
    const p = registros.find((x) => x.id === r.id);
    expect(p?.nombre).toBe(enDirectorio);
    expect(r.paraRevisar).toBe(false);
    if (mail) expect(p?.mails).toContain(mail);
    if (canal) expect(p?.canal).toBe(canal);
    if (destino === "ILH") expect(p?.ciudad).toBe("ILHA GRANDE");
  });

  it("los dos bloques quedan sin ningún proveedor sin resolver; Che Lagarto es a mano", async () => {
    const { indice } = await indiceReal();
    const filas = leerFilasPaquetes(RUTA_PAQUETES);
    const { ubicados } = ubicarBloquesEnHoja(filas, [COMPBR02, COMPBR11]);
    const { productos } = await planificarBloques({
      filas,
      bloques: ubicados.map((u) => ({ bloque: u.bloque, rango: u.rango })),
      interpretarIA: null,
      nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
      renglonesAgregados: [],
    });
    for (const p of productos) {
      const lineas = armarFilasServicio(p.servicios, indice, p.codigo === "COMPBR02" ? "PRY" : "ILH");
      expect(lineas.filter((l) => l.proveedor_sin_resolver).map((l) => l.booking_supplier_nombre), p.codigo).toEqual([]);
      expect(lineas.filter((l) => l.reserva_manual).map((l) => l.service_provider_nombre), p.codigo).toEqual(
        p.codigo === "COMPBR02" ? ["Che Lagarto"] : ["Che Lagarto Ilha Grande"],
      );
    }
  });
});

describe("M3-48 punto 6 — el desayuno de los hostels (owner, 2026-11-03)", () => {
  const lista = cargarAlojamientosSinDesayuno(RAIZ);

  it.each(["Casa do Rio", "Casa Viva", "Hostel Agatha", "Agatha"])("%s no ofrece desayuno", (nombre) => {
    expect(sinDesayuno(nombre, lista)).toBe(true);
  });

  it.each(["Che Lagarto", "Che Lagarto Ilha Grande", "Holandes Hostel", "Pousada do Corsario Paraty", "Pousada Aquarela do Mar", "Pousada Rubi"])("%s sigue con desayuno", (nombre) => {
    expect(sinDesayuno(nombre, lista)).toBe(false);
  });

  it("son esos tres, con la nota del owner, y nada más", () => {
    const filas = lista.filter((f) => /M3-48/.test(f.nota ?? ""));
    expect(filas.map((f) => f.alojamiento).sort()).toEqual(["Casa Viva", "Casa do Rio", "Hostel Agatha"]);
    for (const f of filas) expect(f.nota).toContain("Owner 2026-11-03 (M3-48)");
  });
});

describe("M3-48 punto 7 — los tramos", () => {
  const traslado = "Transfer Rio de Janeiro - Paraty - Ilha Grande. Booking Supplier: Paraty Tours";

  function servicioDe(orden: number, descripcion: string, sentido: ServicioDePaquete["sentido"]): ServicioDePaquete {
    return { orden, prioridad: 1, tipo: "traslado", serviceProviderNombre: descripcion.split(".")[0].replace("Transfer ", ""), descripcion, sentido };
  }

  const excepciones = parsearTrasladosTour(dato("traslados-tour.csv"));

  it("la ruta del transfer de COMPBR02 es Río – Ilha Grande", () => {
    expect(rutasDeServicios([traslado])).toEqual([{ desde: "RIO", hasta: "ILH", texto: traslado }]);
  });

  it("BR03: el transfer de COMPBR02 no se pide (van sus tres tramos, con su día), y Río conserva la llegada", () => {
    const ajustes = ajustesDeTraslados({
      tour: "BR03",
      secuencia: [
        { codigo: "OD032", destino: "RIO" },
        COMPBR02,
        COMPBR11,
      ],
      servicios: new Map([
        ["OD032", [servicioDe(3, "Transfer GIG - Accommodation in Rio. Booking Supplier: Buzios Transfers / Alex", "llegada")]],
        ["COMPBR02", [servicioDe(3, traslado, "sin_sentido")]],
      ]),
      excepciones,
    });
    expect(ajustes.map((a) => [a.paquete, a.accion, a.origen])).toEqual([["COMPBR02", "anular", "excepcion"]]);
  });

  it("BR04: el transfer de COMPBR02 tampoco, y el de Río es la salida al aeropuerto (como ARBR23)", () => {
    const ajustes = ajustesDeTraslados({
      tour: "BR04",
      secuencia: [
        { codigo: "OD010B", destino: "IGR" },
        { codigo: "COMPBR10", destino: "SAO" },
        COMPBR02,
        COMPBR11,
        { codigo: "OD032", destino: "RIO" },
      ],
      servicios: new Map([
        ["OD010B", [{ orden: 5, prioridad: 1, tipo: "excursion", serviceProviderNombre: "Paquete Receptvo 105 Premium x Foz", descripcion: "Excursion: Paquete Receptvo 105 Premium x Foz. Booking Supplier: Cuenca del Plata", sentido: null }]],
        ["OD032", [servicioDe(3, "Transfer GIG - Accommodation in Rio. Booking Supplier: Buzios Transfers / Alex", "llegada")]],
        ["COMPBR02", [servicioDe(3, traslado, "sin_sentido")]],
      ]),
      excepciones,
    });
    expect(ajustes.map((a) => [a.paquete, a.accion, a.origen])).toEqual([
      ["OD010B", "reemplazar", "excepcion"],
      ["COMPBR02", "anular", "excepcion"],
      ["OD032", "invertir", "excepcion"],
    ]);
  });

  it("un tramo 'Transfer' dice Traslado en el pedido, no Bus; un bus sigue diciendo Bus", () => {
    const paraty = proveedor("prov-paraty", "Paraty Tours", ["reservas@paratytours.test"]);
    const tour = producto("prod-t", "BR04", [], { esTour: true, componentes: [] });
    const r = armarPedidos(
      reserva({
        productoId: tour.id,
        fechaInicio: "2027-05-26",
        fechaFin: "2027-06-09",
        partes: [
          parte({ id: "a", orden: 1, tipo: "servicio", descripcionRuta: "Transfer Paraty – Ilha Grande", proveedorId: paraty.id, fechaInicio: "2027-06-03", fechaFin: "2027-06-03" }),
          parte({ id: "b", orden: 2, tipo: "servicio", descripcionRuta: "Bus Uyuni – La Paz", proveedorId: paraty.id, fechaInicio: "2027-06-06", fechaFin: "2027-06-06" }),
        ],
      }),
      catalogoCon([tour], [paraty]),
      cargarPlantilla(),
    );
    if (!r.ok) throw new Error(r.error);
    const { cuerpo } = r.pedidos[0];
    expect(cuerpo).toContain("Traslado: Paraty – Ilha Grande");
    expect(cuerpo).not.toContain("Bus: Transfer");
    expect(cuerpo).toContain("Bus: Bus Uyuni – La Paz");
  });

  describe.skipIf(!hayInsumosTours(RAIZ))("armarTour con los archivos reales", () => {
    function armar(codigo: string) {
      const insumos = leerInsumosTours(RAIZ);
      const paquetes = new Map<string, PaqueteConocido>(
        insumos.paquetesPiloto.map((p) => [
          p.codigo,
          {
            ...p,
            nochesBase: nochesBasePaquete(insumos.filasPaquetes, p.codigo),
            // Como en la base: OD032 y OD010B traen traslado, COMPBR02 el suyo de Río a Ilha Grande.
            cubrePuntas: ["OD032", "OD010B", "COMPBR02"].includes(p.codigo),
            rutasPropias: p.codigo === "COMPBR02" ? rutasDeServicios([traslado]) : [],
          },
        ]),
      );
      const t = armarTour({
        codigo,
        excel: leerTourRutas(insumos.filasRutas, codigo),
        word: insumos.words.map((w) => leerItinerario(w.parrafos, codigo)).find(Boolean) ?? null,
        paquetes,
        codigosTour: new Set(TOURS_PILOTO),
        tours: new Map(),
        tramosConProveedor: insumos.tramosConProveedor,
        incluidosTour: insumos.incluidosTour,
        excepcionesTransfer: insumos.excepcionesTransfer,
      });
      if (t.estado !== "armado") throw new Error(`para revisar: ${t.motivos.join(" | ")}`);
      return t;
    }

    const recorrido = (t: ReturnType<typeof armar>) => t.componentes.map((c) => (c.tipo === "paquete" ? `${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}` : `bus ${c.descripcionRuta} d${c.diaDesde}${c.nocturno ? " nocturno" : ""}`));
    const propios = (t: ReturnType<typeof armar>) => t.serviciosPropios.map((s) => [s.ruta, s.sentido, s.diaDesde, s.bookingSupplier]);

    it("BR03: armado, 8 noches, Río → Paraty → Ilha Grande, con los días del Word", () => {
      const t = armar("BR03");
      expect(t.noches).toBe(8);
      expect(recorrido(t)).toEqual(["OD032 d1 3n IN", "COMPBR02 d4 2n", "COMPBR11 d6 3n OUT"]);
      expect(propios(t)).toEqual([
        ["Transfer Rio de Janeiro – Paraty", "Río de Janeiro – Paraty", 4, "Paraty Tours"],
        ["Transfer Paraty – Ilha Grande", "Paraty – Ilha Grande", 6, "Paraty Tours"],
        ["Transfer Ilha Grande – Rio de Janeiro", "Ilha Grande – Río de Janeiro", 9, "Paraty Tours"],
      ]);
      expect(t.ciudades).toEqual(["Río de Janeiro", "Paraty", "Ilha Grande"]);
    });

    it("BR04: armado, 14 noches, Iguazú → São Paulo → Paraty → Ilha Grande → Río, con los días del Word", () => {
      const t = armar("BR04");
      expect(t.noches).toBe(14);
      expect(recorrido(t)).toEqual([
        "OD010B d1 3n IN OUT",
        "COMPBR10 d5 2n",
        "COMPBR02 d7 2n",
        "COMPBR11 d9 3n",
        "OD032 d12 3n OUT",
      ]);
      expect(propios(t)).toEqual([
        ["Bus Foz do Iguazu – Sao Paulo", "Iguazú – São Paulo", 4, "Plataforma10"],
        ["Bus Sao Paulo – Paraty", "São Paulo – Paraty", 7, "Plataforma10"],
        ["Transfer Paraty – Ilha Grande", "Paraty – Ilha Grande", 9, "Paraty Tours"],
        ["Transfer Ilha Grande – Rio de Janeiro", "Ilha Grande – Río de Janeiro", 12, "Paraty Tours"],
      ]);
      expect(t.ciudades).toEqual(["Iguazú", "São Paulo", "Paraty", "Ilha Grande", "Río de Janeiro"]);
    });
  });

  it.skipIf(!HAY_EXCEL)("las noches de los bloques en el Excel: COMPBR02 2 y COMPBR11 3", () => {
    const filas = leerFilasPaquetes(RUTA_PAQUETES);
    expect(nochesBasePaquete(filas, "COMPBR02")).toBe(2);
    expect(nochesBasePaquete(filas, "COMPBR11")).toBe(3);
  });

  it("el Scuna Netuno va el día 2 de COMPBR02 (Excel, G1725)", () => {
    const dias = leerDiasServicio(readFileSync(resolve(RAIZ, ARCHIVO_DIAS), "utf-8"));
    expect(dias.find((d) => d.codigo === "COMPBR02")).toMatchObject({ orden: 4, dia: 2 });
  });
});

describe("M3-48 punto 8 — portugués", () => {
  it("el mail a Casa do Rio, si lo pide la persona, sale en portugués y sin desayuno", () => {
    const id = "prod-COMPBR02";
    const casa = { ...proveedor("prov-casa", "Casa do Rio", ["casadoriohostel@gmail.com"]), ciudad: "PARATY" };
    const prod = producto(id, "COMPBR02", [servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, prioridad: 1, serviceProviderNombre: "Casa do Rio", bookingSupplier: casa })], { destino: "PRY" });
    const catalogo: CatalogoParaPedidos = {
      ...catalogoCon([prod]),
      ciudadesPortugues: leerCiudadesPortugues(dato("ciudades-portugues.csv")),
      sinDesayuno: cargarAlojamientosSinDesayuno(RAIZ),
    };
    const r = armarPedidos(reserva({ productoId: id, habitacion: "Dormitory - Hostel", fechaInicio: "2027-06-01", fechaFin: "2027-06-03" }), catalogo, cargarPlantilla(), cargarPlantilla(undefined, "pt"));
    if (!r.ok) throw new Error(r.error);
    expect(r.pedidos[0].cuerpo).toContain("Escrevemos da HI Travel");
    expect(r.pedidos[0].cuerpo).toContain("Quarto: quarto compartilhado (dorm)\n");
    expect(r.pedidos[0].cuerpo).not.toMatch(/caf[eé] da manh/i);
  });

  it.each(["PARATY", "ILHA GRANDE"])("%s está en la lista", (ciudad) => {
    expect(idiomaDeLaCiudad(ciudad, leerCiudadesPortugues(dato("ciudades-portugues.csv")))).toBe("pt");
  });
});

describe("M3-48 punto 9 — los tours y sus códigos Kilroy", () => {
  it("BR03 y BR04 están en TOURS_PILOTO", () => {
    expect(TOURS_PILOTO).toEqual(expect.arrayContaining(["BR03", "BR04"]));
  });

  it.each([
    ["HI_TRAVEL_BR03-677", "BR03"],
    ["HI_TRAVEL_BR04-677", "BR04"],
  ])("%s → %s", (kilroy, tour) => {
    expect(leerCodigosKilroy(dato("codigos-kilroy.csv")).find((f) => f.codigoKilroy === kilroy)?.codigoHiTravel).toBe(tour);
  });
});
