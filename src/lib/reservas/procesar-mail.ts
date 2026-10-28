import type { SupabaseClient } from "@supabase/supabase-js";
import type { FilaLlamadaIA, RegistroLlamadasIA } from "@/lib/ia/registro-llamadas";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { agenciaDelRemitente } from "./agencias";
import { avisosDeVuelo, cargarAvisosDeVuelo } from "./avisos-vuelo";
import { bookingIdDelAsunto, esCancelacionDeAgencia } from "./booking-id";
import { MOTIVOS_EMPAREJADO as M } from "./emparejar/motivos";
import { armarReservas, type DependenciasReservas, type ReservaArmada } from "./emparejar/reservas-del-mail";
import type { FichaLectura, VueloIA } from "./esquema-ficha";
import type { ResultadoLectura } from "./extraer";
import { agregarEvento, crearReserva, guardarMailRecibido } from "./guardar";
import {
  armarCambios,
  cargoExtraDelMail,
  claveProductoAgencia,
  DIAS_MARCA_BLANDA,
  decidirPedido,
  MOTIVOS_INTERCAMBIO as MI,
  type DecisionIntercambio,
  type PedidoIntercambio,
  type ReservaExistente,
} from "./intercambio";
import type { MailParaLeer } from "./preparar-mail";
import { sinDatoDeLlegada } from "./llegada-iguazu";
import { sumarTourJournaway } from "./journaway/sumar-en-base";
import { numerosDelAsunto, type ReservaParaRespuesta } from "./respuestas";
import type { MailEntrada } from "./tipos";

/**
 * El circuito de un mail (spec M2-04, sobre M2-01 → M2-02 → M2-03):
 *
 * 1. Se guarda el mail (`mail_recibido`, único por Message-ID o huella). Si ya
 *    estaba, no se procesa de nuevo: ni IA, ni reservas, ni historial (fila 1, #3).
 * 2. Se lee con IA (M2-02) y se empareja cada producto (M2-03): un pedido por
 *    producto.
 * 3. Cada pedido pasa por las reglas del intercambio (`intercambio.ts`): reserva
 *    nueva, se suma a la que existe, revisión por ambigüedad, o nueva con la
 *    marca "posible duplicada". Las reglas no llaman a la IA.
 *
 * No hay transacción por mail (supabase-js no las tiene): la red contra dos
 * corridas a la vez es el índice único de booking_id + producto (0012). Si
 * choca, se vuelve a decidir y el pedido se suma a la que ganó (fila 11). Un
 * mail que falla a mitad queda con `error_proceso` y no se reprocesa solo
 * (reprocesar es M4).
 *
 * Nada sale hacia afuera (#4): no escribe a nadie ni toca la casilla. Los
 * mensajes de error no llevan datos de pasajeros.
 */

type Cliente = SupabaseClient;

export interface OpcionesProceso {
  admin: Cliente;
  /** La lectura de M2-02 (la IA real o una respuesta grabada). Solo se llama si el mail es nuevo. */
  leer: (mail: MailParaLeer, ctx: { mailRecibidoId: string }) => Promise<ResultadoLectura>;
  /** Las dependencias del emparejado (M2-03), con el mail ya guardado (para registrar la IA). */
  deps: (ctx: { mailRecibidoId: string }) => Promise<DependenciasReservas> | DependenciasReservas;
  llamadas?: RegistroLlamadasIA;
  dePrueba?: boolean;
  ahora?: () => Date;
  /**
   * Solo para los tests y los scripts de prueba: el "mismo intercambio" se
   * busca únicamente entre las reservas nacidas de estos mails (más el que se
   * está procesando). Así un test nunca se suma a una reserva del modo prueba
   * (M2-06) ni de otro test, aunque compartan la base. Sin esto, se busca
   * entre todas las de la agencia y del mismo modo.
   */
  alcance?: () => readonly string[];
  /**
   * M2-07 (#13): un mail ya guardado que no terminó de procesarse (sin
   * `procesado_en`) y no dejó ninguna reserva se vuelve a procesar. Sin esto,
   * un mail ya guardado nunca se reprocesa.
   */
  reintentar?: boolean;
  /**
   * M3-30 (el script de un solo uso que vuelve a leer un mail ya guardado): el mail se procesa
   * aunque ya esté guardado, y sus reservas viejas (ya descartadas) no cuentan como "mismo intercambio".
   */
  reprocesar?: { excluirReservas: readonly string[] };
}

