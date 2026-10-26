// @vitest-environment node
//
// Spec M3-10 — verificación 2 (regla #5), contra la BASE DE PRUEBAS (nunca la
// real: credencialesSupabaseDisponibles frena si apunta a producción) y los
// archivos reales de `Insumos/` y `data/`. Corre los importadores reales en el
// orden del comando de carga (equivalencias → paquetes con sus noches, marcas
// y renglones agregados → tours → códigos Kilroy → códigos TourRadar), dos
// veces, y compara el catálogo que ya estaba antes y después (fila 5).
//
// Lo cargado queda (es la carga, idempotente); solo se borran las filas de
// `importacion` de estas corridas.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { cargarServiciosAPedido, parsearServiciosAPedido } from "@/lib/importador-productos/a-pedido";
import { TIPO_CORRIDA_PAQUETES } from "@/lib/importador-productos/carga-paquetes";
import { cargarEquivalencias } from "@/lib/importador-productos/equivalencias";
import { CODIGOS_PILOTO, importarProductosSimples, leerFilasPaquetes, type ResumenImportacionProductos } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { cargarNochesServicio, parsearNochesServicio } from "@/lib/importador-productos/noches-servicio";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { parsearRenglonesAgregados } from "@/lib/importador-productos/renglones-agregados";
import { importarToursCompuestos, type ResumenImportacionTours } from "@/lib/importador-tours/importar";
import { hayInsumosTours, leerInsumosTours } from "@/lib/importador-tours/insumos";
import { nochesBasePaquete } from "@/lib/importador-tours/noches-base";
import { importarCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { importarCodigosTourRadarCsv } from "@/lib/reservas/emparejar/codigos-tourradar-csv";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");
const RUTA_CODIGOS_TR = resolve(RAIZ, "Insumos/Codigos Productos Tourradar.xlsx");
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const CORRE = credencialesSupabaseDisponibles() && existsSync(RUTA_PAQUETES) && hayInsumosTours(RAIZ);
const TIMEOUT = 600_000;

/** Los productos que entran con esta pieza (los 6 pedidos + Montevideo y Colonia, que necesita ARUY01). */
const NUEVOS_PAQUETES = ["CH11", "OD014", "AR34", "OD040", "COMPUY03"];
const NUEVOS_TOURS = ["ARCH33EXP", "ARBR23", "ARUY01"];
const NUEVOS = [...NUEVOS_PAQUETES, ...NUEVOS_TOURS];

interface Fila {
  orden: number;
  prioridad: number;
  tipo_servicio: string;
  nivel: string | null;
  descripcion: string;
  service_provider_nombre: string;
  booking_supplier_nombre: string | null;
  opcional: boolean;
  reserva_manual: boolean;
  proveedor_sin_resolver: boolean;
  proveedor_para_revisar: boolean;
  sentido: string | null;
  bs: { nombre: string; mails: string[]; canal: string | null } | null;
}

(CORRE ? describe : describe.skip)("M3-10 — los 6 productos nuevos en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  const importaciones: string[] = [];
  let existentes: string[] = [];
  let fotoAntes: string;
  let reservasAntes: Map<string, string>;
  let proveedoresAntes: string;
  let primeraPaquetes: ResumenImportacionProductos;
  let segundaPaquetes: ResumenImportacionProductos;
  let primerosTours: ResumenImportacionTours;
  let segundosTours: ResumenImportacionTours;

  const paquetes = parsearPaquetesPiloto(dato("paquetes-piloto.csv")).filter((p) => !CODIGOS_PILOTO.includes(p.codigo));

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- el builder de PostgREST, filtrado por quien llama */
  async function todo<T>(tabla: string, campos: string, filtro?: (q: any) => any): Promise<T[]> {
    const filas: T[] = [];
    for (let desde = 0; ; desde += 1000) {
      let q = admin.from(tabla).select(campos).range(desde, desde + 999);
      if (filtro) q = filtro(q);
      const { data, error } = await q;
      if (error) throw new Error(`${tabla}: ${error.message}`);
      filas.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) return filas;
    }
  }

  /** Todo lo que la app sabe de esos productos, sin fechas ni ids (para comparar antes y después). */
  async function foto(codigos: string[]): Promise<string> {
    const ps = await todo<{ id: string; codigo: string; nombre: string; destino: string | null; ciudades: string[] }>(
      "producto",
      "id, codigo, nombre, destino, ciudades",
      (q) => q.in("codigo", codigos),
    );
    const ids = ps.map((p) => p.id);
    const codigoDe = new Map(ps.map((p) => [p.id, p.codigo]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el builder de PostgREST
    const en = (campo: string) => (q: any) => q.in(campo, ids);
    const [svc, comp, aj, ce, no] = await Promise.all([
      todo<Record<string, unknown>>(
        "producto_servicio",
        "producto_id, orden, prioridad, tipo_servicio, nivel, fila_excel, descripcion, service_provider_nombre, booking_supplier_nombre, service_provider_id, booking_supplier_id, proveedor_sin_resolver, proveedor_para_revisar, proveedor_nota, opcional, reserva_manual, sentido, a_pedido, a_pedido_nota",
        en("producto_id"),
      ),
      todo<Record<string, unknown>>(
        "producto_componente",
        "producto_id, orden, tipo, componente_producto_id, descripcion_ruta, transfer_in, transfer_out, noches, dia_desde, nocturno",
        en("producto_id"),
      ),
      todo<Record<string, unknown>>("tour_servicio_ajuste", "tour_id, paquete_id, orden, accion, texto, motivo, origen", en("tour_id")),
      todo<Record<string, unknown>>("codigo_externo", "producto_id, agencia, codigo, nombre_externo, origen", en("producto_id")),
      todo<Record<string, unknown>>("producto_servicio_noches", "producto_id, orden, noche_desde, noches, lugar, nota", en("producto_id")),
    ]);
    const orden = (filas: Array<Record<string, unknown>>, ...campos: string[]) =>
      filas
        .map((f) => {
          const g = { ...f };
          for (const c of campos) g[c] = codigoDe.get(g[c] as string) ?? g[c];
          return JSON.stringify(g);
        })
        .sort();
    return JSON.stringify({
      productos: ps.map((p) => JSON.stringify([p.codigo, p.nombre, p.destino, p.ciudades])).sort(),
      servicios: orden(svc, "producto_id"),
      partes: orden(comp, "producto_id", "componente_producto_id"),
      ajustes: orden(aj, "tour_id", "paquete_id"),
      codigos: orden(ce, "producto_id"),
      noches: orden(no, "producto_id"),
    });
  }

  async function idDe(codigo: string): Promise<string> {
    const { data, error } = await admin.from("producto").select("id").eq("codigo", codigo).single();
    expect(error, codigo).toBeNull();
    return data!.id;
  }

  async function servicios(codigo: string): Promise<Fila[]> {
    const { data, error } = await admin
      .from("producto_servicio")
      .select(
        "orden, prioridad, tipo_servicio, nivel, descripcion, service_provider_nombre, booking_supplier_nombre, opcional, reserva_manual, proveedor_sin_resolver, proveedor_para_revisar, sentido, bs:booking_supplier_id(nombre, mails, canal)",
      )
      .eq("producto_id", await idDe(codigo))
      .order("orden")
      .order("prioridad");
    expect(error).toBeNull();
    return data as unknown as Fila[];
  }

  async function cargarTodo() {
    await cargarEquivalencias({ admin, textoCsv: dato("equivalencias-proveedores.csv") });
    const r = await importarProductosSimples({
      admin,
      rutaPaquetes: RUTA_PAQUETES,
      rutaCodigosTourRadar: existsSync(RUTA_CODIGOS_TR) ? RUTA_CODIGOS_TR : null,
      interpretarIA: null,
      nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
      paquetes,
      tipoCorrida: TIPO_CORRIDA_PAQUETES,
      renglonesAgregados: parsearRenglonesAgregados(dato("renglones-agregados.csv")),
    });
    importaciones.push(r.importacionId);
    const filas = leerFilasPaquetes(RUTA_PAQUETES);
    await cargarNochesServicio({
      admin,
      filas: parsearNochesServicio(dato("noches-servicio.csv")),
      nochesPaquete: (codigo) => nochesBasePaquete(filas, codigo),
    });
    await cargarServiciosAPedido({ admin, filas: parsearServiciosAPedido(dato("servicios-a-pedido.csv")) });
    const t = await importarToursCompuestos({ admin, ...leerInsumosTours(RAIZ) });
    importaciones.push(t.importacionId);
    await importarCodigosKilroy(admin, dato("codigos-kilroy.csv"));
    await importarCodigosTourRadarCsv(admin, dato("codigos-tourradar.csv"));
    return { r, t };
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const ps = await todo<{ codigo: string }>("producto", "codigo");
    existentes = ps.map((p) => p.codigo).filter((c) => !NUEVOS.includes(c)).sort();
    fotoAntes = await foto(existentes);
    reservasAntes = new Map(
      (await todo<{ id: string; producto_id: string | null; estado: string }>("reserva", "id, producto_id, estado")).map((r) => [
        r.id,
        `${r.producto_id}|${r.estado}`,
      ]),
    );
    proveedoresAntes = JSON.stringify((await todo<Record<string, unknown>>("proveedor", "id, nombre, ciudad, mails, canal, telefono")).map((p) => JSON.stringify(p)).sort());
    ({ r: primeraPaquetes, t: primerosTours } = await cargarTodo());
    ({ r: segundaPaquetes, t: segundosTours } = await cargarTodo());
  }, TIMEOUT);

  afterAll(async () => {
    if (importaciones.length) await admin.from("importacion").delete().in("id", importaciones);
  });

  it("fila 5: lo que ya estaba no cambia (productos, servicios, partes, ajustes, códigos, noches, proveedores y reservas)", { timeout: 300_000 }, async () => {
    expect(existentes.length).toBeGreaterThanOrEqual(82);
    // Otros archivos de test cambian un dato del catálogo un rato y lo deshacen al final
    // (M2-08 "variantes", carga-paquetes): lo que importa es que nada quede cambiado.
    await expect.poll(() => foto(existentes), { timeout: 240_000, interval: 10_000 }).toBe(fotoAntes);
    // El directorio: igual (importador-proveedores agrega y borra los suyos mientras corre).
    await expect
      .poll(async () => JSON.stringify((await todo<Record<string, unknown>>("proveedor", "id, nombre, ciudad, mails, canal, telefono")).map((p) => JSON.stringify(p)).sort()), {
        timeout: 120_000,
        interval: 10_000,
      })
      .toBe(proveedoresAntes);
    // Las reservas que ya estaban (las de más de una hora: las de otros archivos de test van y vienen)
    // conservan producto y estado.
    const despues = await todo<{ id: string; producto_id: string | null; estado: string }>("reserva", "id, producto_id, estado", (q) =>
      q.lt("created_at", new Date(Date.now() - 3_600_000).toISOString()),
    );
    for (const r of despues) {
      if (reservasAntes.has(r.id)) expect(`${r.producto_id}|${r.estado}`, r.id).toBe(reservasAntes.get(r.id));
    }
  });

  it("la segunda corrida no crea, cambia ni borra nada", () => {
    expect(primeraPaquetes.codigosNoEncontrados).toEqual([]);
    expect(segundaPaquetes.creados).toEqual({ productos: 0, servicios: 0, codigos: 0 });
    expect(segundaPaquetes.servicios).toMatchObject({ creados: 0, actualizados: 0, eliminados: 0 });
    expect(segundosTours.creados).toEqual({ productos: 0, componentes: 0, servicios: 0, codigos: 0, ajustes: 0 });
    expect(segundosTours.actualizados).toEqual({ productos: 0, componentes: 0, servicios: 0, ajustes: 0 });
    expect(segundosTours.eliminados).toEqual({ componentes: 0, servicios: 0, ajustes: 0 });
  });

  it("fila 2: los 5 paquetes nuevos se leen enteros por reglas (sin IA, sin renglones ni niveles para revisar)", () => {
    for (const codigo of NUEVOS_PAQUETES) {
      const p = segundaPaquetes.productos.find((x) => x.codigo === codigo)!;
      expect(p, codigo).toBeDefined();
      expect(p).toMatchObject({
        codigo,
        origen: "reglas",
        bloqueParaRevisar: false,
        lineasParaRevisar: [],
        nivelesParaRevisar: [],
        nivelesConfirmadosSinLinea: [],
        renglonesAgregadosYaEnElExcel: [],
      });
    }
    // M3-23: OD027 trae "Las Marias Tilcara" (sin proveedor): sin IA queda afuera.
    expect(segundaPaquetes.bloquesQueNecesitanIA).toEqual(["OD027"]);
  });

  it("fila 2: cada servicio de los paquetes nuevos tiene proveedor con mail, salvo los avisados (Oxford y Merit sin mail; COT online a mano)", async () => {
    const sinMail: string[] = [];
    for (const codigo of NUEVOS_PAQUETES) {
      for (const s of await servicios(codigo)) {
        if (s.reserva_manual) {
          sinMail.push(`${codigo} manual ${s.booking_supplier_nombre}`);
          continue;
        }
        if (!s.bs || s.bs.mails.length === 0) sinMail.push(`${codigo} ${s.booking_supplier_nombre}`);
      }
    }
    expect(sinMail.sort()).toEqual(["COMPUY03 manual COT online", "OD040 Hotel Oxford Montevideo", "OD040 Merit Hoteles"]);
  });

  it("fila 2: proveedores de cada paquete nuevo (Uruguay según las respuestas del owner)", async () => {
    const quien = async (codigo: string) =>
      (await servicios(codigo)).filter((s) => s.prioridad === 1).map((s) => `${s.orden} ${s.tipo_servicio}${s.nivel ? ` ${s.nivel}` : ""}${s.opcional ? " opcional" : ""} → ${s.reserva_manual ? `a mano (${s.booking_supplier_nombre})` : (s.bs?.nombre.trim() ?? `sin directorio (${s.booking_supplier_nombre})`)}`);
    expect(await quien("CH11")).toEqual(["1 alojamiento Hostel → Puma House", "2 alojamiento Hotel 3* → Hotel big sur", "3 otro → LAS TORRES: W Trek Standard y W Trek Express"]);
    expect(await quien("OD014")).toEqual([
      "1 alojamiento Hostel → Del Glaciar / Juan Pablo",
      "2 alojamiento Budget Hotel → Del Glaciar / Juan Pablo",
      "3 alojamiento Hotel 3* → Rincon del calafate",
      "4 alojamiento Hotel 4* → Mirador del Lago",
      "5 traslado → Chalten Travel",
      "6 excursion → Chalten Travel",
      "7 excursion → South Road",
    ]);
    expect(await quien("AR34")).toEqual([
      "1 alojamiento Hostel → Chalten Travel",
      "2 alojamiento Hostel → Del Glaciar / Juan Pablo",
      "3 alojamiento Budget Hotel → Kau si ake",
      "4 alojamiento Budget Hotel → Del Glaciar / Juan Pablo",
      "5 alojamiento Hotel 3* → Chalten Travel",
      "6 alojamiento Hotel 3* → Rincon del calafate",
      "7 alojamiento Hotel 4* → Chalten Travel",
      "8 alojamiento Hotel 4* → Mirador del Lago",
      "9 traslado → Chalten Travel",
      "10 excursion → Chalten Travel",
      "11 otro → Chalten Travel",
      "12 otro opcional → Fitz Camp / Receptivo Chalten",
    ]);
    expect(await quien("OD040")).toEqual([
      "1 alojamiento Hostel → Comercial Cono Sur",
      "2 alojamiento Hotel 3* → sin directorio (Hotel Oxford Montevideo)",
      "3 traslado → Dcom Travel",
      "4 excursion → Dcom Travel",
    ]);
    expect(await quien("COMPUY03")).toEqual([
      "1 alojamiento Hostel → Viajero en Colonia.",
      "2 alojamiento Hotel 3* → Viajero en Colonia.",
      "3 bus → a mano (COT online)",
    ]);
    // Las segundas opciones de los niveles con más de un hotel, en su orden.
    const ar34 = await servicios("AR34");
    expect(ar34.filter((s) => s.orden === 3).map((s) => s.bs?.nombre)).toEqual(["Kau si ake", "Vertical Lodge, proveedor Patagonian Group"]);
    const od040 = await servicios("OD040");
    expect(od040.filter((s) => s.orden === 2).map((s) => [s.booking_supplier_nombre, s.proveedor_sin_resolver, s.proveedor_para_revisar])).toEqual([
      ["Hotel Oxford Montevideo", true, true],
      ["Merit Hoteles", true, true],
    ]);
    expect(od040.find((s) => s.orden === 3)!.sentido).toBe("llegada");
  });

  it("fila 2: noches por servicio — CH11 1 + 3 + 1 y AR34 3 noches en El Chaltén + 2 en El Calafate en cada nivel", async () => {
    const noches = async (codigo: string) => {
      const { data, error } = await admin
        .from("producto_servicio_noches")
        .select("orden, noche_desde, noches, lugar")
        .eq("producto_id", await idDe(codigo))
        .order("orden")
        .order("noche_desde");
      expect(error).toBeNull();
      return data!.map((n) => `${n.orden}:${n.noche_desde}+${n.noches} ${n.lugar}`);
    };
    expect(await noches("CH11")).toEqual(["1:1+1 Puerto Natales", "1:5+1 Puerto Natales", "2:1+1 Puerto Natales", "2:5+1 Puerto Natales", "3:2+3 refugios"]);
    expect(await noches("AR34")).toEqual([
      "1:1+3 El Chaltén",
      "2:4+2 El Calafate",
      "3:1+3 El Chaltén",
      "4:4+2 El Calafate",
      "5:1+3 El Chaltén",
      "6:4+2 El Calafate",
      "7:1+3 El Chaltén",
      "8:4+2 El Calafate",
    ]);
  });

  it("los días fijos de dias-servicio.csv apuntan a la excursión que dice el owner", async () => {
    const dias = dato("dias-servicio.csv");
    const nombre = async (codigo: string, orden: number) => (await servicios(codigo)).find((s) => s.orden === orden)!.service_provider_nombre;
    expect(dias).toMatch(/^OD014,6,2,/m);
    expect(await nombre("OD014", 6)).toBe("Perito Moreno Glaciar Excursion");
    expect(dias).toMatch(/^OD014,7,3,/m);
    expect(await nombre("OD014", 7)).toBe("Chalten Full day Soft with Lunch");
    expect(dias).toMatch(/^AR34,10,5,/m);
    expect(await nombre("AR34", 10)).toBe("Perito Moreno Glaciar Excursion");
    expect(dias).toMatch(/^OD040,4,2,/m);
    expect(await nombre("OD040", 4)).toBe("Montevideo City Tour (regular)");
  });

  it("fila 3: los tours nuevos quedan armados y sus noches = suma de sus partes = las del Word", async () => {
    for (const codigo of NUEVOS_TOURS) {
      const t = primerosTours.tours.find((x) => x.codigo === codigo)!;
      expect(t.estado, `${codigo}: ${t.motivos.join(" | ")}`).toBe("armado");
    }
    const partes = async (codigo: string) => {
      const d = await cargarProducto(admin, await idDe(codigo));
      return d.componentes.map((c) =>
        c.tipo === "tramo_bus"
          ? `d${c.diaDesde} ${c.descripcionRuta}${c.nocturno ? " (nocturno)" : ""}`
          : `d${c.diaDesde} ${c.producto?.codigo} ${c.noches}n`,
      );
    };
    expect(await partes("ARCH33EXP")).toEqual(["d1 OD033 3n", "d4 OD016 2n", "d6 El Calafate – Puerto Natales", "d6 CH11 5n"]);
    expect(await partes("ARBR23")).toEqual([
      "d1 OD018 3n",
      "d4 Buenos Aires – Iguazú (nocturno)",
      "d5 OD010A 3n",
      "d8 Iguazú – Río de Janeiro (nocturno)",
      "d9 OD032 3n",
    ]);
    expect(await partes("ARUY01")).toEqual(["d1 OD018 3n", "d4 Ferry Buenos Aires – Colonia del Sacramento", "d4 COMPUY03 1n", "d5 OD040 2n"]);
    const noches = { ARCH33EXP: 10, ARBR23: 11, ARUY01: 6 } as const;
    for (const [codigo, n] of Object.entries(noches)) {
      expect(primerosTours.tours.find((t) => t.codigo === codigo)!.noches, codigo).toBe(n);
      const d = await cargarProducto(admin, await idDe(codigo));
      const nocturnos = d.componentes.filter((c) => c.tipo === "tramo_bus" && c.nocturno).length;
      expect(d.componentes.reduce((s, c) => s + (c.noches ?? 0), 0) + nocturnos, codigo).toBe(n);
    }
    // ARCH33EXP termina como ARCH33: bus de Kupos (a mano) o traslado al aeropuerto de Puerto Natales.
    const salida = (await servicios("ARCH33EXP")).map((s) => [s.tipo_servicio, s.reserva_manual, s.descripcion]);
    expect(salida).toEqual([["bus", true, expect.stringMatching(/^Bus Puerto Natales – Punta Arenas \(diurno, sale el día 11 del tour\) o traslado al aeropuerto de Puerto Natales/)]]);
  });

  it("fila 3: para una salida de ejemplo, las fechas de cada parte coinciden con el día a día del Word", async () => {
    const fechas = async (codigo: string, inicio: string) => {
      const d = await cargarProducto(admin, await idDe(codigo));
      const { data: prods } = await admin.from("producto").select("id, codigo");
      const codigoDe = new Map((prods ?? []).map((p) => [p.id, p.codigo]));
      return componentesDeLaReserva(d, inicio, { finalPuertoNatales: false, proveedorTransferPNT: null }).map(
        (c) => `${c.fechaInicio}→${c.fechaFin} ${c.tipo === "paquete" ? codigoDe.get(c.productoId!) : c.descripcionRuta}`,
      );
    };
    // ARUY01 (Word): BUE días 1-3, ferry y Colonia el 4, bus y Montevideo el 5, vuelo el 7.
    expect(await fechas("ARUY01", "2027-01-10")).toEqual([
      "2027-01-10→2027-01-13 OD018",
      "2027-01-13→2027-01-13 Ferry Buenos Aires – Colonia del Sacramento",
      "2027-01-13→2027-01-14 COMPUY03",
      "2027-01-14→2027-01-16 OD040",
    ]);
    // ARBR23 (Word): bus nocturno el día 4 (llega el 5 a Iguazú) y el 8 (llega el 9 a Río); fin el día 12.
    expect(await fechas("ARBR23", "2027-01-10")).toEqual([
      "2027-01-10→2027-01-13 OD018",
      "2027-01-13→2027-01-14 Buenos Aires – Iguazú",
      "2027-01-14→2027-01-17 OD010A",
      "2027-01-17→2027-01-18 Iguazú – Río de Janeiro",
      "2027-01-18→2027-01-21 OD032",
    ]);
    // ARCH33EXP (Word): El Chaltén 1-3, El Calafate 4-5, Puerto Natales el 6, W del 7 al 9, Natales el 10, fin el 11.
    expect(await fechas("ARCH33EXP", "2027-01-10")).toEqual([
      "2027-01-10→2027-01-13 OD033",
      "2027-01-13→2027-01-15 OD016",
      "2027-01-15→2027-01-15 El Calafate – Puerto Natales",
      "2027-01-15→2027-01-20 CH11",
      "2027-01-20→2027-01-20 Bus Puerto Natales – Punta Arenas",
    ]);
  });

  it("fila 3: traslados de cada paquete dentro de los tours nuevos", async () => {
    const ajustes = async (tour: string) => {
      const { data, error } = await admin
        .from("tour_servicio_ajuste")
        .select("orden, accion, origen, motivo, paquete:paquete_id(codigo)")
        .eq("tour_id", await idDe(tour));
      expect(error).toBeNull();
      return (data as unknown as Array<{ orden: number; accion: string; origen: string; motivo: string; paquete: { codigo: string } }>)
        .map((a) => `${a.paquete.codigo}#${a.orden} ${a.accion} — ${a.motivo}`)
        .sort();
    };
    expect(await ajustes("ARUY01")).toEqual([
      "COMPUY03#3 reemplazar — En este tour el bus va al revés: de Colonia a Montevideo.",
      "OD018#6 solo_llegada — Sale en ferry a Colonia del Sacramento.",
      "OD040#3 invertir — En este tour el traslado es de salida, del alojamiento al aeropuerto de Carrasco.",
    ]);
    expect(await ajustes("ARBR23")).toEqual([
      "OD010A#4 reemplazar — Llega en bus desde Buenos Aires y sigue en bus a Río desde Puerto Iguazú.",
      "OD018#6 solo_llegada — Sale en bus a Iguazú.",
      "OD032#3 invertir — En este tour el traslado es de salida, del alojamiento al aeropuerto de Río.",
    ]);
    expect(await ajustes("ARCH33EXP")).toEqual(await ajustes("ARCH33"));
  });

  it("fila 4: los códigos de agencia apuntan a cada producto", async () => {
    const { data, error } = await admin
      .from("codigo_externo")
      .select("agencia, codigo, producto:producto_id(codigo)")
      .in("codigo", [
        "HI_ARGENTINA_W_TREK_CH_11-677",
        "HI_ARGENTINA_AR34-677",
        "HI_ARGENTINA_OD014-677",
        "HI_TRAVEL_ARCH_EXP-677",
        "275366",
        "150104",
        "317766",
        "AR34",
        "OD014",
        "CH11",
      ]);
    expect(error).toBeNull();
    const pares = (data as unknown as Array<{ agencia: string; codigo: string; producto: { codigo: string } }>)
      .map((c) => `${c.agencia} ${c.codigo} → ${c.producto.codigo}`)
      .sort();
    expect(pares).toEqual(
      expect.arrayContaining([
        "Kilroy HI_ARGENTINA_W_TREK_CH_11-677 → CH11",
        "Kilroy HI_ARGENTINA_AR34-677 → AR34",
        "Kilroy HI_ARGENTINA_OD014-677 → OD014",
        "Kilroy HI_TRAVEL_ARCH_EXP-677 → ARCH33EXP",
        "Kilroy AR34 → AR34",
        "Kilroy OD014 → OD014",
        "Kilroy CH11 → CH11",
        "TourRadar 275366 → ARCH33EXP",
        "TourRadar 150104 → ARBR23",
        "TourRadar 317766 → ARUY01",
      ]),
    );
  });
});
