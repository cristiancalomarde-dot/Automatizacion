// @vitest-environment node
//
// Spec M2-08 — verificación 2 (regla #5), contra la base de pruebas de
// Supabase (nunca la real) y la planilla real de `Insumos/`. Supone la cadena
// de M1 recargada con el Excel de proveedores actualizado (proveedores →
// equivalencias → productos → paquetes → tours); este archivo corre
// `importarCatalogoJournaway` dos veces y consulta las filas 2 a 10 de §3.
//
// Lo cargado queda (es la carga, idempotente); solo se borran las filas de
// `importacion` de estas corridas. Las variantes que cambian un dato (un
// proveedor inventado, la planilla cambiada) se deshacen con una corrida
// normal al final.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarPendientes } from "@/lib/catalogo/consultas";
import { importarCatalogoJournaway, TIPO_CORRIDA_JOURNAWAY, type ResumenJournaway } from "@/lib/importador-journaway/importar";
import { ARCHIVOS_JOURNAWAY, hayPlanillaJournaway, leerInsumosJournaway, type InsumosJournaway } from "@/lib/importador-journaway/insumos";
import { limpiarNombreJournaway } from "@/lib/importador-journaway/nombres";
import { importarProductosSimples } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { importarToursCompuestos, TOURS_PILOTO } from "@/lib/importador-tours/importar";
import { hayInsumosTours, leerInsumosTours } from "@/lib/importador-tours/insumos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const RUTA_PAQUETES_IA = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas para IA.xlsm");
const CORRE = credencialesSupabaseDisponibles() && hayPlanillaJournaway(RAIZ) && hayInsumosTours(RAIZ) && existsSync(RUTA_PAQUETES_IA);
const TIMEOUT = 300_000;

interface Servicio {
  orden: number;
  prioridad: number;
  tipo_servicio: string;
  booking_supplier_nombre: string | null;
  booking_supplier_id: string | null;
  reserva_manual: boolean;
  proveedor_sin_resolver: boolean;
  proveedor_nota: string | null;
  descripcion: string;
  bs: { nombre: string; mails: string[] } | null;
}

