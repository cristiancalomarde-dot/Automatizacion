import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { camposDeEml } from "@/lib/modo-prueba/leer-archivo";
import { clienteFalso, respuestaCon } from "../__fixtures__/cargar";
import { armarReservas } from "../emparejar/reservas-del-mail";
import { leerMailConIA } from "../extraer";
import { catalogoJournawayDePrueba } from "../../../../tests/fixtures/journaway/catalogo";
import { fichaIAJournaway } from "../../../../tests/fixtures/journaway/fichas";
import { leerSenalesJournaway } from "./senales";

/**
 * Spec M2-09 fila 14: los adjuntos de Journaway son pasaportes, no la
 * reserva. No se mandan a la IA: se lee el cuerpo, y el detalle dice "trae
 * adjuntos: pasaportes". Con un .eml armado del mail D más un PDF.
 */

const EML = join(process.cwd(), "tests", "fixtures", "journaway", "d-con-pasaporte.eml");

const registro: RegistroUsoIA = { gastoDelMes: async () => 0, sumar: async () => {} };

describe("fila 14 — el PDF adjunto de Journaway no viaja a la IA", () => {
  it("la llamada lleva solo el cuerpo; el PDF queda anotado como no leído y la reserva lleva el aviso", async () => {
    const mail = await camposDeEml(new Uint8Array(readFileSync(EML)));
    expect(mail.adjuntos?.map((a) => a.nombre)).toEqual(["Pass_Mustermann.pdf"]);

    const ficha = { ...fichaIAJournaway("D"), numero_reserva: { valor: "ID 65600000009", confianza: 1 } };
    const { cliente, create } = clienteFalso(respuestaCon(ficha));
    const lectura = await leerMailConIA(mail, { cliente, registro, mes: "2026-10" });

    expect(create).toHaveBeenCalledTimes(1);
    const contenido = (create.mock.calls[0] as unknown as [{ messages: Array<{ content: Array<{ type: string; text?: string }> }> }])[0].messages[0]
      .content;
    expect(contenido.map((b) => b.type)).toEqual(["text"]);
    expect(contenido[0].text).toContain("Please book the following activities");
    expect(contenido[0].text).toContain("Otros adjuntos (no se te mandan): 1");
    expect(lectura.estado).toBe("leido");
    if (lectura.estado !== "leido") return;
    expect(lectura.ficha.adjuntos_no_leidos).toEqual(["Pass_Mustermann.pdf"]);
    expect(lectura.ficha.numero_reserva.limpio).toBe("65600000009");

    const { catalogo, journaway, detalle } = catalogoJournawayDePrueba();
    const senales = leerSenalesJournaway(readFileSync(join(process.cwd(), "data", "journaway-senales.csv"), "utf-8"));
    const armadas = await armarReservas(lectura, { catalogo, detalle, proveedorTransferPNT: null, journaway: { catalogo: journaway, senales } }, {
      agencia: "Journaway",
      mail,
    });
    expect(armadas).toHaveLength(1);
    expect(armadas[0].entrada.bookingId).toBe("65600000009");
    expect(armadas[0].entrada.notas).toContain("Trae adjuntos: pasaportes (no se leen)");
  });
});
