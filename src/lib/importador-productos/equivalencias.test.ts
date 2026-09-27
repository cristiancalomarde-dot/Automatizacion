import { describe, expect, it } from "vitest";
import { parsearEquivalencias, resolverEquivalencias } from "./equivalencias";

// Spec M1-04b §3 #1-#2: lista de equivalencias Excel → directorio de proveedores.

const ENCABEZADO = "nombre_en_excel,proveedor_en_directorio,estado,nota\n";

describe("parsearEquivalencias", () => {
  it("normaliza el alias igual que proveedor.nombre_normalizado (espacios y mayúsculas)", () => {
    const [fila] = parsearEquivalencias(
      `${ENCABEZADO}"  Cuenca  del PLANA ",Cuenca Del Plata (Natalia ),confirmado,Typo\n`,
    );
    expect(fila).toEqual({
      fila: 2,
      alias: "Cuenca del PLANA",
      alias_normalizado: "cuenca del plana",
      proveedor_en_directorio: "Cuenca Del Plata (Natalia )",
      estado: "confirmado",
      nota: "Typo",
    });
  });

  it("sin proveedor y sin nota → null (no texto vacío)", () => {
    const [fila] = parsearEquivalencias(`${ENCABEZADO}Tetris,,para_revisar,\n`);
    expect(fila).toMatchObject({ proveedor_en_directorio: null, nota: null, estado: "para_revisar" });
  });

  it("estado desconocido → error con la fila", () => {
    expect(() => parsearEquivalencias(`${ENCABEZADO}Beer,X,quizas,\n`)).toThrow(/fila 2.*estado/);
  });

  it("confirmado sin proveedor → error (un alias confirmado tiene que decir a quién)", () => {
    expect(() => parsearEquivalencias(`${ENCABEZADO}Tetris,,confirmado,\n`)).toThrow(/fila 2/);
  });

  it("el mismo alias dos veces (tras normalizar) → error", () => {
    expect(() =>
      parsearEquivalencias(`${ENCABEZADO}Taroba,HOTEL TAROBA,confirmado,\nTAROBA ,HOTEL TAROBA,confirmado,\n`),
    ).toThrow(/repetido/);
  });

  it("faltan columnas en el encabezado → error", () => {
    expect(() => parsearEquivalencias("nombre_en_excel,estado\nx,confirmado\n")).toThrow(/proveedor_en_directorio/);
  });
});

describe("resolverEquivalencias — contra el directorio (proveedor.nombre tal cual)", () => {
  const DIRECTORIO = [
    { id: "p-cuenca", nombre: "Cuenca Del Plata (Natalia )" },
    { id: "p-cuenca-mas", nombre: "Cuenca del Plata, +" },
    { id: "p-taroba", nombre: "HOTEL TAROBA" },
  ];

  it("cada alias apunta al id del proveedor con ese nombre exacto; sin proveedor → null", () => {
    const filas = parsearEquivalencias(
      `${ENCABEZADO}Cuenca del Plana,Cuenca Del Plata (Natalia ),confirmado,\nTaroba,HOTEL TAROBA,confirmado,\nTetris,,para_revisar,Por WhatsApp\n`,
    );
    expect(resolverEquivalencias(filas, DIRECTORIO)).toEqual([
      { alias: "Cuenca del Plana", alias_normalizado: "cuenca del plana", proveedor_id: "p-cuenca", estado: "confirmado", nota: null },
      { alias: "Taroba", alias_normalizado: "taroba", proveedor_id: "p-taroba", estado: "confirmado", nota: null },
      { alias: "Tetris", alias_normalizado: "tetris", proveedor_id: null, estado: "para_revisar", nota: "Por WhatsApp" },
    ]);
  });

  it("un proveedor que no existe en el directorio → error claro con el nombre (no se crea ni se ignora)", () => {
    const filas = parsearEquivalencias(`${ENCABEZADO}Taroba,Hotel Taroba Inexistente,confirmado,\n`);
    expect(() => resolverEquivalencias(filas, DIRECTORIO)).toThrow(/Hotel Taroba Inexistente/);
  });

  it("no empareja por parecido: 'hotel taroba' en minúsculas no es 'HOTEL TAROBA'", () => {
    const filas = parsearEquivalencias(`${ENCABEZADO}Taroba,hotel taroba,confirmado,\n`);
    expect(() => resolverEquivalencias(filas, DIRECTORIO)).toThrow(/hotel taroba/);
  });

  it("dos proveedores con el mismo nombre → error (ambiguo), no se elige uno", () => {
    const filas = parsearEquivalencias(`${ENCABEZADO}Taroba,HOTEL TAROBA,confirmado,\n`);
    expect(() =>
      resolverEquivalencias(filas, [...DIRECTORIO, { id: "p-taroba-2", nombre: "HOTEL TAROBA" }]),
    ).toThrow(/más de un proveedor/);
  });
});
