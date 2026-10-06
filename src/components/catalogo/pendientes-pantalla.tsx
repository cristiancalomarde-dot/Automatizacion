"use client";

import Link from "next/link";
import { cargarPendientes } from "@/lib/catalogo/consultas";
import type { Pendiente } from "@/lib/catalogo/tipos";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EXCEL, TEXTOS } from "@/lib/textos";
import { EsqueletoTabla, EstadoError, EstadoVacio } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";

const T = TEXTOS.pendientes;

/**
 * Pendientes (spec M1-06 #18): una sola lista de lo que falta completar en
 * los Excel para que cada servicio tenga a quién pedírselo. Si el problema es
 * el proveedor, se corrige en el Excel de proveedores; si el servicio no tiene
 * proveedor escrito, en la fila del Excel de paquetes.
 */
export function PendientesPantalla() {
  const { estado, reintentar } = useConsulta(() => cargarPendientes(createSupabaseBrowserClient()));

  return (
    <div className={ui.pagina}>
      <div className={ui.encabezado}>
        <h1 className={ui.titulo}>{T.titulo}</h1>
        {estado.tipo === "listo" && estado.datos.length > 0 ? (
          <span className={ui.meta}>{T.cantidad(estado.datos.length)}</span>
        ) : null}
      </div>
      <p className={ui.meta}>{T.intro}</p>

      {estado.tipo === "cargando" ? <EsqueletoTabla etiqueta={T.cargando} /> : null}
      {estado.tipo === "error" ? <EstadoError mensaje={T.error} onReintentar={reintentar} /> : null}
      {estado.tipo === "listo" && estado.datos.length === 0 ? <EstadoVacio mensaje={T.vacio} /> : null}
      {estado.tipo === "listo" && estado.datos.length > 0 ? <TablaPendientes filas={estado.datos} /> : null}
    </div>
  );
}

function TablaPendientes({ filas }: { filas: Pendiente[] }) {
  return (
    <div className={ui.panel}>
      <table className={ui.tabla}>
        <thead>
          <tr>
            <th scope="col">{T.columnas.producto}</th>
            <th scope="col">{T.columnas.servicio}</th>
            <th scope="col">{T.columnas.proveedor}</th>
            <th scope="col">{T.columnas.motivo}</th>
            <th scope="col">{T.columnas.dondeSeCorrige}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.servicioId} className={ui.filaAtencion}>
              <td>
                <Link href={`/catalogo/${p.producto.id}`} className={`${ui.enlace} ${ui.mono}`}>
                  {p.producto.codigo}
                </Link>
                <div className={ui.meta}>{p.producto.nombre}</div>
              </td>
              <td className={ui.secundario}>{p.servicio}</td>
              <td>
                {p.proveedorId ? (
                  <Link href={`/proveedores/${p.proveedorId}`} className={ui.enlace}>
                    {p.proveedorNombre}
                  </Link>
                ) : (
                  (p.proveedorNombre ?? TEXTOS.comunes.sinDato)
                )}
              </td>
              <td>{p.motivo}</td>
              <td>
                <div className={ui.nowrap}>{p.proveedorNombre ? EXCEL.proveedores : EXCEL.paquetes}</div>
                {p.filaExcel !== null ? (
                  <div className={`${ui.meta} ${ui.nowrap}`}>{TEXTOS.producto.origenExcel(p.filaExcel)}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
