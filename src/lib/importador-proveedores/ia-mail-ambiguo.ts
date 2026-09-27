import type Anthropic from "@anthropic-ai/sdk";
import { costoUSD, llamarConTecho, type RegistroUsoIA } from "@/lib/ia/techo-gasto";
import type { ConsultaIA, ConsultarIA, RespuestaIA } from "./resolver";

/**
 * Respaldo de IA para UNA celda "Mail/web" ambigua (spec M1-03 §3 #9 y Anexo
 * técnico, regla 5). Se llama celda por celda — nunca con el archivo entero —
 * y cada llamada pasa antes por el techo de gasto (regla #3,
 * docs/arquitectura/integraciones-ia.md).
 *
 * La respuesta de la IA NO se guarda tal cual: `resolverProveedor` descarta
 * cualquier mail que no aparezca literal en el Excel y todo lo que venga con
 * confianza por debajo del umbral.
 */

export const MODELO_IA = "claude-sonnet-5";
const MAX_TOKENS = 1500;
/** Peor caso de entrada: prompt fijo + una celda y sus aclaraciones (acotadas abajo). */
const TOKENS_ENTRADA_MAXIMOS = 2000;
const LARGO_MAXIMO_TEXTO = 2000;

export type ClienteMensajesIA = Pick<Anthropic, "messages">;

const ESQUEMA_RESPUESTA = {
  type: "object",
  properties: {
    mails: { type: "array", items: { type: "string" } },
    canal: { type: "string", enum: ["mail", "whatsapp", "ninguno"] },
    confianza: { type: "number" },
  },
  required: ["mails", "canal", "confianza"],
  additionalProperties: false,
} as const;

const INSTRUCCIONES = `Sos un asistente que ordena un directorio de proveedores de turismo.
Te paso el contenido de la columna "Mail/web" de UNA fila de una planilla hecha a mano, más la
columna "Aclaraciones" y el nombre del proveedor. Tenés que decir cómo se contacta al proveedor.

Reglas estrictas:
- "mails": solo direcciones de mail que aparezcan ESCRITAS COMPLETAS Y LITERALES en el texto.
  Nunca completes, corrijas ni deduzcas un mail (por ejemplo, a partir de un dominio o una web).
- "canal": "mail" si hay al menos un mail literal; "whatsapp" si el texto indica claramente que
  el contacto es solo por WhatsApp; "ninguno" en cualquier otro caso.
- "confianza": número entre 0 y 1. Si dudás, devolvé "ninguno" con confianza baja.`;

function recortar(texto: string): string {
  return texto.length > LARGO_MAXIMO_TEXTO ? texto.slice(0, LARGO_MAXIMO_TEXTO) : texto;
}

function esRespuestaValida(valor: unknown): valor is RespuestaIA {
  if (!valor || typeof valor !== "object") return false;
  const r = valor as Record<string, unknown>;
  return (
    Array.isArray(r.mails) &&
    r.mails.every((m) => typeof m === "string") &&
    (r.canal === "mail" || r.canal === "whatsapp" || r.canal === "ninguno") &&
    typeof r.confianza === "number"
  );
}

export interface ConsultorIA {
  consultar: ConsultarIA;
  estadisticas(): { llamadas: number; cortadasPorTecho: number; errores: number };
}

export function crearConsultorIAMailAmbiguo(opciones: {
  cliente: ClienteMensajesIA;
  registro: RegistroUsoIA;
  mes: string;
  avisar?: (mensaje: string) => void;
}): ConsultorIA {
  const stats = { llamadas: 0, cortadasPorTecho: 0, errores: 0 };
  const costoMaximoLlamada = costoUSD({ tokensIn: TOKENS_ENTRADA_MAXIMOS, tokensOut: MAX_TOKENS });

  async function consultar(consulta: ConsultaIA): Promise<RespuestaIA | null> {
    try {
      const r = await llamarConTecho({
        registro: opciones.registro,
        mes: opciones.mes,
        costoMaximoLlamada,
        avisar: opciones.avisar,
        llamar: async () => {
          stats.llamadas++;
          const mensaje = await opciones.cliente.messages.create({
            model: MODELO_IA,
            max_tokens: MAX_TOKENS,
            thinking: { type: "adaptive" },
            output_config: { format: { type: "json_schema", schema: ESQUEMA_RESPUESTA } },
            system: INSTRUCCIONES,
            messages: [
              {
                role: "user",
                content: [
                  `Proveedor: ${recortar(consulta.nombre)}`,
                  `Mail/web: ${recortar(consulta.textoMailWeb)}`,
                  `Aclaraciones: ${recortar(consulta.aclaraciones) || "(vacío)"}`,
                ].join("\n"),
              },
            ],
          });
          const texto = mensaje.content.find((bloque) => bloque.type === "text");
          return {
            resultado: texto && texto.type === "text" ? texto.text : "",
            uso: { tokensIn: mensaje.usage.input_tokens, tokensOut: mensaje.usage.output_tokens },
          };
        },
      });

      if (!r.llamada) {
        stats.cortadasPorTecho++;
        return null;
      }
      const parseado: unknown = JSON.parse(r.resultado);
      return esRespuestaValida(parseado) ? parseado : null;
    } catch {
      stats.errores++;
      return null;
    }
  }

  return { consultar, estadisticas: () => ({ ...stats }) };
}
