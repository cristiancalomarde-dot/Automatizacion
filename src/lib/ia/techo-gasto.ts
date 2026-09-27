/**
 * Regla #3 — techo de gasto de IA, chequeado ANTES de cada llamada
 * (docs/arquitectura/integraciones-ia.md).
 *
 * - Techo mensual: US$ 20. Al 80% avisa; si la llamada podría pasarse del
 *   techo, NO se hace (quien llama cae a su camino manual: "sin mail",
 *   "para revisar", etc. — nunca se inventa un dato).
 * - El gasto acumulado del mes vive en la tabla `uso_ia` (ver
 *   `registro-uso-ia-supabase.ts`); este módulo no conoce la base: recibe un
 *   `RegistroUsoIA`, así se prueba sin red.
 */

export const TECHO_MENSUAL_USD = 20;
export const UMBRAL_AVISO = 0.8;

/** Precios de `claude-sonnet-5` en US$ por millón de tokens (integraciones-ia.md, Anexo técnico). */
export const PRECIOS_SONNET_5 = { entradaPorMillon: 2, salidaPorMillon: 10 };

export interface UsoTokens {
  tokensIn: number;
  tokensOut: number;
}

export interface RegistroUsoIA {
  /** Gasto acumulado (US$) del mes `AAAA-MM`. */
  gastoDelMes(mes: string): Promise<number>;
  /** Suma el uso de una llamada al acumulado del mes. */
  sumar(mes: string, uso: UsoTokens & { costo: number }): Promise<void>;
}

export function costoUSD(uso: UsoTokens, precios = PRECIOS_SONNET_5): number {
  return (
    (uso.tokensIn * precios.entradaPorMillon + uso.tokensOut * precios.salidaPorMillon) / 1_000_000
  );
}

export function mesActual(ahora: Date = new Date()): string {
  return ahora.toISOString().slice(0, 7);
}

export type ResultadoConTecho<T> =
  | { llamada: true; resultado: T; costo: number }
  | { llamada: false; motivo: "techo" };

export async function llamarConTecho<T>(opciones: {
  registro: RegistroUsoIA;
  mes: string;
  /** Peor caso de costo de ESTA llamada (entrada estimada + `max_tokens` de salida). */
  costoMaximoLlamada: number;
  llamar: () => Promise<{ resultado: T; uso: UsoTokens }>;
  techo?: number;
  avisar?: (mensaje: string) => void;
}): Promise<ResultadoConTecho<T>> {
  const techo = opciones.techo ?? TECHO_MENSUAL_USD;
  const gastoPrevio = await opciones.registro.gastoDelMes(opciones.mes);

  if (gastoPrevio + opciones.costoMaximoLlamada > techo) {
    return { llamada: false, motivo: "techo" };
  }

  const { resultado, uso } = await opciones.llamar();
  const costo = costoUSD(uso);
  await opciones.registro.sumar(opciones.mes, { ...uso, costo });

  const gastoNuevo = gastoPrevio + costo;
  if (gastoNuevo >= techo * UMBRAL_AVISO) {
    opciones.avisar?.(
      `Gasto de IA del mes ${opciones.mes}: US$ ${gastoNuevo.toFixed(2)} de US$ ${techo} (80% o más del techo).`,
    );
  }

  return { llamada: true, resultado, costo };
}