export type AccionPedido = "nueva" | "sumada" | "revision_ambigua" | "posible_duplicada";

export interface ResultadoPedido {
  accion: AccionPedido;
  reservaId: string;
  /** Las otras reservas enlazadas (misma referencia, la ambigüedad o la parecida). */
  enlazadas: string[];
}

export type ResultadoProceso =
  | { estado: "ya_procesado"; mailRecibidoId: string; pedidos: []; costo: 0 }
  | { estado: "procesado"; mailRecibidoId: string; pedidos: ResultadoPedido[]; costo: number };

const COLUMNAS =
  "id,agencia,booking_id,producto_id,producto_clave_agencia,producto_texto_agencia,fecha_inicio,fecha_fin,pax," +
  "pasajeros,vuelos,habitacion,pedidos_especiales,estado,motivos_revision,de_prueba,created_at";

/**
 * Las reservas que pueden ser del mismo intercambio: las del mismo booking_id
 * y, para la marca blanda, las de la misma fecha de inicio y pax de los
 * últimos 60 días. Siempre de la misma agencia y del mismo modo (prueba o
 * real, fila 10). Solo lee.
 */
export async function cargarCandidatas(
  admin: Cliente,
  pedido: PedidoIntercambio,
  ahora: Date,
  /** Acota la búsqueda a las reservas nacidas de estos mails (tests y scripts de prueba). */
  alcance?: readonly string[] | null,
): Promise<ReservaExistente[]> {
  const porId = new Map<string, ReservaExistente>();
  const base = () => {
    const q = admin.from("reserva").select(COLUMNAS).eq("agencia", pedido.agencia).eq("de_prueba", pedido.dePrueba);
    return alcance ? q.in("mail_recibido_id", [...alcance]) : q;
  };
  if (pedido.bookingId) {
    const { data, error } = await base().eq("booking_id", pedido.bookingId);
    if (error) throw new Error(`No se pudieron buscar las reservas de la misma referencia: ${error.message}`);
    for (const r of (data ?? []) as unknown as ReservaExistente[]) porId.set(r.id, r);
  }
  if (pedido.fechaInicio && pedido.pax !== null) {
    const desde = new Date(ahora.getTime() - DIAS_MARCA_BLANDA * 86_400_000).toISOString();
    const { data, error } = await base().eq("fecha_inicio", pedido.fechaInicio).eq("pax", pedido.pax).gte("created_at", desde);
    if (error) throw new Error(`No se pudieron buscar reservas parecidas: ${error.message}`);
    for (const r of (data ?? []) as unknown as ReservaExistente[]) porId.set(r.id, r);
  }
  return [...porId.values()];
}

function mailParaLeer(e: MailEntrada): MailParaLeer {
  return {
    remitente: e.remitente,
    asunto: e.asunto ?? null,
    fechaMail: e.fechaMail ?? null,
    cuerpoTexto: e.cuerpoTexto ?? null,
    cuerpoHtml: e.cuerpoHtml ?? null,
    adjuntos: e.adjuntos ?? [],
  };
}

interface ContextoMail {
  admin: Cliente;
  mailId: string;
  agencia: string;
  dePrueba: boolean;
  ficha: FichaLectura | null;
  bookingId: string | null;
  bookingIdOriginal: string | null;
  esCancelacion: boolean;
  fechaMail: string | null;
  deps: DependenciasReservas;
  ahora: Date;
  alcance: readonly string[] | null;
  /** M3-30: reservas que no cuentan como candidatas (las viejas de un mail que se reprocesa). */
  excluir: readonly string[];
}

