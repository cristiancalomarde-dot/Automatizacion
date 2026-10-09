"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cargarProducto } from "@/lib/catalogo/consultas";
import {
  agruparAlojamientoPorNivel,
  agruparPorOrden,
  diaDeServicioDelTour,
  duracionTour,
  partesPorNoche,
  proveedoresDeServicios,
} from "@/lib/catalogo/reglas";
import type { ComponenteTour, DetalleProducto, Servicio } from "@/lib/catalogo/tipos";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { formatearFechaHora } from "@/lib/formato";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Aviso, Chip, EsqueletoDetalle, EstadoError } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import { ENCABEZADOS_SERVICIO, FilaServicio, FilasAlternativas } from "./servicios";

const T = TEXTOS.producto;

/** Detalle de producto (spec M1-06 #3–#6, #14–#17). Solo lectura. */
export function DetalleProductoPantalla({ id }: { id: string }) {
  const { estado, reintentar } = useConsulta(() => cargarProducto(createSupabaseBrowserClient(), id));

  return (
    <div className={ui.pagina}>
      <nav className={ui.migas} aria-label="Ubicación">
        <Link href="/catalogo" className={ui.enlace}>
          {TEXTOS.catalogo.titulo}
        </Link>
      </nav>
      {estado.tipo === "cargando" ? <EsqueletoDetalle etiqueta={T.cargando} /> : null}
      {estado.tipo === "error" ? (
        <EstadoError mensaje={T.error} onReintentar={reintentar} volver={{ href: "/catalogo", texto: T.volver }} />
      ) : null}
      {estado.tipo === "listo" ? <Detalle producto={estado.datos} /> : null}
    </div>
  );
}

