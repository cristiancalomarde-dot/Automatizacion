"use client";

import { useState } from "react";
import { pasarlaAOtro, tomarEstaReserva } from "@/app/(app)/reservas/[id]/acciones-responsable";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { formatearFechaHora } from "@/lib/formato";
import type { ResultadoResponsable } from "@/lib/reservas/responsable/asignar";
import type { CambioDeResponsable, DetalleReserva } from "@/lib/reservas/tipos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { cargarEquipo } from "@/lib/usuarios/equipo";
import { Aviso } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import estilos from "./reservas.module.css";

const T = TEXTOS.reserva.responsable;

type Operacion = { tipo: "tomar" } | { tipo: "pasar"; a: string; nombre: string };

type Paso =
  | { tipo: "nada" }
  | { tipo: "preguntar" }
  | { tipo: "eligiendo" }
  | { tipo: "guardando"; op: Operacion }
  | { tipo: "error"; op: Operacion; mensaje: string; cambio: boolean };

function lineaDelHistorial(c: CambioDeResponsable): string {
  if (c.tipo === "envio") return T.historialEnvio(c.persona);
  if (c.tipo === "pasada") return T.historialPaso(c.persona, c.responsable);
  return T.historialTomo(c.persona);
}

/**
 * "Responsable: <nombre>" o "Sin responsable", con "Tomar esta reserva" y
 * "Pasarla a otro" (spec M3-06 §4). Si ya la lleva otro, tomarla pregunta
 * antes. Al terminar, el "Listo" queda arriba y la reserva se vuelve a leer
 * (`onListo`). Si otro la tomó mientras tanto, "Reintentar" vuelve a leerla
 * en vez de pisarla.
 */
export function ResponsableDeLaReserva({ reserva, onListo }: { reserva: DetalleReserva; onListo: (mensaje: string) => void }) {
  const { estado: equipo, reintentar: recargarEquipo } = useConsulta(() => cargarEquipo(createSupabaseBrowserClient()));
  const [paso, setPaso] = useState<Paso>({ tipo: "nada" });
  const [elegida, setElegida] = useState("");
  const responsableId = reserva.responsableId ?? null;
  const yo = equipo.tipo === "listo" ? equipo.datos.yo : null;
  const otras = equipo.tipo === "listo" ? equipo.datos.personas.filter((p) => p.id !== responsableId) : [];
  const guardando = paso.tipo === "guardando";
  const historial = reserva.responsables ?? [];

  async function hacer(op: Operacion) {
    setPaso({ tipo: "guardando", op });
    const entrada = { reservaId: reserva.id, esperado: responsableId };
    const falla: ResultadoResponsable = { ok: false, error: T.error(T.motivos.conexion) };
    const r = await (op.tipo === "tomar" ? tomarEstaReserva(entrada) : pasarlaAOtro({ ...entrada, a: op.a })).catch(() => falla);
    if (r.ok) {
      setPaso({ tipo: "nada" });
      onListo(op.tipo === "tomar" ? T.listoTomada : T.listoPasada(r.responsable || op.nombre));
      return;
    }
    setPaso({ tipo: "error", op, mensaje: r.error, cambio: r.cambio === true });
  }

  function tomar() {
    if (responsableId && responsableId !== yo) setPaso({ tipo: "preguntar" });
    else void hacer({ tipo: "tomar" });
  }

  const nombreElegida = otras.find((p) => p.id === elegida)?.nombre ?? "";

  return (
    <section className={ui.seccion} aria-labelledby="titulo-responsable" data-testid="responsable-reserva">
      <h2 id="titulo-responsable" className={ui.subtitulo}>
        {T.titulo}
      </h2>
      <p className={ui.migas}>{reserva.responsable ? T.etiqueta(reserva.responsable) : T.sinResponsable}</p>

      <div className={ui.acciones}>
        {responsableId === null || responsableId !== yo ? (
          <button type="button" className={ui.botonPrimario} disabled={guardando} onClick={tomar}>
            {T.tomar}
          </button>
        ) : null}
        <button
          type="button"
          className={ui.botonSecundario}
          disabled={guardando}
          aria-expanded={paso.tipo === "eligiendo"}
          onClick={() => setPaso(paso.tipo === "eligiendo" ? { tipo: "nada" } : { tipo: "eligiendo" })}
        >
          {T.pasar}
        </button>
      </div>

      {paso.tipo === "preguntar" ? (
        <div role="group" aria-label={T.dialogoTomar} className={estilos.elegirProducto}>
          <p>{T.preguntaTomar(reserva.responsable ?? "")}</p>
          <div className={ui.acciones}>
            <button type="button" className={ui.botonPrimario} onClick={() => hacer({ tipo: "tomar" })}>
              {T.siTomar}
            </button>
            <button type="button" className={ui.botonSecundario} onClick={() => setPaso({ tipo: "nada" })}>
              {T.cancelar}
            </button>
          </div>
        </div>
      ) : null}

      {paso.tipo === "eligiendo" ? (
        <div className={estilos.elegirProducto}>
          {equipo.tipo === "error" ? (
            <Aviso tono="error">
              {T.error(T.motivos.conexion)}{" "}
              <button type="button" className={ui.botonSecundario} onClick={recargarEquipo}>
                {T.reintentar}
              </button>
            </Aviso>
          ) : null}
          {equipo.tipo === "listo" && otras.length === 0 ? <p className={ui.migas}>{T.sinOtros}</p> : null}
          {otras.length > 0 ? (
            <>
              <label className={ui.campo}>
                <span>{T.aQuien}</span>
                <select className={ui.input} value={elegida} onChange={(e) => setElegida(e.target.value)}>
                  <option value="">{T.elegir}</option>
                  {otras.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              {elegida ? (
                <div className={ui.acciones}>
                  <button type="button" className={ui.botonPrimario} onClick={() => hacer({ tipo: "pasar", a: elegida, nombre: nombreElegida })}>
                    {T.pasarA(nombreElegida)}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {guardando ? (
        <p className={ui.meta} role="status">
          {T.guardando}
        </p>
      ) : null}
      {paso.tipo === "error" ? (
        <Aviso tono="error">
          {paso.mensaje}{" "}
          <button
            type="button"
            className={ui.botonSecundario}
            onClick={() => (paso.cambio ? onListo("") : hacer(paso.op))}
          >
            {T.reintentar}
          </button>
        </Aviso>
      ) : null}

      {historial.length > 0 ? (
        <ul className={estilos.historialProducto} aria-label={T.historial}>
          {historial.map((c) => (
            <li key={`${c.fecha}-${c.tipo}`}>
              <span className={ui.meta}>{formatearFechaHora(c.fecha)}</span> <span>{lineaDelHistorial(c)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
