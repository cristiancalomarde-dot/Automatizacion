import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import type { FilaLlamadaIA, RegistroLlamadasIA } from "@/lib/ia/registro-llamadas";
import { parsearMailDeTexto } from "../mail-de-texto";
import type { ClienteMensajesIA, MailParaLeer } from "../extraer";

/**
 * Ayudas de los tests de M2-02: mails de prueba (anonimizados) y respuestas
 * de la IA grabadas con la forma exacta de la API. Nunca llaman a la API.
 */

const DIR = __dirname;

export function mailDePrueba(nombre: string): MailParaLeer {
  return parsearMailDeTexto(readFileSync(join(DIR, "mails", `${nombre}.txt`), "utf-8"));
}

export function textoDePrueba(nombre: string): string {
  return readFileSync(join(DIR, "mails", nombre), "utf-8");
}

export function pdfSintetico(): Uint8Array {
  return new Uint8Array(readFileSync(join(DIR, "booking-statement-sintetico.pdf")));
}

/** La respuesta grabada tal cual vino (o vendría) de la API. */
export function respuestaGrabada(nombre: string): Record<string, unknown> & {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
} {
  return JSON.parse(readFileSync(join(DIR, "respuestas", `${nombre}.json`), "utf-8"));
}

/** La ficha (el JSON de la IA) de una respuesta grabada, para modificarla en un test. */
export function fichaGrabada(nombre: string): Record<string, unknown> {
  const r = respuestaGrabada(nombre);
  const texto = r.content.find((b) => b.type === "text")?.text ?? "";
  return JSON.parse(texto);
}

/** Una respuesta con la forma de la API a partir de una ficha (para variantes de una grabada). */
export function respuestaCon(ficha: unknown, extra: Record<string, unknown> = {}) {
  return {
    ...respuestaGrabada("kilroy-od010d"),
    content: [
      { type: "thinking", thinking: "…", signature: "grabada" },
      { type: "text", text: JSON.stringify(ficha) },
    ],
    ...extra,
  };
}

export function clienteFalso(respuesta: unknown | Error) {
  const create = vi.fn(async () => {
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  });
  return { cliente: { messages: { create } } as unknown as ClienteMensajesIA, create };
}

export function registroFalso(gastoInicial = 0) {
  let gasto = gastoInicial;
  const sumar = vi.fn(async (_mes: string, uso: { costo: number }) => {
    gasto += uso.costo;
  });
  const registro: RegistroUsoIA = { gastoDelMes: async () => gasto, sumar };
  return { registro, sumar, gasto: () => gasto };
}

export function llamadasFalsas() {
  const filas: FilaLlamadaIA[] = [];
  const llamadas: RegistroLlamadasIA = {
    async registrar(fila) {
      filas.push(fila);
    },
  };
  return { llamadas, filas };
}