function Detalle({ producto }: { producto: DetalleProducto }) {
  const todos = [
    ...producto.servicios,
    ...producto.componentes.flatMap((c) => [
      ...(c.producto?.servicios ?? []),
      ...(c.producto?.componentes ?? []).flatMap((x) => x.producto?.servicios ?? []),
    ]),
  ];
  const sinProveedores = proveedoresDeServicios(todos).size === 0;
  const dias = duracionTour(producto.componentes);

  return (
    <>
      <div className={ui.encabezado}>
        <h1 className={ui.titulo}>
          <span className={ui.mono}>{producto.codigo}</span> {producto.nombre}
        </h1>
        <Chip tono="neutro">{producto.esTour ? T.tipoTour : T.tipoPaquete}</Chip>
      </div>

      <dl className={ui.datos}>
        {producto.ciudades.length > 0 ? (
          <>
            <dt>{T.ciudades}</dt>
            <dd>{producto.ciudades.join(", ")}</dd>
          </>
        ) : null}
        {producto.destino ? (
          <>
            <dt>{T.destino}</dt>
            <dd>{producto.destino}</dd>
          </>
        ) : null}
        {producto.esTour && dias ? (
          <>
            <dt>{T.duracionEtiqueta}</dt>
            <dd>{T.duracion(dias)}</dd>
          </>
        ) : null}
        <dt>{T.actualizado}</dt>
        <dd>{formatearFechaHora(producto.updatedAt)}</dd>
      </dl>
      <p className={ui.meta}>{TEXTOS.comunes.soloLectura}</p>

      {sinProveedores ? <Aviso tono="aviso">{T.sinProveedores}</Aviso> : null}

      {producto.esTour ? <Itinerario producto={producto} /> : <ServiciosSimples servicios={producto.servicios} />}

      <section className={ui.seccion}>
        <h2 className={ui.subtitulo}>{T.codigos}</h2>
        {producto.codigosExternos.length === 0 ? (
          <p className={ui.meta}>{T.sinCodigos}</p>
        ) : (
          <div className={ui.panel}>
            <table className={ui.tabla} aria-label={T.codigos}>
              <thead>
                <tr>
                  <th scope="col">Agencia</th>
                  <th scope="col">Código</th>
                  <th scope="col">Nombre en la agencia</th>
                </tr>
              </thead>
              <tbody>
                {producto.codigosExternos.map((c) => (
                  <tr key={`${c.agencia}-${c.codigo}`}>
                    <td>{c.agencia}</td>
                    <td className={ui.mono}>{c.codigo}</td>
                    <td>{c.nombreExterno ?? ""}</td>
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

function Encabezados({ conDia = false }: { conDia?: boolean }) {
  return (
    <thead>
      <tr>
        {conDia ? <th scope="col">Día</th> : null}
        {ENCABEZADOS_SERVICIO.map((e) => (
          <th key={e} scope="col">
            {e}
          </th>
        ))}
      </tr>
    </thead>
  );
}

const COLUMNAS = ENCABEZADOS_SERVICIO.length;

function FilaGrupo({ children, conDia = false }: { children: ReactNode; conDia?: boolean }) {
  return (
    <tr className={ui.filaGrupo}>
      <td colSpan={COLUMNAS + (conDia ? 1 : 0)}>{children}</td>
    </tr>
  );
}

/**
 * Producto simple. Si guarda en qué noches va cada servicio (CH10, M1-07),
 * primero el día por día; lo que no tiene noches, como siempre.
 */
function ServiciosSimples({ servicios }: { servicios: Servicio[] }) {
  const porNoche = partesPorNoche(servicios);
  if (!porNoche) return <ServiciosEnBloque servicios={servicios} />;
  return (
    <>
      <section className={ui.seccion}>
        <h2 className={ui.subtitulo}>{T.diaPorDia}</h2>
        <div className={ui.panel}>
          <table className={ui.tabla} aria-label={T.diaPorDia}>
            <Encabezados />
            <tbody>
              {porNoche.partes.map((parte) => (
                <Fragment key={`${parte.nocheDesde}-${parte.etiqueta}`}>
                  <FilaGrupo>{T.diaParte(parte.nocheDesde, parte.etiqueta)}</FilaGrupo>
                  {agruparPorOrden(parte.servicios).map((alternativas) => (
                    <FilasAlternativas key={alternativas[0].id} grupo={alternativas} mostrarNivel />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {porNoche.resto.length > 0 ? <ServiciosEnBloque servicios={porNoche.resto} /> : null}
    </>
  );
}

/** Alojamiento agrupado por nivel (#14) y el resto de los servicios. */
function ServiciosEnBloque({ servicios }: { servicios: Servicio[] }) {
  const niveles = agruparAlojamientoPorNivel(servicios);
  const otros = agruparPorOrden(servicios.filter((s) => s.tipo !== "alojamiento"));

  return (
    <>
      {niveles.length > 0 ? (
        <section className={ui.seccion}>
          <h2 className={ui.subtitulo}>{T.alojamiento}</h2>
          <div className={ui.panel}>
            <table className={ui.tabla} aria-label={T.alojamiento}>
              <Encabezados />
              <tbody>
                {niveles.map((grupo) => (
                  <Fragment key={grupo.nivel ?? "sin-nivel"}>
                    <FilaGrupo>
                      {grupo.nivel ?? T.sinNivel}
                      {!grupo.ofrecido ? (
                        <>
                          {" "}
                          <Chip tono="atenuado">{T.noOfrecido}</Chip>
                        </>
                      ) : null}
                    </FilaGrupo>
                    {agruparPorOrden(grupo.servicios).map((alternativas) => (
                      <FilasAlternativas key={alternativas[0].id} grupo={alternativas} />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {otros.length > 0 ? (
        <section className={ui.seccion}>
          <h2 className={ui.subtitulo}>{T.otrosServicios}</h2>
          <div className={ui.panel}>
            <table className={ui.tabla} aria-label={T.otrosServicios}>
              <Encabezados />
              <tbody>
                {otros.map((alternativas) => (
                  <FilasAlternativas key={alternativas[0].id} grupo={alternativas} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

type Entrada =
  | { tipo: "componente"; componente: ComponenteTour }
  | { tipo: "servicio"; servicio: Servicio; dia: number };

/**
 * El orden del viaje: los componentes por `orden`, y los servicios propios
 * del tour (buses con proveedor) en su día, antes del componente que empieza
 * ese mismo día (el bus llega, después empieza el paquete).
 */
function entradasDelItinerario(
  componentes: ComponenteTour[],
  servicios: Servicio[],
): { entradas: Entrada[]; sinDia: Servicio[] } {
  const entradas: Entrada[] = componentes.map((componente) => ({ tipo: "componente", componente }));
  const sinDia: Servicio[] = [];
  for (const servicio of servicios) {
    const dia = diaDeServicioDelTour(servicio.descripcion);
    if (dia === null) {
      sinDia.push(servicio);
      continue;
    }
    const posicion = entradas.findIndex((e) => e.tipo === "componente" && (e.componente.diaDesde ?? 0) >= dia);
    const entrada: Entrada = { tipo: "servicio", servicio, dia };
    if (posicion === -1) entradas.push(entrada);
    else entradas.splice(posicion, 0, entrada);
  }
  return { entradas, sinDia };
}

/**
 * Las filas de una secuencia. `desfase` corre los días: un tour dentro de
 * otro (CHB31 en 5C01, día 22) muestra sus pasos con los días del de afuera.
 */
function FilasEntradas({ entradas, desfase }: { entradas: Entrada[]; desfase: number }) {
  return (
    <>
      {entradas.map((entrada, i) =>
        entrada.tipo === "servicio" ? (
          <FilaServicio
            key={`s-${entrada.servicio.id}`}
            servicio={entrada.servicio}
            opcion={null}
            celdaInicial={T.dia(entrada.dia + desfase)}
          />
        ) : (
          <FilasComponente key={`c-${entrada.componente.orden}-${i}`} componente={entrada.componente} desfase={desfase} />
        ),
      )}
    </>
  );
}

/** Tour compuesto, día por día (#4, #16). */
function Itinerario({ producto }: { producto: DetalleProducto }) {
  const { entradas, sinDia } = entradasDelItinerario(producto.componentes, producto.servicios);

  return (
    <>
      <section className={ui.seccion}>
        <h2 className={ui.subtitulo}>{T.itinerario}</h2>
        <div className={ui.panel}>
          <table className={ui.tabla} aria-label={T.itinerario}>
            <Encabezados conDia />
            <tbody>
              <FilasEntradas entradas={entradas} desfase={0} />
            </tbody>
          </table>
        </div>
      </section>

      {sinDia.length > 0 ? (
        <section className={ui.seccion}>
          <h2 className={ui.subtitulo}>{T.serviciosDelTour}</h2>
          <div className={ui.panel}>
            <table className={ui.tabla} aria-label={T.serviciosDelTour}>
              <Encabezados />
              <tbody>
                {sinDia.map((servicio) => (
                  <FilaServicio key={servicio.id} servicio={servicio} opcion={null} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Los servicios de un paquete dentro del tour: por noches si las tiene (CH10), si no en bloque. */
function FilasServiciosDelPaquete({ servicios, diaInicio }: { servicios: Servicio[]; diaInicio: number | null }) {
  const porNoche = partesPorNoche(servicios);
  const enBloque = agruparPorOrden(porNoche ? porNoche.resto : servicios);
  return (
    <>
      {porNoche?.partes.map((parte) => (
        <Fragment key={`${parte.nocheDesde}-${parte.etiqueta}`}>
          <tr>
            <td className={ui.nowrap}>{diaInicio !== null ? T.dia(diaInicio + parte.nocheDesde - 1) : ""}</td>
            <td colSpan={COLUMNAS}>{parte.etiqueta}</td>
          </tr>
          {agruparPorOrden(parte.servicios).map((alternativas) => (
            <FilasAlternativas key={alternativas[0].id} grupo={alternativas} mostrarNivel conCeldaInicial />
          ))}
        </Fragment>
      ))}
      {enBloque.map((alternativas) => (
        <FilasAlternativas key={alternativas[0].id} grupo={alternativas} mostrarNivel conCeldaInicial />
      ))}
    </>
  );
}

function FilasComponente({ componente, desfase = 0 }: { componente: ComponenteTour; desfase?: number }) {
  const diaInicio = componente.diaDesde !== null ? componente.diaDesde + desfase : null;
  const dia = diaInicio !== null ? T.dia(diaInicio) : "";

  if (componente.tipo === "tramo_bus" || !componente.producto) {
    return (
      <tr className={ui.filaAtencion}>
        <td className={ui.nowrap}>{dia}</td>
        <td colSpan={COLUMNAS}>
          <div>
            {T.tipos.bus} {componente.descripcionRuta}{" "}
            <span className={ui.chips}>
              {componente.nocturno !== null ? (
                <Chip tono="neutro">{componente.nocturno ? T.busNocturno : T.busDiurno}</Chip>
              ) : null}
              <Chip tono="aviso">{T.tramoExterno}</Chip>
            </span>
          </div>
          <div className={ui.meta}>{T.tramoEmite}</div>
        </td>
      </tr>
    );
  }

  const paquete = componente.producto;
  const adentro = paquete.esTour && paquete.componentes?.length ? paquete.componentes : null;

  return (
    <>
      <tr className={ui.filaGrupo}>
        <td className={ui.nowrap}>{dia}</td>
        <td colSpan={COLUMNAS}>
          <Link href={`/catalogo/${paquete.id}`} className={`${ui.enlace} ${ui.mono}`}>
            {paquete.codigo}
          </Link>{" "}
          {paquete.nombre}
          {componente.noches !== null ? (
            <>
              {" · "}
              <span>{T.noches(componente.noches)}</span>
            </>
          ) : null}{" "}
          <span className={ui.chips}>
            {componente.transferIn ? <Chip tono="info">{T.transferIn}</Chip> : null}
            {componente.transferOut ? <Chip tono="info">{T.transferOut}</Chip> : null}
          </span>
        </td>
      </tr>
      {adentro ? (
        // El tour de adentro, desplegado con los días de este (M1-07 #10).
        <FilasEntradas
          entradas={entradasDelItinerario(adentro, paquete.servicios).entradas}
          desfase={(diaInicio ?? 1) - 1}
        />
      ) : paquete.esTour ? (
        <tr>
          <td />
          <td colSpan={COLUMNAS} className={ui.secundario}>
            {T.esTourEnlace}
          </td>
        </tr>
      ) : (
        <FilasServiciosDelPaquete servicios={paquete.servicios} diaInicio={diaInicio} />
      )}
    </>
  );
}
