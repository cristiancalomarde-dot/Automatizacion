import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { armarReservas, type DependenciasReservas } from "../emparejar/reservas-del-mail";
import type { ProponerProducto } from "../emparejar/emparejar";
import { catalogoJournawayDePrueba } from "../../../../tests/fixtures/journaway/catalogo";
import { conPax, lecturaDeVariante, original, sinVuelo, type LetraMail, type Variante } from "../../../../tests/fixtures/journaway/fichas";
import { leerSenalesJournaway } from "./senales";

/**
 * Spec M2-09 filas 8 a 15: de la ficha de Journaway a las reservas que se
 * guardan (componentes con su fecha y pick up, hoteles que no se piden,
 * número de viaje, contacto, notas y traslados). Sin base ni IA.
 */

const senales = leerSenalesJournaway(readFileSync(join(process.cwd(), "data", "journaway-senales.csv"), "utf-8"));

function deps(proponer?: ProponerProducto): DependenciasReservas {
  const { catalogo, journaway, detalle } = catalogoJournawayDePrueba();
  return { catalogo, detalle, proponer, proveedorTransferPNT: null, journaway: { catalogo: journaway, senales } };
}

async function armar(v: Variante, adjuntos: string[] = []) {
  const caso = lecturaDeVariante(v, adjuntos);
  const ia = vi.fn<ProponerProducto>();
  const armadas = await armarReservas(caso.ficha, deps(ia), { agencia: "Journaway", mail: caso.mail });
  return { armadas, ia };
}

const de = (l: LetraMail) => armar(original(l));
const codigoDe = (id: string | null | undefined) => catalogoJournawayDePrueba().catalogo.productos.find((p) => p.id === id)?.codigo ?? null;

describe("mail A (IGRE01)", () => {
  it("una reserva recibida con su tour, el pick up, la nota y sin número", async () => {
    const { armadas } = await de("A");
    expect(armadas).toHaveLength(1);
    const e = armadas[0].entrada;
    expect(codigoDe(e.productoId)).toBe("IGRE01");
    expect(e.estado).toBe("recibida");
    expect(e.bookingId ?? null).toBeNull();
    expect(e.tripNumber ?? null).toBeNull();
    expect(e.fechaInicio).toBe("2027-06-14");
    expect(e.pax).toBe(2);
    expect(e.notas).toContain("Journaway lo llama half-day; es el full day");
    expect(e.componentes).toEqual([
      expect.objectContaining({ tipo: "paquete", productoId: e.productoId, fechaInicio: "2027-06-14", pickUp: "Hotel Rafain Centro" }),
    ]);
  });

  it("fila 13: el contacto queda vacío y no figura ninguna dirección de HI Travel", async () => {
    const { armadas } = await de("A");
    expect(armadas[0].entrada.contactoCliente ?? null).toBeNull();
    expect(JSON.stringify(armadas[0].entrada.pasajeros)).not.toMatch(/hitravel/);
  });
});

describe("mail B (IGRE02)", () => {
  it("fila 13: el contacto del cliente; fila 9: Anrede como Sr./Sra.", async () => {
    const { armadas } = await de("B");
    const e = armadas[0].entrada;
    expect(codigoDe(e.productoId)).toBe("IGRE02");
    expect(e.contactoCliente).toEqual({ nombre: "Klara Katharina Ejemplo", email: "klara.ejemplo@example.de", telefono: "+49 170 0000001" });
    expect(e.pasajeros).toEqual([
      expect.objectContaining({ nombre: "Klara Katharina", apellido: "Ejemplo", fecha_nacimiento: "1978-03-09", tratamiento: "Sra." }),
      expect.objectContaining({ nombre: "Lenn", apellido: "Ejemplo", tratamiento: "Sr." }),
    ]);
  });

  it("fila 9: con 'Pax: 3' y 2 pasajeros va a revisión con el motivo en llano", async () => {
    const { armadas } = await armar(conPax(original("B"), 3));
    expect(armadas[0].entrada.estado).toBe("para_revision");
    expect(armadas[0].entrada.motivosRevision).toContain("Pax dice 3 y hay 2 pasajeros");
  });
});

