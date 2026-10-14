import { describe, expect, it, vi } from "vitest";
import { catalogoDePrueba, idDe, noCargadosDePrueba } from "./__fixtures__/cargar";
import { lectorPorEnvoltorio, LECTORES_POR_AGENCIA, type LectorDeAgencia } from "./agencias";
import { armarCatalogo } from "./catalogo";
import { emparejarProducto, UMBRAL_CONFIANZA_PRODUCTO, type ProponerProducto } from "./emparejar";

/**
 * Spec M2-03 filas 1-7 y 15: los tres pasos (código exacto → nombre de la
 * agencia → propuesta de la IA), con el catálogo real (foto) y la IA simulada.
 */

const pedido = (nombre: string, codigo: string | null = null, fechaInicio: string | null = null, fechaFin: string | null = null) => ({
  nombre,
  codigo,
  fechaInicio,
  fechaFin,
});

/** Una IA simulada que contesta siempre lo mismo. */
function iaQueDice(codigo: string | null, confianza: number) {
  const proponer = vi.fn<ProponerProducto>(async () => ({
    resultado: { tipo: "respuesta", codigo, confianza, motivo: "simulada" },
    llamada: null,
    costo: 0.01,
  }));
  return proponer;
}

function iaQueFalla(causa: "techo" | "error") {
  return vi.fn<ProponerProducto>(async () => ({ resultado: { tipo: "fallo", causa }, llamada: null, costo: 0 }));
}

describe("M2-03 fila 1 — paso 1: código exacto de la agencia", () => {
  const catalogo = catalogoDePrueba();

  it.each([
    ["HI_ARGENTINA_OD010D-677", "OD010D"],
    ["HI_ARGENTINA_ARCH31-677", "ARCH31"],
    ["HI_TRAVEL_5C01-677", "5C01"],
    ["HI_TRAVEL_BOCHI04R-677", "BOCHI04R"],
  ])("%s → %s, origen código, sin IA", async (codigo, esperado) => {
    const proponer = iaQueDice("OD030", 0.99);
    const r = await emparejarProducto(pedido("x", codigo), { agencia: "Kilroy", catalogo, proponer });
    expect(r.producto?.codigo).toBe(esperado);
    expect(r.origen).toBe("codigo");
    expect(r.confianza).toBe(1);
    expect(r.motivo).toBeNull();
    expect(proponer).not.toHaveBeenCalled();
  });

  it("no debe pasar: HI_ARGENTINA_W_TREK_ARCH_33-677 no se acepta como ARCH33 por parecido (sin la fila del CSV)", async () => {
    const proponer = iaQueDice("ARCH33", 0.99);
    const r = await emparejarProducto(pedido("Patagonia, Trekking Paradise with W-Trek", "HI_ARGENTINA_W_TREK_ARCH_33-677"), {
      agencia: "Kilroy",
      catalogo: catalogoDePrueba({ codigosKilroy: false }),
      proponer,
    });
    expect(r.producto).toBeNull();
    expect(r.motivo).toContain("no está en el catálogo");
    expect(proponer).not.toHaveBeenCalled();
  });

  it("no debe pasar: HI_TRAVEL_ARCH_EXP-677 nunca se empareja con ARCH33 ni con ARCH31", async () => {
    const r = await emparejarProducto(pedido("Patagonia, Trekking Paradise with W-Trek EXPRESS", "HI_TRAVEL_ARCH_EXP-677"), {
      agencia: "Kilroy",
      catalogo,
      proponer: iaQueDice("ARCH33", 0.99),
    });
    expect(r.producto).toBeNull();
    expect(r.sugerencia).toBeNull();
  });

  it("el código se busca solo en las filas de ESA agencia", async () => {
    // "160955" es un código de TourRadar (OD010A): para Kilroy no existe.
    const r = await emparejarProducto(pedido("x", "160955"), { agencia: "Kilroy", catalogo, proponer: iaQueDice("OD010A", 1) });
    expect(r.producto).toBeNull();
  });
});

