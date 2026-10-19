import { describe, expect, it } from "vitest";
import { detalleDePrueba, idDe, proveedorPatagoniaPlanet } from "../emparejar/__fixtures__/cargar";
import { MOTIVOS_EMPAREJADO as M } from "../emparejar/motivos";
import type { FichaLectura } from "../esquema-ficha";
import {
  cambiosDeLaEquivalencia,
  decidirConfirmacion,
  pedidoDeLaAgencia,
  planAprendizaje,
  porQueNoSeConfirma,
  type EquivalenciaGuardada,
  type ReservaParaConfirmar,
} from "./decidir";

/**
 * Spec M3-05 filas 4, 5 y 8 (la parte pura): qué queda en la reserva al
 * confirmar el producto y qué aprende la app. Con el catálogo real (foto).
 */

const NOMBRE = "HI - La Paz Starter Package (Adventure Brew Hostal)";
const producto = (codigo: string) => ({ id: idDe(codigo), codigo, nombre: `nombre de ${codigo}` });
const PNT = proveedorPatagoniaPlanet();

function ficha(productos: Array<{ nombre: string; codigo: string | null }>): FichaLectura {
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    productos: productos.map((p) => ({ ...p, fecha_inicio: null, fecha_fin: null, noches: null, habitacion: null, punto_recogida: null, opcionales: [], confianza: 1 })),
  } as unknown as FichaLectura;
}

function reserva(extra: Partial<ReservaParaConfirmar> = {}): ReservaParaConfirmar {
  return {
    id: "r-1",
    agencia: "Kilroy",
    estado: "para_revision",
    dePrueba: false,
    motivos: [M.noSeguro(NOMBRE, { codigo: "OD031", confianza: 0.85 })],
    productoId: null,
    sugerenciaProductoId: idDe("OD031"),
    productoTextoAgencia: NOMBRE,
    fechaInicio: "2026-11-02",
    fechaFin: "2026-11-05",
    vuelos: [],
    pedidosEspeciales: null,
    sinTrasladoDe: null,
    datosExtraidos: ficha([{ nombre: NOMBRE, codigo: null }]),
    cantidadPartes: 0,
    ...extra,
  };
}

const decidir = (r: ReservaParaConfirmar, codigo: string) =>
  decidirConfirmacion(r, producto(codigo), detalleDePrueba(codigo), { proveedorTransferPNT: PNT });

describe("M3-05 fila 4 — qué queda en la reserva", () => {
  it("aceptar la sugerencia: origen ia con la confianza de la IA; sin otro motivo queda recibida", () => {
    // OD016 no es la sugerencia del motivo: se usa para que no haya vuelos de por medio.
    const r = reserva({ sugerenciaProductoId: idDe("OD016"), motivos: [M.noSeguro(NOMBRE, { codigo: "OD016", confianza: 0.85 })] });
    const d = decidir(r, "OD016");
    expect(d.origen).toBe("ia");
    expect(d.sugerida).toBe(true);
    expect(d.confianza).toBe(0.85);
    expect(d.motivos.filter((m) => !m.startsWith("Falta el vuelo"))).toEqual(d.motivos);
  });

  it("elegir otro producto: origen nombre, confianza 1", () => {
    const d = decidir(reserva(), "OD030");
    expect(d.origen).toBe("nombre");
    expect(d.sugerida).toBe(false);
    expect(d.confianza).toBe(1);
  });

  it("se quitan solo los motivos de producto; los demás quedan y la reserva sigue para revisión", () => {
    const vuelo = M.faltaVuelo("in", { ciudad: "La Paz", codigos: ["LPB"] }, "el traslado de OD031");
    const d = decidir(reserva({ motivos: [M.noSeguro(NOMBRE), vuelo, M.dudosos(["pax"])] }), "OD030");
    expect(d.motivos).toEqual([vuelo, M.dudosos(["pax"])]);
    expect(d.estado).toBe("para_revision");
  });

  it("el vuelo que falta del producto nuevo es un aviso (owner 2026-10-16), no un motivo: queda recibida", () => {
    const d = decidir(reserva({ motivos: [M.noSeguro(NOMBRE)] }), "OD030");
    expect(d.estado).toBe("recibida");
    expect(d.motivos).toEqual([]);
    expect(d.avisos.some((a) => a.startsWith("Falta el vuelo de llegada"))).toBe(true);
  });

  it("lo que pide una decisión del producto nuevo (elegir la variante de OD019) queda como motivo", () => {
    const d = decidir(reserva({ motivos: [M.noSeguro(NOMBRE)] }), "OD019");
    expect(d.motivos).toContain(M.elegirVariante("OD019"));
    expect(d.estado).toBe("para_revision");
  });

  it("sin fecha de inicio, queda el motivo 'no trae la fecha de inicio'", () => {
    const d = decidir(reserva({ fechaInicio: null }), "OD016");
    expect(d.motivos).toContain(M.sinFechaInicio);
  });

  it("tour compuesto: arma sus partes con fecha real (CHB31 desde el 13/9 → OD030, COMPBO20 y el bus)", () => {
    const d = decidir(reserva({ fechaInicio: "2026-09-13", fechaFin: "2026-09-19" }), "CHB31");
    expect(d.componentes.map((c) => [c.tipo, c.fechaInicio])).toEqual([
      ["paquete", "2026-09-13"],
      ["paquete", "2026-09-16"],
      ["servicio", "2026-09-18"],
    ]);
  });

  it("un paquete no arma partes", () => {
    expect(decidir(reserva(), "OD016").componentes).toEqual([]);
  });
});

