// @vitest-environment node
//
// Spec M1-06 — verificación 2: las consultas de las pantallas contra el
// proyecto Supabase real, con una sesión `authenticated` (RLS) y los datos que
// dejaron M1-03/04/05. Solo lectura: este archivo no escribe en el catálogo
// ni en el directorio (DECISIONS 2026-10-06).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cargarCatalogo,
  cargarDirectorio,
  cargarPendientes,
  cargarProducto,
  cargarProveedor,
} from "@/lib/catalogo/consultas";
import { agruparAlojamientoPorNivel, estadoServicio } from "@/lib/catalogo/reglas";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const CORRE = credencialesSupabaseDisponibles();

(CORRE ? describe : describe.skip)("consultas de M1-06 contra Supabase real", () => {
  let cliente: SupabaseClient;
  let borrar: () => Promise<void>;

  beforeAll(async () => {
    ({ cliente, borrar } = await crearSesionDePrueba());
  }, 30_000);

  afterAll(async () => {
    await borrar?.();
  });

  async function idDe(codigo: string): Promise<string> {
    const catalogo = await cargarCatalogo(cliente);
    return catalogo.find((p) => p.codigo === codigo)!.id;
  }

  it("#1 catálogo: una fila por producto, con proveedores sin duplicar", async () => {
    const catalogo = await cargarCatalogo(cliente);
    expect(catalogo.length).toBeGreaterThanOrEqual(29);
    const od010a = catalogo.find((p) => p.codigo === "OD010A")!;
    // Beer (Tangoinn) + Cuenca del Plata: Cuenca aparece en 4 servicios y cuenta una vez.
    expect(od010a.cantidadProveedores).toBe(2);
    expect(od010a.updatedAt).toBeTruthy();
    const chb31 = catalogo.find((p) => p.codigo === "CHB31")!;
    expect(chb31.esTour).toBe(true);
    expect(chb31.ciudades).toContain("Uyuni");
  }, 30_000);

  it("#3/#14/#17 OD010A: niveles, prioridades, mails y códigos de agencia", async () => {
    const detalle = await cargarProducto(cliente, await idDe("OD010A"));
    const niveles = agruparAlojamientoPorNivel(detalle.servicios);
    expect(niveles.map((n) => [n.nivel, n.ofrecido])).toEqual([
      ["Hostel", true],
      ["Budget Hotel", false],
      ["Hotel 3*", true],
      ["Hotel 4*", true],
    ]);
    const tres = niveles.find((n) => n.nivel === "Hotel 3*")!.servicios;
    expect(tres.map((s) => s.serviceProviderNombre)).toEqual(["Hotel 3* El Pueblito", "Botanica"]);
    expect(tres[0].bookingSupplier?.mails.length).toBeGreaterThan(0);
    expect(tres[0].filaExcel).toBe(12);
    expect(detalle.codigosExternos).toContainEqual({
      agencia: "TourRadar",
      codigo: "160955",
      nombreExterno: "Iguazu Falls on a Shoestring (3N)",
    });
  }, 30_000);

  it("#15 OD030: Transvip manual, Aji Verde por WhatsApp", async () => {
    const detalle = await cargarProducto(cliente, await idDe("OD030"));
    const transvip = detalle.servicios.find((s) => s.bookingSupplierNombre === "Transvipp")!;
    expect(estadoServicio(transvip).tipo).toBe("manual");
    const aji = detalle.servicios.find((s) => s.serviceProviderNombre === "Aji Verde")!;
    expect(estadoServicio(aji).tipo).toBe("whatsapp");
  }, 30_000);

  it("#4/#16 CHB31: componentes en orden, con proveedores y mails; bus propio de Imperio Inca", async () => {
    const detalle = await cargarProducto(cliente, await idDe("CHB31"));
    expect(detalle.esTour).toBe(true);
    expect(detalle.componentes.map((c) => c.producto?.codigo)).toEqual(["OD030", "COMPBO20"]);
    const od030 = detalle.componentes[0].producto!;
    expect(od030.servicios.some((s) => (s.bookingSupplier?.mails.length ?? 0) > 0)).toBe(true);
    expect(detalle.servicios.map((s) => s.bookingSupplier?.nombre)).toContain("Imperio Inca");
  }, 30_000);

  it("#16 ARCH31: OD033 → OD016 → bus → OD017, transfers solo en las puntas", async () => {
    const detalle = await cargarProducto(cliente, await idDe("ARCH31"));
    expect(detalle.componentes.map((c) => c.producto?.codigo ?? c.tipo)).toEqual([
      "OD033",
      "OD016",
      "tramo_bus",
      "OD017",
    ]);
    expect(detalle.componentes.map((c) => [c.transferIn, c.transferOut])).toEqual([
      [true, false],
      [false, false],
      [false, false],
      [false, true],
    ]);
  }, 30_000);

  it("#16 5C01: CHB31 en el día 22 marcado como tour", async () => {
    const detalle = await cargarProducto(cliente, await idDe("5C01"));
    const chb31 = detalle.componentes.find((c) => c.producto?.codigo === "CHB31")!;
    expect(chb31.diaDesde).toBe(22);
    expect(chb31.producto!.esTour).toBe(true);
  }, 30_000);

  it("#7 directorio: todos los proveedores, con conteo de productos", async () => {
    const directorio = await cargarDirectorio(cliente);
    expect(directorio.length).toBeGreaterThan(200);
    expect(directorio.some((p) => p.mails.length === 0)).toBe(true);
    const cuenca = directorio.find((p) => p.mails.includes("reservas3@cuencadelplata.com"))!;
    expect(cuenca.cantidadProductos).toBeGreaterThanOrEqual(4);
  }, 30_000);

  it("#9 detalle de proveedor: datos y productos donde aparece", async () => {
    const directorio = await cargarDirectorio(cliente);
    const antarctica = directorio.find((p) => p.nombre === "Antarctica Hostel")!;
    const detalle = await cargarProveedor(cliente, antarctica.id);
    expect(detalle.mails).toEqual([]);
    expect(detalle.ciudad).toBe("USHUAIA");
    expect(detalle.productos.map((p) => p.codigo)).toContain("OD022");
  }, 30_000);

  it("#18 pendientes: NH Cordillera, Antarctica Hostel y O Hostel GRU", async () => {
    const pendientes = await cargarPendientes(cliente);
    const claves = pendientes.map((p) => `${p.producto.codigo}:${p.proveedorNombre}`);
    expect(claves).toEqual(
      expect.arrayContaining(["OD019:NH Cordillera", "OD022:Antarctica Hostel", "COMPBR10:O Hostel GRU"]),
    );
    expect(pendientes.every((p) => p.motivo.length > 0)).toBe(true);
  }, 30_000);

  it("#12 una falla de la consulta se propaga como error (no como lista vacía)", async () => {
    const roto = createClient("http://127.0.0.1:9", "clave-cualquiera", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await expect(cargarCatalogo(roto)).rejects.toThrow();
    await expect(cargarDirectorio(roto)).rejects.toThrow();
  }, 30_000);

  it("#10/#11 sin sesión (RLS) las tablas se ven vacías, sin error", async () => {
    const anonimo = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    expect(await cargarCatalogo(anonimo)).toEqual([]);
    expect(await cargarDirectorio(anonimo)).toEqual([]);
  }, 30_000);
});
