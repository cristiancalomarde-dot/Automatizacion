import { describe, expect, it } from "vitest";
import { compararDirectorio, type ProveedorEnBase } from "./cambios";
import type { RegistroProveedor } from "./resolver";
import { reporteRecargaMarkdown } from "./reporte-recarga";

function registro(nombre: string, ciudad: string, extra: Partial<RegistroProveedor> = {}): RegistroProveedor {
  return { nombre, nombre_normalizado: nombre.toLowerCase(), ciudad, mails: [], canal: null, aclaraciones: null, ...extra };
}

describe("reporte de la recarga del directorio para el owner (spec M1-07 §3 #11)", () => {
  const excel = [
    registro("Tetris Hostel Foz do Iguacu", "FOZ DO IGUAZU", { canal: "whatsapp" }),
    registro("Cuenca Del Plata (Analia )", "IGUAZU", { mails: ["r@c.com"], canal: "mail" }),
    registro("Antarctica Hostel", "USHUAIA", { canal: "whatsapp" }),
    registro("Madidi Amazon Lodge", "BOLIVIA", { mails: ["m@x.com"], canal: "mail" }),
    registro("Las Lengas", "EL CHALTEN", { mails: ["l@x.com"], canal: "mail" }),
    registro("Rumbo Sur", "USHUAIA", { mails: ["rs@x.com"], canal: "mail" }),
    registro("Rumbo Sur", "CALAFATE", { mails: ["rs@x.com"], canal: "mail" }),
    registro("Hotel sin nada", "SALTA"),
  ];
  const base: ProveedorEnBase[] = [
    { id: "t", ...registro("Tetris Hostel Foz do Iguacu", "BRASIL", { canal: "whatsapp" }) },
    { id: "c", ...registro("Cuenca Del Plata (Natalia )", "IGUAZU", { mails: ["r@c.com"], canal: "mail" }) },
    { id: "a", ...registro("Antarctica Hostel", "USHUAIA") },
    { id: "l1", ...registro("Las Lengas", "EL CHALTEN", { mails: ["l@x.com"], canal: "mail" }) },
    { id: "l2", ...registro("Las Lengas", "CHALTEN", { mails: ["l@x.com"], canal: "mail" }) },
    { id: "r1", ...registro("Rumbo Sur", "USHUAIA", { mails: ["rs@x.com"], canal: "mail" }) },
    { id: "r2", ...registro("Rumbo Sur", "CALAFATE", { mails: ["rs@x.com"], canal: "mail" }) },
    { id: "s", ...registro("Hotel sin nada", "SALTA") },
  ];
  const cambios = compararDirectorio(excel, base);
  // El directorio después de la recarga: lo de la base actualizado + las altas.
  const despues = [
    ...base.map((p) => ({ ...p, ...(excel[cambios.idDe.indexOf(p.id)] ?? {}) })),
    ...cambios.altas.map((a, i) => ({ id: `n${i}`, ...a })),
  ];
  const md = reporteRecargaMarkdown({
    fecha: "2026-10-09",
    archivo: "Proveedores Hi Travel 2026 para IA.xlsx",
    resumen: { procesados: excel.length, insertados: cambios.altas.length, actualizados: excel.length - cambios.altas.length },
    cambios,
    borrados: [{ nombre: "Selina La Paz", nombreNormalizado: "selina la paz", ciudad: null }],
    borradosQueVolvieron: [],
    directorio: despues,
    enUso: new Map([["l2", ["OD033"]]]),
  });

  it("cuenta qué cambió: altas, movidos, renombrados y contactos", () => {
    expect(md).toContain("# Recarga del directorio de proveedores (M1-07)");
    expect(md).toMatch(/Madidi Amazon Lodge.*BOLIVIA/);
    expect(md).toMatch(/Tetris Hostel Foz do Iguacu.*BRASIL.*FOZ DO IGUAZU/);
    expect(md).toMatch(/Cuenca Del Plata \(Natalia \).*Cuenca Del Plata \(Analia \)/);
    expect(md).toMatch(/Antarctica Hostel.*sin contacto.*WhatsApp/);
  });

  it("las bajas se informan con dónde se usan, y no se borran", () => {
    expect(md).toMatch(/## Ya no están en el Excel/);
    expect(md).toMatch(/Las Lengas.*CHALTEN.*OD033/);
    expect(md).toMatch(/no los borré/i);
  });

  it("lo que no cierra: sin contacto, secciones duplicadas (CHALTEN / EL CHALTEN) y el mismo nombre en otra ciudad", () => {
    expect(md).toMatch(/## Lo que no cierra/);
    expect(md).toMatch(/Hotel sin nada.*SALTA/);
    expect(md).toMatch(/“CHALTEN” y “EL CHALTEN”/);
    expect(md).toMatch(/Rumbo Sur.*CALAFATE.*USHUAIA|Rumbo Sur.*USHUAIA.*CALAFATE/);
  });

  it("confirma que Selina La Paz no volvió (y avisa si el Excel lo trae)", () => {
    expect(md).toMatch(/Selina La Paz.*no está en el Excel/);
    const vuelto = reporteRecargaMarkdown({
      fecha: "x",
      archivo: "x",
      resumen: { procesados: 0, insertados: 0, actualizados: 0 },
      cambios: compararDirectorio([], []),
      borrados: [{ nombre: "Selina La Paz", nombreNormalizado: "selina la paz", ciudad: null }],
      borradosQueVolvieron: [registro("Selina La Paz", "BOLIVIA")],
      directorio: [],
      enUso: new Map(),
    });
    expect(vuelto).toMatch(/Selina La Paz.*BOLIVIA.*volvió a aparecer.*no lo cargué/);
  });
});
