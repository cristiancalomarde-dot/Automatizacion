// @vitest-environment node
//
// Spec M3-23 — verificación 2 (regla #5), contra la BASE DE PRUEBAS (nunca la
// real: credencialesSupabaseDisponibles frena si apunta a producción) y los
// archivos reales de `Insumos/` y `data/`. Primero el directorio de
// `Insumos/` (el del Drive, con Trotamundos Hostel, Achalay, NH Edelweiss y
// Destino Sur), después los importadores en el orden del comando de carga
// (equivalencias → paquetes con sus noches y renglones agregados → tours →
// códigos), dos veces. Compara el catálogo que ya estaba antes y después
// (fila 5).
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
import { parsearProveedoresBorrados } from "@/lib/importador-proveedores/cambios";
import { importarProveedores } from "@/lib/importador-proveedores/importar";
import { importarToursCompuestos, type ResumenImportacionTours } from "@/lib/importador-tours/importar";
import { hayInsumosTours, leerInsumosTours } from "@/lib/importador-tours/insumos";
import { nochesBasePaquete } from "@/lib/importador-tours/noches-base";
import { importarCodigosAgencias } from "@/lib/reservas/emparejar/codigos-agencias";
import { importarCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { importarCodigosTourRadarCsv } from "@/lib/reservas/emparejar/codigos-tourradar-csv";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");
const RUTA_CODIGOS_TR = resolve(RAIZ, "Insumos/Codigos Productos Tourradar.xlsx");
const RUTA_PROVEEDORES = resolve(RAIZ, "Insumos/Proveedores Hi Travel 2026 para IA.xlsx");
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const CORRE = credencialesSupabaseDisponibles() && existsSync(RUTA_PAQUETES) && existsSync(RUTA_PROVEEDORES) && hayInsumosTours(RAIZ);
const TIMEOUT = 600_000;

/** Lo que entra con esta pieza: los dos paquetes nuevos y el tour. */
const NUEVOS_PAQUETES = ["OD027", "OD024"];
const NUEVOS = [...NUEVOS_PAQUETES, "AR10"];
/** OD033 suma su Hotel 4* (Destino Sur, data/renglones-agregados.csv, owner 2026-10-26): se controla aparte. */
const CAMBIA = ["OD033"];

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
  bs: { nombre: string; mails: string[]; canal: string | null } | null;
}

