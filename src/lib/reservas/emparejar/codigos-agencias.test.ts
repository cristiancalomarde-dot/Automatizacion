import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { armarCatalogo } from "./catalogo";
import { leerCodigosAgencias, planCargaCodigosAgencias } from "./codigos-agencias";
import { emparejarProducto } from "./emparejar";

/**
 * Spec M3-13 fila 2: `data/codigos-agencias.csv` (cómo nombra cada agencia nuestros productos,
 * para las que no son Kilroy ni TourRadar) y su carga a `codigo_externo` (la parte sin base).
 */

const CSV = readFileSync(join(process.cwd(), "data", "codigos-agencias.csv"), "utf-8");
const ENCABEZADO = "agencia,codigo_agencia,nombre_agencia,codigo_hi_travel,nota";

describe("M3-13 fila 2 — data/codigos-agencias.csv", () => {
  it("Adventure360: 'Rio de Janeiro to Santiago' es BRARCH26, con la nota del owner", () => {
    const filas = leerCodigosAgencias(CSV);
    const fila = filas.find((f) => f.agencia === "Adventure360");
    expect(fila).toMatchObject({ nombreAgencia: "Rio de Janeiro to Santiago", codigoHiTravel: "BRARCH26" });
    expect(fila?.nota).toMatch(/owner/i);
  });

  it("sin código de la agencia, el código es el nombre normalizado (como lo que se aprende al confirmar, M3-05)", () => {
    const [f] = leerCodigosAgencias(`${ENCABEZADO}\nAdventure360,,Rio de  Janeiro to Santiago,BRARCH26,nota`);
    expect(f.codigoAgencia).toBe("rio de janeiro to santiago");
    expect(f.nombreAgencia).toBe("Rio de  Janeiro to Santiago");
  });

  it("una fila incompleta o repetida es un error con su número de fila", () => {
    expect(() => leerCodigosAgencias(`${ENCABEZADO}\n,,Algo,BRARCH26,`)).toThrow(/fila 2.*agencia/);
    expect(() => leerCodigosAgencias(`${ENCABEZADO}\nAdventure360,,Algo,,`)).toThrow(/fila 2.*HI Travel/);
    expect(() => leerCodigosAgencias(`${ENCABEZADO}\nAdventure360,,,BRARCH26,`)).toThrow(/fila 2/);
    expect(() => leerCodigosAgencias(`${ENCABEZADO}\nAdventure360,,Algo,BRARCH26,\nAdventure360,,algo,ARCH31,`)).toThrow(/fila 3/);
  });

  it("un código HI Travel que no existe hace fallar la carga entera con un mensaje claro", () => {
    const filas = leerCodigosAgencias(`${ENCABEZADO}\nAdventure360,,Algo,NOEXISTE,`);
    expect(() => planCargaCodigosAgencias(filas, new Map([["BRARCH26", "id-brarch26"]]))).toThrow(
      "codigos-agencias.csv fila 2: el código HI Travel NOEXISTE no existe en el catálogo (Adventure360 Algo). No se cargó nada.",
    );
  });

  it("el plan de carga es (producto, agencia, código, nombre) por fila", () => {
    const filas = leerCodigosAgencias(CSV).filter((f) => f.agencia === "Adventure360");
    expect(planCargaCodigosAgencias(filas, new Map([["BRARCH26", "id-brarch26"]]))).toEqual([
      { productoId: "id-brarch26", agencia: "Adventure360", codigo: "rio de janeiro to santiago", nombre: "Rio de Janeiro to Santiago" },
    ]);
  });

  it("con la carga hecha, el emparejado reconoce el tour de Adventure360 como BRARCH26 por el nombre (paso 2, sin IA)", async () => {
    const plan = planCargaCodigosAgencias(
      leerCodigosAgencias(CSV).filter((f) => f.agencia === "Adventure360"),
      new Map([["BRARCH26", "id-brarch26"]]),
    );
    const catalogo = armarCatalogo({
      productos: [{ id: "id-brarch26", codigo: "BRARCH26", nombre: "From Rio de Janeiro to Santiago de Chile", ciudades: [], destino: null }],
      codigos: plan.map((c) => ({ producto_id: c.productoId, agencia: c.agencia, codigo: c.codigo, nombre_externo: c.nombre })),
      componentes: [],
      buses: [],
    });
    for (const nombre of ["Rio de Janeiro to Santiago", "rio de janeiro  to SANTIAGO"]) {
      const r = await emparejarProducto({ nombre, codigo: null, fechaInicio: "2026-11-10", fechaFin: null }, { agencia: "Adventure360", catalogo });
      expect(r.producto?.codigo, nombre).toBe("BRARCH26");
      expect(r.origen).toBe("nombre");
    }
    // De otra agencia, el mismo nombre no se reconoce sin la IA.
    const otra = await emparejarProducto({ nombre: "Rio de Janeiro to Santiago", codigo: null, fechaInicio: null, fechaFin: null }, { agencia: "Kilroy", catalogo });
    expect(otra.producto).toBeNull();
  });
});
