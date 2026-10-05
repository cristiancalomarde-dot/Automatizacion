import type { ResumenImportacionProductos } from "./importar";

/** `importacion.tipo_corrida` de la carga de los paquetes de los tours (M1-04d). */
export const TIPO_CORRIDA_PAQUETES = "paquetes-de-los-tours";

/**
 * Lo que la corrida dejó para revisar además de los proveedores (spec M1-04d
 * §3 #10): bloques no encontrados o que no calzan, renglones que no se
 * entendieron, alojamientos sin nivel y niveles confirmados que no
 * encontraron su línea. En lenguaje llano, una línea por punto.
 */
export function otrosPuntosDeLaCarga(r: ResumenImportacionProductos): string[] {
  const puntos: string[] = [];
  for (const c of r.codigosNoEncontrados) puntos.push(`${c}: no encontré su bloque en el Excel de paquetes.`);
  for (const p of r.productos) {
    if (p.bloqueParaRevisar) puntos.push(`${p.codigo}: el bloque no tiene la forma esperada; no cargué sus servicios.`);
    for (const l of p.lineasParaRevisar) {
      puntos.push(`${p.codigo} (fila ${l.fila}): no entendí el renglón “${l.texto}” (${l.motivo}); no lo cargué.`);
    }
    for (const n of p.nivelesParaRevisar) {
      puntos.push(
        n.fila !== null
          ? `${p.codigo} (fila ${n.fila}): el alojamiento “${n.texto}” no dice su categoría (Hostel, Budget, 3*, 4*).`
          : `${p.codigo}: la tabla de precios nombra “${n.nivel}”, que podría ser uno de los alojamientos sin categoría.`,
      );
    }
    for (const c of p.nivelesConfirmadosSinLinea) {
      puntos.push(`${p.codigo}: la categoría confirmada “${c.nivel}” no encontró su renglón (“${c.texto_linea}”).`);
    }
  }
  return puntos;
}
