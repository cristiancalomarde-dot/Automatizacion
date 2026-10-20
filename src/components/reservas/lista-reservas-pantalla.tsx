"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { formatearFechaHora, formatearRango } from "@/lib/formato";
import { avisosDeLlegada } from "@/lib/reservas/avisos-vuelo";
import { cargarLaListaDeReservas } from "@/app/(app)/reservas/acciones-lista";
import { cargarRevisiones } from "@/lib/reservas/consultas";
import {
  ELECCION_INICIAL,
  FILTROS_FECHAS,
  ORDENES,
  claveEleccionLista,
  eleccionGuardada,
  filtrarYOrdenar,
  hayFiltros,
  type EleccionLista,
} from "@/lib/reservas/lista/filtros";
import { medirRevision, textoMedicion } from "@/lib/reservas/medicion-prueba";
import {
  claveFiltroResponsable,
  filtroGuardado,
  opcionesFiltroResponsable,
  pasaFiltroResponsable,
  type FiltroResponsable,
} from "@/lib/reservas/responsable/filtro";
import { coincideBusqueda, contarReservas, pasajeroYCantidad } from "@/lib/reservas/reglas";
import { ESTADOS_RESERVA, type FilaReserva } from "@/lib/reservas/tipos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { cargarEquipo } from "@/lib/usuarios/equipo";
import { Aviso, EsqueletoTabla, EstadoError, EstadoVacio } from "@/components/ui/estados";
import { EncabezadoOrdenable, useOrden } from "@/components/ui/orden";
import ui from "@/components/ui/ui.module.css";
import type { LineaLectura } from "@/lib/lectura-sales/estado";
import { LineaLecturaSales } from "./linea-lectura";
import { ChipEstado, MarcasReserva } from "./marcas";
import estilos from "./reservas.module.css";

const T = TEXTOS.reservas;
const SIN_DATO = TEXTOS.comunes.sinDato;
const F = TEXTOS.reservas.responsable;
const L = TEXTOS.reservas.lista;

/** "prioridad": el orden elegido en "Ordenar por" (M3-08), sin columna propia. */
type Columna = "prioridad" | "estado" | "agencia" | "numero" | "producto" | "fechas" | "pasajeros" | "responsable" | "llego";

const VALOR: Record<Columna, (f: FilaReserva) => string | number> = {
  prioridad: () => 0,
  estado: (f) => T.estados[f.estado],
  agencia: (f) => f.agencia,
  numero: (f) => f.numero ?? "",
  producto: (f) => (f.producto ? `${[f.producto, ...(f.otrosProductos ?? [])].map((p) => p.codigo).join(" + ")} ${f.producto.nombre}` : "~"),
  fechas: (f) => f.fechaInicio ?? "9999",
  // Por el nombre del pasajero principal; sin nombre, al final.
  pasajeros: (f) => f.pasajeros[0] ?? "￿",
  // M3-06: por el nombre del responsable; sin responsable, al final.
  responsable: (f) => f.responsable ?? "￿",
  llego: (f) => Date.parse(f.llego) || 0,
};

/** Lo que guardó esta persona en el navegador con esa clave (null si no hay o no se puede leer). */
function leerGuardado(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // Igual filtra; solo no se recuerda.
  }
}

/**
 * Reservas: la pantalla de inicio (spec M2-05 #1 a #4, #16). Solo para mirar.
 * Las de prueba (M2-06) se ven con "Ver las de prueba" (`?prueba=1`), con la
 * medición de la revisión del owner arriba. Arriba de todo, la línea de la
 * última lectura de sales@ (M2-07 §4), que llega armada desde el servidor.
 */
/**
 * Reservas: la pantalla de inicio (spec M2-05 #1 a #4, #16). Solo para mirar.
 * Las de prueba (M2-06) se ven con "Ver las de prueba" (`?prueba=1`), con la
 * medición de la revisión del owner arriba. Arriba de todo, la línea de la
 * última lectura de sales@ (M2-07 §4), que llega armada desde el servidor.
 *
 * Spec M3-08: la lista la trae el servidor (a un operador no le llegan los
 * viajes terminados); acá se ordena y se filtra por agencia, fechas y
 * estado, y una administradora tiene además la vista "Viajes terminados".
 */
