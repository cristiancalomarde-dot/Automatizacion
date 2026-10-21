"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  agregarPedidoAManoDeLaReserva,
  armarPedidosDeLaReserva,
  buscarProveedoresDelDirectorio,
  enviarPedidos,
  guardarBorradorDePedido,
  sacarPedidoAManoDeLaReserva,
} from "@/app/(app)/reservas/[id]/pedidos/acciones";
import { formatearFecha } from "@/lib/formato";
import { esPedidoAMano, nombreDelPedido, validarPedidoAMano, type BorradorAMano } from "@/lib/pedidos/a-mano";
import type { PedidoGuardado, TareaGuardada } from "@/lib/pedidos/guardar";
import {
  conteoEnvio,
  estadoDeEnvio,
  firmaConNombre,
  horaCorta,
  resumirLoQuePidio,
  sePuedeEnviar,
  type ConfiguracionEnvio,
  type LoQuePidio,
} from "@/lib/pedidos/pantalla";
import type { EnvioHecho, PantallaPedidos, ProveedorEncontrado, ResultadoPedido } from "@/lib/pedidos/revision";
import { TEXTOS } from "@/lib/textos";
import { Aviso, Chip, EsqueletoDetalle, EstadoError } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import estilos from "./pedidos.module.css";

const T = TEXTOS.pedidos;
const A = T.aMano;
const LOGIN = "/login?error=sesion_vencida";

type Estado = { tipo: "cargando" } | { tipo: "error"; motivo: string } | { tipo: "listo"; datos: PantallaPedidos };

/** Lo que se va a mandar desde el diálogo: "Enviar N", "Reintentar" o "Reenviar" (spec M3-03). */
type PedidoDeDialogo = { pedidos: PedidoGuardado[]; titulo: string; reenviar: boolean; conPendientes: boolean };

/**
 * Pedidos a proveedores de una reserva (spec M3-02): una tarjeta por pedido
 * para revisar y corregir, las tareas a mano, los avisos, "Volver a armar" y
 * el diálogo "Enviar N pedidos" (#4: lista a quién se escribe). Todo lo arma,
 * lo guarda y lo manda el servidor (acciones.ts → lib/pedidos); acá no hay
 * armado ni envío. M3-03: el estado de envío de cada tarjeta, "Reintentar",
 * "Reenviar" y la franja fija del modo prueba.
 */
