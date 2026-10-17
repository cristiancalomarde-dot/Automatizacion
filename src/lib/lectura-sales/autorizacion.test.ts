import { describe, expect, it } from "vitest";
import { cronAutorizado } from "./autorizacion";

describe("cronAutorizado (#5)", () => {
  const s = "a".repeat(32);
  it("solo con 'Bearer <CRON_SECRET>' exacto", () => {
    expect(cronAutorizado(`Bearer ${s}`, s)).toBe(true);
    expect(cronAutorizado(`Bearer ${s}x`, s)).toBe(false);
    expect(cronAutorizado(s, s)).toBe(false);
    expect(cronAutorizado(null, s)).toBe(false);
  });
  it("sin secreto en el servidor, nunca", () => {
    expect(cronAutorizado("Bearer ", "")).toBe(false);
    expect(cronAutorizado("Bearer undefined", undefined)).toBe(false);
  });
});
