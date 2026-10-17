import { describe, expect, it } from "vitest";
import { apartarBorrados, compararDirectorio, parsearProveedoresBorrados, type ProveedorEnBase } from "./cambios";
import type { RegistroProveedor } from "./resolver";

function registro(nombre: string, ciudad: string, extra: Partial<RegistroProveedor> = {}): RegistroProveedor {
  return {
    nombre,
    nombre_normalizado: nombre.toLowerCase(),
    ciudad,
    mails: [],
    canal: null,
    aclaraciones: null,
    ...extra,
  };
}

function enBase(id: string, r: RegistroProveedor): ProveedorEnBase {
  return { id, ...r };
}

describe("comparar el Excel corregido con el directorio cargado (spec M1-07 §3 #1 y #11)", () => {
  const tetrisViejo = enBase(
    "t1",
    registro("Tetris Hostel Foz do Iguacu", "BRASIL", { canal: "whatsapp", aclaraciones: "Mail/web original: WSP: +55" }),
  );
  const natalia = enBase(
    "c1",
    registro("Cuenca Del Plata (Natalia )", "IGUAZU", { mails: ["reservas3@cuencadelplata.com"], canal: "mail" }),
  );
  const antarctica = enBase("a1", registro("Antarctica Hostel", "USHUAIA", { aclaraciones: "Aclaraciones: WSP: +54" }));
  const igual = enBase("m1", registro("Milhouse", "BUENOS AIRES", { mails: ["m@x.com"], canal: "mail" }));
  const viejo = enBase("v1", registro("Hotel que ya no está", "SALTA"));

  const excel = [
    registro("Milhouse", "BUENOS AIRES", { mails: ["m@x.com"], canal: "mail" }),
    registro("Tetris Hostel Foz do Iguacu", "FOZ DO IGUAZU", { canal: "whatsapp" }),
    registro("Cuenca Del Plata (Analia )", "IGUAZU", { mails: ["reservas3@cuencadelplata.com"], canal: "mail" }),
    registro("Antarctica Hostel", "USHUAIA", { canal: "whatsapp", aclaraciones: "Mail/web original: WSP: +54" }),
    registro("Hostel nuevo", "SALTA", { mails: ["n@x.com"], canal: "mail" }),
  ];
  const r = compararDirectorio(excel, [tetrisViejo, natalia, antarctica, igual, viejo]);

  it("un proveedor que cambió de sección (Tetris: BRASIL → FOZ DO IGUAZU) se actualiza, no se duplica", () => {
    expect(r.idDe[1]).toBe("t1");
    expect(r.movidos).toEqual([{ id: "t1", nombre: "Tetris Hostel Foz do Iguacu", antes: "BRASIL", despues: "FOZ DO IGUAZU" }]);
  });

  it("un proveedor renombrado en la misma ciudad y con el mismo mail (Natalia → Analia) se actualiza", () => {
    expect(r.idDe[2]).toBe("c1");
    expect(r.renombrados).toEqual([
      { id: "c1", ciudad: "IGUAZU", antes: "Cuenca Del Plata (Natalia )", despues: "Cuenca Del Plata (Analia )" },
    ]);
  });

  it("los cambios de contacto (mails o canal) se listan con el antes y el después", () => {
    expect(r.cambiosContacto).toEqual([
      expect.objectContaining({ id: "a1", nombre: "Antarctica Hostel", antes: "sin contacto", despues: "WhatsApp" }),
    ]);
  });

  it("altas y bajas: lo nuevo del Excel se inserta; lo que ya no está se informa (no se borra solo)", () => {
    expect(r.idDe[4]).toBeNull();
    expect(r.altas.map((a) => a.nombre)).toEqual(["Hostel nuevo"]);
    expect(r.bajas.map((b) => b.id)).toEqual(["v1"]);
  });

  it("si el nombre está en más de una ciudad cargada, no adivina a cuál mover", () => {
    const dos = compararDirectorio(
      [registro("Rumbo Sur", "USHUAIA")],
      [enBase("r1", registro("Rumbo Sur", "CALAFATE")), enBase("r2", registro("Rumbo Sur", "BARILOCHE"))],
    );
    expect(dos.idDe[0]).toBeNull();
    expect(dos.movidos).toEqual([]);
  });

  it("un renombrado sin mail en común no se empareja (se informa como alta + baja)", () => {
    const sinMail = compararDirectorio([registro("Otro nombre", "IGUAZU")], [enBase("x", registro("Nombre viejo", "IGUAZU"))]);
    expect(sinMail.idDe[0]).toBeNull();
    expect(sinMail.bajas.map((b) => b.id)).toEqual(["x"]);
  });
});

