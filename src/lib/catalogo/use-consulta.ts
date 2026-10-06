"use client";

import { useEffect, useRef, useState } from "react";

export type EstadoConsulta<T> = { tipo: "cargando" } | { tipo: "error" } | { tipo: "listo"; datos: T };

/**
 * Corre una consulta al montar y la repite con `reintentar` (user-flow.md
 * §7: los errores ofrecen "Reintentar"). Mientras carga, la pantalla muestra
 * su esqueleto; si falla, su mensaje de error. Nunca datos parciales.
 */
export function useConsulta<T>(consultar: () => Promise<T>) {
  const [estado, setEstado] = useState<EstadoConsulta<T>>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);
  const consultarRef = useRef(consultar);

  useEffect(() => {
    consultarRef.current = consultar;
  });

  useEffect(() => {
    let vigente = true;
    consultarRef.current().then(
      (datos) => {
        if (vigente) setEstado({ tipo: "listo", datos });
      },
      () => {
        if (vigente) setEstado({ tipo: "error" });
      },
    );
    return () => {
      vigente = false;
    };
  }, [intento]);

  function reintentar() {
    setEstado({ tipo: "cargando" });
    setIntento((n) => n + 1);
  }

  return { estado, reintentar };
}
