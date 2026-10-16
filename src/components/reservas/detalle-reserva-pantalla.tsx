"use client";

import Link from "next/link";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { formatearFecha, formatearFechaHora, formatearHora, formatearRango } from "@/lib/formato";
import { cargarReserva } from "@/lib/reservas/consultas";
import { esIdDeReserva, frasesDeMotivos } from "@/lib/reservas/reglas";
import type { DetalleReserva, ParteDeReserva, VueloDeReserva } from "@/lib/reservas/tipos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Aviso, Chip, EsqueletoDetalle, EstadoError, EstadoVacio } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import { ChipEstado, MarcasReserva } from "./marcas";
import { MailOriginal } from "./mail-original";
import { RevisionPrueba } from "./revision-prueba";
import estilos from "./reservas.module.css";

const T = TEXTOS.reserva;
const SIN_DATO = TEXTOS.comunes.sinDato;
const VOLVER = { href: "/reservas", texto: T.volver };

/** Detalle de una reserva (spec M2-05 #5 a #13, #17). Solo para mirar. */
export function DetalleReservaPantalla({ id }: { id: string }) {
  // Un id sin formato válido es un enlace mal copiado: no existe, y no se le pregunta a la base.
  const { estado, reintentar } = useConsulta(() =>
    esIdDeReserva(id) ? cargarReserva(createSupabaseBrowserClient(), id) : Promise.resolve(null),
  );

  return (
    <div className={ui.pagina}>
      <nav className={ui.migas} aria-label="Ubicación">
        <Link href="/reservas" className={ui.enlace}>
          {T.volver}
        </Link>
      </nav>
      {estado.tipo === "cargando" ? (
        <div className={estilos.columnas}>
          <EsqueletoDetalle etiqueta={T.cargando} />
          <EsqueletoDetalle etiqueta={TEXTOS.reserva.mail.titulo} />
        </div>
      ) : null}
      {estado.tipo === "error" ? <EstadoError mensaje={T.error} onReintentar={reintentar} volver={VOLVER} /> : null}
      {estado.tipo === "listo" && estado.datos === null ? <NoExiste /> : null}
      {estado.tipo === "listo" && estado.datos ? <Detalle reserva={estado.datos} /> : null}
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

function Detalle({ reserva }: { reserva: DetalleReserva }) {
  const frases = reserva.estado === "para_revision" || reserva.posibleDuplicada ? frasesDeMotivos(reserva.motivos) : [];

  return (
    <>
      {reserva.dePrueba ? <Aviso tono="info">{T.avisoPrueba}</Aviso> : null}
      {reserva.sinDatoLlegada ? <Aviso tono="aviso">{T.avisoLlegada}</Aviso> : null}
      {reserva.avisosVuelo.length > 0 ? (
        <Aviso tono="aviso">
          <div data-testid="avisos-vuelo">
            <p className={estilos.avisoTitulo}>{T.avisoVuelo}</p>
            <ul className={estilos.motivos}>
              {reserva.avisosVuelo.map((a) => (
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
              sinDatoLlegada={reserva.sinDatoLlegada}
              avisosVuelo={reserva.avisosVuelo}
              cancelacion={reserva.cancelacion}
            />
          </span>
          <h1 className={ui.titulo} title={T.numero}>
            {reserva.cancelacion ? <span className={estilos.cancelacionTitulo}>{TEXTOS.reservas.cancelacion}</span> : null}
            <span className={estilos.numeroTitulo}>{reserva.numero ?? SIN_DATO}</span>
          </h1>
        </div>
        <dl className={ui.datos}>
          <dt>{T.agencia}</dt>
          <dd>{reserva.agencia}</dd>
          <dt>{T.llego}</dt>
          <dd>{formatearFechaHora(reserva.llego) || SIN_DATO}</dd>
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

      {reserva.dePrueba ? <RevisionPrueba reservaId={reserva.id} /> : null}

      <div className={estilos.columnas}>
        <div className={estilos.columna}>
          <Producto reserva={reserva} />
          {reserva.partes.length > 0 ? <Partes partes={reserva.partes} /> : null}
          <Datos reserva={reserva} />
          <Vuelos vuelos={reserva.vuelos} />
        </div>
        <div className={estilos.columna}>
          <MailOriginal mails={reserva.mails} />
        </div>
      </div>
    </>
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
        </p>
      ) : (
        <div>
          <p className={ui.migas}>{T.sinProducto}</p>
          {reserva.productoTextoAgencia ? <p className={ui.meta}>{T.enElMail(reserva.productoTextoAgencia)}</p> : null}
        </div>
      )}
    </section>
  );
}

function fechasDeParte(p: ParteDeReserva): string {
  if (p.fechaInicio && p.fechaFin) return formatearRango(p.fechaInicio, p.fechaFin);
  return formatearFecha(p.fechaInicio ?? p.fechaFin);
}

/** Las partes de un tour compuesto, en el orden del tour (#8). */
function Partes({ partes }: { partes: ParteDeReserva[] }) {
  return (
    <section className={ui.seccion}>
      <h2 className={ui.subtitulo}>{T.componentes}</h2>
      <div className={ui.panel}>
        <table className={ui.tabla} aria-label={T.componentes}>
          <thead>
            <tr>
              <th scope="col">{TEXTOS.reservas.columnas.fechas}</th>
              <th scope="col">{T.producto}</th>
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
      </dl>
    </section>
  );
}

function tramo(lugar: string | null, fecha: string | null, hora: string | null): string {
  const cuando = [fecha ? formatearFecha(fecha) : null, hora ? formatearHora(hora) : null].filter(Boolean).join(" ");
  return [lugar, cuando].filter(Boolean).join(" · ") || SIN_DATO;
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
