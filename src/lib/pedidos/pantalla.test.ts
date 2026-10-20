import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { catalogoCon, od010b, reservaOd010b } from "./fixtures.test-utils";
import type { PedidoGuardado } from "./guardar";
import {
  avisosDeLaPantalla,
  loQuePidioLaAgencia,
  resumirLoQuePidio,
  configuracionDeEnvio,
  conteoEnvio,
  firmaConNombre,
  nombreDeQuienFirma,
  validarEdicion,
} from "./pantalla";
import { cargarPlantilla } from "./plantilla";
import { TEXTOS } from "@/lib/textos";

const plantilla = cargarPlantilla();

function pedido(parcial: Partial<PedidoGuardado>): PedidoGuardado {
  return {
    id: "p-1",
    reserva_id: "r-1",
    casilla: "a@x.com",
    destinatarios: ["a@x.com"],
    proveedor_ids: ["prov-1"],
    proveedores: ["Proveedor A"],
    partes: [],
    asunto: "Reserva",
    cuerpo: "Hola",
    firma: "Saludos,\n{{nombre_de_quien_envia}}",
    sin_destinatario: null,
    avisos: [],
    estado: "borrador",
    editado: false,
    de_prueba: true,
    created_at: "2026-10-19T00:00:00Z",
    updated_at: "2026-10-19T00:00:00Z",
    ...parcial,
  };
}

