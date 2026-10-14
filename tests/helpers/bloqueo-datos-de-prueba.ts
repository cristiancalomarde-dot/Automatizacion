import { closeSync, openSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Los archivos de test que crean reservas de prueba comparten la base: cada
 * uno borra solo lo suyo (registro-de-prueba.ts, migración 0013), pero el
 * mismo intercambio (M2-04) busca entre TODAS las reservas de prueba de la
 * agencia, así que dos archivos que procesan los mismos mails a la vez se
 * cruzarían. Este candado (un archivo creado en exclusiva en el tmp de la
 * máquina) hace que esos archivos corran de a uno. Un candado de más de 10
 * minutos se da por abandonado.
 */
const RUTA = join(tmpdir(), "hi-travel-datos-de-prueba.lock");
const ABANDONADO_MS = 10 * 60 * 1000;

export async function tomarBloqueoDatosDePrueba(esperaMaximaMs = 5 * 60 * 1000): Promise<() => void> {
  const inicio = Date.now();
  for (;;) {
    try {
      closeSync(openSync(RUTA, "wx"));
      return () => {
        try {
          unlinkSync(RUTA);
        } catch {
          // ya no estaba
        }
      };
    } catch {
      try {
        if (Date.now() - statSync(RUTA).mtimeMs > ABANDONADO_MS) unlinkSync(RUTA);
      } catch {
        // lo soltó otro mientras mirábamos
      }
      if (Date.now() - inicio > esperaMaximaMs) {
        throw new Error("No se pudo tomar el candado de datos de prueba (otro test lo tiene).");
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}
