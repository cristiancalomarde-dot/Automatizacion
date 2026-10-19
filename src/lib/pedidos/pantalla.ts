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

/** Lo que sale y lo que queda pendiente. Excluidos por casilla: sobrevive a "Volver a armar". */
export function conteoEnvio(pedidos: readonly PedidoGuardado[], excluidos: ReadonlySet<string>) {
  return {
    aEnviar: pedidos.filter((p) => p.destinatarios.length > 0 && !excluidos.has(p.casilla)),
    pendientes: pedidos.filter((p) => p.destinatarios.length === 0),
  };
}

const VUELO_PENDIENTE = /vuelo pendiente/i;
const LO_RESERVA_LA_AGENCIA = /: lo reserva la agencia\.$/;

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

/** El nombre de la cuenta de Google; si no hay, la parte del mail antes de la @. */
export function nombreDeQuienFirma(usuario: { email?: string | null; user_metadata?: Record<string, unknown> | null }): string {
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
