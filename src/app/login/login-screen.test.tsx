// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { signInWithOAuth, useSearchParamsMock } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  useSearchParamsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth } }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: useSearchParamsMock,
}));

import { LoginScreen } from "./login-screen";

function paramsCon(valor: string | null) {
  return { get: (clave: string) => (clave === "error" ? valor : null) };
}

describe("LoginScreen (spec M1-01 §3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchParamsMock.mockReturnValue(paramsCon(null));
  });

  it("sin error en la URL: no muestra ningún mensaje", () => {
    render(<LoginScreen />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["dominio", "Esta cuenta no pertenece a HI Travel."],
    ["auth", "No pudimos ingresar. Probá de nuevo."],
    ["sesion_vencida", "Tu sesión venció. Volvé a ingresar."],
  ])("error=%s muestra el mensaje fijo correspondiente", (codigo, textoEsperado) => {
    useSearchParamsMock.mockReturnValue(paramsCon(codigo));
    render(<LoginScreen />);
    expect(screen.getByRole("alert")).toHaveTextContent(textoEsperado);
  });

  it('al tocar el botón: se deshabilita y muestra "Ingresando…" (estado de carga)', async () => {
    signInWithOAuth.mockImplementation(() => new Promise(() => {}));
    render(<LoginScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Ingresar con Google" }));

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("Ingresando…"));
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("si falla el pedido de login: muestra el error genérico y reactiva el botón", async () => {
    signInWithOAuth.mockResolvedValue({ error: new Error("boom") });
    render(<LoginScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Ingresar con Google" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("No pudimos ingresar. Probá de nuevo."),
    );
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});
