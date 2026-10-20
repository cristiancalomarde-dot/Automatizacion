// @vitest-environment jsdom
//
// Spec M3-06 fila 1 (y §4): "Mi nombre para la firma". Propone el nombre de
// Google si no hay uno guardado, muestra lo guardado al volver a entrar, y
// tiene los estados "Guardando…", "Listo" y "No se pudo guardar" con
// "Reintentar". Vacío vuelve al nombre de Google.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const acciones = vi.hoisted(() => ({ guardarMiNombreParaLaFirma: vi.fn() }));
vi.mock("@/app/(app)/mi-firma/acciones", () => acciones);

import { TEXTOS } from "@/lib/textos";
import { MiFirmaPantalla } from "./mi-firma-pantalla";

const T = TEXTOS.miFirma;

beforeEach(() => vi.clearAllMocks());

const campo = () => screen.getByRole("textbox", { name: T.campo }) as HTMLInputElement;

describe("Mi nombre para la firma (M3-06 fila 1)", () => {
  it("sin nombre guardado, propone el de Google", () => {
    render(<MiFirmaPantalla nombreGoogle="Damián Pérez" guardado={null} />);
    expect(screen.getByRole("heading", { name: T.titulo })).toBeInTheDocument();
    expect(campo().value).toBe("Damián Pérez");
    expect(screen.getByText(T.vistaPrevia("Damián Pérez"))).toBeInTheDocument();
  });

  it("con nombre guardado (volver a entrar), muestra lo guardado", () => {
    render(<MiFirmaPantalla nombreGoogle="Damián Pérez" guardado="Damián · Operaciones" />);
    expect(campo().value).toBe("Damián · Operaciones");
    expect(screen.getByText(T.vistaPrevia("Damián · Operaciones"))).toBeInTheDocument();
  });

  it("guardar: 'Guardando…' y después 'Listo'", async () => {
    let terminar: (v: unknown) => void = () => {};
    acciones.guardarMiNombreParaLaFirma.mockReturnValue(new Promise((r) => (terminar = r)));
    render(<MiFirmaPantalla nombreGoogle="Damián Pérez" guardado={null} />);
    fireEvent.change(campo(), { target: { value: "Damián · Operaciones" } });
    fireEvent.click(screen.getByRole("button", { name: T.guardar }));
    expect(acciones.guardarMiNombreParaLaFirma).toHaveBeenCalledWith("Damián · Operaciones");
    expect(screen.getByRole("button", { name: T.guardando })).toBeDisabled();

    terminar({ ok: true, nombreFirma: "Damián · Operaciones", firmaComo: "Damián · Operaciones" });
    expect(await screen.findByText(T.listo)).toBeInTheDocument();
    expect(screen.getByText(T.vistaPrevia("Damián · Operaciones"))).toBeInTheDocument();
  });

  it("vacío vuelve al nombre de Google", async () => {
    acciones.guardarMiNombreParaLaFirma.mockResolvedValue({ ok: true, nombreFirma: null, firmaComo: "Damián Pérez" });
    render(<MiFirmaPantalla nombreGoogle="Damián Pérez" guardado="Damián · Operaciones" />);
    fireEvent.change(campo(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: T.guardar }));
    expect(await screen.findByText(T.listo)).toBeInTheDocument();
    expect(campo().value).toBe("Damián Pérez");
    expect(screen.getByText(T.vistaPrevia("Damián Pérez"))).toBeInTheDocument();
  });

  it("si falla: 'No se pudo guardar: <motivo>' con 'Reintentar', y lo escrito sigue ahí", async () => {
    acciones.guardarMiNombreParaLaFirma.mockResolvedValueOnce({ ok: false, error: T.error(T.motivos.conexion) });
    acciones.guardarMiNombreParaLaFirma.mockResolvedValueOnce({ ok: true, nombreFirma: "Damián P.", firmaComo: "Damián P." });
    render(<MiFirmaPantalla nombreGoogle="Damián Pérez" guardado={null} />);
    fireEvent.change(campo(), { target: { value: "Damián P." } });
    fireEvent.click(screen.getByRole("button", { name: T.guardar }));
    expect(await screen.findByText(T.error(T.motivos.conexion))).toBeInTheDocument();
    expect(campo().value).toBe("Damián P.");
    fireEvent.click(screen.getByRole("button", { name: T.reintentar }));
    expect(await screen.findByText(T.listo)).toBeInTheDocument();
    expect(acciones.guardarMiNombreParaLaFirma).toHaveBeenNthCalledWith(2, "Damián P.");
  });
});
