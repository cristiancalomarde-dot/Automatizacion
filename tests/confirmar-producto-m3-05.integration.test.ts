// @vitest-environment node
//
// Spec M3-05 — verificación 2 (integración contra la BASE DE PRUEBAS):
// confirmar el producto de una reserva "para revisión" con la sesión de una
// persona del equipo (RLS) y la función de la migración 0020.
//
// (a) solo con motivo de producto → recibida con el producto; (b) producto +
// otro motivo → sigue en revisión solo con el otro; (c) tour compuesto → sus
// partes. La app aprende (el próximo mail igual se reconoce sin IA), no
// duplica, pregunta antes de pisar una equivalencia de otro producto, los
// importadores no se llevan lo aprendido, el historial guarda quién, y sin
// sesión nada. Las reservas de prueba se borran al final; las que tienen que
// ser reales (para aprender) quedan en la base de pruebas, como en M2-06, y lo
// que aprendieron se borra.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { confirmarProducto, type ResultadoConfirmar } from "@/lib/reservas/confirmar/confirmar";
import { cargarCatalogoParaEmparejar } from "@/lib/reservas/emparejar/catalogo";
import { importarCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { importarCodigosTourRadarCsv } from "@/lib/reservas/emparejar/codigos-tourradar-csv";
import { emparejarProducto, normalizarNombre, type ProponerProducto } from "@/lib/reservas/emparejar/emparejar";
import { MOTIVOS_EMPAREJADO as M } from "@/lib/reservas/emparejar/motivos";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada, ReservaEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M3-05]";
const T = TEXTOS.reserva.confirmarProducto;
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

const nombreUnico = (base: string) => `HI - ${base} test M3-05 ${randomUUID().slice(0, 8)}`;

function fichaCon(nombre: string, codigo: string | null = null): FichaLectura {
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    productos: [{ nombre, codigo, fecha_inicio: null, fecha_fin: null, noches: null, habitacion: null, punto_recogida: null, opcionales: [], confianza: 1 }],
  } as unknown as FichaLectura;
}

