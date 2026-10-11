// @vitest-environment jsdom
//
// Spec M1-10 §3 #5 — la pantalla real de detalle, con las consultas reales y
// una sesión del equipo, contra el proyecto Supabase real (después de la
// recarga): los motivos de los ajustes y de las marcas se leen en voz de la
// app, sin las notas internas del owner. 5C01, BRARCH26, BOCHI04R, ARCH31 y OD019.
//
// Solo lectura.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const cliente = vi.hoisted(() => ({ actual: null as unknown }));

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => cliente.actual }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/catalogo" }));

import { DetalleProductoPantalla } from "@/components/catalogo/detalle-producto-pantalla";

const CORRE = credencialesSupabaseDisponibles();
const ESPERA = { timeout: 20_000 };

const CASOS: Array<[string, string, string[]]> = [
  ["5C01", "Itinerario día por día", [
    "Hoy no se pide este traslado en el tour.",
    "Llega en bus a Foz y sigue en bus desde Puerto Iguazú.",
    "Llega en bus desde Uyuni: el traslado es desde la terminal de buses.",
    "Solo ida: desde Valparaíso el tour sigue en bus a Calama.",
    "Llega en bus desde Iguazú y sale en bus a Mendoza.",
  ]],
  ["BRARCH26", "Itinerario día por día", ["Hoy no se pide este traslado en el tour.", "Llega en bus a Foz y sigue en bus desde Puerto Iguazú."]],
  ["BOCHI04R", "Itinerario día por día", ["En este tour el traslado es de salida, de San Pedro al aeropuerto de Calama."]],
  ["ARCH31", "Itinerario día por día", ["Llega a Puerto Natales en bus desde El Calafate.", "Llega en bus desde El Chaltén."]],
  ["OD019", "Servicios", ["Solo si el paquete se vende con traslados (el pasajero llega en avión)."]],
];

(CORRE ? describe : describe.skip)("recorrido de los motivos visibles (spec M1-10, V3)", () => {
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

  for (const [codigo, tabla, motivos] of CASOS) {
    it(`${codigo}: muestra los motivos en voz de la app y ninguna nota interna`, async () => {
      const { data } = await conSesion.from("producto").select("id").eq("codigo", codigo).single();
      render(<DetalleProductoPantalla id={data!.id} />);
      await screen.findByRole("table", { name: tabla }, ESPERA);
      const visible = document.body.textContent ?? "";
      for (const m of motivos) expect(visible, m).toContain(m);
      expect(visible).not.toContain("Owner");
      expect(visible).not.toContain("M2");
      expect(visible).not.toContain("(2026-");
      expect(visible).not.toContain("excepción del owner");
    }, 60_000);
  }
});
