import { describe, expect, it } from "vitest";
import { medirRevision, textoMedicion, type MarcaParaMedir } from "./medicion-prueba";

// Spec M2-06 fila 14: % mal sobre las revisadas, % con el producto mal, y el
// veredicto (más del 20% mal = se frena) solo cuando están todas marcadas.

const bien = (): MarcaParaMedir => ({ resultado: "bien", queMal: [] });
const mal = (...queMal: string[]): MarcaParaMedir => ({ resultado: "mal", queMal: queMal.length ? queMal : ["fechas"] });
const lista = (n: number, f: () => MarcaParaMedir | null) => Array.from({ length: n }, f);

describe("medirRevision", () => {
  it("3 mal de 17 = 18%: se puede seguir", () => {
    const m = medirRevision([...lista(14, bien), ...lista(3, () => mal())]);
    expect(m).toMatchObject({ total: 17, revisadas: 17, faltan: 0, mal: 3, veredicto: "seguir" });
    expect(Math.round(m.porcentajeMal!)).toBe(18);
    expect(textoMedicion(m)).toBe("Revisadas 17 de 17 · 3 mal (18%) · se puede seguir");
  });

  it("4 mal de 17 = 24%: se frena, no activar M2-07", () => {
    const m = medirRevision([...lista(13, bien), ...lista(4, () => mal())]);
    expect(m.veredicto).toBe("frenar");
    expect(Math.round(m.porcentajeMal!)).toBe(24);
    expect(textoMedicion(m)).toBe("Revisadas 17 de 17 · 4 mal (24%) · se frena: no activar M2-07");
  });

  it("con 2 sin marcar: faltan 2 por revisar, sin veredicto", () => {
    const m = medirRevision([...lista(15, bien), null, null]);
    expect(m).toMatchObject({ revisadas: 15, faltan: 2, veredicto: null });
    expect(textoMedicion(m)).toBe("Revisadas 15 de 17 · 0 mal (0%) · faltan 2 por revisar");
  });

  it("el % con el producto mal va aparte (el número del PRD, riesgo #1)", () => {
    const m = medirRevision([...lista(8, bien), mal("producto", "fechas"), mal("vuelos")]);
    expect(m.productoMal).toBe(1);
    expect(m.porcentajeProductoMal).toBe(10);
    expect(m.porcentajeMal).toBe(20);
    expect(m.veredicto).toBe("seguir"); // 20% justo no pasa del 20%
  });

  it("sin ninguna revisada: sin %, ni veredicto", () => {
    const m = medirRevision([null, null]);
    expect(m).toMatchObject({ revisadas: 0, porcentajeMal: null, veredicto: null });
    expect(textoMedicion(m)).toBe("Revisadas 0 de 2 · faltan 2 por revisar");
  });
});
