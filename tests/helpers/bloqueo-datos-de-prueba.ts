import { closeSync, openSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `borrar_datos_de_prueba()` (migración 0010) borra TODO lo que tiene la marca
 * "de prueba" en la base compartida. Vitest corre los archivos de test en
 * paralelo: si dos archivos que crean reservas de prueba se pisan, la limpieza
 * de uno le borra los datos al otro a mitad de camino. Este candado (un
 * archivo creado en exclusiva en el tmp de la máquina) hace que esos archivos
 * corran de a uno. Un candado de más de 10 minutos se da por abandonado.
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
