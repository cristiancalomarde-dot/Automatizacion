import { renglonDelVuelo } from "@/lib/pedidos/renglon-vuelo";
import { TEXTOS } from "@/lib/textos";
import type { VueloIA } from "../esquema-ficha";
import type { VueloDeReserva } from "../tipos";

/**
 * Corregir los vuelos de una reserva (spec M3-07 filas 1, 2, 6 y 7), la parte
 * pura: la usan la pantalla (el formulario) y el servidor (vuelve a validar
 * lo que llega). Sin base ni navegador.
 *
 * Cada vuelo se corrige como **llegada** (aeropuerto de destino, fecha y hora
 * de llegada) o **salida** (aeropuerto de origen, fecha y hora de salida): es
 * lo que mira el control de vuelos (`vuelos-requeridos.ts`) y el armado de
 * pedidos (`buscarVuelo`). Si el vuelo guardado trae también el otro extremo
 * (SCL → CJC), se conserva mientras no se cambie de llegada a salida.
 */

const E = TEXTOS.reserva.corregir.errores;

export type LadoVuelo = "llegada" | "salida";

/** El otro extremo de un vuelo (el que no se edita): se conserva tal cual. */
export interface OtroExtremo {
  aeropuerto: string | null;
  fecha: string | null;
  hora: string | null;
}

/** Un vuelo como lo edita la persona (y como viaja a la server action). */
export interface VueloCorregido {
  lado: LadoVuelo;
  numero: string;
  aeropuerto: string;
  /** Año-mes-día (lo da el campo de fecha del navegador). */
  fecha: string;
  /** HH:MM, la hora del aeropuerto. */
  hora: string;
  /** Cómo estaba guardado (para saber si el otro extremo sigue valiendo). */
  ladoOriginal?: LadoVuelo | null;
  aerolinea?: string | null;
  otroExtremo?: OtroExtremo | null;
}

export type CampoVuelo = "numero" | "aeropuerto" | "fecha" | "hora";

export interface ErrorDeVuelo {
  /** Índice del vuelo en la lista (desde 0). */
  fila: number;
  campo: CampoVuelo;
  mensaje: string;
}

export type ResultadoValidacion = { ok: true; vuelos: VueloIA[] } | { ok: false; errores: ErrorDeVuelo[] };

const limpio = (s: string | null | undefined) => (s ?? "").trim();
const NUMERO = /^[A-Z0-9]{2} ?\d{1,5}[A-Z]?$/;
const AEROPUERTO = /^[A-Z]{3}$/;
const HORA = /^(\d{1,2}):(\d{2})$/;

/** Una fecha año-mes-día que existe (no 30 de febrero). */
export function esFechaValida(fecha: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === fecha;
}

