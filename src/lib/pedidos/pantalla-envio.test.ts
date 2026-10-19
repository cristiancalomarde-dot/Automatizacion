// Spec M3-03 filas 4, 6, 7 y 9: lo que la pantalla de pedidos calcula sobre
// el envío, sin base ni red.
import { describe, expect, it } from "vitest";
import type { PedidoGuardado } from "./guardar";
import { conteoEnvio, estadoDeEnvio, horaCorta, nombreDeQuienFirma } from "./pantalla";

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
    firma: "{{nombre_de_quien_envia}}",
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

const AHORA = new Date("2026-10-19T17:40:00Z");

describe("envío en la pantalla", () => {
  it("lo enviado o enviándose no se vuelve a contar en 'Enviar N'; lo que falló sí (filas 6 y 7)", () => {
    const lista = [
      pedido({ id: "1", casilla: "a" }),
      pedido({ id: "2", casilla: "b", estado: "enviado", enviado_en: "2026-10-19T17:32:00Z", enviado_por_nombre: "Vale", message_id: "<m>" }),
      pedido({ id: "3", casilla: "c", estado: "enviando", enviando_desde: "2026-10-19T17:39:00Z" }),
      pedido({ id: "4", casilla: "d", estado: "fallo", motivo_fallo: "El correo rechazó x" }),
    ];
    expect(conteoEnvio(lista, new Set()).aEnviar.map((p) => p.id)).toEqual(["1", "4"]);
  });

  it("el estado de cada tarjeta (filas 7 y 9)", () => {
    expect(estadoDeEnvio(pedido({}), AHORA)).toEqual({ tipo: "borrador" });
    expect(estadoDeEnvio(pedido({ estado: "enviado", enviado_en: "2026-10-19T17:32:00Z", enviado_por_nombre: "Vale" }), AHORA)).toEqual({
      tipo: "enviado",
      en: "2026-10-19T17:32:00Z",
      quien: "Vale",
    });
    expect(estadoDeEnvio(pedido({ estado: "fallo", motivo_fallo: "No respondió" }), AHORA)).toEqual({ tipo: "fallo", motivo: "No respondió" });
    expect(estadoDeEnvio(pedido({ estado: "enviando", enviando_desde: "2026-10-19T17:39:00Z" }), AHORA)).toEqual({ tipo: "enviando" });
    // Más de 10 minutos "enviando": algo se cortó; se ofrece reenviar.
    expect(estadoDeEnvio(pedido({ estado: "enviando", enviando_desde: "2026-10-19T17:20:00Z" }), AHORA)).toEqual({ tipo: "trabado" });
    expect(estadoDeEnvio(pedido({ envio_prueba_en: "2026-10-19T17:35:00Z" }), AHORA)).toEqual({ tipo: "prueba", en: "2026-10-19T17:35:00Z" });
  });

  it("la hora corta del envío (14:32)", () => {
    const d = new Date(2026, 9, 19, 14, 32);
    expect(horaCorta(d.toISOString())).toBe("14:32");
    expect(horaCorta("cualquier cosa")).toBe("");
  });

  it("la firma: el nombre de la cuenta de Google o, si no hay, lo previo a la @ (fila 4)", () => {
    expect(nombreDeQuienFirma({ email: "vpaz@hitravel.com.ar", user_metadata: { full_name: "Valentina Paz" } })).toBe("Valentina Paz");
    expect(nombreDeQuienFirma({ email: "vpaz@hitravel.com.ar", user_metadata: {} })).toBe("vpaz");
  });
});
