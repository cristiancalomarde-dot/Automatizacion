// Los tests y los scripts de prueba borran solo lo que crearon (migración
// 0013, `borrarDatosDePruebaDe`). `borrarDatosDePrueba()` borra TODO lo "de
// prueba", también las reservas del modo prueba (M2-06) que revisa el owner:
// la usa solo el `--borrar` del modo prueba. Este test falla si un test o un
// script de prueba vuelve a llamarla.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(n) ? [ruta] : [];
  });
}

/** Llamar al borrado de TODO: la función del servidor o el rpc directo con la service role. */
const BORRA_TODO = [
  /\bborrarDatosDePrueba\s*\(/,
  /\bborrarTodoLoDePrueba\s*\(/,
  /\badmin\.rpc\(\s*["']borrar_datos_de_prueba["']/,
];

/**
 * Las únicas excepciones (M2-06): el `--borrar` explícito del modo prueba, y
 * el test de ese `--borrar` (fila 8), que solo corre si no hay otros datos de
 * prueba cargados (si los hay, se saltea).
 */
const PERMITIDOS = new Set(["scripts/probar-mails.ts", "tests/modo-prueba-m2-06.integration.test.ts"]);

/** El código sin las líneas de comentario (los comentarios pueden nombrar la función). */
function codigo(ruta: string): string {
  return readFileSync(ruta, "utf-8")
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join("\n");
}

describe("la limpieza de los tests es acotada", () => {
  const revisados = [...archivos(join(RAIZ, "tests")), ...archivos(join(RAIZ, "scripts"))].filter(
    (r) => !r.endsWith("limpieza-acotada.test.ts"),
  );

  it("hay archivos para revisar", () => {
    expect(revisados.length).toBeGreaterThan(10);
  });

  it("ningún test ni script llama al borrado de todo lo de prueba", () => {
    const culpables = revisados
      .filter((r) => !PERMITIDOS.has(relative(RAIZ, r).split("\\").join("/")))
      .filter((r) => BORRA_TODO.some((p) => p.test(codigo(r))));
    expect(culpables.map((r) => relative(RAIZ, r))).toEqual([]);
  });
});
