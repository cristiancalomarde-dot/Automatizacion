/**
 * Códigos de TourRadar (spec M1-04 §3 #8). No están en el Excel de paquetes:
 * vienen de "Insumos/Codigos Productos Tourradar.xlsx", columnas
 * "Codigo TR" · "Nombre en Tourradar" · "Nuestro Codigo".
 *
 * El nombre se conserva tal cual (solo sin espacios en los bordes): los PDF de
 * reserva de TourRadar traen el nombre del tour y no el código, así que M2
 * empareja por ese texto exacto.
 */

export interface CodigoTourRadar {
  codigo: string;
  nombre: string;
  nuestroCodigo: string;
}

const COLUMNAS = { codigo: "codigo tr", nombre: "nombre en tourradar", nuestroCodigo: "nuestro codigo" };

function rotulo(celda: unknown): string {
  return String(celda ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function leerCodigosTourRadar(filas: unknown[][]): CodigoTourRadar[] {
  const iEncabezado = filas.findIndex((f) => (f ?? []).map(rotulo).includes(COLUMNAS.codigo));
  const encabezado = iEncabezado === -1 ? [] : filas[iEncabezado].map(rotulo);
  const col = {
    codigo: encabezado.indexOf(COLUMNAS.codigo),
    nombre: encabezado.indexOf(COLUMNAS.nombre),
    nuestroCodigo: encabezado.indexOf(COLUMNAS.nuestroCodigo),
  };
  if (iEncabezado === -1 || col.nombre === -1 || col.nuestroCodigo === -1) {
    throw new Error('El archivo de códigos TourRadar no tiene las columnas "Codigo TR", "Nombre en Tourradar" y "Nuestro Codigo".');
  }

  const codigos: CodigoTourRadar[] = [];
  for (const fila of filas.slice(iEncabezado + 1)) {
    const codigo = String(fila?.[col.codigo] ?? "").trim();
    const nuestroCodigo = String(fila?.[col.nuestroCodigo] ?? "").trim();
    if (!codigo || !nuestroCodigo) continue;
    codigos.push({ codigo, nombre: String(fila[col.nombre] ?? "").trim(), nuestroCodigo });
  }
  return codigos;
}
