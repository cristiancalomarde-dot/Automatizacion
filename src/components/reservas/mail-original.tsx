"use client";

import { useState } from "react";
import { formatearFechaHora } from "@/lib/formato";
import { urlDelPdf } from "@/lib/reservas/consultas";
import type { MailDeReserva, PdfDelMail } from "@/lib/reservas/tipos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Aviso } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import estilos from "./reservas.module.css";

const T = TEXTOS.reserva.mail;
const SIN_DATO = TEXTOS.comunes.sinDato;

/**
 * El mail tal como llegó, al lado de la reserva (spec M2-05 #11 a #13). Con
 * varios mails, la lista por orden de llegada: el primero abierto, el resto
 * con "Ver mail". El cuerpo se muestra siempre como texto (nunca como
 * página): sin imágenes remotas, sin scripts y sin enlaces clicables.
 */
export function MailOriginal({ mails }: { mails: MailDeReserva[] }) {
  const [abierto, setAbierto] = useState(0);
  const mail = mails[abierto];

  return (
    <section className={estilos.panelMail} data-testid="mail-original" aria-label={T.titulo}>
      <h2 className={ui.subtitulo}>{mails.length > 1 ? T.titulos(mails.length) : T.titulo}</h2>

      {mails.length > 1 ? (
        <ol className={estilos.listaMails}>
          {mails.map((m, i) => (
            <li key={m.id} className={`${estilos.itemMail} ${i === abierto ? estilos.itemMailAbierto : ""}`}>
              <div>
                <div>{m.asunto ?? SIN_DATO}</div>
                <div className={ui.meta}>
                  {i === 0 ? `${T.creo} · ` : ""}
                  {m.fecha ? formatearFechaHora(m.fecha) : SIN_DATO}
                </div>
              </div>
              {i === abierto ? null : (
                <button type="button" className={ui.botonSecundario} onClick={() => setAbierto(i)}>
                  {T.verMail}
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : null}

      {mail ? <UnMail mail={mail} primero={abierto === 0 && mails.length > 1} /> : null}
    </section>
  );
}

function UnMail({ mail, primero }: { mail: MailDeReserva; primero: boolean }) {
  const remitente = mail.remitenteNombre ? `${mail.remitenteNombre} <${mail.remitente}>` : mail.remitente;
  return (
    <>
      {primero ? <p className={ui.meta}>{T.creo}</p> : null}
      <dl className={ui.datos}>
        <dt>{T.de}</dt>
        <dd>{remitente}</dd>
        <dt>{T.asunto}</dt>
        <dd>{mail.asunto ?? SIN_DATO}</dd>
        <dt>{T.llego}</dt>
        <dd>{mail.fecha ? formatearFechaHora(mail.fecha) : SIN_DATO}</dd>
      </dl>
      {mail.spam ? <Aviso tono="info">{T.spam}</Aviso> : null}
      {mail.pdfs.map((pdf) => (
        <BotonPdf key={pdf.ruta} pdf={pdf} />
      ))}
      <pre className={estilos.cuerpo} data-testid="cuerpo-mail">
        {mail.cuerpo || T.sinCuerpo}
      </pre>
    </>
  );
}

/**
 * Abre el PDF en otra pestaña con un enlace firmado que caduca (#2). La
 * pestaña se abre al tocar (si se abriera después de esperar el enlace, el
 * navegador la bloquearía) y recibe el enlace cuando está listo.
 */
function BotonPdf({ pdf }: { pdf: PdfDelMail }) {
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState(false);

  async function abrir() {
    setPreparando(true);
    setError(false);
    const ventana = window.open("", "_blank");
    if (ventana) ventana.opener = null;
    try {
      const url = await urlDelPdf(createSupabaseBrowserClient(), pdf.ruta);
      if (ventana) ventana.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      ventana?.close();
      setError(true);
    } finally {
      setPreparando(false);
    }
  }

  return (
    <div className={estilos.pdf}>
      <button type="button" className={ui.botonSecundario} onClick={abrir} disabled={preparando}>
        {T.abrirPdf}
      </button>
      <span className={ui.meta}>{pdf.nombre}</span>
      {error ? <Aviso tono="error">{T.errorPdf}</Aviso> : null}
    </div>
  );
}
