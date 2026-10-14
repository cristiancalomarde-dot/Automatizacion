import { TECHO_MENSUAL_USD, type RegistroUsoIA } from "@/lib/ia/techo-gasto";

/**
 * El tope por corrida del modo prueba (spec M2-06 fila 10, regla #3): US$ 2,
 * chequeado ANTES de cada llamada, además del techo mensual de US$ 20.
 *
 * Es un acumulador local envuelto alrededor del registro de `uso_ia` que usa
 * `llamarConTecho`: al preguntar el gasto del mes devuelve lo que haga falta
 * para que el margen que ve `llamarConTecho` sea el menor entre lo que queda
 * del mes y lo que queda de la corrida. El gasto real se suma igual a
 * `uso_ia`. Si una llamada no se hace, `bloqueo()` dice cuál de los dos la
 * frenó.
 */

export const TOPE_CORRIDA_USD = 2;

export type BloqueoGasto = "tope_corrida" | "techo_mensual";

export interface TopeDeCorrida {
  /** El registro para pasarle a la lectura y a la propuesta de IA. */
  registro: RegistroUsoIA;
  /** Lo gastado en esta corrida (US$). */
  gasto(): number;
  /** Cuál límite es el más cercano: el que frena la próxima llamada si no entra. Null si nada se frenó. */
  bloqueo(): BloqueoGasto | null;
}

export function crearTopeDeCorrida(
  registro: RegistroUsoIA,
  opciones: { tope?: number; techo?: number } = {},
): TopeDeCorrida {
  const tope = opciones.tope ?? TOPE_CORRIDA_USD;
  const techo = opciones.techo ?? TECHO_MENSUAL_USD;
  let gastoCorrida = 0;
  let ultimoLimite: BloqueoGasto = "tope_corrida";
  let bloqueado = false;
  let consultas = 0;
  let sumas = 0;

  return {
    registro: {
      async gastoDelMes(mes) {
        // Si la consulta anterior no terminó en una suma, esa llamada no se hizo.
        if (consultas > sumas) bloqueado = true;
        consultas = sumas + 1;
        const delMes = await registro.gastoDelMes(mes);
        const quedaMes = techo - delMes;
        const quedaCorrida = tope - gastoCorrida;
        ultimoLimite = quedaCorrida < quedaMes ? "tope_corrida" : "techo_mensual";
        return techo - Math.min(quedaMes, quedaCorrida);
      },
      async sumar(mes, uso) {
        sumas = consultas;
        gastoCorrida += uso.costo;
        await registro.sumar(mes, uso);
      },
    },
    gasto: () => gastoCorrida,
    bloqueo: () => (bloqueado || consultas > sumas ? ultimoLimite : null),
  };
}
