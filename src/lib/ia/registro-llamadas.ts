import type { TareaIA } from "./modelos";

/**
 * Registro de cada llamada a la IA (spec M2-02 fila 29; tabla `ia_llamada`,
 * migración 0010): qué tarea, qué modelo, qué versión de instrucciones,
 * tokens, costo y cómo terminó. **Nunca el contenido del mail** (ese ya está
 * en `mail_recibido`). `uso_ia` sigue sumando el gasto del mes para el techo.
 */

export type ResultadoLlamadaIA = "ok" | "cortada" | "invalida" | "error" | "sin_presupuesto";

export interface FilaLlamadaIA {
  tarea: TareaIA;
  modelo: string;
  versionInstrucciones: string;
  tokensIn: number;
  tokensOut: number;
  costoUsd: number;
  resultado: ResultadoLlamadaIA;
  mailRecibidoId: string | null;
  dePrueba: boolean;
}

export interface RegistroLlamadasIA {
  registrar(fila: FilaLlamadaIA): Promise<void>;
}
