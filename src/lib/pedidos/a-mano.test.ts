// @vitest-environment node
//
// Spec M3-09 — verificación 1 (unitarios): el borrador inicial de un pedido a
// mano sale de `data/plantillas/pedido-proveedor.md` con los datos de la
// reserva (fila 3), la validación de a quién y del texto (filas 2 y 10) y que
// un pedido a mano no cuente como "pedido incompleto" (fila 7).
import { describe, expect, it } from "vitest";
import { TEXTOS } from "@/lib/textos";
import { borradorAMano, CASILLA_A_MANO, esPedidoAMano, leerMails, nombreDelPedido, validarPedidoAMano } from "./a-mano";
import { pedidoIncompleto } from "./envio/enviar";
import { cargarPlantilla, leerPlantilla } from "./plantilla";
import { MARCA_NOMBRE } from "./tipos";

const T = TEXTOS.pedidos.aMano;
const RESERVA = "1b6e1f0a-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
const PROVEEDOR = "8f7c6a2e-1b1a-4c3e-9a55-2a0f6d5b9c11";

const ARCH31 = {
  numero: "DK1592913",
  pax: 2,
  pasajeros: [
    { nombre: "Ana", apellido: "Prueba", pasaporte: "X123" },
    { nombre: "Luis", apellido: "Ensayo" },
  ],
};

