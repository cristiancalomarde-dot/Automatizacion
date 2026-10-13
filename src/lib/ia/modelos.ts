/**
 * El modelo de cada tarea de IA y su precio, en UN solo lugar (spec M2-02
 * fila 25; `docs/arquitectura/integraciones-ia.md`, "El modelo: uno por
 * tarea"). Ningún otro archivo de `src/` escribe el nombre de un modelo.
 *
 * Cambiar de modelo = cambiar una línea acá y correr `npm run eval:lectura`.
 * El techo de gasto (regla #3) usa estos precios para el peor caso y para el
 * costo real de cada llamada.
 *
 * Precios en US$ por millón de tokens, tarifa estándar (sin caché ni batch).
 * Fuente: página oficial de precios de Anthropic
 * (https://platform.claude.com/docs/en/about-claude/pricing), consultada el
 * 2026-10-13: Sonnet 5.5 US$ 2 / US$ 10; Opus 5.5 US$ 4 / US$ 20; Sonnet 5
 * US$ 2 / US$ 10.
 */

export interface PreciosModelo {
  entradaPorMillon: number;
  salidaPorMillon: number;
}

export const PRECIOS_POR_MODELO: Readonly<Record<string, PreciosModelo>> = {
  "claude-sonnet-5-5": { entradaPorMillon: 2, salidaPorMillon: 10 },
  "claude-opus-5-5": { entradaPorMillon: 4, salidaPorMillon: 20 },
  "claude-sonnet-5": { entradaPorMillon: 2, salidaPorMillon: 10 },
};

export type TareaIA = "lectura_mail" | "propuesta_producto" | "importador";

export interface ModeloDeTarea {
  modelo: string;
  precios: PreciosModelo;
}

export function preciosDelModelo(modelo: string): PreciosModelo {
  const precios = PRECIOS_POR_MODELO[modelo];
  if (!precios) throw new Error(`No hay precio cargado para el modelo "${modelo}" (src/lib/ia/modelos.ts).`);
  return precios;
}

function deTarea(modelo: string): ModeloDeTarea {
  return { modelo, precios: preciosDelModelo(modelo) };
}

export const MODELOS: Readonly<Record<TareaIA, ModeloDeTarea>> = {
  lectura_mail: deTarea("claude-sonnet-5-5"),
  propuesta_producto: deTarea("claude-sonnet-5-5"),
  importador: deTarea("claude-sonnet-5-5"),
};