(CORRE ? describe : describe.skip)("M3-23 — AR10 Full Argentina Adventure en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  const importaciones: string[] = [];
  let existentes: string[] = [];
  let fotoAntes: string;
  let od033Antes: string[];
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

  /** Lo que está en una foto y no en la otra, renglón por renglón ("- antes" / "+ después"). */
  function diferencias(antes: string, despues: string): string[] {
    const a = JSON.parse(antes) as Record<string, string[]>;
    const d = JSON.parse(despues) as Record<string, string[]>;
    return Object.keys(a).flatMap((k) => [
      ...a[k].filter((x) => !d[k].includes(x)).map((x) => `- ${k} ${x}`),
      ...d[k].filter((x) => !a[k].includes(x)).map((x) => `+ ${k} ${x}`),
    ]);
  }

  async function idDe(codigo: string): Promise<string> {
    const { data, error } = await admin.from("producto").select("id").eq("codigo", codigo).single();
    expect(error, codigo).toBeNull();
    return data!.id;
  }

  async function servicios(codigo: string): Promise<Fila[]> {
    const { data, error } = await admin
      .from("producto_servicio")
      .select("orden, prioridad, tipo_servicio, nivel, descripcion, service_provider_nombre, booking_supplier_nombre, opcional, reserva_manual, bs:booking_supplier_id(nombre, mails, canal)")
      .eq("producto_id", await idDe(codigo))
      .order("orden")
      .order("prioridad");
    expect(error).toBeNull();
    return data as unknown as Fila[];
  }

  const renglon = (s: Fila) =>
    `${s.orden}.${s.prioridad} ${s.tipo_servicio}${s.nivel ? ` [${s.nivel}]` : ""} ${s.service_provider_nombre} → ${
      s.reserva_manual ? "a mano" : s.bs ? `${s.bs.nombre.trim()} <${s.bs.mails.join(",") || "sin mail"}>` : `sin directorio (${s.booking_supplier_nombre})`
    }`;

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
    await importarCodigosAgencias(admin, dato("codigos-agencias.csv"));
    return { r, t };
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // El directorio de Insumos/, en la base de pruebas (la real se carga aparte, con el OK del owner).
    const prov = await importarProveedores({
      admin,
      rutaArchivo: RUTA_PROVEEDORES,
      consultarIA: null,
      borrados: parsearProveedoresBorrados(dato("proveedores-borrados.csv")),
    });
    importaciones.push(prov.importacionId);
    const ps = await todo<{ codigo: string }>("producto", "codigo");
    existentes = ps.map((p) => p.codigo).filter((c) => !NUEVOS.includes(c) && !CAMBIA.includes(c)).sort();
    fotoAntes = await foto(existentes);
    od033Antes = (await servicios("OD033")).map(renglon);
    ({ r: primeraPaquetes, t: primerosTours } = await cargarTodo());
    ({ r: segundaPaquetes, t: segundosTours } = await cargarTodo());
  }, TIMEOUT);

  afterAll(async () => {
    if (importaciones.length) await admin.from("importacion").delete().in("id", importaciones);
  });

  it("fila 5: lo que ya estaba no cambia (productos, servicios, partes, ajustes, códigos y noches)", { timeout: 300_000 }, async () => {
    expect(existentes.length).toBeGreaterThanOrEqual(82);
    // Otros archivos de test cambian un dato del catálogo un rato y lo deshacen al final: lo que importa es que nada quede cambiado.
    await expect.poll(async () => diferencias(fotoAntes, await foto(existentes)), { timeout: 240_000, interval: 10_000 }).toEqual([]);
  });

  it("fila 5: OD033 solo suma su Hotel 4* (Destino Sur); lo demás queda igual", async () => {
    // Si la base ya tenía la carga de M3-23, "antes" ya trae el Destino Sur: se compara sin él.
    const destinoSur = / alojamiento \[Hotel 4\*\] Hotel 4\* Destino Sur → Destino Sur <info@hoteldestinosur\.com>$/;
    const despues = (await servicios("OD033")).map(renglon);
    expect(despues.filter((r) => destinoSur.test(r))).toHaveLength(1);
    expect(despues.filter((r) => !destinoSur.test(r))).toEqual(od033Antes.filter((r) => !destinoSur.test(r)));
  });

  it("la segunda corrida no crea, cambia ni borra nada", () => {
    expect(primeraPaquetes.codigosNoEncontrados).toEqual([]);
    expect(segundaPaquetes.creados).toEqual({ productos: 0, servicios: 0, codigos: 0 });
    expect(segundaPaquetes.servicios).toMatchObject({ creados: 0, actualizados: 0, eliminados: 0 });
    expect(segundosTours.creados).toEqual({ productos: 0, componentes: 0, servicios: 0, codigos: 0, ajustes: 0 });
    expect(segundosTours.actualizados).toEqual({ productos: 0, componentes: 0, servicios: 0, ajustes: 0 });
    expect(segundosTours.eliminados).toEqual({ componentes: 0, servicios: 0, ajustes: 0 });
  });

  it("fila 2: OD027 y OD024 se leen enteros por reglas (sin IA ni niveles para revisar); 'Las Marias Tilcara' queda afuera", () => {
    for (const codigo of NUEVOS_PAQUETES) {
      const p = segundaPaquetes.productos.find((x) => x.codigo === codigo)!;
      expect(p, codigo).toBeDefined();
      expect(p).toMatchObject({ codigo, origen: "reglas", bloqueParaRevisar: false, nivelesParaRevisar: [], nivelesConfirmadosSinLinea: [] });
    }
    expect(segundaPaquetes.productos.find((x) => x.codigo === "OD024")!.lineasParaRevisar).toEqual([]);
    expect(segundaPaquetes.productos.find((x) => x.codigo === "OD027")!.lineasParaRevisar.map((l) => l.texto)).toEqual(["Las Marias Tilcara"]);
    // Sin IA (la carga corre sin clave): "Las Marias Tilcara" (sin "Accommodation:" ni proveedor) queda afuera, como dice el diagnóstico.
    expect(segundaPaquetes.bloquesQueNecesitanIA).toEqual(["OD027"]);
  });

  it("fila 2: proveedores de OD027 y OD024 (respuestas del owner del 2026-10-26), todos con mail", async () => {
    expect((await servicios("OD027")).map(renglon)).toEqual([
      "1.1 alojamiento [Hostel] Trotamundos Salta → Trotamundos Hostel <trotamundoshostelsalta@gmail.com>",
      "2.1 alojamiento [Hotel 3*] Hotel 3* Inkai → Inkai Hotel <info@hotelinkai.com>",
      "3.1 alojamiento [Hotel 4*] Hotel 4* Brizo → Brizo Hotel <reservas.salta@brizohoteles.com>",
      "3.2 alojamiento [Hotel 4*] Ho.tel 4*Design Suites → Design Suites Salta <reservas.sla@gruposolanas.com>",
      "4.1 alojamiento [Todos los niveles] Posta de Purmamarca → Ecohotel Posta de Purmamarca <consultas@postadepurmamarca.com.ar>",
      "4.2 alojamiento [Todos los niveles] Casa de Adobe → Casa De Adobe <info@casadeadobe.com.ar>",
      "5.1 excursion Humahuaca → la Cienaga <florencia@lacienagaturismo.com.ar>",
      "6.1 excursion Salinas y Purmamarca → la Cienaga <florencia@lacienagaturismo.com.ar>",
      "7.1 traslado SLA - Accommodation - SLA → la Cienaga <florencia@lacienagaturismo.com.ar>",
    ]);
    expect((await servicios("OD024")).map(renglon)).toEqual([
      "1.1 alojamiento [Hostel] Periko´s → Periko´s youth Hostel <infoperikos@gmail.com,denalibarilochesrl@gmail.com>",
      "1.2 alojamiento [Hostel] Achalay Hostel → Achalay Hostel <info@hostelachalay.com>",
      "2.1 alojamiento [Budget Hotel] Hotel Plaza Bariloche → Hotel Concept Bariloche <centralreservas@grupotierragaucha.com.ar>",
      "3.1 alojamiento [Hotel 3*] Hotel 3* Kenton Palace → Kenton palace <reservas@kentonpalace.com.ar>",
      "3.2 alojamiento [Hotel 3*] Carlos V → Hotel Carlos V Patagonia <info@carlosvpatagonia.com.ar>",
      "4.1 alojamiento [Hotel 4*] Design Bariloche → Design Suites <reservas.brc@gruposolanas.com>",
      "4.2 alojamiento [Hotel 4*] NH Edelweiss → NH Edelweiss <rsvt.nhedelweiss@nh-hotels.com>",
      "5.1 traslado BRC - Accommodation - BRC → Turaccion <info@turaccion.com.ar>",
      "6.1 excursion Circuito Chico en ingles sin ticket al Campanario → Turaccion <info@turaccion.com.ar>",
      "7.1 excursion Isla victoria y bosque de arrayanes with transfers → Turaccion <info@turaccion.com.ar>",
    ]);
  });

  it("fila 2: noches por servicio de OD027 — Salta la noche 1 y las 3-4, Purmamarca la 2, en cada nivel", async () => {
    const { data, error } = await admin
      .from("producto_servicio_noches")
      .select("orden, noche_desde, noches, lugar")
      .eq("producto_id", await idDe("OD027"))
      .order("orden")
      .order("noche_desde");
    expect(error).toBeNull();
    expect(data!.map((n) => `${n.orden}:${n.noche_desde}+${n.noches} ${n.lugar}`)).toEqual([
      "1:1+1 Salta",
      "1:3+2 Salta",
      "2:1+1 Salta",
      "2:3+2 Salta",
      "3:1+1 Salta",
      "3:3+2 Salta",
      "4:2+1 Purmamarca",
    ]);
  });

  it("fila 2: los días de las excursiones apuntan al servicio que nombran", async () => {
    const nombre = async (codigo: string, orden: number) => (await servicios(codigo)).find((s) => s.orden === orden)!.service_provider_nombre;
    const dias = dato("dias-servicio.csv");
    expect(dias).toMatch(/^OD027,6,2,/m);
    expect(await nombre("OD027", 6)).toBe("Salinas y Purmamarca");
    expect(dias).toMatch(/^OD027,5,3,/m);
    expect(await nombre("OD027", 5)).toBe("Humahuaca");
    expect(dias).toMatch(/^OD024,6,2,/m);
    expect(await nombre("OD024", 6)).toBe("Circuito Chico en ingles sin ticket al Campanario");
    expect(dias).toMatch(/^OD024,7,3,/m);
    expect(await nombre("OD024", 7)).toBe("Isla victoria y bosque de arrayanes with transfers");
    expect(dias).toMatch(/^OD013,7,2,,,AR10,/m);
    expect(await nombre("OD013", 7)).toMatch(/Torres del Paine/);
    expect(dias).toMatch(/^OD013,6,3,,,AR10,/m);
    expect(await nombre("OD013", 6)).toMatch(/Perito Moreno/);
    expect(dias).toMatch(/^OD022,6,2,/m);
    expect(await nombre("OD022", 6)).toMatch(/Tierra del Fuego/);
    expect(dias).toMatch(/^OD022,5,3,/m);
    expect(await nombre("OD022", 5)).toMatch(/Beagle/);
  });

  it("fila 3: AR10 queda armado; noches del tour = suma de sus partes = 20", async () => {
    const t = primerosTours.tours.find((x) => x.codigo === "AR10")!;
    expect(t.estado, t.motivos.join(" | ")).toBe("armado");
    expect(t.noches).toBe(20);
    const d = await cargarProducto(admin, await idDe("AR10"));
    expect(
      d.componentes.map((c) =>
        c.tipo === "tramo_bus" ? `d${c.diaDesde} ${c.descripcionRuta}${c.nocturno ? " (nocturno)" : ""}` : `d${c.diaDesde} ${c.producto?.codigo} ${c.noches}n`,
      ),
    ).toEqual([
      "d1 OD027 4n",
      "d5 Salta – Mendoza (nocturno)",
      "d6 OD019 2n",
      "d8 Mendoza – Bariloche (nocturno)",
      "d9 OD024 3n",
      "d12 Bariloche – El Chaltén (nocturno)",
      "d13 OD033 2n",
      "d15 OD013 3n",
      "d18 El Calafate – Río Gallegos",
      "d18 Río Gallegos – Ushuaia",
      "d18 OD022 3n",
    ]);
    const nocturnos = d.componentes.filter((c) => c.tipo === "tramo_bus" && c.nocturno).length;
    expect(d.componentes.reduce((s, c) => s + (c.noches ?? 0), 0) + nocturnos).toBe(20);
  });

  it("fila 3: salida del 19 dic 2026 — las fechas de cada parte coinciden con el día a día del Word", async () => {
    const d = await cargarProducto(admin, await idDe("AR10"));
    const { data: prods } = await admin.from("producto").select("id, codigo");
    const codigoDe = new Map((prods ?? []).map((p) => [p.id, p.codigo]));
    const fechas = componentesDeLaReserva(d, "2026-12-19", { finalPuertoNatales: false, proveedorTransferPNT: null }).map(
      (c) => `${c.fechaInicio}→${c.fechaFin} ${c.tipo === "paquete" ? codigoDe.get(c.productoId!) : c.descripcionRuta}`,
    );
    expect(fechas).toEqual([
      "2026-12-19→2026-12-23 OD027", // días 1-5: Salta, Purmamarca la noche del 20
      "2026-12-23→2026-12-24 Salta – Mendoza", // día 5, bus nocturno
      "2026-12-24→2026-12-26 OD019", // días 6-8
      "2026-12-26→2026-12-27 Mendoza – Bariloche", // día 8, bus nocturno
      "2026-12-27→2026-12-30 OD024", // días 9-12
      "2026-12-30→2026-12-31 Bariloche – El Chaltén", // día 12, noche en el bus
      "2026-12-31→2027-01-02 OD033", // días 13-15
      "2027-01-02→2027-01-05 OD013", // días 15-18
      "2027-01-05→2027-01-05 El Calafate – Río Gallegos", // día 18, sale 3 am
      "2027-01-05→2027-01-05 Río Gallegos – Ushuaia", // día 18
      "2027-01-05→2027-01-08 OD022", // días 18-21
    ]);
  });

  it("fila 4: TourRadar 152848 y los nombres de AR10 apuntan a AR10", async () => {
    const { data, error } = await admin.from("codigo_externo").select("agencia, codigo, nombre_externo").eq("producto_id", await idDe("AR10"));
    expect(error).toBeNull();
    expect((data ?? []).map((c) => `${c.agencia} ${c.codigo} | ${c.nombre_externo ?? ""}`).sort()).toEqual([
      "HI Travel AR10 | ",
      "TourRadar 152848 | Full Argentina Adventure – 21 Days",
      "TourRadar full argentina adventure ( 21 days ) | Full Argentina Adventure ( 21 Days )",
      "TourRadar full argentina adventure - 21 days | Full Argentina Adventure - 21 Days",
    ]);
  });
});
