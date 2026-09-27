import type Anthropic from "@anthropic-ai/sdk";
import { costoUSD, llamarConTecho, type RegistroUsoIA } from "@/lib/ia/techo-gasto";
import type { ConsultaBloqueIA, InterpretarBloque, RespuestaBloqueIA } from "./plan";

/**
 * Respaldo de IA para UN bloque de producto (o sus líneas puntuales) que las
 * reglas simples no leen (spec M1-04 §3 #10). Nunca se le pasa la hoja entera;
 * cada llamada pasa antes por el techo de gasto (regla #3,
 * docs/arquitectura/integraciones-ia.md).
 *
 * La respuesta NO se guarda tal cual: `planificarProductos` descarta todo lo
 * que no venga con confianza suficiente o nombre proveedores que no estén
 * escritos literalmente en el bloque.
 */

export const MODELO_IA = "claude-sonnet-5";
const MAX_TOKENS = 2000;
/** Peor caso de entrada: prompt fijo + sección 1 de un bloque (acotada abajo). */
const TOKENS_ENTRADA_MAXIMOS = 4000;
const LARGO_MAXIMO_BLOQUE = 8000;

export type ClienteMensajesIA = Pick<Anthropic, "messages">;

const TIPOS = ["alojamiento", "excursion", "traslado", "bus", "crucero", "otro"] as const;

const ESQUEMA_RESPUESTA = {
  type: "object",
  properties: {
    servicios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          linea: { type: "string" },
          tipo: { type: "string", enum: TIPOS },
          opciones: {
            type: "array",
            items: {
              type: "object",
              properties: {
                service_provider: { type: "string" },
                booking_supplier: { anyOf: [{ type: "string" }, { type: "null" }] },
              },
              required: ["service_provider", "booking_supplier"],
              additionalProperties: false,
            },
          },
        },
        required: ["linea", "tipo", "opciones"],
        additionalProperties: false,
      },
    },
    lineas_sin_servicio: { type: "array", items: { type: "string" } },
    confianza: { type: "number" },
  },
  required: ["servicios", "lineas_sin_servicio", "confianza"],
  additionalProperties: false,
} as const;

const INSTRUCCIONES = `Sos un asistente que lee la planilla maestra de paquetes turísticos de HI Travel.
Te paso la sección 1 ("Construcción del producto") de UN bloque de producto, celda por celda
("B5: texto"). Tenés que listar los servicios que componen el producto y quién los presta.

Reglas de la planilla (autoridad: hoja "Readme AI" del archivo):
- Una línea de servicio suele ser "<Tipo>: <Service Provider>. Booking Supplier: <Booking Supplier>".
  Tipos: Accommodation=alojamiento, Excursion=excursion, Transfer=traslado, Bus=bus,
  Cruise=crucero, cualquier otro=otro.
- Service Provider = quien presta el servicio. Booking Supplier = a quién se le pide la reserva.
  A veces son la misma empresa, a veces no. Si el Booking Supplier no está escrito, devolvé null.
- Varios nombres separados por "/" = opciones en orden de prioridad de reserva: van como varias
  "opciones" del MISMO servicio, en ese orden.
- Varios nombres unidos por "+" (ej. "2 Nights A + 1 night B") = servicios distintos en secuencia.
- Las filas de tarifas (Dorm, DBL, SGL…), números, costos y rótulos no son servicios.
- Las filas en blanco son intencionales.

Reglas estrictas:
- "linea": copiá EXACTA la línea de la planilla de la que sale el servicio (sin el "B5: ").
- Nombres de proveedores: solo como están ESCRITOS en esa línea. Nunca completes, corrijas ni
  deduzcas un proveedor que no esté escrito.
- Si te pido interpretar solo algunas líneas, respondé solo sobre esas: cada una va a "servicios"
  (si es un servicio) o a "lineas_sin_servicio" (si no lo es).
- "confianza": número entre 0 y 1. Si dudás, devolvé confianza baja.`;

function recortar(texto: string): string {
  return texto.length > LARGO_MAXIMO_BLOQUE ? texto.slice(0, LARGO_MAXIMO_BLOQUE) : texto;
}

function esRespuestaValida(valor: unknown): valor is RespuestaBloqueIA {
  if (!valor || typeof valor !== "object") return false;
  const r = valor as Record<string, unknown>;
  const esTexto = (x: unknown) => typeof x === "string";
  return (
    typeof r.confianza === "number" &&
    Array.isArray(r.lineas_sin_servicio) &&
    r.lineas_sin_servicio.every(esTexto) &&
    Array.isArray(r.servicios) &&
    r.servicios.every((s: unknown) => {
      const x = s as Record<string, unknown>;
      return (
        !!x &&
        esTexto(x.linea) &&
        (TIPOS as readonly string[]).includes(x.tipo as string) &&
        Array.isArray(x.opciones) &&
        x.opciones.every((o: unknown) => {
          const op = o as Record<string, unknown>;
          return !!op && esTexto(op.service_provider) && (op.booking_supplier === null || esTexto(op.booking_supplier));
        })
      );
    })
  );
}

function mensajeUsuario(consulta: ConsultaBloqueIA): string {
  const partes = [
    `Producto: ${consulta.codigo} — ${consulta.nombre}`,
    `Sección 1 del bloque:\n${recortar(consulta.textoBloque)}`,
  ];
  partes.push(
    consulta.lineasDudosas
      ? `Interpretá SOLO estas líneas (el resto del bloque ya se leyó):\n${consulta.lineasDudosas.map((l) => `- ${l}`).join("\n")}`
      : "La estructura de este bloque no calza con la esperada (puede tener columnas corridas): listá todos sus servicios.",
  );
  return partes.join("\n\n");
}

export interface ConsultorIABloque {
  interpretar: InterpretarBloque;
  estadisticas(): { llamadas: number; cortadasPorTecho: number; errores: number };
}

export function crearConsultorIABloque(opciones: {
  cliente: ClienteMensajesIA;
  registro: RegistroUsoIA;
  mes: string;
  avisar?: (mensaje: string) => void;
}): ConsultorIABloque {
  const stats = { llamadas: 0, cortadasPorTecho: 0, errores: 0 };
  const costoMaximoLlamada = costoUSD({ tokensIn: TOKENS_ENTRADA_MAXIMOS, tokensOut: MAX_TOKENS });

  async function interpretar(consulta: ConsultaBloqueIA): Promise<RespuestaBloqueIA | null> {
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
            messages: [{ role: "user", content: mensajeUsuario(consulta) }],
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

  return { interpretar, estadisticas: () => ({ ...stats }) };
}