describe("conteoEnvio (filas 3 y 4)", () => {
  const tres = [pedido({ id: "1", casilla: "a" }), pedido({ id: "2", casilla: "b" }), pedido({ id: "3", casilla: "c" })];

  it("cuenta los incluidos: destildar uno pasa de 3 a 2", () => {
    expect(conteoEnvio(tres, new Set()).aEnviar).toHaveLength(3);
    expect(conteoEnvio(tres, new Set(["b"])).aEnviar.map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("un pedido sin mail no se envía y queda pendiente", () => {
    const conSinMail = [...tres, pedido({ id: "4", casilla: "sin-mail:x", destinatarios: [], sin_destinatario: "Falta el mail de X" })];
    const c = conteoEnvio(conSinMail, new Set());
    expect(c.aEnviar).toHaveLength(3);
    expect(c.pendientes.map((p) => p.id)).toEqual(["4"]);
  });

  it("el texto del botón: singular, plural y pendientes", () => {
    expect(TEXTOS.pedidos.enviar(3, 0)).toBe("Enviar 3 pedidos");
    expect(TEXTOS.pedidos.enviar(1, 0)).toBe("Enviar 1 pedido");
    expect(TEXTOS.pedidos.enviar(2, 1)).toBe("Enviar 2 pedidos (1 queda pendiente)");
    expect(TEXTOS.pedidos.enviar(2, 2)).toBe("Enviar 2 pedidos (2 quedan pendientes)");
  });
});

describe("avisosDeLaPantalla (fila 6)", () => {
  it("sin vuelo: 'Falta dato de llegada' (el pedido igual sale con vuelo pendiente)", () => {
    const r = armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla);
    if (!r.ok) throw new Error(r.error);
    expect(r.pedidos.some((p) => /vuelo pendiente/i.test(p.cuerpo))).toBe(true);
    const avisos = avisosDeLaPantalla(reservaOd010b, r);
    expect(avisos[0]).toBe(TEXTOS.pedidos.faltaLlegada);
  });

  it("con el vuelo cargado no avisa la llegada", () => {
    expect(avisosDeLaPantalla({ agencia: "Kilroy", hotelesAgencia: [] }, { pedidos: [{ cuerpo: "Vuelo: LA123" }], avisos: [] })).toEqual([]);
  });

  it("Journaway: junta lo que reserva la agencia en un solo aviso y saca los sueltos", () => {
    const avisos = avisosDeLaPantalla(
      {
        agencia: "Journaway",
        hotelesAgencia: [
          { nombre: "Tayka del Desierto", desde: "2026-10-11", hasta: "2026-10-13" },
          { nombre: "Tayka de Sal", desde: "2026-10-13", hasta: "2026-10-14" },
        ],
      },
      { pedidos: [{ cuerpo: "Vuelo: LA148" }], avisos: ['No se pide "Tayka del Desierto": lo reserva la agencia.', "Otro aviso."] },
    );
    expect(avisos).toEqual(["Journaway reserva estos hoteles: Tayka del Desierto, Tayka de Sal; no se piden.", "Otro aviso."]);
  });
});

describe("quién firma (fila 8)", () => {
  it("el nombre de la cuenta de Google", () => {
    expect(nombreDeQuienFirma({ email: "ccalomarde@hitravel.com.ar", user_metadata: { full_name: "Cristian Calomarde" } })).toBe("Cristian Calomarde");
    expect(nombreDeQuienFirma({ email: "ccalomarde@hitravel.com.ar", user_metadata: { name: "Cristian" } })).toBe("Cristian");
  });

  it("M3-06 fila 2: con nombre para la firma guardado, firma con él; vacío o sin guardar, como antes", () => {
    const u = { email: "dperez@hitravel.com.ar", user_metadata: { full_name: "Damián Pérez" } };
    expect(nombreDeQuienFirma(u, "Damián · Operaciones")).toBe("Damián · Operaciones");
    expect(nombreDeQuienFirma(u, "  ")).toBe("Damián Pérez");
    expect(nombreDeQuienFirma(u, null)).toBe("Damián Pérez");
  });

  it("sin nombre, la parte del mail antes de la @", () => {
    expect(nombreDeQuienFirma({ email: "leticia@hitravel.com.ar", user_metadata: {} })).toBe("leticia");
    expect(nombreDeQuienFirma({ email: "leticia@hitravel.com.ar", user_metadata: { full_name: "  " } })).toBe("leticia");
  });

  it("la firma con el nombre puesto", () => {
    expect(firmaConNombre("Saludos,\n{{nombre_de_quien_envia}}\nHI Travel", "Leticia")).toBe("Saludos,\nLeticia\nHI Travel");
  });
});

describe("configuracionDeEnvio (fila 8)", () => {
  it("apagado por defecto: modo prueba, a ccalomarde@ y con CC a ccalomarde@hitravel.com.ar", () => {
    expect(configuracionDeEnvio({})).toEqual({ modoPrueba: true, destinoPrueba: "ccalomarde@", cc: ["ccalomarde@hitravel.com.ar"] });
  });

  it("solo 'si' prende el envío real; las casillas salen de las variables", () => {
    expect(configuracionDeEnvio({ PEDIDOS_ENVIO_REAL: "true" }).modoPrueba).toBe(true);
    expect(
      configuracionDeEnvio({ PEDIDOS_ENVIO_REAL: " si ", PEDIDOS_DESTINO_PRUEBA: "prueba@hitravel.com.ar", PEDIDOS_CC: "ops@hitravel.com.ar, cc@hitravel.com.ar" }),
    ).toEqual({ modoPrueba: false, destinoPrueba: "prueba@hitravel.com.ar", cc: ["ops@hitravel.com.ar", "cc@hitravel.com.ar"] });
  });
});

describe("validarEdicion (fila 2)", () => {
  it("acepta asunto y texto, sin espacios de más en el asunto", () => {
    expect(validarEdicion({ pedidoId: "8f7c6a2e-1b1a-4c3e-9a55-2a0f6d5b9c11", asunto: "  Reserva Ana  ", cuerpo: "Hola\n" })).toEqual({
      ok: true,
      edicion: { pedidoId: "8f7c6a2e-1b1a-4c3e-9a55-2a0f6d5b9c11", asunto: "Reserva Ana", cuerpo: "Hola" },
    });
  });

  it("rechaza vacíos, ids inválidos y textos enormes", () => {
    expect(validarEdicion({ pedidoId: "8f7c6a2e-1b1a-4c3e-9a55-2a0f6d5b9c11", asunto: " ", cuerpo: "Hola" }).ok).toBe(false);
    expect(validarEdicion({ pedidoId: "8f7c6a2e-1b1a-4c3e-9a55-2a0f6d5b9c11", asunto: "A", cuerpo: "  " }).ok).toBe(false);
    expect(validarEdicion({ pedidoId: "x", asunto: "A", cuerpo: "B" }).ok).toBe(false);
    expect(validarEdicion({ pedidoId: "8f7c6a2e-1b1a-4c3e-9a55-2a0f6d5b9c11", asunto: "A", cuerpo: "x".repeat(20_001) }).ok).toBe(false);
  });
});

describe("Owner 2026-10-20 — lo que pidió la agencia, arriba de los pedidos", () => {
  // El caso real: DK1592913, ARCH31 de Kilroy.
  const KILROY =
    "Please include post night in PUQ (hostel private). ALSO: remove the free day in El Calafate, and move it to an extra day in El Chalten.";

  it("los pedidos especiales (uno por renglón) y las notas de la reserva", () => {
    expect(loQuePidioLaAgencia({ pedidosEspeciales: `${KILROY}\n  \nVegetarian`, notas: ["Llegan a La Paz por tierra", "  "] })).toEqual({
      pedidos: [KILROY, "Vegetarian"],
      notas: ["Llegan a La Paz por tierra"],
    });
  });

  it("sin pedidos especiales ni notas → nada", () => {
    expect(loQuePidioLaAgencia({ pedidosEspeciales: null, notas: [] })).toBeNull();
    expect(loQuePidioLaAgencia({ pedidosEspeciales: "  \n ", notas: undefined })).toBeNull();
  });

  it("el resumen del diálogo corta en una palabra y agrega «…»", () => {
    expect(resumirLoQuePidio(["Vegetarian"], 80)).toBe("Vegetarian");
    const r = resumirLoQuePidio([KILROY], 60);
    expect(r.length).toBeLessThanOrEqual(61);
    expect(r).toBe("Please include post night in PUQ (hostel private). ALSO:…");
    expect(resumirLoQuePidio(["Uno", "Dos"], 80)).toBe("Uno · Dos");
  });
});
