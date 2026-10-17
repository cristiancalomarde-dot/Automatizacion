import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crearIndiceProveedores } from "@/lib/importador-productos/proveedores";
import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { parsearComposicion, parsearInternos } from "./composicion";
import { limpiarNombreJournaway, parsearNombres } from "./nombres";
import { planificarJournaway } from "./plan";
import { RUTA_PLANILLA_JOURNAWAY, abrirPlanillaJournaway, leerPlanillaJournaway } from "./planilla";
import { parsearProveedoresJournaway } from "./proveedores";
import { ARCHIVOS_JOURNAWAY } from "./insumos";

// Spec M2-08 §3 #2, #4-#8: la planilla real con los archivos de data/ que
// arma el builder, sin base (el directorio es uno de mentira con los nombres
// del archivo de proveedores, salvo la fila general de Cuenca del Plata).

const RAIZ = resolve(__dirname, "..", "..", "..");
const HAY = existsSync(resolve(RAIZ, RUTA_PLANILLA_JOURNAWAY));
const leer = (ruta: string) => readFileSync(resolve(RAIZ, ruta), "utf-8");

(HAY ? describe : describe.skip)("el catálogo de Journaway con la planilla real y data/", () => {
  const proveedores = parsearProveedoresJournaway(leer(ARCHIVOS_JOURNAWAY.proveedores));
  const nombresDirectorio = [...new Set(proveedores.filter((p) => p.modo === "alias").map((p) => p.proveedor))].filter(
    (n) => n !== "Cuenca del Plata, mail general",
  );
  const indice = crearIndiceProveedores(nombresDirectorio.map((n) => ({ id: `id:${n}`, nombre_normalizado: normalizarNombre(n) })));
  const plan = planificarJournaway({
    planilla: leerPlanillaJournaway(abrirPlanillaJournaway(resolve(RAIZ, RUTA_PLANILLA_JOURNAWAY))),
    proveedores,
    composicion: parsearComposicion(leer(ARCHIVOS_JOURNAWAY.composicion)),
    internos: parsearInternos(leer(ARCHIVOS_JOURNAWAY.internos)),
    nombres: parsearNombres(leer(ARCHIVOS_JOURNAWAY.nombres)),
    indice,
  });
  const p = (codigo: string) => plan.productos.find((x) => x.codigo === codigo)!;
  const bs = (codigo: string) => p(codigo).servicios.map((s) => s.booking_supplier_nombre);

  it("53 productos: 46 simples de la planilla, el Overland interno y los 6 paquetes SPAP", () => {
    expect(plan.productos).toHaveLength(53);
    expect(plan.productos.filter((x) => x.componentes.length > 0).map((x) => x.codigo).sort()).toEqual(
      ["SPAP01", "SPAP02", "SPAP03", "SPAP04", "SPAP05", "SPAP06"],
    );
    expect(plan.productos.filter((x) => x.componentes.length === 0 && !x.interno)).toHaveLength(46);
  });

  it("los paquetes de un solo proveedor son simples (IGRP01, IGRP02, IPCP01, IPCP02); el W Trek es 'otro'", () => {
    for (const c of ["IGRP01", "IGRP02", "IPCP01", "IPCP02"]) expect(p(c).servicios).toHaveLength(1);
    expect(p("PNTW01").servicios[0].tipo_servicio).toBe("otro");
    expect(p("IPCH01").servicios[0].tipo_servicio).toBe("alojamiento");
  });

  it("los datos del owner (a)-(h)", () => {
    for (const c of ["IPCT01", "IPCE01", "IPCE02", "IPCE03", "IPCE04", "IPCE05", "IPCE06", "IPCE07", "IPCE08"]) {
      expect(bs(c), c).toEqual(["Reservas Mahinatur"]);
    }
    expect(bs("IPCH01")).toEqual(["Vai Moana, proveedor CL Mundo"]);
    expect(bs("BUS04")).toEqual(["Chalten Travel"]);
    for (const c of ["BUS02", "BUS03"]) {
      expect(p(c).servicios.map((s) => [s.prioridad, s.booking_supplier_nombre, s.reserva_manual, s.booking_supplier_id])).toEqual([
        [1, "Plataforma10", true, null],
        [2, "Patagonia planet", false, "id:Patagonia planet"],
      ]);
    }
    expect(bs("FTEE03")).toEqual(["Nativo Experience, proveedor: Patagonia Profunda"]);
    expect(JSON.stringify(plan.productos.map((x) => x.servicios)).toLowerCase()).not.toContain("don raul");
    expect(p("SPAT01").servicios[0]).toMatchObject({ reserva_manual: true, proveedor_sin_resolver: false });
  });

  it("IGRP02, IGRT01 e IGRE03 van al mail general de Cuenca del Plata, que no está en el directorio", () => {
    for (const c of ["IGRP02", "IGRT01", "IGRE03"]) {
      expect(p(c).servicios[0], c).toMatchObject({ booking_supplier_nombre: "Cuenca del Plata, mail general", proveedor_sin_resolver: true });
    }
    expect(plan.productos.flatMap((x) => x.servicios).filter((s) => s.proveedor_sin_resolver)).toHaveLength(3);
  });

  it("SPAP01 tiene 5 partes en orden con sus días; SPAP03 termina con el shuttle solo de salida", () => {
    expect(p("SPAP01").componentes.map((c) => `${c.codigo} d${c.dia}`)).toEqual(["SPAT01 d1", "SPAE01 d1", "SPAE02 d2", "SPAE03 d2", "SPAE04 d3"]);
    expect(p("SPAP03").componentes.map((c) => c.codigo)).toEqual(["SPAE07", "SPAE06", "SPAE05", "SPAT01"]);
    expect(p("SPAP03").ajustes).toEqual([expect.objectContaining({ paquete: "SPAT01", accion: "solo_salida" })]);
    for (const c of ["SPAP01", "SPAP02", "SPAP04"]) expect(p(c).ajustes, c).toEqual([]);
  });

  it("SPAP05 y SPAP06: 7 partes, terminan en SPAT02 → UYUO01, con el shuttle solo de llegada y sin el Overland compartido", () => {
    for (const c of ["SPAP05", "SPAP06"]) {
      const partes = p(c).componentes.map((x) => x.codigo);
      expect(partes, c).toHaveLength(7);
      expect(partes.slice(-2)).toEqual(["SPAT02", "UYUO01"]);
      expect(partes).not.toContain("COMPBO20");
      expect(p(c).ajustes).toEqual([expect.objectContaining({ paquete: "SPAT01", accion: "solo_llegada" })]);
    }
    expect(p("SPAP06").componentes.at(-1)!.dia).toBe(6);
    expect(p("UYUO01").servicios.map((s) => [s.tipo_servicio, s.booking_supplier_nombre])).toEqual([
      ["excursion", "Imperio Inca"],
      ["alojamiento", "Imperio Inca"],
      ["alojamiento", "Imperio Inca"],
      ["bus", "Imperio Inca"],
    ]);
    expect(bs("SPAT02")).toEqual(["Imperio Inca"]);
  });

  it("los nombres de los mails llevan al producto; los celestes llevan su código y los 8 sin color no", () => {
    const deNombre = (nombre: string) =>
      plan.productos.filter((x) => x.codigos.some((c) => c.codigo === limpiarNombreJournaway(nombre))).map((x) => x.codigo);
    expect(deNombre("San Pedro de Atacama: Tour through the Moon Valley")).toEqual(["SPAE03"]);
    expect(deNombre("Tour to the Quepiaco River, Monjes de la Pacana, and the Salt Flats")).toEqual(["SPAE05"]);
    expect(deNombre("Half-day tour to the Argentinean side of Iguazú Falls")).toEqual(["IGRE01"]);
    expect(deNombre("Siloli: Full-day tour to the Siloli Desert & the Black Lagoon")).toEqual(["UYUO01"]);
    expect(p("SPAE05").codigos[0]).toEqual({ codigo: "SPAE05", nombreExterno: null });
    expect(p("SPAE03").codigos.some((c) => c.codigo === "SPAE03")).toBe(false);
    expect(plan.productos.filter((x) => x.codigos.some((c) => c.codigo === x.codigo))).toHaveLength(44);
  });
});
