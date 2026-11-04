// @vitest-environment node
//
// Spec M3-48 — verificación 2 (regla #5), contra la BASE DE PRUEBAS (nunca la
// real: credencialesSupabaseDisponibles frena si apunta a producción) y los
// archivos reales de `Insumos/` y `data/`. Corre lo mismo que la carga de la
// ficha §5, en ese orden y por lista: directorio → equivalencias → COMPBR02 y
// COMPBR11 → BR03 y BR04 → códigos Kilroy, dos veces. OD010B, COMPBR10 y OD032
// ya están en la base, como en la real. Después una reserva de ejemplo con las
// fechas de la BR04 real (fila 10).
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
import { clienteEnSeco } from "@/lib/importador-productos/solo-lectura";
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

const CODIGOS = ["COMPBR02", "COMPBR11"];
const PREFIJO = "[test M3-48]";
const NUMERO = `DK9348${String(Date.now()).slice(-3)}/test`;
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-48.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-11-03T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

/** Las fechas y la habitación de la BR04 real, con pasajeros y número de prueba. */
function ficha(): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: NUMERO, limpio: NUMERO.split("/")[0], confianza: 1 };
  f.productos = [
    { ...f.productos[0], nombre: "Iguazu Falls to Rio + Paraty and Ilha Grande", codigo: "HI_TRAVEL_BR04-677", fecha_inicio: "2027-05-26", fecha_fin: "2027-06-09", habitacion: "Dormitory - Hostel" },
  ];
  f.fecha_inicio = { valor: "2027-05-26", confianza: 1 };
  f.fecha_fin = { valor: "2027-06-09", confianza: 1 };
  f.vuelos = [];
  return f;
}

