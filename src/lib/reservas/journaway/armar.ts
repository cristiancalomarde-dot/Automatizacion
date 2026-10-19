import type { DetalleProducto } from "@/lib/catalogo/tipos";
import type { FilaLlamadaIA } from "@/lib/ia/registro-llamadas";
import { separarAvisosDeVuelo } from "../avisos-vuelo";
import { motivosDeVuelos } from "../emparejar/vuelos-requeridos";
import { MOTIVOS_EMPAREJADO } from "../emparejar/motivos";
import type { FichaLectura, ProductoIA } from "../esquema-ficha";
import type { MailParaLeer } from "../preparar-mail";
import { cuerpoDelMail } from "../preparar-mail";
import { UMBRAL_CONFIANZA } from "../limpiar-ficha";
import type { ComponenteEntrada, ContactoDelCliente, HotelDeLaAgencia, OrigenEmparejado } from "../tipos";
import { leerCuerpoJournaway } from "./cuerpo";
import { MOTIVOS_JOURNAWAY as M, NOTAS_JOURNAWAY as N } from "./motivos";
import { reconocerJournaway, type ContextoJournaway } from "./reconocer";
import type { SenalesJournaway } from "./senales";
import type { ReservaJournaway } from "./tipos";

/**
 * De la ficha de un mail de Journaway a las reservas que se guardan (spec
 * M2-09 filas 8 a 15). Lo arma `armarReservas` (M2-03) en su rama de Journaway:
 *
 * - Una reserva por paquete o tour suelto que dio el reconocedor, con el mismo
 *   booking_id (el ID del asunto; si no viene, vacío: no se inventa).
 * - Sus partes: las del paquete del catálogo (M2-08), cada tour con SU fecha y
 *   su pick up tal como vienen; los traslados con la fecha del vuelo que llega
 *   o sale de Calama. Un tour suelto o lo que va a revisión: un renglón por tour.
 * - Lo que reserva Journaway ("booked by us") se guarda solo como información
 *   (`hotelesAgencia`): no es una parte ni un pedido.
 * - El número de viaje, el contacto del cliente (nunca una dirección de HI
 *   Travel) y las notas (half-day, pasaportes, todos los hoteles).
 * - Falta un vuelo: aviso, no motivo de revisión (owner 2026-10-16).
 *
 * No toca la base: el detalle de cada producto llega inyectado.
 */

export interface DependenciasJournaway {
  catalogo: ContextoJournaway["journaway"];
  senales: SenalesJournaway;
}

export interface PiezaJournaway {
  productoId: string | null;
  origenEmparejado: OrigenEmparejado | null;
  confianzaEmparejado: number | null;
  sugerenciaProductoId: string | null;
  productoTextoAgencia: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  pasajeros: unknown[];
  pedidosEspeciales: string | null;
  componentes: ComponenteEntrada[];
  motivos: string[];
  avisos: string[];
  tripNumber: string | null;
  hotelesAgencia: HotelDeLaAgencia[];
  contactoCliente: ContactoDelCliente | null;
  notas: string[];
  sinTrasladoDe: "salida" | null;
  productoIA: ProductoIA;
}

