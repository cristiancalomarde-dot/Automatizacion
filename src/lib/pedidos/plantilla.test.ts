import { describe, expect, it } from "vitest";
import { cargarPlantilla, completar, leerPlantilla, textoParaEnviar } from "./plantilla";

const BASE = "## Asunto\nReserva {{pasajero}}\n## Cuerpo\n¡Hola!\n\n{{servicios}}\n## Firma\n{{nombre_de_quien_envia}}\nHI Travel";

describe("plantilla del pedido (fila 6)", () => {
  it("la del repo se lee y tiene el lugar del nombre en la firma", () => {
    const p = cargarPlantilla();
    expect(p.asunto).toContain("{{pasajero}}");
    expect(p.cuerpo).toContain("{{servicios}}");
    expect(p.firma).toContain("{{nombre_de_quien_envia}}");
    // Las notas para quien edita ("> …") no salen.
    expect(`${p.asunto}${p.cuerpo}${p.firma}`).not.toContain("> ");
  });

  it("separa asunto, cuerpo y firma", () => {
    expect(leerPlantilla(BASE)).toEqual({ asunto: "Reserva {{pasajero}}", cuerpo: "¡Hola!\n\n{{servicios}}", firma: "{{nombre_de_quien_envia}}\nHI Travel" });
  });

  it("no debe pasar: una firma sin el lugar del nombre frena", () => {
    expect(() => leerPlantilla(BASE.replace("{{nombre_de_quien_envia}}\n", ""))).toThrow(/nombre de quien envía/);
  });

  it("un dato que la app no conoce frena con un mensaje claro", () => {
    expect(() => leerPlantilla(BASE.replace("¡Hola!", "¡Hola {{proveedor}}!"))).toThrow(/\{\{proveedor\}\}/);
  });

  it("sin cuerpo con {{servicios}} frena", () => {
    expect(() => leerPlantilla(BASE.replace("{{servicios}}", "nada"))).toThrow(/servicios/);
  });

  it("completar saca los renglones vacíos de más", () => {
    expect(completar("A\n\n{{x}}\n\n{{y}}\n\nB", { x: "", y: "Y" })).toBe("A\n\nY\n\nB");
  });

  it("el texto para enviar pone el nombre en la firma y no sale sin nombre", () => {
    const pedido = { cuerpo: "Hola", firma: "{{nombre_de_quien_envia}}\nHI Travel" };
    expect(textoParaEnviar(pedido, "Valentina")).toBe("Hola\n\nValentina\nHI Travel");
    expect(() => textoParaEnviar(pedido, "  ")).toThrow(/nombre/);
  });
});
