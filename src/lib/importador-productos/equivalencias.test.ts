import { describe, expect, it } from "vitest";
import { parsearEquivalencias, resolverEquivalencias } from "./equivalencias";

// Spec M1-04b §3 #1-#2: lista de equivalencias Excel → directorio de proveedores.
// Spec M1-04d §3 #2: formato nuevo, con destino y modo.

const ENCABEZADO = "destino,nombre_en_excel,proveedor_en_directorio,modo,estado,nota\n";

describe("parsearEquivalencias", () => {
  it("normaliza el alias igual que proveedor.nombre_normalizado (espacios y mayúsculas) y lee destino y modo", () => {
    const [fila] = parsearEquivalencias(
      `${ENCABEZADO}IGR,"  Cuenca  del PLANA ",Cuenca Del Plata (Natalia ),alias,confirmado,Typo\n`,
    );
    expect(fila).toEqual({
      fila: 2,
      destino: "IGR",
      alias: "Cuenca del PLANA",
      alias_normalizado: "cuenca del plana",
      proveedor_en_directorio: "Cuenca Del Plata (Natalia )",
      modo: "alias",
      estado: "confirmado",
      nota: "Typo",
    });
  });

  it("sin proveedor y sin nota → null (no texto vacío)", () => {
    const [fila] = parsearEquivalencias(`${ENCABEZADO}IGR,Tetris,,alias,para_revisar,\n`);
    expect(fila).toMatchObject({ proveedor_en_directorio: null, nota: null, estado: "para_revisar" });
  });

  it("estado desconocido → error con la fila", () => {
    expect(() => parsearEquivalencias(`${ENCABEZADO}IGR,Beer,X,alias,quizas,\n`)).toThrow(/fila 2.*estado/);
  });

  it("modo desconocido o destino vacío → error con la fila", () => {
    expect(() => parsearEquivalencias(`${ENCABEZADO}IGR,Beer,X,adivinar,confirmado,\n`)).toThrow(/fila 2.*modo/);
    expect(() => parsearEquivalencias(`${ENCABEZADO},Beer,X,alias,confirmado,\n`)).toThrow(/fila 2.*destino/);
  });

  it("alias confirmado sin proveedor → error (un alias confirmado tiene que decir a quién)", () => {
    expect(() => parsearEquivalencias(`${ENCABEZADO}IGR,Tetris,,alias,confirmado,\n`)).toThrow(/fila 2/);
  });

  it("modos por_service_provider y manual: confirmados sin proveedor; con proveedor es un error", () => {
    const filas = parsearEquivalencias(
      `${ENCABEZADO}FTE,Tremun,,por_service_provider,confirmado,Hotel por hotel\nVLP,Kupos.cl,,manual,confirmado,\n`,
    );
    expect(filas.map((f) => [f.modo, f.proveedor_en_directorio])).toEqual([
      ["por_service_provider", null],
      ["manual", null],
    ]);
    expect(() => parsearEquivalencias(`${ENCABEZADO}VLP,Kupos.cl,Kupos,manual,confirmado,\n`)).toThrow(/fila 2/);
  });

  it("el mismo alias en el mismo destino dos veces → error; en destinos distintos vale (Nacional Inn)", () => {
    expect(() =>
      parsearEquivalencias(`${ENCABEZADO}IGR,Taroba,HOTEL TAROBA,alias,confirmado,\nIGR,TAROBA ,HOTEL TAROBA,alias,confirmado,\n`),
    ).toThrow(/repetido/);
    const filas = parsearEquivalencias(
      `${ENCABEZADO}IGR,Nacional Inn,nacional inn foz,alias,confirmado,\nRIO,Nacional Inn,Nacional inn Copacabana,alias,confirmado,\n`,
    );
    expect(filas.map((f) => [f.destino, f.alias_normalizado])).toEqual([
      ["IGR", "nacional inn"],
      ["RIO", "nacional inn"],
    ]);
  });

  it("faltan columnas en el encabezado (ej. el formato viejo, sin destino ni modo) → error", () => {
    expect(() => parsearEquivalencias("nombre_en_excel,proveedor_en_directorio,estado,nota\nx,y,confirmado,\n")).toThrow(
      /destino/,
    );
  });
});

