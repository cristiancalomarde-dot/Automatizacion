// @vitest-environment jsdom
//
// Spec M1-09 — verificación 3: el recorrido por la pantalla real de detalle,
// con las consultas reales y una sesión del equipo, contra el proyecto
// Supabase real (después de la recarga). ARCH31, ARCH33, OD016, OD017 y 5C01.
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

/** La fila de encabezado del paquete dentro del itinerario (la que lleva sus etiquetas de transfer). */
function encabezado(tabla: HTMLElement, codigo: string): HTMLTableRowElement {
  const fila = filas(tabla).find((f) => within(f).queryByRole("link", { name: codigo }) !== null);
  expect(fila, codigo).toBeDefined();
  return fila!;
}

/** Las filas de servicio que siguen al encabezado del paquete (hasta el próximo paquete o tramo). */
function textoDe(tabla: HTMLElement, codigo: string): string {
  const todas = filas(tabla);
  const inicio = todas.indexOf(encabezado(tabla, codigo));
  const resto = todas.slice(inicio + 1);
  const fin = resto.findIndex(
    (f) =>
      within(f)
        .queryAllByRole("link")
        .some((l) => /^[A-Z0-9]{4,}$/.test(l.textContent ?? "") && l.getAttribute("href")?.startsWith("/catalogo/")) ||
      /Tramo externo/.test(f.textContent ?? ""),
  );
  return (fin === -1 ? resto : resto.slice(0, fin)).map((f) => f.textContent ?? "").join(" | ");
}

(CORRE ? describe : describe.skip)("recorrido de los ajustes finales de traslados (spec M1-09, V3)", () => {
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

  it("ARCH31: OD017 sin 'Transfer de salida' (sale con el bus del tour); OD016 y OD017 sin sus traslados de llegada; OD033 con la llegada", async () => {
    await abrir("ARCH31");
    const t = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(encabezado(t, "OD017").textContent).not.toContain("Transfer de salida");
    expect(encabezado(t, "OD017").textContent).not.toContain("Transfer de llegada");
    expect(encabezado(t, "OD033").textContent).toContain("Transfer de llegada");
    expect(textoDe(t, "OD016")).toMatch(/FTE Airport - El Calafate Accommodation.*No se pide en este tour/);
    expect(textoDe(t, "OD017")).toMatch(/PNT Airport - PNT accommodation.*No se pide en este tour/);
    expect(textoDe(t, "OD017")).toMatch(/Punta Arenas - Puerto Natales.*No se pide en este tour/);
    const ultima = filas(t).at(-1)!;
    expect(ultima.textContent).toMatch(/Puerto Natales – Punta Arenas.*Patagonia Planet/);
    expect(t.textContent).not.toContain("Transfer de salida");
  }, 60_000);

  it("ARCH33: CH10 sin 'Transfer de salida'; OD016 sin su llegada", async () => {
    await abrir("ARCH33");
    const t = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(encabezado(t, "CH10").textContent).not.toContain("Transfer de salida");
    expect(t.textContent).not.toContain("Transfer de salida");
    expect(encabezado(t, "OD033").textContent).toContain("Transfer de llegada");
    expect(textoDe(t, "OD016")).toMatch(/FTE Airport - El Calafate Accommodation.*No se pide en este tour/);
  }, 60_000);

  it("OD016 solo: el traslado de llegada, sin marca a pedido", async () => {
    await abrir("OD016");
    const tabla = await screen.findByRole("table", { name: "Servicios" }, ESPERA);
    const llegada = filas(tabla).find((f) => f.textContent?.includes("FTE Airport - El Calafate Accommodation"))!;
    expect(llegada).toBeDefined();
    expect(llegada.textContent).not.toContain("A pedido");
    expect(tabla.textContent).not.toContain("El Calafate Accommodation - FTE Airport");
  }, 60_000);

  it("OD017 solo: el traslado de llegada desde el aeropuerto PNT, con la marca a pedido", async () => {
    await abrir("OD017");
    const tabla = await screen.findByRole("table", { name: "Servicios" }, ESPERA);
    const llegada = filas(tabla).find((f) => f.textContent?.includes("PNT Airport - PNT accommodation"))!;
    expect(llegada).toBeDefined();
    expect(llegada.textContent).toContain("A pedido");
    expect(llegada.textContent).toMatch(/patagonia planet/i);
    expect(document.body.textContent).not.toContain("No se pide en este tour");
  }, 60_000);

  it("5C01 sigue igual en lo demás: Iguazú con sus dos marcas, OD031 con la llegada desde la terminal y el resto de M1-08", async () => {
    await abrir("5C01");
    const t = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    expect(encabezado(t, "OD032").textContent).toContain("Transfer de llegada");
    expect(encabezado(t, "OD010D").textContent).toMatch(/Transfer de llegada.*Transfer de salida/);
    expect(encabezado(t, "OD031").textContent).toContain("Transfer de llegada");
    // OD030 llega en bus desde Valparaíso: su traslado no se pide y no lleva la etiqueta
    expect(encabezado(t, "OD030").textContent).not.toContain("Transfer de llegada");
    expect(textoDe(t, "OD020")).toMatch(/EZE o AEP - Hotel - EZE o AEP.*No se pide en este tour/);
    expect(textoDe(t, "OD010D")).toMatch(/Rodoviaria de Foz.*Cambiado en este tour/);
    expect(textoDe(t, "COMPCH01")).toMatch(/Santiago - Valparaiso - Santiago.*Solo llegada/);
    expect(textoDe(t, "OD031")).toMatch(/terminal de buses de La Paz.*Cambiado en este tour/);
  }, 60_000);
});