function ok(r: ResultadoConfirmar): Extract<ResultadoConfirmar, { ok: true }> {
  if (!r.ok) throw new Error(`Se esperaba ok: ${r.error}`);
  return r;
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-05 — confirmar el producto en la base de pruebas", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let anonimo: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let usuarioId: string;
  const ids = new Map<string, string>();
  /** Lo que aprendieron las reservas reales del test (o lo que el test cargó a mano), para borrarlo. */
  const codigosKilroy: string[] = [];

  async function reserva(dePrueba: boolean, nombre: string, extra: Partial<ReservaEntrada> = {}): Promise<string> {
    const mail: MailEntrada = {
      origen: "archivo",
      archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
      messageId: `<${randomUUID()}@test-m3-05.hitravel.local>`,
      remitente: "aarhus@kilroy.dk",
      asunto: `${PREFIJO} pedido sintético`,
      fechaMail: "2026-10-19T12:00:00.000Z",
      cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
      agencia: "Kilroy",
      dePrueba,
    };
    const { mail: guardado } = await guardarMailRecibido(mail, admin);
    const { reserva: r } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: guardado.id,
        bookingId: `TEST305${randomUUID().slice(0, 8)}`,
        estado: "para_revision",
        motivosRevision: [M.noSeguro(nombre)],
        productoTextoAgencia: nombre,
        fechaInicio: "2027-03-10",
        fechaFin: "2027-03-13",
        pax: 2,
        datosExtraidos: fichaCon(nombre),
        dePrueba,
        ...extra,
      },
      admin,
    );
    return r.id;
  }

  const leer = async (id: string) => (await admin.from("reserva").select("*").eq("id", id).single()).data!;
  const equivalencias = async (codigo: string) =>
    (await admin.from("codigo_externo").select("*").eq("agencia", "Kilroy").eq("codigo", codigo)).data ?? [];

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const sesion = await crearSesionDePrueba();
    equipo = sesion.cliente;
    borrarSesion = sesion.borrar;
    const { data } = await equipo.auth.getUser();
    usuarioId = data.user!.id;
    const alta = await admin.from("usuario").insert({ id: usuarioId, email: data.user!.email, nombre: "Test M3-05" });
    if (alta.error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${alta.error.message}`);
    const productos = await admin.from("producto").select("id,codigo").in("codigo", ["OD031", "OD030", "CHB31"]);
    if (productos.error) throw new Error(productos.error.message);
    for (const p of productos.data ?? []) ids.set(p.codigo, p.id);
    expect([...ids.keys()].sort()).toEqual(["CHB31", "OD030", "OD031"]);
  }, 120_000);

  afterAll(async () => {
    try {
      if (codigosKilroy.length) await admin.from("codigo_externo").delete().eq("agencia", "Kilroy").in("codigo", codigosKilroy);
      await registro.limpiar(admin);
      if (usuarioId) await admin.from("usuario").delete().eq("id", usuarioId);
    } finally {
      await borrarSesion?.();
    }
  }, 120_000);

  it("(a) + filas 5 y 7: aceptar la sugerencia deja la reserva recibida, aprende el nombre y el próximo mail se reconoce sin IA", async () => {
    const nombre = nombreUnico("La Paz Starter Package");
    codigosKilroy.push(normalizarNombre(nombre));
    const id = await reserva(false, nombre, {
      motivosRevision: [M.noSeguro(nombre, { codigo: "OD031", confianza: 0.85 })],
      sugerenciaProductoId: ids.get("OD031"),
    });

    const r = ok(await confirmarProducto(equipo, { reservaId: id, productoId: ids.get("OD031")! }));
    expect(r).toEqual({ ok: true, estado: "recibida", codigo: "OD031", agencia: "Kilroy", aprendio: true });
    const guardada = await leer(id);
    expect(guardada).toMatchObject({
      estado: "recibida",
      producto_id: ids.get("OD031"),
      origen_emparejado: "ia",
      motivos_revision: [],
      sugerencia_producto_id: null,
    });
    expect(Number(guardada.confianza_emparejado)).toBe(0.85);

    // Lo aprendido: el nombre de Kilroy, con quién y desde qué reserva.
    const [fila] = await equivalencias(normalizarNombre(nombre));
    expect(fila).toMatchObject({ producto_id: ids.get("OD031"), nombre_externo: nombre, origen: "aprendido", aprendido_por: usuarioId, aprendido_de_reserva_id: id });

    // El próximo mail con el mismo nombre (otras mayúsculas) se reconoce por nombre, sin llamar a la IA (#3).
    const proponer = vi.fn<ProponerProducto>();
    const emparejado = await emparejarProducto(
      { nombre: nombre.toUpperCase(), codigo: null, fechaInicio: null, fechaFin: null },
      { agencia: "Kilroy", catalogo: await cargarCatalogoParaEmparejar(admin), proponer },
    );
    expect(emparejado).toMatchObject({ origen: "nombre", producto: { codigo: "OD031" } });
    expect(proponer).not.toHaveBeenCalled();

    // Fila 7: el historial con el autor, y el cambio de estado que agrega la base.
    const eventos = (await admin.from("evento_reserva").select("tipo,autor_id,detalle,estado_nuevo").eq("reserva_id", id).order("created_at")).data!;
    expect(eventos.find((e) => e.tipo === "producto_confirmado")).toMatchObject({
      autor_id: usuarioId,
      detalle: { codigo: "OD031", sugerida: true, aprendio: true, persona: expect.any(String) },
    });
    expect(eventos.find((e) => e.tipo === "estado_cambiado")).toMatchObject({ autor_id: usuarioId, estado_nuevo: "recibida" });

    // Otra reserva igual: no duplica la equivalencia.
    const otra = await reserva(false, nombre, { motivosRevision: [M.noSeguro(nombre)] });
    expect(ok(await confirmarProducto(equipo, { reservaId: otra, productoId: ids.get("OD031")! })).aprendio).toBe(false);
    expect(await equivalencias(normalizarNombre(nombre))).toHaveLength(1);
  });

  it("(b) + fila 8: elegir otro producto con otro motivo pendiente → sigue en revisión solo con ese; una de prueba no aprende", async () => {
    const nombre = nombreUnico("Calama");
    const vuelo = M.faltaVuelo("in", { ciudad: "Calama", codigos: ["CJC"] }, "el traslado de OD030");
    const id = await reserva(true, nombre, { motivosRevision: [M.noSeguro(nombre, { codigo: "OD031", confianza: 0.6 }), vuelo], sugerenciaProductoId: ids.get("OD031") });

    const r = ok(await confirmarProducto(equipo, { reservaId: id, productoId: ids.get("OD030")! }));
    expect(r).toMatchObject({ estado: "para_revision", codigo: "OD030", aprendio: false });
    expect(await leer(id)).toMatchObject({ estado: "para_revision", producto_id: ids.get("OD030"), origen_emparejado: "nombre", motivos_revision: [vuelo] });
    expect(await equivalencias(normalizarNombre(nombre))).toEqual([]);
    const evento = (await admin.from("evento_reserva").select("detalle").eq("reserva_id", id).eq("tipo", "producto_confirmado").single()).data!;
    expect(evento.detalle).toMatchObject({ codigo: "OD030", sugerida: false, aprendio: false });
  });

  it("(c) tour compuesto: confirmar CHB31 crea sus partes en orden y con fecha real", async () => {
    const nombre = nombreUnico("Overland");
    const id = await reserva(true, nombre, { fechaInicio: "2027-03-10", fechaFin: "2027-03-16" });
    ok(await confirmarProducto(equipo, { reservaId: id, productoId: ids.get("CHB31")! }));
    const partes = (await admin.from("reserva_componente").select("orden,tipo,fecha_inicio,de_prueba").eq("reserva_id", id).order("orden")).data!;
    const esperadas = (await import("@/lib/reservas/emparejar/componentes")).componentesDeLaReserva(await cargarProducto(admin, ids.get("CHB31")!), "2027-03-10", {
      finalPuertoNatales: false,
      proveedorTransferPNT: null,
    });
    expect(partes.length).toBe(esperadas.length);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes[0]).toMatchObject({ orden: 1, fecha_inicio: "2027-03-10", de_prueba: true });
  });

  it("fila 5, no debe pasar: pisar sin avisar una equivalencia de otro producto; con el sí, se cambia", async () => {
    const nombre = nombreUnico("Starter");
    const codigo = normalizarNombre(nombre);
    codigosKilroy.push(codigo);
    const alta = await admin.from("codigo_externo").insert({ producto_id: ids.get("OD030"), agencia: "Kilroy", codigo, nombre_externo: nombre });
    expect(alta.error).toBeNull();
    const id = await reserva(false, nombre);
    const antes = await leer(id);

    const r = await confirmarProducto(equipo, { reservaId: id, productoId: ids.get("OD031")! });
    expect(r).toEqual({ ok: false, error: T.conflicto("Kilroy", nombre, "OD030"), conflicto: T.conflicto("Kilroy", nombre, "OD030") });
    expect(await leer(id)).toEqual(antes);
    expect((await equivalencias(codigo))[0].producto_id).toBe(ids.get("OD030"));

    ok(await confirmarProducto(equipo, { reservaId: id, productoId: ids.get("OD031")!, cambiarEquivalencia: true }));
    expect((await equivalencias(codigo))[0]).toMatchObject({ producto_id: ids.get("OD031"), origen: "aprendido", aprendido_por: usuarioId });
  });

  it("fila 6: volver a correr los importadores de Kilroy y TourRadar no se lleva lo aprendido", async () => {
    const codigo = `HI_TEST_M305_${randomUUID().slice(0, 8)}-677`;
    codigosKilroy.push(codigo);
    const alta = await admin
      .from("codigo_externo")
      .insert({ producto_id: ids.get("OD031"), agencia: "Kilroy", codigo, nombre_externo: "Aprendida", origen: "aprendido" });
    expect(alta.error).toBeNull();
    await importarCodigosKilroy(admin, readFileSync(join(process.cwd(), "data", "codigos-kilroy.csv"), "utf-8"));
    await importarCodigosTourRadarCsv(admin, readFileSync(join(process.cwd(), "data", "codigos-tourradar.csv"), "utf-8"));
    expect(await equivalencias(codigo)).toEqual([expect.objectContaining({ producto_id: ids.get("OD031"), origen: "aprendido" })]);
  });

  it("fila 8: sin sesión se rechaza (la acción y la función de la base) y nada cambia", async () => {
    const nombre = nombreUnico("Sin sesion");
    const id = await reserva(true, nombre);
    const antes = await leer(id);
    expect(await confirmarProducto(anonimo, { reservaId: id, productoId: ids.get("OD031")! })).toMatchObject({ ok: false, sinSesion: true });
    const directo = await anonimo.rpc("confirmar_producto_reserva", {
      p_reserva: id,
      p_motivos_antes: antes.motivos_revision,
      p_producto: ids.get("OD031"),
      p_origen: "nombre",
      p_confianza: 1,
      p_motivos: [],
      p_componentes: [],
      p_aprender: null,
      p_evento: {},
    });
    expect(directo.error).not.toBeNull();
    expect(await leer(id)).toEqual(antes);
  });

  it("no se confirma una reserva que ya no está para revisión, ni una que cambió mientras tanto", async () => {
    const nombre = nombreUnico("Recibida");
    const id = await reserva(true, nombre);
    ok(await confirmarProducto(equipo, { reservaId: id, productoId: ids.get("OD031")! }));
    expect(await confirmarProducto(equipo, { reservaId: id, productoId: ids.get("OD030")! })).toEqual({ ok: false, error: T.error(T.motivos.noEnRevision) });

    // La base controla que la reserva siga como la leyó la pantalla (otros motivos = otra versión).
    const otra = await reserva(true, nombreUnico("Cambio"));
    const directo = await equipo.rpc("confirmar_producto_reserva", {
      p_reserva: otra,
      p_motivos_antes: ["otro motivo"],
      p_producto: ids.get("OD031"),
      p_origen: "nombre",
      p_confianza: 1,
      p_motivos: [],
      p_componentes: [],
      p_aprender: null,
      p_evento: {},
    });
    expect(directo.error?.code).toBe("HT409");
    expect((await leer(otra)).estado).toBe("para_revision");
  });
});