describe("el borrador inicial de un pedido a mano (fila 3)", () => {
  const plantilla = cargarPlantilla();

  it("sale de la plantilla del repo: asunto con pasajero, pax y referencia; saludo, espacio, pasajeros, cierre y la firma de siempre", () => {
    const b = borradorAMano(ARCH31, plantilla);
    expect(b.asunto).toBe("Reserva Ana Prueba x2 · Ref. DK1592913");
    expect(b.firma).toBe(plantilla.firma);
    expect(b.firma).toContain(MARCA_NOMBRE);

    // El saludo y el "pedirles la siguiente reserva:" de la plantilla, después un espacio en blanco.
    expect(b.cuerpo.startsWith("¡Hola! ¿Cómo están? Esperamos que muy bien.\n\nLes escribimos desde HI Travel para pedirles la siguiente reserva:\n\n\n\n")).toBe(true);
    expect(b.cuerpo).toContain("Pasajeros: 2");
    expect(b.cuerpo).toContain("¡Muchas gracias!");
    // Sin datos de pasajeros más allá de la cantidad, y sin los datos de la plantilla sin completar.
    expect(b.cuerpo).not.toContain("X123");
    expect(b.cuerpo).not.toContain("Luis");
    expect(`${b.asunto}${b.cuerpo}`).not.toMatch(/\{\{/);
    // El espacio para escribir va antes de los pasajeros.
    expect(b.cuerpo.indexOf("reserva:\n\n\n\n")).toBeLessThan(b.cuerpo.indexOf("Pasajeros: 2"));
  });

  it("si la plantilla cambia, el borrador cambia (sin tocar código)", () => {
    const otra = leerPlantilla(
      "## Asunto\nPedido {{pasajero}} ({{pax}}){{referencia}}\n## Cuerpo\nBuen día.\n\n{{servicios}}\n\n{{pasajeros}}\n\nGracias.\n## Firma\n{{nombre_de_quien_envia}}\nHI",
    );
    const b = borradorAMano({ numero: null, pax: 3, pasajeros: [{ nombre: "Eva" }] }, otra);
    expect(b.asunto).toBe("Pedido Eva (3)");
    expect(b.cuerpo).toBe("Buen día.\n\n\n\nPasajeros: 3\n\nGracias.");
    expect(b.firma).toBe("{{nombre_de_quien_envia}}\nHI");
  });

  it("sin pax usa la cantidad de pasajeros; sin nombre, lo dice", () => {
    const b = borradorAMano({ numero: "  ", pax: null, pasajeros: [{ nombre: "" }, { nombre: "Eva" }] }, plantilla);
    expect(b.asunto).toBe("Reserva Eva x2");
    expect(borradorAMano({ numero: null, pax: null, pasajeros: [] }, plantilla).asunto).toBe("Reserva sin nombre x?");
    expect(borradorAMano({ numero: null, pax: null, pasajeros: [] }, plantilla).cuerpo).toContain("Pasajeros: a confirmar");
  });
});

describe("a quién: el mail (fila 2)", () => {
  it("lee uno o más mails separados por coma, punto y coma o espacios; los normaliza y saca repetidos", () => {
    expect(leerMails(" Reservas@HotelPUQ.cl ; ventas@hotelpuq.cl, reservas@hotelpuq.cl ")).toEqual({
      ok: true,
      mails: ["reservas@hotelpuq.cl", "ventas@hotelpuq.cl"],
    });
  });

  it.each(["reservas@hotelpuq", "reservas hotelpuq.cl", "@hotelpuq.cl", "res@@hotelpuq.cl", "reservas@.cl"])("no debe pasar: '%s' se rechaza con el mensaje en llano", (mal) => {
    expect(leerMails(mal)).toEqual({ ok: false, error: T.mailInvalido });
  });

  it("vacío pide elegir a quién", () => {
    expect(leerMails("  ")).toEqual({ ok: false, error: T.sinDestinatario });
  });
});

describe("validar el pedido a mano antes de guardarlo (filas 2 y 10)", () => {
  const plantilla = cargarPlantilla();
  const inicial = borradorAMano(ARCH31, plantilla);
  const base = {
    reservaId: RESERVA,
    proveedorId: PROVEEDOR,
    mails: "reservas@hotelpuq.cl",
    asunto: inicial.asunto,
    cuerpo: inicial.cuerpo.replace("reserva:\n\n", "reserva:\n\n1 noche extra, IN 14/01/2027 OUT 15/01/2027, habitación doble"),
  };

  it("un pedido completo pasa, con los mails ya normalizados", () => {
    const v = validarPedidoAMano({ ...base, mails: "Reservas@HotelPUQ.cl" }, inicial);
    expect(v).toEqual({ ok: true, pedido: { ...base, mails: ["reservas@hotelpuq.cl"] } });
  });

  it("sin proveedor del directorio también pasa (mail escrito a mano)", () => {
    const v = validarPedidoAMano({ ...base, proveedorId: null }, inicial);
    expect(v.ok && v.pedido.proveedorId).toBeNull();
  });

  it("no debe pasar: un mail mal escrito no se guarda", () => {
    expect(validarPedidoAMano({ ...base, mails: "reservas@hotelpuq" }, inicial)).toEqual({ ok: false, error: T.mailInvalido });
  });

  it.each([
    ["asunto vacío", { asunto: "   " }],
    ["texto vacío", { cuerpo: " \n " }],
    ["el borrador sin escribir lo que se pide", { cuerpo: inicial.cuerpo }],
  ])("no debe pasar: %s se rechaza con 'Escribí qué le pedís al proveedor'", (_caso, cambio) => {
    expect(validarPedidoAMano({ ...base, ...cambio }, inicial)).toEqual({ ok: false, error: T.sinTexto });
  });

  it("no debe pasar: una reserva o un proveedor que no son ids", () => {
    expect(validarPedidoAMano({ ...base, reservaId: "x" }, inicial).ok).toBe(false);
    expect(validarPedidoAMano({ ...base, proveedorId: "x" }, inicial).ok).toBe(false);
  });
});

describe("un pedido a mano en la reserva", () => {
  const armado = { estado: "enviado", a_mano: false, casilla: "x@y.cl", proveedores: ["Hotel"], destinatarios: ["x@y.cl"] };
  const aMano = { estado: "borrador", a_mano: true, casilla: `${CASILLA_A_MANO}abc`, proveedores: [], destinatarios: ["reservas@hotelpuq.cl"] };

  it("fila 7: no debe pasar: uno a mano sin enviar marca la reserva como pedido incompleto", () => {
    expect(pedidoIncompleto("pedido_a_proveedor", [armado, aMano])).toBe(pedidoIncompleto("pedido_a_proveedor", [armado]));
    expect(pedidoIncompleto("pedido_a_proveedor", [armado, aMano])).toBe(false);
    // Uno armado sin enviar sí la marca, como siempre.
    expect(pedidoIncompleto("pedido_a_proveedor", [armado, aMano, { ...armado, estado: "borrador" }])).toBe(true);
  });

  it("se reconoce por la marca o por su casilla", () => {
    expect(esPedidoAMano(aMano)).toBe(true);
    expect(esPedidoAMano({ ...aMano, a_mano: undefined })).toBe(true);
    expect(esPedidoAMano(armado)).toBe(false);
  });

  it("se nombra por el proveedor o, si no está en el directorio, por el mail", () => {
    expect(nombreDelPedido({ proveedores: ["Hotel PUQ"], destinatarios: ["r@puq.cl"] })).toBe("Hotel PUQ");
    expect(nombreDelPedido(aMano)).toBe("reservas@hotelpuq.cl");
  });
});
