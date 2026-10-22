import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leerAgencias } from "./agencias";
import { clienteFalso, llamadasFalsas, mailDePrueba, registroFalso, respuestaGrabada } from "./__fixtures__/cargar";
import { catalogoDePrueba, detallePorId, idDe, proveedorPatagoniaPlanet } from "./emparejar/__fixtures__/cargar";
import { MOTIVOS_EMPAREJADO as M } from "./emparejar/motivos";
import { armarReservas } from "./emparejar/reservas-del-mail";
import { VERSION_INSTRUCCIONES, instruccionesLectura, leerMailConIA } from "./extraer";
import { fechaApareceEnTexto } from "./limpiar-ficha";
import { motivoEnPantalla } from "./reglas";

/**
 * Spec M3-13 filas 3 y 5: el mail de Adventure360 (ejemplo del 15/10, con el pasajero inventado)
 * se lee con la IA FALSA (respuesta grabada) y llega a una reserva de BRARCH26 con la habitación
 * y las elecciones del pasajero. Sin fecha ("TBC") queda para revisión: hay que preguntársela a la
 * agencia. Nunca llama a la API ni a la base.
 */

const AGENCIAS = leerAgencias(readFileSync(join(process.cwd(), "data", "agencias.csv"), "utf-8"));

async function leer(nombre: string) {
  const { cliente } = clienteFalso(respuestaGrabada(nombre));
  const { llamadas } = llamadasFalsas();
  const r = await leerMailConIA(mailDePrueba(nombre), { cliente, registro: registroFalso().registro, mes: "2026-10", agencias: AGENCIAS, llamadas });
  if (r.estado !== "leido") throw new Error(r.motivo);
  return r.ficha;
}

const deps = () => ({ catalogo: catalogoDePrueba(), detalle: detallePorId, proveedorTransferPNT: proveedorPatagoniaPlanet() });

describe("M3-13 fila 3 — la lectura del mail de Adventure360", () => {
  it("las instrucciones (v4) nombran a Adventure360 y dicen dónde van las elecciones del pasajero", () => {
    expect(VERSION_INSTRUCCIONES).toBe("lectura-mail.v4");
    const texto = instruccionesLectura();
    expect(texto).toMatch(/Adventure360/);
    expect(texto).toMatch(/Choice of tour in .*pedidos especiales/i);
    expect(texto).toMatch(/TBC/);
  });

  it("toma la agencia, el tour, la fecha de llegada, la habitación y las elecciones, sin datos dudosos", async () => {
    const f = await leer("adventure360-brarch26");
    expect(f.agencia.valor).toBe("Adventure360");
    expect(f.productos).toHaveLength(1);
    expect(f.productos[0]).toMatchObject({ nombre: "Rio de Janeiro to Santiago", codigo: null, fecha_inicio: "2026-11-10", habitacion: "Hostel Dorm" });
    expect(f.pax.valor).toBe(1);
    expect(f.pasajeros).toHaveLength(1);
    expect(f.pedidos_especiales.map((p) => p.texto)).toEqual(
      expect.arrayContaining(["Choice of tour in Buenos Aires: bike tour", "Choice of tour in Mendoza: rafting"]),
    );
    // "10th November 2026": la fecha con ordinal cuenta como escrita en el mail.
    expect(f.datos_dudosos).toEqual([]);
    expect(f.notas).toEqual([]);
  });

  it("las fechas con ordinal inglés ('10th November 2026', '3rd March 1999') se reconocen como escritas", () => {
    expect(fechaApareceEnTexto("2026-11-10", "Arrival date: 10th November 2026")).toBe(true);
    expect(fechaApareceEnTexto("1999-03-03", "Date of birth: 3rd March 1999")).toBe(true);
    expect(fechaApareceEnTexto("2026-11-01", "Arrival date: 1st Nov 2026")).toBe(true);
    expect(fechaApareceEnTexto("2026-11-10", "Arrival date: 11th November 2026")).toBe(false);
  });
});

describe("M3-13 filas 2, 3 y 5 — la reserva de Adventure360", () => {
  it("con fecha: BRARCH26 por el nombre (sin IA), recibida, con la habitación y las elecciones en los pedidos especiales", async () => {
    const [r, ...otras] = await armarReservas(await leer("adventure360-brarch26"), deps(), { agencia: "Adventure360" });
    expect(otras).toEqual([]);
    expect(r.entrada).toMatchObject({
      agencia: "Adventure360",
      productoId: idDe("BRARCH26"),
      origenEmparejado: "nombre",
      fechaInicio: "2026-11-10",
      habitacion: "Hostel Dorm",
      estado: "recibida",
      motivosRevision: [],
    });
    expect(r.entrada.pedidosEspeciales).toContain("Choice of tour in Buenos Aires: bike tour");
    expect(r.entrada.pedidosEspeciales).toContain("Choice of tour in Mendoza: rafting");
    expect(r.llamadas).toEqual([]);
  });

  it("'Arrival date: TBC' → para revisión: falta la fecha de inicio, preguntársela a la agencia (fila 5)", async () => {
    const f = await leer("adventure360-brarch26-tbc");
    expect(f.productos[0].fecha_inicio).toBeNull();
    const [r] = await armarReservas(f, deps(), { agencia: "Adventure360" });
    expect(r.entrada.productoId).toBe(idDe("BRARCH26"));
    expect(r.entrada.estado).toBe("para_revision");
    expect(r.entrada.motivosRevision).toEqual([M.sinFechaInicio]);
    expect(motivoEnPantalla(M.sinFechaInicio).frase).toBe("Falta la fecha de inicio: preguntársela a la agencia.");
  });
});
