import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { mesActual } from "@/lib/ia/techo-gasto";
import { crearProponedorIA } from "@/lib/reservas/emparejar/propuesta-ia";
import { cargarDependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { abrirCasillaImap } from "./casilla";
import { arranqueLectura, configCasilla } from "./config";
import { leerSales, type OpcionesLectura, type ResumenCorrida } from "./corrida";
import { filaVacia, registrarCorrida, type OrigenCorrida } from "./registro";

/**
 * La corrida de verdad (la ruta del cron y `npm run leer:sales`): la casilla
 * de SALES_IMAP_*, la IA de ANTHROPIC_API_KEY bajo el techo de `uso_ia` y la
 * base con la service role. Todo sale de variables de entorno (#2). Las
 * reservas nacen sin la marca de prueba.
 */
export function opcionesDeProduccion(origen: OrigenCorrida, extra: Partial<OpcionesLectura> = {}): OpcionesLectura {
  const admin = createSupabaseAdminClient();
  const config = configCasilla();
  const mes = mesActual();
  const llamadas = crearRegistroLlamadasSupabase(admin);
  let cliente: Anthropic | null = null;
  const ia = () => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta la variable de entorno ANTHROPIC_API_KEY.");
    cliente ??= new Anthropic();
    return cliente;
  };
  return {
    admin,
    origen,
    arranque: arranqueLectura(),
    casilla: config ? () => abrirCasillaImap(config) : null,
    registroUso: crearRegistroUsoIASupabase(admin),
    llamadas,
    leer: (mail, ctx) => leerMailConIA(mail, { cliente: ia(), registro: ctx.registro, mes, llamadas, mailRecibidoId: ctx.mailRecibidoId }),
    deps: (ctx) => cargarDependenciasReservas(admin, crearProponedorIA({ cliente: ia(), registro: ctx.registro, mes, mailRecibidoId: ctx.mailRecibidoId })),
    ...extra,
  };
}

export function correrLectura(origen: OrigenCorrida): Promise<ResumenCorrida> {
  return leerSales(opcionesDeProduccion(origen));
}

/** #21: apagada, el cron no se conecta; solo queda anotado. */
export async function registrarApagada(origen: OrigenCorrida): Promise<void> {
  const ahora = new Date();
  await registrarCorrida(createSupabaseAdminClient(), { ...filaVacia(origen, "apagada", ahora), fin: ahora.toISOString() });
}
