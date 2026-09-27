import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistroUsoIA } from "./techo-gasto";

/**
 * `RegistroUsoIA` sobre la tabla `uso_ia` (migración 0003). Requiere un
 * cliente con la service role: solo el servidor suma gasto (regla #2 — la
 * clave nunca llega al navegador).
 */
export function crearRegistroUsoIASupabase(admin: SupabaseClient): RegistroUsoIA {
  return {
    async gastoDelMes(mes) {
      const { data, error } = await admin
        .from("uso_ia")
        .select("costo_estimado")
        .eq("mes", mes)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el gasto de IA del mes: ${error.message}`);
      return data ? Number(data.costo_estimado) : 0;
    },
    async sumar(mes, uso) {
      const { error } = await admin.rpc("sumar_uso_ia", {
        p_mes: mes,
        p_tokens_in: uso.tokensIn,
        p_tokens_out: uso.tokensOut,
        p_costo: uso.costo,
      });
      if (error) throw new Error(`No se pudo registrar el gasto de IA: ${error.message}`);
    },
  };
}