const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const unicos = <T>(xs: T[]) => [...new Set(xs)];

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Las partes de la reserva, con la fecha y el pick up de cada tour del mail. */
function componentesDe(r: ReservaJournaway, ficha: FichaLectura, senales: SenalesJournaway): ComponenteEntrada[] {
  const deTour = (t: ReservaJournaway["tours"][number]): ComponenteEntrada => ({
    tipo: "paquete",
    productoId: t.producto?.id ?? null,
    textoAgencia: t.nombre,
    fechaInicio: t.fecha,
    fechaFin: t.fecha,
    pickUp: t.pickUp,
  });
  if (!r.paquete) return r.tours.map(deTour);

  const overland = new Set(senales.diasOverland.map((d) => d.codigo));
  const iatas = senales.aeropuertos.filter((a) => a.paquetes.includes(r.paquete!.codigo)).map((a) => a.iata);
  const llega = ficha.vuelos.find((v) => v.destino && iatas.includes(v.destino.toUpperCase()));
  const sale = [...ficha.vuelos].reverse().find((v) => v.origen && iatas.includes(v.origen.toUpperCase()));
  const libres = [...r.tours];

  const partes = r.paquete.partes.map((parte) => {
    const base: ComponenteEntrada = { tipo: "paquete", productoId: parte.productoId, productoComponenteId: parte.productoComponenteId, esTarea: false };
    if (parte.esTraslado) return { parte, c: base, fecha: null as string | null };
    const propios = overland.has(parte.codigo)
      ? libres.filter((t) => t.producto?.id === parte.productoId)
      : libres.filter((t) => t.producto?.id === parte.productoId).slice(0, 1);
    for (const t of propios) libres.splice(libres.indexOf(t), 1);
    if (propios.length === 0) return { parte, c: base, fecha: null };
    const fechas = propios.map((t) => t.fecha).filter((f): f is string => !!f).sort();
    const pickUps = unicos(propios.map((t) => t.pickUp).filter((p): p is string => !!p));
    return {
      parte,
      fecha: fechas[0] ?? null,
      c: {
        ...base,
        textoAgencia: propios.map((t) => t.nombre).join(" · "),
        fechaInicio: fechas[0] ?? null,
        fechaFin: fechas[fechas.length - 1] ?? null,
        pickUp: pickUps.length ? pickUps.join(" / ") : null,
      },
    };
  });

  // Los traslados (y lo que no vino en el mail): el día de otra parte del mismo día, o el vuelo.
  const conFecha = partes.filter((p) => p.fecha);
  for (const p of partes) {
    if (p.fecha) continue;
    const mismoDia = conFecha.find((x) => x.parte.dia === p.parte.dia);
    let fecha: string | null = mismoDia?.fecha ?? null;
    if (!fecha && p.parte.esTraslado) {
      const soloSalida = p.parte.lados.length === 1 && p.parte.lados[0] === "out";
      fecha = soloSalida ? (sale?.fecha_salida ?? null) : (llega?.fecha_llegada ?? llega?.fecha_salida ?? null);
    }
    if (!fecha && conFecha.length) {
      const cerca = [...conFecha].sort((a, b) => Math.abs(a.parte.dia - p.parte.dia) - Math.abs(b.parte.dia - p.parte.dia))[0];
      fecha = sumarDias(cerca.fecha!, p.parte.dia - cerca.parte.dia);
    }
    p.c = { ...p.c, fechaInicio: fecha, fechaFin: fecha };
    if (p.parte.esTraslado && r.sinTrasladoDe === "salida" && r.salidaCon && p.parte.lados.includes("out")) {
      p.c = { ...p.c, descripcionRuta: N.soloLlegada(r.salidaCon) };
    }
  }
  return partes.map((p) => p.c);
}

/** Anrede (mr/mrs) del cuerpo → Sr./Sra., por nombre y apellido (o en el mismo orden). */
function pasajerosConTratamiento(ficha: FichaLectura, cuerpo: ReturnType<typeof leerCuerpoJournaway>): unknown[] {
  return ficha.pasajeros.map((p, i) => {
    const igual = cuerpo.tratamientos.find((t) => normal(t.apellido) === normal(p.apellido) && normal(t.nombre) === normal(p.nombre));
    const tratamiento = (igual ?? (cuerpo.tratamientos.length === ficha.pasajeros.length ? cuerpo.tratamientos[i] : undefined))?.tratamiento ?? null;
    return tratamiento ? { ...p, tratamiento } : p;
  });
}

const nombreSinPrefijo = (nombre: string) => nombre.replace(/^\s*(?:[^\s:\d]+\s+){0,5}[^\s:\d]+\s*:\s+/u, "").trim();

