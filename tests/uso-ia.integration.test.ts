// @vitest-environment node
//
// Regla #3 — el contador de gasto de IA (`uso_ia`, migración 0003) contra el
// proyecto Supabase real: suma atómica por mes, lectura del acumulado, y el
// techo cortando ANTES de llamar cuando el acumulado real ya no alcanza.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { llamarConTecho } from "@/lib/ia/techo-gasto";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

// Un mes que nunca va a ser real, para no tocar el gasto verdadero.
const MES_DE_PRUEBA = "1900-01";

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "uso_ia — contador de gasto contra Supabase real (regla #3)",
  () => {
    let admin: SupabaseClient;
    let anonimo: SupabaseClient;

    beforeAll(async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await admin.from("uso_ia").delete().eq("mes", MES_DE_PRUEBA);
    });

    afterAll(async () => {
      await admin.from("uso_ia").delete().eq("mes", MES_DE_PRUEBA);
    });

    it("suma el uso de varias llamadas en una sola fila del mes", async () => {
      const registro = crearRegistroUsoIASupabase(admin);
      expect(await registro.gastoDelMes(MES_DE_PRUEBA)).toBe(0);

      await registro.sumar(MES_DE_PRUEBA, { tokensIn: 3000, tokensOut: 500, costo: 0.011 });
      await registro.sumar(MES_DE_PRUEBA, { tokensIn: 1000, tokensOut: 100, costo: 0.003 });

      expect(await registro.gastoDelMes(MES_DE_PRUEBA)).toBeCloseTo(0.014, 6);
      const { data } = await admin.from("uso_ia").select("tokens_in, tokens_out").eq("mes", MES_DE_PRUEBA);
      expect(data).toEqual([{ tokens_in: 4000, tokens_out: 600 }]);
    });

    it("con el acumulado real en el techo, no se llama", async () => {
      const registro = crearRegistroUsoIASupabase(admin);
      await registro.sumar(MES_DE_PRUEBA, { tokensIn: 0, tokensOut: 0, costo: 20 });
      const llamar = vi.fn();
      const r = await llamarConTecho({ registro, mes: MES_DE_PRUEBA, costoMaximoLlamada: 0.02, llamar });
      expect(r).toEqual({ llamada: false, motivo: "techo" });
      expect(llamar).not.toHaveBeenCalled();
    });

    it("sin sesión (anon) no se puede leer ni sumar gasto", async () => {
      const { data } = await anonimo.from("uso_ia").select("mes").eq("mes", MES_DE_PRUEBA);
      expect(data ?? []).toEqual([]);
      const { error } = await anonimo.rpc("sumar_uso_ia", {
        p_mes: MES_DE_PRUEBA,
        p_tokens_in: 1,
        p_tokens_out: 1,
        p_costo: 1,
      });
      expect(error).not.toBeNull();
    });
  },
);
