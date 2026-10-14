// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathname = vi.hoisted(() => ({ actual: "/catalogo/abc" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.actual }));

import { NavegacionLateral } from "./navegacion-lateral";

describe("Barra lateral (user-flow.md §2, spec M1-06 §4 y M2-05 #1)", () => {
  it("lleva a Reservas, Catálogo, Proveedores y Pendientes, en ese orden, y marca la sección actual", () => {
    pathname.actual = "/catalogo/abc";
    render(<NavegacionLateral />);
    const enlaces = screen.getAllByRole("link");
    expect(enlaces.map((e) => e.textContent)).toEqual(["Reservas", "Catálogo", "Proveedores", "Pendientes"]);
    expect(screen.getByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/reservas");
    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/catalogo");
    expect(screen.getByRole("link", { name: "Proveedores" })).toHaveAttribute("href", "/proveedores");
    expect(screen.getByRole("link", { name: "Pendientes" })).toHaveAttribute("href", "/pendientes");
    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Proveedores" })).not.toHaveAttribute("aria-current");
  });

  it.each(["/reservas", "/reservas/6f1c2b4e-2d3a-4b5c-9d8e-0a1b2c3d4e5f"])("en %s, Reservas queda marcada", (ruta) => {
    pathname.actual = ruta;
    render(<NavegacionLateral />);
    expect(screen.getAllByRole("link", { name: "Reservas" }).at(-1)).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: "Catálogo" }).at(-1)).not.toHaveAttribute("aria-current");
  });
});