describe("mail C (SPAP01 + SPAP03)", () => {
  it("dos reservas recibidas, con el número de viaje 62992 y sin booking_id (no viene el ID del asunto)", async () => {
    const { armadas } = await de("C");
    expect(armadas.map((a) => codigoDe(a.entrada.productoId))).toEqual(["SPAP01", "SPAP03"]);
    for (const a of armadas) {
      expect(a.entrada.estado).toBe("recibida");
      expect(a.entrada.tripNumber).toBe("62992");
      expect(a.entrada.bookingId ?? null).toBeNull();
      expect(a.entrada.pax).toBe(2);
      expect(a.avisos).toEqual([]);
    }
  });

  it("cada tour conserva su fecha; fila 11: sin pick up en el mail, queda vacío y no va a revisión", async () => {
    const { armadas } = await de("C");
    const [a, c] = armadas.map((x) => x.entrada.componentes.map((p) => [codigoDe(p.productoId), p.fechaInicio, p.pickUp ?? null]));
    expect(a).toEqual([
      ["SPAT01", "2027-03-16", null],
      ["SPAE01", "2027-03-16", null],
      ["SPAE02", "2027-03-19", null],
      ["SPAE03", "2027-03-17", null],
      ["SPAE04", "2027-03-17", null],
    ]);
    expect(c).toEqual([
      ["SPAE07", "2027-03-21", null],
      ["SPAE06", "2027-03-20", null],
      ["SPAE05", "2027-03-18", null],
      ["SPAT01", "2027-03-23", null],
    ]);
  });

  it("fila 15: un solo traslado de llegada (SPAP01, LA156) y uno solo de salida (SPAP03, LA377)", async () => {
    const { armadas } = await de("C");
    const [a, c] = armadas.map((x) => x.entrada);
    expect(a.sinTrasladoDe).toBe("salida");
    expect(a.componentes[0].descripcionRuta).toBe("Solo la llegada: la salida va con SPAP03");
    expect(c.sinTrasladoDe ?? null).toBeNull();
  });

  it("fila 15 con la regla del owner (2026-10-16): sin LA377 la reserva sigue recibida con el aviso de la salida de Calama, una sola vez", async () => {
    const { armadas } = await armar(sinVuelo(original("C"), "LA377"));
    expect(armadas.map((a) => a.entrada.estado)).toEqual(["recibida", "recibida"]);
    expect(armadas[0].avisos).toEqual([]);
    expect(armadas[1].avisos).toEqual([expect.stringMatching(/^Falta el vuelo de salida de Calama \(CJC\)/)]);
  });

  it("fila 10: con 'All Hotels are booked by us' no hay hoteles a pedir", async () => {
    const { armadas } = await de("C");
    for (const a of armadas) {
      expect(a.entrada.hotelesAgencia).toEqual([]);
      expect(a.entrada.notas).toContain("Todos los hoteles los reserva Journaway");
    }
  });
});

describe("mail D (SPAP05)", () => {
  it("una reserva recibida: Overland de Imperio Inca en UYUO01, del 15 al 17.10, con su pick up", async () => {
    const { armadas } = await de("D");
    expect(armadas).toHaveLength(1);
    const e = armadas[0].entrada;
    expect(codigoDe(e.productoId)).toBe("SPAP05");
    expect(e.estado).toBe("recibida");
    expect(e.componentes.map((p) => [codigoDe(p.productoId), p.fechaInicio, p.fechaFin, p.pickUp ?? null])).toEqual([
      ["SPAT01", "2026-10-11", "2026-10-11", null],
      ["SPAE01", "2026-10-11", "2026-10-11", "Our Habitas Atacama"],
      ["SPAE03", "2026-10-12", "2026-10-12", "Our Habitas Atacama"],
      ["SPAE05", "2026-10-13", "2026-10-13", "Our Habitas Atacama"],
      ["SPAE04", "2026-10-14", "2026-10-14", "Our Habitas Atacama"],
      ["SPAT02", "2026-10-15", "2026-10-15", null],
      ["UYUO01", "2026-10-15", "2026-10-17", "Tayka del Desierto Hotel / Tayka del Sal Hotel"],
    ]);
    expect(e.fechaInicio).toBe("2026-10-11");
    expect(e.fechaFin).toBe("2026-10-17");
    expect(armadas[0].avisos).toEqual([]);
  });

  it("fila 8: guarda los 6 tramos, con la llegada al otro día", async () => {
    const { armadas } = await de("D");
    const vuelos = armadas[0].entrada.vuelos as Array<Record<string, unknown>>;
    expect(vuelos).toHaveLength(6);
    expect(vuelos[1]).toMatchObject({ numero: "LA5404", origen: "MAD", destino: "SCL", fecha_llegada: "2026-10-07", hora_llegada: "08:25" });
  });

  it("fila 10: los 8 hoteles van a la parte informativa y ningún componente ni pedido los menciona", async () => {
    const { armadas } = await de("D");
    const e = armadas[0].entrada;
    expect(e.hotelesAgencia).toHaveLength(8);
    expect(e.hotelesAgencia![2]).toEqual({ nombre: "Our Habitas Atacama", desde: "2026-10-11", hasta: "2026-10-15" });
    const aPedir = JSON.stringify([e.componentes.map((c) => [c.descripcionRuta, c.textoAgencia]), e.pedidosEspeciales]);
    for (const h of ["Hub Providencia", "Fauna", "MET Hotel", "Sonesta", "Night Bus Peru", "Viza", "Saska"]) expect(aPedir).not.toContain(h);
  });

  it("fila 14: el aviso de los pasaportes, sin mandarlos a la IA", async () => {
    const { armadas } = await de("D");
    expect(armadas[0].entrada.notas).toContain("Trae adjuntos: pasaportes (no se leen)");
    const conAdjunto = await armar(original("A"), ["Pass_Mustermann.pdf"]);
    expect(conAdjunto.armadas[0].entrada.notas).toContain("Trae adjuntos: pasaportes (no se leen)");
  });
});

describe("señales rotas (data/journaway-senales.csv con un código que no existe)", () => {
  it("frena solo el mail de Journaway, con el mensaje claro y sin reservas", async () => {
    const caso = lecturaDeVariante(original("A"));
    const { catalogo, detalle } = catalogoJournawayDePrueba();
    const error = "data/journaway-senales.csv, fila 12: el código IGRE99 no está en el catálogo. No se procesó el mail.";
    await expect(
      armarReservas(caso.ficha, { catalogo, detalle, proveedorTransferPNT: null, errorJournaway: error }, { agencia: "Journaway", mail: caso.mail }),
    ).rejects.toThrow(error);
  });
});