describe("proveedores borrados con el OK del owner (data/proveedores-borrados.csv)", () => {
  it("lee nombre y ciudad (opcional) y aparta los registros del Excel que los nombran, para avisar", () => {
    const borrados = parsearProveedoresBorrados("nombre,ciudad,fecha,nota\nSelina La Paz,,2026-10-05,cerró\n");
    expect(borrados).toEqual([{ nombre: "Selina La Paz", nombreNormalizado: "selina la paz", ciudad: null, nota: "cerró" }]);
    const { quedan, vueltos } = apartarBorrados(
      [registro("selina la paz", "BOLIVIA"), registro("Selina salta", "SALTA")],
      borrados,
    );
    expect(quedan.map((r) => r.nombre)).toEqual(["Selina salta"]);
    expect(vueltos.map((r) => r.nombre)).toEqual(["selina la paz"]);
  });

  it("el archivo real tiene a Selina La Paz", async () => {
    const { readFileSync } = await import("node:fs");
    expect(parsearProveedoresBorrados(readFileSync("data/proveedores-borrados.csv", "utf-8")).map((b) => b.nombre)).toContain("Selina La Paz");
  });
});

describe("grupo con un mail para varios hoteles: cada hotel renombrado a su fila (spec M1-08 §3 #7 y #8)", () => {
  const mail = { mails: ["info@patagoniangroup.com.ar"], canal: "mail" as const };
  const cargados = [
    enBase("vl", registro("Vertical Lodge", "EL CHALTEN", mail)),
    enBase("fr", registro("Hosteria Fitz roy", "EL CHALTEN", mail)),
    enBase("ep", registro("Hosteria El Paraiso", "EL CHALTEN", mail)),
  ];

  it("si el nombre nuevo empieza con el viejo (\"…, proveedor Patagonian Group\"), es ese mismo proveedor", () => {
    const excel = [
      registro("Vertical Lodge, proveedor Patagonian Group", "EL CHALTEN", mail),
      registro("Hosteria Fitz roy, proveedor Patagonian Group", "EL CHALTEN", mail),
      registro("Hosteria El Paraiso, proveedor Patagonian Group", "EL CHALTEN", mail),
    ];
    const c = compararDirectorio(excel, cargados);
    expect(c.idDe).toEqual(["vl", "fr", "ep"]);
    expect(c.renombrados.map((r) => [r.antes, r.despues])).toEqual([
      ["Vertical Lodge", "Vertical Lodge, proveedor Patagonian Group"],
      ["Hosteria Fitz roy", "Hosteria Fitz roy, proveedor Patagonian Group"],
      ["Hosteria El Paraiso", "Hosteria El Paraiso, proveedor Patagonian Group"],
    ]);
    expect(c.altas).toEqual([]);
    expect(c.bajas).toEqual([]);
  });

  it("con el mismo mail y ningún nombre que calce, no se adivina: alta y baja", () => {
    const c = compararDirectorio([registro("Patagon Hotel, proveedor Patagonian Group", "EL CHALTEN", mail)], cargados);
    expect(c.idDe).toEqual([null]);
    expect(c.bajas).toHaveLength(3);
  });
});

describe("Cuenca del Plata: el owner agrega el tipo y el código al nombre de cada fila (M2-08, 2026-10-17)", () => {
  const mail = { mails: ["reservas8@cuencadelplata.com"], canal: "mail" as const };
  const cargados = [
    enBase("foz", registro("Paquete 105 Premium desde Foz: Transfer in+out en Foz/Igu, Lado Arg, Lado Bra", "IGUAZU", mail)),
    enBase("bra", registro("Lado Brasilero Premium", "IGUAZU", mail)),
    enBase("arg", registro("Lado Argentino Premium", "IGUAZU", mail)),
  ];

  it("si el nombre nuevo contiene al viejo como palabras enteras, es ese mismo proveedor (conserva el id); las filas nuevas son altas", () => {
    const excel = [
      registro("Paquete 105 Premium desde Foz: Transfer in+out en Foz/Igu, Lado Arg, Lado Bra IGRP01", "IGUAZU", mail),
      registro("Excursion Lado Brasilero Premium IGRE02", "IGUAZU", mail),
      registro("Excursion Lado Argentino Premium IGRE01", "IGUAZU", mail),
      registro("Ruinas de San Ignacio and Minas de Wanda full day IGRE03", "IGUAZU", mail),
    ];
    const c = compararDirectorio(excel, cargados);
    expect(c.idDe).toEqual(["foz", "bra", "arg", null]);
    expect(c.renombrados.map((r) => r.despues)).toEqual([
      "Paquete 105 Premium desde Foz: Transfer in+out en Foz/Igu, Lado Arg, Lado Bra IGRP01",
      "Excursion Lado Brasilero Premium IGRE02",
      "Excursion Lado Argentino Premium IGRE01",
    ]);
    expect(c.altas.map((a) => a.nombre)).toEqual(["Ruinas de San Ignacio and Minas de Wanda full day IGRE03"]);
    expect(c.bajas).toEqual([]);
  });

  it("un pedazo de palabra no cuenta como el nombre viejo", () => {
    const c = compararDirectorio(
      [registro("Sentido Hotel", "CALAFATE", mail)],
      [enBase("s", registro("Sent", "CALAFATE", mail)), enBase("o", registro("Otro", "CALAFATE", mail))],
    );
    expect(c.idDe).toEqual([null]);
  });
});
