// @vitest-environment jsdom
//
// Spec M1-07 — verificación 3: el recorrido del owner por la pantalla real de
// detalle, con las consultas reales y una sesión del equipo, contra el
// proyecto Supabase real (después de la recarga). Abre 5C01, ARCH33, CH10 y
// BRARCH26 y mira lo que el owner marcó en el "probalo vos".
//
// Solo lectura.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const cliente = vi.hoisted(() => ({ actual: null as unknown }));

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => cliente.actual }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/catalogo" }));

import { DetalleProductoPantalla } from "@/components/catalogo/detalle-producto-pantalla";

const CORRE = credencialesSupabaseDisponibles();
const ESPERA = { timeout: 20_000 };

function filaCon(tabla: HTMLElement, texto: string): HTMLTableRowElement | undefined {
  return within(tabla)
    .getAllByRole("row")
    .find((f) => f.textContent?.includes(texto)) as HTMLTableRowElement | undefined;
}

(CORRE ? describe : describe.skip)("recorrido del probalo vos de M1 (spec M1-07, V3)", () => {
  let conSesion: SupabaseClient;
  let borrar: () => Promise<void>;

  async function abrir(codigo: string) {
    const { data } = await conSesion.from("producto").select("id").eq("codigo", codigo).single();
    render(<DetalleProductoPantalla id={data!.id} />);
  }

  beforeAll(async () => {
    ({ cliente: conSesion, borrar } = await crearSesionDePrueba());
    cliente.actual = conSesion;
  }, 30_000);

  afterAll(async () => {
    await borrar?.();
  });

  it("5C01: CHB31 desplegado (OD030 desde el día 22, COMPBO20, bus Uyuni – La Paz) y Calama – San Pedro por Kupos.cl", async () => {
    await abrir("5C01");
    const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(within(itinerario).getByRole("link", { name: "CHB31" })).toBeInTheDocument();
    expect(filaCon(itinerario, "OD030")?.cells[0].textContent).toBe("Día 22");
    expect(filaCon(itinerario, "COMPBO20")?.cells[0].textContent).toBe("Día 25");
    expect(filaCon(itinerario, "Uyuni – La Paz")?.cells[0].textContent).toBe("Día 27");
    const calama = filaCon(itinerario, "Calama – San Pedro")!;
    expect(calama.textContent).toContain("Kupos.cl");
    expect(calama.textContent).toContain("Se reserva a mano en Kupos.cl");
    // Transvip queda solo como el traslado desde el aeropuerto de Calama (servicio de OD030).
    expect(calama.textContent).not.toMatch(/transvip/i);
  }, 40_000);

  it("ARCH33: CH10 en tres partes (días 6, 7 y 11) y al final la salida de Puerto Natales", async () => {
    await abrir("ARCH33");
    const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    const filas = within(itinerario).getAllByRole("row") as HTMLTableRowElement[];
    const dias = (texto: string) => filas.filter((f) => f.cells[1]?.textContent === texto).map((f) => f.cells[0].textContent);
    expect(dias("1 noche en Puerto Natales")).toEqual(["Día 6", "Día 11"]);
    expect(dias("W Trek Standard, 4 noches en refugios (Las Torres)")).toEqual(["Día 7"]);
    const ultima = filas.at(-1)!;
    expect(ultima.cells[0].textContent).toBe("Día 12");
    expect(ultima.textContent).toMatch(/Puerto Natales – Punta Arenas.*Patagonia Planet/);
    expect(ultima.textContent).toContain("Kupos.cl");
  }, 40_000);

  it("CH10 solo: día por día en tres partes y ningún bus o traslado de salida", async () => {
    await abrir("CH10");
    const tabla = await screen.findByRole("table", { name: "Día por día" }, ESPERA);
    for (const texto of [
      "Día 1 · 1 noche en Puerto Natales",
      "Día 2 · W Trek Standard, 4 noches en refugios (Las Torres)",
      "Día 6 · 1 noche en Puerto Natales",
    ]) {
      expect(within(tabla).getByText(texto)).toBeInTheDocument();
    }
    expect(document.body.textContent).not.toMatch(/Punta Arenas|Kupos|Traslado|Bus /);
  }, 40_000);

  it("BRARCH26: Santiago (OD029) sin transfer de salida; Río (OD032) con el de llegada", async () => {
    await abrir("BRARCH26");
    const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(filaCon(itinerario, "OD029")!.textContent).not.toMatch(/Transfer de (salida|llegada)/);
    expect(filaCon(itinerario, "OD032")!.textContent).toContain("Transfer de llegada");
    expect(within(itinerario).queryAllByText("Transfer de salida").length).toBe(
      // Solo Iguazú (OD010A) conserva los suyos en el medio.
      within(filaCon(itinerario, "OD010A")!).queryAllByText("Transfer de salida").length,
    );
  }, 40_000);
});
