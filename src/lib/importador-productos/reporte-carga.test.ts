import { describe, expect, it } from "vitest";
import { clasificarServicio, reporteCargaMarkdown, resumirCarga, type ServicioCargado } from "./reporte-carga";

// Spec M1-04d §3 #10: reporte de cierre para el owner. Por paquete: cuántos
// servicios quedaron con proveedor y mail, por WhatsApp, manuales (Kupos) y
// la lista de los que siguen sin resolver, con su motivo.

function servicio(parcial: Partial<ServicioCargado>): ServicioCargado {
  return {
    codigo: "OD018",
    producto: "Buenos Aires, Tango City",
    destino: "BUE",
    orden: 1,
    prioridad: 1,
    tipo_servicio: "alojamiento",
    nivel: "Hostel",
    fila_excel: 482,
    descripcion: "Accommodation: Milhouse Avenue. Booking Supplier: Milhouse",
    service_provider_nombre: "Milhouse Avenue",
    booking_supplier_nombre: "Milhouse",
    opcional: false,
    reserva_manual: false,
    proveedor_sin_resolver: false,
    proveedor_para_revisar: false,
    proveedor_nota: null,
    proveedor: { nombre: "Milhouse Avenue Hostel", mails: ["a@milhouse.com"], canal: "mail", telefono: null, ciudad: "BUENOS AIRES" },
    ...parcial,
  };
}

describe("clasificarServicio", () => {
  it("con mail / por WhatsApp / manual / sin resolver / proveedor sin contacto", () => {
    expect(clasificarServicio(servicio({}))).toBe("mail");
    expect(
      clasificarServicio(servicio({ proveedor: { nombre: "Imperio Inca", mails: [], canal: "whatsapp", telefono: null, ciudad: "BOLIVIA" } })),
    ).toBe("whatsapp");
    expect(clasificarServicio(servicio({ reserva_manual: true, proveedor: null }))).toBe("manual");
    expect(clasificarServicio(servicio({ proveedor_sin_resolver: true, proveedor: null }))).toBe("sin_resolver");
    expect(
      clasificarServicio(servicio({ proveedor: { nombre: "Antarctica Hostel", mails: [], canal: null, telefono: null, ciudad: "USHUAIA" } })),
    ).toBe("sin_contacto");
  });
});

describe("resumirCarga y reporte", () => {
  const filas = [
    servicio({}),
    servicio({ orden: 2, prioridad: 1, proveedor: { nombre: "Imperio Inca", mails: [], canal: "whatsapp", telefono: "+591", ciudad: "BOLIVIA" } }),
    servicio({ codigo: "COMPCH01", producto: "Valparaiso Escapade", destino: "VLP", reserva_manual: true, proveedor: null, booking_supplier_nombre: "Kupos.cl" }),
    servicio({
      codigo: "OD033",
      producto: "El Chalten Starter Package",
      destino: "CHA",
      prioridad: 3,
      booking_supplier_nombre: "Patagonia",
      proveedor: null,
      proveedor_sin_resolver: true,
      proveedor_para_revisar: true,
      proveedor_nota: "Patagonia Hostel (El Chaltén): falta en el Excel de proveedores",
    }),
    servicio({
      codigo: "OD022",
      destino: "USH",
      booking_supplier_nombre: "Hotel Fantasma",
      proveedor: null,
      proveedor_sin_resolver: true,
    }),
  ];

  it("cuenta por paquete y lista lo sin resolver con su motivo (la nota del alias, o que no está en el directorio)", () => {
    const r = resumirCarga(filas);
    expect(r.porPaquete.find((p) => p.codigo === "OD018")).toMatchObject({ mail: 1, whatsapp: 1, manual: 0, sinResolver: 0 });
    expect(r.porPaquete.find((p) => p.codigo === "COMPCH01")).toMatchObject({ manual: 1 });
    expect(r.totales).toMatchObject({ servicios: 5, mail: 1, whatsapp: 1, manual: 1, sinResolver: 2, sinContacto: 0 });
    expect(r.sinResolver.map((s) => [s.codigo, s.bookingSupplier, s.motivo])).toEqual([
      ["OD033", "Patagonia", "Patagonia Hostel (El Chaltén): falta en el Excel de proveedores"],
      ["OD022", "Hotel Fantasma", "\"Hotel Fantasma\" no está en el directorio ni en las equivalencias de USH"],
    ]);
  });

  it("el markdown trae el resumen por paquete, la lista de sin resolver y el detalle servicio → nivel → opción → Booking Supplier → contacto", () => {
    const md = reporteCargaMarkdown(resumirCarga(filas), { fecha: "2026-10-05", archivo: "paquetes.xls", otrosPuntos: [] });
    expect(md).toContain("# Carga de los paquetes de los 7 tours (M1-04d)");
    expect(md).toContain("| OD018 |");
    expect(md).toContain("Patagonia Hostel (El Chaltén): falta en el Excel de proveedores");
    expect(md).toContain("a@milhouse.com");
    expect(md).toContain("WhatsApp");
    expect(md).toContain("Kupos.cl");
  });
});