/** Los motivos de una reserva nueva, con lo que agrega el intercambio (filas 7, 8 y 9). */
function motivosDeNueva(armada: ReservaArmada, decision: DecisionIntercambio, ctx: ContextoMail): string[] {
  let motivos = [...armada.entrada.motivosRevision];
  if (ctx.esCancelacion) {
    // Fila 9: no hay reserva de ese booking_id + producto a la que sumar la cancelación.
    motivos = [MI.cancelacionSinReserva, ...motivos.filter((m) => m !== M.tipoMail.cancelacion)];
  }
  if (decision.tipo === "revision_ambigua") motivos = [MI.ambigua(decision.reservaIds.length, ctx.bookingId!), ...motivos];
  if (decision.tipo === "nueva_posible_duplicada") motivos.push(MI.posibleDuplicada);
  return [...new Set(motivos)];
}

async function crearNueva(
  ctx: ContextoMail,
  armada: ReservaArmada,
  pedido: PedidoIntercambio,
  decision: Exclude<DecisionIntercambio, { tipo: "sumar_a" }>,
): Promise<ResultadoPedido> {
  const motivos = motivosDeNueva(armada, decision, ctx);
  const duplicadaDe = decision.tipo === "nueva_posible_duplicada" ? decision.duplicadaDe : null;
  const { reserva } = await crearReserva(
    {
      ...armada.entrada,
      bookingId: ctx.bookingId,
      bookingIdOriginal: ctx.bookingIdOriginal,
      productoClaveAgencia: pedido.claveAgencia,
      estado: motivos.length ? "para_revision" : "recibida",
      motivosRevision: motivos,
      posibleDuplicada: !!duplicadaDe,
      duplicadaDeId: duplicadaDe,
      mailRecibidoId: ctx.mailId,
      dePrueba: ctx.dePrueba,
    },
    ctx.admin,
  );
  const enlazadas = decision.tipo === "revision_ambigua" ? decision.reservaIds : decision.mismaReferencia;
  if (enlazadas.length) {
    await agregarEvento(
      reserva.id,
      {
        tipo: "misma_referencia",
        detalle: { booking_id: ctx.bookingId, reservas: enlazadas, ambigua: decision.tipo === "revision_ambigua" },
      },
      ctx.admin,
    );
  }
  if (duplicadaDe) {
    await agregarEvento(reserva.id, { tipo: "posible_duplicada", detalle: { duplicada_de: duplicadaDe } }, ctx.admin);
  }
  const accion = decision.tipo === "nueva" ? "nueva" : decision.tipo === "revision_ambigua" ? "revision_ambigua" : "posible_duplicada";
  return { accion, reservaId: reserva.id, enlazadas: duplicadaDe ? [duplicadaDe] : enlazadas };
}

/**
 * Fila 5 (owner 2026-10-16): los avisos "Falta el vuelo…" de la reserva que ya
 * existe, para una lista de vuelos (`avisos-vuelo.ts`). Solo hace falta si el
 * mail trae vuelos y la reserva tiene producto.
 */
async function avisosDe(ctx: ContextoMail, existente: ReservaExistente): Promise<((v: VueloIA[]) => string[]) | undefined> {
  if (!existente.producto_id || !ctx.ficha?.vuelos.length) return undefined;
  const detalle = await ctx.deps.detalle(existente.producto_id);
  const pedidos = [existente.pedidos_especiales, ...ctx.ficha.pedidos_especiales.map((p) => p.texto)].filter(Boolean).join("\n");
  return (vuelos) =>
    avisosDeVuelo(detalle, {
      vuelos,
      pedidos,
      productoTexto: existente.producto_texto_agencia,
      fechaInicio: existente.fecha_inicio,
      fechaFin: existente.fecha_fin,
    });
}