(CORRE ? describe : describe.skip)("M3-48 — BR03 y BR04 en la base de pruebas", { timeout: 300_000 }, () => {
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
    const tour = await importarToursCompuestos({ admin, ...leerInsumosTours(RAIZ), tours: ["BR03", "BR04"] });
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

  it("la carga por lista toca solo esos paquetes, sin pedir IA y sin proveedores sin resolver, y una segunda corrida no agrega filas", () => {
    expect(primera.resumen.productos.map((p) => p.codigo).sort()).toEqual([...CODIGOS].sort());
    expect(primera.resumen.bloquesQueNecesitanIA).toEqual([]);
    expect(segunda.resumen.creados).toMatchObject({ productos: 0, servicios: 0, codigos: 0 });
    expect(segunda.resumen.servicios).toMatchObject({ creados: 0, eliminados: 0 });
    expect(segunda.resumen.nombresSinResolver).toEqual([]);
    expect(segunda.resumen.proveedoresParaRevisar).toEqual([]);
    expect(segundoTour.creados).toEqual({ productos: 0, componentes: 0, servicios: 0, codigos: 0, ajustes: 0 });
    expect(segundoTour.eliminados).toEqual({ componentes: 0, servicios: 0, ajustes: 0 });
  });

  it("COMPBR02 y COMPBR11: cada alternativa con su proveedor o a mano, en el orden del Excel", async () => {
    const lineas = async (codigo: string) => {
      const { data, error } = await admin
        .from("producto")
        .select("destino, servicios:producto_servicio(orden, prioridad, tipo_servicio, nivel, service_provider_nombre, reserva_manual, proveedor_sin_resolver, bs:booking_supplier_id(nombre, mails, canal))")
        .eq("codigo", codigo)
        .single();
      if (error) throw new Error(error.message);
      const p = data as unknown as {
        destino: string;
        servicios: Array<{ orden: number; prioridad: number; tipo_servicio: string; nivel: string | null; service_provider_nombre: string; reserva_manual: boolean; proveedor_sin_resolver: boolean; bs: { nombre: string; mails: string[]; canal: string | null } | null }>;
      };
      expect(p.servicios.filter((s) => s.proveedor_sin_resolver).map((s) => s.service_provider_nombre)).toEqual([]);
      return [...p.servicios]
        .sort((a, b) => a.orden - b.orden || a.prioridad - b.prioridad)
        .map((s) => [s.tipo_servicio, s.nivel, s.service_provider_nombre, s.reserva_manual ? "a mano" : s.bs?.nombre.split(" (")[0], s.bs?.mails ?? [], s.bs?.canal ?? null]);
    };
    expect(await lineas("COMPBR02")).toEqual([
      ["alojamiento", "Hostel", "Che Lagarto", "a mano", [], null],
      ["alojamiento", "Hostel", "Casa do Rio", "Casa do Rio", ["casadoriohostel@gmail.com"], "mail"],
      ["alojamiento", "Hostel", "Agatha", "Hostel Agatha", [], "whatsapp"],
      ["alojamiento", "Hostel", "Casa Viva", "Casa Viva", [], "whatsapp"],
      ["alojamiento", "Hotel 3*", "Pousada do Corsario Paraty", "Pousada Corsario", ["reservasparaty@pousadacorsario.com.br"], "mail"],
      ["traslado", null, "Rio de Janeiro - Paraty - Ilha Grande", "PARATY TOURS", ["reservas@paratytours.com.br"], "mail"],
      ["excursion", null, "Scuna Netuno 10.30 hs Islas paradisiacas", "PARATY TOURS", ["reservas@paratytours.com.br"], "mail"],
    ]);
    expect(await lineas("COMPBR11")).toEqual([
      ["alojamiento", "Hostel", "Holandes Hostel", "Holandes Hostel", ["reservas@holandeshostel.com.br"], "mail"],
      ["alojamiento", "Hostel", "Che Lagarto Ilha Grande", "a mano", [], null],
      ["alojamiento", "Hotel 3*", "Pousada Aquarela do Mar", "Pousada Aquarela do Mar", ["reservas@aquareladomar.com"], "mail"],
      ["alojamiento", "Hotel 3*", "Pousada Rubi", "Pousada rubi", ["rubipousada.ig@gmail.com"], "mail"],
    ]);
  });

  it("BR03 y BR04 armados: noches, días, tramos y ajustes de la ficha", () => {
    const de = (codigo: string) => {
      const t = primerTour.tours.find((x) => x.codigo === codigo)!;
      expect(t.estado, t.motivos.join(" | ")).toBe("armado");
      expect(t.categoriasFaltantes).toEqual([]);
      return t;
    };
    const recorrido = (t: ReturnType<typeof de>) =>
      t.componentes.map((c) => (c.tipo === "paquete" ? `${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}` : `${c.descripcionRuta} d${c.diaDesde}${c.nocturno ? " nocturno" : ""}`));
    const propios = (t: ReturnType<typeof de>) => t.serviciosPropios.map((s) => [s.sentido, s.diaDesde, s.reservaManual, s.sinResolver]);
    const br03 = de("BR03");
    expect(br03.noches).toBe(8);
    expect(recorrido(br03)).toEqual(["OD032 d1 3n IN", "COMPBR02 d4 2n", "COMPBR11 d6 3n OUT"]);
    expect(propios(br03)).toEqual([
      ["Río de Janeiro – Paraty", 4, false, false],
      ["Paraty – Ilha Grande", 6, false, false],
      ["Ilha Grande – Río de Janeiro", 9, false, false],
    ]);
    expect(br03.ajustes.map((a) => [a.paquete, a.accion])).toEqual([["COMPBR02", "anular"]]);
    const br04 = de("BR04");
    expect(br04.noches).toBe(14);
    expect(recorrido(br04)).toEqual([
      "OD010B d1 3n IN OUT",
      "COMPBR10 d5 2n",
      "COMPBR02 d7 2n",
      "COMPBR11 d9 3n",
      "OD032 d12 3n OUT",
    ]);
    expect(propios(br04)).toEqual([
      ["Iguazú – São Paulo", 4, true, false],
      ["São Paulo – Paraty", 7, true, false],
      ["Paraty – Ilha Grande", 9, false, false],
      ["Ilha Grande – Río de Janeiro", 12, false, false],
    ]);
    expect(br04.ajustes.map((a) => [a.paquete, a.accion])).toEqual([
      ["OD010B", "reemplazar"],
      ["COMPBR02", "anular"],
      ["OD032", "invertir"],
    ]);
  });

  it("en seco, antes de cargar los paquetes: los dos tours quedan para revisar y la corrida no corta por sus excepciones de traslados", async () => {
    const insumos = leerInsumosTours(RAIZ);
    const seco = clienteEnSeco(admin);
    const r = await importarToursCompuestos({
      admin: seco.cliente,
      ...insumos,
      paquetesPiloto: insumos.paquetesPiloto.filter((p) => !CODIGOS.includes(p.codigo)),
      tours: ["BR03", "BR04"],
    });
    expect(r.tours.map((t) => [t.codigo, t.estado])).toEqual([
      ["BR03", "para_revisar"],
      ["BR04", "para_revisar"],
    ]);
    expect(r.tours[0].motivos.join(" | ")).toContain("falta el paquete COMPBR02");
    expect(seco.escrituras.filter((e) => e.tabla !== "importacion")).toEqual([]);
  });

  describe("fila 10 — una reserva de ejemplo con las fechas de la BR04 real", () => {
    let reservaId: string;

    beforeAll(async () => {
      const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
      const deps = await cargarDependenciasReservas(admin);
      const [c] = await crearReservasDelMail(ficha(), { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
      reservaId = c.reserva.id;
      const { data, error } = await admin.from("reserva").select("estado, motivos_revision, producto:producto_id(codigo)").eq("id", reservaId).single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { estado: string; motivos_revision: string[] | null; producto: { codigo: string } | null };
      expect([fila.producto?.codigo, fila.estado, fila.motivos_revision ?? []]).toEqual(["BR04", "recibida", []]);
      const r = await armarYGuardarPedidos(admin, reservaId);
      if (!r.ok) throw new Error(r.error);
    }, 180_000);

    it("Paraty: Che Lagarto queda como tarea con sus fechas, y ningún pedido a una casilla vacía", async () => {
      const { pedidos, tareas } = await cargarPedidos(admin, reservaId);
      expect(pedidos.filter((p) => p.sin_destinatario).map((p) => p.proveedores.join())).toEqual([]);
      expect(pedidos.some((p) => /lagarto/i.test(p.proveedores.join(" ")))).toBe(false);
      expect(tareas.filter((x) => x.tipo === "reservar_a_mano").map((x) => x.texto)).toEqual(["Reservar a mano en Che Lagarto: Che Lagarto (dorm compartido), IN 1 jun 2027, OUT 3 jun 2027. Si no hay lugar: Casa do Rio, Casa Viva, Agatha"]);
    });

    it("Ilha Grande: Holandes recibe el mail en portugués, con desayuno y sus 3 noches", async () => {
      const { pedidos } = await cargarPedidos(admin, reservaId);
      const holandes = pedidos.filter((p) => p.destinatarios.includes("reservas@holandeshostel.com.br"));
      expect(holandes).toHaveLength(1);
      expect(holandes[0].cuerpo).toContain("Escrevemos da HI Travel");
      expect(holandes[0].cuerpo).toContain("IN: 3 jun 2027\nOUT: 6 jun 2027 (3 noites)");
      expect(holandes[0].cuerpo).toContain("Quarto: quarto compartilhado (dorm), com café da manhã");
    });

    it("Paraty Tours: un solo mail con el Scuna y los dos traslados, cada uno con su fecha; el transfer de COMPBR02 no se duplica", async () => {
      const { pedidos } = await cargarPedidos(admin, reservaId);
      const paraty = pedidos.filter((p) => p.destinatarios.includes("reservas@paratytours.com.br"));
      expect(paraty).toHaveLength(1);
      const { cuerpo } = paraty[0];
      expect(cuerpo).toMatch(/Scuna Netuno[^\n]*\nData: 2 jun 2027/);
      expect(cuerpo).toContain("Transfer: Paraty – Ilha Grande\nData: 3 jun 2027");
      expect(cuerpo).toContain("Transfer: Ilha Grande – Rio de Janeiro\nData: 6 jun 2027");
      expect(cuerpo.match(/Transfer: /g)).toHaveLength(2);
      expect(cuerpo).not.toMatch(/Ônibus|Rio de Janeiro - Paraty|Río/);
      // Scuna: punto de encuentro en el puerto, sin pick up y sin preguntar el horario.
      expect(cuerpo).toContain("Ponto de encontro: Porto de Paraty (o passageiro vai direto)");
      expect(cuerpo).not.toMatch(/pick up|hor[aá]rio/i);
    });

    it("los dos buses dan tareas 'Emitir pasaje', sin pedido", async () => {
      const { tareas } = await cargarPedidos(admin, reservaId);
      expect(tareas.filter((x) => x.tipo === "emitir_boleto").map((x) => x.texto)).toEqual([
        "Emitir pasaje: Bus Foz do Iguaçu – São Paulo Barra Funda, en Plataforma10, 29 may 2027",
        "Emitir pasaje: Bus São Paulo Tietê – Paraty, en Plataforma10, 1 jun 2027",
      ]);
    });

    it("fechas y noches en cada destino", async () => {
      const { pedidos, tareas } = await cargarPedidos(admin, reservaId);
      const estadia = (mail: string) => pedidos.find((p) => p.destinatarios.includes(mail))!.cuerpo.match(/IN: [^\n]+\nOUT: [^\n]+/)![0];
      expect(estadia("hostelsbambu@gmail.com")).toBe("IN: 26 mai 2027\nOUT: 29 mai 2027 (3 noites)");
      expect(estadia("perez@local55.com")).toBe("IN: 6 jun 2027\nOUT: 9 jun 2027 (3 noites)");
      expect(tareas.filter((x) => x.tipo === "whatsapp").map((x) => x.texto)).toEqual([expect.stringMatching(/Fujima Hostel .*IN 30 may 2027, OUT 1 jun 2027/)]);
      const out = pedidos.find((p) => p.destinatarios.includes("buziostransfer@hotmail.com"))!.cuerpo;
      expect(out).toContain("Transfer de saída: Transfer Cabanacopa Hostel - Aeropuerto GIG\nData: 9 jun 2027");
      const foz = pedidos.find((p) => p.destinatarios.includes("reservas8@cuencadelplata.com"))!.cuerpo;
      expect(foz).toMatch(/TRF OUT: 29 may 2027 · Rodoviaria de Foz \(bus a São Paulo Barra Funda\) · Pick up: /);
      expect(foz).not.toMatch(/TRF OUT:[^\n]*pendiente/);
    });
  });
});