export function PedidosPantalla({ reservaId, firmante, envio }: { reservaId: string; firmante: string; envio: ConfiguracionEnvio }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);
  const [rearmando, setRearmando] = useState(false);
  const [errorRearmar, setErrorRearmar] = useState(false);
  const [confirmarRearmar, setConfirmarRearmar] = useState(false);
  const [excluidos, setExcluidos] = useState<ReadonlySet<string>>(new Set());
  const [dialogoEnvio, setDialogoEnvio] = useState<PedidoDeDialogo | null>(null);
  // M3-03: los pedidos que están saliendo ahora, lo que contestó el envío por pedido y el resumen.
  const [enviando, setEnviando] = useState<ReadonlySet<string>>(new Set());
  const [resultados, setResultados] = useState<ReadonlyMap<string, ResultadoPedido>>(new Map());
  const [ultimoEnvio, setUltimoEnvio] = useState<EnvioHecho | null>(null);
  // M3-09: el pedido a mano que se está por sacar (con confirmación).
  const [aSacar, setASacar] = useState<PedidoGuardado | null>(null);

  useEffect(() => {
    let vigente = true;
    armarPedidosDeLaReserva(reservaId, { reemplazarEditados: false }).then(
      (r) => {
        if (!vigente) return;
        if (r.ok) setEstado({ tipo: "listo", datos: r });
        else if (r.sinSesion) router.replace(LOGIN);
        else setEstado({ tipo: "error", motivo: r.error });
      },
      () => vigente && setEstado({ tipo: "error", motivo: "Falló la conexión con el servidor." }),
    );
    return () => {
      vigente = false;
    };
  }, [reservaId, intento, router]);

  function reintentar() {
    setEstado({ tipo: "cargando" });
    setIntento((n) => n + 1);
  }

  async function rearmar(reemplazarEditados: boolean) {
    setConfirmarRearmar(false);
    setRearmando(true);
    setErrorRearmar(false);
    const r = await armarPedidosDeLaReserva(reservaId, { reemplazarEditados }).catch(() => null);
    setRearmando(false);
    if (r?.ok) setEstado({ tipo: "listo", datos: r });
    else if (r && !r.ok && r.sinSesion) router.replace(LOGIN);
    else setErrorRearmar(true);
  }

  function alEnviar(r: EnvioHecho) {
    setEnviando(new Set());
    setResultados((antes) => new Map([...antes, ...r.resultados.map((x) => [x.pedidoId, x] as const)]));
    setUltimoEnvio(r);
    setEstado((e) => (e.tipo === "listo" ? { tipo: "listo", datos: { ...e.datos, pedidos: r.pedidos } } : e));
  }

  function actualizarPedido(p: PedidoGuardado) {
    setEstado((e) => (e.tipo === "listo" ? { tipo: "listo", datos: { ...e.datos, pedidos: e.datos.pedidos.map((x) => (x.id === p.id ? p : x)) } } : e));
  }

  /** M3-09: el pedido a mano recién guardado entra al final, como uno más. */
  function sumarPedido(p: PedidoGuardado) {
    setEstado((e) => (e.tipo === "listo" ? { tipo: "listo", datos: { ...e.datos, pedidos: [...e.datos.pedidos.filter((x) => x.id !== p.id), p] } } : e));
  }

  function quitarPedido(id: string) {
    setEstado((e) => (e.tipo === "listo" ? { tipo: "listo", datos: { ...e.datos, pedidos: e.datos.pedidos.filter((x) => x.id !== id) } } : e));
  }

  return (
    <div className={ui.pagina}>
      {envio.modoPrueba ? (
        <p className={estilos.franjaPrueba} data-testid="franja-prueba">
          {T.franjaPrueba(envio.destinoPrueba)}
        </p>
      ) : null}
      <nav className={ui.migas} aria-label="Ubicación">
        <Link href={`/reservas/${reservaId}`} className={ui.enlace}>
          {T.volver}
        </Link>
      </nav>
      <header className={ui.encabezado}>
        <h1 className={ui.titulo}>{T.titulo}</h1>
        {estado.tipo === "listo" ? (
          <span className={ui.meta}>{[estado.datos.reserva.agencia, estado.datos.reserva.numero].filter(Boolean).join(" · ")}</span>
        ) : null}
      </header>

      {estado.tipo === "cargando" ? (
        <div>
          <p className={ui.meta} role="status">
            {T.armando}
          </p>
          <EsqueletoDetalle etiqueta={T.armando} />
        </div>
      ) : null}
      {estado.tipo === "error" ? (
        <EstadoError mensaje={`${T.error} ${estado.motivo}`} onReintentar={reintentar} volver={{ href: `/reservas/${reservaId}`, texto: T.volver }} />
      ) : null}
      {estado.tipo === "listo" ? (
        <Revision
          datos={estado.datos}
          firmante={firmante}
          envio={envio}
          excluidos={excluidos}
          onIncluir={(casilla, incluir) =>
            setExcluidos((antes) => new Set(incluir ? [...antes].filter((c) => c !== casilla) : [...antes, casilla]))
          }
          onGuardado={actualizarPedido}
          onSinSesion={() => router.replace(LOGIN)}
          rearmando={rearmando}
          errorRearmar={errorRearmar}
          onVolverAArmar={() => (estado.datos.pedidos.some((p) => p.editado && !esPedidoAMano(p)) ? setConfirmarRearmar(true) : rearmar(false))}
          onEnviar={(aEnviar, pendientes) => setDialogoEnvio({ pedidos: aEnviar, titulo: T.enviar(aEnviar.length, pendientes), reenviar: false, conPendientes: true })}
          onReintentar={(p) => setDialogoEnvio({ pedidos: [p], titulo: T.envio.tituloReintentar, reenviar: false, conPendientes: false })}
          onReenviar={(p) => setDialogoEnvio({ pedidos: [p], titulo: T.envio.tituloReenviar, reenviar: true, conPendientes: false })}
          enviando={enviando}
          resultados={resultados}
          ultimoEnvio={ultimoEnvio}
          reservaId={reservaId}
          onAgregado={sumarPedido}
          onSacar={setASacar}
        />
      ) : null}

      {aSacar ? (
        <DialogoSacar
          pedido={aSacar}
          onCerrar={() => setASacar(null)}
          onSinSesion={() => router.replace(LOGIN)}
          onSacado={(id) => {
            setASacar(null);
            quitarPedido(id);
          }}
        />
      ) : null}

      {confirmarRearmar && estado.tipo === "listo" ? (
        <Dialogo titulo={T.rearmar.titulo} onCerrar={() => setConfirmarRearmar(false)}>
          <p>{T.rearmar.editados(estado.datos.pedidos.filter((p) => p.editado && !esPedidoAMano(p)).length)}</p>
          <div className={ui.acciones}>
            <button type="button" className={ui.botonPrimario} onClick={() => rearmar(false)}>
              {T.rearmar.conservar}
            </button>
            <button type="button" className={ui.botonSecundario} onClick={() => rearmar(true)}>
              {T.rearmar.reemplazar}
            </button>
            <button type="button" className={ui.botonSecundario} onClick={() => setConfirmarRearmar(false)}>
              {T.rearmar.cancelar}
            </button>
          </div>
        </Dialogo>
      ) : null}

      {dialogoEnvio && estado.tipo === "listo" ? (
        <DialogoEnvio
          reservaId={reservaId}
          aEnviar={dialogoEnvio.pedidos}
          pendientes={dialogoEnvio.conPendientes ? conteoEnvio(estado.datos.pedidos, excluidos).pendientes : []}
          titulo={dialogoEnvio.titulo}
          reenviar={dialogoEnvio.reenviar}
          pidio={estado.datos.pidio ?? null}
          firmante={firmante}
          envio={envio}
          onCerrar={() => setDialogoEnvio(null)}
          onSinSesion={() => router.replace(LOGIN)}
          onEnviando={(ids) => setEnviando(new Set(ids))}
          onEnviado={(r) => {
            setDialogoEnvio(null);
            alEnviar(r);
          }}
          onFallo={() => setEnviando(new Set())}
        />
      ) : null}
    </div>
  );
}

