"use client";

import Link from "next/link";
import { useState } from "react";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { formatearFecha, formatearFechaHora, formatearHora, formatearRango } from "@/lib/formato";
import { avisosDeLlegada } from "@/lib/reservas/avisos-vuelo";
import { cargarReserva } from "@/lib/reservas/consultas";
import { esIdDeReserva, frasesDeMotivos } from "@/lib/reservas/reglas";
import type { DetalleReserva, EnvioDeReserva, HotelDeLaAgencia, ParteDeReserva, PedidoDeReservaVista, VueloDeReserva } from "@/lib/reservas/tipos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Aviso, Chip, EsqueletoDetalle, EstadoError, EstadoVacio } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import { ConfirmarProducto, puedeConfirmarProducto } from "./confirmar-producto";
import { ChipEstado, MarcasReserva } from "./marcas";
import { MailOriginal } from "./mail-original";
import { RevisionPrueba } from "./revision-prueba";
import estilos from "./reservas.module.css";

const T = TEXTOS.reserva;
const J = TEXTOS.reserva.journaway;
const SIN_DATO = TEXTOS.comunes.sinDato;
const VOLVER = { href: "/reservas", texto: T.volver };

/** Detalle de una reserva (spec M2-05 #5 a #13, #17). Solo para mirar. */
export function DetalleReservaPantalla({ id }: { id: string }) {
  // Un id sin formato válido es un enlace mal copiado: no existe, y no se le pregunta a la base.
  const { estado, reintentar } = useConsulta(() =>
    esIdDeReserva(id) ? cargarReserva(createSupabaseBrowserClient(), id) : Promise.resolve(null),
  );
  // Spec M3-05 fila 9: después de confirmar el producto, el "Listo" queda arriba y la reserva se vuelve a leer.
  const [listo, setListo] = useState<string | null>(null);
  const confirmado = (mensaje: string) => {
    setListo(mensaje);
    reintentar();
  };

  return (
    <div className={ui.pagina}>
      <nav className={ui.migas} aria-label="Ubicación">
        <Link href="/reservas" className={ui.enlace}>
          {T.volver}
        </Link>
      </nav>
      {listo ? (
        <Aviso tono="info">
          <span data-testid="producto-confirmado">{listo}</span>
        </Aviso>
      ) : null}
      {estado.tipo === "cargando" ? (
        <div className={estilos.columnas}>
          <EsqueletoDetalle etiqueta={T.cargando} />
          <EsqueletoDetalle etiqueta={TEXTOS.reserva.mail.titulo} />
        </div>
      ) : null}
      {estado.tipo === "error" ? <EstadoError mensaje={T.error} onReintentar={reintentar} volver={VOLVER} /> : null}
      {estado.tipo === "listo" && estado.datos === null ? <NoExiste /> : null}
      {estado.tipo === "listo" && estado.datos ? <Detalle reserva={estado.datos} onConfirmado={confirmado} /> : null}
    </div>
  );
}

function NoExiste() {
  return (
    <div>
      <EstadoVacio mensaje={T.noExiste} />
      <p className={ui.migas}>
        <Link href="/reservas" className={ui.enlace}>
          {T.volver}
        </Link>
      </p>
    </div>
  );
}

/** Spec M2-09 #12: sin número, la referencia visible es el pasajero principal + la fecha del primer servicio. */
function tituloDe(reserva: DetalleReserva): string {
  if (reserva.numero) return reserva.numero;
  if (reserva.agencia !== "Journaway") return SIN_DATO;
  return J.referencia(reserva.pasajeros[0] ?? null, reserva.fechaInicio ? formatearFecha(reserva.fechaInicio) : "") || SIN_DATO;
}

