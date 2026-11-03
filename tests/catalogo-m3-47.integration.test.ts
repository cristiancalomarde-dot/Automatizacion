// @vitest-environment node
//
// Spec M3-47 — verificación 2 (regla #5), contra la BASE DE PRUEBAS (nunca la
// real: credencialesSupabaseDisponibles frena si apunta a producción) y los
// archivos reales de `Insumos/` y `data/`. Corre lo mismo que la carga de la
// ficha §4, en ese orden y por lista: directorio → equivalencias → paquetes de
// BR18 → BR18 → códigos Kilroy, dos veces. Después una reserva de ejemplo con
// las fechas de DK1587388 (fila 8).
//
// Lo cargado queda (es la carga, idempotente); solo se borran las filas de
// `importacion` de estas corridas y la reserva de ejemplo.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { correrCargaPaquetes } from "@/lib/importador-productos/carga-paquetes";
import { cargarEquivalencias } from "@/lib/importador-productos/equivalencias";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { parsearRenglonesAgregados } from "@/lib/importador-productos/renglones-agregados";
import { parsearProveedoresBorrados } from "@/lib/importador-proveedores/cambios";
import { importarProveedores } from "@/lib/importador-proveedores/importar";
import { BEER_HOSTEL, renombrarProveedor } from "@/lib/importador-proveedores/renombrar";
import { importarToursCompuestos, type ResumenImportacionTours } from "@/lib/importador-tours/importar";
import { hayInsumosTours, leerInsumosTours } from "@/lib/importador-tours/insumos";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { importarCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { fichaDePrueba } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const RAIZ = resolve(__dirname, "..");
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");
const RUTA_PROVEEDORES = resolve(RAIZ, "Insumos/Proveedores Hi Travel 2026 para IA.xlsx");
const CORRE = credencialesSupabaseDisponibles() && existsSync(RUTA_PAQUETES) && existsSync(RUTA_PROVEEDORES) && hayInsumosTours(RAIZ);

type ResultadoCarga = Awaited<ReturnType<typeof correrCargaPaquetes>>;

const CODIGOS = ["ODBR15", "COMPBR12", "COMPBR04"];
const PREFIJO = "[test M3-47]";
const NUMERO = `DK9347${String(Date.now()).slice(-3)}/test`;
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-47.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-11-02T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

/** Las fechas y la habitación de DK1587388, con pasajeros y número de prueba. */
function ficha(): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: NUMERO, limpio: NUMERO.split("/")[0], confianza: 1 };
  f.productos = [
    { ...f.productos[0], nombre: "Salvador and Chapada Diamantina Eco Adventure", codigo: "HI_TRAVEL_BR18-677", fecha_inicio: "2027-01-28", fecha_fin: "2027-02-04", habitacion: "Dormitory - Hostel" },
  ];
  f.fecha_inicio = { valor: "2027-01-28", confianza: 1 };
  f.fecha_fin = { valor: "2027-02-04", confianza: 1 };
  f.vuelos = [];
  return f;
}

