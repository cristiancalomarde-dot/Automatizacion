import type { PaqueteJournaway } from "./tipos";

/**
 * Fila 4 y 5: la combinación de paquetes que usa TODOS los tours de la lista,
 * cada uno una sola vez, sin que sobre ni falte ninguno. Fuerza bruta: son
 * pocos paquetes y pocas excursiones. Devuelve todas las que cierran (para
 * poder decir "hay más de una") y, si ninguna cierra, las que más tours usan
 * sin pasarse (para decir qué sobra). Los traslados no cuentan: no vienen en
 * la lista del mail.
 */

/** Las excursiones que pide un paquete (sin los traslados), por producto. */
export function excursionesDe(paquete: PaqueteJournaway): string[] {
  return paquete.partes.filter((p) => !p.esTraslado).map((p) => p.productoId);
}

function contar(ids: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

export interface ResultadoCombinacion {
  exactas: PaqueteJournaway[][];
  /** Si no hay exactas: las combinaciones que más tours usan, y cuántos usan. */
  mejores: PaqueteJournaway[][];
  usados: number;
}

export function combinarPaquetes(tours: readonly string[], paquetes: readonly PaqueteJournaway[]): ResultadoCombinacion {
  const quedan = contar(tours);
  const candidatos = paquetes.filter((p) => {
    const pide = contar(excursionesDe(p));
    return pide.size > 0 && [...pide].every(([id, n]) => (quedan.get(id) ?? 0) >= n);
  });

  const exactas: PaqueteJournaway[][] = [];
  let mejores: PaqueteJournaway[][] = [];
  let usados = 0;
  const elegidos: PaqueteJournaway[] = [];
  let usadosAhora = 0;

  const recorrer = (desde: number) => {
    if (usadosAhora === tours.length && elegidos.length) exactas.push([...elegidos]);
    if (elegidos.length) {
      if (usadosAhora > usados) {
        usados = usadosAhora;
        mejores = [[...elegidos]];
      } else if (usadosAhora === usados) mejores.push([...elegidos]);
    }
    for (let i = desde; i < candidatos.length; i++) {
      const pide = excursionesDe(candidatos[i]);
      const alcanza = [...contar(pide)].every(([id, n]) => (quedan.get(id) ?? 0) >= n);
      if (!alcanza) continue;
      for (const id of pide) quedan.set(id, quedan.get(id)! - 1);
      elegidos.push(candidatos[i]);
      usadosAhora += pide.length;
      recorrer(i + 1);
      usadosAhora -= pide.length;
      elegidos.pop();
      for (const id of pide) quedan.set(id, quedan.get(id)! + 1);
    }
  };
  recorrer(0);
  return { exactas, mejores: exactas.length ? [] : mejores, usados: exactas.length ? tours.length : usados };
}

/**
 * Reparte los tours entre los paquetes de la combinación: cada paquete se
 * lleva, en el orden del mail, un tour por cada excursión que pide.
 */
export function repartirTours<T extends { productoId: string | null }>(
  tours: readonly T[],
  paquetes: readonly PaqueteJournaway[],
): Array<{ paquete: PaqueteJournaway; tours: T[] }> {
  const libres = [...tours];
  return paquetes.map((paquete) => {
    const propios: T[] = [];
    for (const id of excursionesDe(paquete)) {
      const i = libres.findIndex((t) => t.productoId === id);
      if (i >= 0) propios.push(...libres.splice(i, 1));
    }
    return { paquete, tours: propios.sort((a, b) => tours.indexOf(a) - tours.indexOf(b)) };
  });
}
