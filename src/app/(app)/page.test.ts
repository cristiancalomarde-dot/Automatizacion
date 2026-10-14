import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

import InicioPage from "./page";

describe("inicio (spec M2-05 #1)", () => {
  it("/ lleva a la lista de reservas", () => {
    InicioPage();
    expect(redirect).toHaveBeenCalledWith("/reservas");
  });
});
