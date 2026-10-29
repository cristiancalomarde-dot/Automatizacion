// Spec M3-32 — verificación 1 (unitarios): los pedidos a los proveedores de Brasil (su `ciudad` en el
// directorio está en data/ciudades-portugues.csv) salen en portugués de Brasil: la plantilla pt y los
// renglones armados. Lo interno (avisos, tareas) sigue en castellano y el pedido en castellano no cambia.
import { describe, expect, it } from "vitest";
import { borradorAMano } from "./a-mano-borrador";
import { armarPedidos } from "./armar";
import { cargarAlojamientosSinDesayuno, cargarCiudadesPortugues, leerCiudadesPortugues } from "./cargar";
import { fechaCorta, fechasDelAsunto, habitacionDelPedido, rangoCorto, renglonDelPasajero } from "./formato";
import { idiomaDeLaCiudad, TEXTOS_DEL_PEDIDO } from "./idioma";
import { cargarPlantilla } from "./plantilla";
import { renglonDelVuelo } from "./renglon-vuelo";
import { P, catalogoCon, od010b, producto, proveedor, reserva, reservaOd010b, servicio } from "./fixtures.test-utils";
import type { CatalogoParaPedidos, ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const plantillaPt = cargarPlantilla(undefined, "pt");
const ciudades = cargarCiudadesPortugues();

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

describe("fila 1 — quién es de Brasil (data/ciudades-portugues.csv)", () => {
  it("el CSV trae las ciudades de la spec, cada una con su nota", () => {
    const nombres = ciudades.map((c) => c.ciudad);
    expect(nombres).toEqual(
      expect.arrayContaining(["BRASIL", "FOZ DO IGUAZU", "FOZ DO IGUAÇU", "RIO DE JANEIRO", "ILHA GRANDE", "PARATY", "SALVADOR", "BONITO", "SAO PAULO", "BUZIOS", "MANAOS"]),
    );
    for (const c of ciudades) expect(c.nota).toBeTruthy();
  });

  it("la cabecera equivocada o una fila sin ciudad fallan con un mensaje claro", () => {
    expect(() => leerCiudadesPortugues("pais,nota\nX,y\n")).toThrow(/ciudad,nota/);
    expect(() => leerCiudadesPortugues("ciudad,nota\n,falta\n")).toThrow(/fila 2/);
  });

  it.each([
    ["FOZ DO IGUAZU", "pt"], // Bambu hostel
    ["PARATY", "pt"], // Pousada Dom Angelo
    ["Foz do Iguaçu", "pt"],
    ["rio de janeiro", "pt"],
    ["São Paulo", "pt"],
    ["Lençóis", "pt"],
    ["BRASIL", "pt"],
    ["Puerto Iguazú", "es"], // Cuenca del Plata
    ["IGUAZU", "es"],
    ["BUENOS AIRES", "es"],
    [null, "es"], // sin ciudad
    ["", "es"],
  ] as const)("%s → %s", (ciudad, idioma) => {
    expect(idiomaDeLaCiudad(ciudad, ciudades)).toBe(idioma);
  });
});

describe("fila 2 — la plantilla en portugués", () => {
  it("mismo formato y datos; asunto y cuerpo en pt, la firma igual que en castellano", () => {
    expect(plantillaPt.asunto).toBe("Solicitação de reserva – {{pasajero}} x {{pax}} – {{fechas}}");
    expect(plantillaPt.cuerpo).toMatch(/^Olá! Tudo bem\? Esperamos que sim\./);
    expect(plantillaPt.cuerpo).toContain("Muito obrigado!");
    for (const dato of ["{{servicios}}", "{{horario}}", "{{pasajeros}}", "{{pendientes}}"]) expect(plantillaPt.cuerpo).toContain(dato);
    expect(plantillaPt.firma).toBe(plantilla.firma);
  });
});

describe("fila 3 — los renglones armados en portugués", () => {
  it("fechas", () => {
    expect(fechaCorta("2027-02-01", "pt")).toBe("1 fev 2027");
    expect(rangoCorto("2027-01-30", "2027-02-02", "pt")).toBe("de 30 jan a 2 fev 2027");
    expect(rangoCorto("2027-01-24", "2027-01-28", "pt")).toBe("de 24 a 28 jan 2027");
    expect(rangoCorto("2026-12-30", "2027-01-02", "pt")).toBe("de 30 dez 2026 a 2 jan 2027");
    expect(fechasDelAsunto(["2027-01-30", "2027-02-02"], "pt")).toBe("30 jan a 2 fev 2027");
    expect(fechasDelAsunto(["2027-02-01"], "pt")).toBe("1 fev 2027");
  });

  it("noches", () => {
    expect(TEXTOS_DEL_PEDIDO.pt.noches(1)).toBe("1 noite");
    expect(TEXTOS_DEL_PEDIDO.pt.noches(3)).toBe("3 noites");
  });

  it.each([
    ["Double Room - Hostel", { pax: 2, hostel: true }, "DBL Standard com café da manhã"],
    ["Dormitory - Hostel", { pax: 2, hostel: true }, "quarto compartilhado (dorm), com café da manhã"],
    [null, { pax: 2, hostel: true }, "a confirmar (dorm / DBL / SGL), com café da manhã"],
    [null, { pax: 3, hostel: false }, "Standard com café da manhã (tipo a confirmar)"],
    ["Double Room - Hostel", { pax: 2, hostel: true, desayuno: false }, "DBL Standard"],
    ["Dormitory - Hostel", { pax: 2, hostel: true, desayuno: false }, "quarto compartilhado (dorm)"],
  ] as const)("habitación %s con %o → %s", (hab, ctx, esperado) => {
    expect(habitacionDelPedido(hab, ctx, "pt")).toBe(esperado);
  });

  it("la línea de pasajeros", () => {
    expect(renglonDelPasajero({ nombre: "Ana", apellido: "Gómez", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" }, 0, "pt")).toBe(
      "PAX 1: Ana Gómez · Nacionalidade: Denmark · Data de nascimento: 17/05/1990 · Passaporte: pendente",
    );
  });

  it("el vuelo", () => {
    const v = { numero: "G3 1234", aerolinea: "GOL", origen: "GRU", destino: "IGU", fecha_salida: "2027-02-20", hora_salida: "08:30", fecha_llegada: "2027-02-20", hora_llegada: "10:20" };
    expect(renglonDelVuelo(v, "pt")).toBe("Voo: G3 1234 (GOL) – sai GRU 20 fev 08:30 – chega Foz do Iguaçu (IGU) 20 fev 10:20");
    expect(renglonDelVuelo({ ...v, numero: null, origen: null, fecha_salida: null, hora_salida: null }, "pt")).toBe("Chegada: Foz do Iguaçu (IGU) 20 fev 10:20 (sem número de voo)");
  });

  it("el horario de M3-34", () => {
    expect(TEXTOS_DEL_PEDIDO.pt.horarioExcursiones(1)).toBe("Vocês podem nos confirmar o horário do passeio, por favor?");
    expect(TEXTOS_DEL_PEDIDO.pt.horarioExcursiones(2)).toBe("Vocês podem nos confirmar o horário dos passeios, por favor?");
    expect(TEXTOS_DEL_PEDIDO.pt.horarioExcursiones(0)).toBe("");
  });
});

// --- Un pedido entero ---------------------------------------------------------------------------

const bambu = { ...proveedor("prov-bambu", "Bambu hostel", ["hostelsbambu@gmail.com"]), ciudad: "FOZ DO IGUAZU" };
const pousada = { ...proveedor("prov-dom-angelo", "Pousada Dom Angelo", ["reservas@domangelo.test"]), ciudad: "PARATY" };
const guia = { ...proveedor("prov-guia-rio", "Rio Guia", ["guia@rio.test"]), ciudad: "RIO DE JANEIRO" };

function catalogo(detalles: Parameters<typeof catalogoCon>[0], extra: Partial<CatalogoParaPedidos> = {}): CatalogoParaPedidos {
  return { ...catalogoCon(detalles), ciudadesPortugues: ciudades, ...extra };
}

const paraty = producto("prod-paraty", "BRA01", [
  servicio({ productoId: "prod-paraty", tipo: "alojamiento", serviceProviderNombre: "Pousada Dom Angelo", bookingSupplier: pousada }),
  servicio({ productoId: "prod-paraty", tipo: "excursion", descripcion: "Excursion: Boat tour Paraty", bookingSupplier: guia }),
  servicio({ productoId: "prod-paraty", tipo: "traslado", descripcion: "Transfer in Rio de Janeiro - Paraty", sentido: "llegada", bookingSupplier: guia }),
]);
const reservaParaty = reserva({ productoId: "prod-paraty", fechaInicio: "2027-03-05", fechaFin: "2027-03-08" });

describe("un pedido a un proveedor de Brasil sale entero en portugués", () => {
  it("la pousada de Paraty: asunto, saludo, alojamiento, noches, quarto, pasajeros y la firma de siempre", () => {
    const r = ok(armarPedidos(reservaParaty, catalogo([paraty]), plantilla, plantillaPt));
    const p = r.pedidos.find((x) => x.destinatarios.includes("reservas@domangelo.test"))!;
    expect(p.asunto).toBe("Solicitação de reserva – Ana Gómez x 2 – 5 a 8 mar 2027");
    expect(p.cuerpo).toBe(
      [
        "Olá! Tudo bem? Esperamos que sim.",
        "",
        "Escrevemos da HI Travel para solicitar a seguinte reserva:",
        "",
        "Hospedagem: Pousada Dom Angelo",
        "IN: 5 mar 2027",
        "OUT: 8 mar 2027 (3 noites)",
        "Quarto: DBL Standard com café da manhã",
        "",
        "Passageiros: 2",
        "PAX 1: Ana Gómez · Nacionalidade: Denmark · Data de nascimento: 17/05/1990 · Passaporte: pendente",
        "PAX 2: Luis Pérez · Nacionalidade: Denmark · Data de nascimento: 03/02/1991 · Passaporte: pendente",
        "",
        "Vocês podem nos confirmar quando puderem? Se precisarem de mais algum dado, é só avisar que enviamos na hora.",
        "",
        "Muito obrigado!",
        "Abraços!",
      ].join("\n"),
    );
    expect(p.firma).toBe(plantilla.firma);
  });

  it("excursión y traslado: Passeio, Data, Serviço, pick up, voo a confirmar, horario y pendientes en pt", () => {
    const r = ok(armarPedidos(reservaParaty, catalogo([paraty]), plantilla, plantillaPt));
    const p = r.pedidos.find((x) => x.destinatarios.includes("guia@rio.test"))!;
    expect(p.cuerpo).toContain("1) Passeio: Boat tour Paraty\nData: a combinar (estadia de 5 a 8 mar 2027)\nServiço: regular · Idioma: inglês\nPick up e drop off: Pousada Dom Angelo · hotel a confirmar");
    expect(p.cuerpo).toContain("2) Transfer de chegada: Transfer in Rio de Janeiro - Paraty\nData: 5 mar 2027\nVoo a confirmar");
    expect(p.cuerpo).toContain("Vocês podem nos confirmar o horário do passeio, por favor?");
    expect(p.cuerpo).toContain("Ainda não temos o voo: passamos para vocês assim que chegar.");
    expect(p.cuerpo).toContain("Passageiros: 2\nPAX 1: Ana Gómez · Nacionalidade: Denmark");
    expect(p.cuerpo).not.toMatch(/Fecha|Excursión|Pasajeros|Vuelo|¿/);
  });

  it("fila 4 — lo interno sigue en castellano (avisos del pedido y de la reserva)", () => {
    const r = ok(armarPedidos(reservaParaty, catalogo([paraty]), plantilla, plantillaPt));
    const p = r.pedidos.find((x) => x.destinatarios.includes("guia@rio.test"))!;
    expect(p.avisos).toContain("Falta la fecha de Boat tour Paraty: completala antes de enviar.");
  });

  it("Bambu (sin desayuno, M3-35): DBL Standard, sin 'com café da manhã'", () => {
    const foz = producto("prod-foz", "BRA02", [servicio({ productoId: "prod-foz", tipo: "alojamiento", serviceProviderNombre: "Bambu", bookingSupplier: bambu })]);
    const r = ok(
      armarPedidos(reserva({ productoId: "prod-foz", fechaInicio: "2027-02-01", fechaFin: "2027-02-02" }), catalogo([foz], { sinDesayuno: cargarAlojamientosSinDesayuno() }), plantilla, plantillaPt),
    );
    const [p] = r.pedidos;
    expect(p.cuerpo).toContain("Hospedagem: Bambu\nIN: 1 fev 2027\nOUT: 2 fev 2027 (1 noite)\nQuarto: DBL Standard\n");
    expect(p.asunto).toBe("Solicitação de reserva – Ana Gómez x 2 – 1 a 2 fev 2027");
  });

  it("sin la lista de ciudades o sin la plantilla pt, todo sale en castellano (como antes)", () => {
    const sinLista = ok(armarPedidos(reservaParaty, catalogoCon([paraty]), plantilla, plantillaPt));
    const sinPt = ok(armarPedidos(reservaParaty, catalogo([paraty]), plantilla));
    for (const r of [sinLista, sinPt]) {
      const p = r.pedidos.find((x) => x.destinatarios.includes("reservas@domangelo.test"))!;
      expect(p.cuerpo).toContain("Alojamiento: Pousada Dom Angelo");
      expect(p.asunto).toMatch(/^Solicitud de reserva/);
    }
  });
});

describe("fila 8 — el pedido en castellano no cambia", () => {
  it("Cuenca del Plata (Argentina) con la lista de ciudades y la plantilla pt: idéntico a sin ellas", () => {
    const antes = ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla));
    const ahora = ok(armarPedidos(reservaOd010b, { ...catalogoCon([od010b]), ciudadesPortugues: ciudades }, plantilla, plantillaPt));
    expect(ahora).toEqual(antes);
  });

  it("un proveedor sin ciudad (P.cuenca) → castellano", () => {
    expect(idiomaDeLaCiudad((P.cuenca as { ciudad?: string | null }).ciudad, ciudades)).toBe("es");
  });
});

describe("fila 6 — el pedido a mano con un proveedor de Brasil arranca con la plantilla pt", () => {
  it("borradorAMano en pt", () => {
    const b = borradorAMano({ numero: null, fechaInicio: "2027-02-01", fechaFin: "2027-02-02", pax: 2, pasajeros: reserva().pasajeros }, plantillaPt, "pt");
    expect(b.asunto).toBe("Solicitação de reserva – Ana Gómez x 2 – 1 a 2 fev 2027");
    expect(b.cuerpo).toMatch(/^Olá! Tudo bem\?/);
    expect(b.cuerpo).toContain("Passageiros: 2");
    expect(b.cuerpo).not.toContain("Pasajeros");
    expect(b.firma).toBe(plantilla.firma);
  });

  it("en castellano sigue igual", () => {
    const b = borradorAMano({ numero: null, fechaInicio: "2027-02-01", fechaFin: "2027-02-02", pax: 2, pasajeros: reserva().pasajeros }, plantilla);
    expect(b.asunto).toBe("Solicitud de reserva – Ana Gómez x 2 – 1 al 2 feb 2027");
    expect(b.cuerpo).toContain("Pasajeros: 2");
  });
});
