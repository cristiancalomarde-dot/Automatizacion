// @vitest-environment node
//
// Spec M3-46 — verificación 2 (regla #5), contra la BASE DE PRUEBAS (nunca la
// real: credencialesSupabaseDisponibles frena si apunta a producción).
//
// Carga por lista (`--codigos`) y en seco (`--en-seco`). Los paquetes y el tour
// son de prueba (ZZ…46, en un Excel armado acá): la suite corre en paralelo con
// otras que cargan el catálogo entero, así que "solo toca esos códigos" se mira
// en los pedidos que salen a la base, no comparando el catálogo antes y después.
// Lo de prueba se borra al final. El tour de prueba usa las filas reales de BR18
// en data/ (tramos con Plataforma10 y la excepción de lo que incluye el Word).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { REF_BASE_REAL } from "@/lib/entorno/base-de-pruebas";
import { parsearServiciosAPedido } from "@/lib/importador-productos/a-pedido";
import { correrCargaPaquetes } from "@/lib/importador-productos/carga-paquetes";
import { guardarCodigoExterno, HOJA_PAQUETES } from "@/lib/importador-productos/importar";
import { clienteEnSeco, fetchSoloLectura, resumirEscrituras } from "@/lib/importador-productos/solo-lectura";
import { parsearIncluidosTour, parsearTramosConProveedor } from "@/lib/importador-tours/datos";
import { fila } from "@/lib/importador-tours/fixtures";
import { importarToursCompuestos, TOURS_PILOTO } from "@/lib/importador-tours/importar";
import { hayInsumosTours } from "@/lib/importador-tours/insumos";
import { importarCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const RUTA_CODIGOS_TR = resolve(RAIZ, "Insumos/Codigos Productos Tourradar.xlsx");
const CORRE = credencialesSupabaseDisponibles() && hayInsumosTours(RAIZ);
const TIMEOUT = 300_000;

const SALVADOR = "ZZSSA46";
const LENCOIS = "ZZCHA46";
const NOCHE_EXTRA = "ZZNOC46";
const AJENO = "ZZOTR46";
const TOUR = "ZZTOUR46";
const PAQUETES = [
  { codigo: SALVADOR, destino: "SSA" },
  { codigo: LENCOIS, destino: "CHAP" },
  { codigo: NOCHE_EXTRA, destino: "SSA" },
  { codigo: AJENO, destino: "SSA" },
];

/** Un bloque de paquete mínimo, con las noches junto al título repetido (como el Excel real). */
function bloque(columnaInicial: number, codigo: string, noches: number): Record<string, string> {
  const col = (n: number) => XLSX.utils.encode_col(columnaInicial + n);
  return {
    [`${col(0)}3`]: `Paquete de prueba ${codigo}`,
    [`${col(4)}4`]: `Paquete de prueba ${codigo}`,
    [`${col(0)}5`]: "Accommodation: Hostel Zeta Prueba. Booking Supplier: Proveedor Zeta Prueba",
    [`${col(0)}6`]: "Dorm ensuite",
    [`${col(4)}10`]: "Net Prices:",
    [`${col(4)}11`]: "Hostel Zeta Dorm",
    [`${col(5)}11`]: "200",
    [`${col(0)}16`]: `Paquete de prueba ${codigo}`,
    [`${col(1)}16`]: `${noches} nights`,
  };
}

function hojaDePaquetes(): XLSX.WorkSheet {
  const celdas: Record<string, string> = {
    ...bloque(1, SALVADOR, 3),
    ...bloque(9, LENCOIS, 3),
    ...bloque(17, NOCHE_EXTRA, 1),
    ...bloque(25, AJENO, 2),
  };
  const hoja: XLSX.WorkSheet = {};
  for (const [ref, v] of Object.entries(celdas)) hoja[ref] = { t: "s", v };
  hoja["!ref"] = "A1:AK20";
  return hoja;
}

const WORD = [
  `${TOUR}- Tour de prueba – 7 nights`,
  "Day 1: Salvador",
  "Day 2: Salvador",
  "Day 3: Salvador",
  "Day 4: Lençóis",
  "Day 5: Lençóis",
  "Day 6: Lençóis",
  "Day 7: Salvador",
  "Day 8: End of Itinerary",
  "What's Included?",
  "4 Nights accommodation in Salvador at selected room",
  "Bus round trip from Salvador de Bahia to Lencois at Chapada Diamantina",
  "3 Nights accommodation in Lencois at selected room",
  "What's Not Included?",
];

const RUTAS = [
  fila({ A: TOUR, B: "Tour de prueba", I: "Tour de prueba" }),
  fila({ C: SALVADOR, E: NOCHE_EXTRA, F: LENCOIS, G: "2026-27" }),
  fila({ B: "Net Prices:", C: "Salvador", D: "Bus", E: "Extra night", F: "Chapada", G: "TOTAL", I: "Net Prices:" }),
  fila({ B: "Dorm Hostel", C: "1", D: "1", E: "1", F: "1", G: "4", I: "Dorm Hostel" }),
  fila({}),
];

interface Pedido {
  metodo: string;
  tabla: string;
  url: string;
  cuerpo: Record<string, unknown> | null;
}

(CORRE ? describe : describe.skip)("M3-46 — carga por lista y en seco, en la base de pruebas", { timeout: TIMEOUT }, () => {
  let carpeta: string;
  let rutaExcel: string;
  let filasPaquetes: string[][];
  let lectura: SupabaseClient;
  const importaciones: string[] = [];

  /** Un cliente que anota todo lo que no sea una lectura (lo deja salir). */
  function clienteGrabando(): { admin: SupabaseClient; pedidos: Pedido[] } {
    const pedidos: Pedido[] = [];
    const grabar: typeof fetch = async (entrada, opciones) => {
      const metodo = (opciones?.method ?? "GET").toUpperCase();
      const url = String(entrada);
      if (metodo !== "GET" && metodo !== "HEAD") {
        pedidos.push({
          metodo,
          url,
          tabla: new URL(url).pathname.split("/").pop()!,
          cuerpo: typeof opciones?.body === "string" ? (JSON.parse(opciones.body) as Record<string, unknown>) : null,
        });
      }
      return fetch(entrada, opciones);
    };
    return { admin: conexion(grabar), pedidos };
  }

  function conexion(propio?: typeof fetch): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(propio ? { global: { fetch: propio } } : {}),
    });
  }

  /** Cliente en seco: lee de verdad, cualquier cosa que no sea GET/HEAD se corta, y cuenta los pedidos que salen. */
  function clienteSeco() {
    const metodos: string[] = [];
    const contar: typeof fetch = async (entrada, opciones) => {
      metodos.push((opciones?.method ?? "GET").toUpperCase());
      return fetch(entrada, opciones);
    };
    return { ...clienteEnSeco(conexion(fetchSoloLectura(contar))), metodos };
  }

  function cargaPaquetes(admin: SupabaseClient, codigos: string[] | null, enSeco = false) {
    return correrCargaPaquetes({
      admin,
      rutaPaquetes: rutaExcel,
      rutaCodigosTourRadar: existsSync(RUTA_CODIGOS_TR) ? RUTA_CODIGOS_TR : null,
      interpretarIA: null,
      nivelesConfirmados: [],
      paquetes: PAQUETES,
      renglonesAgregados: [],
      nochesServicio: [],
      // Las marcas reales: una corrida por lista no las puede quitar.
      aPedido: parsearServiciosAPedido(dato("servicios-a-pedido.csv")),
      codigos,
      enSeco,
    });
  }

  function cargaTour(admin: SupabaseClient) {
    return importarToursCompuestos({
      admin,
      filasRutas: RUTAS,
      words: [{ archivo: "prueba.docx", parrafos: WORD }],
      filasPaquetes,
      paquetesPiloto: PAQUETES.filter((p) => p.codigo !== AJENO),
      tramosConProveedor: parsearTramosConProveedor(dato("tramos-con-proveedor.csv"))
        .filter((t) => t.tour === "BR18")
        .map((t) => ({ ...t, tour: TOUR })),
      incluidosTour: parsearIncluidosTour(dato("incluidos-tour.csv")).map((x) => ({ ...x, tour: TOUR })),
      categoriasTour: [],
      archivos: { rutas: "prueba.xls", paquetes: "prueba.xls" },
      tours: [TOUR],
    });
  }

  async function idDe(codigo: string): Promise<string | null> {
    const { data, error } = await lectura.from("producto").select("id").eq("codigo", codigo).maybeSingle();
    expect(error).toBeNull();
    return (data?.id as string | undefined) ?? null;
  }

  async function borrarLoDePrueba() {
    const { data } = await lectura.from("producto").select("id").in("codigo", [TOUR, ...PAQUETES.map((p) => p.codigo)]);
    const ids = (data ?? []).map((p) => p.id as string);
    if (ids.length) {
      await lectura.from("tour_servicio_ajuste").delete().in("tour_id", ids);
      await lectura.from("producto_componente").delete().in("producto_id", ids);
      await lectura.from("producto_servicio").delete().in("producto_id", ids);
      await lectura.from("codigo_externo").delete().in("producto_id", ids);
      await lectura.from("producto").delete().in("id", ids);
    }
  }

  beforeAll(async () => {
    lectura = conexion();
    await borrarLoDePrueba();
    carpeta = mkdtempSync(join(tmpdir(), "m3-46-"));
    rutaExcel = join(carpeta, "paquetes.xlsx");
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hojaDePaquetes(), HOJA_PAQUETES);
    writeFileSync(rutaExcel, XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer);
    filasPaquetes = XLSX.utils
      .sheet_to_json<unknown[]>(hojaDePaquetes(), { header: 1, defval: "", raw: false })
      .map((f) => f.map((c) => String(c ?? "")));
  });

  afterAll(async () => {
    await borrarLoDePrueba();
    if (importaciones.length) await lectura.from("importacion").delete().in("id", importaciones);
    rmSync(carpeta, { recursive: true, force: true });
  });

  it("en seco, con --codigos: dice qué crearía, solo salen lecturas y no queda ninguna fila", async () => {
    const { cliente, escrituras, metodos } = clienteSeco();
    const r = await cargaPaquetes(cliente, [SALVADOR], true);

    expect(new Set(metodos)).toEqual(new Set(["GET"]));
    expect(r.resumen.creados).toMatchObject({ productos: 1 });
    expect(r.resumen.servicios.creados).toBeGreaterThan(0);
    expect(r.resumen.productos.map((p) => p.codigo)).toEqual([SALVADOR]);
    const haria = resumirEscrituras(escrituras);
    expect(haria.productosNuevos).toEqual([SALVADOR]);
    expect(haria.porTabla.producto_servicio.insert).toBe(r.resumen.servicios.creados);
    expect(await idDe(SALVADOR)).toBeNull();
    const { data } = await lectura.from("importacion").select("id").eq("id", r.resumen.importacionId);
    expect(data).toEqual([]);
  });

  it("de verdad, con --codigos: solo escribe ese paquete (ni el otro de la lista, ni TourRadar, ni las marcas ajenas)", async () => {
    const { admin, pedidos } = clienteGrabando();
    const r = await cargaPaquetes(admin, [SALVADOR]);
    importaciones.push(r.resumen.importacionId);

    const id = await idDe(SALVADOR);
    expect(id).not.toBeNull();
    expect(await idDe(AJENO)).toBeNull();
    expect(new Set(pedidos.map((p) => p.tabla))).toEqual(new Set(["producto", "producto_servicio", "codigo_externo", "importacion"]));
    expect(pedidos.filter((p) => p.tabla === "producto").map((p) => p.cuerpo?.codigo)).toEqual([SALVADOR]);
    for (const p of pedidos.filter((x) => x.tabla === "producto_servicio" || x.tabla === "codigo_externo")) {
      expect([p.metodo, p.cuerpo?.producto_id]).toEqual(["POST", id]);
    }
  });

  it("en seco otra vez: ya no crearía nada", async () => {
    const { cliente, escrituras } = clienteSeco();
    const r = await cargaPaquetes(cliente, [SALVADOR], true);
    expect(r.resumen.creados).toEqual({ productos: 0, servicios: 0, codigos: 0 });
    expect(resumirEscrituras(escrituras).productosNuevos).toEqual([]);
  });

  it("un código que no está en la lista corta antes de tocar la base", async () => {
    const { admin, pedidos } = clienteGrabando();
    await expect(cargaPaquetes(admin, ["ZZNADA46"])).rejects.toThrow(/ZZNADA46/);
    expect(pedidos).toEqual([]);
  });

  it("el tour por lista, en seco: dice qué crearía, con los buses y la secuencia, sin dejar filas", async () => {
    const r1 = await cargaPaquetes(conexion(), [LENCOIS, NOCHE_EXTRA]);
    importaciones.push(r1.resumen.importacionId);

    const { cliente, escrituras, metodos } = clienteSeco();
    const r = await cargaTour(cliente);

    expect(new Set(metodos)).toEqual(new Set(["GET"]));
    const [tour] = r.tours;
    expect(tour.motivos).toEqual([]);
    expect(tour.estado).toBe("armado");
    expect(resumirEscrituras(escrituras).productosNuevos).toEqual([TOUR]);
    expect(r.creados).toMatchObject({ productos: 1, componentes: 3, servicios: 2 });
    expect(await idDe(TOUR)).toBeNull();
  });

  it("el tour de verdad: dos buses manuales de Plataforma10, en los dos sentidos, y las fechas de DK1587388", async () => {
    const { admin, pedidos } = clienteGrabando();
    const r = await cargaTour(admin);
    importaciones.push(r.importacionId);
    expect(r.tours[0].estado).toBe("armado");
    expect(r.tours[0].serviciosPropios.map((s) => [s.sentido, s.diaDesde, s.reservaManual, s.bookingSupplierId, s.sinResolver])).toEqual([
      ["Salvador – Lençóis", 4, true, null, false],
      ["Lençóis – Salvador", 7, true, null, false],
    ]);
    // Solo el tour: los paquetes se leen, no se tocan.
    const tourId = await idDe(TOUR);
    const paquetesIds = await Promise.all([SALVADOR, LENCOIS, NOCHE_EXTRA].map(idDe));
    for (const p of pedidos.filter((x) => x.tabla === "producto_servicio" || x.tabla === "producto_componente")) {
      expect(p.cuerpo?.producto_id).toBe(tourId);
    }
    expect(pedidos.some((p) => paquetesIds.some((id) => p.url.includes(id!)))).toBe(false);

    const detalle = await cargarProducto(lectura, tourId!);
    const partes = componentesDeLaReserva(detalle, "2027-01-28", { finalPuertoNatales: false, proveedorTransferPNT: null });
    const codigoDe = new Map(detalle.componentes.map((c) => [c.producto?.id, c.producto?.codigo]));
    expect(partes.map((p) => `${p.esTarea ? "tarea " : ""}${p.productoId ? codigoDe.get(p.productoId) : p.descripcionRuta} ${p.fechaInicio} ${p.fechaFin}`)).toEqual([
      `${SALVADOR} 2027-01-28 2027-01-31`,
      "tarea Bus Salvador – Lençóis 2027-01-31 2027-01-31",
      `${LENCOIS} 2027-01-31 2027-02-03`,
      "tarea Bus Lençóis – Salvador 2027-02-03 2027-02-03",
      `${NOCHE_EXTRA} 2027-02-03 2027-02-04`,
    ]);
  });

  it("el tour en seco, ya cargado: no haría ningún cambio (idempotente)", async () => {
    const { cliente, escrituras } = clienteSeco();
    const r = await cargaTour(cliente);
    expect(r.creados).toEqual({ productos: 0, componentes: 0, servicios: 0, codigos: 0, ajustes: 0 });
    expect(r.actualizados).toEqual({ productos: 0, componentes: 0, servicios: 0, ajustes: 0 });
    expect(r.eliminados).toEqual({ componentes: 0, servicios: 0, ajustes: 0 });
    expect(escrituras.map((e) => e.tabla)).toEqual(["importacion"]);
  });

  describe("guardarCodigoExterno: un nombre null no pisa el que ya está (OD031, M3-46)", () => {
    const nombreGuardado = async (codigo: string) => {
      const { data, error } = await lectura.from("codigo_externo").select("nombre_externo").eq("agencia", "Kilroy").eq("codigo", codigo).single();
      expect(error).toBeNull();
      return data!.nombre_externo as string | null;
    };

    it("sin fila previa se crea igual, con nombre o sin nombre", async () => {
      const id = (await idDe(SALVADOR))!;
      expect(await guardarCodigoExterno(lectura, id, "Kilroy", "ZZSINNOMBRE46", null)).toBe("creado");
      expect(await nombreGuardado("ZZSINNOMBRE46")).toBeNull();
      expect(await guardarCodigoExterno(lectura, id, "Kilroy", "ZZCONNOMBRE46", "Nombre uno")).toBe("creado");
      expect(await nombreGuardado("ZZCONNOMBRE46")).toBe("Nombre uno");
    });

    it("un nombre null no pisa el guardado y no cuenta como cambio", async () => {
      const id = (await idDe(SALVADOR))!;
      expect(await guardarCodigoExterno(lectura, id, "Kilroy", "ZZCONNOMBRE46", null)).toBe("sin_cambios");
      expect(await nombreGuardado("ZZCONNOMBRE46")).toBe("Nombre uno");
    });

    it("un nombre no nulo sigue actualizándolo, también sobre una fila sin nombre", async () => {
      const id = (await idDe(SALVADOR))!;
      expect(await guardarCodigoExterno(lectura, id, "Kilroy", "ZZCONNOMBRE46", "Nombre dos")).toBe("actualizado");
      expect(await nombreGuardado("ZZCONNOMBRE46")).toBe("Nombre dos");
      expect(await guardarCodigoExterno(lectura, id, "Kilroy", "ZZSINNOMBRE46", "Nombre tres")).toBe("actualizado");
      expect(await nombreGuardado("ZZSINNOMBRE46")).toBe("Nombre tres");
    });

    it("con nombre null, un cambio de producto se aplica y conserva el nombre", async () => {
      const otro = (await idDe(LENCOIS))!;
      expect(await guardarCodigoExterno(lectura, otro, "Kilroy", "ZZCONNOMBRE46", null)).toBe("actualizado");
      const { data } = await lectura.from("codigo_externo").select("producto_id, nombre_externo").eq("agencia", "Kilroy").eq("codigo", "ZZCONNOMBRE46").single();
      expect(data).toEqual({ producto_id: otro, nombre_externo: "Nombre dos" });
    });
  });

  it("importar:codigos-kilroy no se rompe con BR18 sin cargar: esa fila queda afuera y se informa", async () => {
    const { data } = await lectura.from("producto").select("id").eq("codigo", "BR18");
    expect(data).toEqual([]);
    const { cliente, metodos } = clienteSeco();
    const r = await importarCodigosKilroy(cliente, dato("codigos-kilroy.csv"));
    expect(r.pendientes).toEqual(["HI_TRAVEL_BR18-677"]);
    expect(new Set(metodos)).toEqual(new Set(["GET"]));
  });

  describe("los scripts, de punta a punta", () => {
    /** Con las claves de la base de pruebas: `.env.local` no pisa las variables que ya vienen en el entorno. */
    function correr(script: string, ...argumentos: string[]) {
      const r = spawnSync(process.execPath, [resolve(RAIZ, "node_modules/tsx/dist/cli.mjs"), `scripts/${script}`, ...argumentos], {
        cwd: RAIZ,
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024,
        env: { ...process.env, ANTHROPIC_API_KEY: "clave-que-no-sirve-m3-46" },
      });
      expect(r.status, r.stderr).toBe(0);
      return { salida: JSON.parse(r.stdout) as Record<string, unknown>, stderr: r.stderr };
    }

    it("importar:tours --codigos BR18 --en-seco: BR18 queda para revisar, no se crea y no toca los reportes", () => {
      const { salida } = correr("importar-tours-compuestos.ts", "--codigos", "BR18", "--en-seco");
      expect(salida.base).not.toBe(REF_BASE_REAL);
      expect(salida.enSeco).toBeTruthy();
      expect(salida.tours).toEqual([expect.stringMatching(/^BR18: para_revisar/)]);
      expect(salida.haria).toMatchObject({ productosNuevos: ["BR18"] });
      expect(salida.reporte).toBeUndefined();
    });

    it("importar:tours --en-seco, sin códigos: los tours de siempre, sin BR18, todos armados", () => {
      const { salida } = correr("importar-tours-compuestos.ts", "--en-seco");
      expect(salida.tours).toEqual(TOURS_PILOTO.map((c) => `${c}: armado`));
      expect(salida.reporte).toBeUndefined();
    });

    it("importar:tours --codigos con un tour que no existe corta sin tocar nada", () => {
      const r = spawnSync(process.execPath, [resolve(RAIZ, "node_modules/tsx/dist/cli.mjs"), "scripts/importar-tours-compuestos.ts", "--codigos", "ZZNADA46", "--en-seco"], {
        cwd: RAIZ,
        encoding: "utf-8",
        env: process.env,
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("ZZNADA46");
    });

    it("importar:paquetes --codigos ODBR15,COMPBR04 --en-seco: solo esos, sin IA y sin tocar el reporte", () => {
      const { salida, stderr } = correr("importar-paquetes-tours.ts", "--codigos", "ODBR15,COMPBR04", "--en-seco");
      expect(salida.base).not.toBe(REF_BASE_REAL);
      expect((salida.productos as string[]).map((p) => p.split(":")[0])).toEqual(["ODBR15", "COMPBR04"]);
      expect(salida.ia).toMatchObject({ configurada: false, llamadas: 0 });
      // Todos los alojamientos tienen su categoría (data/niveles-confirmados.csv).
      expect((salida.otrosPuntos as string[]).filter((p) => /categor[ií]a/.test(p))).toEqual([]);
      expect(stderr).not.toContain("techo de IA");
      expect(salida.reporte).toBeUndefined();
    });
  });
});