function Detalle({ reserva, onConfirmado }: { reserva: DetalleReserva; onConfirmado: (mensaje: string) => void }) {
  const frases = reserva.estado === "para_revision" || reserva.posibleDuplicada ? frasesDeMotivos(reserva.motivos) : [];
  const avisosLlegada = avisosDeLlegada(reserva);
  const notas = reserva.notas ?? [];

  return (
    <>
      {reserva.dePrueba ? <Aviso tono="info">{T.avisoPrueba}</Aviso> : null}
      {avisosLlegada.length > 0 ? (
        <Aviso tono="aviso">
          <div data-testid="avisos-vuelo">
            <p className={estilos.avisoTitulo}>{T.avisoVuelo}</p>
            <ul className={estilos.motivos}>
              {avisosLlegada.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </Aviso>
      ) : null}

      <header className={ui.seccion} data-testid="encabezado-reserva">
        <div className={ui.encabezado}>
          <span className={`${ui.chips} ${estilos.chipGrande}`}>
            <ChipEstado estado={reserva.estado} />
            <MarcasReserva
              posibleDuplicada={reserva.posibleDuplicada}
              dePrueba={reserva.dePrueba}
              avisosLlegada={avisosLlegada}
              cancelacion={reserva.cancelacion}
              pedidoIncompleto={reserva.pedidoIncompleto}
            />
          </span>
          <h1 className={ui.titulo} title={T.numero}>
            {reserva.cancelacion ? <span className={estilos.cancelacionTitulo}>{TEXTOS.reservas.cancelacion}</span> : null}
            <span className={estilos.numeroTitulo}>{tituloDe(reserva)}</span>
          </h1>
        </div>
        <dl className={ui.datos}>
          <dt>{T.agencia}</dt>
          <dd>{reserva.agencia}</dd>
          <dt>{T.llego}</dt>
          <dd>{formatearFechaHora(reserva.llego) || SIN_DATO}</dd>
          {reserva.agencia === "Journaway" ? (
            <>
              <dt>{J.numeroViaje}</dt>
              <dd>{reserva.tripNumber ?? J.sinNumeroViaje}</dd>
            </>
          ) : null}
        </dl>
      </header>

      {frases.length > 0 ? (
        <Aviso tono="aviso">
          <ul className={estilos.motivos} data-testid="motivos-revision">
            {frases.map((f) => (
              <li key={`${f.frase}|${f.detalle ?? ""}`}>
                <span>{f.frase}</span>
                {f.detalle ? (
                  <>
                    {" "}
                    <span className={estilos.detalleMotivo}>{f.detalle}</span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {reserva.posibleDuplicada && reserva.duplicadaDeId ? (
            <p className={ui.migas}>
              <Link href={`/reservas/${reserva.duplicadaDeId}`} className={ui.enlace}>
                {T.verParecida}
              </Link>
            </p>
          ) : null}
        </Aviso>
      ) : null}

      {puedeConfirmarProducto(reserva) ? <ConfirmarProducto reserva={reserva} onConfirmado={onConfirmado} /> : null}
      <ArmarPedidos reserva={reserva} />
      <PedidosDeLaReserva reserva={reserva} />

      {notas.length > 0 ? (
        <Aviso tono="info">
          <div data-testid="notas-reserva">
            <p className={estilos.avisoTitulo}>{J.notas}</p>
            <ul className={estilos.motivos}>
              {notas.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </Aviso>
      ) : null}

      {reserva.dePrueba ? <RevisionPrueba reservaId={reserva.id} /> : null}

      <div className={estilos.columnas}>
        <div className={estilos.columna}>
          <Producto reserva={reserva} />
          {reserva.partes.length > 0 ? <Partes partes={reserva.partes} /> : null}
          <Datos reserva={reserva} />
          <Vuelos vuelos={reserva.vuelos} />
          {reserva.hotelesAgencia?.length ? <HotelesDeLaAgencia hoteles={reserva.hotelesAgencia} /> : null}
        </div>
        <div className={estilos.columna}>
          <MailOriginal mails={reserva.mails} />
        </div>
      </div>
    </>
  );
}

/** Spec M3-02 fila 1: a los pedidos a proveedores, solo con la reserva recibida (M3-03: o ya pedida, para ver y completar). */
function ArmarPedidos({ reserva }: { reserva: DetalleReserva }) {
  if (reserva.estado === "pedido_a_proveedor") {
    return (
      <div className={ui.acciones}>
        <Link href={`/reservas/${reserva.id}/pedidos`} className={`${ui.botonSecundario} ${estilos.botonEnlace}`}>
          {T.verPedidos}
        </Link>
      </div>
    );
  }
  if (reserva.estado === "recibida") {
    return (
      <div className={ui.acciones}>
        <Link href={`/reservas/${reserva.id}/pedidos`} className={`${ui.botonPrimario} ${estilos.botonEnlace}`}>
          {T.armarPedidos}
        </Link>
      </div>
    );
  }
  if (reserva.estado !== "para_revision") return null;
  return (
    <div className={ui.acciones}>
      <button type="button" className={ui.botonPrimario} disabled aria-describedby="armar-pedidos-ayuda">
        {T.armarPedidos}
      </button>
      <span id="armar-pedidos-ayuda" className={ui.ayuda}>
        {T.resolverPrimero}
      </span>
    </div>
  );
}

function estadoDelPedido(p: PedidoDeReservaVista): string {
  const E = T.pedidoEstado;
  if (p.estado === "enviado") return E.enviado(formatearFechaHora(p.enviadoEn ?? "") || SIN_DATO, p.enviadoPor ?? SIN_DATO);
  if (p.estado === "fallo") return E.fallo(p.motivoFallo ?? SIN_DATO);
  if (p.estado === "enviando") return E.enviando;
  return p.destinatarios.length === 0 ? E.sinMail : E.sinEnviar;
}

function lineaDeEnvio(e: EnvioDeReserva): string {
  const proveedores = e.proveedores.join(", ") || SIN_DATO;
  return e.tipo === "envio_de_prueba"
    ? T.envioDePrueba(e.persona || SIN_DATO, e.cantidad, proveedores, e.destino ?? SIN_DATO)
    : T.envioRegistrado(e.persona || SIN_DATO, e.cantidad, proveedores);
}

/** Spec M3-03 fila 9: a qué proveedores se les escribió, cuándo y quién (y el historial de envíos). */
function PedidosDeLaReserva({ reserva }: { reserva: DetalleReserva }) {
  const pedidos = reserva.pedidos ?? [];
  const envios = reserva.envios ?? [];
  if (pedidos.length === 0 && envios.length === 0) return null;
  return (
    <section className={ui.seccion} data-testid="pedidos-reserva">
      <h2 className={ui.subtitulo}>{T.pedidosTitulo}</h2>
      {pedidos.length > 0 ? (
        <div className={ui.panel}>
          <table className={ui.tabla} aria-label={T.pedidosTitulo}>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className={p.estado === "enviado" ? undefined : ui.filaAtencion}>
                  <td>{p.proveedores.join(" y ") || SIN_DATO}</td>
                  <td>{p.destinatarios.join(", ") || SIN_DATO}</td>
                  <td>{estadoDelPedido(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {envios.length > 0 ? (
        <div>
          <p className={estilos.avisoTitulo}>{T.historialEnvios}</p>
          <ul className={estilos.motivos} data-testid="historial-envios">
            {envios.map((e) => (
              <li key={`${e.fecha}-${e.tipo}`}>
                <span className={ui.meta}>{formatearFechaHora(e.fecha)}</span> {lineaDeEnvio(e)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Producto({ reserva }: { reserva: DetalleReserva }) {
  return (
    <section className={ui.seccion} data-testid="producto-reserva">
      <h2 className={ui.subtitulo}>{T.producto}</h2>
      {reserva.producto ? (
        <p className={ui.migas}>
          <Link href={`/catalogo/${reserva.producto.id}`} className={`${ui.enlace} ${ui.mono}`}>
            {reserva.producto.codigo}
          </Link>{" "}
          <span>{reserva.producto.nombre}</span>
          {/* Owner 2026-10-17: un pedido de Journaway es una reserva aunque traiga varios productos. */}
          {(reserva.otrosProductos ?? []).map((p) => (
            <span key={p.id}>
              {" + "}
              <Link href={`/catalogo/${p.id}`} className={`${ui.enlace} ${ui.mono}`}>
                {p.codigo}
              </Link>{" "}
              <span>{p.nombre}</span>
            </span>
          ))}
        </p>
      ) : (
        <div>
          <p className={ui.migas}>{T.sinProducto}</p>
          {reserva.productoTextoAgencia ? <p className={ui.meta}>{T.enElMail(reserva.productoTextoAgencia)}</p> : null}
        </div>
      )}
      {/* Spec M3-05 fila 7: quién confirmó o eligió el producto. */}
      {reserva.confirmacionesProducto?.length ? (
        <ul className={estilos.historialProducto} data-testid="historial-producto">
          {reserva.confirmacionesProducto.map((c) => (
            <li key={c.fecha + c.codigo}>
              <span className={ui.meta}>{formatearFechaHora(c.fecha)}</span>{" "}
              <span>
                {c.sugerida
                  ? TEXTOS.reserva.confirmarProducto.historialSugerido(c.persona || SIN_DATO, c.codigo)
                  : TEXTOS.reserva.confirmarProducto.historialElegido(c.persona || SIN_DATO, c.codigo)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function fechasDeParte(p: ParteDeReserva): string {
  if (p.fechaInicio && p.fechaFin) return formatearRango(p.fechaInicio, p.fechaFin);
  return formatearFecha(p.fechaInicio ?? p.fechaFin);
}

/** Las partes de un tour compuesto, en el orden del tour (#8). Journaway suma el pick up de cada tour (M2-09 #11). */
function Partes({ partes }: { partes: ParteDeReserva[] }) {
  const conPickUp = partes.some((p) => p.pickUp);
  return (
    <section className={ui.seccion}>
      <h2 className={ui.subtitulo}>{T.componentes}</h2>
      <div className={ui.panel}>
        <table className={ui.tabla} aria-label={T.componentes}>
          <thead>
            <tr>
              <th scope="col">{TEXTOS.reservas.columnas.fechas}</th>
              <th scope="col">{T.producto}</th>
              {conPickUp ? <th scope="col">{J.pickUp}</th> : null}
            </tr>
          </thead>
          <tbody>
            {partes.map((p) => (
              <tr key={p.orden} className={p.tipo === "tramo_bus" || p.esTarea ? ui.filaAtencion : undefined}>
                <td className={ui.nowrap}>{fechasDeParte(p)}</td>
                <td>
                  {p.producto ? (
                    <>
                      <Link href={`/catalogo/${p.producto.id}`} className={`${ui.enlace} ${ui.mono}`}>
                        {p.producto.codigo}
                      </Link>{" "}
                      {p.producto.nombre}
                      {p.textoAgencia || p.descripcion ? (
                        <span className={ui.meta}>
                          {" "}
                          {p.descripcion ?? T.enElMail(p.textoAgencia!)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {p.descripcion ?? SIN_DATO}
                      {p.tipo === "tramo_bus" || p.esTarea ? (
                        <>
                          {" "}
                          <Chip tono="aviso">{T.tramoExterno}</Chip>
                        </>
                      ) : null}
                    </>
                  )}
                </td>
                {conPickUp ? <td>{p.pickUp ?? SIN_DATO}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Datos({ reserva }: { reserva: DetalleReserva }) {
  return (
    <section className={ui.seccion}>
      <h2 className={ui.subtitulo}>{T.datos}</h2>
      <dl className={ui.datos} data-testid="datos-reserva">
        <dt>{T.fechaEntrada}</dt>
        <dd>{formatearFecha(reserva.fechaInicio)}</dd>
        <dt>{T.fechaSalida}</dt>
        <dd>{formatearFecha(reserva.fechaFin)}</dd>
        <dt>{T.pax}</dt>
        <dd>{reserva.pax ?? SIN_DATO}</dd>
        <dt>{T.pasajeros}</dt>
        <dd>
          {reserva.pasajeros.length === 0
            ? SIN_DATO
            : reserva.pasajeros.map((p, i) => (
                <span key={`${i}-${p}`}>
                  {i > 0 ? ", " : ""}
                  <span>{p}</span>
                </span>
              ))}
        </dd>
        <dt>{T.habitacion}</dt>
        <dd>{reserva.habitacion ?? SIN_DATO}</dd>
        <dt>{T.pedidos}</dt>
        <dd className={ui.preformateado}>{reserva.pedidosEspeciales ?? SIN_DATO}</dd>
        {reserva.contactoCliente ? (
          <>
            <dt>{J.contacto}</dt>
            <dd>
              {[reserva.contactoCliente.nombre, reserva.contactoCliente.email, reserva.contactoCliente.telefono].filter(Boolean).join(" · ")}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function tramo(lugar: string | null, fecha: string | null, hora: string | null): string {
  const cuando = [fecha ? formatearFecha(fecha) : null, hora ? formatearHora(hora) : null].filter(Boolean).join(" ");
  return [lugar, cuando].filter(Boolean).join(" · ") || SIN_DATO;
}

/** Spec M2-09 #10: lo que reserva Journaway ("booked by us"). Solo información: no se pide. */
function HotelesDeLaAgencia({ hoteles }: { hoteles: HotelDeLaAgencia[] }) {
  return (
    <section className={ui.seccion} data-testid="hoteles-agencia">
      <h2 className={ui.subtitulo}>{J.hoteles}</h2>
      <div className={ui.panel}>
        <table className={ui.tabla} aria-label={J.hoteles}>
          <thead>
            <tr>
              <th scope="col">{J.hotel}</th>
              <th scope="col">{J.fechasHotel}</th>
            </tr>
          </thead>
          <tbody>
            {hoteles.map((h, i) => (
              <tr key={`${i}-${h.nombre}`}>
                <td>{h.nombre}</td>
                <td className={ui.nowrap}>{h.desde || h.hasta ? formatearRango(h.desde, h.hasta) : SIN_DATO}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Los vuelos, con la fecha y la hora del aeropuerto tal como las dice el mail (#10). */
function Vuelos({ vuelos }: { vuelos: VueloDeReserva[] }) {
  const C = T.columnasVuelo;
  return (
    <section className={ui.seccion}>
      <h2 className={ui.subtitulo}>{T.vuelos}</h2>
      {vuelos.length === 0 ? (
        <p className={ui.meta}>{T.sinVuelos}</p>
      ) : (
        <div className={ui.panel}>
          <table className={ui.tabla} aria-label={T.vuelos}>
            <thead>
              <tr>
                <th scope="col">{C.vuelo}</th>
                <th scope="col">{C.aerolinea}</th>
                <th scope="col">{C.sale}</th>
                <th scope="col">{C.llega}</th>
              </tr>
            </thead>
            <tbody>
              {vuelos.map((v, i) => (
                <tr key={`${i}-${v.numero ?? ""}`}>
                  <td className={ui.mono}>{v.numero ?? SIN_DATO}</td>
                  <td>{v.aerolinea ?? SIN_DATO}</td>
                  <td className={ui.nowrap}>{tramo(v.origen, v.fechaSalida, v.horaSalida)}</td>
                  <td className={ui.nowrap}>{tramo(v.destino, v.fechaLlegada, v.horaLlegada)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