describe("resolverEquivalencias — contra el directorio (proveedor.nombre tal cual)", () => {
  const DIRECTORIO = [
    { id: "p-cuenca", nombre: "Cuenca Del Plata (Natalia )", ciudad: "IGUAZU" },
    { id: "p-cuenca-mas", nombre: "Cuenca del Plata, +", ciudad: "IGUAZU" },
    { id: "p-taroba", nombre: "HOTEL TAROBA", ciudad: "BRASIL" },
    { id: "p-rumbo-ush", nombre: "Rumbo sur", ciudad: "USHUAIA", mails: ["a@rumbosur.com"] },
    { id: "p-rumbo-fte", nombre: "Rumbo sur", ciudad: "CALAFATE", mails: ["b@rumbosur.com"] },
  ];

  it("cada alias apunta al id del proveedor con ese nombre exacto; sin proveedor → null", () => {
    const filas = parsearEquivalencias(
      `${ENCABEZADO}IGR,Cuenca del Plana,Cuenca Del Plata (Natalia ),alias,confirmado,\nIGR,Taroba,HOTEL TAROBA,alias,confirmado,\nIGR,Tetris,,alias,para_revisar,Por WhatsApp\nFTE,Tremun,,por_service_provider,confirmado,\n`,
    );
    expect(resolverEquivalencias(filas, DIRECTORIO)).toEqual([
      { destino: "IGR", alias: "Cuenca del Plana", alias_normalizado: "cuenca del plana", proveedor_id: "p-cuenca", modo: "alias", estado: "confirmado", nota: null },
      { destino: "IGR", alias: "Taroba", alias_normalizado: "taroba", proveedor_id: "p-taroba", modo: "alias", estado: "confirmado", nota: null },
      { destino: "IGR", alias: "Tetris", alias_normalizado: "tetris", proveedor_id: null, modo: "alias", estado: "para_revisar", nota: "Por WhatsApp" },
      { destino: "FTE", alias: "Tremun", alias_normalizado: "tremun", proveedor_id: null, modo: "por_service_provider", estado: "confirmado", nota: null },
    ]);
  });

  it("un proveedor que no existe en el directorio → error claro con el nombre (no se crea ni se ignora)", () => {
    const filas = parsearEquivalencias(`${ENCABEZADO}IGR,Taroba,Hotel Taroba Inexistente,alias,confirmado,\n`);
    expect(() => resolverEquivalencias(filas, DIRECTORIO)).toThrow(/Hotel Taroba Inexistente/);
  });

  it("no empareja por parecido: 'hotel taroba' en minúsculas no es 'HOTEL TAROBA'", () => {
    const filas = parsearEquivalencias(`${ENCABEZADO}IGR,Taroba,hotel taroba,alias,confirmado,\n`);
    expect(() => resolverEquivalencias(filas, DIRECTORIO)).toThrow(/hotel taroba/);
  });

  it("nombre repetido en el directorio: elige el de la ciudad del destino (Rumbo Sur en USH → el de Ushuaia)", () => {
    const filas = parsearEquivalencias(
      `${ENCABEZADO}USH,Rumbo Sur,Rumbo sur,alias,confirmado,\nFTE,Rumbo Sur,Rumbo sur,alias,confirmado,\n`,
    );
    expect(resolverEquivalencias(filas, DIRECTORIO).map((a) => a.proveedor_id)).toEqual(["p-rumbo-ush", "p-rumbo-fte"]);
  });

  it("nombre repetido y ninguno (o más de uno, con contacto distinto) es de la ciudad del destino → error claro", () => {
    const filas = parsearEquivalencias(`${ENCABEZADO}BUE,Rumbo,Rumbo sur,alias,confirmado,\n`);
    expect(() => resolverEquivalencias(filas, DIRECTORIO)).toThrow(/más de un proveedor llamado "Rumbo sur"/);
    const dos = parsearEquivalencias(`${ENCABEZADO}IGR,Taroba,HOTEL TAROBA,alias,confirmado,\n`);
    expect(() =>
      resolverEquivalencias(dos, [...DIRECTORIO, { id: "p-taroba-2", nombre: "HOTEL TAROBA", ciudad: "BRASIL", mails: ["x@y.com"] }]),
    ).toThrow(/más de un proveedor/);
  });
});
