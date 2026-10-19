import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { leerDiasServicio } from "./cargar";
import { documentoDeEjemplos, enmascararReserva } from "./ejemplos";
import { catalogoCon, od010b, reservaOd010b } from "./fixtures.test-utils";
import { cargarPlantilla } from "./plantilla";

describe("documento de ejemplos (fila 12)", () => {
  const conDatos = { ...reservaOd010b, pasajeros: [{ nombre: "Ana", apellido: "Gómez", fecha_nacimiento: "1990-05-17", pasaporte: "XX1234567", telefono: "+45 1234 5678" }], pax: 1 };
  const resultado = armarPedidos(enmascararReserva(conDatos), catalogoCon([od010b]), cargarPlantilla());
  const doc = documentoDeEjemplos({ fecha: "2026-10-19", ejemplos: [{ titulo: "Kilroy · Iguazú (OD010B)", porQue: "Hotel y Paquete 105 a Cuenca del Plata.", resultado }], preguntas: ["¿Te gusta el saludo?"] });

  it("enmascara los datos de los pasajeros", () => {
    expect(doc).not.toContain("Gómez");
    expect(doc).not.toContain("17/05");
    expect(doc).not.toContain("XX1234567");
    expect(doc).not.toContain("1234 5678");
    expect(doc).toContain("A. G.");
    expect(doc).toContain("**/**/1990");
  });

  it("es llano: sin rutas de archivos ni el marcador de la firma", () => {
    expect(doc).not.toMatch(/data\/|src\/|\.md\b|\.ts\b|\{\{/);
    expect(doc).toContain("(nombre de quien envía)");
    expect(doc).toContain("**Para:** reservas8@cuencadelplata.com");
    expect(doc).toContain("## Preguntas para vos");
  });
});

describe("días de los servicios", () => {
  it("lee el archivo y frena con una fila mal escrita", () => {
    expect(leerDiasServicio("codigo,orden,dia,nota\nOD030,4,3,\"el Tatio, día 3\"\n")).toEqual([{ codigo: "OD030", orden: 4, dia: 3 }]);
    expect(() => leerDiasServicio("codigo,orden,dia,nota\nOD030,cuatro,3,x")).toThrow(/fila 2/);
    expect(() => leerDiasServicio("otra,cosa")).toThrow(/primera fila/);
  });
});
