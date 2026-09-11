// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { signOut, replace, refresh } = vi.hoisted(() => ({
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

import { Header } from "./header";

describe("Header (spec M1-01 #8)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra el nombre del usuario logueado", () => {
    render(<Header nombreVisible="ana@hitravel.com.ar" />);
    expect(screen.getByText("ana@hitravel.com.ar")).toBeInTheDocument();
  });

  it('"Salir" termina la sesión y vuelve a Login', async () => {
    signOut.mockResolvedValue({ error: null });
    render(<Header nombreVisible="ana@hitravel.com.ar" />);

    fireEvent.click(screen.getByRole("button", { name: "Salir" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith("/login");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
