import type { SupabaseClient } from "@supabase/supabase-js";
import { completarAdjuntosDelMail } from "./guardar";
import { procesarMail, type OpcionesProceso, type ResultadoPedido } from "./procesar-mail";
import type { AdjuntoGuardado, EstadoReserva, MailEntrada, MailRecibido } from "./tipos";

/**
 * M3-30 fila 8: volver a leer un mail que ya entró (Petzold, sales@ uid 16682),
 * ahora con sus imágenes. Lo usa el script de un solo uso
 * `npm run reprocesar:mail`; lo corre el owner (#4).
 *
 * 1. El mail tiene que estar guardado (carpeta + UID de la casilla). Si no,
 *    no se hace nada: lo lee la corrida de todos los días.
 * 2. Sus reservas tienen que estar "recibida" o "para revisión": si alguna ya
 *    se pidió a un proveedor (o más), no se toca nada.
 * 3. Sin `aplicar`, solo dice qué haría (no escribe, no gasta IA).
 * 4. Con `aplicar`: sube las imágenes al bucket (el mail las anota en
 *    `adjuntos`), pasa las reservas viejas a "descartada" (una reserva real no
 *    se borra) y procesa el mail de nuevo por el circuito de siempre, sin que
 *    las viejas cuenten como "mismo intercambio".
 */

const SE_PUEDEN_REEMPLAZAR: EstadoReserva[] = ["recibida", "para_revision"];

export interface ReservaVieja {
  id: string;
  estado: EstadoReserva;
  bookingId: string | null;
  producto: string | null;
}

export type ResultadoReproceso =
  | { estado: "no_esta"; motivo: string }
  | { estado: "no_se_toca"; motivo: string; mailRecibidoId: string; viejas: ReservaVieja[] }
  | {
      estado: "en_seco" | "reprocesado";
      mailRecibidoId: string;
      viejas: ReservaVieja[];
      /** Las imágenes del mail que se suben (en seco: las que se subirían). */
      imagenes: string[];
      subidas: number;
      nuevas: ResultadoPedido[];
      costo: number;
    };

async function buscarMail(admin: SupabaseClient, entrada: MailEntrada): Promise<MailRecibido | null> {
  if (entrada.huella) {
    const { data, error } = await admin.from("mail_recibido").select("*").eq("huella", entrada.huella).maybeSingle();
    if (error) throw new Error(`No se pudo buscar el mail: ${error.message}`);
    if (data) return data as MailRecibido;
  }
  if (entrada.imapUid == null || !entrada.carpeta) return null;
  let q = admin.from("mail_recibido").select("*").eq("carpeta", entrada.carpeta).eq("imap_uid", entrada.imapUid);
  if (entrada.imapUidvalidity != null) q = q.eq("imap_uidvalidity", entrada.imapUidvalidity);
  const { data, error } = await q.limit(2);
  if (error) throw new Error(`No se pudo buscar el mail: ${error.message}`);
  return data && data.length === 1 ? (data[0] as MailRecibido) : null;
}

export async function reprocesarMailGuardado(
  entrada: MailEntrada,
  opciones: OpcionesProceso & { aplicar: boolean },
): Promise<ResultadoReproceso> {
  const admin = opciones.admin;
  const mail = await buscarMail(admin, entrada);
  if (!mail) return { estado: "no_esta", motivo: "el mail no está guardado: lo lee la corrida de todos los días" };

  const { data, error } = await admin
    .from("reserva")
    .select("id, estado, booking_id, producto:producto_id(codigo)")
    .eq("mail_recibido_id", mail.id)
    .neq("estado", "descartada");
  if (error) throw new Error(`No se pudieron leer las reservas del mail: ${error.message}`);
  type Fila = { id: string; estado: EstadoReserva; booking_id: string | null; producto: { codigo: string } | null };
  const viejas: ReservaVieja[] = ((data ?? []) as unknown as Fila[]).map((r) => ({
    id: r.id,
    estado: r.estado,
    bookingId: r.booking_id,
    producto: r.producto?.codigo ?? null,
  }));
  const avanzadas = viejas.filter((r) => !SE_PUEDEN_REEMPLAZAR.includes(r.estado));
  if (avanzadas.length) {
    return {
      estado: "no_se_toca",
      mailRecibidoId: mail.id,
      viejas,
      motivo: `la reserva ya está en "${avanzadas[0].estado}": no se reprocesa (se corrige a mano)`,
    };
  }

  const guardadas = new Set((mail.adjuntos ?? []).filter((a: AdjuntoGuardado) => a.ruta).map((a) => a.nombre));
  const imagenes = (entrada.adjuntos ?? []).filter((a) => a.tipo.toLowerCase().startsWith("image/") && a.contenido && !guardadas.has(a.nombre)).map((a) => a.nombre);
  if (!opciones.aplicar) {
    return { estado: "en_seco", mailRecibidoId: mail.id, viejas, imagenes, subidas: 0, nuevas: [], costo: 0 };
  }

  const { subidos } = await completarAdjuntosDelMail(mail, entrada.adjuntos ?? [], admin);
  for (const r of viejas) {
    const { error: e } = await admin
      .from("reserva")
      .update({ estado: "descartada", motivos_revision: [], updated_at: new Date().toISOString() })
      .eq("id", r.id)
      .in("estado", SE_PUEDEN_REEMPLAZAR);
    if (e) throw new Error(`No se pudo descartar la reserva vieja ${r.id}: ${e.message}`);
  }
  const r = await procesarMail({ ...entrada, huella: mail.huella }, { ...opciones, reprocesar: { excluirReservas: viejas.map((v) => v.id) } });
  return {
    estado: "reprocesado",
    mailRecibidoId: mail.id,
    viejas,
    imagenes,
    subidas: subidos,
    nuevas: r.estado === "procesado" ? r.pedidos : [],
    costo: r.estado === "procesado" ? r.costo : 0,
  };
}
