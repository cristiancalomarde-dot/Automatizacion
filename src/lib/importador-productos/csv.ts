/**
 * Lector de CSV mínimo (RFC 4180: comas, comillas y comillas dobladas) para
 * las listas chicas que revisa el owner a mano (spec M1-04b:
 * `data/equivalencias-proveedores.csv`, `data/niveles-confirmados.csv`).
 *
 * Devuelve un objeto por fila, con las claves del encabezado. Ignora las
 * líneas en blanco. Una fila con otra cantidad de columnas que el encabezado
 * es un error explícito (con su número de fila, 1 = encabezado): nunca se
 * adivina qué columna es cuál.
 */
export function leerCsv(texto: string): Array<Record<string, string>> {
  const registros = partirRegistros(texto.replace(/^﻿/, ""));
  if (registros.length === 0) return [];
  const [encabezado, ...resto] = registros;
  const columnas = encabezado.campos.map((c) => c.trim());
  return resto
    .filter((r) => !(r.campos.length === 1 && r.campos[0].trim() === ""))
    .map((r) => {
      if (r.campos.length !== columnas.length) {
        throw new Error(
          `CSV: la fila ${r.fila} tiene ${r.campos.length} columnas y el encabezado ${columnas.length}.`,
        );
      }
      return Object.fromEntries(columnas.map((c, i) => [c, r.campos[i]]));
    });
}

function partirRegistros(texto: string): Array<{ fila: number; campos: string[] }> {
  const registros: Array<{ fila: number; campos: string[] }> = [];
  let campos: string[] = [];
  let campo = "";
  let entreComillas = false;
  let fila = 1;
  let filaInicio = 1;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        if (c === "\n") fila++;
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      campos.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      campos.push(campo);
      registros.push({ fila: filaInicio, campos });
      campos = [];
      campo = "";
      fila++;
      filaInicio = fila;
    } else {
      campo += c;
    }
  }
  if (entreComillas) throw new Error(`CSV: comillas sin cerrar desde la fila ${filaInicio}.`);
  if (campo !== "" || campos.length > 0) {
    campos.push(campo);
    registros.push({ fila: filaInicio, campos });
  }
  return registros;
}