/** "8:44" → "08:44"; null si no es una hora. */
export function horaNormalizada(hora: string): string | null {
  const m = HORA.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function numeroNormalizado(numero: string): string {
  return limpio(numero).toUpperCase().replace(/\s+/g, " ");
}

function errorDe(campo: CampoVuelo, v: VueloCorregido): string | null {
  switch (campo) {
    case "numero": {
      const n = numeroNormalizado(v.numero);
      if (!n) return E.faltaNumero;
      return NUMERO.test(n) ? null : E.numero;
    }
    case "aeropuerto":
      return AEROPUERTO.test(limpio(v.aeropuerto).toUpperCase()) ? null : E.aeropuerto;
    case "fecha":
      if (!limpio(v.fecha)) return E.faltaFecha;
      return esFechaValida(limpio(v.fecha)) ? null : E.fecha;
    case "hora":
      if (!limpio(v.hora)) return E.faltaHora;
      return horaNormalizada(v.hora) ? null : E.hora;
  }
}

const CAMPOS: readonly CampoVuelo[] = ["numero", "aeropuerto", "fecha", "hora"];

/** Los errores de un vuelo, en el orden del formulario. */
export function erroresDelVuelo(v: VueloCorregido, fila: number): ErrorDeVuelo[] {
  return CAMPOS.flatMap((campo) => {
    const mensaje = errorDe(campo, v);
    return mensaje ? [{ fila, campo, mensaje }] : [];
  });
}

/** El otro extremo, solo con lo que se puede usar (no lo escribió la persona: lo que no sirve se descarta). */
function otroUsable(o: OtroExtremo | null | undefined): OtroExtremo {
  const aeropuerto = limpio(o?.aeropuerto).toUpperCase();
  const fecha = limpio(o?.fecha);
  return {
    aeropuerto: AEROPUERTO.test(aeropuerto) ? aeropuerto : null,
    fecha: fecha && esFechaValida(fecha) ? fecha : null,
    hora: o?.hora ? horaNormalizada(o.hora) : null,
  };
}

/** Un vuelo validado, como se guarda en `reserva.vuelos` (confianza 1: lo corrigió una persona). */
function aGuardar(v: VueloCorregido): VueloIA {
  const propio = { aeropuerto: limpio(v.aeropuerto).toUpperCase(), fecha: limpio(v.fecha), hora: horaNormalizada(v.hora)! };
  const conserva = v.ladoOriginal === v.lado;
  const otro = conserva ? otroUsable(v.otroExtremo) : { aeropuerto: null, fecha: null, hora: null };
  const llegada = v.lado === "llegada" ? propio : otro;
  const salida = v.lado === "salida" ? propio : otro;
  return {
    numero: numeroNormalizado(v.numero),
    aerolinea: limpio(v.aerolinea) || null,
    origen: salida.aeropuerto,
    destino: llegada.aeropuerto,
    fecha_salida: salida.fecha,
    hora_salida: salida.hora,
    fecha_llegada: llegada.fecha,
    hora_llegada: llegada.hora,
    confianza: 1,
  };
}

/** Fila 2: aeropuerto de 3 letras, fecha válida y hora HH:MM, con mensajes en llano. */
export function validarVuelos(filas: readonly VueloCorregido[]): ResultadoValidacion {
  const errores = filas.flatMap((v, i) => erroresDelVuelo(v, i));
  if (errores.length) return { ok: false, errores };
  return { ok: true, vuelos: filas.map(aGuardar) };
}

/** Si un vuelo guardado es la llegada o la salida del viaje (para mostrarlo en el formulario). */
export function ladoDelVuelo(v: VueloDeReserva, fechas: { fechaInicio: string | null; fechaFin: string | null }): LadoVuelo {
  const llega = !!(v.destino || v.fechaLlegada || v.horaLlegada);
  const sale = !!(v.origen || v.fechaSalida || v.horaSalida);
  if (llega && !sale) return "llegada";
  if (sale && !llega) return "salida";
  if (fechas.fechaInicio && v.fechaLlegada === fechas.fechaInicio) return "llegada";
  if (fechas.fechaFin && v.fechaSalida === fechas.fechaFin) return "salida";
  return "llegada";
}

/** Un vuelo guardado → una fila del formulario. */
export function aFormulario(v: VueloDeReserva, fechas: { fechaInicio: string | null; fechaFin: string | null }): VueloCorregido {
  const lado = ladoDelVuelo(v, fechas);
  const propio = lado === "llegada" ? { a: v.destino, f: v.fechaLlegada, h: v.horaLlegada } : { a: v.origen, f: v.fechaSalida, h: v.horaSalida };
  const otro = lado === "llegada" ? { aeropuerto: v.origen, fecha: v.fechaSalida, hora: v.horaSalida } : { aeropuerto: v.destino, fecha: v.fechaLlegada, hora: v.horaLlegada };
  return {
    lado,
    ladoOriginal: lado,
    numero: v.numero ?? "",
    aeropuerto: propio.a ?? "",
    fecha: propio.f ?? "",
    hora: propio.h ?? "",
    aerolinea: v.aerolinea ?? null,
    otroExtremo: otro.aeropuerto || otro.fecha || otro.hora ? otro : null,
  };
}

/** Una fila vacía para "Agregar un vuelo". */
export const VUELO_VACIO: VueloCorregido = { lado: "llegada", ladoOriginal: null, numero: "", aeropuerto: "", fecha: "", hora: "", aerolinea: null, otroExtremo: null };

/** Fila 7: lo que va al historial de cada vuelo (solo datos del vuelo: nunca de pasajeros, #1). */
export interface VueloEnHistorial {
  lado: LadoVuelo;
  numero: string;
  aeropuerto: string;
  fecha: string | null;
  hora: string | null;
}

export function vuelosEnHistorial(vuelos: readonly VueloIA[]): VueloEnHistorial[] {
  return vuelos.map((v) => {
    const esSalida = !v.destino && !v.hora_llegada && !!(v.origen || v.hora_salida);
    return esSalida
      ? { lado: "salida", numero: v.numero ?? "", aeropuerto: v.origen ?? "", fecha: v.fecha_salida, hora: v.hora_salida }
      : { lado: "llegada", numero: v.numero ?? "", aeropuerto: v.destino ?? "", fecha: v.fecha_llegada, hora: v.hora_llegada };
  });
}

/** Lo que dice el mail sobre vuelos (para copiar de ahí): las líneas que hablan de vuelos, sin repetir. */
const HABLA_DE_VUELOS = /\b(flights?|vuelos?|v[ôo]o|departure|arrival|arriv\w*|depart\w*|ETA|ETD|landing|airport|aeropuerto)\b/i;
const MAXIMO_LINEAS = 12;

export function lineasDeVuelosDelMail(cuerpos: readonly string[]): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const cuerpo of cuerpos) {
    for (const linea of (cuerpo ?? "").split(/\r?\n/)) {
      const t = linea.trim().replace(/\s+/g, " ");
      if (!t || t.length > 300 || !HABLA_DE_VUELOS.test(t) || vistas.has(t)) continue;
      vistas.add(t);
      salida.push(t);
      if (salida.length >= MAXIMO_LINEAS) return salida;
    }
  }
  return salida;
}

