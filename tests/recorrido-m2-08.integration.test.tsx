// @vitest-environment jsdom
//
// Spec M2-08 §4 — verificación 3: las pantallas reales del catálogo, con las
// consultas reales y una sesión del equipo, contra la base de pruebas (después
// de `importar:journaway`). El recorrido del owner: buscar «journaway» → 53
// productos; abrir SPAP05 → sus 7 partes, el Overland con los Tayka y el bus a
// La Paz, todo a Imperio Inca; abrir IGRP02 → falta el proveedor.
//
// Solo lectura.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const cliente = vi.hoisted(() => ({ actual: null as unknown }));

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => cliente.actual }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/catalogo" }));

import { CatalogoPantalla } from "@/components/catalogo/catalogo-pantalla";
import { DetalleProductoPantalla } from "@/components/catalogo/detalle-producto-pantalla";

const CORRE = credencialesSupabaseDisponibles();
const ESPERA = { timeout: 30_000 };

(CORRE ? describe : describe.skip)("recorrido del catálogo de Journaway (spec M2-08, V3)", () => {
  let conSesion: SupabaseClient;
  let borrar: () => Promise<void>;

  beforeAll(async () => {
    ({ cliente: conSesion, borrar } = await crearSesionDePrueba());
    cliente.actual = conSesion;
  }, 30_000);

  afterEach(() => cleanup());

  afterAll(async () => {
    await borrar?.();
  });

  async function abrir(codigo: string) {
    const { data } = await conSesion.from("producto").select("id").eq("codigo", codigo).single();
    render(<DetalleProductoPantalla id={data!.id} />);
  }

  it("1. «journaway» en el buscador deja sus 53 productos, con el chip y sin sus nombres debajo del código", async () => {
    render(<CatalogoPantalla />);
    const buscador = await screen.findByLabelText("Buscar por código o nombre", {}, ESPERA);
    fireEvent.change(buscador, { target: { value: "journaway" } });
    const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(53);
    for (const f of filas) expect(within(f).getByText("Journaway")).toBeInTheDocument();
    const spae03 = filas.find((f) => within(f).queryByText("SPAE03"))!;
    expect(spae03.textContent).not.toContain("tour through the moon valley");
    expect(spae03.textContent).not.toContain("Journaway tour");
  }, 60_000);

  it("2. SPAP05: el shuttle de llegada, los 4 tours, el traslado a Hito Cajón y el Overland con los Tayka y el bus, todo a Imperio Inca", async () => {
    await abrir("SPAP05");
    const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
    const texto = itinerario.textContent ?? "";
    for (const parte of ["SPAT01", "SPAE01", "SPAE03", "SPAE05", "SPAE04", "SPAT02", "UYUO01"]) expect(texto, parte).toContain(parte);
    expect(texto).toContain("Solo llegada");
    for (const s of ["Tayka del Desierto", "Tayka de Sal", "Bus nocturno Uyuni – La Paz", "Overland privado San Pedro – Uyuni"]) expect(texto, s).toContain(s);
    expect(texto).toContain("Imperio Inca");
    expect(texto).not.toContain("COMPBO20");
    expect(document.body.textContent).toContain("Tour compuesto");
    // de dónde sale cada cosa: la planilla de Journaway (no el Excel de paquetes) y el Overland armado con el tarifario
    expect(texto).toContain("Planilla de productos de Journaway, fila 10");
    expect(texto).toContain("Datos de Journaway: producto interno, armado con el tarifario");
    expect(texto).not.toContain("Excel de paquetes");
    expect(texto).not.toContain("tramos de los tours");
  }, 60_000);

  it("3. IGRP02 se ve pendiente: falta el proveedor", async () => {
    await abrir("IGRP02");
    expect((await screen.findAllByText(/Cuenca del Plata, mail general/, {}, ESPERA)).length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/no está en el directorio/);
  }, 60_000);
});
