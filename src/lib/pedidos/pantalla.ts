/**
 * Lo que la pantalla de revisión de pedidos (spec M3-02) necesita calcular,
 * sin base ni red: qué se envía y qué queda pendiente, los avisos de arriba,
 * quién firma, la configuración del envío y la validación de una edición.
 *
 * Se puede importar desde el navegador: solo usa tipos de `guardar.ts`.
 */
import { esIdDeReserva } from "@/lib/reservas/reglas";
import type { HotelDeLaAgencia } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import type { PedidoGuardado } from "./guardar";
import { MARCA_NOMBRE } from "./tipos";

/** Lo que se puede mandar con "Enviar N" (M3-03): un borrador o uno que falló. Lo enviado se manda solo con "Reenviar". */
export const sePuedeEnviar = (p: PedidoGuardado): boolean => p.destinatarios.length > 0 && (p.estado === "borrador" || p.estado === "fallo");

/** Lo que sale y lo que queda pendiente. Excluidos por casilla: sobrevive a "Volver a armar". */
export function conteoEnvio(pedidos: readonly PedidoGuardado[], excluidos: ReadonlySet<string>) {
  return {
    aEnviar: pedidos.filter((p) => sePuedeEnviar(p) && !excluidos.has(p.casilla)),
    pendientes: pedidos.filter((p) => p.destinatarios.length === 0),
  };
}

/** Minutos "enviando" a partir de los cuales se ofrece reenviar (igual que `envio/enviar.ts`). */
const MINUTOS_TRABADO = 10;

export type EstadoDeEnvio =
  | { tipo: "borrador" }
  | { tipo: "prueba"; en: string }
  | { tipo: "enviando" }
  | { tipo: "trabado" }
  | { tipo: "enviado"; en: string; quien: string }
  | { tipo: "fallo"; motivo: string };

/** Qué muestra la tarjeta sobre el envío (spec M3-03 filas 7 y 9). */
export function estadoDeEnvio(p: PedidoGuardado, ahora: Date = new Date()): EstadoDeEnvio {
  if (p.estado === "enviado") return { tipo: "enviado", en: p.enviado_en ?? "", quien: p.enviado_por_nombre ?? "" };
  if (p.estado === "fallo") return { tipo: "fallo", motivo: p.motivo_fallo ?? TEXTOS.pedidos.envio.error };
  if (p.estado === "enviando") {
    const desde = p.enviando_desde ? Date.parse(p.enviando_desde) : NaN;
    return !Number.isNaN(desde) && desde < ahora.getTime() - MINUTOS_TRABADO * 60_000 ? { tipo: "trabado" } : { tipo: "enviando" };
  }
  if (p.envio_prueba_en) return { tipo: "prueba", en: p.envio_prueba_en };
  return { tipo: "borrador" };
}

/** "14:32" (hora local de quien mira). */
export function horaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const VUELO_PENDIENTE = /vuelo pendiente/i;
const LO_RESERVA_LA_AGENCIA = /: lo reserva la agencia\.$/;

/** Owner 2026-10-20: lo que pidió la agencia (pedidos especiales, uno por renglón) y las notas de la reserva. */
export interface LoQuePidio {
  pedidos: string[];
  notas: string[];
}

/**
 * Los pedidos se arman del catálogo y no reflejan lo que la agencia pidió
 * aparte (caso DK1592913: "post night in PUQ… move it to an extra day in El
 * Chalten"). La pantalla lo muestra arriba para revisarlo antes de enviar; no
 * bloquea el envío. null si no hay nada.
 */
export function loQuePidioLaAgencia(reserva: { pedidosEspeciales: string | null; notas?: readonly string[] }): LoQuePidio | null {
  const pedidos = (reserva.pedidosEspeciales ?? "").split("\n").map((p) => p.trim()).filter(Boolean);
  const notas = (reserva.notas ?? []).map((n) => (typeof n === "string" ? n.trim() : "")).filter(Boolean);
  return pedidos.length || notas.length ? { pedidos, notas } : null;
}

