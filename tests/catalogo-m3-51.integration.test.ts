// @vitest-environment node
//
// Spec M3-51 — verificación 2 (regla #5), contra la BASE DE PRUEBAS (nunca la
// real: credencialesSupabaseDisponibles frena si apunta a producción) y los
// archivos reales de `Insumos/` y `data/`. Corre lo mismo que la carga de la
// ficha §5, en ese orden y por lista: directorio → equivalencias → ODBR50,
// COMPBR06, COMPBR13 y COMPBR14 (y COMPBR02 y COMPBR11, que en la real ya están)
// → BR20 → códigos Kilroy, dos veces. OD010B y OD032 ya están en la base, como
// en la real. Después una reserva de ejemplo con las fechas de la BR20 real
// (DK1598967: 19/02 → 10/03/2027, 2 pax, "Double Room at Hostel and Jungle Lodge").
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
import { armarYGuardarPedidos, cargarPedidos, type PedidoGuardado, type TareaGuardada } from "@/lib/pedidos/guardar";
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

const NUEVOS = ["ODBR50", "COMPBR06", "COMPBR13", "COMPBR14"];
const CODIGOS = [...NUEVOS, "COMPBR02", "COMPBR11"];
const PREFIJO = "[test M3-51]";
const NUMERO = `DK9351${String(Date.now()).slice(-3)}/test`;
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

function mailDePrueba(): MailEntrada {
  return {
    origen: "archivo",
    archivoOrigen: `${PREFIJO} ${randomUUID()}.docx`,
    messageId: `<${randomUUID()}@test-m3-51.hitravel.local>`,
    remitente: "aarhus@kilroy.dk",
    asunto: `${PREFIJO} pedido sintético`,
    fechaMail: "2026-11-06T12:00:00.000Z",
    cuerpoTexto: "Mail sintético de prueba (sin datos de nadie).",
    agencia: "Kilroy",
    dePrueba: true,
  };
}

/** Las fechas, los pax y la habitación de la BR20 real, con pasajeros y número de prueba. */
function ficha(): FichaLectura {
  const f = fichaDePrueba("kilroy-arch31-no1569851");
  f.agencia = { valor: "Kilroy", confianza: 1 };
  f.numero_reserva = { valor: NUMERO, limpio: NUMERO.split("/")[0], confianza: 1 };
  f.productos = [
    {
      ...f.productos[0],
      nombre: "Pantanal and Beaches - Iguazu Falls to Rio Adventure - 19 nights",
      codigo: "HI_TRAVEL_BR20-677",
      fecha_inicio: "2027-02-19",
      fecha_fin: "2027-03-10",
      habitacion: "Double Room at Hostel and Jungle Lodge",
    },
  ];
  f.fecha_inicio = { valor: "2027-02-19", confianza: 1 };
  f.fecha_fin = { valor: "2027-03-10", confianza: 1 };
  f.pax = { valor: 2, confianza: 1 };
  f.pasajeros = f.pasajeros.slice(0, 2);
  f.vuelos = [];
  return f;
}

