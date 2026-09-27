import { describe, expect, it, vi } from "vitest";
import type { ProveedorAgrupado } from "./hoja";
import { resolverProveedor, type ConsultarIA } from "./resolver";

function grupo(parcial: Partial<ProveedorAgrupado>): ProveedorAgrupado {
  return {
    destino: "IGUAZU",
    nombre: "Proveedor X",
    nombreNormalizado: "proveedor x",
    categorias: [],
    estrellas: [],
    celdasMailWeb: [],
    aclaraciones: [],
    filasExcel: [10],
    ...parcial,
  };
}

const iaQueNoDebeLlamarse: ConsultarIA = vi.fn(async () => {
  throw new Error("no debería llamarse a la IA para esta celda");
});

describe("resolverProveedor — registro de `proveedor` a partir de un grupo (spec M1-03 §3)", () => {
  it("#2/#4 mail simple: canal mail, destino en `ciudad`, categoría en `aclaraciones` rotulada", async () => {
    const r = await resolverProveedor(
      grupo({
        nombre: "Milhouse Avenue Hostel",
        nombreNormalizado: "milhouse avenue hostel",
        destino: "BUENOS AIRES",
        categorias: ["Hostel"],
        estrellas: ["2*"],
        celdasMailWeb: ["melina@milhousehostel.com"],
      }),
      iaQueNoDebeLlamarse,
    );
    expect(r.registro).toEqual({
      nombre: "Milhouse Avenue Hostel",
      nombre_normalizado: "milhouse avenue hostel",
      ciudad: "BUENOS AIRES",
      mails: ["melina@milhousehostel.com"],
      canal: "mail",
      aclaraciones: "Categoría: Hostel\nEstrellas: 2*",
    });
    expect(r.celdasAmbiguas).toBe(0);
  });

  it("#5 varias celdas y varios mails: los guarda todos, sin repetir", async () => {
    const r = await resolverProveedor(
      grupo({ celdasMailWeb: ["a@x.com // b@x.com", "b@x.com, c@y.com.ar"] }),
      iaQueNoDebeLlamarse,
    );
    expect(r.registro.mails).toEqual(["a@x.com", "b@x.com", "c@y.com.ar"]);
    expect(r.registro.canal).toBe("mail");
  });

  it("#6 WPP: canal whatsapp, sin mail, y el texto original queda en aclaraciones", async () => {
    const r = await resolverProveedor(
      grupo({ categorias: ["Hostel"], celdasMailWeb: ["WPP "] }),
      iaQueNoDebeLlamarse,
    );
    expect(r.registro.canal).toBe("whatsapp");
    expect(r.registro.mails).toEqual([]);
    expect(r.registro.aclaraciones).toBe("Categoría: Hostel\nMail/web original: WPP");
  });

  it("#7 link a web: sin mail, sin canal, el link se conserva en aclaraciones", async () => {
    const link = "https://agencias.buquebus.com/buque-site/siteTurismoHome.do?method=siteTurismo";
    const r = await resolverProveedor(
      grupo({ celdasMailWeb: [link], aclaraciones: ["colonia day tour"] }),
      iaQueNoDebeLlamarse,
    );
    expect(r.registro.mails).toEqual([]);
    expect(r.registro.canal).toBeNull();
    expect(r.registro.aclaraciones).toBe(
      `Aclaraciones: colonia day tour\nMail/web original: ${link}`,
    );
  });

  it.each([[["#ERROR!"]], [[]]])(
    "#8 celda %j: se carga igual, sin mail, sin whatsapp, sin llamar a la IA",
    async (celdas) => {
      const r = await resolverProveedor(
        grupo({ categorias: ["Hotel"], celdasMailWeb: celdas }),
        iaQueNoDebeLlamarse,
      );
      expect(r.registro).toMatchObject({
        nombre: "Proveedor X",
        ciudad: "IGUAZU",
        mails: [],
        canal: null,
        aclaraciones: "Categoría: Hotel",
      });
    },
  );

  it("mail con texto extra relevante: guarda el mail y conserva el texto original en aclaraciones", async () => {
    const celda =
      "reservas@hieloyaventura.com  (Reservar por la web) https://agencias.hieloyaventura.com/excursiones";
    const r = await resolverProveedor(grupo({ celdasMailWeb: [celda] }), iaQueNoDebeLlamarse);
    expect(r.registro.mails).toEqual(["reservas@hieloyaventura.com"]);
    // espacios colapsados, texto intacto
    expect(r.registro.aclaraciones).toBe(
      "Mail/web original: reservas@hieloyaventura.com (Reservar por la web) https://agencias.hieloyaventura.com/excursiones",
    );
  });

  describe("#9 celdas ambiguas → respaldo de IA, con guarda contra mails inventados", () => {
    it("solo las celdas ambiguas llegan a la IA, con el texto de la celda y de Aclaraciones", async () => {
      const ia = vi.fn<ConsultarIA>(async () => ({ mails: [], canal: "ninguno", confianza: 0.95 }));
      await resolverProveedor(
        grupo({ celdasMailWeb: ["VER MAILLLL", "#ERROR!"], aclaraciones: ["pedir a Ana"] }),
        ia,
      );
      expect(ia).toHaveBeenCalledTimes(1);
      expect(ia).toHaveBeenCalledWith({
        nombre: "Proveedor X",
        textoMailWeb: "VER MAILLLL",
        aclaraciones: "pedir a Ana",
      });
    });

    it("si otra celda del mismo proveedor ya dio un mail por regla, no se gasta una llamada de IA", async () => {
      const r = await resolverProveedor(
        grupo({ celdasMailWeb: ["VER MAILLLL", "ok@hotel.com"] }),
        iaQueNoDebeLlamarse,
      );
      expect(r.registro.mails).toEqual(["ok@hotel.com"]);
      expect(r.celdasAmbiguas).toBe(1);
    });

    it("acepta un mail de la IA con confianza alta solo si aparece literal en el Excel", async () => {
      const ia: ConsultarIA = async () => ({
        mails: ["Info@Hotel.com"],
        canal: "mail",
        confianza: 0.9,
      });
      const r = await resolverProveedor(
        grupo({ celdasMailWeb: ["VER MAILLLL"], aclaraciones: ["escribir a info@hotel.com"] }),
        ia,
      );
      expect(r.registro.mails).toEqual(["info@hotel.com"]);
      expect(r.registro.canal).toBe("mail");
      expect(r.resueltasPorIA).toBe(1);
    });

    it("NUNCA guarda un mail que la IA propone pero no está en el Excel, aunque diga confianza alta", async () => {
      const ia: ConsultarIA = async () => ({
        mails: ["reservas.calafate@rochester-hotel.com"],
        canal: "mail",
        confianza: 0.99,
      });
      const r = await resolverProveedor(
        grupo({ celdasMailWeb: ["reservas.calafate@rochester-hotel"] }),
        ia,
      );
      expect(r.registro.mails).toEqual([]);
      expect(r.registro.canal).toBeNull();
      expect(r.mailsRechazadosIA).toEqual(["reservas.calafate@rochester-hotel.com"]);
      expect(r.registro.aclaraciones).toBe("Mail/web original: reservas.calafate@rochester-hotel");
    });

    it("confianza por debajo del umbral → sin mail (igual que una celda vacía)", async () => {
      const ia: ConsultarIA = async () => ({ mails: ["info@hotel.com"], canal: "mail", confianza: 0.5 });
      const r = await resolverProveedor(
        grupo({ celdasMailWeb: ["VER MAILLLL"], aclaraciones: ["info@hotel.com"] }),
        ia,
      );
      expect(r.registro.mails).toEqual([]);
      expect(r.registro.canal).toBeNull();
    });

    it("IA no disponible o techo de gasto agotado (null) → sin mail, nunca se inventa", async () => {
      const r = await resolverProveedor(grupo({ celdasMailWeb: ["VER MAILLLL"] }), async () => null);
      expect(r.registro).toMatchObject({ mails: [], canal: null });
      expect(r.celdasAmbiguas).toBe(1);
      expect(r.resueltasPorIA).toBe(0);
    });

    it("sin consultor de IA configurado → la celda ambigua queda sin mail", async () => {
      const r = await resolverProveedor(grupo({ celdasMailWeb: ["<"] }), null);
      expect(r.registro).toMatchObject({ mails: [], canal: null });
      expect(r.celdasAmbiguas).toBe(1);
    });

    it("la IA puede marcar whatsapp con confianza alta", async () => {
      const ia: ConsultarIA = async () => ({ mails: [], canal: "whatsapp", confianza: 0.9 });
      const r = await resolverProveedor(grupo({ celdasMailWeb: ["mensaje al celu de Omar"] }), ia);
      expect(r.registro).toMatchObject({ mails: [], canal: "whatsapp" });
    });
  });
});