// --- Fila 6: los pedidos que ya se enviaron ------------------------------------------------------

/** El renglón del vuelo de un traslado en un pedido (`armar.ts`): "Vuelo: H2253 (CJC) salida 08:44 hs". */
const RENGLON_VUELO = /^Vuelo: (\S+)(?: \(([A-Z]{3})\))? (llegada|salida)(?: (\d{2}:\d{2}) hs)?$/;
const RENGLON_PENDIENTE = /^(Bus o vuelo|Vuelo) pendiente$/;
/**
 * M3-26: el renglón del vuelo completo ("Vuelo: AR 1234 – sale … – llega …") o sin número
 * ("Llegada: Foz do Iguaçu (IGU) 20 feb 16:45 hs (sin número de vuelo)"). Sigue igual si alguno
 * de los vuelos nuevos da exactamente ese renglón.
 */
const RENGLON_VUELO_COMPLETO = /^(Vuelo: \S|Vuelo sin número|(Llegada|Salida): .*\(sin número de vuelo\)$)/;

const claveDeVuelos = (vuelos: readonly VueloIA[]) =>
  JSON.stringify(
    vuelos.map((v) => [v.numero, v.origen, v.destino, v.fecha_salida, v.hora_salida, v.fecha_llegada, v.hora_llegada].map((x) => (x ?? "").trim().toUpperCase())),
  );

function sigueIgual(renglon: RegExpExecArray, vuelos: readonly VueloIA[]): boolean {
  const [, numero, aeropuerto, lado, hora] = renglon;
  return vuelos.some((v) => {
    if ((v.numero ?? "").trim().toUpperCase() !== numero.toUpperCase()) return false;
    const a = (lado === "llegada" ? v.destino : v.origen)?.trim().toUpperCase() ?? null;
    const h = lado === "llegada" ? v.hora_llegada : v.hora_salida;
    return (aeropuerto ?? null) === (a || null) && (hora ?? null) === (h ? horaNormalizada(h) ?? h : null);
  });
}

export interface PedidoParaAvisar {
  id: string;
  estado: string;
  proveedores: string[];
  cuerpo: string;
}

/**
 * Los pedidos ya **enviados** que llevaban un traslado con un vuelo que ya
 * no es el que quedó (o que decía "Vuelo pendiente" y ahora hay vuelos): al
 * proveedor hay que avisarle (M4 lo manda; acá solo se avisa en pantalla).
 * Los borradores se rearman solos al entrar a los pedidos.
 */
export function pedidosAAvisar(
  pedidos: readonly PedidoParaAvisar[],
  antes: readonly VueloIA[],
  despues: readonly VueloIA[],
): Array<{ pedidoId: string; proveedores: string[] }> {
  if (claveDeVuelos(antes) === claveDeVuelos(despues)) return [];
  return pedidos
    .filter((p) => p.estado === "enviado")
    .filter((p) => {
      const renglones = (p.cuerpo ?? "").split(/\r?\n/).map((l) => l.trim());
      return renglones.some((l) => {
        if (RENGLON_PENDIENTE.test(l)) return despues.length > 0;
        const r = RENGLON_VUELO.exec(l);
        if (r) return !sigueIgual(r, despues);
        if (RENGLON_VUELO_COMPLETO.test(l)) return !despues.some((v) => renglonDelVuelo(v) === l);
        return false;
      });
    })
    .map((p) => ({ pedidoId: p.id, proveedores: p.proveedores }));
}
