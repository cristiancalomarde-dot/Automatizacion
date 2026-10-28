/**
 * Las reservas ya recibidas con el vuelo sin número que la lectura no guardó (spec M3-26 fila 2b).
 *
 * Recorre las reservas `recibida` y `para_revision` con los vuelos vacíos, aplica a su mail el
 * reconocimiento fijo de M3-26 (`vuelosSinNumeroDelTexto`, sin IA, #3) y devuelve qué vuelos
 * sumaría. Solo con `aplicar` los guarda y deja el historial como la corrección de vuelos de M3-07
 * (`vuelos_corregidos`, sin datos de pasajeros, #1). No toca los motivos ni el estado.
 *
 * Lo corre el owner (`npm run sumar:vuelos-sin-numero`, #4); los tests, contra la base de prueba.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEXTOS } from "@/lib/textos";
import { vuelosEnHistorial } from "./corregir/vuelos";
import type { VueloIA } from "./esquema-ficha";
import { htmlATexto } from "./html-a-texto";
import { vuelosSinNumeroDelTexto } from "./limpiar-ficha";

export interface VuelosASumar {
  reservaId: string;
  bookingId: string | null;
  estado: string;
  vuelos: VueloIA[];
}

export interface OpcionesVuelosSinNumero {
  /** Guarda los vuelos (sin esto, solo muestra). */
  aplicar?: boolean;
  /** Solo estas reservas (los tests). */
  reservaIds?: readonly string[];
}

const ESTADOS = ["recibida", "para_revision"];

function textoDelMail(mail: { asunto?: string | null; cuerpo_texto?: string | null; cuerpo_html?: string | null } | null): string {
  if (!mail) return "";
  const cuerpo = mail.cuerpo_texto?.trim() ? mail.cuerpo_texto : mail.cuerpo_html ? htmlATexto(mail.cuerpo_html) : "";
  return `${mail.asunto ?? ""}\n${cuerpo}`;
}

export async function vuelosSinNumeroDeLasGuardadas(
  cliente: SupabaseClient,
  opciones: OpcionesVuelosSinNumero = {},
): Promise<{ reservas: VuelosASumar[]; guardadas: number }> {
  let consulta = cliente
    .from("reserva")
    .select("id,booking_id,estado,vuelos,mail:mail_recibido(asunto,cuerpo_texto,cuerpo_html)")
    .in("estado", ESTADOS);
  if (opciones.reservaIds) consulta = consulta.in("id", [...opciones.reservaIds]);
  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron leer las reservas: ${error.message}`);

  const reservas: VuelosASumar[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- filas crudas de PostgREST, se tipan al mapear
  for (const r of (data ?? []) as any[]) {
    if (Array.isArray(r.vuelos) && r.vuelos.length > 0) continue;
    const mail = Array.isArray(r.mail) ? r.mail[0] : r.mail;
    const vuelos = vuelosSinNumeroDelTexto(textoDelMail(mail));
    if (vuelos.length) reservas.push({ reservaId: r.id, bookingId: r.booking_id ?? null, estado: r.estado, vuelos });
  }
  if (!opciones.aplicar) return { reservas, guardadas: 0 };

  let guardadas = 0;
  for (const r of reservas) {
    // Solo si sigue como se leyó (mismo estado, sin vuelos): no se pisa lo que alguien corrigió en el medio.
    const { data: cambiada, error: e1 } = await cliente
      .from("reserva")
      .update({ vuelos: r.vuelos })
      .eq("id", r.reservaId)
      .eq("estado", r.estado)
      .eq("vuelos", "[]")
      .select("id");
    if (e1) throw new Error(`No se pudo guardar ${r.bookingId ?? r.reservaId}: ${e1.message}`);
    if (!cambiada?.length) continue;
    const { error: e2 } = await cliente.from("evento_reserva").insert({
      reserva_id: r.reservaId,
      tipo: "vuelos_corregidos",
      detalle: { vuelos: vuelosEnHistorial(r.vuelos), avisar: [], persona: TEXTOS.reserva.corregir.lecturaDelMail, nota: false },
    });
    if (e2) throw new Error(`Se guardaron los vuelos de ${r.bookingId ?? r.reservaId} pero no el historial: ${e2.message}`);
    guardadas++;
  }
  return { reservas, guardadas };
}