(CORRE ? describe : describe.skip)("M3-51 — BR20 en la base de pruebas", { timeout: 300_000 }, () => {
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
    const tour = await importarToursCompuestos({ admin, ...leerInsumosTours(RAIZ), tours: ["BR20"] });
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

  it("la carga por lista toca solo esos paquetes, sin pedir IA, y una segunda corrida no agrega filas; sin resolver solo O Hostel GRU (ya pendiente en COMPBR10)", () => {
    expect(primera.resumen.productos.map((p) => p.codigo).sort()).toEqual([...CODIGOS].sort());
    expect(primera.resumen.bloquesQueNecesitanIA).toEqual([]);
    expect(segunda.resumen.creados).toMatchObject({ productos: 0, servicios: 0, codigos: 0 });
    expect(segunda.resumen.servicios).toMatchObject({ creados: 0, eliminados: 0 });
    expect(segunda.resumen.nombresSinResolver).toEqual(["O Hostel GRU"]);
    expect(segunda.resumen.proveedoresParaRevisar).toEqual([]);
    expect(segundoTour.creados).toEqual({ productos: 0, componentes: 0, servicios: 0, codigos: 0, ajustes: 0 });
    expect(segundoTour.eliminados).toEqual({ componentes: 0, servicios: 0, ajustes: 0 });
  });

  it("los cuatro paquetes nuevos: cada línea con su nivel y su proveedor (Ygarape, el de Bonito)", async () => {
    const lineas = async (codigo: string) => {
      const { data, error } = await admin
        .from("producto")
        .select("destino, servicios:producto_servicio(orden, prioridad, tipo_servicio, nivel, service_provider_nombre, opcional, proveedor_sin_resolver, bs:booking_supplier_id(nombre, mails, canal, ciudad))")
        .eq("codigo", codigo)
        .single();
      if (error) throw new Error(error.message);
      const p = data as unknown as {
        destino: string;
        servicios: Array<{ orden: number; prioridad: number; tipo_servicio: string; nivel: string | null; service_provider_nombre: string; opcional: boolean; bs: { nombre: string; mails: string[]; canal: string | null; ciudad: string | null } | null }>;
      };
      return [
        p.destino,
        ...[...p.servicios]
          .sort((a, b) => a.orden - b.orden || a.prioridad - b.prioridad)
          .map((s) => [s.tipo_servicio, s.nivel, s.service_provider_nombre, s.bs ? `${s.bs.nombre} (${s.bs.ciudad}, ${s.bs.canal}${s.bs.mails.length ? `: ${s.bs.mails[0]}` : ""})` : null, s.opcional]),
      ];
    };
    expect(await lineas("ODBR50")).toEqual([
      "PTL",
      ["alojamiento", "Todos los niveles", "Pantanal Jungle Lodge", "pantanal jungle lodge (BRASIL, mail: reserva@pantanaljunglelodge.com.br)", false],
      ["otro", null, "Private Transfer Campo Grande - Pantanal - Campo Grande for 1 to 4 pax", "Agmar (BONITO, whatsapp)", false],
    ]);
    expect(await lineas("COMPBR06")).toEqual([
      "BON",
      ["alojamiento", "Hostel", "Bonito HI Hostel", "Bonito HI Hostel (BONITO, mail: contato@bonitohostel.com.br)", false],
      ["alojamiento", "Budget Hotel", "Hotel Pira Miuna", "Pira Miuna (BONITO, mail: reservas@hotelpiramiuna.com.br)", false],
      ["excursion", null, "Floating Rio da Prata w/lunch", "Ygarape (BONITO, mail: ygarape@ygarape.com.br)", false],
      ["traslado", null, "for the 2 days of Excursions", "Agmar (BONITO, whatsapp)", false],
      ["otro", null, "Transffers Campo Grande - Bonito - Campo Grande", "Agmar (BONITO, whatsapp)", true],
    ]);
    expect(await lineas("COMPBR13")).toEqual([
      "SAO",
      ["alojamiento", "Hostel", "Fujima Hostel", "Fujima Hostel (SAO PAULO, whatsapp)", false],
      ["alojamiento", "Hostel", "O Hostel GRU", null, false],
      ["alojamiento", "Hotel 3*", "Soos Hotel Collection", "sooz hotel (SAO PAULO, mail: saopaulo@soozhotel.com)", false],
      ["alojamiento", "Hotel 3*", "Nacionalinn Jaragua Sao Paulo", "Nacional Inn Jaragua Sao Paulo (BRASIL, mail: rio.lazer@nacionalinn.com)", false],
    ]);
    expect(await lineas("COMPBR14")).toEqual([
      "DOU",
      ["alojamiento", "Hostel", "Ceu do Mato Eco Hostel", "Ceu Do Mato Eco Hostel (DOURADOS, whatsapp)", false],
      ["alojamiento", "Hotel 3*", "Hotel Bahamas Dourados", "Hotel Bahamas Dourados (DOURADOS, mail: reservas@bahamashotel.com.br)", false],
    ]);
  });

  it("BR20 armado: 19 noches, los días del Word, los buses de Plataforma10 (a mano) y los ajustes de la ficha", () => {
    const t = primerTour.tours.find((x) => x.codigo === "BR20")!;
    expect(t.estado, t.motivos.join(" | ")).toBe("armado");
    expect(t.categoriasFaltantes).toEqual([]);
    expect(t.noches).toBe(19);
    expect(t.componentes.map((c) => `${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}`)).toEqual([
      "OD010B d1 3n IN",
      "COMPBR14 d4 1n",
      "COMPBR06 d5 2n",
      "ODBR50 d7 3n",
      "COMPBR13 d11 1n",
      "COMPBR02 d12 2n",
      "COMPBR11 d14 3n",
      "OD032 d17 3n OUT",
    ]);
    expect(t.serviciosPropios.map((s) => [s.sentido, s.diaDesde, s.nocturno, s.reservaManual, s.sinResolver])).toEqual([
      ["Iguazú – Dourados", 4, false, true, false],
      ["Dourados – Bonito", 5, false, true, false],
      ["Campo Grande – São Paulo", 10, true, true, false],
      ["São Paulo – Paraty", 12, false, true, false],
      ["Paraty – Ilha Grande", 14, false, false, false],
      ["Ilha Grande – Río de Janeiro", 17, false, false, false],
    ]);
    expect(t.ajustes.map((a) => [a.paquete, a.accion])).toEqual([
      ["OD010B", "solo_llegada"],
      ["COMPBR06", "reemplazar"],
      ["ODBR50", "reemplazar"],
      ["COMPBR02", "anular"],
      ["OD032", "invertir"],
    ]);
  });

  it("en seco, sin los paquetes nuevos: BR20 queda para revisar y la corrida no corta por sus excepciones", async () => {
    const insumos = leerInsumosTours(RAIZ);
    const seco = clienteEnSeco(admin);
    const r = await importarToursCompuestos({
      admin: seco.cliente,
      ...insumos,
      paquetesPiloto: insumos.paquetesPiloto.filter((p) => !NUEVOS.includes(p.codigo)),
      tours: ["BR20"],
    });
    expect(r.tours.map((t) => [t.codigo, t.estado])).toEqual([["BR20", "para_revisar"]]);
    expect(r.tours[0].motivos.join(" | ")).toContain("falta el paquete COMPBR06");
    expect(seco.escrituras.filter((e) => e.tabla !== "importacion")).toEqual([]);
  });

  describe("fila 9 — una reserva de ejemplo con las fechas de la BR20 real", () => {
    let reservaId: string;
    let pedidos: PedidoGuardado[];
    let tareas: TareaGuardada[];
    const de = (mail: string) => pedidos.filter((p) => p.destinatarios.includes(mail));

    beforeAll(async () => {
      const { mail } = await guardarMailRecibido(mailDePrueba(), admin);
      const deps = await cargarDependenciasReservas(admin);
      const [c] = await crearReservasDelMail(ficha(), { admin, mailRecibidoId: mail.id, agencia: "Kilroy", deps, llamadas: crearRegistroLlamadasSupabase(admin), dePrueba: true });
      reservaId = c.reserva.id;
      const { data, error } = await admin.from("reserva").select("estado, motivos_revision, producto:producto_id(codigo)").eq("id", reservaId).single();
      if (error) throw new Error(error.message);
      const fila = data as unknown as { estado: string; motivos_revision: string[] | null; producto: { codigo: string } | null };
      expect([fila.producto?.codigo, fila.estado, fila.motivos_revision ?? []]).toEqual(["BR20", "recibida", []]);
      const r = await armarYGuardarPedidos(admin, reservaId);
      if (!r.ok) throw new Error(r.error);
      ({ pedidos, tareas } = await cargarPedidos(admin, reservaId));
    }, 180_000);

    it("a quién va cada pedido, sin ninguno a una casilla vacía, todos para 2 pasajeros", () => {
      expect(pedidos.map((p) => p.destinatarios.join(","))).toEqual([
        "hostelsbambu@gmail.com",
        "reservas8@cuencadelplata.com",
        "contato@bonitohostel.com.br,reserva@bonitohostel.com.br",
        "ygarape@ygarape.com.br",
        "reserva@pantanaljunglelodge.com.br",
        "reservas@paratytours.com.br",
        "reservas@holandeshostel.com.br",
        "perez@local55.com",
        "buziostransfer@hotmail.com",
      ]);
      expect(pedidos.filter((p) => p.sin_destinatario)).toEqual([]);
      for (const p of pedidos) expect(p.asunto, p.destinatarios.join()).toMatch(/ x 2 /);
    });

    it("fechas y noches en cada destino", () => {
      const estadia = (mail: string) => de(mail)[0].cuerpo.match(/IN: [^\n]+\nOUT: [^\n]+/)![0];
      expect(estadia("hostelsbambu@gmail.com")).toBe("IN: 19 fev 2027\nOUT: 22 fev 2027 (3 noites)");
      expect(estadia("reserva@bonitohostel.com.br")).toBe("IN: 23 fev 2027\nOUT: 25 fev 2027 (2 noites)");
      expect(estadia("reserva@pantanaljunglelodge.com.br")).toBe("IN: 25 fev 2027\nOUT: 28 fev 2027 (3 noites)");
      expect(estadia("reservas@holandeshostel.com.br")).toBe("IN: 4 mar 2027\nOUT: 7 mar 2027 (3 noites)");
      expect(estadia("perez@local55.com")).toBe("IN: 7 mar 2027\nOUT: 10 mar 2027 (3 noites)");
      const whatsapp = tareas.filter((t) => t.tipo === "whatsapp").map((t) => t.texto);
      expect(whatsapp).toEqual([
        expect.stringMatching(/^Contactar por WhatsApp a Ceu Do Mato Eco Hostel.*IN 22 feb 2027, OUT 23 feb 2027$/),
        expect.stringMatching(/^Contactar por WhatsApp a Agmar: Transfer privado ida y vuelta a la excursión Floating Rio da Prata, 24 feb 2027; Transfer privado alojamiento en Bonito - Pantanal Jungle Lodge \(llegada\) y Pantanal Jungle Lodge - Rodoviaria de Campo Grande \(salida, bus nocturno a São Paulo\), del 25 al 28 feb 2027$/),
        expect.stringMatching(/^Contactar por WhatsApp a Fujima Hostel.*IN 1 mar 2027, OUT 2 mar 2027$/),
      ]);
      expect(tareas.filter((t) => t.tipo === "reservar_a_mano").map((t) => t.texto)).toEqual([
        "Reservar a mano en Che Lagarto: Che Lagarto (doble), IN 2 mar 2027, OUT 4 mar 2027. Si no hay lugar: Casa do Rio, Casa Viva, Agatha",
      ]);
    });

    it("Foz: el 105 Premium con el TRF IN, sin TRF OUT (van por su cuenta a la Rodoviaria)", () => {
      const foz = de("reservas8@cuencadelplata.com")[0].cuerpo;
      expect(foz).toMatch(/TRF IN: 19 feb 2027/);
      expect(foz).not.toMatch(/TRF OUT/);
    });

    it("los cuatro buses dan tareas 'Emitir pasaje' en Plataforma10, con su día, las terminales y el primer bus de la mañana", () => {
      expect(tareas.filter((x) => x.tipo === "emitir_boleto").map((x) => x.texto)).toEqual([
        "Emitir pasaje: Bus Foz do Iguaçu – Cascavel – Dourados, el primero de la mañana a Cascavel, que suele salir a las 6 hs, para conectar a Dourados, en Plataforma10, 22 feb 2027",
        "Emitir pasaje: Bus Dourados – Bonito, el primero de la mañana, que suele salir a las 7 hs, para llegar temprano, en Plataforma10, 23 feb 2027",
        "Emitir pasaje: Bus nocturno Campo Grande – São Paulo Barra Funda, en Plataforma10, 28 feb 2027",
        "Emitir pasaje: Bus São Paulo Tietê – Paraty, en Plataforma10, 2 mar 2027",
      ]);
    });

    it("Bonito: el hostel sin desayuno, la excursión el día 2 con Ygarape, en portugués", () => {
      const hostel = de("reserva@bonitohostel.com.br")[0].cuerpo;
      expect(hostel).toContain("Escrevemos da HI Travel");
      expect(hostel).not.toMatch(/caf[eé] da manh/i);
      const excursion = de("ygarape@ygarape.com.br")[0].cuerpo;
      expect(excursion).toContain("Escrevemos da HI Travel");
      expect(excursion).toMatch(/Floating Rio da Prata[^\n]*\nData: 24 fev 2027/);
      // Owner, 2026-11-06: el traslado a la excursión lo hace Agmar; el mail a Ygarape no lleva pick up.
      expect(excursion).not.toMatch(/Pick up|Drop off/i);
    });

    it("Pantanal Jungle Lodge: con pensión completa, no con café da manhã (owner, 2026-11-06)", () => {
      const lodge = de("reserva@pantanaljunglelodge.com.br")[0].cuerpo;
      expect(lodge).toContain("com pensão completa");
      expect(lodge).not.toMatch(/caf[eé] da manh/i);
    });

    it("Paraty Tours: los dos traslados con su fecha; el de COMPBR02 no se duplica", () => {
      const { cuerpo } = de("reservas@paratytours.com.br")[0];
      expect(cuerpo).toContain("Transfer: Paraty – Ilha Grande\nData: 4 mar 2027");
      expect(cuerpo).toContain("Transfer: Ilha Grande – Rio de Janeiro\nData: 7 mar 2027");
      expect(cuerpo.match(/Transfer: /g)).toHaveLength(2);
    });

    it("Río: el traslado de Buzios es la salida al aeropuerto GIG", () => {
      expect(de("buziostransfer@hotmail.com")[0].cuerpo).toContain("Transfer de saída: Transfer Cabanacopa Hostel - Aeropuerto GIG\nData: 10 mar 2027");
    });
  });
});
