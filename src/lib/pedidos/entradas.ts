/**
 * Las excursiones que se piden "con entradas" (owner, 2026-10-19): solo en las
 * reservas de Journaway, que vendemos con las entradas a los parques incluidas
 * (por ahora, solo San Pedro de Atacama con Horizonte). La lista es
 * `data/excursiones-con-entrada.csv` y la mantiene el owner sin tocar código.
 * Puro, sin base.
 */
import { normalizarTexto } from "@/lib/catalogo/reglas";
import type { ExcursionConEntrada } from "./tipos";

/**
 * Si una excursión va con entradas: alguna fila confirmada ("si") nombra su
 * código de producto o una parte de su nombre (sin mayúsculas ni acentos).
 * Las filas "revisar" no se aplican hasta que el owner las confirme.
 */
export function llevaEntradas(lista: readonly ExcursionConEntrada[], codigo: string | null, texto: string): boolean {
  const nombre = normalizarTexto(texto);
  return lista.some(
    (f) =>
      f.estado === "si" &&
      ((!!f.codigo && !!codigo && f.codigo.toUpperCase() === codigo.toUpperCase()) ||
        (!!f.patron && nombre.includes(normalizarTexto(f.patron)))),
  );
}
