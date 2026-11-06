import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { agruparProveedores, leerHojaContactos } from "@/lib/importador-proveedores/hoja";
import { leerFilasDelExcel } from "@/lib/importador-proveedores/importar";
import { resolverProveedor as resolverContacto } from "@/lib/importador-proveedores/resolver";
import { ubicarBloquesEnHoja } from "@/lib/importador-productos/bloque";
import { diagnosticarPaquetes } from "@/lib/importador-productos/diagnostico";
import { parsearEquivalencias, resolverEquivalencias } from "@/lib/importador-productos/equivalencias";
import { leerFilasPaquetes } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { planificarBloques } from "@/lib/importador-productos/plan";
import { armarFilasServicio, crearIndiceProveedores, resolverProveedor } from "@/lib/importador-productos/proveedores";
import { parsearRenglonesAgregados } from "@/lib/importador-productos/renglones-agregados";
import { cargarAlojamientosSinDesayuno, leerCiudadesPortugues } from "@/lib/pedidos/cargar";
import { sinDesayuno } from "@/lib/pedidos/formato";
import { idiomaDeLaCiudad } from "@/lib/pedidos/idioma";
import { leerCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { armarTour, type PaqueteConocido } from "./armado";
import { nombreDestino, primeraCiudad } from "./ciudades";
import { parsearCategoriasTour, parsearTramosConProveedor, parsearTransfersTour } from "./datos";
import { TOURS_PILOTO } from "./importar";
import { hayInsumosTours, leerInsumosTours } from "./insumos";
import { nochesBasePaquete } from "./noches-base";
import { leerTourRutas } from "./rutas";
import { ajustesDeTraslados, parsearTrasladosTour, type ServicioDePaquete } from "./traslados";
import { leerItinerario } from "./word";

// Spec M3-51: BR20 (Iguazú, Dourados, Bonito, Pantanal, São Paulo, Paraty, Ilha Grande y Río) con el Excel,
// RutasenBus y el Word reales de Insumos/ (no están en Git).

const RAIZ = process.cwd();
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");
const RUTA_PROVEEDORES = resolve(RAIZ, "Insumos/Proveedores Hi Travel 2026 para IA.xlsx");
const HAY_EXCEL = existsSync(RUTA_PAQUETES);

const NUEVOS = [
  { codigo: "ODBR50", destino: "PTL" },
  { codigo: "COMPBR06", destino: "BON" },
  { codigo: "COMPBR13", destino: "SAO" },
  { codigo: "COMPBR14", destino: "DOU" },
];

const vacio = { data: [], error: null };
const consulta = { select: () => ({ range: async () => vacio }) };

async function plan(interpretarIA: Parameters<typeof planificarBloques>[0]["interpretarIA"] = null) {
  const filas = leerFilasPaquetes(RUTA_PAQUETES);
  const { ubicados, noUbicados } = ubicarBloquesEnHoja(filas, NUEVOS);
  expect(noUbicados).toEqual([]);
  return planificarBloques({
    filas,
    bloques: ubicados.map((u) => ({ bloque: u.bloque, rango: u.rango })),
    interpretarIA,
    nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
    renglonesAgregados: parsearRenglonesAgregados(dato("renglones-agregados.csv")),
  });
}

describe("M3-51 punto 1 — ODBR50, COMPBR06, COMPBR13 y COMPBR14, con destino y nivel en todas sus líneas de alojamiento", () => {
  it("están en data/paquetes-piloto.csv con su destino", () => {
    expect(parsearPaquetesPiloto(dato("paquetes-piloto.csv"))).toEqual(expect.arrayContaining(NUEVOS));
  });

  it.each([
    ["Dourados", "DOU", "Dourados"],
    ["Bonito", "BON", "Bonito"],
    ["Pantanal", "PTL", "Pantanal"],
    ["Campo Grande", "CGR", "Campo Grande"],
  ])("%s → %s", (texto, destino, nombre) => {
    expect(primeraCiudad(texto)).toBe(destino);
    expect(nombreDestino(destino)).toBe(nombre);
  });

  it.skipIf(!HAY_EXCEL)("el diagnóstico los encuentra, sin bloque que no calce y con nivel en todas sus líneas de alojamiento", async () => {
    const d = await diagnosticarPaquetes({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- base en memoria, sin directorio
      admin: { from: () => consulta } as any,
      filas: leerFilasPaquetes(RUTA_PAQUETES),
      archivo: "paquetes.xls",
      paquetes: NUEVOS,
      nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
    });
    const niveles = Object.fromEntries(
      NUEVOS.map(({ codigo }) => {
        const p = d.paquetes.find((x) => x.codigo === codigo)!;
        expect(p.encontrado, codigo).toBe(true);
        expect(p.bloqueNoCalza, codigo).toBe(false);
        return [codigo, p.servicios.filter((s) => s.tipo === "alojamiento").map((s) => s.nivel)];
      }),
    );
    expect(niveles).toEqual({
      ODBR50: ["Todos los niveles"],
      COMPBR06: ["Hostel", "Budget Hotel"],
      COMPBR13: ["Hostel", "Hotel 3*"],
      COMPBR14: ["Hostel", "Hotel 3*"],
    });
  });

  it.skipIf(!HAY_EXCEL)("las noches de los bloques: ODBR50 3, COMPBR06 2, COMPBR13 1 y COMPBR14 1", () => {
    const filas = leerFilasPaquetes(RUTA_PAQUETES);
    expect(NUEVOS.map((p) => nochesBasePaquete(filas, p.codigo))).toEqual([3, 2, 1, 1]);
  });

  it("el Lodge de ODBR50 es el de todas las categorías de BR20 (data/categorias-tour.csv)", () => {
    expect(parsearCategoriasTour(dato("categorias-tour.csv")).filter((c) => c.tour === "BR20")).toEqual([
      expect.objectContaining({ categoriaTour: "Hostel", componente: "ODBR50", categoriaPaquete: "Todos los niveles" }),
    ]);
  });
});

describe.skipIf(!HAY_EXCEL)("M3-51 punto 2 — los cuatro bloques se leen sin IA", () => {
  it("ninguna fila pide IA ni queda para revisar", async () => {
    const interpretarIA = vi.fn(async () => null);
    const p = await plan(interpretarIA);
    expect(interpretarIA).not.toHaveBeenCalled();
    expect(p.bloquesQueNecesitanIA).toEqual([]);
    for (const x of p.productos) {
      expect(x.lineasParaRevisar, x.codigo).toEqual([]);
      expect(x.bloqueParaRevisar, x.codigo).toBe(false);
      expect(x.nivelesParaRevisar, x.codigo).toEqual([]);
    }
    expect(Object.fromEntries(p.productos.map((x) => [x.codigo, x.servicios.map((s) => `${s.fila} ${s.tipo}`)]))).toEqual({
      ODBR50: ["1915 alojamiento", "1927 otro"],
      COMPBR06: ["2354 alojamiento", "2360 alojamiento", "2369 excursion", "2370 traslado", "2371 otro"],
      COMPBR13: ["2721 alojamiento", "2726 alojamiento"],
      COMPBR14: ["2738 alojamiento", "2743 alojamiento"],
    });
  });
});

describe.skipIf(!HAY_EXCEL || !existsSync(RUTA_PROVEEDORES))("M3-51 punto 3 — los nombres del Excel llegan a su proveedor", () => {
  async function indiceReal() {
    const grupos = agruparProveedores(leerHojaContactos(leerFilasDelExcel(RUTA_PROVEEDORES)));
    const registros = await Promise.all(grupos.map((g, i) => resolverContacto(g, null).then((r) => ({ ...r.registro, id: `p${i}` }))));
    const alias = resolverEquivalencias(parsearEquivalencias(dato("equivalencias-proveedores.csv")), registros);
    return { registros, indice: crearIndiceProveedores(registros, alias) };
  }

  it.each([
    ["Ygarape", "BON", "Ygarape", "ygarape@ygarape.com.br", "BONITO"],
    ["Hotel Pira Miuna", "BON", "Pira Miuna", "reservas@hotelpiramiuna.com.br", "BONITO"],
    ["Bonito HI Hostel", "BON", "Bonito HI Hostel", "reserva@bonitohostel.com.br", "BONITO"],
    ["Agmar", "BON", "Agmar", null, "BONITO"],
    ["Agmar", "PTL", "Agmar", null, "BONITO"],
    ["Pantanal Jungle Lodge", "PTL", "pantanal jungle lodge", "reserva@pantanaljunglelodge.com.br", "BRASIL"],
    ["Ceu Do Mato Eco Hostel", "DOU", "Ceu Do Mato Eco Hostel", null, "DOURADOS"],
    ["Hotel Bahamas Dourados", "DOU", "Hotel Bahamas Dourados", "reservas@bahamashotel.com.br", "DOURADOS"],
  ])("%s (%s) → %s", async (nombre, destino, enDirectorio, mail, ciudad) => {
    const { registros, indice } = await indiceReal();
    const r = resolverProveedor(nombre, indice, { destino });
    const p = registros.find((x) => x.id === r.id);
    expect(p?.nombre).toBe(enDirectorio);
    expect(r.paraRevisar).toBe(false);
    expect(p?.ciudad).toBe(ciudad);
    if (mail) expect(p?.mails).toContain(mail);
    else expect(p?.canal).toBe("whatsapp");
  });

  it("los cuatro bloques quedan sin proveedores sin resolver, salvo O Hostel GRU (segunda opción de São Paulo, ya pendiente en COMPBR10)", async () => {
    const { indice } = await indiceReal();
    const { productos } = await plan();
    const sinResolver = productos.flatMap((p) =>
      armarFilasServicio(p.servicios, indice, NUEVOS.find((x) => x.codigo === p.codigo)!.destino)
        .filter((l) => l.proveedor_sin_resolver)
        .map((l) => `${p.codigo}: ${l.booking_supplier_nombre}`),
    );
    expect(sinResolver).toEqual(["COMPBR13: O Hostel GRU"]);
  });
});

describe("M3-51 punto 4 — los tramos de BR20", () => {
  const tramos = parsearTramosConProveedor(dato("tramos-con-proveedor.csv")).filter((t) => t.tour === "BR20");

  it("los cuatro buses con Plataforma10, con las terminales y el primer bus de la mañana donde corresponde", () => {
    expect(tramos.filter((t) => t.bookingSupplier === "Plataforma10").map((t) => [t.desde, t.hasta, t.enLaTarea])).toEqual([
      ["IGR", "DOU", "Bus Foz do Iguaçu – Cascavel – Dourados, el primero de la mañana a Cascavel, que suele salir a las 6 hs, para conectar a Dourados, en Plataforma10"],
      ["DOU", "BON", "Bus Dourados – Bonito, el primero de la mañana, que suele salir a las 7 hs, para llegar temprano, en Plataforma10"],
      ["CGR", "SAO", "Bus nocturno Campo Grande – São Paulo Barra Funda, en Plataforma10"],
      ["SAO", "PRY", "Bus São Paulo Tietê – Paraty, en Plataforma10"],
    ]);
  });

  it("Paraty – Ilha Grande e Ilha Grande – Río, con Paraty Tours (como BR04)", () => {
    expect(tramos.filter((t) => t.bookingSupplier === "Paraty Tours").map((t) => [t.desde, t.hasta])).toEqual([
      ["PRY", "ILH"],
      ["ILH", "RIO"],
    ]);
  });

  describe.skipIf(!hayInsumosTours(RAIZ))("armarTour con los archivos reales", () => {
    function armar() {
      const insumos = leerInsumosTours(RAIZ);
      const paquetes = new Map<string, PaqueteConocido>(
        insumos.paquetesPiloto.map((p) => [
          p.codigo,
          {
            ...p,
            nochesBase: nochesBasePaquete(insumos.filasPaquetes, p.codigo),
            // Como en la base: los que traen traslado (ODBR50 lo trae como "otro", sin ruta).
            cubrePuntas: ["OD032", "OD010B", "COMPBR02", "COMPBR06"].includes(p.codigo),
            rutasPropias: [],
          },
        ]),
      );
      const t = armarTour({
        codigo: "BR20",
        excel: leerTourRutas(insumos.filasRutas, "BR20"),
        word: insumos.words.map((w) => leerItinerario(w.parrafos, "BR20")).find(Boolean) ?? null,
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

    it("armado, 19 noches, con los días del Word y el bus nocturno desde Campo Grande (no desde Foz)", () => {
      const t = armar();
      expect(t.noches).toBe(19);
      expect(t.componentes.map((c) => `${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}`)).toEqual([
        "OD010B d1 3n IN",
        "COMPBR14 d4 1n",
        "COMPBR06 d5 2n",
        "ODBR50 d7 3n",
        "COMPBR13 d11 1n",
        "COMPBR02 d12 2n",
        "COMPBR11 d14 3n",
        "OD032 d17 3n OUT",
      ]);
      expect(t.serviciosPropios.map((s) => [s.sentido, s.diaDesde, s.nocturno, s.bookingSupplier])).toEqual([
        ["Iguazú – Dourados", 4, false, "Plataforma10"],
        ["Dourados – Bonito", 5, false, "Plataforma10"],
        ["Campo Grande – São Paulo", 10, true, "Plataforma10"],
        ["São Paulo – Paraty", 12, false, "Plataforma10"],
        ["Paraty – Ilha Grande", 14, false, "Paraty Tours"],
        ["Ilha Grande – Río de Janeiro", 17, false, "Paraty Tours"],
      ]);
      expect(t.ciudades).toEqual(["Iguazú", "Dourados", "Bonito", "Pantanal", "Campo Grande", "São Paulo", "Paraty", "Ilha Grande", "Río de Janeiro"]);
    });
  });

  it("los traslados de Agmar salen de COMPBR06 (excursión, día 2 de Bonito) y de ODBR50 (Bonito → Lodge → Rodoviaria de Campo Grande), sin tramos del tour que los dupliquen", () => {
    expect(tramos.some((t) => /agmar/i.test(t.bookingSupplier))).toBe(false);
    const servicios = new Map<string, ServicioDePaquete[]>([
      ["OD010B", [{ orden: 5, prioridad: 1, tipo: "excursion", serviceProviderNombre: "Paquete Receptvo 105 Premium x Foz", descripcion: "Excursion: Paquete Receptvo 105 Premium x Foz. Booking Supplier: Cuenca del Plata", sentido: null }]],
      ["COMPBR06", [{ orden: 4, prioridad: 1, tipo: "traslado", serviceProviderNombre: "for the 2 days of Excursions", descripcion: "Transfer for the 2 days of Excursions. Booking Supplier: Agmar", sentido: "sin_sentido" }]],
      ["ODBR50", [{ orden: 2, prioridad: 1, tipo: "otro", serviceProviderNombre: "Private Transfer Campo Grande - Pantanal - Campo Grande for 1 to 4 pax", descripcion: "Private Transfer Campo Grande - Pantanal - Campo Grande for 1 to 4 pax. Booking Supplier: Agmar", sentido: null }]],
      ["COMPBR02", [{ orden: 3, prioridad: 1, tipo: "traslado", serviceProviderNombre: "Rio de Janeiro - Paraty - Ilha Grande", descripcion: "Transfer Rio de Janeiro - Paraty - Ilha Grande. Booking Supplier: Paraty Tours", sentido: "sin_sentido" }]],
      ["OD032", [{ orden: 3, prioridad: 1, tipo: "traslado", serviceProviderNombre: "GIG - Accommodation in Rio", descripcion: "Transfer GIG - Accommodation in Rio. Booking Supplier: Buzios Transfers / Alex", sentido: "llegada" }]],
    ]);
    const ajustes = ajustesDeTraslados({
      tour: "BR20",
      secuencia: [
        { codigo: "OD010B", destino: "IGR" },
        { codigo: "COMPBR14", destino: "DOU" },
        { codigo: "COMPBR06", destino: "BON" },
        { codigo: "ODBR50", destino: "PTL" },
        { codigo: "COMPBR13", destino: "SAO" },
        { codigo: "COMPBR02", destino: "PRY" },
        { codigo: "COMPBR11", destino: "ILH" },
        { codigo: "OD032", destino: "RIO" },
      ],
      servicios,
      excepciones: parsearTrasladosTour(dato("traslados-tour.csv")),
    });
    expect(ajustes.map((a) => [a.paquete, a.accion, a.origen])).toEqual([
      ["OD010B", "solo_llegada", "excepcion"],
      ["COMPBR06", "reemplazar", "excepcion"],
      ["ODBR50", "reemplazar", "excepcion"],
      ["COMPBR02", "anular", "excepcion"],
      ["OD032", "invertir", "excepcion"],
    ]);
    expect(ajustes.find((a) => a.paquete === "ODBR50")!.texto).toBe(
      "Transfer privado alojamiento en Bonito - Pantanal Jungle Lodge (llegada) y Pantanal Jungle Lodge - Rodoviaria de Campo Grande (salida, bus nocturno a São Paulo)",
    );
  });
});

describe("M3-51 punto 5 — Foz sin traslado de salida en BR20", () => {
  it("la marca: OD010B sin transfer out en BR20 (data/transfers-tour.csv), y en ningún otro tour", () => {
    const filas = parsearTransfersTour(dato("transfers-tour.csv")).filter((x) => x.codigo === "OD010B");
    expect(filas.map((x) => [x.tour, x.transferIn, x.transferOut])).toEqual([["BR20", null, false]]);
  });

  it("el pedido: el 105 Premium queda solo de llegada en BR20 (data/traslados-tour.csv); BR04 sigue con su reemplazo", () => {
    const filas = parsearTrasladosTour(dato("traslados-tour.csv")).filter((x) => x.paquete === "OD010B");
    expect(filas.map((x) => [x.tour, x.accion])).toEqual([
      ["BR04", "reemplazar"],
      ["BR20", "solo_llegada"],
    ]);
  });
});

describe("M3-51 punto 6 — el desayuno (owner, 2026-11-06)", () => {
  const lista = cargarAlojamientosSinDesayuno(RAIZ);

  it.each(["Bonito HI Hostel", "Ceu do Mato Eco Hostel", "Ceu Do Mato Eco Hostel"])("%s no ofrece desayuno", (nombre) => {
    expect(sinDesayuno(nombre, lista)).toBe(true);
  });

  it.each(["Hotel Pira Miuna", "Hotel Bahamas Dourados", "Pantanal Jungle Lodge", "Fujima Hostel", "Soos Hotel Collection"])("%s sigue con desayuno", (nombre) => {
    expect(sinDesayuno(nombre, lista)).toBe(false);
  });

  it("son esos dos, con la nota del owner", () => {
    const filas = lista.filter((f) => /M3-51/.test(f.nota ?? ""));
    expect(filas.map((f) => f.alojamiento).sort()).toEqual(["Bonito HI Hostel", "Ceu do Mato Eco Hostel"]);
    for (const f of filas) expect(f.nota).toContain("Owner 2026-11-06 (M3-51)");
  });
});

describe("M3-51 punto 7 — portugués", () => {
  it.each(["DOURADOS", "BONITO", "CAMPO GRANDE", "PANTANAL", "BRASIL"])("%s está en la lista", (ciudad) => {
    expect(idiomaDeLaCiudad(ciudad, leerCiudadesPortugues(dato("ciudades-portugues.csv")))).toBe("pt");
  });
});

describe("M3-51 punto 8 — BR20 y su código Kilroy", () => {
  it("BR20 está en TOURS_PILOTO", () => {
    expect(TOURS_PILOTO).toContain("BR20");
  });

  it("HI_TRAVEL_BR20-677 → BR20", () => {
    expect(leerCodigosKilroy(dato("codigos-kilroy.csv")).find((f) => f.codigoKilroy === "HI_TRAVEL_BR20-677")?.codigoHiTravel).toBe("BR20");
  });
});