describe("M2-03 fila 2 — los códigos Kilroy que no siguen la regla (data/codigos-kilroy.csv)", () => {
  const catalogo = catalogoDePrueba();

  it("el Kilroy de CHB31 (DK1547743) se empareja en el paso 1", async () => {
    const r = await emparejarProducto(
      pedido("Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days", "HI_ARGENTINA_OVERLAND_7DAYS-677"),
      { agencia: "Kilroy", catalogo },
    );
    expect(r.producto?.codigo).toBe("CHB31");
    expect(r.origen).toBe("codigo");
  });

  it("el TOUR 1 de DK1576932 (W_TREK_ARCH_33) se empareja en el paso 1 con ARCH33", async () => {
    const r = await emparejarProducto(pedido("Patagonia, Trekking Paradise with W-Trek (12 Days)", "HI_ARGENTINA_W_TREK_ARCH_33-677"), {
      agencia: "Kilroy",
      catalogo,
    });
    expect(r.producto?.codigo).toBe("ARCH33");
    expect(r.origen).toBe("codigo");
  });
});

describe("M2-03 fila 3 — paso 2: el nombre que usa la agencia", () => {
  const catalogo = catalogoDePrueba();

  it("TourRadar 'Iguazu Falls on a Shoestring (3N)' → OD010A, origen nombre, sin IA", async () => {
    const proponer = iaQueDice("OD010B", 0.99);
    const r = await emparejarProducto(pedido("Iguazu Falls on a Shoestring (3N)"), { agencia: "TourRadar", catalogo, proponer });
    expect(r.producto?.codigo).toBe("OD010A");
    expect(r.origen).toBe("nombre");
    expect(proponer).not.toHaveBeenCalled();
  });

  it("ignora mayúsculas, espacios dobles y acentos (el de OD011 tiene un espacio doble cargado)", async () => {
    const r = await emparejarProducto(pedido("iguazú glamping (4 DAYS)"), { agencia: "TourRadar", catalogo });
    expect(r.producto?.codigo).toBe("OD011");
  });

  it("no debe pasar: 'Iguazu Falls on a Shoestring Brazil (4 days)' no cae en OD010A (es OD010B)", async () => {
    const r = await emparejarProducto(pedido("Iguazu Falls on a Shoestring Brazil (4 days)"), { agencia: "TourRadar", catalogo });
    expect(r.producto?.codigo).toBe("OD010B");
  });

  it("no debe pasar: un nombre de TourRadar no se compara contra nombres de Kilroy", async () => {
    // El nombre Kilroy de CHB31 (codigos-kilroy.csv) no vale para un mail de TourRadar.
    const proponer = iaQueDice(null, 0.5);
    const r = await emparejarProducto(pedido("Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days"), {
      agencia: "TourRadar",
      catalogo,
      proponer,
    });
    expect(r.origen).not.toBe("nombre");
    expect(r.producto).toBeNull();
    expect(proponer).toHaveBeenCalledOnce();
  });

  it("no hay 'contiene': un nombre más largo que el guardado no matchea", async () => {
    const proponer = iaQueDice(null, 0.95);
    const r = await emparejarProducto(pedido("Iguazu Falls on a Shoestring (3N) + extra night"), {
      agencia: "TourRadar",
      catalogo,
      proponer,
    });
    expect(r.origen).not.toBe("nombre");
    expect(proponer).toHaveBeenCalledOnce();
  });
});

