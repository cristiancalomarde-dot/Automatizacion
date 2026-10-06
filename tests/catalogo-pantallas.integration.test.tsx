// @vitest-environment jsdom
//
// Spec M1-06 — verificaciones 2 y 3: las pantallas reales, con las consultas
// reales, contra el proyecto Supabase real (datos de M1-03/04/05).
//
// - "Qué NO debe pasar" (#10, #11, #12): sin sesión, RLS hace que las tablas
//   se vean vacías → las pantallas muestran el vacío de user-flow §7; con el
//   servidor inalcanzable → el error con "Reintentar", que repite la consulta.
// - Recorrido completo (V3): buscar CHB31 → abrir el Overland → ver cada
//   componente con el proveedor y el mail a quien se le pediría; Directorio
//   → "Proveedores sin mail" → abrir uno → dice dónde completarlo; Pendientes.
//
// Solo lectura: nada de este archivo escribe en el catálogo ni en el directorio.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const cliente = vi.hoisted(() => ({ actual: null as unknown, pedidos: 0 }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => {
    cliente.pedidos += 1;
    return cliente.actual;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/" }));

import { CatalogoPantalla } from "@/components/catalogo/catalogo-pantalla";
import { DetalleProductoPantalla } from "@/components/catalogo/detalle-producto-pantalla";
import { DirectorioPantalla } from "@/components/catalogo/directorio-pantalla";
import { DetalleProveedorPantalla } from "@/components/catalogo/detalle-proveedor-pantalla";
import { PendientesPantalla } from "@/components/catalogo/pendientes-pantalla";

const CORRE = credencialesSupabaseDisponibles();
const ESPERA = { timeout: 20_000 };

