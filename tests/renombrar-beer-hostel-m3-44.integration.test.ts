// @vitest-environment node
//
// Spec M3-44 #3 — el renombre de un proveedor del directorio (Tangoinn Bed & Brewery IGR → Beer Hostel),
// contra la BASE DE PRUEBAS (#4: la real la toca el owner con `npm run renombrar:beer-hostel -- --aplicar`).
// Con un proveedor de prueba propio (ciudad única): en seco no escribe; con aplicar cambia nombre y
// nombre_normalizado del mismo registro; otra vez, "ya estaba". Lo que crea se borra al terminar.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BEER_HOSTEL, renombrarProveedor } from "@/lib/importador-proveedores/renombrar";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const CIUDAD = `TEST-M3-44-${randomUUID().slice(0, 8)}`;
const R = { de: "Tangoinn Bed & Brewery IGR", ciudad: CIUDAD, a: "Beer Hostel" };

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-44 #3 — renombrar Beer Hostel en el directorio", { timeout: 60_000 }, () => {
  let admin: SupabaseClient;
  let id: string;

  const leer = async () => {
    const { data, error } = await admin.from("proveedor").select("nombre, nombre_normalizado, mails").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data;
  };

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin
      .from("proveedor")
      .insert({ nombre: "Tangoinn Bed & Brewery IGR", nombre_normalizado: "tangoinn bed & brewery igr", ciudad: CIUDAD, mails: ["beerhotel@test.invalid"] })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
  });

  afterAll(async () => {
    if (admin) await admin.from("proveedor").delete().eq("ciudad", CIUDAD);
  });

  it("es el proveedor del directorio real: Tangoinn Bed & Brewery IGR de IGUAZU → Beer Hostel", () => {
    expect(BEER_HOSTEL).toEqual({ de: "Tangoinn Bed & Brewery IGR", ciudad: "IGUAZU", a: "Beer Hostel" });
  });

  it("en seco dice qué cambiaría y no escribe", async () => {
    const r = await renombrarProveedor(admin, R, { aplicar: false });
    expect(r).toEqual({
      estado: "por_renombrar",
      id,
      antes: { nombre: "Tangoinn Bed & Brewery IGR", nombre_normalizado: "tangoinn bed & brewery igr" },
      despues: { nombre: "Beer Hostel", nombre_normalizado: "beer hostel" },
    });
    expect((await leer()).nombre).toBe("Tangoinn Bed & Brewery IGR");
  });

  it("con aplicar renombra el mismo registro (nombre y nombre_normalizado), sin tocar los mails", async () => {
    const r = await renombrarProveedor(admin, R, { aplicar: true });
    expect(r.estado).toBe("renombrado");
    expect(await leer()).toEqual({ nombre: "Beer Hostel", nombre_normalizado: "beer hostel", mails: ["beerhotel@test.invalid"] });
  });

  it("otra vez: ya estaba (idempotente)", async () => {
    expect((await renombrarProveedor(admin, R, { aplicar: true })).estado).toBe("ya_estaba");
  });

  it("si no está ninguno de los dos, no_esta", async () => {
    expect((await renombrarProveedor(admin, { ...R, ciudad: `${CIUDAD}-otra` }, { aplicar: false })).estado).toBe("no_esta");
  });
});