/** Filas 3, 4, 5, 7, 9 y 12: el mail se suma al historial y completa lo vacío, sin pisar. */
async function sumarA(ctx: ContextoMail, armada: ReservaArmada, existente: ReservaExistente): Promise<ResultadoPedido> {
  const e = armada.entrada;
  // Owner 2026-10-17: en Journaway un pedido con un ID ya cargado suma sus tours a esa reserva. Las
  // fechas de otro tour no son un "dato distinto": amplían el viaje (sumarTourJournaway).
  const sumaTours = ctx.agencia === "Journaway" && !ctx.esCancelacion && ctx.ficha?.tipo_mail.valor === "reserva_nueva";
  const cambios = armarCambios(
    existente,
    {
      fechaInicio: sumaTours ? null : (e.fechaInicio ?? null),
      fechaFin: sumaTours ? null : (e.fechaFin ?? null),
      pax: e.pax ?? null,
      pasajeros: e.pasajeros ?? [],
      vuelos: ctx.ficha?.vuelos ?? [],
      habitacion: e.habitacion ?? null,
      pedidosEspeciales: e.pedidosEspeciales ?? null,
      esCancelacion: ctx.esCancelacion,
      vuelosDudosos: ctx.ficha?.datos_dudosos.includes("vuelos") ?? false,
      cargoExtra: cargoExtraDelMail({ agencia: ctx.agencia, tipoMail: ctx.ficha?.tipo_mail.valor ?? null, esCancelacion: ctx.esCancelacion }),
    },
    { avisosVuelo: await avisosDe(ctx, existente), fechaMail: ctx.fechaMail },
  );

  const tours = sumaTours ? await sumarTourJournaway(ctx.admin, existente.id, e) : null;
  if (tours) {
    // Lo que el mail nuevo no pudo reconocer manda la reserva a revisión, como al crearla.
    for (const m of e.motivosRevision) if (!cambios.motivos.includes(m)) cambios.motivos.push(m);
    if (cambios.motivos.length && ["recibida", "para_revision"].includes(existente.estado)) cambios.estado = "para_revision";
  }

  await agregarEvento(
    existente.id,
    {
      tipo: "mail_agregado",
      mailRecibidoId: ctx.mailId,
      detalle: {
        tipo_mail: ctx.ficha?.tipo_mail.valor ?? null,
        cancelacion: ctx.esCancelacion,
        booking_id_original: ctx.bookingIdOriginal,
        ...(cambios.nota ? { nota: cambios.nota } : {}),
        ...(tours ? { partes_sumadas: tours.partesSumadas, productos_sumados: tours.productosSumados } : {}),
      },
    },
    ctx.admin,
  );
  if (cambios.completados.length) {
    await agregarEvento(existente.id, { tipo: "datos_completados", mailRecibidoId: ctx.mailId, detalle: { campos: cambios.completados } }, ctx.admin);
  }
  if (cambios.distintos.length) {
    await agregarEvento(existente.id, { tipo: "datos_distintos", mailRecibidoId: ctx.mailId, detalle: { diferencias: cambios.distintos } }, ctx.admin);
  }

  const motivosCambian = cambios.motivos.join("\n") !== existente.motivos_revision.join("\n");
  const deJournaway = tours?.actualizar ?? {};
  if (cambios.completados.length || cambios.estado !== existente.estado || motivosCambian || Object.keys(deJournaway).length) {
    const { error } = await ctx.admin
      .from("reserva")
      .update({
        ...cambios.completar,
        ...deJournaway,
        estado: cambios.estado,
        motivos_revision: cambios.motivos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existente.id);
    if (error) throw new Error(`No se pudo actualizar la reserva ${existente.id}: ${error.message}`);
  }
  return { accion: "sumada", reservaId: existente.id, enlazadas: [] };
}

async function aplicarPedido(ctx: ContextoMail, armada: ReservaArmada, pedido: PedidoIntercambio): Promise<ResultadoPedido> {
  for (let intento = 0; ; intento++) {
    const candidatas = (await cargarCandidatas(ctx.admin, pedido, ctx.ahora, ctx.alcance)).filter((r) => !ctx.excluir.includes(r.id));
    const decision = decidirPedido(pedido, candidatas, { ahora: ctx.ahora });
    if (decision.tipo === "sumar_a") return sumarA(ctx, armada, candidatas.find((r) => r.id === decision.reservaId)!);
    try {
      return await crearNueva(ctx, armada, pedido, decision);
    } catch (e) {
      // Fila 11: otra corrida creó la misma reserva entre la búsqueda y el insert: se vuelve a decidir.
      if ((e as { code?: string }).code === "23505" && intento === 0) continue;
      throw e;
    }
  }
}

/** M2-07: un mail guardado que quedó a medias (sin procesar y sin reservas) se puede reintentar. */
async function sePuedeReintentar(admin: Cliente, mail: { id: string; procesado_en: string | null }): Promise<boolean> {
  if (mail.procesado_en) return false;
  const { count, error } = await admin.from("reserva").select("id", { count: "exact", head: true }).eq("mail_recibido_id", mail.id);
  if (error) throw new Error(`No se pudo revisar si el mail ya dejó reservas: ${error.message}`);
  return (count ?? 0) === 0;
}

/** Procesa un mail de punta a punta. Si ya estaba guardado, no hace nada (fila 1). */
export async function procesarMail(entrada: MailEntrada, opciones: OpcionesProceso): Promise<ResultadoProceso> {
  const admin = opciones.admin;
  const dePrueba = opciones.dePrueba ?? entrada.dePrueba ?? false;
  const agencia = entrada.agencia ?? agenciaDelRemitente(entrada.remitente);
  const { mail, nuevo } = await guardarMailRecibido({ ...entrada, agencia, dePrueba }, admin);
  if (!nuevo && !opciones.reprocesar && !(opciones.reintentar && (await sePuedeReintentar(admin, mail)))) {
    return { estado: "ya_procesado", mailRecibidoId: mail.id, pedidos: [], costo: 0 };
  }

  const pendientes: FilaLlamadaIA[] = [];
  const marcarMail = async (cambios: { procesado_en?: string; error_proceso?: string }) => {
    await admin.from("mail_recibido").update({ ...cambios, updated_at: new Date().toISOString() }).eq("id", mail.id);
  };
  try {
    const lectura = await opciones.leer(mailParaLeer(entrada), { mailRecibidoId: mail.id });
    const deps = await opciones.deps({ mailRecibidoId: mail.id });
    const armadas = await armarReservas(lectura, deps, { agencia, mail: mailParaLeer(entrada) });
    pendientes.push(...armadas.flatMap((a) => a.llamadas));

    const ficha = lectura.estado === "leido" ? lectura.ficha : null;
    const delAsunto = bookingIdDelAsunto(entrada.asunto, agencia);
    const ctx: ContextoMail = {
      admin,
      mailId: mail.id,
      agencia: armadas[0]?.entrada.agencia ?? agencia,
      dePrueba,
      ficha,
      bookingId: ficha?.numero_reserva.limpio ?? delAsunto,
      bookingIdOriginal: ficha?.numero_reserva.valor ?? delAsunto,
      esCancelacion: esCancelacionDeAgencia({
        asunto: entrada.asunto,
        cuerpo: entrada.cuerpoTexto,
        tipoMail: ficha?.tipo_mail.valor ?? null,
      }),
      fechaMail: mail.fecha_mail,
      deps,
      ahora: opciones.ahora?.() ?? new Date(),
      alcance: opciones.alcance ? [...opciones.alcance(), mail.id] : null,
      excluir: opciones.reprocesar?.excluirReservas ?? [],
    };

    const pedidos: ResultadoPedido[] = [];
    for (const armada of armadas) {
      const producto = armada.productoIA;
      const pedido: PedidoIntercambio = {
        agencia: ctx.agencia,
        bookingId: ctx.bookingId,
        productoId: armada.entrada.productoId,
        claveAgencia: producto ? claveProductoAgencia(producto) : null,
        fechaInicio: armada.entrada.fechaInicio ?? null,
        pax: armada.entrada.pax ?? null,
        dePrueba,
      };
      // Si la lectura falló no hay datos para sumar a otra: queda su propia reserva para revisión.
      const resultado = ficha
        ? await aplicarPedido(ctx, armada, pedido)
        : await crearNueva(ctx, armada, pedido, { tipo: "nueva", mismaReferencia: [] });
      pedidos.push(resultado);
      for (const l of armada.llamadas) {
        await opciones.llamadas?.registrar({ ...l, reservaId: resultado.reservaId, dePrueba: dePrueba || l.dePrueba });
        pendientes.splice(pendientes.indexOf(l), 1);
      }
    }
    await marcarMail({ procesado_en: new Date().toISOString() });
    return { estado: "procesado", mailRecibidoId: mail.id, pedidos, costo: lectura.costo + armadas.reduce((s, a) => s + a.costo, 0) };
  } catch (e) {
    await marcarMail({ error_proceso: e instanceof Error ? e.message.slice(0, 500) : "Error inesperado" });
    throw e;
  } finally {
    for (const l of pendientes) await opciones.llamadas?.registrar({ ...l, reservaId: null });
  }
}

/**
 * Varios mails de la misma lectura (Inbox y Spam juntos): en el orden en que
 * llegaron, de a uno, así el segundo ya encuentra la reserva del primero (fila 11).
 */
export async function procesarMails(entradas: MailEntrada[], opciones: OpcionesProceso): Promise<ResultadoProceso[]> {
  const cuando = (e: MailEntrada) => (e.fechaMail ? new Date(e.fechaMail).getTime() : Number.POSITIVE_INFINITY);
  const ordenadas = entradas.map((e, i) => ({ e, i })).sort((a, b) => cuando(a.e) - cuando(b.e) || a.i - b.i);
  const resultados: ResultadoProceso[] = [];
  for (const { e } of ordenadas) resultados.push(await procesarMail(e, opciones));
  return resultados;
}

/**
 * Para decidir si una respuesta se lee (`respuestas.ts`, owner 2026-10-14):
 * las reservas de la agencia cuyos números aparecen en el asunto, con sus
 * avisos de vuelo calculados (owner 2026-10-16). Solo lee.
 */
export async function cargarReservasDelAsunto(
  admin: Cliente,
  asunto: string | null | undefined,
  agencia: string,
  dePrueba: boolean,
  /** Acota a las reservas nacidas de estos mails (tests y scripts de prueba). */
  alcance?: readonly string[] | null,
): Promise<ReservaParaRespuesta[]> {
  const numeros = numerosDelAsunto(asunto, agencia);
  if (numeros.length === 0) return [];
  let consulta = admin
    .from("reserva")
    .select(
      "id,agencia,booking_id,estado,motivos_revision,de_prueba,vuelos,pedidos_especiales,producto_id,producto_texto_agencia," +
        "fecha_inicio,fecha_fin,producto:producto_id(codigo)",
    )
    .eq("agencia", agencia)
    .eq("de_prueba", dePrueba)
    .in("booking_id", numeros);
  if (alcance) consulta = consulta.in("mail_recibido_id", [...alcance]);
  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron buscar las reservas del asunto: ${error.message}`);
  type Fila = ReservaParaRespuesta & {
    vuelos: VueloIA[] | null;
    pedidos_especiales: string | null;
    producto_id: string | null;
    producto_texto_agencia: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    producto: { codigo: string } | null;
  };
  const filas = (data ?? []) as unknown as Fila[];
  const avisos = await cargarAvisosDeVuelo(
    (id) => cargarProducto(admin, id),
    filas.map((f) => ({
      id: f.id,
      productoId: f.producto_id,
      estado: f.estado,
      productoTexto: f.producto_texto_agencia,
      fechaInicio: f.fecha_inicio,
      fechaFin: f.fecha_fin,
      vuelos: f.vuelos ?? [],
      pedidos: f.pedidos_especiales,
    })),
  );
  return filas.map((f) => ({
    id: f.id,
    agencia: f.agencia,
    booking_id: f.booking_id,
    estado: f.estado,
    motivos_revision: f.motivos_revision,
    de_prueba: f.de_prueba,
    sin_dato_llegada: sinDatoDeLlegada({ productoCodigo: f.producto?.codigo ?? null, vuelos: f.vuelos ?? [], pedidos: f.pedidos_especiales }),
    avisos_vuelo: avisos.get(f.id) ?? [],
  }));
}