function clienteSinSesion(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function clienteInalcanzable(): SupabaseClient {
  return createClient("http://127.0.0.1:9", "clave-cualquiera", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

(CORRE ? describe : describe.skip)("pantallas de M1-06 contra Supabase real", () => {
  let conSesion: SupabaseClient;
  let borrar: () => Promise<void>;

  beforeAll(async () => {
    ({ cliente: conSesion, borrar } = await crearSesionDePrueba());
  }, 30_000);

  afterAll(async () => {
    await borrar?.();
  });

  beforeEach(() => {
    push.mockClear();
    cliente.pedidos = 0;
  });

  describe("qué NO debe pasar (#10, #11, #12)", () => {
    it("#10 catálogo vacío: texto exacto + 'Cargar productos', sin tabla ni error", async () => {
      cliente.actual = clienteSinSesion();
      render(<CatalogoPantalla />);
      expect(
        await screen.findByText(
          "El catálogo está vacío. Sin productos cargados, las reservas no se pueden emparejar.",
          {},
          ESPERA,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cargar productos" })).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    }, 30_000);

    it("#11 directorio vacío: texto exacto + 'Agregar proveedor'", async () => {
      cliente.actual = clienteSinSesion();
      render(<DirectorioPantalla />);
      expect(
        await screen.findByText(
          "No hay proveedores cargados. Se necesitan para poder mandarles los pedidos.",
          {},
          ESPERA,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Agregar proveedor" })).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
    }, 30_000);

    it("#12 falla de red: cada pantalla muestra su error y 'Reintentar' repite la consulta", async () => {
      cliente.actual = clienteInalcanzable();
      const catalogo = render(<CatalogoPantalla />);
      expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent("No pudimos cargar el catálogo.");
      expect(screen.queryByRole("table")).toBeNull();

      const antes = cliente.pedidos;
      cliente.actual = conSesion;
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByRole("table", {}, ESPERA)).toBeInTheDocument();
      expect(cliente.pedidos).toBe(antes + 1);
      catalogo.unmount();

      cliente.actual = clienteInalcanzable();
      render(<DirectorioPantalla />);
      expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent("No pudimos cargar el directorio.");
    }, 40_000);
  });

  describe("recorrido completo (V3)", () => {
    it("buscar CHB31 → abrir el Overland → cada componente con su proveedor y mail", async () => {
      cliente.actual = conSesion;
      const catalogo = render(<CatalogoPantalla />);
      const buscador = await screen.findByLabelText("Buscar por código o nombre", {}, ESPERA);
      fireEvent.change(buscador, { target: { value: "CHB31" } });

      const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
      expect(filas).toHaveLength(1);
      expect(filas[0]).toHaveTextContent("Overland San Pedro de Atacama to Uyuni, end in La Paz");
      fireEvent.click(filas[0]);
      expect(push).toHaveBeenCalledTimes(1);
      const destino = push.mock.calls[0][0] as string;
      expect(destino).toMatch(/^\/catalogo\/[0-9a-f-]{36}$/);
      catalogo.unmount();

      render(<DetalleProductoPantalla id={destino.split("/").pop()!} />);
      const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
      const texto = itinerario.textContent ?? "";
      expect(texto.indexOf("OD030")).toBeGreaterThan(-1);
      expect(texto.indexOf("OD030")).toBeLessThan(texto.indexOf("COMPBO20"));
      // Proveedores con mail de San Pedro (OD030), visibles sin abrir el Directorio.
      expect(within(itinerario).getByText("reservas@donraul.cl")).toBeInTheDocument();
      expect(within(itinerario).getByText("horizonteatacamareserva@gmail.com")).toBeInTheDocument();
      // Transvip manual y el bus propio del tour de Imperio Inca (WhatsApp), en su día.
      expect(within(itinerario).getAllByText("Manual en sistema propio").length).toBeGreaterThan(0);
      const filaDia6 = within(itinerario).getByText("Día 6").closest("tr")!;
      expect(within(filaDia6).getByRole("link", { name: "Imperio Inca" })).toBeInTheDocument();
      expect(screen.queryByText(/No se le podrán armar pedidos/)).toBeNull();
    }, 40_000);

    it("ARCH31: tramo de bus 'pendiente de emitir' sin proveedor, transfers en las puntas", async () => {
      cliente.actual = conSesion;
      const { data } = await conSesion.from("producto").select("id").eq("codigo", "ARCH31").single();
      render(<DetalleProductoPantalla id={data!.id} />);
      const itinerario = await screen.findByRole("table", { name: "Itinerario día por día" }, ESPERA);
      const texto = itinerario.textContent ?? "";
      const posiciones = ["OD033", "OD016", "El Calafate – Puerto Natales", "OD017"].map((t) => texto.indexOf(t));
      expect(posiciones.every((p, i) => p > -1 && (i === 0 || p > posiciones[i - 1]))).toBe(true);
      expect(within(itinerario).getByText("Tramo externo pendiente de emitir")).toBeInTheDocument();
      expect(within(itinerario).getAllByText("Transfer de llegada")).toHaveLength(1);
      expect(within(itinerario).getAllByText("Transfer de salida")).toHaveLength(1);
    }, 40_000);

    it("Directorio → 'Proveedores sin mail' → abrir uno → dice dónde completarlo", async () => {
      cliente.actual = conSesion;
      const directorio = render(<DirectorioPantalla />);
      await screen.findByRole("table", {}, ESPERA);
      const total = within(screen.getByRole("table")).getAllByRole("row").length - 1;

      fireEvent.click(screen.getByRole("button", { name: /Proveedores sin mail/ }));
      const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
      expect(filas.length).toBeGreaterThan(0);
      expect(filas.length).toBeLessThan(total);
      for (const fila of filas) expect(within(fila).getByText("Sin mail")).toBeInTheDocument();

      const antarctica = filas.find((f) => within(f).queryByText("Antarctica Hostel"))!;
      fireEvent.click(antarctica);
      const destino = push.mock.calls.at(-1)![0] as string;
      expect(destino).toMatch(/^\/proveedores\//);
      directorio.unmount();

      render(<DetalleProveedorPantalla id={destino.split("/").pop()!} />);
      await screen.findByRole("heading", { name: "Antarctica Hostel" }, ESPERA);
      expect(screen.getByText(/Se completa en el Excel de proveedores/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "OD022" })).toBeInTheDocument();
    }, 40_000);

    it("Pendientes: NH Cordillera (OD019), Antarctica Hostel (OD022) y O Hostel GRU (COMPBR10)", async () => {
      cliente.actual = conSesion;
      render(<PendientesPantalla />);
      const tabla = await screen.findByRole("table", {}, ESPERA);
      const filas = within(tabla).getAllByRole("row").slice(1);
      const claves = filas.map((f) => f.textContent ?? "");
      for (const [codigo, proveedor] of [
        ["OD019", "NH Cordillera"],
        ["OD022", "Antarctica Hostel"],
        ["COMPBR10", "O Hostel GRU"],
      ]) {
        expect(claves.some((t) => t.includes(codigo) && t.includes(proveedor))).toBe(true);
      }
    }, 40_000);
  });
});
