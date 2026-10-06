import { describe, expect, it } from "vitest";
import { crearIndiceProveedores } from "@/lib/importador-productos/proveedores";
import { resolverProveedorTramo } from "./proveedor-tramo";

const indice = crearIndiceProveedores(
  [
    { id: "imperio", nombre_normalizado: "imperio inca", ciudad: "La Paz", mails: [], canal: "whatsapp", telefono: null },
    { id: "transvip", nombre_normalizado: "transvip", ciudad: "Calama", mails: [], canal: null, telefono: null },
  ],
  [
    { destino: "SPA", alias_normalizado: "transvipp", proveedor_id: null, modo: "manual", estado: "confirmado", nota: null },
    { destino: "VLP", alias_normalizado: "kupos.cl", proveedor_id: null, modo: "manual", estado: "confirmado", nota: null },
    { destino: "PNT", alias_normalizado: "kupos", proveedor_id: null, modo: "manual", estado: "confirmado", nota: null },
  ],
);

describe("proveedor de un bus del tour (mismo criterio que los paquetes, M1-04d)", () => {
  it("manual en el destino de una de las puntas (Kupos.cl en VLP para Santiago – Valparaíso)", () => {
    expect(resolverProveedorTramo("Kupos.cl", indice, ["SCL", "VLP"])).toMatchObject({ id: null, manual: true });
  });

  it("manual en la otra punta (Transvipp en SPA para Calama – San Pedro)", () => {
    expect(resolverProveedorTramo("Transvipp", indice, ["CJC", "SPA"])).toMatchObject({ id: null, manual: true });
  });

  it("si ninguna punta tiene la marca, vale la de cualquier destino", () => {
    expect(resolverProveedorTramo("Kupos", indice, ["SCL", "VLP"])).toMatchObject({ id: null, manual: true });
  });

  it("un proveedor del directorio se resuelve como siempre", () => {
    expect(resolverProveedorTramo("Imperio Inca", indice, ["UYU", "LPB"])).toMatchObject({ id: "imperio" });
    expect(resolverProveedorTramo("Imperio Inca", indice, ["UYU", "LPB"]).manual).toBeFalsy();
  });

  it("un nombre desconocido queda sin resolver (no manual)", () => {
    expect(resolverProveedorTramo("Nadie", indice, ["UYU", "LPB"])).toMatchObject({ id: null });
    expect(resolverProveedorTramo("Nadie", indice, ["UYU", "LPB"]).manual).toBeFalsy();
  });
});
