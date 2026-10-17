import { describe, expect, it } from "vitest";
import { crearIndiceProveedores } from "@/lib/importador-productos/proveedores";
import { parsearProveedoresJournaway, resolverProveedoresDeProducto } from "./proveedores";

// Spec M2-08 §3 #3 y #4: el proveedor sale de la planilla, traducido en
// data/journaway-proveedores.csv, y se busca en el directorio sin inventar.

const ENCABEZADO = "codigo,proveedor,prioridad,modo,nota\n";

describe("parsearProveedoresJournaway", () => {
  it("lee código, proveedor, prioridad, modo y nota", () => {
    const filas = parsearProveedoresJournaway(
      `${ENCABEZADO}BUS02,Plataforma10,1,manual,Pasajes a mano\nBUS02,Patagonia planet,2,alias,Si no hay lugar\n`,
    );
    expect(filas).toEqual([
      { fila: 2, codigo: "BUS02", proveedor: "Plataforma10", prioridad: 1, modo: "manual", nota: "Pasajes a mano" },
      { fila: 3, codigo: "BUS02", proveedor: "Patagonia planet", prioridad: 2, modo: "alias", nota: "Si no hay lugar" },
    ]);
  });

  it("modo desconocido, prioridad inválida, repetida o sin proveedor → error con la fila", () => {
    expect(() => parsearProveedoresJournaway(`${ENCABEZADO}FTEE01,Chalten Travel,1,adivinar,\n`)).toThrow(/fila 2.*modo/);
    expect(() => parsearProveedoresJournaway(`${ENCABEZADO}FTEE01,Chalten Travel,cero,alias,\n`)).toThrow(/fila 2.*prioridad/);
    expect(() =>
      parsearProveedoresJournaway(`${ENCABEZADO}FTEE01,Chalten Travel,1,alias,\nFTEE01,Rumbo sur,1,alias,\n`),
    ).toThrow(/fila 3.*FTEE01.*prioridad 1/);
    expect(() => parsearProveedoresJournaway(`${ENCABEZADO}FTEE01,,1,alias,\n`)).toThrow(/fila 2.*proveedor/);
  });
});

const DIRECTORIO = [
  { id: "p-chalten", nombre_normalizado: "chalten travel", ciudad: "CALAFATE", mails: ["a@chalten.com"] },
  { id: "p-rumbo-fte", nombre_normalizado: "rumbo sur", ciudad: "CALAFATE", mails: ["r@rumbo.com"] },
  { id: "p-rumbo-ush", nombre_normalizado: "rumbo sur", ciudad: "USHUAIA", mails: ["r2@rumbo.com"] },
  { id: "p-planet", nombre_normalizado: "patagonia planet", ciudad: "PUERTO NATALES", mails: ["e@planet.com"] },
];
const indice = crearIndiceProveedores(DIRECTORIO);

function filas(texto: string) {
  return parsearProveedoresJournaway(`${ENCABEZADO}${texto}`);
}

describe("resolverProveedoresDeProducto", () => {
  it("busca el nombre en el directorio y desempata por destino (Rumbo sur de Ushuaia)", () => {
    const [op] = resolverProveedoresDeProducto({
      codigo: "USHE04",
      destino: "USH",
      confirmado: "ok",
      filas: filas("USHE04,Rumbo sur,1,alias,\n"),
      indice,
    });
    expect(op).toMatchObject({ prioridad: 1, proveedorNombre: "Rumbo sur", proveedorId: "p-rumbo-ush", sinResolver: false, manual: false });
  });

  it("un proveedor que no está en el directorio queda sin resolver (nunca se crea)", () => {
    const [op] = resolverProveedoresDeProducto({
      codigo: "FTEE05",
      destino: "FTE",
      confirmado: "ok",
      filas: filas("FTEE05,Proveedor Fantasma,1,alias,\n"),
      indice,
    });
    expect(op).toMatchObject({ proveedorNombre: "Proveedor Fantasma", proveedorId: null, sinResolver: true, nota: null });
  });

  it("modo manual (Plataforma10): sin proveedor, marcado manual y no sin resolver; la segunda opción con proveedor", () => {
    const ops = resolverProveedoresDeProducto({
      codigo: "BUS02",
      destino: "PUQ",
      confirmado: "ok",
      filas: filas("BUS02,Plataforma10,1,manual,\nBUS02,Patagonia planet,2,alias,\n"),
      indice,
    });
    expect(ops).toEqual([
      expect.objectContaining({ prioridad: 1, proveedorNombre: "Plataforma10", proveedorId: null, manual: true, sinResolver: false }),
      expect.objectContaining({ prioridad: 2, proveedorNombre: "Patagonia planet", proveedorId: "p-planet", manual: false, sinResolver: false }),
    ]);
  });

  it("el CONFIRMADO igual al proveedor del archivo vale como 'ok'", () => {
    const [op] = resolverProveedoresDeProducto({
      codigo: "FTEE04",
      destino: "FTE",
      confirmado: "  chalten TRAVEL ",
      filas: filas("FTEE04,Chalten Travel,1,alias,\n"),
      indice,
    });
    expect(op).toMatchObject({ proveedorId: "p-chalten", sinResolver: false });
  });

  it("si el owner cambió la planilla (CONFIRMADO distinto de 'ok' y del archivo), queda sin resolver y no se pide al de antes", () => {
    const ops = resolverProveedoresDeProducto({
      codigo: "FTEE04",
      destino: "FTE",
      confirmado: "Rumbo sur",
      filas: filas("FTEE04,Chalten Travel,1,alias,\n"),
      indice,
    });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ proveedorNombre: "Rumbo sur", proveedorId: null, sinResolver: true, cambioEnPlanilla: true });
    expect(ops[0].nota).toMatch(/cambió en la planilla/i);
  });

  it("un producto sin fila en el archivo → error (no se adivina a quién pedirlo)", () => {
    expect(() =>
      resolverProveedoresDeProducto({ codigo: "FTEE09", destino: "FTE", confirmado: "ok", filas: [], indice }),
    ).toThrow(/FTEE09.*no tiene proveedor/);
  });
});
