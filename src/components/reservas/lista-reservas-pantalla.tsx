"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { formatearFechaHora, formatearRango } from "@/lib/formato";
import { cargarReservas } from "@/lib/reservas/consultas";
import { contarReservas, ordenarPorLlegada } from "@/lib/reservas/reglas";
import type { FilaReserva } from "@/lib/reservas/tipos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { EsqueletoTabla, EstadoError, EstadoVacio } from "@/components/ui/estados";
import { EncabezadoOrdenable, useOrden } from "@/components/ui/orden";
import ui from "@/components/ui/ui.module.css";
import { ChipEstado, MarcasReserva } from "./marcas";
import estilos from "./reservas.module.css";

const T = TEXTOS.reservas;
const SIN_DATO = TEXTOS.comunes.sinDato;

type Columna = "estado" | "agencia" | "numero" | "producto" | "fechas" | "pax" | "llego";

const VALOR: Record<Columna, (f: FilaReserva) => string | number> = {
  estado: (f) => T.estados[f.estado],
  agencia: (f) => f.agencia,
  numero: (f) => f.numero ?? "",
  producto: (f) => (f.producto ? `${f.producto.codigo} ${f.producto.nombre}` : "~"),
  fechas: (f) => f.fechaInicio ?? "9999",
  pax: (f) => f.pax ?? -1,
  llego: (f) => Date.parse(f.llego) || 0,
};

/** Reservas: la pantalla de inicio (spec M2-05 #1 a #4, #16). Solo para mirar. */
export function ListaReservasPantalla() {
  const { estado, reintentar } = useConsulta(() => cargarReservas(createSupabaseBrowserClient()));
  const conteo = estado.tipo === "listo" ? contarReservas(estado.datos) : null;

  return (
    <div className={ui.pagina}>
      <div className={ui.encabezado}>
        <h1 className={ui.titulo}>{T.titulo}</h1>
        {conteo && conteo.total > 0 ? <span className={ui.meta}>{T.total(conteo.total, conteo.dePrueba)}</span> : null}
      </div>

      {estado.tipo === "cargando" ? <EsqueletoTabla etiqueta={T.cargando} columnas={7} /> : null}
      {estado.tipo === "error" ? <EstadoError mensaje={T.error} onReintentar={reintentar} /> : null}
      {estado.tipo === "listo" && estado.datos.length === 0 ? <EstadoVacio mensaje={T.vacio} /> : null}
      {estado.tipo === "listo" && estado.datos.length > 0 ? <TablaReservas filas={estado.datos} /> : null}
    </div>
  );
}

function TablaReservas({ filas }: { filas: FilaReserva[] }) {
  const router = useRouter();
  const orden = useOrden<Columna>("llego", false);
  const visibles = useMemo(() => orden.ordenar(ordenarPorLlegada(filas), VALOR), [filas, orden]);

  return (
    <div className={ui.panel}>
      <table className={ui.tabla}>
        <thead>
          <tr>
            <EncabezadoOrdenable orden={orden} columna="estado" texto={T.columnas.estado} />
            <EncabezadoOrdenable orden={orden} columna="agencia" texto={T.columnas.agencia} />
            <EncabezadoOrdenable orden={orden} columna="numero" texto={T.columnas.numero} />
            <EncabezadoOrdenable orden={orden} columna="producto" texto={T.columnas.producto} />
            <EncabezadoOrdenable orden={orden} columna="fechas" texto={T.columnas.fechas} />
            <EncabezadoOrdenable orden={orden} columna="pax" texto={T.columnas.pax} numero />
            <EncabezadoOrdenable orden={orden} columna="llego" texto={T.columnas.llego} />
          </tr>
        </thead>
        <tbody>
          {visibles.map((fila) => {
            const atencion = fila.estado === "para_revision" || fila.posibleDuplicada;
            const clases = [ui.filaClic, atencion ? ui.filaAtencion : "", fila.dePrueba ? estilos.filaPrueba : ""];
            return (
              <tr
                key={fila.id}
                data-id={fila.id}
                data-atencion={atencion ? "true" : undefined}
                data-prueba={fila.dePrueba ? "true" : undefined}
                className={clases.filter(Boolean).join(" ")}
                onClick={() => router.push(`/reservas/${fila.id}`)}
              >
                <td>
                  <span className={ui.chips}>
                    <ChipEstado estado={fila.estado} />
                    <MarcasReserva posibleDuplicada={fila.posibleDuplicada} dePrueba={fila.dePrueba} />
                  </span>
                </td>
                <td>{fila.agencia}</td>
                <td className={`${ui.mono} ${ui.nowrap}`}>{fila.numero ?? SIN_DATO}</td>
                <td className={ui.celdaNombre}>
                  {fila.producto ? (
                    <>
                      <span className={ui.mono}>{fila.producto.codigo}</span> {fila.producto.nombre}
                    </>
                  ) : (
                    <span className={ui.secundario}>{T.sinProducto}</span>
                  )}
                </td>
                <td className={ui.nowrap}>{formatearRango(fila.fechaInicio, fila.fechaFin)}</td>
                <td className={ui.numero}>{fila.pax ?? SIN_DATO}</td>
                <td className={`${ui.secundario} ${ui.nowrap}`}>{formatearFechaHora(fila.llego) || SIN_DATO}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