export async function armarJournaway(
  ficha: FichaLectura,
  deps: {
    catalogo: ContextoJournaway["catalogo"];
    journaway: DependenciasJournaway;
    detalle: (productoId: string) => Promise<DetalleProducto>;
    proponer?: ContextoJournaway["proponer"];
  },
  mail: MailParaLeer | null,
): Promise<{ piezas: PiezaJournaway[]; llamadas: FilaLlamadaIA[]; costo: number }> {
  const cuerpoTexto = mail ? cuerpoDelMail(mail) : "";
  const texto = `${mail?.asunto ?? ""}\n${cuerpoTexto}`;
  const cuerpo = leerCuerpoJournaway(cuerpoTexto);
  const tipo = ficha.tipo_mail.valor;
  const resultado = await reconocerJournaway(ficha, texto, {
    catalogo: deps.catalogo,
    journaway: deps.journaway.catalogo,
    senales: deps.journaway.senales,
    proponer: tipo === "reserva_nueva" ? deps.proponer : undefined,
  });

  // Lo mismo para todas las reservas del mail.
  const tripNumber = cuerpo.tripNumber ?? /\btrip\s*:?\s*(\d+)/i.exec(ficha.numero_reserva.valor ?? "")?.[1] ?? null;
  const hotelesAgencia: HotelDeLaAgencia[] = ficha.hoteles_agencia.map((h) => ({ nombre: h.nombre, desde: h.fecha_entrada, hasta: h.fecha_salida }));
  const notasDelMail: string[] = [];
  if (ficha.todos_hoteles_agencia.valor && hotelesAgencia.length === 0) notasDelMail.push(N.todosLosHoteles);
  if (cuerpo.pasaportes || ficha.adjuntos_no_leidos.length) notasDelMail.push(N.pasaportes);
  const pasajeros = pasajerosConTratamiento(ficha, cuerpo);
  // Fila 10: lo que reserva Journaway no se pide, tampoco como pedido especial.
  const hoteles = hotelesAgencia.map((h) => normal(h.nombre));
  const pedidos = ficha.pedidos_especiales
    .map((p) => p.texto)
    .filter((t) => !/booked by us/i.test(t) && !hoteles.some((h) => normal(t).includes(h)));
  const pax = ficha.pax.valor;
  const paxDistinto = pax !== null && pax > 0 && ficha.pasajeros.length > 0 && pax !== ficha.pasajeros.length;
  // Las fechas de la reserva salen de cada tour, no del inicio y fin del viaje (que la IA deduce de
  // los vuelos): si cada tour tiene su fecha clara y ninguna fecha quedó en duda, "fechas" no es una duda.
  const toursConFechaClara =
    ficha.productos.length > 0 &&
    ficha.productos.every((p) => p.fecha_inicio && p.confianza >= UMBRAL_CONFIANZA) &&
    !ficha.notas.some((n) => /fecha/i.test(n));
  const dudosos = ficha.datos_dudosos.filter((d) => !(d === "pax" && paxDistinto) && !(d === "fechas" && toursConFechaClara));

  const piezas: PiezaJournaway[] = [];
  for (const r of resultado.reservas) {
    const componentes = componentesDe(r, ficha, deps.journaway.senales);
    const fechas = componentes.flatMap((c) => [c.fechaInicio, c.fechaFin]).filter((f): f is string => !!f).sort();
    const fechaInicio = fechas[0] ?? null;
    const fechaFin = fechas[fechas.length - 1] ?? null;
    const motivos = [...r.motivos];
    let avisos: string[] = [];
    if (tipo !== "reserva_nueva") motivos.unshift(MOTIVOS_EMPAREJADO.tipoMail[tipo]);
    if (r.producto && tipo === "reserva_nueva") {
      const vuelos = separarAvisosDeVuelo(
        motivosDeVuelos(await deps.detalle(r.producto.id), {
          vuelos: ficha.vuelos,
          pedidos,
          producto: { nombre: r.producto.nombre, opcionales: [], fecha_inicio: fechaInicio, fecha_fin: fechaFin },
          finalPuertoNatales: false,
          omitir: r.sinTrasladoDe === "salida" ? ["out"] : [],
        }),
      );
      motivos.push(...vuelos.motivos);
      avisos = vuelos.avisos;
      if (!fechaInicio) motivos.push(MOTIVOS_EMPAREJADO.sinFechaInicio);
    }
    if (paxDistinto) motivos.push(M.paxDistinto(pax!, ficha.pasajeros.length));
    if (dudosos.length) motivos.push(MOTIVOS_EMPAREJADO.dudosos(dudosos));

    const productoTextoAgencia = r.paquete
      ? (ficha.titulo_paquete.valor ?? r.tours.map((t) => nombreSinPrefijo(t.nombre)).join(" · "))
      : r.tours.map((t) => t.nombre).join(" · ") || null;
    piezas.push({
      productoId: r.producto?.id ?? null,
      origenEmparejado: r.producto ? r.origen : null,
      confianzaEmparejado: r.producto ? r.confianza : null,
      sugerenciaProductoId: r.sugerencia?.id ?? null,
      productoTextoAgencia,
      fechaInicio,
      fechaFin,
      pasajeros,
      pedidosEspeciales: pedidos.length ? pedidos.join("\n") : null,
      componentes,
      motivos: unicos(motivos),
      avisos,
      tripNumber,
      hotelesAgencia,
      contactoCliente: cuerpo.contacto,
      notas: unicos([...r.notas, ...notasDelMail]),
      sinTrasladoDe: r.sinTrasladoDe,
      productoIA: {
        nombre: productoTextoAgencia ?? "",
        codigo: r.producto?.codigo ?? null,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        noches: null,
        habitacion: null,
        punto_recogida: null,
        opcionales: [],
        confianza: r.confianza ?? 0,
      },
    });
  }
  return { piezas, llamadas: resultado.llamadas, costo: resultado.costo };
}
