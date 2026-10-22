// @vitest-environment node
//
// Spec M3-15 — verificación 2 (integración contra la BASE DE PRUEBAS):
// - el catálogo real nombra en el servicio 5 de OD019 las dos excursiones de las reglas
//   de data/dias-servicio.csv (Bodegas half Day y Alta Montaña) y el servicio 5 de OD018
//   tiene la opción Bike Tour de data/puntos-de-encuentro.csv: las reglas apuntan a algo;
// - cada tour con Mendoza (BRARCH26 y 5C01) arma el pedido a Huentata con Bodegas el
//   día 1 de su parte de Mendoza por la tarde y Alta Montaña el día 2, sin "a coordinar";
//   ARBR23 (sin Mendoza) no pide nada a Huentata;
// - sin sesión no se ve nada (RLS).
// Lo que crea este archivo lleva `de_prueba = true` y se borra al final (solo lo suyo,
// registro-de-prueba.ts).
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { cargarDiasServicio, cargarPuntosDeEncuentro } from "@/lib/pedidos/cargar";
import { fechaCorta, sumarDias } from "@/lib/pedidos/formato";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { normalizarTexto } from "@/lib/catalogo/reglas";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { fichaDePrueba } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const PREFIJO = "[test M3-15]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const SUFIJO = String(Date.now()).slice(-2);

function mailDePrueba(agencia: string): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-15.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-10-22T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia,
    dePrueba: true,
  };
}

/** Una ficha de lectura (M2-02) con un tour, sobre la de ejemplo de Kilroy (ARBR23 con el código propio de HI Travel). */
function ficha(numero: string, agencia: string, codigo: string, fecha_inicio: string): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: agencia, confianza: 1 };
  f.numero_reserva = { valor: numero, limpio: numero.split("/")[0], confianza: 1 };
  f.productos = [{ ...f.productos[0], nombre: `Tour ${codigo}`, codigo: agencia === "Kilroy" ? `HI_TRAVEL_${codigo}-677` : codigo, fecha_inicio, fecha_fin: null, habitacion: "Double Room - Budget Hotel" }];
  f.fecha_inicio = { valor: fecha_inicio, confianza: 1 };
  f.fecha_fin = { valor: null, confianza: 0 };
  return f;
}

const CASOS = [
  { tour: "BRARCH26", inicio: "2027-04-07", mendoza: true },
  { tour: "5C01", inicio: "2027-06-07", mendoza: true },
  { tour: "ARBR23", inicio: "2027-05-07", agencia: "HI Travel", mendoza: false },
];

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-15 — Mendoza día 1 / día 2 y el punto de encuentro, en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
  });

  afterAll(async () => {
    await registro.limpiar(admin);
  }, 120_000);

  async function servicio5(codigo: string) {
    const { data, error } = await admin.from("producto").select("producto_servicio(orden, descripcion, service_provider_nombre)").eq("codigo", codigo).single();
    if (error) throw new Error(error.message);
    return (data as unknown as { producto_servicio: Array<{ orden: number; descripcion: string | null; service_provider_nombre: string | null }> }).producto_servicio.filter(
      (s) => s.orden === 5,
    );
  }

  it("las reglas apuntan al catálogo: OD019 nombra Bodegas half Day y Alta Montaña; OD018 tiene el Bike Tour", async () => {
    const od019 = normalizarTexto((await servicio5("OD019")).map((s) => `${s.descripcion} ${s.service_provider_nombre ?? ""}`).join(" "));
    for (const d of cargarDiasServicio().filter((x) => x.codigo === "OD019" && x.servicio !== "Rafting")) {
      expect(od019, d.servicio).toContain(normalizarTexto(d.servicio!));
    }
    const od018 = (await servicio5("OD018")).map((s) => s.service_provider_nombre);
    for (const p of cargarPuntosDeEncuentro()) expect(od018).toContain(p.servicio);
  });

  CASOS.forEach((caso, i) => {
    it(`${caso.tour}: ${caso.mendoza ? "Bodegas el día 1 (tarde) y Alta Montaña el día 2 de Mendoza" : "sin Mendoza, nada a Huentata"}`, async () => {
      const agencia = caso.agencia ?? "Kilroy";
      const { mail } = await guardarMailRecibido(mailDePrueba(agencia), admin);
      const deps = await cargarDependenciasReservas(admin);
      const f = ficha(`DK9315${i}${SUFIJO}/test`, agencia, caso.tour, caso.inicio);
      const [c] = await crearReservasDelMail(f, { admin, mailRecibidoId: mail.id, agencia, deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
      const r = await armarYGuardarPedidos(admin, c.reserva.id);
      if (!r.ok) throw new Error(r.error);
      const { pedidos } = await cargarPedidos(admin, c.reserva.id);
      const huentata = pedidos.find((p) => p.proveedores.some((x) => /huentata/i.test(x)));
      if (!caso.mendoza) {
        expect(huentata).toBeUndefined();
        return;
      }
      const partes = await admin.from("reserva_componente").select("fecha_inicio, producto:producto_id(codigo)").eq("reserva_id", c.reserva.id);
      const mendoza = (partes.data as unknown as Array<{ fecha_inicio: string | null; producto: { codigo: string } | null }>).find((p) => p.producto?.codigo === "OD019")?.fecha_inicio;
      expect(mendoza, "la parte de Mendoza con fecha").toBeTruthy();
      console.log(`[M3-15] ${caso.tour}: Mendoza desde ${mendoza}\n${huentata!.cuerpo.split("\n").filter((l) => /Excursión|Fecha/.test(l)).join("\n")}`);
      expect(huentata!.cuerpo).toContain(`Excursión: Bodegas half Day\nFecha: ${fechaCorta(mendoza!)}, por la tarde (14:30 aprox.)`);
      expect(huentata!.cuerpo).toContain(`Excursión: Alta Montaña\nFecha: ${fechaCorta(sumarDias(mendoza!, 1))}`);
      expect(huentata!.cuerpo).not.toContain("a coordinar");
    });
  });

  it("sin sesión no se ven los borradores ni las tareas (RLS)", async () => {
    const pedidos = await anonimo.from("reserva_pedido").select("id").eq("de_prueba", true).limit(1);
    expect(pedidos.data ?? []).toEqual([]);
    const tareas = await anonimo.from("reserva_tarea").select("id").limit(1);
    expect(tareas.data ?? []).toEqual([]);
  });
});
