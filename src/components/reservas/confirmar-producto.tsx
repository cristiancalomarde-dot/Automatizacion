"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { confirmarProductoDeReserva } from "@/app/(app)/reservas/[id]/acciones-producto";
import { cargarCatalogo } from "@/lib/catalogo/consultas";
import { AGENCIA_JOURNAWAY, filtrarCatalogo } from "@/lib/catalogo/reglas";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { esMotivoDeProducto, sugerenciaDelMotivo } from "@/lib/reservas/emparejar/motivos-de-producto";
import type { DetalleReserva, ProductoDeReserva } from "@/lib/reservas/tipos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Aviso } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import estilos from "./reservas.module.css";

const T = TEXTOS.reserva.confirmarProducto;
/** Cuántos productos del catálogo se listan a la vez (la búsqueda acota). */
const MAXIMO_RESULTADOS = 20;

/**
 * Spec M3-05: el recuadro se muestra si la reserva está para revisión por el
 * producto y todavía no tiene uno. Journaway queda afuera (sus paquetes los
 * arma otro reconocedor) y una reserva con partes armadas se resuelve a mano.
 * La acción lo vuelve a controlar en el servidor.
 */
export function puedeConfirmarProducto(reserva: DetalleReserva): boolean {
  return (
    reserva.estado === "para_revision" &&
    reserva.producto === null &&
    reserva.motivos.some(esMotivoDeProducto) &&
    reserva.agencia !== AGENCIA_JOURNAWAY &&
    reserva.partes.length === 0
  );
}

type Paso =
  | { tipo: "nada" }
  | { tipo: "preguntar"; producto: ProductoDeReserva }
  | { tipo: "confirmando"; producto: ProductoDeReserva; cambiar: boolean }
  | { tipo: "error"; producto: ProductoDeReserva; cambiar: boolean; mensaje: string }
  | { tipo: "conflicto"; producto: ProductoDeReserva; pregunta: string };

/**
 * "Producto sin confirmar" (spec M3-05 §4): lo que mandó la agencia, la
 * sugerencia de la IA con su seguridad, "Confirmar: es …" y "Elegir otro
 * producto". Confirmar siempre pasa por un OK corto; si la agencia ya tenía
 * ese nombre como otro producto, se pregunta antes de cambiarlo.
 */