export function ListaReservasPantalla({ lineaLectura }: { lineaLectura?: LineaLectura } = {}) {
  const verPrueba = useSearchParams()?.get("prueba") === "1";
  const { estado, reintentar } = useConsulta(() => cargarLaListaDeReservas());
  const lista = estado.tipo === "listo" ? estado.datos : null;
  const conteo = lista ? contarReservas(lista.filas) : null;
  const visibles = lista ? lista.filas.filter((f) => verPrueba || !f.dePrueba) : [];
  const dePrueba = conteo?.dePrueba ?? 0;
  const soloPrueba = conteo !== null && conteo.total > 0 && conteo.total === dePrueba;
  const [busqueda, setBusqueda] = useState("");
  // Spec M3-06 fila 7: el filtro por operativo, recordado por persona en el navegador.
  const { estado: equipo } = useConsulta(() => cargarEquipo(createSupabaseBrowserClient()));
  const yo = equipo.tipo === "listo" ? equipo.datos.yo : null;
  const opciones = useMemo(() => opcionesFiltroResponsable(equipo.tipo === "listo" ? equipo.datos.personas : [], yo), [equipo, yo]);
  // Lo elegido en esta visita; si no eligió nada, lo que quedó guardado para esta persona (se lee cuando se sabe quién es).
  const [elegido, setElegido] = useState<string | null>(null);
  const guardado = useMemo(() => (equipo.tipo === "listo" ? leerGuardado(claveFiltroResponsable(yo)) : null), [equipo, yo]);
  const filtro: FiltroResponsable = filtroGuardado(elegido ?? guardado, opciones);
  function elegirFiltro(valor: string) {
    const nuevo = filtroGuardado(valor, opciones);
    setElegido(nuevo);
    guardar(claveFiltroResponsable(yo), nuevo);
  }

  // Spec M3-08 fila 7: orden y filtros, recordados por persona como el responsable.
  const agencias = useMemo(() => lista?.agencias ?? [], [lista]);
  const esAdmin = lista?.esAdmin ?? false;
  const hoy = lista?.hoy ?? "";
  const [eleccionElegida, setEleccionElegida] = useState<EleccionLista | null>(null);
  const eleccionDeAntes = useMemo(
    () => (equipo.tipo === "listo" && lista ? eleccionGuardada(leerGuardado(claveEleccionLista(yo)), { agencias, esAdmin }) : ELECCION_INICIAL),
    [equipo, yo, lista, agencias, esAdmin],
  );
  const eleccion = eleccionElegida ?? eleccionDeAntes;
  function elegir(cambios: Partial<EleccionLista>) {
    const nueva = { ...eleccion, ...cambios };
    if (nueva.fechas === "mes" && !nueva.mes) nueva.mes = hoy.slice(0, 7);
    setEleccionElegida(nueva);
    guardar(claveEleccionLista(yo), JSON.stringify(nueva));
  }
  function limpiarFiltros() {
    setBusqueda("");
    elegirFiltro("todas");
    elegir({ agencia: ELECCION_INICIAL.agencia, fechas: ELECCION_INICIAL.fechas, estado: ELECCION_INICIAL.estado, vista: ELECCION_INICIAL.vista });
  }

  const encontradas = filtrarYOrdenar(visibles, eleccion, hoy).filter(
    (f) => coincideBusqueda(f, busqueda) && pasaFiltroResponsable(f, filtro, yo),
  );
  const conFiltros = hayFiltros(eleccion);
  const terminadas = eleccion.vista === "terminadas";

  return (
    <div className={ui.pagina}>
      <div className={ui.encabezado}>
        <h1 className={ui.titulo}>{T.titulo}</h1>
        {conteo && conteo.total > 0 ? <span className={ui.meta}>{T.total(conteo.total, conteo.dePrueba)}</span> : null}
      </div>

      {lineaLectura ? <LineaLecturaSales linea={lineaLectura} /> : null}
      {estado.tipo === "cargando" ? <EsqueletoTabla etiqueta={T.cargando} columnas={8} /> : null}
      {estado.tipo === "error" ? <EstadoError mensaje={T.error} onReintentar={reintentar} /> : null}
      {lista && lista.filas.length === 0 ? <EstadoVacio mensaje={T.vacio} /> : null}
      {lista && soloPrueba && !verPrueba ? (
        <div className={estilos.barraPrueba}>
          <p className={ui.migas}>{T.soloPrueba(dePrueba)}</p>
          <Link href="/reservas?prueba=1" className={ui.enlace}>
            {T.verlasPrueba}
          </Link>
        </div>
      ) : null}
      {lista && dePrueba > 0 && !soloPrueba && !verPrueba ? (
        <div className={estilos.barraPrueba}>
          <Link href="/reservas?prueba=1" className={ui.enlace}>
            {T.verPrueba(dePrueba)}
          </Link>
        </div>
      ) : null}
      {lista && verPrueba && dePrueba > 0 ? <MedicionPrueba idsPrueba={lista.filas.filter((f) => f.dePrueba).map((f) => f.id)} /> : null}
      {visibles.length > 0 ? (
        <div className={ui.barra}>
          {esAdmin ? (
            <label className={ui.campo}>
              {L.vista}
              <select className={ui.input} data-filtro="vista" value={eleccion.vista} onChange={(e) => elegir({ vista: e.target.value as EleccionLista["vista"] })}>
                <option value="vigentes">{L.vigentes}</option>
                <option value="terminadas">{L.terminadas}</option>
              </select>
            </label>
          ) : null}
          {terminadas ? null : (
            <label className={ui.campo}>
              {L.ordenar}
              <select className={ui.input} data-filtro="orden" value={eleccion.orden} onChange={(e) => elegir({ orden: e.target.value as EleccionLista["orden"] })}>
                {ORDENES.map((o) => (
                  <option key={o} value={o}>
                    {L.ordenes[o]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={ui.campo}>
            {L.agencia}
            <select className={ui.input} data-filtro="agencia" value={eleccion.agencia} onChange={(e) => elegir({ agencia: e.target.value })}>
              <option value="todas">{L.todasAgencias}</option>
              {agencias.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.campo}>
            {L.fechas}
            <select className={ui.input} data-filtro="fechas" value={eleccion.fechas} onChange={(e) => elegir({ fechas: e.target.value as EleccionLista["fechas"] })}>
              {FILTROS_FECHAS.map((o) => (
                <option key={o} value={o}>
                  {L.opcionesFechas[o]}
                </option>
              ))}
            </select>
          </label>
          {eleccion.fechas === "mes" ? (
            <label className={ui.campo}>
              {L.mes}
              <input type="month" className={ui.input} value={eleccion.mes} onChange={(e) => e.target.value && elegir({ mes: e.target.value })} />
            </label>
          ) : null}
          <label className={ui.campo}>
            {L.estado}
            <select className={ui.input} data-filtro="estado" value={eleccion.estado} onChange={(e) => elegir({ estado: e.target.value as EleccionLista["estado"] })}>
              <option value="todas">{L.todosEstados}</option>
              {ESTADOS_RESERVA.map((s) => (
                <option key={s} value={s}>
                  {T.estados[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.campo}>
            {F.filtro}
            <select className={ui.input} data-filtro="responsable" value={filtro} onChange={(e) => elegirFiltro(e.target.value)}>
              {opciones.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </select>
          </label>
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
        </div>
      ) : null}
      {visibles.length > 0 ? (
        <p className={ui.meta} data-testid="contador-lista">
          {L.mostrando(encontradas.length)}
        </p>
      ) : null}
      {visibles.length > 0 && encontradas.length === 0 ? (
        conFiltros ? (
          <EstadoVacio mensaje={L.vacio} accion={L.limpiar} onAccion={limpiarFiltros} />
        ) : filtro !== "todas" ? (
          <EstadoVacio mensaje={F.sinCoincidencias} />
        ) : (
          <EstadoVacio mensaje={busqueda.trim() ? T.sinCoincidencias(busqueda) : L.vacio} />
        )
      ) : null}
      {encontradas.length > 0 ? <TablaReservas filas={encontradas} /> : null}
    </div>
  );
}

/** "Revisadas 17 de 17 · 2 mal (12%) · se puede seguir" (spec M2-06 fila 14), con el enlace para ocultarlas. */
function MedicionPrueba({ idsPrueba }: { idsPrueba: string[] }) {
  const { estado } = useConsulta(() => cargarRevisiones(createSupabaseBrowserClient()));
  const texto =
    estado.tipo === "listo" ? textoMedicion(medirRevision(idsPrueba.map((id) => estado.datos.get(id) ?? null))) : null;
  return (
    <div className={estilos.barraPrueba}>
      {texto ? (
        <span className={estilos.medicion} data-testid="medicion-prueba">
          {texto}
        </span>
      ) : null}
      {estado.tipo === "error" ? <Aviso tono="error">{T.errorMarcas}</Aviso> : null}
      <Link href="/reservas" className={ui.enlace}>
        {T.ocultarPrueba}
      </Link>
    </div>
  );
}

function TablaReservas({ filas }: { filas: FilaReserva[] }) {
  const router = useRouter();
  const orden = useOrden<Columna>("prioridad");
  // Las filas llegan en el orden de "Ordenar por" (M3-08); un encabezado lo cambia por esa columna.
  const visibles = useMemo(() => orden.ordenar(filas, VALOR), [filas, orden]);

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
            <EncabezadoOrdenable orden={orden} columna="pasajeros" texto={T.columnas.pasajeros} />
            <EncabezadoOrdenable orden={orden} columna="responsable" texto={F.columna} />
            <EncabezadoOrdenable orden={orden} columna="llego" texto={T.columnas.llego} />
          </tr>
        </thead>
        <tbody>
          {visibles.map((fila) => {
            const atencion = fila.estado === "para_revision" || fila.posibleDuplicada;
            const avisosLlegada = avisosDeLlegada(fila);
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
                    <MarcasReserva
                      posibleDuplicada={fila.posibleDuplicada}
                      dePrueba={fila.dePrueba}
                      avisosLlegada={avisosLlegada}
                      cancelacion={fila.cancelacion}
                      pedidoIncompleto={fila.pedidoIncompleto}
                    />
                  </span>
                </td>
                <td>{fila.agencia}</td>
                <td className={`${ui.mono} ${ui.nowrap}`}>{fila.numero ?? SIN_DATO}</td>
                <td className={ui.celdaNombre}>
                  {fila.producto ? (
                    <>
                      <span className={ui.mono}>{fila.producto.codigo}</span>
                      {/* Owner 2026-10-17: una reserva de Journaway puede tener varios productos (SPAP01 + SPAP03). */}
                      {(fila.otrosProductos ?? []).map((p) => (
                        <span key={p.id} className={ui.mono}>
                          {" "}
                          + {p.codigo}
                        </span>
                      ))}{" "}
                      {fila.producto.nombre}
                    </>
                  ) : (
                    <span className={ui.secundario}>{T.sinProducto}</span>
                  )}
                  {avisosLlegada.map((a) => (
                    <span key={a} className={estilos.avisoFila}>
                      {a}
                    </span>
                  ))}
                </td>
                <td className={ui.nowrap}>{formatearRango(fila.fechaInicio, fila.fechaFin)}</td>
                <td className={ui.nowrap}>{pasajeroYCantidad(fila) ?? SIN_DATO}</td>
                <td className={fila.responsable ? ui.nowrap : `${ui.secundario} ${ui.nowrap}`}>{fila.responsable ?? F.sin}</td>
                <td className={`${ui.secundario} ${ui.nowrap}`}>{formatearFechaHora(fila.llego) || SIN_DATO}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