describe("M2-03 fila 4 — paso 3: la propuesta de la IA", () => {
  const catalogo = catalogoDePrueba();
  const overland = pedido("Overland San Pedro de Atacama to Uyuni end in La Paz (7 Days)", null, "2026-10-11", null);

  it("el umbral arranca en 0,9", () => {
    expect(UMBRAL_CONFIANZA_PRODUCTO).toBe(0.9);
  });

  it("el Overland de TourRadar con CHB31 y confianza 0,95 → CHB31, origen IA", async () => {
    const proponer = iaQueDice("CHB31", 0.95);
    const r = await emparejarProducto(overland, { agencia: "TourRadar", catalogo, proponer });
    expect(r.producto?.codigo).toBe("CHB31");
    expect(r.origen).toBe("ia");
    expect(r.confianza).toBe(0.95);
    expect(r.motivo).toBeNull();
    // La IA recibe la lista cerrada del catálogo cargado y lo que dijo el mail.
    const entrada = proponer.mock.calls[0][0];
    expect(entrada.lista.map((p) => p.codigo)).toEqual(expect.arrayContaining(["CHB31", "AR09", "OD010A", "5C01"]));
    expect(entrada.lista.find((p) => p.codigo === "AR09")?.noches).toBe(15);
    expect(entrada.pedido.nombre).toBe(overland.nombre);
  });

  it("no debe pasar: con confianza 0,7 queda para revisión, con la sugerencia a la vista y sin aceptarla", async () => {
    const r = await emparejarProducto(overland, { agencia: "TourRadar", catalogo, proponer: iaQueDice("CHB31", 0.7) });
    expect(r.producto).toBeNull();
    expect(r.origen).toBeNull();
    expect(r.sugerencia?.producto.codigo).toBe("CHB31");
    expect(r.sugerencia?.confianza).toBe(0.7);
    expect(r.motivo).toMatch(/no se pudo reconocer con seguridad/i);
    expect(r.motivo).toContain("CHB31");
  });

  it("no debe pasar: un código que no está en la lista se descarta", async () => {
    const r = await emparejarProducto(overland, { agencia: "TourRadar", catalogo, proponer: iaQueDice("CHB99", 0.99) });
    expect(r.producto).toBeNull();
    expect(r.sugerencia).toBeNull();
    expect(r.motivo).toMatch(/no se pudo reconocer con seguridad/i);
  });

  it("no debe pasar: AR09 (15 noches) para un mail de 9 noches no se acepta", async () => {
    const r = await emparejarProducto(pedido("Patagonia Adventure", null, "2026-11-20", "2026-11-29"), {
      agencia: "TourRadar",
      catalogo,
      proponer: iaQueDice("AR09", 0.97),
    });
    expect(r.producto).toBeNull();
    expect(r.sugerencia?.producto.codigo).toBe("AR09");
    expect(r.motivo).toContain("15 noches");
    expect(r.motivo).toContain("9");
  });

  it("AR09 con las 15 noches del mail sí se acepta", async () => {
    const r = await emparejarProducto(pedido("Patagonia Adventure", null, "2026-11-20", "2026-12-05"), {
      agencia: "TourRadar",
      catalogo,
      proponer: iaQueDice("AR09", 0.97),
    });
    expect(r.producto?.codigo).toBe("AR09");
  });

  it("sin la IA disponible (no se pasó quien proponga), queda para revisión", async () => {
    const r = await emparejarProducto(overland, { agencia: "TourRadar", catalogo });
    expect(r.producto).toBeNull();
    expect(r.motivo).toBeTruthy();
  });
});

describe("M2-03 fila 5 — código desconocido = no cargado (sin IA)", () => {
  const catalogo = catalogoDePrueba();

  it("HI_TRAVEL_ARCH_EXP-677 → motivo con el código y el nombre, sin gasto de IA", async () => {
    const proponer = iaQueDice("ARCH33", 0.99);
    const r = await emparejarProducto(pedido("Patagonia, Trekking Paradise with W-Trek EXPRESS", "HI_TRAVEL_ARCH_EXP-677"), {
      agencia: "Kilroy",
      catalogo,
      proponer,
    });
    expect(r.motivo).toBe(
      "El producto HI_TRAVEL_ARCH_EXP-677 (Patagonia, Trekking Paradise with W-Trek EXPRESS) no está en el catálogo",
    );
    expect(r.costo).toBe(0);
    expect(proponer).not.toHaveBeenCalled();
  });

  it("HI_ARGENTINA_OD014-677 → no está en el catálogo, sin IA", async () => {
    const proponer = iaQueDice("OD013", 0.99);
    const r = await emparejarProducto(pedido("El Calafate & El Chalten full day - 4 nights", "HI_ARGENTINA_OD014-677"), {
      agencia: "Kilroy",
      catalogo,
      proponer,
    });
    expect(r.producto).toBeNull();
    expect(r.motivo).toContain("HI_ARGENTINA_OD014-677");
    expect(r.motivo).toContain("no está en el catálogo");
    expect(proponer).not.toHaveBeenCalled();
  });
});

