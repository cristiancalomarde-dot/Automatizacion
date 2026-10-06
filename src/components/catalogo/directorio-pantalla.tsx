"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cargarDirectorio } from "@/lib/catalogo/consultas";
import { filtrarDirectorio, tieneMail } from "@/lib/catalogo/reglas";
import type { Canal, FilaDirectorio } from "@/lib/catalogo/tipos";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Chip, EsqueletoTabla, EstadoError, EstadoVacio } from "@/components/ui/estados";
import { EncabezadoOrdenable, useOrden } from "@/components/ui/orden";
import ui from "@/components/ui/ui.module.css";

const T = TEXTOS.directorio;

type Columna = "nombre" | "mail" | "canal" | "ciudad" | "productos";

const VALOR: Record<Columna, (f: FilaDirectorio) => string | number> = {
  nombre: (f) => f.nombre,
  mail: (f) => f.mails[0] ?? "",
  canal: (f) => f.canal ?? "",
  ciudad: (f) => f.ciudad ?? "",
  productos: (f) => f.cantidadProductos,
};

export function etiquetaCanal(canal: Canal): string {
  return canal === "mail" ? T.canales.mail : canal === "whatsapp" ? T.canales.whatsapp : T.canales.ninguno;
}

/** "Teléfono / otros datos": el teléfono, o lo que quedó en aclaraciones (ej. un WhatsApp). */
function otrosDatos(fila: FilaDirectorio): string {
  return [fila.telefono, fila.aclaraciones].filter(Boolean).join(" · ");
}

/** Directorio de proveedores (spec M1-06 #7, #8, #11, #12). Solo lectura. */
export function DirectorioPantalla() {
  const { estado, reintentar } = useConsulta(() => cargarDirectorio(createSupabaseBrowserClient()));

  return (
    <div className={ui.pagina}>
      <div className={ui.encabezado}>
        <h1 className={ui.titulo}>{T.titulo}</h1>
        {estado.tipo === "listo" && estado.datos.length > 0 ? (
          <span className={ui.meta}>{T.cantidad(estado.datos.length)}</span>
        ) : null}
      </div>
      <p className={ui.meta}>{TEXTOS.comunes.soloLectura}</p>

      {estado.tipo === "cargando" ? <EsqueletoTabla etiqueta={T.cargando} columnas={5} /> : null}
      {estado.tipo === "error" ? <EstadoError mensaje={T.error} onReintentar={reintentar} /> : null}
      {estado.tipo === "listo" && estado.datos.length === 0 ? (
        <EstadoVacio mensaje={T.vacio} accion={T.accionVacio} ayuda={T.ayudaVacio} />
      ) : null}
      {estado.tipo === "listo" && estado.datos.length > 0 ? <TablaDirectorio filas={estado.datos} /> : null}
    </div>
  );
}

function TablaDirectorio({ filas }: { filas: FilaDirectorio[] }) {
  const router = useRouter();
  const [soloSinMail, setSoloSinMail] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const orden = useOrden<Columna>("nombre");
  const cantidadSinMail = filas.filter((f) => !tieneMail(f)).length;
  const visibles = useMemo(
    () => orden.ordenar(filtrarDirectorio(filas, { soloSinMail, busqueda }), VALOR),
    [filas, soloSinMail, busqueda, orden],
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
          />
        </label>
        <button
          type="button"
          className={ui.botonSecundario}
          aria-pressed={soloSinMail}
          onClick={() => setSoloSinMail(!soloSinMail)}
        >
          {T.filtroSinMail} ({cantidadSinMail})
        </button>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio mensaje={T.sinResultados} />
      ) : (
        <div className={ui.panel}>
          <table className={ui.tabla}>
            <thead>
              <tr>
                <EncabezadoOrdenable orden={orden} columna="nombre" texto={T.columnas.nombre} />
                <EncabezadoOrdenable orden={orden} columna="mail" texto={T.columnas.mail} />
                <EncabezadoOrdenable orden={orden} columna="canal" texto={T.columnas.canal} />
                <th scope="col">{T.columnas.otros}</th>
                <EncabezadoOrdenable orden={orden} columna="ciudad" texto={T.columnas.ciudad} />
                <EncabezadoOrdenable orden={orden} columna="productos" texto={T.columnas.productos} numero />
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => {
                const conMail = tieneMail(fila);
                return (
                  <tr
                    key={fila.id}
                    className={`${ui.filaClic} ${conMail ? "" : ui.filaAtencion}`}
                    onClick={() => router.push(`/proveedores/${fila.id}`)}
                  >
                    <td className={ui.celdaNombre}>
                      <Link href={`/proveedores/${fila.id}`} className={ui.enlace}>
                        {fila.nombre}
                      </Link>
                    </td>
                    <td>
                      {conMail ? (
                        fila.mails.map((mail) => <div key={mail}>{mail}</div>)
                      ) : (
                        <Chip tono="aviso">{T.sinMail}</Chip>
                      )}
                    </td>
                    <td>{etiquetaCanal(fila.canal)}</td>
                    <td className={`${ui.secundario} ${ui.preformateado} ${ui.celdaAncha}`}>{otrosDatos(fila)}</td>
                    <td>{fila.ciudad ?? ""}</td>
                    <td className={ui.numero}>{fila.cantidadProductos}</td>
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
