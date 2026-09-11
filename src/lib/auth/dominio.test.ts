import { describe, expect, it } from "vitest";
import {
  esCorreoDelDominioPermitido,
  normalizarDominio,
  obtenerDominioPermitido,
} from "./dominio";

describe("normalizarDominio", () => {
  it("pasa a minúsculas, saca espacios y un @ inicial", () => {
    expect(normalizarDominio(" @HiTravel.com.ar ")).toBe("hitravel.com.ar");
    expect(normalizarDominio("hitravel.com.ar")).toBe("hitravel.com.ar");
  });
});

describe("esCorreoDelDominioPermitido", () => {
  it("acepta un mail del dominio permitido", () => {
    expect(esCorreoDelDominioPermitido("ana@hitravel.com.ar", "hitravel.com.ar")).toBe(true);
  });

  it("es insensible a mayúsculas/minúsculas en el dominio", () => {
    expect(esCorreoDelDominioPermitido("Ana@HiTravel.com.ar", "hitravel.com.ar")).toBe(true);
  });

  it("rechaza un mail de otro dominio (caso NO debe pasar, spec #4)", () => {
    expect(esCorreoDelDominioPermitido("ana@gmail.com", "hitravel.com.ar")).toBe(false);
  });

  it("rechaza null, undefined y string vacío", () => {
    expect(esCorreoDelDominioPermitido(null, "hitravel.com.ar")).toBe(false);
    expect(esCorreoDelDominioPermitido(undefined, "hitravel.com.ar")).toBe(false);
    expect(esCorreoDelDominioPermitido("", "hitravel.com.ar")).toBe(false);
  });

  it("rechaza un mail mal formado (sin @, o con más de uno)", () => {
    expect(esCorreoDelDominioPermitido("ana-arroba-hitravel.com.ar", "hitravel.com.ar")).toBe(false);
    expect(esCorreoDelDominioPermitido("ana@sub@hitravel.com.ar", "hitravel.com.ar")).toBe(false);
  });
});

describe("obtenerDominioPermitido", () => {
  const original = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN;

  it("lee y normaliza la variable de entorno", () => {
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN = "@HiTravel.com.ar";
    expect(obtenerDominioPermitido()).toBe("hitravel.com.ar");
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN = original;
  });

  it("explota con un mensaje claro si falta configurar la variable", () => {
    delete process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN;
    expect(() => obtenerDominioPermitido()).toThrow(/NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN/);
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN = original;
  });
});
