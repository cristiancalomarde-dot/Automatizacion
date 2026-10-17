import { AGENCIA_JOURNAWAY } from "@/lib/catalogo/reglas";
import type { CatalogoParaEmparejar, ProductoDeLista } from "../emparejar/catalogo";

/**
 * Fila 1: nuestros códigos en el mail ("SPAP05", "IGRE01"), como palabra
 * entera y en mayúsculas, contra la tabla `producto`. Sin IA.
 *
 * Un código que no existe ("SPAP99") se reconoce porque empieza como los de
 * Journaway (SPAP, SPAE, IGRE, BUS…): así un vuelo ("LA156") o un registro
 * ("HRB 203540") nunca se toman por códigos.
 */

const TOKEN = /(?<![A-Za-z0-9@._-])([A-Z]{2,5}\d{2,3}[A-Z]{0,3})(?![A-Za-z0-9@-])/g;

/** Las letras con que empiezan los códigos de los productos de Journaway ("SPAP", "IGRE"…). */
export function prefijosJournaway(catalogo: CatalogoParaEmparejar): Set<string> {
  const ids = new Set(catalogo.codigos.filter((c) => c.agencia === AGENCIA_JOURNAWAY).map((c) => c.productoId));
  const prefijos = new Set<string>();
  for (const p of catalogo.productos) {
    if (!ids.has(p.id)) continue;
    const m = /^([A-Z]+)\d/.exec(p.codigo);
    if (m) prefijos.add(m[1]);
  }
  return prefijos;
}

export function codigosDelMail(texto: string, catalogo: CatalogoParaEmparejar): { productos: ProductoDeLista[]; desconocidos: string[] } {
  const porCodigo = new Map(catalogo.productos.map((p) => [p.codigo, p]));
  const prefijos = prefijosJournaway(catalogo);
  const productos: ProductoDeLista[] = [];
  const desconocidos: string[] = [];
  for (const m of texto.matchAll(TOKEN)) {
    const codigo = m[1];
    const producto = porCodigo.get(codigo);
    if (producto) {
      if (!productos.includes(producto)) productos.push(producto);
      continue;
    }
    const prefijo = /^([A-Z]+)\d/.exec(codigo)?.[1];
    if (prefijo && prefijos.has(prefijo) && !desconocidos.includes(codigo)) desconocidos.push(codigo);
  }
  return { productos, desconocidos };
}