describe("M2-03 fila 6 — 'ninguno' también es respuesta", () => {
  const catalogo = catalogoDePrueba();
  const baRio = pedido("Buenos Aires to Rio de Janeiro 12 Days", null, "2026-11-10");

  it("'Buenos Aires to Rio de Janeiro 12 Days' → ninguno con confianza → no está en el catálogo", async () => {
    const r = await emparejarProducto(baRio, { agencia: "TourRadar", catalogo, proponer: iaQueDice(null, 0.95) });
    expect(r.producto).toBeNull();
    expect(r.motivo).toContain("no está en el catálogo");
  });

  it("'Heart of the River Plate' (ARUY01, no cargado) → ninguno → no está en el catálogo", async () => {
    const r = await emparejarProducto(pedido("Argentina and Uruguay, heart of the River Plate (7 days)"), {
      agencia: "TourRadar",
      catalogo,
      proponer: iaQueDice(null, 0.92),
    });
    expect(r.motivo).toContain("no está en el catálogo");
  });

  it("'ninguno' con poca confianza → no se pudo reconocer con seguridad", async () => {
    const r = await emparejarProducto(baRio, { agencia: "TourRadar", catalogo, proponer: iaQueDice(null, 0.5) });
    expect(r.motivo).toMatch(/no se pudo reconocer con seguridad/i);
  });

  it("no debe pasar: que quede como BRARCH26 con poca confianza", async () => {
    const r = await emparejarProducto(baRio, { agencia: "TourRadar", catalogo, proponer: iaQueDice("BRARCH26", 0.6) });
    expect(r.producto).toBeNull();
  });
});

describe("M2-03 fila 7 — la IA bajo el techo de gasto", () => {
  const catalogo = catalogoDePrueba();
  const overland = pedido("Overland San Pedro de Atacama to Uyuni end in La Paz (7 Days)", null, "2026-10-11");

  it("techo agotado → motivo del techo", async () => {
    const r = await emparejarProducto(overland, { agencia: "TourRadar", catalogo, proponer: iaQueFalla("techo") });
    expect(r.producto).toBeNull();
    expect(r.motivo).toBe("No se usó la IA: se llegó al techo de gasto del mes");
  });

  it("error de la API → La IA no respondió", async () => {
    const r = await emparejarProducto(overland, { agencia: "TourRadar", catalogo, proponer: iaQueFalla("error") });
    expect(r.motivo).toBe("La IA no respondió");
  });
});

describe("M2-03 fila 15 — sumar una agencia no cambia el núcleo", () => {
  it("una agencia de prueba con su propia regla se empareja sin tocar los tres pasos", async () => {
    const base = catalogoDePrueba();
    const catalogo = armarCatalogo({
      productos: base.productos.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, ciudades: p.ciudades, destino: null })),
      componentes: [],
      buses: [],
      codigos: [{ producto_id: idDe("OD030"), agencia: "Agencia X", codigo: "SPA-3N", nombre_externo: "San Pedro Explorer" }],
    });
    // Agencia X escribe "AX:SPA-3N:2026".
    const agenciaX: LectorDeAgencia = { usaCodigo: true, codigosCandidatos: (c) => [c.split(":")[1] ?? c] };
    const lectores = { ...LECTORES_POR_AGENCIA, "Agencia X": agenciaX };

    const porCodigo = await emparejarProducto(pedido("x", "AX:SPA-3N:2026"), { agencia: "Agencia X", catalogo, lectores });
    expect(porCodigo.producto?.codigo).toBe("OD030");
    expect(porCodigo.origen).toBe("codigo");

    const porNombre = await emparejarProducto(pedido("SAN PEDRO  EXPLORER"), { agencia: "Agencia X", catalogo, lectores });
    expect(porNombre.producto?.codigo).toBe("OD030");
    expect(porNombre.origen).toBe("nombre");

    const desconocido = await emparejarProducto(pedido("y", "AX:NADA:2026"), { agencia: "Agencia X", catalogo, lectores });
    expect(desconocido.motivo).toContain("no está en el catálogo");
  });

  it("el lector Kilroy saca el envoltorio y deja también el código completo", () => {
    const kilroy = lectorPorEnvoltorio(/^HI_(?:ARGENTINA|TRAVEL)_(.+)-677$/);
    expect(kilroy.codigosCandidatos("HI_ARGENTINA_OD010D-677")).toEqual(["OD010D", "HI_ARGENTINA_OD010D-677"]);
    expect(kilroy.codigosCandidatos("OD010D")).toEqual(["OD010D"]);
    // Owner 2026-10-14: TourRadar trae número de tour; el paso 1 también le sirve.
    expect(LECTORES_POR_AGENCIA.TourRadar.usaCodigo).toBe(true);
    expect(LECTORES_POR_AGENCIA.TourRadar.codigosCandidatos(" 150146 ")).toEqual(["150146"]);
  });
});

