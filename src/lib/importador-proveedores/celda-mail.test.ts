import { describe, expect, it } from "vitest";
import { clasificarCeldaMail } from "./celda-mail";

// Spec M1-03 §3 #4-#8 y Anexo técnico "Reglas simples antes que IA (orden de
// resolución por celda)". Los textos de prueba son copias literales de celdas
// reales de la hoja "Contactos hi".
describe("clasificarCeldaMail — reglas simples por celda (spec M1-03)", () => {
  it("#4 mail simple → canal mail con ese mail", () => {
    expect(clasificarCeldaMail("melina@milhousehostel.com")).toEqual({
      tipo: "mail",
      mails: ["melina@milhousehostel.com"],
    });
  });

  it("#5 dos mails separados por // → guarda los dos", () => {
    const r = clasificarCeldaMail("ventas@uphoteles.com  //  reservas@hotel-argentino.com.ar");
    expect(r.tipo).toBe("mail");
    expect(r.mails).toEqual(["ventas@uphoteles.com", "reservas@hotel-argentino.com.ar"]);
  });

  it("#5 mails separados por coma y ; (con nombres y <>) → guarda todos, sin duplicar", () => {
    const r = clasificarCeldaMail(
      " Kahuak turismo <reservas@kahuak.com.ar>, agencias@kahuak.com.ar <agencias@kahuak.com.ar>, Maru <receptivo@kahuak.com.ar>",
    );
    expect(r.mails).toEqual([
      "reservas@kahuak.com.ar",
      "agencias@kahuak.com.ar",
      "receptivo@kahuak.com.ar",
    ]);
    expect(clasificarCeldaMail("<reservas@mahinatur.cl>; operaciones@mahinatur.cl").mails).toEqual([
      "reservas@mahinatur.cl",
      "operaciones@mahinatur.cl",
    ]);
  });

  it("#5 mail con texto alrededor (mailto, comillas, saltos de línea) → extrae solo el mail", () => {
    expect(clasificarCeldaMail(" [mailto:contacto@mahinatur.cl]").mails).toEqual([
      "contacto@mahinatur.cl",
    ]);
    expect(clasificarCeldaMail("hosterialoshielos@cotecal.com.ar'").mails).toEqual([
      "hosterialoshielos@cotecal.com.ar",
    ]);
    expect(clasificarCeldaMail("  <hostel.last.hope@gmail.com>\n\n\n").mails).toEqual([
      "hostel.last.hope@gmail.com",
    ]);
  });

  it("#5 si hay mail y también 'wpp', gana el mail (regla 2 antes que regla 3)", () => {
    expect(clasificarCeldaMail("wpp // ask@troutandwine.com")).toEqual({
      tipo: "mail",
      mails: ["ask@troutandwine.com"],
    });
  });

  it.each(["WPP ", "WPP", "Por wpp", "SOLO WPP", "por wsp ", "Wpp omar", "xwpp - https://yaghanhostel.com/"])(
    "#6 '%s' → canal whatsapp, sin mail",
    (texto) => {
      expect(clasificarCeldaMail(texto)).toEqual({ tipo: "whatsapp", mails: [] });
    },
  );

  it.each([
    "https://agencias.buquebus.com/buque-site/siteTurismoHome.do?method=siteTurismo",
    "https://www.centraldepasajes.com.ar/",
    "www.ejemplo.com.ar",
    "tangoinnhostel.cloudbeds.com",
  ])("#7 link a web '%s' → sin mail (nunca un mail armado desde el link)", (texto) => {
    expect(clasificarCeldaMail(texto)).toEqual({ tipo: "web", mails: [] });
  });

  it.each(["", "   ", "#ERROR!", " #ERROR! "])(
    "#8 celda vacía o #ERROR! ('%s') → sin dato, sin mail, sin whatsapp",
    (texto) => {
      expect(clasificarCeldaMail(texto)).toEqual({ tipo: "vacia", mails: [] });
    },
  );

  it("#8 celda nula/indefinida → sin dato", () => {
    expect(clasificarCeldaMail(undefined)).toEqual({ tipo: "vacia", mails: [] });
    expect(clasificarCeldaMail(null)).toEqual({ tipo: "vacia", mails: [] });
  });

  it.each([
    "VER MAILLLL",
    "Lo mismo que el de arriba pero especificar hoteles",
    "<",
    // tiene @ pero no es un mail válido (dominio truncado): no se "completa"
    "reservas.calafate@rochester-hotel",
  ])("#9 texto que no calza con ninguna regla ('%s') → ambigua (candidata a IA)", (texto) => {
    expect(clasificarCeldaMail(texto)).toEqual({ tipo: "ambigua", mails: [] });
  });
});
