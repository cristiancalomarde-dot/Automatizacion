// @vitest-environment jsdom
//
// Spec M1-08 — verificación 3: el recorrido del owner por la pantalla real de
// detalle, con las consultas reales y una sesión del equipo, contra el
// proyecto Supabase real (después de la recarga). Abre 5C01, AR09, ARCH31,
// BOCHI04R y BRARCH26 y mira los traslados de cada paquete en el tour; abre
// OD020 y OD016 solos.
//
// Solo lectura.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const cliente = vi.hoisted(() => ({ actual: null as unknown }));

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => cliente.actual }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/catalogo" }));

import { DetalleProductoPantalla } from "@/components/catalogo/detalle-producto-pantalla";

const CORRE = credencialesSupabaseDisponibles();
const ESPERA = { timeout: 20_000 };

function filas(tabla: HTMLElement): HTMLTableRowElement[] {
  return within(tabla).getAllByRole("row") as HTMLTableRowElement[];
}

/** Las filas de servicio que siguen al encabezado del paquete (hasta el próximo paquete o tramo). */
function filasDelPaquete(tabla: HTMLElement, codigo: string): HTMLTableRowElement[] {
  const todas = filas(tabla);
  const inicio = todas.findIndex((f) => within(f).queryByRole("link", { name: codigo }) !== null);
  expect(inicio, codigo).toBeGreaterThanOrEqual(0);
  const resto = todas.slice(inicio + 1);
  const fin = resto.findIndex((f) => within(f).queryAllByRole("link").some((l) => /^[A-Z0-9]{4,}$/.test(l.textContent ?? "") && l.getAttribute("href")?.startsWith("/catalogo/")) || /Tramo externo/.test(f.textContent ?? ""));
  return fin === -1 ? resto : resto.slice(0, fin);
}

function textoDe(tabla: HTMLElement, codigo: string): string {
  return filasDelPaquete(tabla, codigo).map((f) => f.textContent ?? "").join(" | ");
}

(CORRE ? describe : describe.skip)("recorrido de los traslados según el tour (spec M1-08, V3)", () => {
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

  afterEach(() => cleanup());

  afterAll(async () => {
    await borrar?.();
  });

  it("5C01: OD020 sin Greeters, OD019 sin Remis, OD029 sin CL Mundo, 105 Premium desde la Rodoviaria, COMPCH01 solo ida y OD031 desde la terminal", async () => {
    await abrir("5C01");
    const t = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(textoDe(t, "OD020")).toMatch(/EZE o AEP - Hotel - EZE o AEP.*No se pide en este tour/);
    expect(textoDe(t, "OD019")).toMatch(/Remis Mendoza.*No se pide en este tour/);
    expect(textoDe(t, "OD029")).toMatch(/SCL - accommodation.*No se pide en este tour/);
    expect(textoDe(t, "OD010D")).toMatch(/Rodoviaria de Foz.*terminal de buses de Puerto Iguazú.*Cambiado en este tour/);
    expect(textoDe(t, "OD010D")).toMatch(/2 noches en Foz do Iguaçu/);
    expect(textoDe(t, "COMPCH01")).toMatch(/Santiago - Valparaiso - Santiago.*Solo llegada/);
    expect(textoDe(t, "OD031")).toMatch(/terminal de buses de La Paz.*Cambiado en este tour/);
    expect(textoDe(t, "OD031")).toContain("En el Excel: Transfer La Paz Airport");
    // el primer paquete conserva su llegada
    expect(textoDe(t, "OD032")).not.toContain("No se pide en este tour");
  }, 60_000);

  it("AR09: OD018 con Greeters solo de llegada, OD025 y OD013 sin traslados, OD022 solo de salida", async () => {
    await abrir("AR09");
    const t = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(textoDe(t, "OD018")).toMatch(/Greeters.*Solo llegada|Solo llegada.*GREETERS/i);
    expect(textoDe(t, "OD025")).toContain("No se pide en este tour");
    expect(textoDe(t, "OD013")).toMatch(/Round Trip.*No se pide en este tour/);
    expect(textoDe(t, "OD022")).toContain("Solo salida");
  }, 60_000);

  it("ARCH31: OD016 sin traslado, OD017 sin el bus de Punta Arenas y al final la salida de Puerto Natales con las dos alternativas", async () => {
    await abrir("ARCH31");
    const t = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(textoDe(t, "OD016")).toMatch(/FTE Airport.*No se pide en este tour/);
    expect(textoDe(t, "OD017")).toMatch(/Punta Arenas - Puerto Natales.*No se pide en este tour/);
    const ultima = filas(t).at(-1)!;
    expect(ultima.cells[0].textContent).toBe("Día 9");
    expect(ultima.textContent).toMatch(/Puerto Natales – Punta Arenas.*Patagonia Planet/);
    expect(ultima.textContent).toContain("Kupos.cl");
  }, 60_000);

  it("BOCHI04R: el Transvip de OD030 pasa a ser de salida (San Pedro → CJC)", async () => {
    await abrir("BOCHI04R");
    const t = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(textoDe(t, "OD030")).toMatch(/San Pedro de Atacama - aeropuerto de Calama \(CJC\).*Sentido invertido/);
  }, 60_000);

  it("BRARCH26: sin Greeters ni Remis en el medio, OD029 sin CL Mundo y el 105 Premium de OD010A desde la Rodoviaria", async () => {
    await abrir("BRARCH26");
    const t = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(textoDe(t, "OD018")).toContain("No se pide en este tour");
    expect(textoDe(t, "OD019")).toContain("No se pide en este tour");
    expect(textoDe(t, "OD029")).toContain("No se pide en este tour");
    expect(textoDe(t, "OD010A")).toMatch(/Rodoviaria de Foz.*Cambiado en este tour/);
    expect(textoDe(t, "OD032")).not.toContain("No se pide en este tour");
  }, 60_000);

  it("el paquete solo sigue con todos sus servicios: OD020 con Greeters; OD017 con la llegada a pedido (M1-09)", async () => {
    await abrir("OD020");
    const servicios = await screen.findByRole("table", { name: "Servicios" }, ESPERA);
    expect(servicios.textContent).toContain("EZE o AEP - Hotel - EZE o AEP");
    expect(document.body.textContent).not.toContain("No se pide en este tour");
    cleanup();
    await abrir("OD017");
    const od017 = await screen.findByRole("table", { name: "Servicios" }, ESPERA);
    const llegada = filas(od017).find((f) => f.textContent?.includes("PNT Airport"))!;
    expect(llegada.textContent).toContain("A pedido");
  }, 60_000);
});
