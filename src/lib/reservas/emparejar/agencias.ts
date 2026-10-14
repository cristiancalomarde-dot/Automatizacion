/**
 * Cómo escribe cada agencia el código del producto (spec M2-03 fila 15).
 *
 * Cada agencia declara un lector: si usa código y qué códigos buscar en
 * `codigo_externo` (de ESA agencia) a partir de lo que trae el mail. Los tres
 * pasos del emparejado (`emparejar.ts`) son los mismos para todas: sumar una
 * agencia (Journaway en M2-09) es sumar su lector y sus filas, sin tocar el
 * núcleo. Ningún lector busca "parecidos": devuelve códigos para comparar
 * con `===`.
 */

export interface LectorDeAgencia {
  /** false = la agencia no manda código (TourRadar): se empareja por nombre o con la IA. */
  usaCodigo: boolean;
  /** Los códigos a buscar, en orden, para lo que trajo el mail. */
  codigosCandidatos(codigoDelMail: string): string[];
}

/** El código tal cual (sin espacios a los costados). La regla por defecto de una agencia nueva. */
export const LECTOR_CODIGO_EXACTO: LectorDeAgencia = {
  usaCodigo: true,
  codigosCandidatos: (c) => [c.trim()].filter(Boolean),
};

/**
 * Un código con un envoltorio fijo: lo que captura el primer grupo, y además
 * el código completo tal cual (para las filas declaradas en
 * `data/codigos-kilroy.csv`, que no siguen la regla).
 */
export function lectorPorEnvoltorio(envoltorio: RegExp): LectorDeAgencia {
  return {
    usaCodigo: true,
    codigosCandidatos(codigo) {
      const completo = codigo.trim();
      if (!completo) return [];
      const m = envoltorio.exec(completo);
      return m && m[1] && m[1] !== completo ? [m[1], completo] : [completo];
    },
  };
}

/** Kilroy: `HI_ARGENTINA_OD010D-677`, `HI_TRAVEL_5C01-677` → `OD010D`, `5C01`. */
export const ENVOLTORIO_KILROY = /^HI_(?:ARGENTINA|TRAVEL)_(.+)-677$/;

export const LECTORES_POR_AGENCIA: Readonly<Record<string, LectorDeAgencia>> = {
  Kilroy: lectorPorEnvoltorio(ENVOLTORIO_KILROY),
  TourRadar: { usaCodigo: false, codigosCandidatos: () => [] },
};

export function lectorDe(agencia: string, lectores: Readonly<Record<string, LectorDeAgencia>> = LECTORES_POR_AGENCIA): LectorDeAgencia {
  return lectores[agencia] ?? LECTOR_CODIGO_EXACTO;
}
