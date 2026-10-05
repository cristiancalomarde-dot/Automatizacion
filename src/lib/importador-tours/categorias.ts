import type { CategoriaTour } from "./datos";
import { normalizarCategoria } from "./rutas";

/**
 * Categorías tour ↔ paquete (spec M1-05 §3 #8). Por cada categoría que vende
 * el tour (su tabla de precios en RutasenBus), cada componente tiene que
 * tener una categoría equivalente: la que dice `data/categorias-tour.csv` o,
 * si no dice nada, la misma. Lo que falta se lista para el owner; el tour se
 * carga igual.
 *
 * - Un paquete sin alojamiento (ej. el Overland COMPBO20) no se controla.
 * - Un tour anidado (CHB31 dentro de 5C01) se controla contra las categorías
 *   que vende ese tour.
 */

export interface ComponenteConCategorias {
  codigo: string;
  /** Categorías disponibles (niveles de alojamiento del paquete, o las que vende el tour anidado). */
  categorias: string[];
}

export interface CategoriaFaltante {
  tour: string;
  categoriaTour: string;
  componente: string;
  buscada: string;
  /** true = la equivalencia vino de categorias-tour.csv. */
  porArchivo: boolean;
  disponibles: string[];
}

export function verificarCategorias(
  tour: string,
  categoriasTour: string[],
  componentes: ComponenteConCategorias[],
  equivalencias: CategoriaTour[],
): CategoriaFaltante[] {
  const faltantes: CategoriaFaltante[] = [];
  for (const categoria of categoriasTour.map(normalizarCategoria)) {
    for (const c of componentes) {
      const disponibles = [...new Set(c.categorias.map(normalizarCategoria))];
      if (disponibles.length === 0) continue;
      const eq = equivalencias.find(
        (e) => e.tour === tour && e.componente === c.codigo && e.categoriaTour === categoria,
      );
      const buscada = eq?.categoriaPaquete ?? categoria;
      if (!disponibles.includes(buscada)) {
        faltantes.push({ tour, categoriaTour: categoria, componente: c.codigo, buscada, porArchivo: !!eq, disponibles });
      }
    }
  }
  return faltantes;
}
