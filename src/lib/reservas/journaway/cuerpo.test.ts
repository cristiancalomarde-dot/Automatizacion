import { describe, expect, it } from "vitest";
import { textoJournaway } from "../../../../tests/fixtures/journaway/fichas";
import { leerCuerpoJournaway } from "./cuerpo";

/** Spec M2-09 filas 9, 12, 13 y 14: lo que el código lee del cuerpo, sin IA. */

describe("fila 12 — el número de viaje", () => {
  it("el mail C trae Trip Number 62992; A, B y D no traen", () => {
    expect(leerCuerpoJournaway(textoJournaway("C")).tripNumber).toBe("62992");
    for (const l of ["A", "B", "D"] as const) expect(leerCuerpoJournaway(textoJournaway(l)).tripNumber).toBeNull();
  });
});

describe("fila 13 — 'Client reference' no se confunde con nosotros", () => {
  it("mail A: la dirección de HI Travel se ignora y el contacto queda vacío", () => {
    expect(leerCuerpoJournaway(textoJournaway("A")).contacto).toBeNull();
  });

  it("mail B: nombre, mail y teléfono del cliente", () => {
    expect(leerCuerpoJournaway(textoJournaway("B")).contacto).toEqual({
      nombre: "Klara Katharina Ejemplo",
      email: "klara.ejemplo@example.de",
      telefono: "+49 170 0000001",
    });
  });

  it("mail C: el tratamiento pegado al nombre ('Mrs. Ines Probe') se saca", () => {
    expect(leerCuerpoJournaway(textoJournaway("C")).contacto).toEqual({
      nombre: "Ines Probe",
      email: "ines.probe@example.de",
      telefono: "+49 150 0000002",
    });
  });

  it("mail D: contacto del cliente, sin mezclar la firma de Journaway", () => {
    expect(leerCuerpoJournaway(textoJournaway("D")).contacto).toEqual({
      nombre: "Karl Mustermann",
      email: "karl.mustermann@example.de",
      telefono: "+49 151 0000003",
    });
  });
});

describe("fila 9 — pasajeros en alemán", () => {
  it("Anrede mr/mrs → Sr./Sra., con o sin las líneas 'Reisender'", () => {
    expect(leerCuerpoJournaway(textoJournaway("A")).tratamientos).toEqual([
      { nombre: "Klara Katharina", apellido: "Ejemplo", tratamiento: "Sra." },
      { nombre: "Lenn", apellido: "Ejemplo", tratamiento: "Sr." },
    ]);
    expect(leerCuerpoJournaway(textoJournaway("D")).tratamientos).toEqual([
      { nombre: "Karl", apellido: "Mustermann", tratamiento: "Sr." },
      { nombre: "Erika", apellido: "Beispiel", tratamiento: "Sra." },
    ]);
  });
});

describe("fila 14 — los adjuntos de Journaway son pasaportes", () => {
  it("el mail D avisa que trae pasaportes; el A no", () => {
    expect(leerCuerpoJournaway(textoJournaway("D")).pasaportes).toBe(true);
    expect(leerCuerpoJournaway(textoJournaway("A")).pasaportes).toBe(false);
  });
});
