// @vitest-environment node
//
// Spec M3-25 — verificación 2 (regla #5), contra la BASE DE PRUEBAS (nunca la
// real: credencialesSupabaseDisponibles frena si apunta a producción) y los
// archivos reales de `data/` e `Insumos/`.
//
// - Fila 5: con Greeters marcado `manual` en BUE (data/equivalencias-proveedores.csv),
//   la carga de equivalencias y de los paquetes OD018 y OD020 (sin IA) deja su
//   traslado a mano, sin proveedor; lo demás de esos paquetes no cambia. Dos
//   corridas: la segunda no cambia nada.
// - Filas 1-4: AR10 (ya cargado, M3-23) leído de la base, con las partes que le
//   pone una reserva del 19 dic 2026 (componentesDeLaReserva) y las reglas de
//   data/ (tramos-se-piden-a.csv con Chalten Travel buscado en el directorio):
//   La Ciénaga solo el in, Rumbo Sur solo el out, el Beagle sin pick up y los
//   buses de El Chaltén en el mail a Chalten Travel.
//
// Lo cargado queda (es la carga, idempotente); solo se borran las filas de
// `importacion` de estas corridas. No crea reservas (eso es el recorrido).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TIPO_CORRIDA_PAQUETES } from "@/lib/importador-productos/carga-paquetes";
import { cargarEquivalencias } from "@/lib/importador-productos/equivalencias";
import { importarProductosSimples, type ResumenImportacionProductos } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { parsearRenglonesAgregados } from "@/lib/importador-productos/renglones-agregados";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { armarPedidos } from "@/lib/pedidos/armar";
import { cargarBusesElChalten, cargarCatalogoParaPedidos, cargarDiasServicio, cargarPuntosDeEncuentro, cargarTramosSePidenA } from "@/lib/pedidos/cargar";
import { cargarPlantilla } from "@/lib/pedidos/plantilla";
import type { ParteParaPedidos, ReservaParaPedidos, ResultadoArmado } from "@/lib/pedidos/tipos";
import { componentesDeLaReserva } from "@/lib/reservas/emparejar/componentes";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");
const RUTA_CODIGOS_TR = resolve(RAIZ, "Insumos/Codigos Productos Tourradar.xlsx");
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const CORRE = credencialesSupabaseDisponibles() && existsSync(RUTA_PAQUETES);
const GREETERS = ["OD018", "OD020"];

interface Fila {
  orden: number;
  prioridad: number;
  tipo_servicio: string;
  descripcion: string;
  booking_supplier_nombre: string | null;
  reserva_manual: boolean;
  bs: { nombre: string } | null;
}

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

/** Un servicio del pedido (sin la numeración "1) "), desde su primer renglón hasta la línea en blanco. */
function bloque(cuerpo: string, primerRenglon: string): string[] {
  const l = cuerpo.split("\n").map((x) => x.replace(/^\d+\) /, ""));
  const i = l.indexOf(primerRenglon);
  if (i < 0) throw new Error(`No está "${primerRenglon}" en:\n${cuerpo}`);
  const fin = l.indexOf("", i);
  return l.slice(i, fin < 0 ? undefined : fin);
}

