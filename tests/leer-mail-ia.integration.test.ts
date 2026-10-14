// @vitest-environment node
//
// Spec M2-02 — verificación 2 (integración contra el Supabase real, sin la
// clave de Claude: el cliente de IA sigue siendo falso). Filas 15, 22 y 29:
// el gasto se suma en `uso_ia`, el techo corta con el registro real y cada
// lectura deja su fila en `ia_llamada`. Los meses son de prueba (2099-xx) y
// se borran al final; el mail y las llamadas llevan `de_prueba = true` y se
// borran con el borrado de prueba.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MODELOS } from "@/lib/ia/modelos";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { leerAgencias } from "@/lib/reservas/agencias";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { borrarDatosDePrueba, guardarMailRecibido } from "@/lib/reservas/guardar";
import { clienteFalso, mailDePrueba, respuestaGrabada } from "@/lib/reservas/__fixtures__/cargar";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const MES_OK = "2099-01";
const MES_TECHO = "2099-02";
const AGENCIAS = leerAgencias(readFileSync(join(process.cwd(), "data", "agencias.csv"), "utf-8"));

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M2-02 — leer un mail con IA contra Supabase real (uso_ia e ia_llamada)",
  { timeout: 60_000 },
  () => {
    let admin: SupabaseClient;
    let soltarBloqueo: () => void;
    let mailId: string;

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await admin.from("uso_ia").delete().in("mes", [MES_OK, MES_TECHO]);
      const mail = mailDePrueba("kilroy-od010d");
      const { mail: guardado } = await guardarMailRecibido(
        {
          origen: "archivo",
          remitente: mail.remitente,
          asunto: `[test M2-02] ${mail.asunto} ${randomUUID()}`,
          cuerpoTexto: mail.cuerpoTexto,
          agencia: "Kilroy",
          dePrueba: true,
        },
        admin,
      );
      mailId = guardado.id;
    }, 360_000);

    afterAll(async () => {
      try {
        await admin.from("uso_ia").delete().in("mes", [MES_OK, MES_TECHO]);
        await borrarDatosDePrueba(admin);
        const { data: quedan } = await admin.from("ia_llamada").select("id").eq("mail_recibido_id", mailId);
        expect(quedan ?? []).toEqual([]);
      } finally {
        soltarBloqueo?.();
      }
    }, 120_000);

    it("fila 22 y 29: una lectura suma US$ 0,011 al mes y deja su fila en ia_llamada, sin contenido", async () => {
      const { cliente } = clienteFalso(respuestaGrabada("kilroy-od010d")); // 3.000 tokens in, 500 out
      const registro = crearRegistroUsoIASupabase(admin);
      const r = await leerMailConIA(mailDePrueba("kilroy-od010d"), {
        cliente,
        registro,
        mes: MES_OK,
        agencias: AGENCIAS,
        llamadas: crearRegistroLlamadasSupabase(admin),
        mailRecibidoId: mailId,
        dePrueba: true,
      });
      expect(r.estado).toBe("leido");
      expect(await registro.gastoDelMes(MES_OK)).toBeCloseTo(0.011, 6);

      const { data, error } = await admin.from("ia_llamada").select("*").eq("mail_recibido_id", mailId).eq("resultado", "ok");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({
        tarea: "lectura_mail",
        modelo: MODELOS.lectura_mail.modelo,
        version_instrucciones: "lectura-mail.v2",
        tokens_in: 3000,
        tokens_out: 500,
        resultado: "ok",
        reserva_id: null,
        de_prueba: true,
      });
      expect(Number(data![0].costo_usd)).toBeCloseTo(0.011, 6);
      expect(JSON.stringify(data)).not.toMatch(/Pruebasen|DK1564627|Iguazu/);
    });

    it("fila 15 y 29: con el gasto real del mes en US$ 19,99 no se llama, no se suma nada y queda 'sin_presupuesto' con costo 0", async () => {
      const registro = crearRegistroUsoIASupabase(admin);
      await registro.sumar(MES_TECHO, { tokensIn: 0, tokensOut: 0, costo: 19.99 });
      const { cliente, create } = clienteFalso(respuestaGrabada("kilroy-od010d"));

      const r = await leerMailConIA(mailDePrueba("kilroy-od010d"), {
        cliente,
        registro,
        mes: MES_TECHO,
        agencias: AGENCIAS,
        llamadas: crearRegistroLlamadasSupabase(admin),
        mailRecibidoId: mailId,
        dePrueba: true,
      });

      expect(r).toEqual({ estado: "para_revision", motivo: "se agotó el presupuesto de IA del mes", costo: 0 });
      expect(create).not.toHaveBeenCalled();
      expect(await registro.gastoDelMes(MES_TECHO)).toBeCloseTo(19.99, 6);
      const { data } = await admin
        .from("ia_llamada")
        .select("resultado, costo_usd, tokens_in, tokens_out")
        .eq("mail_recibido_id", mailId)
        .eq("resultado", "sin_presupuesto");
      expect(data).toEqual([{ resultado: "sin_presupuesto", costo_usd: 0, tokens_in: 0, tokens_out: 0 }]);
    });
  },
);
