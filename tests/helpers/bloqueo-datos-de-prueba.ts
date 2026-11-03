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

export async function tomarBloqueoDatosDePrueba(esperaMaximaMs = 5 * 60 * 1000, ruta = RUTA): Promise<() => void> {
  const inicio = Date.now();
  for (;;) {
    try {
      closeSync(openSync(ruta, "wx"));
      return () => {
        try {
          unlinkSync(ruta);
        } catch {
          // ya no estaba
        }
      };
    } catch {
      try {
        if (Date.now() - statSync(ruta).mtimeMs > ABANDONADO_MS) unlinkSync(ruta);
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

/**
 * M3-47: las "variantes" de M2-08 cambian FTEE04 y FTEE05 un rato y lo deshacen. Las fotos de "lo que
 * ya estaba" de M3-10 y M3-23 no se pueden sacar en ese rato: la foto de antes queda con el dato de
 * prueba y nunca coincide con la de después. Candado aparte, para no esperar a los recorridos.
 */
export function tomarBloqueoVariantesCatalogo(): Promise<() => void> {
  return tomarBloqueoDatosDePrueba(5 * 60 * 1000, join(tmpdir(), "hi-travel-variantes-catalogo.lock"));
}
