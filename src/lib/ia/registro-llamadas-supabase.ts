import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistroLlamadasIA } from "./registro-llamadas";

/**
 * `RegistroLlamadasIA` sobre la tabla `ia_llamada` (migración 0010). Con la
 * service role: solo el servidor registra llamadas (regla #2). No guarda
 * contenido del mail.
 */
export function crearRegistroLlamadasSupabase(admin: SupabaseClient): RegistroLlamadasIA {
  return {
    async registrar(fila) {
      const { error } = await admin.from("ia_llamada").insert({
        tarea: fila.tarea,
        modelo: fila.modelo,
        version_instrucciones: fila.versionInstrucciones,
        tokens_in: fila.tokensIn,
        tokens_out: fila.tokensOut,
        costo_usd: fila.costoUsd,
        resultado: fila.resultado,
        mail_recibido_id: fila.mailRecibidoId,
        de_prueba: fila.dePrueba,
      });
      if (error) throw new Error(`No se pudo registrar la llamada a la IA: ${error.message}`);
    },
  };
}