describe("M3-05 — cuándo no se puede confirmar", () => {
  it("una reserva que no está para revisión", () => {
    expect(porQueNoSeConfirma(reserva({ estado: "recibida" }))).toMatch(/ya no está para revisión/);
  });
  it("una reserva sin motivo de producto", () => {
    expect(porQueNoSeConfirma(reserva({ motivos: [M.dudosos(["pax"])] }))).toMatch(/no tiene el producto por confirmar/);
    expect(porQueNoSeConfirma(reserva({ productoId: idDe("OD030") }))).toMatch(/no tiene el producto por confirmar/);
  });
  it("Journaway (sus paquetes los arma otro reconocedor)", () => {
    expect(porQueNoSeConfirma(reserva({ agencia: "Journaway" }))).toMatch(/Journaway/);
  });
  it("una reserva que ya tiene partes armadas", () => {
    expect(porQueNoSeConfirma(reserva({ cantidadPartes: 2 }))).toMatch(/partes/);
  });
  it("la que se puede: null", () => {
    expect(porQueNoSeConfirma(reserva())).toBeNull();
  });
});

describe("M3-05 — lo que mandó la agencia", () => {
  it("el producto del mail que corresponde a esta reserva (por su texto)", () => {
    const f = ficha([
      { nombre: "Overland", codigo: "HI_ARGENTINA_OVERLAND_7DAYS-677" },
      { nombre: NOMBRE, codigo: null },
    ]);
    expect(pedidoDeLaAgencia(reserva({ datosExtraidos: f }))).toEqual({ codigo: null, nombre: NOMBRE });
    expect(pedidoDeLaAgencia(reserva({ datosExtraidos: f, productoTextoAgencia: "Overland (HI_ARGENTINA_OVERLAND_7DAYS-677)" }))).toEqual({
      codigo: "HI_ARGENTINA_OVERLAND_7DAYS-677",
      nombre: "Overland",
    });
  });
  it("sin la ficha, el texto guardado como nombre", () => {
    expect(pedidoDeLaAgencia(reserva({ datosExtraidos: null }))).toEqual({ codigo: null, nombre: NOMBRE });
  });
});