(CORRE ? describe : describe.skip)("catálogo de Journaway contra la base de pruebas (spec M2-08)", () => {
  let admin: SupabaseClient;
  let insumos: InsumosJournaway;
  let primera: ResumenJournaway;
  let segunda: ResumenJournaway;
  let toursAntes: string;
  const importaciones: string[] = [];

  async function cargar(datos: InsumosJournaway = insumos) {
    const r = await importarCatalogoJournaway({ admin, insumos: datos });
    importaciones.push(r.importacionId);
    return r;
  }

  async function idDe(codigo: string): Promise<string> {
    const { data, error } = await admin.from("producto").select("id").eq("codigo", codigo).single();
    expect(error, codigo).toBeNull();
    return data!.id;
  }

  async function servicios(codigo: string): Promise<Servicio[]> {
    const { data, error } = await admin
      .from("producto_servicio")
      .select("orden, prioridad, tipo_servicio, booking_supplier_nombre, booking_supplier_id, reserva_manual, proveedor_sin_resolver, proveedor_nota, descripcion, bs:booking_supplier_id(nombre, mails)")
      .eq("producto_id", await idDe(codigo))
      .order("orden")
      .order("prioridad");
    expect(error).toBeNull();
    return data as unknown as Servicio[];
  }

  async function partes(codigo: string): Promise<string[]> {
    const { data, error } = await admin
      .from("producto_componente")
      .select("orden, dia_desde, comp:componente_producto_id(codigo)")
      .eq("producto_id", await idDe(codigo))
      .order("orden");
    expect(error).toBeNull();
    return (data as unknown as Array<{ dia_desde: number; comp: { codigo: string } }>).map((c) => `${c.comp.codigo} d${c.dia_desde}`);
  }

  async function ajustes(tour: string): Promise<string[]> {
    const { data, error } = await admin
      .from("tour_servicio_ajuste")
      .select("orden, accion, origen, paquete:paquete_id(codigo)")
      .eq("tour_id", await idDe(tour));
    expect(error).toBeNull();
    return (data as unknown as Array<{ orden: number; accion: string; origen: string; paquete: { codigo: string } }>)
      .map((a) => `${a.paquete.codigo}#${a.orden} ${a.accion} ${a.origen}`)
      .sort();
  }

  /** Lo que la app sabe de un grupo de productos, sin fechas ni ids (para comparar antes y después). */
  async function foto(codigos: string[]): Promise<string> {
    const { data: ps } = await admin.from("producto").select("id, codigo, nombre, destino, ciudades").in("codigo", codigos).order("codigo");
    const ids = (ps ?? []).map((p) => p.id);
    const codigoDe = new Map((ps ?? []).map((p) => [p.id, p.codigo]));
    const [svc, comp, aj, ce, no] = await Promise.all([
      admin.from("producto_servicio").select("producto_id, orden, prioridad, tipo_servicio, descripcion, booking_supplier_id, booking_supplier_nombre, proveedor_sin_resolver, reserva_manual, sentido").in("producto_id", ids).range(0, 9999),
      admin.from("producto_componente").select("producto_id, orden, dia_desde, componente_producto_id, transfer_in, transfer_out").in("producto_id", ids).range(0, 9999),
      admin.from("tour_servicio_ajuste").select("tour_id, paquete_id, orden, accion, texto, motivo, origen").in("tour_id", ids).range(0, 9999),
      admin.from("codigo_externo").select("producto_id, agencia, codigo, nombre_externo").in("producto_id", ids).range(0, 9999),
      admin.from("producto_servicio_noches").select("producto_id, orden, noche_desde, noches, lugar").in("producto_id", ids).range(0, 9999),
    ]);
    const orden = (filas: Array<Record<string, unknown>> | null, campo: string) =>
      (filas ?? []).map((f) => JSON.stringify({ ...f, [campo]: codigoDe.get(f[campo] as string) })).sort();
    return JSON.stringify({
      productos: ps?.map((p) => [p.codigo, p.nombre, p.destino, p.ciudades]),
      servicios: orden(svc.data, "producto_id"),
      partes: orden(comp.data, "producto_id"),
      ajustes: orden(aj.data, "tour_id"),
      codigos: orden(ce.data, "producto_id"),
      noches: orden(no.data, "producto_id"),
    });
  }

  async function codigosJournaway(): Promise<string[]> {
    const { data, error } = await admin.from("codigo_externo").select("producto:producto_id(codigo)").eq("agencia", "Journaway").range(0, 9999);
    expect(error).toBeNull();
    return [...new Set((data as unknown as Array<{ producto: { codigo: string } }>).map((c) => c.producto.codigo))].sort();
  }

  async function contar(tabla: string): Promise<number> {
    const { count, error } = await admin.from(tabla).select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    return count!;
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    insumos = leerInsumosJournaway(RAIZ);
    toursAntes = await foto(TOURS_PILOTO);
    primera = await cargar();
    segunda = await cargar();
  }, TIMEOUT);

  afterAll(async () => {
    if (importaciones.length) await admin.from("importacion").delete().in("id", importaciones);
  });

  it("#10 una segunda corrida no crea, cambia ni borra nada, y cada corrida queda en importacion", async () => {
    expect(segunda.creados).toEqual({ productos: 0, servicios: 0, noches: 0, componentes: 0, ajustes: 0, codigos: 0 });
    expect(segunda.actualizados).toEqual({ productos: 0, servicios: 0, noches: 0, componentes: 0, ajustes: 0, codigos: 0 });
    expect(segunda.eliminados).toEqual({ productos: 0, servicios: 0, noches: 0, componentes: 0, ajustes: 0, codigos: 0 });
    const { data } = await admin.from("importacion").select("tipo_corrida").in("id", [primera.importacionId, segunda.importacionId]);
    expect(data!.map((d) => d.tipo_corrida)).toEqual([TIPO_CORRIDA_JOURNAWAY, TIPO_CORRIDA_JOURNAWAY]);
  });

  it("#2 53 productos de Journaway: 46 simples, el Overland y los 6 SPAP; FTEE01, IPCH01 e IGRP01 a quien corresponde", async () => {
    const codigos = await codigosJournaway();
    expect(codigos).toHaveLength(53);
    const { data: conPartes } = await admin.from("producto_componente").select("producto:producto_id(codigo)").in("producto_id", await Promise.all(codigos.map(idDe)));
    expect([...new Set((conPartes as unknown as Array<{ producto: { codigo: string } }>).map((c) => c.producto.codigo))].sort()).toEqual(
      ["SPAP01", "SPAP02", "SPAP03", "SPAP04", "SPAP05", "SPAP06"],
    );
    const [ftee01] = await servicios("FTEE01");
    expect(ftee01).toMatchObject({ tipo_servicio: "excursion", proveedor_sin_resolver: false });
    expect(ftee01.bs!.nombre.trim()).toBe("Chalten Travel");
    const [ipch01] = await servicios("IPCH01");
    expect(ipch01.tipo_servicio).toBe("alojamiento");
    expect(ipch01.bs!.nombre.trim()).toBe("Vai Moana, proveedor CL Mundo");
    expect((await servicios("IGRP01"))[0].bs!.nombre).toMatch(/^Paquete 105 Premium desde Foz/);
  });

  it("#3 Cuenca del Plata: IGRP02, IGRT01 e IGRE03 resueltos, cada uno a su fila nueva con reservas8@ (owner, 2026-10-17)", async () => {
    const filas: Record<string, RegExp> = { IGRP02: /^PKT 101 x Foz/, IGRT01: /^Transfers IGU - Puerto Iguazu Hotels/, IGRE03: /^Ruinas de San Ignacio and Minas de Wanda/ };
    for (const [c, fila] of Object.entries(filas)) {
      const [s] = await servicios(c);
      expect(s.proveedor_sin_resolver, c).toBe(false);
      expect(s.bs!.nombre, c).toMatch(fila);
      expect(s.bs!.mails, c).toEqual(["reservas8@cuencadelplata.com"]);
    }
    expect((await servicios("IGRE01"))[0].bs!.nombre).toBe("Excursion Lado Argentino Premium IGRE01");
    expect((await servicios("IGRE02"))[0].bs!.nombre).toBe("Excursion Lado Brasilero Premium IGRE02");
  });

  it("#4 los datos del owner (a)-(h)", async () => {
    for (const c of ["IPCT01", "IPCE01", "IPCE02", "IPCE03", "IPCE04", "IPCE05", "IPCE06", "IPCE07", "IPCE08"]) {
      expect((await servicios(c))[0].bs?.nombre.trim(), c).toBe("Reservas Mahinatur");
    }
    expect((await servicios("IPCH01"))[0].proveedor_sin_resolver).toBe(false);
    expect((await servicios("BUS04"))[0].bs!.nombre.trim()).toBe("Chalten Travel");
    for (const c of ["BUS02", "BUS03"]) {
      const s = await servicios(c);
      expect(s.map((x) => [x.prioridad, x.booking_supplier_nombre, x.reserva_manual, x.booking_supplier_id === null])).toEqual([
        [1, "Plataforma10", true, true],
        [2, "Patagonia planet", false, false],
      ]);
    }
    const { data: plataforma } = await admin.from("proveedor").select("id").ilike("nombre", "%plataforma%");
    expect(plataforma).toEqual([]);
    const pendientes = await cargarPendientes(admin);
    expect(pendientes.filter((p) => ["BUS02", "BUS03"].includes(p.producto.codigo))).toEqual([]);
    const ftee03 = (await servicios("FTEE03"))[0];
    expect(ftee03.bs!.nombre.trim()).toBe("Nativo Experience, proveedor: Patagonia Profunda");
    const todos = await Promise.all((await codigosJournaway()).map(servicios));
    expect(JSON.stringify(todos).toLowerCase()).not.toContain("don raul");
    expect((await servicios("SPAT01"))[0]).toMatchObject({ reserva_manual: true, proveedor_sin_resolver: false, booking_supplier_id: null });
  }, TIMEOUT);

  it("#5 SPAP01 tiene 5 partes con sus días; SPAP03 termina con SPAT01", async () => {
    expect(await partes("SPAP01")).toEqual(["SPAT01 d1", "SPAE01 d1", "SPAE02 d2", "SPAE03 d2", "SPAE04 d3"]);
    expect(await partes("SPAP03")).toEqual(["SPAE07 d4", "SPAE06 d5", "SPAE05 d6", "SPAT01 d7"]);
  });

  it("#6 SPAP05 y SPAP06: 7 partes que terminan en SPAT02 → UYUO01; el Overland con sus 4 servicios a Imperio Inca", async () => {
    for (const c of ["SPAP05", "SPAP06"]) {
      const p = await partes(c);
      expect(p, c).toHaveLength(7);
      expect(p.slice(-2).map((x) => x.split(" ")[0])).toEqual(["SPAT02", "UYUO01"]);
      expect(p.join(" ")).not.toContain("COMPBO20");
    }
    const uyu = await servicios("UYUO01");
    expect(uyu.map((s) => s.tipo_servicio)).toEqual(["excursion", "alojamiento", "alojamiento", "bus"]);
    for (const s of uyu) {
      expect(s.proveedor_sin_resolver).toBe(false);
      expect(s.bs!.nombre.trim()).toBe("Imperio Inca");
    }
    expect(uyu[1].descripcion).toContain("Tayka del Desierto");
    expect(uyu[2].descripcion).toContain("Tayka de Sal");
    expect((await servicios("SPAT02"))[0].bs!.nombre.trim()).toBe("Imperio Inca");
  });

  it("#7 el lado del shuttle sale solo de la composición: ninguno en SPAP01/02/04, salida en SPAP03, llegada en SPAP05/06", async () => {
    for (const c of ["SPAP01", "SPAP02", "SPAP04"]) expect(await ajustes(c), c).toEqual([]);
    expect(await ajustes("SPAP03")).toEqual(["SPAT01#1 solo_salida excepcion"]);
    expect(await ajustes("SPAP05")).toEqual(["SPAT01#1 solo_llegada excepcion"]);
    expect(await ajustes("SPAP06")).toEqual(["SPAT01#1 solo_llegada excepcion"]);
  });

  it("#8 los nombres de los mails llevan al producto; los celestes llevan su código y los sin color no", async () => {
    const productoDe = async (nombre: string, limpiar = true) => {
      const codigo = limpiar ? limpiarNombreJournaway(nombre) : nombre;
      const { data } = await admin.from("codigo_externo").select("producto:producto_id(codigo)").eq("agencia", "Journaway").eq("codigo", codigo);
      return (data as unknown as Array<{ producto: { codigo: string } }>).map((d) => d.producto.codigo);
    };
    expect(await productoDe("Tour through the Moon Valley")).toEqual(["SPAE03"]);
    expect(await productoDe("Tour to the Quepiaco River, Monjes de la Pacana, and the Salt Flats")).toEqual(["SPAE05"]);
    expect(await productoDe("Half-day tour to the Argentinean side of Iguazú Falls")).toEqual(["IGRE01"]);
    expect(await productoDe("Siloli: Full-day tour to the Siloli Desert & the Black Lagoon")).toEqual(["UYUO01"]);
    expect(await productoDe("SPAE05", false)).toEqual(["SPAE05"]);
    expect(await productoDe("SPAE03", false)).toEqual([]);
    const { data: nombre } = await admin.from("codigo_externo").select("nombre_externo").eq("agencia", "Journaway").eq("codigo", "tour through the moon valley").single();
    expect(nombre!.nombre_externo).toBe("San Pedro de Atacama: Tour through the Moon Valley");
  });

  it("#9 el directorio recargado tiene Patagonia Profunda y Vai Moana; los 7 tours de M1 quedan igual", async () => {
    const { data: profunda } = await admin.from("proveedor").select("mails").eq("nombre_normalizado", "nativo experience, proveedor: patagonia profunda").single();
    expect([...profunda!.mails].sort()).toEqual(["producto@patagoniaprofunda.com", "reservas@patagoniaprofunda.com"]);
    const { data: vaiMoana } = await admin.from("proveedor").select("id").eq("nombre_normalizado", "vai moana, proveedor cl mundo");
    expect(vaiMoana).toHaveLength(1);
    expect(await foto(TOURS_PILOTO)).toBe(toursAntes);
  });

  it(
    "#7/#10 importar:productos e importar:tours después no tocan los productos ni los ajustes de Journaway",
    async () => {
      const codigos = await codigosJournaway();
      const antes = await foto(codigos);
      const tours = await importarToursCompuestos({ admin, ...leerInsumosTours(RAIZ) });
      importaciones.push(tours.importacionId);
      const productos = await importarProductosSimples({
        admin,
        rutaPaquetes: RUTA_PAQUETES_IA,
        rutaCodigosTourRadar: null,
        interpretarIA: null,
        nivelesConfirmados: parsearNivelesConfirmados(readFileSync(resolve(RAIZ, "data/niveles-confirmados.csv"), "utf-8")),
      });
      importaciones.push(productos.importacionId);
      expect(await foto(codigos)).toBe(antes);
    },
    TIMEOUT,
  );

  it("#10 un código de la planilla que ya es de otro catálogo (OD030) corta sin escribir nada", async () => {
    const antes = await Promise.all(["producto", "producto_servicio", "codigo_externo", "importacion"].map(contar));
    const cambiada = { ...insumos, planilla: insumos.planilla.map((f) => (f.codigo === "FTEE04" ? { ...f, codigo: "OD030" } : f)) };
    await expect(importarCatalogoJournaway({ admin, insumos: cambiada })).rejects.toThrow("OD030 ya es un producto de otro catálogo");
    expect(await Promise.all(["producto", "producto_servicio", "codigo_externo", "importacion"].map(contar))).toEqual(antes);
  });

  it("#5 una parte que no existe (SPAE99) corta sin escribir nada", async () => {
    const antes = await Promise.all(["producto_componente", "importacion"].map(contar));
    const texto = readFileSync(resolve(RAIZ, ARCHIVOS_JOURNAWAY.composicion), "utf-8").replace("SPAP01,5,3,SPAE04", "SPAP01,5,3,SPAE99");
    expect(() => leerInsumosJournaway(RAIZ, { textos: { composicion: texto } })).not.toThrow();
    await expect(importarCatalogoJournaway({ admin, insumos: leerInsumosJournaway(RAIZ, { textos: { composicion: texto } }) })).rejects.toThrow(/SPAE99/);
    expect(await Promise.all(["producto_componente", "importacion"].map(contar))).toEqual(antes);
  });

  describe("variantes que cambian un dato (se deshacen al final)", () => {
    afterAll(async () => {
      await cargar();
    }, TIMEOUT);

    it(
      "#3 un proveedor inventado queda sin resolver y no se crea; si el owner cambió la planilla, no se le pide al de antes",
      async () => {
        const proveedoresAntes = await contar("proveedor");
        const texto = readFileSync(resolve(RAIZ, ARCHIVOS_JOURNAWAY.proveedores), "utf-8").replace("FTEE05,South Road,", "FTEE05,Proveedor Fantasma,");
        const conFantasma = leerInsumosJournaway(RAIZ, { textos: { proveedores: texto } });
        const planillaCambiada = conFantasma.planilla.map((f) => (f.codigo === "FTEE04" ? { ...f, confirmado: "Rumbo sur" } : f));
        await cargar({ ...conFantasma, planilla: planillaCambiada });
        expect(await contar("proveedor")).toBe(proveedoresAntes);
        expect((await servicios("FTEE05"))[0]).toMatchObject({ booking_supplier_nombre: "Proveedor Fantasma", booking_supplier_id: null, proveedor_sin_resolver: true });
        const ftee04 = await servicios("FTEE04");
        expect(ftee04).toHaveLength(1);
        expect(ftee04[0]).toMatchObject({ booking_supplier_nombre: "Rumbo sur", booking_supplier_id: null, proveedor_sin_resolver: true });
        expect(ftee04[0].proveedor_nota).toMatch(/cambió en la planilla/i);
      },
      TIMEOUT,
    );
  });
});