(CORRE ? describe : describe.skip)("M3-47 — BR18 en la base de pruebas", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let soltarBloqueo: () => void;
  const importaciones: string[] = [];
  let primera: ResultadoCarga;
  let segunda: ResultadoCarga;
  let primerTour: ResumenImportacionTours;
  let segundoTour: ResumenImportacionTours;

  async function cargarTodo() {
    await cargarEquivalencias({ admin, textoCsv: dato("equivalencias-proveedores.csv") });
    const carga = await correrCargaPaquetes({
      admin,
      rutaPaquetes: RUTA_PAQUETES,
      rutaCodigosTourRadar: null,
      interpretarIA: null,
      nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
      paquetes: parsearPaquetesPiloto(dato("paquetes-piloto.csv")),
      renglonesAgregados: parsearRenglonesAgregados(dato("renglones-agregados.csv")),
      nochesServicio: null,
      aPedido: null,
      codigos: CODIGOS,
      enSeco: false,
    });
    importaciones.push(carga.resumen.importacionId);
    const tour = await importarToursCompuestos({ admin, ...leerInsumosTours(RAIZ), tours: ["BR18"] });
    importaciones.push(tour.importacionId);
    await importarCodigosKilroy(admin, dato("codigos-kilroy.csv"));
    return { carga, tour };
  }

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const prov = await importarProveedores({
      admin,
      rutaArchivo: RUTA_PROVEEDORES,
      consultarIA: null,
      borrados: parsearProveedoresBorrados(dato("proveedores-borrados.csv")),
    });
    importaciones.push(prov.importacionId);
    await renombrarProveedor(admin, BEER_HOSTEL, { aplicar: true });
    ({ carga: primera, tour: primerTour } = await cargarTodo());
    ({ carga: segunda, tour: segundoTour } = await cargarTodo());
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
      if (importaciones.length) await admin.from("importacion").delete().in("id", importaciones);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  it("la carga por lista toca solo esos paquetes, sin pedir IA, y una segunda corrida no agrega filas", () => {
    expect(primera.resumen.productos.map((p) => p.codigo).sort()).toEqual([...CODIGOS].sort());
    expect(primera.resumen.bloquesQueNecesitanIA).toEqual([]);
    expect(segunda.resumen.creados).toMatchObject({ productos: 0, servicios: 0, codigos: 0 });
    expect(segunda.resumen.servicios).toMatchObject({ creados: 0, eliminados: 0 });
    expect(segunda.resumen.nombresSinResolver).toEqual([]);
    expect(segunda.resumen.proveedoresParaRevisar).toEqual([]);
    expect(segundoTour.creados).toEqual({ productos: 0, componentes: 0, servicios: 0, codigos: 0, ajustes: 0 });
    expect(segundoTour.eliminados).toEqual({ componentes: 0, servicios: 0, ajustes: 0 });
  });

  it("COMPBR12: sus dos alojamientos con nivel y el traslado de salida de Bahia Transfers, cada uno con contacto", async () => {
    const { data, error } = await admin
      .from("producto")
      .select("destino, servicios:producto_servicio(orden, prioridad, tipo_servicio, nivel, sentido, service_provider_nombre, bs:booking_supplier_id(nombre, mails, canal))")
      .eq("codigo", "COMPBR12")
      .single();
    if (error) throw new Error(error.message);
    const p = data as unknown as {
      destino: string;
      servicios: Array<{ orden: number; prioridad: number; tipo_servicio: string; nivel: string | null; sentido: string | null; service_provider_nombre: string; bs: { nombre: string; mails: string[]; canal: string | null } | null }>;
    };
    expect(p.destino).toBe("SSA");
    const lineas = [...p.servicios]
      .sort((a, b) => a.orden - b.orden || a.prioridad - b.prioridad)
      .map((s) => [s.tipo_servicio, s.nivel, s.sentido, s.service_provider_nombre, s.bs?.nombre.split(" (")[0], s.bs?.mails]);
    expect(lineas).toEqual([
      ["alojamiento", "Hostel", null, "Hostel Laranjeiras", "Laranjeiras Hostel", ["hi@laranjeirashostel.com.br"]],
      ["alojamiento", "Hotel 3*", null, "Pousada do Pilar", "Pousada do Pilar", ["info@pousadadopilar.com.br"]],
      ["alojamiento", "Hotel 3*", null, "Bahiacafe", "Bahiacafe", ["info@bahiacafehotel.com"]],
      ["traslado", null, "salida", "accommodation - SSA Airport", "Bahia Transfers", ["contatobahiatransfer@gmail.com"]],
    ]);
  });

  it("BR18 armado: 7 noches, días 1, 4, 4, 7, 7 y los buses a mano con Plataforma10", () => {
    const t = primerTour.tours.find((x) => x.codigo === "BR18")!;
    expect(t.estado, t.motivos.join(" | ")).toBe("armado");
    expect(t.noches).toBe(7);
    expect(t.componentes.map((c) => `${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}`)).toEqual([
      "ODBR15 d1 3n IN",
      "COMPBR04 d4 3n",
      "COMPBR12 d7 1n OUT",
    ]);
    expect(t.serviciosPropios.map((s) => [s.sentido, s.diaDesde, s.reservaManual, s.sinResolver])).toEqual([
      ["Salvador – Lençóis", 4, true, false],
      ["Lençóis – Salvador", 7, true, false],
    ]);
    // De los dos traslados, el de ODBR15 queda solo de llegada; el de COMPBR12 se pide entero.
    expect(t.ajustes.map((a) => [a.paquete, a.accion])).toEqual([["ODBR15", "solo_llegada"]]);
    expect(t.categoriasFaltantes).toEqual([]);
  });

  describe("fila 8 — una reserva de ejemplo con las fechas de DK1587388", () => {
    let reservaId: string;

    beforeAll(async () => {
      const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
      const deps = await cargarDependenciasReservas(admin);
      const [c] = await crearReservasDelMail(ficha(), { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
      reservaId = c.reserva.id;
      const { data, error } = await admin.from("reserva").select("estado, motivos_revision, producto:producto_id(codigo)").eq("id", reservaId).single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { estado: string; motivos_revision: string[] | null; producto: { codigo: string } | null };
      expect([fila.producto?.codigo, fila.estado, fila.motivos_revision ?? []]).toEqual(["BR18", "recibida", []]);
      const r = await armarYGuardarPedidos(admin, reservaId);
      if (!r.ok) throw new Error(r.error);
    }, 180_000);

    // Owner (2026-11-03): un solo mail, como dice el diseño (M3-01 #1: un borrador por casilla).
    it("Hostel Laranjeiras: un solo mail con las dos estadías (28/01 al 31/01 y 03/02 al 04/02), sin juntarlas en 7 noches y sin desayuno en ninguna", async () => {
      const { pedidos } = await cargarPedidos(admin, reservaId);
      const laranjeiras = pedidos.filter((p) => p.destinatarios.includes("hi@laranjeirashostel.com.br"));
      expect(laranjeiras).toHaveLength(1);
      const { cuerpo } = laranjeiras[0];
      expect([...cuerpo.matchAll(/IN: [^\n]+\nOUT: [^\n]+/g)].map((m) => m[0])).toEqual([
        "IN: 28 jan 2027\nOUT: 31 jan 2027 (3 noites)",
        "IN: 3 fev 2027\nOUT: 4 fev 2027 (1 noite)",
      ]);
      expect(cuerpo.match(/^Quarto: .*$/gm)).toEqual(["Quarto: quarto compartilhado (dorm)", "Quarto: quarto compartilhado (dorm)"]);
      expect(cuerpo).not.toMatch(/caf[eé] da manh|desayuno/i);
    });

    it("HI Hostel Chapada tampoco dice desayuno", async () => {
      const { pedidos } = await cargarPedidos(admin, reservaId);
      const chapada = pedidos.find((p) => p.destinatarios.includes("alberguechapada@hotmail.com"))!;
      expect(chapada.cuerpo).toContain("Quarto: quarto compartilhado (dorm)\n");
      expect(chapada.cuerpo).not.toMatch(/caf[eé] da manh|desayuno/i);
    });

    it("los buses dan tareas 'Emitir pasaje', sin pedido", async () => {
      const { pedidos, tareas } = await cargarPedidos(admin, reservaId);
      expect(tareas.filter((t) => t.tipo === "emitir_boleto").map((t) => t.texto)).toEqual([
        "Emitir pasaje: Bus Salvador – Lençóis, 31 ene 2027",
        "Emitir pasaje: Bus Lençóis – Salvador, 3 feb 2027",
      ]);
      expect(pedidos.some((p) => /plataforma10/i.test(`${p.proveedores.join(" ")} ${p.cuerpo}`))).toBe(false);
    });

    it("el recorrido de la ficha §1, proveedor por proveedor, todos con a quién pedírselo", async () => {
      const { pedidos, tareas } = await cargarPedidos(admin, reservaId);
      expect(pedidos.filter((p) => p.sin_destinatario).map((p) => `${p.proveedores.join(",")}: ${p.sin_destinatario}`)).toEqual([]);
      const de = (nombre: RegExp) => pedidos.filter((p) => p.proveedores.some((n) => nombre.test(n)));
      const [bahia] = de(/^Bahia Transfers/);
      expect(bahia.destinatarios).toEqual(["contatobahiatransfer@gmail.com"]);
      // Sin las filas "Pousada" del Excel, Bahia Transfers es de Salvador: su mail va en portugués.
      expect(bahia.cuerpo).toContain("Escrevemos da HI Travel");
      expect(bahia.cuerpo).toMatch(/Aeropuerto Salvador - Hostel Laranjeiras\n[^\n]*28 jan 2027/);
      expect(bahia.cuerpo).toMatch(/Hostel Laranjeiras - SSA Airport\n[^\n]*4 fev 2027/);
      expect(de(/^HI Hostel Chapada/)[0].cuerpo).toContain("IN: 31 jan 2027\nOUT: 3 fev 2027 (3 noites)");
      // Cassi y Chapada Backpackers se piden solo por WhatsApp (directorio): son tareas, con su día.
      expect(tareas.filter((t) => t.tipo === "whatsapp").map((t) => t.texto)).toEqual([
        expect.stringMatching(/^Contactar por WhatsApp a Cassi Turismo .*Praia do Forte full day, 30 ene 2027/),
        expect.stringMatching(/^Contactar por WhatsApp a Chapada Backpackers \(Tour .*Full Day Chapada 4 Ps, 1 feb 2027/),
      ]);
    });
  });
});

