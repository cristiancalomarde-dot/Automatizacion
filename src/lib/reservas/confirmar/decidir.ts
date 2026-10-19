import { AGENCIA_JOURNAWAY } from "@/lib/catalogo/reglas";
import type { DetalleProducto } from "@/lib/catalogo/tipos";
import { TEXTOS } from "@/lib/textos";
import { separarAvisosDeVuelo } from "../avisos-vuelo";
import { lectorDe } from "../emparejar/agencias";
import { componentesDeLaReserva, saleDePuertoNatales } from "../emparejar/componentes";
import { normalizarNombre } from "../emparejar/emparejar";
import { MOTIVOS_EMPAREJADO as M } from "../emparejar/motivos";
import { esMotivoDeProducto, sugerenciaDelMotivo } from "../emparejar/motivos-de-producto";
import { textoAgencia } from "../emparejar/reservas-del-mail";
import { motivosDeVuelos } from "../emparejar/vuelos-requeridos";
import type { FichaLectura, ProductoIA, VueloIA } from "../esquema-ficha";
import type { ComponenteEntrada, EstadoReserva } from "../tipos";

/**
 * Confirmar el producto de una reserva "para revisión" (spec M3-05), la parte
 * pura: qué queda en la reserva (filas 4) y qué aprende la app (filas 5 y 8).
 * No toca la base: el guardado está en `confirmar.ts`.
 *
 * Reusa lo del emparejado: las partes de un tour compuesto
 * (`componentesDeLaReserva`), los vuelos que hacen falta (`motivosDeVuelos`,
 * con la regla del owner 2026-10-16: el vuelo que falta es un aviso, no un
 * motivo) y la normalización de nombres del paso 2.
 */

const R = TEXTOS.reserva.confirmarProducto.motivos;

export interface ReservaParaConfirmar {
  id: string;
  agencia: string;
  estado: EstadoReserva;
  dePrueba: boolean;
  motivos: string[];
  productoId: string | null;
  sugerenciaProductoId: string | null;
  productoTextoAgencia: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  vuelos: VueloIA[];
  /** Tal como se guardan (uno por renglón). */
  pedidosEspeciales: string | null;
  sinTrasladoDe: "llegada" | "salida" | null;
  datosExtraidos: FichaLectura | null;
  cantidadPartes: number;
}

export interface ProductoElegido {
  id: string;
  codigo: string;
  nombre: string;
}

/** Por qué esta reserva no se puede confirmar desde la pantalla (null = se puede). */
export function porQueNoSeConfirma(r: ReservaParaConfirmar): string | null {
  if (r.estado !== "para_revision") return R.noEnRevision;
  if (r.productoId || !r.motivos.some(esMotivoDeProducto)) return R.sinMotivoDeProducto;
  // Journaway arma sus paquetes con su propio reconocedor (M2-09) y una reserva puede tener varios.
  if (r.agencia === AGENCIA_JOURNAWAY) return R.journaway;
  if (r.cantidadPartes > 0) return R.conPartes;
  return null;
}

/** El producto del mail que dio esta reserva (el de su texto; si el mail trae uno solo, ese). */
function productoDelMail(r: ReservaParaConfirmar): ProductoIA | null {
  const productos = r.datosExtraidos?.productos ?? [];
  return productos.find((p) => textoAgencia(p) === r.productoTextoAgencia) ?? (productos.length === 1 ? productos[0] : null);
}

/** Lo que mandó la agencia: su código (si vino) y el nombre. */
export function pedidoDeLaAgencia(r: ReservaParaConfirmar): { codigo: string | null; nombre: string | null } {
  const p = productoDelMail(r);
  if (p) return { codigo: p.codigo?.trim() || null, nombre: p.nombre?.trim() || null };
  return { codigo: null, nombre: r.productoTextoAgencia?.trim() || null };
}

export interface Confirmacion {
  origen: "ia" | "nombre";
  /** La de la IA si se aceptó su sugerencia (null si el motivo no la decía); 1 si se eligió. */
  confianza: number | null;
  sugerida: boolean;
  motivos: string[];
  estado: "recibida" | "para_revision";
  componentes: ComponenteEntrada[];
  /** Los vuelos que faltan: avisos, no se guardan (`avisos-vuelo.ts`). */
  avisos: string[];
}

