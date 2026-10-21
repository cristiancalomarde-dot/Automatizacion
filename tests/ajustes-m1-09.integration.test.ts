// @vitest-environment node
//
// Spec M1-09 — verificación 2 (regla #5), contra el proyecto Supabase real,
// después de la recarga completa con los Excel del 2026-10-10 (proveedores →
// equivalencias → productos → paquetes → tours). Filas 1-5 de §3.
//
// Solo lee.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import type { ComponenteTour } from "@/lib/catalogo/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const RAIZ = resolve(__dirname, "..");
const CORRE = credencialesSupabaseDisponibles();
const TIMEOUT = 120_000;

(CORRE ? describe : describe.skip)("ajustes finales de traslados contra Supabase real (spec M1-09)", () => {
  let admin: SupabaseClient;
  const ids = new Map<string, string>();

  async function idDe(codigo: string): Promise<string> {
    if (!ids.has(codigo)) {
      const { data, error } = await admin.from("producto").select("id").eq("codigo", codigo).single();
      expect(error, codigo).toBeNull();
      ids.set(codigo, data!.id);
    }
    return ids.get(codigo)!;
  }

  async function traslados(codigo: string) {
    const { data, error } = await admin
      .from("producto_servicio")
      .select("orden, descripcion, sentido, a_pedido, opcional, booking_supplier_nombre, bs:booking_supplier_id(nombre)")
      .eq("producto_id", await idDe(codigo))
      .eq("tipo_servicio", "traslado")
      .order("orden");
    expect(error).toBeNull();
    return data as unknown as Array<{
      orden: number;
      descripcion: string;
      sentido: string | null;
      a_pedido: string | null;
      opcional: boolean;
      booking_supplier_nombre: string | null;
      bs: { nombre: string } | null;
    }>;
  }

  async function ajustes(tour: string): Promise<string[]> {
    const { data, error } = await admin
      .from("tour_servicio_ajuste")
      .select("orden, accion, origen, motivo, paquete:paquete_id(codigo)")
      .eq("tour_id", await idDe(tour));
    expect(error).toBeNull();
    return (data as unknown as Array<{ orden: number; accion: string; origen: string; motivo: string; paquete: { codigo: string } }>)
      .map((a) => `${a.paquete.codigo} ${a.orden} ${a.accion} ${a.origen} — ${a.motivo}`)
      .sort();
  }

  beforeAll(() => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("#1 la recarga de proveedores no avisa de la fila duplicada de Fitz Roy y no queda ningún 'Hosteria Fitz roy' suelto", async () => {
    const reporte = readFileSync(resolve(RAIZ, "docs/sdd/diagnosticos/M1-09-recarga.md"), "utf-8");
    expect(reporte).not.toMatch(/duplicad[ao][^\n]*Fitz/i);
    expect(reporte).toContain("Nada: el Excel dice lo mismo que la base.");
    const { data, error } = await admin.from("proveedor").select("id, nombre").ilike("nombre", "%fitz roy%");
    expect(error).toBeNull();
    expect(data!.map((p) => p.nombre)).toEqual(["Hosteria Fitz roy, proveedor Patagonian Group"]);
  }, TIMEOUT);

  it("#2 OD016: un solo traslado, de llegada (FTE → alojamiento), sin marca a pedido", async () => {
    const lista = await traslados("OD016");
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ sentido: "llegada", a_pedido: null, opcional: false, bs: { nombre: "Chalten Travel" } });
    expect(lista[0].descripcion).toMatch(/FTE Airport - El Calafate Accommodation/);
  }, TIMEOUT);

  it("#2 dentro de ARCH31 y ARCH33 la llegada de OD016 no se pide (llega en bus desde El Chaltén)", async () => {
    for (const tour of ["ARCH31", "ARCH33"]) {
      expect((await ajustes(tour)).filter((a) => a.startsWith("OD016")), tour).toEqual(["OD016 5 anular regla — Llega en bus desde El Chaltén."]);
    }
    const reporte = readFileSync(resolve(RAIZ, "docs/sdd/diagnosticos/M1-08-traslados.md"), "utf-8");
    const linea = "- **OD016** · Transfer FTE Airport - El Calafate Accommodation (Chalten Travel): no se pide — Llega en bus desde El Chaltén.";
    expect(reporte.split(linea).length - 1).toBe(3); // ARCH31, ARCH33 y, desde M3-10, ARCH33EXP
    expect(reporte).not.toContain("El Calafate Accommodation - FTE Airport");
  }, TIMEOUT);

  it("#3 OD017: traslado aeropuerto PNT → alojamiento, de llegada, opcional (sin marca a pedido), con Patagonia Planet; en ARCH31 no se pide", async () => {
    const lista = await traslados("OD017");
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ sentido: "llegada", a_pedido: null, opcional: true, booking_supplier_nombre: "Patagonia Planet" });
    expect(lista[0].bs?.nombre).toMatch(/patagonia planet/i);
    expect(lista[0].descripcion).toMatch(/PNT Airport - PNT accommodation/);
    expect((await ajustes("ARCH31")).filter((a) => a.startsWith("OD017"))).toEqual([
      expect.stringMatching(/^OD017 3 anular excepcion/),
      `OD017 ${lista[0].orden} anular regla — Llega en bus desde El Calafate.`,
    ]);
  }, TIMEOUT);

  describe("#4 etiquetas de transfer en cada tour, con una sesión del equipo", () => {
    let cliente: SupabaseClient;
    let borrar: () => Promise<void>;

    beforeAll(async () => {
      ({ cliente, borrar } = await crearSesionDePrueba());
    }, 30_000);

    afterAll(async () => {
      await borrar?.();
    });

    function etiquetas(componentes: ComponenteTour[]): string[] {
      return componentes.flatMap((c) => {
        if (!c.producto) return [];
        const propia = [c.producto.codigo, c.transferIn ? "IN" : "", c.transferOut ? "OUT" : ""].filter(Boolean).join(" ");
        return [propia, ...etiquetas(c.producto.componentes ?? [])];
      });
    }

    it.each([
      ["ARCH31", ["OD033 IN", "OD016", "OD017"]],
      ["ARCH33", ["OD033 IN", "OD016", "CH10"]],
      ["AR09", ["OD018 IN", "OD025", "OD013", "OD022 OUT"]],
      ["BRARCH26", ["OD032 IN", "OD010A IN OUT", "OD018", "OD019", "OD029"]],
      ["5C01", ["OD032 IN", "COMPBR10", "OD010D IN OUT", "OD020", "OD019", "OD029", "COMPCH01", "CHB31", "OD030", "COMPBO20", "OD031 IN"]],
      ["BOCHI04R", ["COMPBO20", "OD030 OUT"]],
      ["CHB31", ["OD030 IN", "COMPBO20"]],
    ])("%s", async (tour, esperadas) => {
      const t = await cargarProducto(cliente, await idDe(tour));
      expect(etiquetas(t.componentes)).toEqual(esperadas);
    }, TIMEOUT);
  });
});
