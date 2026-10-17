import { cronAutorizado } from "@/lib/lectura-sales/autorizacion";
import { lecturaActiva } from "@/lib/lectura-sales/config";
import { correrLectura, registrarApagada } from "@/lib/lectura-sales/produccion";

/**
 * La lectura diaria de sales@ (spec M2-07): Vercel Cron la llama a las 15:00
 * UTC (12:00 de Argentina, `vercel.json`) con `Authorization: Bearer
 * <CRON_SECRET>`. El botón "Run" de Vercel → Cron Jobs hace lo mismo.
 *
 * - Sin el secreto correcto (o sin CRON_SECRET en el servidor): 401, sin
 *   conectarse, sin IA y sin registro (#5).
 * - Con `LECTURA_SALES_ACTIVA` distinto de `si`: no se conecta y anota
 *   "apagada" (#21).
 * - La respuesta lleva solo números: nunca remitentes, asuntos ni claves.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Segundos. La corrida corta sola a los 240 s y deja el resto para mañana (la ventana de 7 días lo cubre). */
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "no autorizado" }, { status: 401 });
  }
  if (!lecturaActiva()) {
    await registrarApagada("cron");
    return Response.json({ estado: "apagada" });
  }
  const r = await correrLectura("cron");
  return Response.json({
    estado: r.estado,
    miro: r.miro,
    de_agencias: r.de_agencias,
    procesados: r.procesados,
    reservas_nuevas: r.reservas_nuevas,
    reservas_actualizadas: r.reservas_actualizadas,
  });
}