export function decidirConfirmacion(
  r: ReservaParaConfirmar,
  producto: ProductoElegido,
  detalle: DetalleProducto,
  opciones: { proveedorTransferPNT: { id: string; nombre: string } | null },
): Confirmacion {
  const sugerida = !!r.sugerenciaProductoId && r.sugerenciaProductoId === producto.id;
  const confianzaIA = r.motivos.map(sugerenciaDelMotivo).find((s) => s?.codigo === producto.codigo)?.confianza ?? null;

  const quedan = r.motivos.filter((m) => !esMotivoDeProducto(m));
  const nuevos: string[] = [];
  let componentes: ComponenteEntrada[] = [];
  let avisos: string[] = [];

  // Como en el emparejado (M2-03 fila 13): solo una reserva nueva arma partes y mira vuelos.
  const tipo = r.datosExtraidos?.tipo_mail?.valor ?? "reserva_nueva";
  if (tipo === "reserva_nueva") {
    const pedidos = r.pedidosEspeciales ? r.pedidosEspeciales.split("\n").filter((p) => p.trim()) : [];
    const finalPuertoNatales = saleDePuertoNatales({ vuelos: r.vuelos, pedidos_especiales: pedidos.map((texto) => ({ texto, confianza: 1 })) });
    componentes = componentesDeLaReserva(detalle, r.fechaInicio, { finalPuertoNatales, proveedorTransferPNT: opciones.proveedorTransferPNT });
    const delMail = productoDelMail(r);
    const vuelos = separarAvisosDeVuelo(
      motivosDeVuelos(detalle, {
        vuelos: r.vuelos,
        pedidos,
        producto: { nombre: delMail?.nombre ?? r.productoTextoAgencia ?? "", opcionales: delMail?.opcionales ?? [], fecha_inicio: r.fechaInicio, fecha_fin: r.fechaFin },
        finalPuertoNatales,
        omitir: r.sinTrasladoDe === "salida" ? ["out"] : r.sinTrasladoDe === "llegada" ? ["in"] : [],
      }),
    );
    nuevos.push(...vuelos.motivos);
    avisos = vuelos.avisos;
    if (!r.fechaInicio) nuevos.push(M.sinFechaInicio);
  }

  const motivos = [...new Set([...quedan, ...nuevos])];
  return {
    origen: sugerida ? "ia" : "nombre",
    confianza: sugerida ? confianzaIA : 1,
    sugerida,
    motivos,
    estado: motivos.length ? "para_revision" : "recibida",
    componentes,
    avisos,
  };
}

/** Una fila de `codigo_externo`. */
export interface EquivalenciaGuardada {
  id: string;
  productoId: string;
  agencia: string;
  codigo: string;
  nombreExterno: string | null;
}

export type PlanAprendizaje =
  | { tipo: "no"; razon: "prueba" | "ya_esta" | "sin_texto" }
  | {
      tipo: "guardar";
      /** El código de la agencia tal cual vino o, sin código, el nombre limpio (como los nombres de Journaway, M2-08). */
      codigo: string;
      nombreExterno: string | null;
      /** Equivalencias de esa agencia que hoy dicen otro producto: no se pisan sin preguntar. */
      conflictos: EquivalenciaGuardada[];
    };

/**
 * Qué aprende la app (fila 5): el código de la agencia si vino (y su lector
 * lo usa para buscar), o si no el nombre que mandó. Así el próximo mail igual
 * se reconoce en el paso 1 o 2, sin IA. Una reserva de prueba no aprende
 * (fila 8). Si ya está igual, no duplica.
 */
export function planAprendizaje(entrada: {
  agencia: string;
  dePrueba: boolean;
  pedido: { codigo: string | null; nombre: string | null };
  productoId: string;
  equivalencias: readonly EquivalenciaGuardada[];
}): PlanAprendizaje {
  if (entrada.dePrueba) return { tipo: "no", razon: "prueba" };
  const deLaAgencia = entrada.equivalencias.filter((e) => e.agencia === entrada.agencia);
  const nombre = entrada.pedido.nombre?.trim() || null;
  const codigoDelMail = entrada.pedido.codigo?.trim() || null;
  const lector = lectorDe(entrada.agencia);
  const usaCodigo = !!codigoDelMail && lector.usaCodigo && lector.codigosCandidatos(codigoDelMail).includes(codigoDelMail);

  if (usaCodigo) {
    const mismas = deLaAgencia.filter((e) => e.codigo === codigoDelMail);
    const conflictos = mismas.filter((e) => e.productoId !== entrada.productoId);
    if (mismas.length > 0 && conflictos.length === 0) return { tipo: "no", razon: "ya_esta" };
    return { tipo: "guardar", codigo: codigoDelMail!, nombreExterno: nombre, conflictos };
  }

  const limpio = nombre ? normalizarNombre(nombre) : "";
  if (!limpio) return { tipo: "no", razon: "sin_texto" };
  const mismas = deLaAgencia.filter((e) => (e.nombreExterno && normalizarNombre(e.nombreExterno) === limpio) || e.codigo === limpio);
  const conflictos = mismas.filter((e) => e.productoId !== entrada.productoId);
  if (mismas.length > 0 && conflictos.length === 0) return { tipo: "no", razon: "ya_esta" };
  return { tipo: "guardar", codigo: limpio, nombreExterno: nombre, conflictos };
}

/**
 * Cuando la persona dijo "Sí, cambiarlo": la fila con el mismo código pasa al
 * producto nuevo; un código de la agencia que tenía ese nombre para otro
 * producto conserva su código y solo pierde el nombre (así el código sigue
 * diciendo lo que decía y el nombre ya no es ambiguo).
 */
export function cambiosDeLaEquivalencia(plan: Extract<PlanAprendizaje, { tipo: "guardar" }>): { reemplazar: string[]; quitarNombre: string[] } {
  return {
    reemplazar: plan.conflictos.filter((e) => e.codigo === plan.codigo).map((e) => e.id),
    quitarNombre: plan.conflictos.filter((e) => e.codigo !== plan.codigo).map((e) => e.id),
  };
}
