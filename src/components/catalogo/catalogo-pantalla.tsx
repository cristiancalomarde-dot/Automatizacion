"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cargarCatalogo } from "@/lib/catalogo/consultas";
import { filtrarCatalogo } from "@/lib/catalogo/reglas";
import type { FilaCatalogo } from "@/lib/catalogo/tipos";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { formatearFechaHora } from "@/lib/formato";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Chip, EsqueletoTabla, EstadoError, EstadoVacio } from "@/components/ui/estados";
import { EncabezadoOrdenable, useOrden } from "@/components/ui/orden";
import ui from "@/components/ui/ui.module.css";

const T = TEXTOS.catalogo;

type Columna = "codigo" | "nombre" | "ciudades" | "proveedores" | "actualizado";

function ciudadesDe(fila: FilaCatalogo): string {
  return fila.ciudades.length > 0 ? fila.ciudades.join(", ") : (fila.destino ?? "");
}

const VALOR: Record<Columna, (f: FilaCatalogo) => string | number> = {
  codigo: (f) => f.codigo,
  nombre: (f) => f.nombre,
  ciudades: ciudadesDe,
  proveedores: (f) => f.cantidadProveedores,
  actualizado: (f) => f.updatedAt,
};

/** Pantalla Catálogo de productos (spec M1-06 #1, #2, #10, #12). Solo lectura. */
export function CatalogoPantalla() {
  const { estado, reintentar } = useConsulta(() => cargarCatalogo(createSupabaseBrowserClient()));

  return (
    <div className={ui.pagina}>
      <div className={ui.encabezado}>
        <h1 className={ui.titulo}>{T.titulo}</h1>
        {estado.tipo === "listo" && estado.datos.length > 0 ? (
          <span className={ui.meta}>{T.cantidad(estado.datos.length)}</span>
        ) : null}
      </div>
      <p className={ui.meta}>{TEXTOS.comunes.soloLectura}</p>

      {estado.tipo === "cargando" ? <EsqueletoTabla etiqueta={T.cargando} /> : null}
      {estado.tipo === "error" ? <EstadoError mensaje={T.error} onReintentar={reintentar} /> : null}
      {estado.tipo === "listo" && estado.datos.length === 0 ? (
        <EstadoVacio mensaje={T.vacio} accion={T.accionVacio} ayuda={T.ayudaVacio} />
      ) : null}
      {estado.tipo === "listo" && estado.datos.length > 0 ? <TablaCatalogo filas={estado.datos} /> : null}
    </div>
  );
}

function TablaCatalogo({ filas }: { filas: FilaCatalogo[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const orden = useOrden<Columna>("codigo");
  const visibles = useMemo(
    () => orden.ordenar(filtrarCatalogo(filas, busqueda), VALOR),
    [filas, busqueda, orden],
  );

  return (
    <>
      <div className={ui.barra}>
        <label className={ui.campo}>
          {T.buscar}
          <input
            type="search"
            className={ui.input}
            value={busqueda}
            placeholder={T.buscarPlaceholder}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
        </label>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio mensaje={T.sinResultados} />
      ) : (
        <div className={ui.panel}>
          <table className={ui.tabla}>
            <thead>
              <tr>
                <EncabezadoOrdenable orden={orden} columna="codigo" texto={T.columnas.codigo} />
                <EncabezadoOrdenable orden={orden} columna="nombre" texto={T.columnas.nombre} />
                <EncabezadoOrdenable orden={orden} columna="ciudades" texto={T.columnas.ciudades} />
                <EncabezadoOrdenable orden={orden} columna="proveedores" texto={T.columnas.proveedores} numero />
                <EncabezadoOrdenable orden={orden} columna="actualizado" texto={T.columnas.actualizado} />
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => {
                const externos = fila.codigosExternos.filter((c) => c.codigo !== fila.codigo);
                return (
                  <tr
                    key={fila.id}
                    className={ui.filaClic}
                    onClick={() => router.push(`/catalogo/${fila.id}`)}
                  >
                    <td>
                      <Link href={`/catalogo/${fila.id}`} className={`${ui.enlace} ${ui.mono}`}>
                        {fila.codigo}
                      </Link>
                      {externos.length > 0 ? (
                        <div className={ui.meta}>
                          {externos.map((c) => `${c.agencia} ${c.codigo}`).join(" · ")}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span>{fila.nombre}</span>{" "}
                      <span className={ui.chips}>
                        {fila.esTour ? <Chip tono="neutro">{T.tour}</Chip> : null}
                        {fila.cantidadPendientes > 0 ? (
                          <Chip tono="aviso">{T.pendientes(fila.cantidadPendientes)}</Chip>
                        ) : null}
                      </span>
                    </td>
                    <td>{ciudadesDe(fila)}</td>
                    <td className={ui.numero}>{fila.cantidadProveedores}</td>
                    <td className={`${ui.secundario} ${ui.nowrap}`}>{formatearFechaHora(fila.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
