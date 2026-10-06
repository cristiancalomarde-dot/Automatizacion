"use client";

import Link from "next/link";
import { cargarProveedor } from "@/lib/catalogo/consultas";
import { tieneMail } from "@/lib/catalogo/reglas";
import type { DetalleProveedor } from "@/lib/catalogo/tipos";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Aviso, EsqueletoDetalle, EstadoError } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import { etiquetaCanal } from "./directorio-pantalla";

const T = TEXTOS.proveedor;

/**
 * Detalle de proveedor, solo lectura (spec M1-06 #9, DECISIONS 2026-10-06):
 * si le falta el contacto, dice que se completa en el Excel de proveedores.
 */
export function DetalleProveedorPantalla({ id }: { id: string }) {
  const { estado, reintentar } = useConsulta(() => cargarProveedor(createSupabaseBrowserClient(), id));

  return (
    <div className={ui.pagina}>
      <nav className={ui.migas} aria-label="Ubicación">
        <Link href="/proveedores" className={ui.enlace}>
          {TEXTOS.directorio.titulo}
        </Link>
      </nav>
      {estado.tipo === "cargando" ? <EsqueletoDetalle etiqueta={T.cargando} /> : null}
      {estado.tipo === "error" ? (
        <EstadoError mensaje={T.error} onReintentar={reintentar} volver={{ href: "/proveedores", texto: T.volver }} />
      ) : null}
      {estado.tipo === "listo" ? <Detalle proveedor={estado.datos} /> : null}
    </div>
  );
}

function Detalle({ proveedor }: { proveedor: DetalleProveedor }) {
  const sinDato = TEXTOS.comunes.sinDato;
  return (
    <>
      <h1 className={ui.titulo}>{proveedor.nombre}</h1>

      {!tieneMail(proveedor) ? (
        <Aviso tono="aviso">{T.avisoSinMail}</Aviso>
      ) : null}
      {proveedor.canal === "whatsapp" ? <Aviso tono="info">{T.avisoWhatsapp}</Aviso> : null}

      <dl className={ui.datos}>
        <dt>{T.mails}</dt>
        <dd>
          {proveedor.mails.length > 0 ? proveedor.mails.map((m) => <div key={m}>{m}</div>) : sinDato}
        </dd>
        <dt>{T.canal}</dt>
        <dd>{etiquetaCanal(proveedor.canal)}</dd>
        <dt>{T.telefono}</dt>
        <dd>{proveedor.telefono ?? sinDato}</dd>
        <dt>{T.ciudad}</dt>
        <dd>{proveedor.ciudad ?? sinDato}</dd>
        <dt>{T.aclaraciones}</dt>
        <dd className={ui.preformateado}>{proveedor.aclaraciones ?? sinDato}</dd>
      </dl>
      <p className={ui.meta}>{TEXTOS.comunes.soloLectura}</p>

      <section className={ui.seccion}>
        <h2 className={ui.subtitulo}>{T.productos}</h2>
        {proveedor.productos.length === 0 ? (
          <p className={ui.meta}>{T.sinProductos}</p>
        ) : (
          <div className={ui.panel}>
            <table className={ui.tabla} aria-label={T.productos}>
              <thead>
                <tr>
                  <th scope="col">{TEXTOS.catalogo.columnas.codigo}</th>
                  <th scope="col">{TEXTOS.catalogo.columnas.nombre}</th>
                  <th scope="col">Rol</th>
                </tr>
              </thead>
              <tbody>
                {proveedor.productos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/catalogo/${p.id}`} className={`${ui.enlace} ${ui.mono}`}>
                        {p.codigo}
                      </Link>
                    </td>
                    <td>{p.nombre}</td>
                    <td className={ui.secundario}>{T.rol[p.rol]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