describe("Productos y códigos (owner, 2026-10-14) — productos conocidos que no están cargados", () => {
  const catalogo = catalogoDePrueba();
  const noCargados = noCargadosDePrueba();
  const textoNoCargado = (codigo: string, nombre: string) =>
    `El producto ${codigo} (${nombre}) existe en el catálogo de HI Travel pero todavía no está cargado en el sistema.`;

  it("Kilroy HI_TRAVEL_ARCH_EXP-677 → ARCH33EXP no cargado, sin IA", async () => {
    const proponer = iaQueDice("ARCH33", 0.99);
    const r = await emparejarProducto(pedido("Patagonia, Trekking Paradise with W-Trek EXPRESS", "HI_TRAVEL_ARCH_EXP-677"), {
      agencia: "Kilroy",
      catalogo,
      proponer,
      noCargados,
    });
    expect(r.producto).toBeNull();
    expect(r.motivo).toBe(textoNoCargado("ARCH33EXP", "Patagonia, Trekking Paradise with W-Trek EXPRESS"));
    expect(r.costo).toBe(0);
    expect(proponer).not.toHaveBeenCalled();
  });

  it.each([
    ["150104", "ARBR23", "From Buenos Aires to Rio"],
    ["317766", "ARUY01", "Argentina and Uruguay, heart of the River Plate"],
    ["275366", "ARCH33EXP", "Patagonia, Trekking Paradise with W-Trek EXPRESS"],
  ])("TourRadar número de tour %s → %s no cargado, sin IA", async (codigo, esperado, nombre) => {
    const proponer = iaQueDice("BRARCH26", 0.99);
    const r = await emparejarProducto(pedido("x", codigo), { agencia: "TourRadar", catalogo, proponer, noCargados });
    expect(r.producto).toBeNull();
    expect(r.motivo).toBe(textoNoCargado(esperado, nombre));
    expect(proponer).not.toHaveBeenCalled();
  });

  it("TourRadar sin número, con el nombre del PDF 1377583 → ARBR23 no cargado, sin IA", async () => {
    const proponer = iaQueDice(null, 0.95);
    const r = await emparejarProducto(pedido("Buenos Aires to Rio de Janeiro 12 Days", null, "2026-11-10"), {
      agencia: "TourRadar",
      catalogo,
      proponer,
      noCargados,
    });
    expect(r.motivo).toBe(textoNoCargado("ARBR23", "From Buenos Aires to Rio"));
    expect(proponer).not.toHaveBeenCalled();
  });

  it("TourRadar 150146 → AR09 por código (data/codigos-tourradar.csv), sin IA", async () => {
    const proponer = iaQueDice("BRARCH26", 0.99);
    const r = await emparejarProducto(pedido("Patagonia Adventure Tour 16 Days", "150146"), { agencia: "TourRadar", catalogo, proponer, noCargados });
    expect(r.producto?.codigo).toBe("AR09");
    expect(r.origen).toBe("codigo");
    expect(proponer).not.toHaveBeenCalled();
  });

  it("TourRadar con un número de tour que no está cargado sigue por el nombre (la lista de TourRadar está a medio cargar)", async () => {
    const proponer = iaQueDice("OD010B", 0.99);
    const r = await emparejarProducto(pedido("Iguazu Falls on a Shoestring (3N)", "999999"), { agencia: "TourRadar", catalogo, proponer, noCargados });
    expect(r.producto?.codigo).toBe("OD010A");
    expect(r.origen).toBe("nombre");
    expect(proponer).not.toHaveBeenCalled();
  });

  it("TourRadar con número y nombre desconocidos sigue a la IA", async () => {
    const proponer = iaQueDice(null, 0.95);
    const r = await emparejarProducto(pedido("Some Other Tour", "999999"), { agencia: "TourRadar", catalogo, proponer, noCargados });
    expect(proponer).toHaveBeenCalledOnce();
    expect(r.motivo).toContain("no está en el catálogo");
  });

  it("Kilroy con un código desconocido que no está en la lista sigue igual: no está en el catálogo, sin IA", async () => {
    const proponer = iaQueDice("OD013", 0.99);
    const r = await emparejarProducto(pedido("El Calafate & El Chalten full day - 4 nights", "HI_ARGENTINA_OD014-677"), {
      agencia: "Kilroy",
      catalogo,
      proponer,
      noCargados,
    });
    expect(r.motivo).toBe("El producto HI_ARGENTINA_OD014-677 (El Calafate & El Chalten full day - 4 nights) no está en el catálogo");
    expect(proponer).not.toHaveBeenCalled();
  });
});
