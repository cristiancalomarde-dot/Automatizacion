"use client";

import { useMemo, useState } from "react";
import ui from "./ui.module.css";

/** Tablas ordenables por columna (marca.md §4). Orden en memoria: las listas son chicas. */
export function useOrden<C extends string>(inicial: C) {
  const [columna, setColumna] = useState<C>(inicial);
  const [ascendente, setAscendente] = useState(true);

  return useMemo(
    () => ({
      columna,
      ascendente,
      alternar(c: C) {
        if (c === columna) {
          setAscendente(!ascendente);
        } else {
          setColumna(c);
          setAscendente(true);
        }
      },
      ordenar<T>(filas: T[], valor: Record<C, (fila: T) => string | number>): T[] {
        const leer = valor[columna];
        const signo = ascendente ? 1 : -1;
        return [...filas].sort((a, b) => {
          const va = leer(a);
          const vb = leer(b);
          const cmp =
            typeof va === "number" && typeof vb === "number"
              ? va - vb
              : String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
          return cmp * signo;
        });
      },
    }),
    [columna, ascendente],
  );
}

export function EncabezadoOrdenable<C extends string>({
  orden,
  columna,
  texto,
  numero = false,
}: {
  orden: { columna: C; ascendente: boolean; alternar: (c: C) => void };
  columna: C;
  texto: string;
  numero?: boolean;
}) {
  const activa = orden.columna === columna;
  return (
    <th
      scope="col"
      className={numero ? ui.numero : undefined}
      aria-sort={activa ? (orden.ascendente ? "ascending" : "descending") : "none"}
    >
      <button type="button" className={ui.ordenar} onClick={() => orden.alternar(columna)}>
        {texto}
        {activa ? (orden.ascendente ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}
