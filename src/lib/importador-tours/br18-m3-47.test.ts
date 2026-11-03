import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { agruparProveedores, leerHojaContactos } from "@/lib/importador-proveedores/hoja";
import { leerFilasDelExcel } from "@/lib/importador-proveedores/importar";
import { resolverProveedor as resolverContacto } from "@/lib/importador-proveedores/resolver";
import { BLOQUES_SIN_SECCION_2, leerSeccion1, ubicarBloquesEnHoja } from "@/lib/importador-productos/bloque";
import { diagnosticarPaquetes } from "@/lib/importador-productos/diagnostico";
import { parsearEquivalencias, resolverEquivalencias } from "@/lib/importador-productos/equivalencias";
import { leerFilasPaquetes } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { planificarBloques } from "@/lib/importador-productos/plan";
import { crearIndiceProveedores, resolverProveedor } from "@/lib/importador-productos/proveedores";
import { parsearRenglonesAgregados } from "@/lib/importador-productos/renglones-agregados";
import { sentidoDelTraslado } from "@/lib/importador-productos/sentido";
import { ARCHIVO_DIAS, cargarAlojamientosSinDesayuno, leerCiudadesPortugues, leerDiasServicio } from "@/lib/pedidos/cargar";
import { sinDesayuno } from "@/lib/pedidos/formato";
import { idiomaDeLaCiudad } from "@/lib/pedidos/idioma";
import { leerCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { armarTour, type PaqueteConocido, type TourArmado } from "./armado";
import { TOURS_PILOTO } from "./importar";
import { hayInsumosTours, leerInsumosTours } from "./insumos";
import { nochesBasePaquete } from "./noches-base";
import { leerTourRutas } from "./rutas";
import { ajustesDeTraslados, type ServicioDePaquete } from "./traslados";
import { leerItinerario } from "./word";

// Spec M3-47: BR18 con los bloques reales del owner (COMPBR12 y COMPBR11) y el
// Excel y el Word reales de Insumos/ (no están en Git).

const RAIZ = process.cwd();
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");
const RUTA_PROVEEDORES = resolve(RAIZ, "Insumos/Proveedores Hi Travel 2026 para IA.xlsx");
const HAY_EXCEL = existsSync(RUTA_PAQUETES);

const BR18 = ["ODBR15", "COMPBR12", "COMPBR04"];
const COMPBR11 = { codigo: "COMPBR11", destino: "ILH" };
const RENGLON_SALIDA = "Transfer accommodation - SSA Airport. Booking Supplier: Bahia Transfers";

function paquetesDeBr18() {
  const lista = parsearPaquetesPiloto(dato("paquetes-piloto.csv"));
  return BR18.map((c) => lista.find((p) => p.codigo === c)!);
}

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

describe("M3-47 punto 2 — COMPBR11 y COMPBR12 no tienen sección 2, como COMPBR10", () => {
  it("están en la lista de bloques sin sección 2", () => {
    expect(BLOQUES_SIN_SECCION_2.has("COMPBR11")).toBe(true);
    expect(BLOQUES_SIN_SECCION_2.has("COMPBR12")).toBe(true);
  });

  it.skipIf(!HAY_EXCEL)("los dos se leen sin noCalza, cada uno hasta donde termina su bloque", async () => {
    const d = await diagnostico([COMPBR11, { codigo: "COMPBR12", destino: "SSA" }]);
    for (const codigo of ["COMPBR11", "COMPBR12"]) {
      const p = d.paquetes.find((x) => x.codigo === codigo)!;
      expect(p.encontrado, codigo).toBe(true);
      expect(p.bloqueNoCalza, codigo).toBe(false);
    }
    const filas = leerFilasPaquetes(RUTA_PAQUETES);
    const { ubicados } = ubicarBloquesEnHoja(filas, [COMPBR11]);
    const lectura = leerSeccion1(filas, ubicados[0].bloque, ubicados[0].rango);
    expect(lectura.estructuraOk).toBe(true);
    // COMPBR11 termina donde arranca COMPBR12 (fila 2702), sin comerse su alojamiento.
    expect(lectura.filaFin).toBe(2701);
    expect(lectura.servicios.map((s) => s.fila)).toEqual([2688, 2693]);
  });
});

describe("M3-47 punto 3 — el traslado de salida de COMPBR12", () => {
  const renglones = parsearRenglonesAgregados(dato("renglones-agregados.csv"));

  it("COMPBR12 tiene su renglón de Bahia Transfers, y es de salida", () => {
    expect(renglones.filter((r) => r.paquete === "COMPBR12")).toEqual([{ paquete: "COMPBR12", renglon: RENGLON_SALIDA }]);
    expect(sentidoDelTraslado(RENGLON_SALIDA)).toBe("salida");
  });

  it.skipIf(!HAY_EXCEL)("el paquete lo trae al final del bloque, con su Booking Supplier", async () => {
    const filas = leerFilasPaquetes(RUTA_PAQUETES);
    const paquete = { codigo: "COMPBR12", destino: "SSA" };
    const { ubicados } = ubicarBloquesEnHoja(filas, [paquete]);
    const { productos } = await planificarBloques({
      filas,
      bloques: ubicados.map((u) => ({ bloque: u.bloque, rango: u.rango })),
      interpretarIA: null,
      nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
      renglonesAgregados: renglones,
    });
    const ultimo = productos[0].servicios[productos[0].servicios.length - 1];
    expect(ultimo).toMatchObject({ tipo: "traslado", descripcion: RENGLON_SALIDA, fila: 0 });
    expect(ultimo.opciones).toEqual([{ prioridad: 1, serviceProvider: "accommodation - SSA Airport", bookingSupplier: "Bahia Transfers" }]);
    expect(productos[0].renglonesAgregadosYaEnElExcel).toEqual([]);
  });

  it("en el tour: ODBR15 queda solo con la llegada, y la salida del recorrido es la de COMPBR12", () => {
    const servicio = (orden: number, descripcion: string): ServicioDePaquete => ({
      orden,
      prioridad: 1,
      tipo: "traslado",
      serviceProviderNombre: null,
      descripcion,
      sentido: sentidoDelTraslado(descripcion),
    });
    const ajustes = ajustesDeTraslados({
      tour: "BR18",
      secuencia: [
        { codigo: "ODBR15", destino: "SSA" },
        { codigo: "COMPBR04", destino: "CHAP" },
        { codigo: "COMPBR12", destino: "SSA" },
      ],
      servicios: new Map([
        ["ODBR15", [servicio(3, "Transfer SSA Airport - accommodation - SSA Airport. Booking Supplier: Bahia Transfers")]],
        ["COMPBR12", [servicio(3, RENGLON_SALIDA)]],
      ]),
      excepciones: [],
    });
    expect(ajustes.map((a) => [a.paquete, a.accion])).toEqual([["ODBR15", "solo_llegada"]]);
  });
});

describe("M3-47 punto 4 — los Hotel 3* de COMPBR12 y COMPBR11", () => {
  it.skipIf(!HAY_EXCEL)("el diagnóstico los encuentra con nivel en todas sus líneas de alojamiento", async () => {
    const d = await diagnostico([COMPBR11, { codigo: "COMPBR12", destino: "SSA" }]);
    for (const codigo of ["COMPBR11", "COMPBR12"]) {
      const p = d.paquetes.find((x) => x.codigo === codigo)!;
      const niveles = [...new Set(p.servicios.filter((s) => s.tipo === "alojamiento").map((s) => s.nivel))].sort();
      expect(niveles, codigo).toEqual(["Hostel", "Hotel 3*"]);
    }
  });
});

describe.skipIf(!HAY_EXCEL || !existsSync(RUTA_PROVEEDORES))("M3-47 punto 5 — los nombres del Excel llegan al proveedor con contacto", () => {
  async function directorio() {
    const grupos = agruparProveedores(leerHojaContactos(leerFilasDelExcel(RUTA_PROVEEDORES)));
    const registros = await Promise.all(grupos.map((g, i) => resolverContacto(g, null).then((r) => ({ ...r.registro, id: `p${i}` }))));
    return registros;
  }

  it.each([
    ["Hostel Laranjeiras", "SSA", "Laranjeiras Hostel", "hi@laranjeirashostel.com.br", null],
    ["Agencia Chapada Backpackers", "CHAP", "Chapada Backpackers (Tour 4Ps e Vale do Pati Trek)", null, "whatsapp"],
    ["Bahia Transfers", "SSA", "Bahia Transfers (transfer SSA - hotel - SSA y trasfer hotel en SSA - praia do forte y praia do forte - SSA)", "contatobahiatransfer@gmail.com", null],
    ["Cassi Turismo", "SSA", "Cassi Turismo (Praia do Forte Full Day y Bahia de todos los Santos Scuna boat tour)", null, "whatsapp"],
  ])("%s (%s) → %s", async (nombre, destino, enDirectorio, mail, canal) => {
    const registros = await directorio();
    const alias = resolverEquivalencias(parsearEquivalencias(dato("equivalencias-proveedores.csv")), registros);
    const indice = crearIndiceProveedores(registros, alias);
    const r = resolverProveedor(nombre, indice, { destino });
    const p = registros.find((x) => x.id === r.id);
    expect(p?.nombre).toBe(enDirectorio);
    expect(r.paraRevisar).toBe(false);
    if (mail) expect(p?.mails).toContain(mail);
    if (canal) expect(p?.canal).toBe(canal);
  });

  it.each([
    ["HI Hostel Chapada", "CHAP"],
    ["Pousada do Pilar", "SSA"],
    ["Bahiacafe", "SSA"],
    ["Hotel Terra dos Diamantes", "CHAP"],
    ["Portal Lencois", "CHAP"],
  ])("%s ya está en el directorio con ese nombre", async (nombre, destino) => {
    const registros = await directorio();
    const indice = crearIndiceProveedores(registros, []);
    expect(resolverProveedor(nombre, indice, { destino }).id).not.toBeNull();
  });

  it("la nota de la fila 472 no entra en ninguna equivalencia ni en el proveedor de la excursión", async () => {
    const registros = await directorio();
    const agencia = registros.find((x) => x.nombre.startsWith("Chapada Backpackers (Tour"))!;
    expect(agencia.aclaraciones ?? "").not.toContain("solo si no hay lugar");
    expect(dato("equivalencias-proveedores.csv")).not.toMatch(/,Chapada Backpackers,alias/);
  });
});

describe.skipIf(!HAY_EXCEL)("M3-47 punto 6 — sin IA para los bloques de BR18", () => {
  it("el bloque y la fila 2239 no piden ninguna llamada a IA", async () => {
    const filas = leerFilasPaquetes(RUTA_PAQUETES);
    const { ubicados, noUbicados } = ubicarBloquesEnHoja(filas, paquetesDeBr18());
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
  });
});

describe("M3-47 — sin desayuno en los hostels de BR18 (owner, 2026-11-03)", () => {
  const lista = cargarAlojamientosSinDesayuno(RAIZ);

  it.each(["Hostel Laranjeiras", "Laranjeiras Hostel", "HI Hostel Chapada"])("%s no ofrece desayuno", (nombre) => {
    expect(sinDesayuno(nombre, lista)).toBe(true);
  });

  it.each(["Pousada do Pilar", "Bahiacafe", "Hotel Terra dos Diamantes", "Portal Lencois", "Chapada Backpackers"])("%s sigue con desayuno", (nombre) => {
    expect(sinDesayuno(nombre, lista)).toBe(false);
  });

  it("son solo esos dos, con la nota del owner", () => {
    const filas = lista.filter((f) => /M3-47/.test(f.nota ?? ""));
    expect(filas.map((f) => f.alojamiento).sort()).toEqual(["HI Hostel Chapada", "Hostel Laranjeiras"]);
    for (const f of filas) expect(f.nota).toContain("Owner 2026-11-03 (M3-47)");
  });
});

describe.skipIf(!existsSync(RUTA_PROVEEDORES))("M3-47 — la ciudad de los proveedores de Salvador y Lençóis, sin las filas 'Pousada' sueltas", () => {
  const grupos = () => agruparProveedores(leerHojaContactos(leerFilasDelExcel(RUTA_PROVEEDORES)));

  it.each([
    ["Bahia Transfers (", "SALVADOR DE BAHIA"],
    ["Cassi Turismo (", "SALVADOR DE BAHIA"],
    ["Chapada Backpackers (Tour", "CHAPADA DIAMANTINA"],
  ])("%s… queda en %s, y le toca portugués", (nombre, ciudad) => {
    const g = grupos().find((x) => x.nombre.startsWith(nombre))!;
    expect(g.destino).toBe(ciudad);
    expect(idiomaDeLaCiudad(g.destino, leerCiudadesPortugues(dato("ciudades-portugues.csv")))).toBe("pt");
  });

  it("nadie queda con ciudad POUSADA", () => {
    expect(grupos().filter((x) => x.destino === "POUSADA").map((x) => x.nombre)).toEqual([]);
  });
});

describe("M3-47 §1 — lo que falta para el recorrido de la ficha", () => {
  it("Praia do Forte va el día 3 de ODBR15 y el Full Day 4 Ps el día 2 de COMPBR04 (Excel, G2165 y G2228)", () => {
    const dias = leerDiasServicio(readFileSync(resolve(RAIZ, ARCHIVO_DIAS), "utf-8"));
    expect(dias.find((d) => d.codigo === "ODBR15")).toMatchObject({ orden: 4, dia: 3 });
    expect(dias.find((d) => d.codigo === "COMPBR04")).toMatchObject({ orden: 3, dia: 2 });
  });

  it("los hoteles de Salvador (ciudad 'SALVADOR DE BAHIA' en el directorio) reciben el pedido en portugués, como los de Lençóis (M3-32)", () => {
    const ciudades = leerCiudadesPortugues(dato("ciudades-portugues.csv"));
    expect(idiomaDeLaCiudad("SALVADOR DE BAHIA", ciudades)).toBe("pt");
    expect(idiomaDeLaCiudad("CHAPADA DIAMANTINA", ciudades)).toBe("pt");
  });
});

describe("M3-47 punto 7 — BR18 entra de verdad", () => {
  it("BR18 está en TOURS_PILOTO y COMPBR12 en la lista de paquetes (COMPBR11 no: BR03 y BR04 quedan afuera)", () => {
    expect(TOURS_PILOTO).toContain("BR18");
    const lista = parsearPaquetesPiloto(dato("paquetes-piloto.csv"));
    expect(lista).toContainEqual({ codigo: "COMPBR12", destino: "SSA" });
    expect(lista.some((p) => p.codigo === "COMPBR11")).toBe(false);
  });

  it("el código Kilroy de BR18 es una fila común, y la marca de pendiente se fue con él", () => {
    const fila = leerCodigosKilroy(dato("codigos-kilroy.csv")).find((f) => f.codigoKilroy === "HI_TRAVEL_BR18-677")!;
    expect(fila.codigoHiTravel).toBe("BR18");
    expect(fila).not.toHaveProperty("pendienteDeCarga");
    expect(dato("codigos-kilroy.csv").split(/\r?\n/)[0]).not.toContain("pendiente_de_carga");
  });

  it.skipIf(!hayInsumosTours(RAIZ))("armarTour con el Excel y el Word reales: armado, 7 noches y días 1, 4, 4, 7, 7", () => {
    const insumos = leerInsumosTours(RAIZ);
    const paquetes = new Map<string, PaqueteConocido>(
      insumos.paquetesPiloto.map((p) => [
        p.codigo,
        { ...p, nochesBase: nochesBasePaquete(insumos.filasPaquetes, p.codigo), cubrePuntas: true, rutasPropias: [] },
      ]),
    );
    const excel = leerTourRutas(insumos.filasRutas, "BR18");
    const doc = insumos.words.map((w) => leerItinerario(w.parrafos, "BR18")).find(Boolean) ?? null;
    const t: TourArmado = armarTour({
      codigo: "BR18",
      excel,
      word: doc,
      paquetes,
      codigosTour: new Set(TOURS_PILOTO),
      tours: new Map(),
      tramosConProveedor: insumos.tramosConProveedor,
      incluidosTour: insumos.incluidosTour,
      excepcionesTransfer: insumos.excepcionesTransfer,
    });
    if (t.estado !== "armado") throw new Error(`para revisar: ${t.motivos.join(" | ")}`);
    expect(t.noches).toBe(7);
    expect(t.componentes.map((c) => `${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}`)).toEqual([
      "ODBR15 d1 3n IN",
      "COMPBR04 d4 3n",
      "COMPBR12 d7 1n OUT",
    ]);
    const dias = [...t.componentes.map((c) => c.diaDesde), ...t.serviciosPropios.map((s) => s.diaDesde)].sort((a, b) => a - b);
    expect(dias).toEqual([1, 4, 4, 7, 7]);
  });

  it.skipIf(!HAY_EXCEL)("las noches del bloque COMPBR12 en el Excel son 1", () => {
    expect(nochesBasePaquete(leerFilasPaquetes(RUTA_PAQUETES), "COMPBR12")).toBe(1);
  });
});