export function ConfirmarProducto({ reserva, onConfirmado }: { reserva: DetalleReserva; onConfirmado: (mensaje: string) => void }) {
  const [paso, setPaso] = useState<Paso>({ tipo: "nada" });
  const [eligiendo, setEligiendo] = useState(false);
  const sugerencia = reserva.sugerencia ?? null;
  const confianza = sugerencia
    ? (reserva.motivos.map(sugerenciaDelMotivo).find((s) => s?.codigo === sugerencia.codigo)?.confianza ?? null)
    : null;

  async function confirmar(producto: ProductoDeReserva, cambiar: boolean) {
    setPaso({ tipo: "confirmando", producto, cambiar });
    const r = await confirmarProductoDeReserva({
      reservaId: reserva.id,
      productoId: producto.id,
      ...(cambiar ? { cambiarEquivalencia: true } : {}),
    }).catch(() => ({ ok: false as const, error: T.error(T.motivos.conexion) }));
    if (r.ok) {
      setPaso({ tipo: "nada" });
      onConfirmado(T.listo(r.estado === "recibida", r.codigo, r.agencia, r.aprendio));
      return;
    }
    if ("conflicto" in r && r.conflicto) {
      setPaso({ tipo: "conflicto", producto, pregunta: r.conflicto });
      return;
    }
    setPaso({ tipo: "error", producto, cambiar, mensaje: r.error });
  }

  const cerrar = () => setPaso({ tipo: "nada" });

  return (
    <section className={`${ui.seccion} ${estilos.confirmarProducto}`} aria-labelledby="titulo-confirmar-producto">
      <h2 id="titulo-confirmar-producto" className={ui.subtitulo}>
        {T.titulo}
      </h2>
      <p className={ui.migas}>
        {reserva.productoTextoAgencia ? T.agenciaMando(reserva.agencia, reserva.productoTextoAgencia) : T.agenciaNoDijo(reserva.agencia)}
      </p>
      {sugerencia ? (
        <p className={ui.meta}>
          {T.sugerencia(sugerencia.codigo, sugerencia.nombre)}
          {confianza !== null ? (
            <>
              {" · "}
              <span>{T.seguridad(Math.round(confianza * 100))}</span>
            </>
          ) : null}
        </p>
      ) : null}
      <div className={ui.acciones}>
        {sugerencia ? (
          <button type="button" className={ui.botonPrimario} onClick={() => setPaso({ tipo: "preguntar", producto: sugerencia })}>
            {T.confirmar(sugerencia.codigo, sugerencia.nombre)}
          </button>
        ) : null}
        <button
          type="button"
          className={sugerencia ? ui.botonSecundario : ui.botonPrimario}
          aria-expanded={eligiendo}
          onClick={() => setEligiendo((v) => !v)}
        >
          {sugerencia ? T.elegirOtro : T.elegir}
        </button>
      </div>
      {eligiendo ? <ElegirProducto onElegir={(producto) => setPaso({ tipo: "preguntar", producto })} /> : null}

      {paso.tipo !== "nada" ? (
        <Dialogo titulo={T.dialogo} onCerrar={paso.tipo === "confirmando" ? () => {} : cerrar}>
          {paso.tipo === "conflicto" ? (
            <>
              <p>{paso.pregunta}</p>
              <div className={ui.acciones}>
                <button type="button" className={ui.botonPrimario} onClick={() => confirmar(paso.producto, true)}>
                  {T.cambiar}
                </button>
                <button type="button" className={ui.botonSecundario} onClick={cerrar}>
                  {T.cancelar}
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                {reserva.productoTextoAgencia
                  ? T.pregunta(reserva.productoTextoAgencia, paso.producto.codigo, paso.producto.nombre)
                  : T.preguntaSinTexto(paso.producto.codigo, paso.producto.nombre)}{" "}
                {reserva.dePrueba ? T.deMuestraNoAprende : T.aprende(reserva.agencia)}
              </p>
              {paso.tipo === "error" ? <Aviso tono="error">{paso.mensaje}</Aviso> : null}
              <div className={ui.acciones}>
                {paso.tipo === "error" ? (
                  <button type="button" className={ui.botonPrimario} onClick={() => confirmar(paso.producto, paso.cambiar)}>
                    {T.reintentar}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={ui.botonPrimario}
                    disabled={paso.tipo === "confirmando"}
                    onClick={() => confirmar(paso.producto, false)}
                  >
                    {paso.tipo === "confirmando" ? T.confirmando : T.si}
                  </button>
                )}
                <button type="button" className={ui.botonSecundario} disabled={paso.tipo === "confirmando"} onClick={cerrar}>
                  {T.cancelar}
                </button>
              </div>
            </>
          )}
        </Dialogo>
      ) : null}
    </section>
  );
}

/** El buscador del catálogo (spec M3-05 fila 2): por código o nombre, con la consulta y el filtro del catálogo. */
function ElegirProducto({ onElegir }: { onElegir: (producto: ProductoDeReserva) => void }) {
  const { estado, reintentar } = useConsulta(() => cargarCatalogo(createSupabaseBrowserClient()));
  const [busqueda, setBusqueda] = useState("");
  const q = busqueda.trim();
  const resultados = estado.tipo === "listo" && q ? filtrarCatalogo(estado.datos, q).slice(0, MAXIMO_RESULTADOS) : [];

  return (
    <div className={estilos.elegirProducto}>
      <label className={ui.campo}>
        <span>{T.buscar}</span>
        <input
          type="search"
          className={ui.input}
          value={busqueda}
          aria-describedby="ayuda-elegir-producto"
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>
      <span id="ayuda-elegir-producto" className={ui.ayuda}>
        {T.buscarAyuda}
      </span>
      {estado.tipo === "cargando" ? <p className={ui.meta}>{T.cargandoCatalogo}</p> : null}
      {estado.tipo === "error" ? (
        <Aviso tono="error">
          {T.errorCatalogo}{" "}
          <button type="button" className={ui.botonSecundario} onClick={reintentar}>
            {T.reintentar}
          </button>
        </Aviso>
      ) : null}
      {estado.tipo === "listo" && q && resultados.length === 0 ? <p className={ui.migas}>{T.noEstaEnCatalogo}</p> : null}
      {resultados.length > 0 ? (
        <ul className={estilos.resultadosProducto} aria-label={T.resultados}>
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" className={ui.botonSecundario} onClick={() => onElegir({ id: p.id, codigo: p.codigo, nombre: p.nombre })}>
                {T.elegirEste(p.codigo, p.nombre)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Dialogo({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className={estilos.fondoDialogo}>
      <div
        ref={ref}
        className={estilos.dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-dialogo-producto"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCerrar();
        }}
      >
        <h2 id="titulo-dialogo-producto">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
