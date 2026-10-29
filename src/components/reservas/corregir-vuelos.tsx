"use client";

import { useState } from "react";
import { corregirDatoDeReserva, corregirVuelosDeReserva, marcarDatoRevisado } from "@/app/(app)/reservas/[id]/acciones-corregir";
import { formatearFecha, formatearFechaHora } from "@/lib/formato";
import type { ResultadoCorregir } from "@/lib/reservas/corregir/corregir";
import { datosDudosos, etiquetaDeDato, porQueNoSeCorrige, validarFechas, validarPax, versionParaCorregir } from "@/lib/reservas/corregir/decidir";
import {
  aFormulario,
  erroresDelVuelo,
  lineasDeVuelosDelMail,
  VUELO_VACIO,
  type CampoVuelo,
  type ErrorDeVuelo,
  type LadoVuelo,
  type VueloCorregido,
} from "@/lib/reservas/corregir/vuelos";
import type { DatoClave } from "@/lib/reservas/esquema-ficha";
import { frasesDeMotivos, motivoResueltoEnHistorial } from "@/lib/reservas/reglas";
import type { CorreccionDeReserva, DetalleReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { Aviso } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import estilos from "./reservas.module.css";

const T = TEXTOS.reserva.corregir;
const SIN_DATO = TEXTOS.comunes.sinDato;
/** El máximo de una nota corta (fila 3); el servidor y la base controlan lo mismo. */
const MAXIMO_NOTA = 200;

/** Spec M3-07 fila 1: en cualquier estado salvo cerrada, descartada o cancelada por la agencia. */
export function puedeCorregir(reserva: DetalleReserva): boolean {
  return porQueNoSeCorrige({ estado: reserva.estado, cancelacion: reserva.cancelacion }) === null;
}

/** Lo que vio la pantalla: si al guardar la reserva ya no está igual, no se pisa (fila 8). */
export const versionDe = (r: DetalleReserva) =>
  versionParaCorregir({
    estado: r.estado,
    motivos: r.motivos,
    vuelos: r.vuelos,
    fechaInicio: r.fechaInicio,
    fechaFin: r.fechaFin,
    pax: r.pax,
    notas: r.notas ?? [],
  });

/** "Listo: la reserva quedó recibida" o "sigue para revisión por: …" (§4). */
function mensajeListo(antes: DetalleReserva, r: Extract<ResultadoCorregir, { ok: true }>): string {
  const listo =
    antes.estado === "para_revision" && r.estado === "recibida"
      ? T.listoRecibida
      : r.estado === "para_revision"
        ? T.listoSigue(frasesDeMotivos(r.motivos).map((f) => f.frase).join(" "))
        : T.listo;
  // Owner 2026-10-20: si cambió la duración del tour, las partes no se corrieron solas.
  return r.aviso ? `${listo} ${r.aviso}` : listo;
}

type Estado =
  | { tipo: "nada" }
  | { tipo: "guardando" }
  | { tipo: "error"; mensaje: string; cambio: boolean };

/** Lo común a los tres guardados: "Guardando…", el "Listo" arriba o el error con "Reintentar" / "Volver a cargar". */
export function useGuardar(reserva: DetalleReserva, onListo: (mensaje: string) => void) {
  const [estado, setEstado] = useState<Estado>({ tipo: "nada" });
  async function guardar(accion: () => Promise<ResultadoCorregir>): Promise<ResultadoCorregir> {
    setEstado({ tipo: "guardando" });
    const r = await accion().catch((): ResultadoCorregir => ({ ok: false, error: T.error(T.motivos.conexion) }));
    if (r.ok) {
      setEstado({ tipo: "nada" });
      onListo(mensajeListo(reserva, r));
    } else {
      setEstado({ tipo: "error", mensaje: r.error, cambio: r.cambio === true });
    }
    return r;
  }
  return { estado, guardar, limpiar: () => setEstado({ tipo: "nada" }) };
}

export function ErrorAlGuardar({ estado, onReintentar, onRecargar }: { estado: Estado; onReintentar: () => void; onRecargar: () => void }) {
  if (estado.tipo !== "error") return null;
  return (
    <Aviso tono="error">
      <span>{estado.mensaje}</span>{" "}
      {estado.cambio ? (
        <button type="button" className={ui.botonSecundario} onClick={onRecargar}>
          {T.volverACargar}
        </button>
      ) : (
        <button type="button" className={ui.botonSecundario} onClick={onReintentar}>
          {T.reintentar}
        </button>
      )}
    </Aviso>
  );
}

// --- Corregir vuelos (filas 1 a 4) ----------------------------------------------------------------

interface PropsVuelos {
  reserva: DetalleReserva;
  abierto: boolean;
  onAbrir: (abierto: boolean) => void;
  onListo: (mensaje: string) => void;
  onRecargar: () => void;
}

/**
 * "Corregir vuelos" (spec M3-07 §4): cada vuelo como llegada o salida, con
 * número, aeropuerto, fecha y hora; agregar, editar y sacar; una nota corta
 * para el equipo; y al lado lo que dice el mail sobre vuelos, para copiar.
 */
export function CorregirVuelos({ reserva, abierto, onAbrir, onListo, onRecargar }: PropsVuelos) {
  if (!abierto) {
    return (
      <div className={ui.acciones}>
        <button type="button" className={ui.botonSecundario} onClick={() => onAbrir(true)}>
          {T.corregirVuelos}
        </button>
      </div>
    );
  }
  return <FormularioVuelos reserva={reserva} onCerrar={() => onAbrir(false)} onListo={onListo} onRecargar={onRecargar} />;
}

function FormularioVuelos({ reserva, onCerrar, onListo, onRecargar }: { reserva: DetalleReserva; onCerrar: () => void; onListo: (m: string) => void; onRecargar: () => void }) {
  const fechas = { fechaInicio: reserva.fechaInicio, fechaFin: reserva.fechaFin };
  const [filas, setFilas] = useState<VueloCorregido[]>(() => reserva.vuelos.map((v) => aFormulario(v, fechas)));
  const [nota, setNota] = useState("");
  const [errores, setErrores] = useState<ErrorDeVuelo[]>([]);
  const [errorNota, setErrorNota] = useState<string | null>(null);
  const { estado, guardar } = useGuardar(reserva, onListo);
  const guardando = estado.tipo === "guardando";
  const delMail = lineasDeVuelosDelMail(reserva.mails.map((m) => m.cuerpo));

  const cambiar = (i: number, cambio: Partial<VueloCorregido>) => {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
    setErrores((es) => es.filter((e) => !(e.fila === i && Object.keys(cambio).includes(e.campo))));
  };
  const sacar = (i: number) => {
    setFilas((fs) => fs.filter((_, j) => j !== i));
    setErrores((es) => es.filter((e) => e.fila !== i).map((e) => (e.fila > i ? { ...e, fila: e.fila - 1 } : e)));
  };
  const errorDe = (i: number, campo: CampoVuelo) => errores.find((e) => e.fila === i && e.campo === campo)?.mensaje ?? null;

  async function enviar() {
    const locales = filas.flatMap((f, i) => erroresDelVuelo(f, i));
    const notaLarga = nota.trim().length > MAXIMO_NOTA ? T.errores.notaLarga(MAXIMO_NOTA) : null;
    setErrores(locales);
    setErrorNota(notaLarga);
    if (locales.length || notaLarga) return;
    const r = await guardar(() =>
      corregirVuelosDeReserva({ reservaId: reserva.id, version: versionDe(reserva), vuelos: filas, nota: nota.trim() || null }),
    );
    if (!r.ok && r.errores) setErrores(r.errores);
  }

  return (
    <section className={estilos.corregirVuelos} aria-labelledby="titulo-corregir-vuelos" data-testid="corregir-vuelos">
      <h3 id="titulo-corregir-vuelos" className={ui.subtitulo}>
        {T.titulo}
      </h3>
      <p className={ui.meta}>{T.ayuda}</p>

      {delMail.length > 0 ? (
        <div className={estilos.delMail} aria-label={T.delMail} role="note">
          <strong>{T.delMail}</strong>
          <ul>
            {delMail.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {filas.length === 0 ? <p className={ui.meta}>{T.sinVuelos}</p> : null}
      {filas.map((f, i) => (
        <FilaVuelo
          key={i}
          indice={i}
          fila={f}
          deshabilitado={guardando}
          errorDe={(campo) => errorDe(i, campo)}
          onCambiar={(c) => cambiar(i, c)}
          onSacar={() => sacar(i)}
        />
      ))}

      <div className={ui.acciones}>
        <button type="button" className={ui.botonSecundario} disabled={guardando} onClick={() => setFilas((fs) => [...fs, { ...VUELO_VACIO }])}>
          {T.agregar}
        </button>
      </div>

      <label className={ui.campo}>
        <span>{T.nota}</span>
        <textarea
          className={ui.input}
          rows={2}
          value={nota}
          disabled={guardando}
          aria-describedby="ayuda-nota-vuelos"
          aria-invalid={errorNota ? true : undefined}
          onChange={(e) => {
            setNota(e.target.value);
            setErrorNota(null);
          }}
        />
      </label>
      <span id="ayuda-nota-vuelos" className={errorNota ? estilos.errorCampo : ui.ayuda}>
        {errorNota ?? T.notaAyuda}
      </span>

      <ErrorAlGuardar estado={estado} onReintentar={enviar} onRecargar={onRecargar} />
      <div className={ui.acciones}>
        <button type="button" className={ui.botonPrimario} disabled={guardando} onClick={enviar}>
          {guardando ? T.guardando : T.guardar}
        </button>
        <button type="button" className={ui.botonSecundario} disabled={guardando} onClick={onCerrar}>
          {T.cancelar}
        </button>
      </div>
    </section>
  );
}

interface PropsFila {
  indice: number;
  fila: VueloCorregido;
  deshabilitado: boolean;
  errorDe: (campo: CampoVuelo) => string | null;
  onCambiar: (cambio: Partial<VueloCorregido>) => void;
  onSacar: () => void;
}

function FilaVuelo({ indice, fila, deshabilitado, errorDe, onCambiar, onSacar }: PropsFila) {
  const id = (campo: string) => `vuelo-${indice}-${campo}`;
  const otro = fila.ladoOriginal === fila.lado && fila.otroExtremo?.aeropuerto ? fila.otroExtremo.aeropuerto : null;
  const campo = (c: CampoVuelo, etiqueta: string, props: { type?: string; placeholder?: string; ayuda?: string; mayusculas?: boolean }) => {
    const error = errorDe(c);
    const descripcion = error ? id(`${c}-error`) : props.ayuda ? id(`${c}-ayuda`) : undefined;
    return (
      <div className={ui.campo}>
        <label htmlFor={id(c)}>{etiqueta}</label>
        <input
          id={id(c)}
          className={ui.input}
          type={props.type ?? "text"}
          value={fila[c]}
          placeholder={props.placeholder}
          disabled={deshabilitado}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcion}
          onChange={(e) => onCambiar({ [c]: props.mayusculas ? e.target.value.toUpperCase() : e.target.value } as Partial<VueloCorregido>)}
        />
        {error ? (
          <span id={id(`${c}-error`)} className={estilos.errorCampo}>
            {error}
          </span>
        ) : props.ayuda ? (
          <span id={id(`${c}-ayuda`)} className={ui.ayuda}>
            {props.ayuda}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <fieldset className={estilos.filaVuelo}>
      <legend>{T.vuelo(indice + 1)}</legend>
      <div className={ui.campo}>
        <label htmlFor={id("lado")}>{T.lado}</label>
        <select
          id={id("lado")}
          className={ui.input}
          value={fila.lado}
          disabled={deshabilitado}
          onChange={(e) => onCambiar({ lado: e.target.value as LadoVuelo })}
        >
          <option value="llegada">{T.llegada}</option>
          <option value="salida">{T.salida}</option>
        </select>
        {otro ? <span className={ui.ayuda}>{T.otroExtremo(fila.lado, otro)}</span> : null}
      </div>
      {campo("numero", T.numero, { placeholder: "H2253", mayusculas: true })}
      {campo("aeropuerto", T.aeropuerto, { placeholder: "CJC", ayuda: T.aeropuertoAyuda, mayusculas: true })}
      {campo("fecha", T.fecha, { type: "date" })}
      {campo("hora", T.hora, { placeholder: "08:44", ayuda: T.horaAyuda })}
      <div className={ui.acciones}>
        <button type="button" className={ui.botonSecundario} disabled={deshabilitado} aria-label={`${T.sacar} (${T.vuelo(indice + 1)})`} onClick={onSacar}>
          {T.sacar}
        </button>
      </div>
    </fieldset>
  );
}

// --- Datos dudosos (fila 5) -----------------------------------------------------------------------

type Editando = { dato: "fechas"; inicio: string; fin: string; error: string | null } | { dato: "pax"; pax: string; error: string | null } | null;

/**
 * "La IA no está segura de: …" (spec M3-07 §4): "Corregir vuelos" para los
 * vuelos y, para los demás datos, "Está bien así" o "Corregir" (las fechas y
 * la cantidad de pasajeros; los pasajeros se dejan para otra pieza).
 */
export function DatosDudosos({
  reserva,
  onCorregirVuelos,
  onListo,
  onRecargar,
}: {
  reserva: DetalleReserva;
  onCorregirVuelos: () => void;
  onListo: (mensaje: string) => void;
  onRecargar: () => void;
}) {
  const datos = datosDudosos(reserva.motivos);
  const [editando, setEditando] = useState<Editando>(null);
  const [ultimo, setUltimo] = useState<(() => Promise<ResultadoCorregir>) | null>(null);
  const { estado, guardar } = useGuardar(reserva, onListo);
  const guardando = estado.tipo === "guardando";
  if (reserva.estado !== "para_revision" || datos.length === 0) return null;

  const hacer = (accion: () => Promise<ResultadoCorregir>) => {
    setUltimo(() => accion);
    void guardar(accion);
  };
  const base = { reservaId: reserva.id, version: versionDe(reserva) };
  const estaBien = (dato: DatoClave) => hacer(() => marcarDatoRevisado({ ...base, dato }));

  function guardarEdicion() {
    if (!editando) return;
    if (editando.dato === "fechas") {
      const error = validarFechas(editando.inicio, editando.fin);
      if (error) return setEditando({ ...editando, error });
      hacer(() => corregirDatoDeReserva({ ...base, dato: "fechas", fechaInicio: editando.inicio, fechaFin: editando.fin }));
    } else {
      const pax = Number(editando.pax);
      const error = editando.pax.trim() ? validarPax(pax) : T.errores.pax;
      if (error) return setEditando({ ...editando, error });
      hacer(() => corregirDatoDeReserva({ ...base, dato: "pax", pax }));
    }
  }

  const titulo = T.dudosos(datos.map(etiquetaDeDato).join(", "));
  return (
    <section className={`${ui.seccion} ${estilos.datosDudosos}`} aria-labelledby="titulo-datos-dudosos" data-testid="datos-dudosos">
      <h2 id="titulo-datos-dudosos" className={ui.subtitulo}>
        {titulo}
      </h2>
      <p className={ui.meta}>{T.dudososAyuda}</p>
      <ul className={estilos.listaDudosos}>
        {datos.map((dato) => {
          const etiqueta = etiquetaDeDato(dato);
          return (
            <li key={dato} className={estilos.itemDudoso} data-testid={`dudoso-${dato}`}>
              <span>{etiqueta}</span>
              {dato === "vuelos" ? (
                <button type="button" className={ui.botonPrimario} disabled={guardando} onClick={onCorregirVuelos}>
                  {T.corregirVuelos}
                </button>
              ) : (
                <>
                  <button type="button" className={ui.botonSecundario} disabled={guardando} aria-label={`${T.estaBien}: ${etiqueta}`} onClick={() => estaBien(dato)}>
                    {T.estaBien}
                  </button>
                  {dato === "fechas" || dato === "pax" ? (
                    <button
                      type="button"
                      className={ui.botonSecundario}
                      disabled={guardando}
                      aria-label={`${T.corregirDato}: ${etiqueta}`}
                      aria-expanded={editando?.dato === dato}
                      onClick={() =>
                        setEditando(
                          editando?.dato === dato
                            ? null
                            : dato === "fechas"
                              ? { dato, inicio: reserva.fechaInicio ?? "", fin: reserva.fechaFin ?? "", error: null }
                              : { dato, pax: reserva.pax ? String(reserva.pax) : "", error: null },
                        )
                      }
                    >
                      {T.corregirDato}
                    </button>
                  ) : null}
                  {dato === "pasajeros" ? <span className={ui.ayuda}>{T.pasajerosOtraPieza}</span> : null}
                </>
              )}
              {editando?.dato === dato ? (
                <EdicionDeDato editando={editando} guardando={guardando} onCambiar={setEditando} onGuardar={guardarEdicion} onCancelar={() => setEditando(null)} />
              ) : null}
            </li>
          );
        })}
      </ul>
      <ErrorAlGuardar estado={estado} onReintentar={() => ultimo && void guardar(ultimo)} onRecargar={onRecargar} />
    </section>
  );
}

function EdicionDeDato({
  editando,
  guardando,
  onCambiar,
  onGuardar,
  onCancelar,
}: {
  editando: NonNullable<Editando>;
  guardando: boolean;
  onCambiar: (e: Editando) => void;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const error = editando.error ? (
    <span id={`error-dato-${editando.dato}`} className={estilos.errorCampo}>
      {editando.error}
    </span>
  ) : null;
  const describe = editando.error ? `error-dato-${editando.dato}` : undefined;
  return (
    <div className={estilos.formRevision}>
      {editando.dato === "fechas" ? (
        <div className={ui.acciones}>
          <label className={ui.campo}>
            <span>{T.fechaInicio}</span>
            <input type="date" className={ui.input} value={editando.inicio} disabled={guardando} aria-describedby={describe} onChange={(e) => onCambiar({ ...editando, inicio: e.target.value, error: null })} />
          </label>
          <label className={ui.campo}>
            <span>{T.fechaFin}</span>
            <input type="date" className={ui.input} value={editando.fin} disabled={guardando} aria-describedby={describe} onChange={(e) => onCambiar({ ...editando, fin: e.target.value, error: null })} />
          </label>
        </div>
      ) : (
        <label className={ui.campo}>
          <span>{T.pax}</span>
          <input type="number" min={1} max={99} className={ui.input} value={editando.pax} disabled={guardando} aria-describedby={describe} onChange={(e) => onCambiar({ ...editando, pax: e.target.value, error: null })} />
        </label>
      )}
      {error}
      <div className={ui.acciones}>
        <button type="button" className={ui.botonPrimario} disabled={guardando} onClick={onGuardar}>
          {guardando ? T.guardando : T.guardar}
        </button>
        <button type="button" className={ui.botonSecundario} disabled={guardando} onClick={onCancelar}>
          {T.cancelar}
        </button>
      </div>
    </div>
  );
}

// --- Historial y avisos (filas 6 y 7) -------------------------------------------------------------

function lineaDeCorreccion(c: CorreccionDeReserva): string {
  const persona = c.persona || SIN_DATO;
  if (c.tipo === "vuelos") {
    const vuelos = c.vuelos.length
      ? c.vuelos.map((v) => T.vueloEnHistorial(v.lado, v.numero, v.aeropuerto, [v.fecha ? formatearFecha(v.fecha) : "", v.hora ?? ""].filter(Boolean).join(" "))).join("; ")
      : T.historialSinVuelos;
    return T.historialVuelos(persona, vuelos, c.nota);
  }
  if (c.tipo === "resuelto") return T.historialResuelto(persona, motivoResueltoEnHistorial(c.resueltos ?? []) || SIN_DATO, c.explicacion ?? SIN_DATO);
  const dato = c.dato && c.dato in ETIQUETAS ? ETIQUETAS[c.dato as DatoClave] : (c.dato ?? SIN_DATO);
  if (c.tipo === "revisado") return T.historialRevisado(persona, dato);
  const corregido = T.historialCorregido(persona, dato);
  return c.diasCorridos ? `${corregido} y ${T.historialCorrio(c.diasCorridos)}` : corregido;
}

const ETIQUETAS: Record<DatoClave, string> = {
  agencia: etiquetaDeDato("agencia"),
  numero_reserva: etiquetaDeDato("numero_reserva"),
  producto: etiquetaDeDato("producto"),
  fechas: etiquetaDeDato("fechas"),
  pax: etiquetaDeDato("pax"),
  pasajeros: etiquetaDeDato("pasajeros"),
  vuelos: etiquetaDeDato("vuelos"),
};

/** Fila 7: "<persona> corrigió los vuelos: …" y "<persona> marcó como revisado: …". */
export function HistorialDeCorrecciones({ correcciones }: { correcciones: CorreccionDeReserva[] }) {
  if (correcciones.length === 0) return null;
  return (
    <div>
      <p className={estilos.avisoTitulo}>{T.historialTitulo}</p>
      <ul className={estilos.historialProducto} data-testid="historial-correcciones">
        {correcciones.map((c) => (
          <li key={`${c.fecha}-${c.tipo}-${c.dato ?? ""}`}>
            <span className={ui.meta}>{formatearFechaHora(c.fecha)}</span> <span>{lineaDeCorreccion(c)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Fila 6: el vuelo cambió después de enviar el pedido: avisarle al proveedor (M4 lo manda). */
export function AvisoCambioDeVuelo({ proveedores }: { proveedores: string[] }) {
  if (proveedores.length === 0) return null;
  return (
    <Aviso tono="aviso">
      <ul className={estilos.motivos} data-testid="avisos-cambio-vuelo">
        {proveedores.map((p) => (
          <li key={p}>{T.avisoPedidoEnviado(p)}</li>
        ))}
      </ul>
    </Aviso>
  );
}