(CORRE ? describe : describe.skip)("M3-25 — correcciones de AR10 y Greeters a mano, en la base de pruebas", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  const importaciones: string[] = [];
  const antes = new Map<string, Fila[]>();
  let primera: ResumenImportacionProductos;
  let segunda: ResumenImportacionProductos;

  async function servicios(codigo: string): Promise<Fila[]> {
    const { data: p, error: e1 } = await admin.from("producto").select("id").eq("codigo", codigo).single();
    if (e1) throw new Error(`${codigo}: ${e1.message}`);
    const { data, error } = await admin
      .from("producto_servicio")
      .select("orden, prioridad, tipo_servicio, descripcion, booking_supplier_nombre, reserva_manual, bs:booking_supplier_id(nombre)")
      .eq("producto_id", p!.id)
      .order("orden")
      .order("prioridad");
    if (error) throw new Error(error.message);
    return data as unknown as Fila[];
  }
  const esGreeters = (s: Fila) => s.booking_supplier_nombre?.toLowerCase() === "greeters";

  async function cargar() {
    await cargarEquivalencias({ admin, textoCsv: dato("equivalencias-proveedores.csv") });
    const r = await importarProductosSimples({
      admin,
      rutaPaquetes: RUTA_PAQUETES,
      rutaCodigosTourRadar: existsSync(RUTA_CODIGOS_TR) ? RUTA_CODIGOS_TR : null,
      interpretarIA: null,
      nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
      paquetes: parsearPaquetesPiloto(dato("paquetes-piloto.csv")).filter((p) => GREETERS.includes(p.codigo)),
      tipoCorrida: TIPO_CORRIDA_PAQUETES,
      renglonesAgregados: parsearRenglonesAgregados(dato("renglones-agregados.csv")),
    });
    importaciones.push(r.importacionId);
    return r;
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    for (const c of GREETERS) antes.set(c, await servicios(c));
    primera = await cargar();
    segunda = await cargar();
  }, 300_000);

  afterAll(async () => {
    if (importaciones.length) await admin.from("importacion").delete().in("id", importaciones);
  });

  it("fila 5: el traslado de Greeters de OD018 y OD020 queda a mano, sin proveedor", async () => {
    for (const c of GREETERS) {
      const greeters = (await servicios(c)).filter(esGreeters);
      expect(greeters.map((s) => [s.tipo_servicio, s.reserva_manual, s.bs]), c).toEqual([["traslado", true, null]]);
    }
  });

  it("fila 6: lo demás de OD018 y OD020 no cambia", async () => {
    const sinGreeters = (filas: Fila[]) => filas.filter((s) => !esGreeters(s)).map((s) => JSON.stringify(s));
    for (const c of GREETERS) expect(sinGreeters(await servicios(c)), c).toEqual(sinGreeters(antes.get(c)!));
  });

  it("la segunda corrida no crea, cambia ni borra nada", () => {
    expect(primera.codigosNoEncontrados).toEqual([]);
    expect(segunda.creados).toEqual({ productos: 0, servicios: 0, codigos: 0 });
    expect(segunda.servicios).toMatchObject({ creados: 0, actualizados: 0, eliminados: 0 });
  });

  it("fila 5: un OD018 suelto no le escribe a Greeters; el traslado queda en la lista manual", async () => {
    const { data: p } = await admin.from("producto").select("id").eq("codigo", "OD018").single();
    const r = await armarDesdeLaBase({ productoId: p!.id, fechaInicio: "2027-02-01", fechaFin: "2027-02-04", partes: [] });
    expect(r.pedidos.flatMap((x) => x.destinatarios).filter((m) => /greeters/i.test(m))).toEqual([]);
    expect(r.tareas.filter((t) => /Greeters/.test(t.texto)).map((t) => `${t.tipo}: ${t.texto}`)).toEqual([
      "reservar_a_mano: Reservar a mano en Greeters: traslado de llegada Transfer EZE o AEP - Hotel - EZE o AEP, 1 feb 2027 · Vuelo pendiente",
      "reservar_a_mano: Reservar a mano en Greeters: traslado de salida Transfer EZE o AEP - Hotel - EZE o AEP, 4 feb 2027 · Vuelo pendiente",
    ]);
  });

  async function armarDesdeLaBase(parcial: Partial<ReservaParaPedidos>) {
    const reserva: ReservaParaPedidos = {
      id: "m3-25",
      estado: "recibida",
      agencia: "TourRadar",
      numero: null,
      productoId: null,
      otrosProductos: [],
      fechaInicio: null,
      fechaFin: null,
      pax: 2,
      pasajeros: [
        { nombre: "Ana", apellido: "Prueba", nacionalidad: "Australia", fecha_nacimiento: "1990-05-17" },
        { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Australia", fecha_nacimiento: "1991-02-03" },
      ],
      vuelos: [],
      habitacion: "Double Hostel",
      pedidosEspeciales: null,
      hotelesAgencia: [],
      sinTrasladoDe: null,
      partes: [],
      ...parcial,
    };
    const dias = cargarDiasServicio(RAIZ);
    const catalogo = await cargarCatalogoParaPedidos(
      admin,
      reserva,
      dias,
      [],
      [],
      [],
      [],
      [],
      cargarPuntosDeEncuentro(RAIZ),
      cargarBusesElChalten(RAIZ),
      [],
      cargarTramosSePidenA(RAIZ),
    );
    return ok(armarPedidos(reserva, catalogo, cargarPlantilla()));
  }

  describe("AR10 como la #1389186 (Double Hostel, 19 dic 2026), con el catálogo de la base", () => {
    let r: Awaited<ReturnType<typeof armarDesdeLaBase>>;
    const cuerpoDe = (mail: string) => r.pedidos.find((p) => p.destinatarios.includes(mail))?.cuerpo ?? "";

    beforeAll(async () => {
      const { data: p } = await admin.from("producto").select("id").eq("codigo", "AR10").single();
      const ar10 = await cargarProducto(admin, p!.id);
      const partes: ParteParaPedidos[] = componentesDeLaReserva(ar10, "2026-12-19", { finalPuertoNatales: false, proveedorTransferPNT: null }).map((c, i) => ({
        id: `parte-${i + 1}`,
        orden: i + 1,
        tipo: c.tipo,
        productoId: c.productoId ?? null,
        productoComponenteId: c.productoComponenteId ?? null,
        descripcionRuta: c.descripcionRuta ?? null,
        textoAgencia: null,
        fechaInicio: c.fechaInicio ?? null,
        fechaFin: c.fechaFin ?? null,
        esTarea: c.esTarea ?? false,
        productoServicioId: c.productoServicioId ?? null,
        proveedorId: c.proveedorId ?? null,
        pickUp: null,
      }));
      r = await armarDesdeLaBase({ productoId: ar10.id, fechaInicio: "2026-12-19", fechaFin: "2027-01-08", partes });
    }, 120_000);

    it("fila 1: La Ciénaga recibe solo el traslado de llegada", () => {
      const cuerpo = cuerpoDe("florencia@lacienagaturismo.com.ar");
      // M3-28 (owner, 2026-10-28): el traslado de un solo lado, con el nombre de la ciudad y guion.
      expect(bloque(cuerpo, "Traslado de llegada: Transfer in Aeropuerto Salta - Alojamiento")).toEqual([
        "Traslado de llegada: Transfer in Aeropuerto Salta - Alojamiento",
        "Fecha: 19 dic 2026",
        "Vuelo pendiente",
      ]);
      expect(cuerpo).not.toContain("Accommodation - SLA");
      expect(cuerpo).not.toContain("Traslado de salida");
    });

    it("filas 2 y 3: Rumbo Sur recibe solo el traslado de salida y el Beagle sin pick up", () => {
      const cuerpo = cuerpoDe("emiliao@rumbosur.com.ar");
      expect(bloque(cuerpo, "Traslado de salida: Transfer out Alojamiento en Ushuaia - Aeropuerto Ushuaia")).toEqual([
        "Traslado de salida: Transfer out Alojamiento en Ushuaia - Aeropuerto Ushuaia",
        "Fecha: 8 ene 2027",
        "Vuelo pendiente",
      ]);
      expect(cuerpo).not.toContain("Round Trip");
      expect(bloque(cuerpo, "Excursión: Beagle Channel Boat Trip, 3 hours, no transfer to port")).toEqual([
        "Excursión: Beagle Channel Boat Trip, 3 hours, no transfer to port",
        "Fecha: 7 ene 2027",
        "Servicio: regular · Idioma: inglés",
      ]);
      expect(cuerpo).toMatch(/Excursión: Tierra del Fuego[^\n]*\nFecha: 6 ene 2027\n[^\n]*\nPick up/);
    });

    it("fila 4: el mail a Chalten Travel (el del OD033) lleva los dos buses de El Chaltén, con fecha y horario", () => {
      const chalten = r.pedidos.filter((p) => p.destinatarios.includes("agencias@chaltentravel.com"));
      expect(chalten).toHaveLength(1);
      expect(bloque(chalten[0].cuerpo, "Bus: Bariloche – El Chaltén")).toEqual(["Bus: Bariloche – El Chaltén", "Fecha: 30 dic 2026 · Horario: 8:30 am (llega el 31 dic 2026)"]);
      expect(bloque(chalten[0].cuerpo, "Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station")).toEqual([
        "Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station",
        "Fecha: 2 ene 2027 · Horario: 8:00 am",
      ]);
      expect(r.tareas.map((t) => t.texto).filter((t) => t.startsWith("Emitir boleto"))).toEqual([
        "Emitir boleto: Salta – Mendoza, 23 dic 2026",
        "Emitir boleto: Mendoza – Bariloche, 26 dic 2026",
        "Emitir boleto: El Calafate – Río Gallegos, 5 ene 2027",
        "Emitir boleto: Río Gallegos – Ushuaia, 5 ene 2027",
      ]);
    });
  });
});
