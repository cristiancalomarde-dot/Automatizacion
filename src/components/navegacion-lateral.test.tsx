// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathname = vi.hoisted(() => ({ actual: "/catalogo/abc" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.actual }));

import { NavegacionLateral } from "./navegacion-lateral";

describe("Barra lateral (user-flow.md §2, spec M1-06 §4)", () => {
  it("lleva a Catálogo, Proveedores y Pendientes, y marca la sección actual", () => {
    render(<NavegacionLateral />);
    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/catalogo");
    expect(screen.getByRole("link", { name: "Proveedores" })).toHaveAttribute("href", "/proveedores");
    expect(screen.getByRole("link", { name: "Pendientes" })).toHaveAttribute("href", "/pendientes");
    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Proveedores" })).not.toHaveAttribute("aria-current");
  });
});