describe("M3-05 filas 5 y 8 — lo que aprende la app", () => {
  const OD031 = idDe("OD031");
  const OD030 = idDe("OD030");
  const fila = (extra: Partial<EquivalenciaGuardada>): EquivalenciaGuardada => ({
    id: "ce-1",
    productoId: OD031,
    agencia: "Kilroy",
    codigo: "X",
    nombreExterno: null,
    ...extra,
  });

  it("sin código: guarda el nombre (limpio en el código, tal cual en nombre_externo)", () => {
    const p = planAprendizaje({ agencia: "Kilroy", dePrueba: false, pedido: { codigo: null, nombre: NOMBRE }, productoId: OD031, equivalencias: [] });
    expect(p).toEqual({ tipo: "guardar", codigo: "hi - la paz starter package (adventure brew hostal)", nombreExterno: NOMBRE, conflictos: [] });
  });

  it("con el código de la agencia: guarda el código tal cual vino, con el nombre", () => {
    const p = planAprendizaje({
      agencia: "Kilroy",
      dePrueba: false,
      pedido: { codigo: "HI_ARGENTINA_LA_PAZ-677", nombre: NOMBRE },
      productoId: OD031,
      equivalencias: [],
    });
    expect(p).toEqual({ tipo: "guardar", codigo: "HI_ARGENTINA_LA_PAZ-677", nombreExterno: NOMBRE, conflictos: [] });
  });

  it("TourRadar: un código que no es su número de tour no sirve; se guarda el nombre", () => {
    const p = planAprendizaje({ agencia: "TourRadar", dePrueba: false, pedido: { codigo: "ABC", nombre: "Patagonia Tour" }, productoId: OD031, equivalencias: [] });
    expect(p).toMatchObject({ tipo: "guardar", codigo: "patagonia tour", nombreExterno: "Patagonia Tour" });
  });

  it("si ya existe una equivalencia igual (mismo nombre, mayúsculas y acentos aparte), no duplica", () => {
    const p = planAprendizaje({
      agencia: "Kilroy",
      dePrueba: false,
      pedido: { codigo: null, nombre: "hi - la  paz starter package (adventure brew hostal)" },
      productoId: OD031,
      equivalencias: [fila({ codigo: "OD031", nombreExterno: NOMBRE })],
    });
    expect(p).toEqual({ tipo: "no", razon: "ya_esta" });
  });

  it("no debe pasar: pisar sin avisar una equivalencia que apunta a otro producto → conflicto", () => {
    const p = planAprendizaje({
      agencia: "Kilroy",
      dePrueba: false,
      pedido: { codigo: null, nombre: NOMBRE },
      productoId: OD030,
      equivalencias: [fila({ id: "ce-9", codigo: "OD031", nombreExterno: NOMBRE }), fila({ agencia: "TourRadar", nombreExterno: NOMBRE, id: "otra" })],
    });
    expect(p).toMatchObject({ tipo: "guardar", conflictos: [{ id: "ce-9", productoId: OD031 }] });
  });

  it("conflicto por código", () => {
    const p = planAprendizaje({
      agencia: "Kilroy",
      dePrueba: false,
      pedido: { codigo: "HI_X-677", nombre: NOMBRE },
      productoId: OD030,
      equivalencias: [fila({ id: "ce-7", codigo: "HI_X-677" })],
    });
    expect(p).toMatchObject({ tipo: "guardar", codigo: "HI_X-677", conflictos: [{ id: "ce-7" }] });
  });

  it("fila 8: una reserva de prueba no aprende", () => {
    const p = planAprendizaje({ agencia: "Kilroy", dePrueba: true, pedido: { codigo: null, nombre: NOMBRE }, productoId: OD031, equivalencias: [] });
    expect(p).toEqual({ tipo: "no", razon: "prueba" });
  });

  it("sin nada que aprender (la agencia no mandó texto)", () => {
    const p = planAprendizaje({ agencia: "Kilroy", dePrueba: false, pedido: { codigo: null, nombre: null }, productoId: OD031, equivalencias: [] });
    expect(p).toEqual({ tipo: "no", razon: "sin_texto" });
  });
});

describe("M3-05 fila 5 — '¿Lo cambiamos?': qué se cambia", () => {
  it("la fila del mismo código pasa al producto nuevo; un código con ese nombre conserva su código y pierde el nombre", () => {
    const base = { productoId: idDe("OD031"), agencia: "Kilroy", nombreExterno: NOMBRE };
    const plan = {
      tipo: "guardar" as const,
      codigo: "hi - la paz starter package (adventure brew hostal)",
      nombreExterno: NOMBRE,
      conflictos: [
        { ...base, id: "nombre", codigo: "hi - la paz starter package (adventure brew hostal)" },
        { ...base, id: "codigo", codigo: "OD031" },
      ],
    };
    expect(cambiosDeLaEquivalencia(plan)).toEqual({ reemplazar: ["nombre"], quitarNombre: ["codigo"] });
  });
});
