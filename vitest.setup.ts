import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// `server-only` usa la condición de export "react-server" que arma Next.js al
// bundlear Server Components; fuera de ese build (acá, en Vitest) siempre
// tira su error de guarda. Se neutraliza en los tests — lo que importa acá es
// la lógica, no la guarda de bundling.
vi.mock("server-only", () => ({}));

// Sin `globals: true` en vitest.config.ts, la limpieza automática de
// Testing Library entre tests no se engancha sola — se registra a mano.
afterEach(() => {
  cleanup();
});
