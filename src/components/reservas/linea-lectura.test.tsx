// @vitest-environment jsdom
//
// Spec M2-07 #20 y §4: la línea de la última lectura de sales@ arriba de la
// lista de reservas, en cada estado. Solo números y texto.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const consultas = vi.hoisted(() => ({ cargarReservas: vi.fn(), cargarRevisiones: vi.fn() }));
vi.mock("@/lib/reservas/consultas", () => consultas);
// M3-08: la lista llega del servidor (server action); acá, de la consulta reemplazada. "Hoy" antes de los viajes de los fixtures: ninguno terminó.
vi.mock("@/app/(app)/reservas/acciones-lista", () => ({
  cargarLaListaDeReservas: async () => ({ filas: await consultas.cargarReservas({}), esAdmin: false, hoy: "2026-01-01", agencias: [] }),
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams(""),
}));

import { listaReservas } from "@/lib/reservas/fixtures.test-utils";
import { lineaDeLectura, type CorridaParaLinea } from "@/lib/lectura-sales/estado";
import { ListaReservasPantalla } from "./lista-reservas-pantalla";
import { LineaLecturaSales } from "./linea-lectura";

const ahora = new Date("2026-10-16T18:00:00Z");
const corrida = (extra: Partial<CorridaParaLinea> = {}): CorridaParaLinea => ({
  estado: "anduvo_bien",
  inicio: "2026-10-16T15:14:00Z",
  miro: 41,
  de_agencias: 4,
  reservas_nuevas: 3,
  reservas_actualizadas: 1,
  avisos: [],
  errores: [],
  ...extra,
});
const base = { activa: true, ahora, noSePudoLeer: 0 };

describe("la línea de la lectura de sales@", () => {
  it("anduvo bien", () => {
    render(<LineaLecturaSales linea={lineaDeLectura({ ...base, ultima: corrida(), ultimaBuena: corrida() })} />);
    expect(screen.getByTestId("linea-lectura")).toHaveTextContent(
      "Última lectura de sales@: hoy 12:14 · 3 reservas nuevas, 1 actualizada (de 41 mails, 4 de agencias).",
    );
    expect(screen.getByTestId("linea-lectura")).toHaveAttribute("data-tono", "ok");
  });

  it("con aviso: el resumen y el aviso debajo", () => {
    const c = corrida({ estado: "con_aviso", avisos: ["Se alcanzó el techo de gasto de IA: 2 mails quedan para mañana."] });
    render(<LineaLecturaSales linea={lineaDeLectura({ ...base, ultima: c, ultimaBuena: c })} />);
    const linea = screen.getByTestId("linea-lectura");
    expect(linea).toHaveAttribute("data-tono", "aviso");
    expect(linea).toHaveTextContent("Se alcanzó el techo de gasto de IA: 2 mails quedan para mañana.");
  });

  it("falló, atrasada, apagada, vacía y error al consultar", () => {
    const casos = [
      [lineaDeLectura({ ...base, ultima: corrida({ estado: "fallo", errores: ["la casilla no respondió"] }), ultimaBuena: null }), "La última lectura falló (hoy 12:14): la casilla no respondió. Se reintenta mañana a las 12 y no se pierde nada."],
      [lineaDeLectura({ ...base, ultima: corrida({ inicio: "2026-10-12T15:10:00Z" }), ultimaBuena: { inicio: "2026-10-12T15:10:00Z" } }), "No hubo lectura de sales@ desde el lunes 12:10."],
      [lineaDeLectura({ ...base, activa: false, ultima: null, ultimaBuena: null }), "La lectura automática de sales@ está apagada hasta tu OK del modo prueba."],
      [lineaDeLectura({ ...base, ultima: null, ultimaBuena: null }), "Todavía no corrió ninguna lectura de sales@."],
      [lineaDeLectura({ ...base, error: true, ultima: null, ultimaBuena: null }), "No pude consultar el registro de lecturas."],
    ] as const;
    for (const [linea, texto] of casos) {
      const { unmount } = render(<LineaLecturaSales linea={linea} />);
      expect(screen.getByTestId("linea-lectura")).toHaveTextContent(texto);
      unmount();
    }
  });

  it("va arriba de la lista de reservas, y la lista se muestra igual si el registro no se pudo consultar", async () => {
    consultas.cargarReservas.mockResolvedValue(listaReservas);
    render(<ListaReservasPantalla lineaLectura={lineaDeLectura({ ...base, error: true, ultima: null, ultimaBuena: null })} />);
    expect(screen.getByTestId("linea-lectura")).toHaveTextContent("No pude consultar el registro de lecturas.");
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});