function Revision({
  datos,
  firmante,
  envio,
  excluidos,
  onIncluir,
  onGuardado,
  onSinSesion,
  rearmando,
  errorRearmar,
  onVolverAArmar,
  onEnviar,
  onReintentar,
  onReenviar,
  enviando,
  resultados,
  ultimoEnvio,
  reservaId,
  onAgregado,
  onSacar,
}: {
  datos: PantallaPedidos;
  firmante: string;
  envio: ConfiguracionEnvio;
  excluidos: ReadonlySet<string>;
  onIncluir: (casilla: string, incluir: boolean) => void;
  onGuardado: (p: PedidoGuardado) => void;
  onSinSesion: () => void;
  rearmando: boolean;
  errorRearmar: boolean;
  onVolverAArmar: () => void;
  onEnviar: (aEnviar: PedidoGuardado[], pendientes: number) => void;
  onReintentar: (p: PedidoGuardado) => void;
  onReenviar: (p: PedidoGuardado) => void;
  enviando: ReadonlySet<string>;
  resultados: ReadonlyMap<string, ResultadoPedido>;
  ultimoEnvio: EnvioHecho | null;
  reservaId: string;
  onAgregado: (p: PedidoGuardado) => void;
  onSacar: (p: PedidoGuardado) => void;
}) {
  const { aEnviar, pendientes } = conteoEnvio(datos.pedidos, excluidos);
  const hayPedidos = datos.pedidos.length > 0;
  const [escribiendo, setEscribiendo] = useState(false);
  // M3-09 fila 1: solo en una reserva recibida o pedida a proveedor que no sea una cancelación (el servidor manda el borrador).
  const borradorAMano = datos.aMano && (!datos.estadoReserva || datos.estadoReserva === "recibida" || datos.estadoReserva === "pedido_a_proveedor") ? datos.aMano : null;

  return (
    <>
      {datos.pidio ? <LoQuePidioLaAgencia pidio={datos.pidio} /> : null}
      {datos.avisos.length > 0 ? (
        <Aviso tono="aviso">
          <div data-testid="avisos-pedidos">
            <p className={estilos.avisoTitulo}>{T.avisosTitulo}</p>
            <ul className={estilos.lista}>
              {datos.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </Aviso>
      ) : null}
      {errorRearmar ? <Aviso tono="error">{T.errorRearmar}</Aviso> : null}
      {ultimoEnvio ? <ResumenEnvio envio={ultimoEnvio} reservaId={reservaId} /> : null}

      {hayPedidos ? (
        <div className={estilos.tarjetas}>
          {datos.pedidos.map((p) => (
            <TarjetaPedido
              key={p.id}
              pedido={p}
              cc={envio.cc}
              firmante={firmante}
              incluido={!excluidos.has(p.casilla)}
              onIncluir={(si) => onIncluir(p.casilla, si)}
              onGuardado={onGuardado}
              onSinSesion={onSinSesion}
              enviandoAhora={enviando.has(p.id)}
              resultado={resultados.get(p.id)}
              destinoPrueba={envio.destinoPrueba}
              onReintentar={() => onReintentar(p)}
              onReenviar={() => onReenviar(p)}
              onSacar={() => onSacar(p)}
            />
          ))}
        </div>
      ) : (
        <div className={ui.estadoVacio}>
          <p className={ui.estadoTexto}>{datos.tareas.length ? T.vacio : T.vacioSinTareas}</p>
          {datos.tareas.length ? <ListaTareas tareas={datos.tareas} /> : null}
        </div>
      )}

      {borradorAMano && escribiendo ? (
        <NuevoPedidoAMano
          reservaId={reservaId}
          borrador={borradorAMano}
          firmante={firmante}
          cc={envio.cc}
          onCancelar={() => setEscribiendo(false)}
          onSinSesion={onSinSesion}
          onGuardado={(p) => {
            setEscribiendo(false);
            onAgregado(p);
          }}
        />
      ) : null}
      {borradorAMano && !escribiendo ? (
        <div className={ui.acciones}>
          <button type="button" className={ui.botonSecundario} onClick={() => setEscribiendo(true)}>
            {A.agregar}
          </button>
        </div>
      ) : null}

      {hayPedidos && datos.tareas.length > 0 ? (
        <section className={ui.seccion} aria-labelledby="titulo-tareas">
          <h2 id="titulo-tareas" className={ui.subtitulo}>
            {T.tareas}
          </h2>
          <ListaTareas tareas={datos.tareas} />
        </section>
      ) : null}

      <div className={estilos.barraEnvio}>
        <button type="button" className={ui.botonSecundario} onClick={onVolverAArmar} disabled={rearmando}>
          {rearmando ? T.rearmando : T.volverAArmar}
        </button>
        {hayPedidos ? (
          <button
            type="button"
            className={ui.botonPrimario}
            onClick={() => onEnviar(aEnviar, pendientes.length)}
            disabled={aEnviar.length === 0 || rearmando || enviando.size > 0}
          >
            {T.enviar(aEnviar.length, pendientes.length)}
          </button>
        ) : null}
      </div>
    </>
  );
}

/**
 * Owner 2026-10-20: lo que pidió la agencia (y las notas de la reserva), bien
 * visible arriba: los pedidos se arman del catálogo y no lo reflejan solos.
 * No bloquea el envío.
 */
function LoQuePidioLaAgencia({ pidio }: { pidio: LoQuePidio }) {
  return (
    <div className={`${ui.aviso} ${ui.aviso_aviso} ${estilos.pidio}`} role="status" data-testid="pidio-agencia">
      {pidio.pedidos.length ? <p className={estilos.pidioLinea}>{T.pidio.agencia(pidio.pedidos.join(" · "))}</p> : null}
      {pidio.notas.length ? <p className={estilos.pidioLinea}>{T.pidio.notas(pidio.notas.join(" · "))}</p> : null}
    </div>
  );
}

/** Lo que contestó el último envío (spec M3-03 §4): cuántos salieron, los avisos y el camino de vuelta al detalle. */
function ResumenEnvio({ envio, reservaId }: { envio: EnvioHecho; reservaId: string }) {
  const salieron = envio.resultados.filter((r) => r.tipo === "enviado").length;
  const fallaron = envio.resultados.filter((r) => r.tipo === "fallo").length;
  const avisos = [...envio.avisos, ...envio.resultados.flatMap((r) => (r.tipo === "enviado" && r.aviso ? [r.aviso] : []))];
  return (
    <Aviso tono={fallaron > 0 || avisos.length > 0 ? "aviso" : "info"}>
      <div data-testid="resumen-envio">
        <p className={estilos.avisoTitulo}>{T.envio.resumen(salieron, fallaron, envio.modoPrueba)}</p>
        {avisos.length ? (
          <ul className={estilos.lista}>
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : null}
        <p className={ui.migas}>
          <Link href={`/reservas/${reservaId}`} className={ui.enlace}>
            {T.volver}
          </Link>
        </p>
      </div>
    </Aviso>
  );
}

function ListaTareas({ tareas }: { tareas: TareaGuardada[] }) {
  return (
    <ul className={estilos.lista}>
      {tareas.map((t) => (
        <li key={t.id}>{t.texto}</li>
      ))}
    </ul>
  );
}

/** "ARCH31 · 10/01/2027" por cada parte que cubre el pedido. */
function queCubre(partes: unknown[]): string[] {
  const vistos = new Set<string>();
  for (const x of partes) {
    if (!x || typeof x !== "object") continue;
    const { producto, fecha } = x as { producto?: unknown; fecha?: unknown };
    const texto = [typeof producto === "string" ? producto : null, typeof fecha === "string" ? formatearFecha(fecha) : null].filter(Boolean).join(" · ");
    if (texto) vistos.add(texto);
  }
  return [...vistos];
}

type Guardado = { tipo: "nada" } | { tipo: "guardando" } | { tipo: "guardado" } | { tipo: "error" };

function TarjetaPedido({
  pedido,
  cc,
  firmante,
  incluido,
  onIncluir,
  onGuardado,
  onSinSesion,
  enviandoAhora,
  resultado,
  destinoPrueba,
  onReintentar,
  onReenviar,
  onSacar,
}: {
  pedido: PedidoGuardado;
  cc: string[];
  firmante: string;
  incluido: boolean;
  onIncluir: (si: boolean) => void;
  onGuardado: (p: PedidoGuardado) => void;
  onSinSesion: () => void;
  enviandoAhora: boolean;
  resultado: ResultadoPedido | undefined;
  destinoPrueba: string;
  onReintentar: () => void;
  onReenviar: () => void;
  onSacar: () => void;
}) {
  const [asunto, setAsunto] = useState(pedido.asunto);
  const [cuerpo, setCuerpo] = useState(pedido.cuerpo);
  const [base, setBase] = useState({ asunto: pedido.asunto, cuerpo: pedido.cuerpo });
  const [guardado, setGuardado] = useState<Guardado>({ tipo: "nada" });
  const sinMail = pedido.destinatarios.length === 0;
  // M3-03: lo enviado o enviándose ya no se edita ni se incluye en "Enviar N".
  const cerrado = !sinMail && !sePuedeEnviar(pedido);
  const bloqueado = sinMail || cerrado || enviandoAhora;
  const nombre = pedido.proveedores.join(" y ") || TEXTOS.comunes.sinDato;
  const idBase = `pedido-${pedido.id}`;
  const cubre = queCubre(pedido.partes);
  const aMano = esPedidoAMano(pedido);
  // M3-09 fila 8: un pedido a mano se saca mientras no se envió (la base vuelve a chequearlo).
  const sePuedeSacar = aMano && (pedido.estado === "borrador" || pedido.estado === "fallo") && !enviandoAhora;

  async function guardar() {
    if (bloqueado || pedido.estado !== "borrador" || (asunto === base.asunto && cuerpo === base.cuerpo)) return;
    setGuardado({ tipo: "guardando" });
    const r = await guardarBorradorDePedido({ pedidoId: pedido.id, asunto, cuerpo }).catch(() => null);
    if (r?.ok) {
      setBase({ asunto, cuerpo });
      setGuardado({ tipo: "guardado" });
      onGuardado(r.pedido);
    } else if (r && !r.ok && r.sinSesion) {
      onSinSesion();
    } else {
      setGuardado({ tipo: "error" });
    }
  }

  return (
    <article className={`${estilos.tarjeta} ${sinMail || !incluido || cerrado ? estilos.tarjetaApagada : ""}`} aria-labelledby={`${idBase}-titulo`}>
      <div className={estilos.cabecera}>
        <h2 id={`${idBase}-titulo`} className={estilos.proveedor}>
          {nombre}
        </h2>
        <span className={ui.chips}>
          {aMano ? <Chip tono="info">{A.etiqueta}</Chip> : null}
          {pedido.editado ? <Chip tono="info">{T.editado}</Chip> : null}
          {sinMail ? <Chip tono="aviso">{T.sinMail}</Chip> : null}
          <label className={estilos.incluir}>
            <input type="checkbox" checked={!bloqueado && incluido} disabled={bloqueado} onChange={(e) => onIncluir(e.target.checked)} />
            {T.incluir}
          </label>
        </span>
      </div>

      <EstadoDelEnvio
        pedido={pedido}
        enviandoAhora={enviandoAhora}
        resultado={resultado}
        destinoPrueba={destinoPrueba}
        onReintentar={onReintentar}
        onReenviar={onReenviar}
      />

      {sinMail ? (
        <Aviso tono="aviso">
          <span>{pedido.sin_destinatario}</span>{" "}
          {pedido.proveedor_ids[0] ? (
            <Link href={`/proveedores/${pedido.proveedor_ids[0]}`} className={ui.enlace}>
              {T.completarDirectorio}
            </Link>
          ) : null}
        </Aviso>
      ) : null}

      <dl className={ui.datos}>
        {!sinMail ? (
          <>
            <dt>{T.para}</dt>
            <dd title={aMano ? undefined : T.destinatarioAyuda}>{pedido.destinatarios.join(", ")}</dd>
          </>
        ) : null}
        <dt>{T.cc}</dt>
        <dd>{cc.join(", ")}</dd>
        {cubre.length ? (
          <>
            <dt>{T.cubre}</dt>
            <dd>{cubre.join(" · ")}</dd>
          </>
        ) : null}
      </dl>

      {pedido.avisos.length > 0 ? (
        <Aviso tono="aviso">
          <ul className={estilos.lista}>
            {pedido.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>{T.asunto}</span>
        <input className={estilos.editor} value={asunto} disabled={bloqueado} onChange={(e) => setAsunto(e.target.value)} onBlur={guardar} />
      </label>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>{T.texto}</span>
        <textarea className={estilos.editor} value={cuerpo} rows={14} disabled={bloqueado} onChange={(e) => setCuerpo(e.target.value)} onBlur={guardar} />
      </label>
      <div className={estilos.campo}>
        <span className={estilos.etiqueta}>{T.firma}</span>
        <p className={estilos.firma}>{firmaConNombre(pedido.firma, firmante)}</p>
      </div>

      {guardado.tipo === "guardando" ? <span className={estilos.estadoGuardado}>{T.guardando}</span> : null}
      {guardado.tipo === "guardado" ? (
        <span className={estilos.estadoGuardado} role="status">
          {T.guardado}
        </span>
      ) : null}
      {guardado.tipo === "error" ? <Aviso tono="error">{T.errorGuardar}</Aviso> : null}
      {sePuedeSacar ? (
        <div className={ui.acciones}>
          <button type="button" className={ui.botonSecundario} onClick={onSacar}>
            {A.sacar}
          </button>
        </div>
      ) : null}
    </article>
  );
}

/** "Enviando…" → "Enviado ✓ 14:32" o "No se pudo enviar ✗: <motivo>" con "Reintentar" (spec M3-03 §4, filas 7 y 9). */
function EstadoDelEnvio({
  pedido,
  enviandoAhora,
  resultado,
  destinoPrueba,
  onReintentar,
  onReenviar,
}: {
  pedido: PedidoGuardado;
  enviandoAhora: boolean;
  resultado: ResultadoPedido | undefined;
  destinoPrueba: string;
  onReintentar: () => void;
  onReenviar: () => void;
}) {
  const E = T.envio;
  if (enviandoAhora) {
    return (
      <p className={estilos.estadoEnvio} role="status">
        {E.enviando}
      </p>
    );
  }
  const estado = estadoDeEnvio(pedido);
  const noEnviado = resultado?.tipo === "no_enviado" ? <Aviso tono="aviso">{resultado.motivo}</Aviso> : null;
  const aviso = resultado?.tipo === "enviado" && resultado.aviso ? <Aviso tono="aviso">{resultado.aviso}</Aviso> : null;
  switch (estado.tipo) {
    case "enviado":
      return (
        <div className={estilos.estadoFila}>
          <span className={`${estilos.estadoEnvio} ${estilos.estadoOk}`}>{E.enviado(horaCorta(estado.en), estado.quien)}</span>
          <button type="button" className={ui.botonSecundario} onClick={onReenviar}>
            {E.reenviar}
          </button>
          {aviso ?? noEnviado}
        </div>
      );
    case "fallo":
      return (
        <div className={estilos.estadoFila}>
          <span className={`${estilos.estadoEnvio} ${estilos.estadoMal}`}>{E.fallo(estado.motivo)}</span>
          <button type="button" className={ui.botonSecundario} onClick={onReintentar}>
            {E.reintentar}
          </button>
          {noEnviado}
        </div>
      );
    case "trabado":
      return (
        <div className={estilos.estadoFila}>
          <span className={`${estilos.estadoEnvio} ${estilos.estadoMal}`}>{E.trabado}</span>
          <button type="button" className={ui.botonSecundario} onClick={onReenviar}>
            {E.reenviar}
          </button>
        </div>
      );
    case "enviando":
      return <p className={estilos.estadoEnvio}>{E.enviando}</p>;
    case "prueba":
      return (
        <div className={estilos.estadoFila}>
          <span className={`${estilos.estadoEnvio} ${estilos.estadoOk}`}>{E.pruebaEnviada(horaCorta(estado.en), destinoPrueba)}</span>
          {aviso ?? noEnviado}
        </div>
      );
    default:
      return noEnviado;
  }
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
        aria-labelledby="titulo-dialogo"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCerrar();
        }}
      >
        <h2 id="titulo-dialogo">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

type Respuesta = { tipo: "nada" } | { tipo: "enviando" } | { tipo: "error"; mensaje: string };

/**
 * La confirmación explícita (#4): a quién se escribe, con copia a quién y quién
 * firma. Confirmar manda (M3-03); sin pasar por acá no sale nada.
 */
function DialogoEnvio({
  reservaId,
  aEnviar,
  pendientes,
  titulo,
  reenviar,
  pidio,
  firmante,
  envio,
  onCerrar,
  onSinSesion,
  onEnviando,
  onEnviado,
  onFallo,
}: {
  reservaId: string;
  aEnviar: PedidoGuardado[];
  pendientes: PedidoGuardado[];
  titulo: string;
  reenviar: boolean;
  pidio: LoQuePidio | null;
  firmante: string;
  envio: ConfiguracionEnvio;
  onCerrar: () => void;
  onSinSesion: () => void;
  onEnviando: (ids: string[]) => void;
  onEnviado: (r: EnvioHecho) => void;
  onFallo: () => void;
}) {
  const [respuesta, setRespuesta] = useState<Respuesta>({ tipo: "nada" });

  async function confirmar() {
    const pedidoIds = aEnviar.map((p) => p.id);
    setRespuesta({ tipo: "enviando" });
    onEnviando(pedidoIds);
    const r = await enviarPedidos({ reservaId, pedidoIds, confirmado: true, ...(reenviar ? { reenviar: true } : {}) }).catch(() => null);
    if (r?.ok) return onEnviado(r);
    onFallo();
    if (r && r.sinSesion) return onSinSesion();
    setRespuesta({ tipo: "error", mensaje: r?.error ?? T.envio.error });
  }

  return (
    <Dialogo titulo={titulo} onCerrar={respuesta.tipo === "enviando" ? () => undefined : onCerrar}>
      {envio.modoPrueba ? <p className={estilos.modoPrueba}>{T.dialogo.modoPrueba(envio.destinoPrueba)}</p> : null}
      {reenviar ? <Aviso tono="aviso">{T.envio.avisoReenviar}</Aviso> : null}
      {pidio ? (
        <Aviso tono="aviso">
          <span data-testid="pidio-dialogo">
            {pidio.pedidos.length ? T.pidio.dialogo(resumirLoQuePidio(pidio.pedidos)) : T.pidio.dialogoNotas(resumirLoQuePidio(pidio.notas))}
          </span>
        </Aviso>
      ) : null}
      <div>
        <p className={estilos.etiqueta}>{T.dialogo.intro}</p>
        <ul className={estilos.lista}>
          {aEnviar.map((p) => (
            <li key={p.id}>{`${p.proveedores.join(" y ")} — ${p.destinatarios.join(", ")}`}</li>
          ))}
        </ul>
      </div>
      <dl className={ui.datos}>
        <dt>{T.dialogo.cc}</dt>
        <dd>{envio.cc.join(", ")}</dd>
        <dt>{T.dialogo.firma}</dt>
        <dd>{firmante}</dd>
      </dl>
      {pendientes.length > 0 ? (
        <div>
          <p className={estilos.etiqueta}>{T.dialogo.pendientes}</p>
          <ul className={estilos.lista}>
            {pendientes.map((p) => (
              <li key={p.id}>{p.proveedores.join(" y ")}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {respuesta.tipo === "error" ? <Aviso tono="error">{respuesta.mensaje}</Aviso> : null}
      <div className={ui.acciones}>
        <button type="button" className={ui.botonPrimario} onClick={confirmar} disabled={respuesta.tipo === "enviando" || aEnviar.length === 0}>
          {respuesta.tipo === "enviando" ? T.dialogo.enviando : T.dialogo.confirmar}
        </button>
        <button type="button" className={ui.botonSecundario} onClick={onCerrar} disabled={respuesta.tipo === "enviando"}>
          {T.dialogo.cancelar}
        </button>
      </div>
    </Dialogo>
  );
}

type Busqueda = { tipo: "nada" } | { tipo: "buscando" } | { tipo: "listo"; proveedores: ProveedorEncontrado[] } | { tipo: "error"; mensaje: string };
type Guardando = { tipo: "nada" } | { tipo: "guardando" } | { tipo: "invalido"; mensaje: string } | { tipo: "error"; mensaje: string };

/** Desde 2 letras se busca, un rato después de dejar de escribir. */
const ESPERA_BUSQUEDA_MS = 250;

/**
 * Spec M3-09 §4: la tarjeta nueva de un pedido a mano. "Para": un proveedor
 * del directorio (completa sus mails, que se pueden editar) o mails escritos
 * a mano. El asunto y el texto vienen empezados de la plantilla (los arma el
 * servidor); la firma es la de siempre. Guardar lo hace el servidor (con la
 * sesión) y la base pone el nombre del proveedor.
 */
function NuevoPedidoAMano({
  reservaId,
  borrador,
  firmante,
  cc,
  onCancelar,
  onSinSesion,
  onGuardado,
}: {
  reservaId: string;
  borrador: BorradorAMano;
  firmante: string;
  cc: string[];
  onCancelar: () => void;
  onSinSesion: () => void;
  onGuardado: (p: PedidoGuardado) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [encontrados, setEncontrados] = useState<Busqueda>({ tipo: "nada" });
  const [proveedor, setProveedor] = useState<{ id: string; nombre: string } | null>(null);
  const [mails, setMails] = useState("");
  const [asunto, setAsunto] = useState(borrador.asunto);
  const [cuerpo, setCuerpo] = useState(borrador.cuerpo);
  const [guardando, setGuardando] = useState<Guardando>({ tipo: "nada" });
  const id = "pedido-a-mano";

  // Solo cuenta la respuesta de la última búsqueda (si se sigue escribiendo, las anteriores se ignoran).
  const turno = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
    },
    [],
  );

  function cortarBusqueda(): number {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
    return ++turno.current;
  }

  function buscar(texto: string) {
    const n = cortarBusqueda();
    const q = texto.trim();
    if (q.length < 2) return setEncontrados({ tipo: "nada" });
    setEncontrados({ tipo: "buscando" });
    espera.current = setTimeout(() => {
      buscarProveedoresDelDirectorio(q).then(
        (r) => {
          if (n !== turno.current) return;
          if (r.ok) setEncontrados({ tipo: "listo", proveedores: r.proveedores });
          else if (r.sinSesion) onSinSesion();
          else setEncontrados({ tipo: "error", mensaje: r.error });
        },
        () => n === turno.current && setEncontrados({ tipo: "error", mensaje: "No se pudo buscar en el directorio." }),
      );
    }, ESPERA_BUSQUEDA_MS);
  }

  function elegir(p: ProveedorEncontrado) {
    cortarBusqueda();
    setProveedor({ id: p.id, nombre: p.nombre });
    setBusqueda(p.nombre);
    setMails(p.mails.join(", "));
    setEncontrados({ tipo: "nada" });
  }

  async function guardar() {
    const entrada = { reservaId, proveedorId: proveedor?.id ?? null, mails, asunto, cuerpo };
    const v = validarPedidoAMano(entrada, borrador);
    if (!v.ok) {
      setGuardando({ tipo: "invalido", mensaje: v.error });
      return;
    }
    setGuardando({ tipo: "guardando" });
    const r = await agregarPedidoAManoDeLaReserva(entrada).catch(() => null);
    if (r?.ok) return onGuardado(r.pedido);
    if (r && r.sinSesion) return onSinSesion();
    const motivo = r?.error ?? "falló la conexión con el servidor.";
    setGuardando({ tipo: "error", mensaje: /^No se pud/.test(motivo) ? motivo : A.noSeGuardo(motivo) });
  }

  const ocupado = guardando.tipo === "guardando";

  return (
    <form
      className={estilos.tarjeta}
      aria-labelledby={`${id}-titulo`}
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <div className={estilos.cabecera}>
        <h2 id={`${id}-titulo`} className={estilos.proveedor}>
          {A.titulo}
        </h2>
        <span className={ui.chips}>
          <Chip tono="info">{A.etiqueta}</Chip>
        </span>
      </div>

      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>{A.buscar}</span>
        <input
          className={estilos.editor}
          value={busqueda}
          placeholder={A.buscarAyuda}
          disabled={ocupado}
          onChange={(e) => {
            setBusqueda(e.target.value);
            if (proveedor && e.target.value.trim() !== proveedor.nombre) setProveedor(null);
            buscar(e.target.value);
          }}
        />
      </label>
      {encontrados.tipo === "buscando" ? (
        <p className={ui.meta} role="status">
          {A.buscando}
        </p>
      ) : null}
      {encontrados.tipo === "error" ? <Aviso tono="error">{encontrados.mensaje}</Aviso> : null}
      {encontrados.tipo === "listo" && encontrados.proveedores.length === 0 ? <p className={ui.meta}>{A.sinCoincidencias}</p> : null}
      {encontrados.tipo === "listo" && encontrados.proveedores.length > 0 ? (
        <ul className={estilos.lista}>
          {encontrados.proveedores.map((p) => (
            <li key={p.id}>
              <button type="button" className={ui.enlace} onClick={() => elegir(p)}>
                {[p.nombre, p.ciudad, p.mails.join(", ") || TEXTOS.comunes.sinDato].filter(Boolean).join(" · ")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {proveedor ? <p className={ui.meta}>{A.elegido(proveedor.nombre)}</p> : null}

      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>{A.para}</span>
        <input className={estilos.editor} value={mails} placeholder={A.paraAyuda} disabled={ocupado} onChange={(e) => setMails(e.target.value)} />
      </label>
      <dl className={ui.datos}>
        <dt>{T.cc}</dt>
        <dd>{cc.join(", ")}</dd>
      </dl>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>{T.asunto}</span>
        <input className={estilos.editor} value={asunto} disabled={ocupado} onChange={(e) => setAsunto(e.target.value)} />
      </label>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>{T.texto}</span>
        <textarea className={estilos.editor} value={cuerpo} rows={14} disabled={ocupado} onChange={(e) => setCuerpo(e.target.value)} />
      </label>
      <div className={estilos.campo}>
        <span className={estilos.etiqueta}>{T.firma}</span>
        <p className={estilos.firma}>{firmaConNombre(borrador.firma, firmante)}</p>
      </div>

      {guardando.tipo === "invalido" ? <Aviso tono="error">{guardando.mensaje}</Aviso> : null}
      {guardando.tipo === "error" ? (
        <div role="alert" className={`${ui.aviso} ${ui.aviso_error}`}>
          <span>{guardando.mensaje}</span>{" "}
          <button type="button" className={ui.botonSecundario} onClick={() => void guardar()}>
            {A.reintentar}
          </button>
        </div>
      ) : null}
      <div className={ui.acciones}>
        <button type="submit" className={ui.botonPrimario} disabled={ocupado}>
          {ocupado ? A.guardando : A.guardar}
        </button>
        <button type="button" className={ui.botonSecundario} onClick={onCancelar} disabled={ocupado}>
          {A.cancelar}
        </button>
      </div>
    </form>
  );
}

type Sacando = { tipo: "nada" } | { tipo: "sacando" } | { tipo: "error"; mensaje: string };

/** Spec M3-09 fila 8: "Sacar este pedido" pide confirmación; la base no deja sacar uno enviado. */
function DialogoSacar({
  pedido,
  onCerrar,
  onSinSesion,
  onSacado,
}: {
  pedido: PedidoGuardado;
  onCerrar: () => void;
  onSinSesion: () => void;
  onSacado: (id: string) => void;
}) {
  const [estado, setEstado] = useState<Sacando>({ tipo: "nada" });

  async function sacar() {
    setEstado({ tipo: "sacando" });
    const r = await sacarPedidoAManoDeLaReserva(pedido.id).catch(() => null);
    if (r?.ok) return onSacado(pedido.id);
    if (r && r.sinSesion) return onSinSesion();
    setEstado({ tipo: "error", mensaje: r?.error ?? A.noSeSaco("falló la conexión con el servidor.") });
  }

  return (
    <Dialogo titulo={A.sacarTitulo} onCerrar={estado.tipo === "sacando" ? () => undefined : onCerrar}>
      <p>{A.sacarPregunta(nombreDelPedido(pedido))}</p>
      {estado.tipo === "error" ? <Aviso tono="error">{estado.mensaje}</Aviso> : null}
      <div className={ui.acciones}>
        <button type="button" className={ui.botonPrimario} onClick={sacar} disabled={estado.tipo === "sacando"}>
          {estado.tipo === "sacando" ? A.sacando : A.sacarConfirmar}
        </button>
        <button type="button" className={ui.botonSecundario} onClick={onCerrar} disabled={estado.tipo === "sacando"}>
          {A.cancelar}
        </button>
      </div>
    </Dialogo>
  );
}
