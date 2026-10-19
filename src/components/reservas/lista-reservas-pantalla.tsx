"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { formatearFechaHora, formatearRango } from "@/lib/formato";
import { avisosDeLlegada } from "@/lib/reservas/avisos-vuelo";
import { cargarReservas, cargarRevisiones } from "@/lib/reservas/consultas";
import { medirRevision, textoMedicion } from "@/lib/reservas/medicion-prueba";
import { coincideBusqueda, contarReservas, ordenarParaTrabajar, pasajeroYCantidad } from "@/lib/reservas/reglas";
import type { FilaReserva } from "@/lib/reservas/tipos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Aviso, EsqueletoTabla, EstadoError, EstadoVacio } from "@/components/ui/estados";
import { EncabezadoOrdenable, useOrden } from "@/components/ui/orden";
import ui from "@/components/ui/ui.module.css";
import type { LineaLectura } from "@/lib/lectura-sales/estado";
import { LineaLecturaSales } from "./linea-lectura";
import { ChipEstado, MarcasReserva } from "./marcas";
import estilos from "./reservas.module.css";

const T = TEXTOS.reservas;
const SIN_DATO = TEXTOS.comunes.sinDato;

/** "prioridad": el orden de trabajo por defecto (ordenarParaTrabajar), sin columna propia. */
type Columna = "prioridad" | "estado" | "agencia" | "numero" | "producto" | "fechas" | "pasajeros" | "llego";

const VALOR: Record<Columna, (f: FilaReserva) => string | number> = {
  prioridad: () => 0,
  estado: (f) => T.estados[f.estado],
  agencia: (f) => f.agencia,
  numero: (f) => f.numero ?? "",
  producto: (f) => (f.producto ? `${[f.producto, ...(f.otrosProductos ?? [])].map((p) => p.codigo).join(" + ")} ${f.producto.nombre}` : "~"),
  fechas: (f) => f.fechaInicio ?? "9999",
  // Por el nombre del pasajero principal; sin nombre, al final.
  pasajeros: (f) => f.pasajeros[0] ?? "￿",
  llego: (f) => Date.parse(f.llego) || 0,
};

/**
 * Reservas: la pantalla de inicio (spec M2-05 #1 a #4, #16). Solo para mirar.
 * Las de prueba (M2-06) se ven con "Ver las de prueba" (`?prueba=1`), con la
 * medición de la revisión del owner arriba. Arriba de todo, la línea de la
 * última lectura de sales@ (M2-07 §4), que llega armada desde el servidor.
 */
export function ListaReservasPantalla({ lineaLectura }: { lineaLectura?: LineaLectura } = {}) {
  const verPrueba = useSearchParams()?.get("prueba") === "1";
  const { estado, reintentar } = useConsulta(() => cargarReservas(createSupabaseBrowserClient()));
  const conteo = estado.tipo === "listo" ? contarReservas(estado.datos) : null;
  const visibles = estado.tipo === "listo" ? estado.datos.filter((f) => verPrueba || !f.dePrueba) : [];
  const dePrueba = conteo?.dePrueba ?? 0;
  const soloPrueba = conteo !== null && conteo.total > 0 && conteo.total === dePrueba;
  const [busqueda, setBusqueda] = useState("");
  const encontradas = visibles.filter((f) => coincideBusqueda(f, busqueda));

  return (
    <div className={ui.pagina}>
      <div className={ui.encabezado}>
        <h1 className={ui.titulo}>{T.titulo}</h1>
        {conteo && conteo.total > 0 ? <span className={ui.meta}>{T.total(conteo.total, conteo.dePrueba)}</span> : null}
      </div>

      {lineaLectura ? <LineaLecturaSales linea={lineaLectura} /> : null}
      {estado.tipo === "cargando" ? <EsqueletoTabla etiqueta={T.cargando} columnas={7} /> : null}
      {estado.tipo === "error" ? <EstadoError mensaje={T.error} onReintentar={reintentar} /> : null}
      {estado.tipo === "listo" && estado.datos.length === 0 ? <EstadoVacio mensaje={T.vacio} /> : null}
      {estado.tipo === "listo" && soloPrueba && !verPrueba ? (
        <div className={estilos.barraPrueba}>
          <p className={ui.migas}>{T.soloPrueba(dePrueba)}</p>
          <Link href="/reservas?prueba=1" className={ui.enlace}>
            {T.verlasPrueba}
          </Link>
        </div>
      ) : null}
      {estado.tipo === "listo" && dePrueba > 0 && !soloPrueba && !verPrueba ? (
        <div className={estilos.barraPrueba}>
          <Link href="/reservas?prueba=1" className={ui.enlace}>
            {T.verPrueba(dePrueba)}
          </Link>
        </div>
      ) : null}
      {estado.tipo === "listo" && verPrueba && dePrueba > 0 ? (
        <MedicionPrueba idsPrueba={estado.datos.filter((f) => f.dePrueba).map((f) => f.id)} />
      ) : null}
      {visibles.length > 0 ? (
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
        </div>
      ) : null}
      {visibles.length > 0 && encontradas.length === 0 ? <EstadoVacio mensaje={T.sinCoincidencias(busqueda)} /> : null}
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
  const visibles = useMemo(() => orden.ordenar(ordenarParaTrabajar(filas), VALOR), [filas, orden]);

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
                <td className={`${ui.secundario} ${ui.nowrap}`}>{formatearFechaHora(fila.llego) || SIN_DATO}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