/** Para el diálogo de envío: todo en un renglón, cortado en una palabra si es largo. */
export function resumirLoQuePidio(textos: readonly string[], max = 140): string {
  const todo = textos.join(" · ");
  if (todo.length <= max) return todo;
  const corte = todo.slice(0, max);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > 0 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

/**
 * Los avisos de arriba (fila 6): falta el dato de llegada (el pedido igual
 * sale con "vuelo pendiente"), lo que reserva la agencia en un solo renglón, y
 * los demás avisos del armado.
 */
export function avisosDeLaPantalla(
  reserva: { agencia: string; hotelesAgencia: readonly HotelDeLaAgencia[] },
  armado: { pedidos: ReadonlyArray<{ cuerpo: string }>; avisos: readonly string[] },
): string[] {
  const avisos: string[] = [];
  if (armado.pedidos.some((p) => VUELO_PENDIENTE.test(p.cuerpo))) avisos.push(TEXTOS.pedidos.faltaLlegada);
  const hoteles = reserva.hotelesAgencia.map((h) => h.nombre?.trim()).filter((n): n is string => !!n);
  if (hoteles.length) avisos.push(TEXTOS.pedidos.hotelesAgencia(reserva.agencia, hoteles.join(", ")));
  for (const a of armado.avisos) {
    if (hoteles.length && LO_RESERVA_LA_AGENCIA.test(a)) continue;
    if (!avisos.includes(a)) avisos.push(a);
  }
  return avisos;
}

/**
 * M3-06: el nombre para la firma que eligió la persona, si lo guardó; si no
 * (M3-03), el nombre de la cuenta de Google y, si no hay, la parte del mail
 * antes de la @.
 */
export function nombreDeQuienFirma(
  usuario: { email?: string | null; user_metadata?: Record<string, unknown> | null },
  nombreFirma?: string | null,
): string {
  if (typeof nombreFirma === "string" && nombreFirma.trim()) return nombreFirma.trim();
  const meta = usuario.user_metadata ?? {};
  for (const clave of ["full_name", "name"]) {
    const v = meta[clave];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return (usuario.email ?? "").split("@")[0].trim();
}

/** La firma como va a salir, con el nombre de quien envía. */
export function firmaConNombre(firma: string, nombre: string): string {
  return firma.split(MARCA_NOMBRE).join(nombre);
}

export interface ConfiguracionEnvio {
  /** Mientras `PEDIDOS_ENVIO_REAL` no sea `si`, todo llega solo a la casilla de prueba. */
  modoPrueba: boolean;
  destinoPrueba: string;
  cc: string[];
}

const CC_POR_DEFECTO = "ccalomarde@hitravel.com.ar";
const DESTINO_PRUEBA_POR_DEFECTO = "ccalomarde@";

/** Se lee en el servidor; la pantalla la recibe ya armada. */
export function configuracionDeEnvio(env: Record<string, string | undefined>): ConfiguracionEnvio {
  const cc = (env.PEDIDOS_CC ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return {
    modoPrueba: env.PEDIDOS_ENVIO_REAL?.trim().toLowerCase() !== "si",
    destinoPrueba: env.PEDIDOS_DESTINO_PRUEBA?.trim() || DESTINO_PRUEBA_POR_DEFECTO,
    cc: cc.length ? cc : [CC_POR_DEFECTO],
  };
}

export interface EdicionPedido {
  pedidoId: string;
  asunto: string;
  cuerpo: string;
}

const MAX_ASUNTO = 300;
const MAX_CUERPO = 20_000;

export function validarEdicion(e: EdicionPedido): { ok: true; edicion: EdicionPedido } | { ok: false; error: string } {
  if (typeof e?.pedidoId !== "string" || !esIdDeReserva(e.pedidoId)) return { ok: false, error: "El pedido no es válido." };
  const asunto = typeof e.asunto === "string" ? e.asunto.replace(/\s+/g, " ").trim() : "";
  const cuerpo = typeof e.cuerpo === "string" ? e.cuerpo.replace(/\s+$/, "") : "";
  if (!asunto) return { ok: false, error: "El asunto no puede quedar vacío." };
  if (!cuerpo.trim()) return { ok: false, error: "El texto no puede quedar vacío." };
  if (asunto.length > MAX_ASUNTO) return { ok: false, error: `El asunto es muy largo (máximo ${MAX_ASUNTO} caracteres).` };
  if (cuerpo.length > MAX_CUERPO) return { ok: false, error: `El texto es muy largo (máximo ${MAX_CUERPO} caracteres).` };
  return { ok: true, edicion: { pedidoId: e.pedidoId, asunto, cuerpo } };
}
