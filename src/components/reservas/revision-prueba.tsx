"use client";

import { useState } from "react";
import { marcarReservaDePrueba } from "@/app/(app)/reservas/[id]/acciones";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import { formatearFechaHora } from "@/lib/formato";
import { cargarRevision } from "@/lib/reservas/consultas";
import { QUE_MAL, type QueMal } from "@/lib/reservas/medicion-prueba";
import type { RevisionDePrueba } from "@/lib/reservas/tipos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Aviso } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import estilos from "./reservas.module.css";

const T = TEXTOS.reserva.revision;

function textoMarca(m: RevisionDePrueba): string {
  const quien = m.autor ?? "alguien del equipo";
  const cuando = formatearFechaHora(m.fecha) || m.fecha;
  if (m.resultado === "bien") return T.marcadaBien(quien, cuando);
  const que = m.queMal.map((q) => (T.opciones[q as QueMal] ?? q).toLowerCase()).join(", ");
  return T.marcadaMal(quien, cuando, que);
}

/**
 * La marca del owner sobre una reserva de prueba (spec M2-06 fila 13): "Está
 * bien" o "Hay que corregir" con qué y una nota. Solo se muestra en las
 * reservas de prueba (lo decide el detalle). Si no se pudo guardar, avisa y
 * la marca anterior queda como estaba.
 */
export function RevisionPrueba({ reservaId }: { reservaId: string }) {
  const { estado } = useConsulta(() => cargarRevision(createSupabaseBrowserClient(), reservaId));
  const [guardada, setGuardada] = useState<RevisionDePrueba | null | undefined>(undefined);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [que, setQue] = useState<QueMal[]>([]);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const actual = guardada !== undefined ? guardada : estado.tipo === "listo" ? estado.datos : null;

  async function guardar(resultado: "bien" | "mal") {
    if (resultado === "mal" && que.length === 0) {
      setAviso(T.faltaQue);
      return;
    }
    setGuardando(true);
    setAviso(null);
    const r = await marcarReservaDePrueba({
      reservaId,
      resultado,
      queMal: resultado === "mal" ? QUE_MAL.filter((q) => que.includes(q)) : [],
      nota: resultado === "mal" && nota.trim() ? nota.trim() : null,
    }).catch(() => ({ ok: false as const, error: "red" }));
    setGuardando(false);
    if (!r.ok) {
      setAviso(T.error);
      return;
    }
    setGuardada(r.revision);
    setCorrigiendo(false);
  }

  return (
    <section className={ui.seccion} data-testid="revision-prueba">
      <h2 className={ui.subtitulo}>{T.titulo}</h2>
      <p className={ui.meta}>{T.ayuda}</p>
      {estado.tipo === "error" ? <Aviso tono="error">{T.errorCarga}</Aviso> : null}
      {estado.tipo === "listo" || guardada !== undefined ? (
        <p className={ui.migas} data-testid="marca-actual">
          {actual ? textoMarca(actual) : T.sinMarca}
        </p>
      ) : null}
      {aviso ? <Aviso tono="error">{aviso}</Aviso> : null}

      {!corrigiendo ? (
        <div className={estilos.botonesRevision}>
          <button type="button" className={ui.botonPrimario} disabled={guardando} onClick={() => guardar("bien")}>
            {T.bien}
          </button>
          <button
            type="button"
            className={ui.botonSecundario}
            disabled={guardando}
            onClick={() => {
              setCorrigiendo(true);
              setAviso(null);
              setQue(actual?.resultado === "mal" ? (actual.queMal.filter((q) => (QUE_MAL as readonly string[]).includes(q)) as QueMal[]) : []);
              setNota(actual?.resultado === "mal" ? (actual.nota ?? "") : "");
            }}
          >
            {T.corregir}
          </button>
        </div>
      ) : (
        <fieldset className={estilos.formRevision} aria-label={T.queMal} role="group">
          <legend className={ui.meta}>{T.queMal}</legend>
          <div className={estilos.opcionesRevision}>
            {QUE_MAL.map((q) => (
              <label key={q} className={estilos.opcionRevision}>
                <input
                  type="checkbox"
                  checked={que.includes(q)}
                  onChange={(e) => setQue((antes) => (e.target.checked ? [...antes, q] : antes.filter((x) => x !== q)))}
                />{" "}
                {T.opciones[q]}
              </label>
            ))}
          </div>
          <label className={estilos.notaRevision}>
            <span className={ui.meta}>{T.nota}</span>
            <textarea value={nota} rows={3} maxLength={2000} onChange={(e) => setNota(e.target.value)} />
          </label>
          <div className={estilos.botonesRevision}>
            <button type="button" className={ui.botonPrimario} disabled={guardando} onClick={() => guardar("mal")}>
              {guardando ? T.guardando : T.guardar}
            </button>
            <button type="button" className={ui.botonSecundario} disabled={guardando} onClick={() => setCorrigiendo(false)}>
              {T.cancelar}
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
