import Link from "next/link";
import type { ReactNode } from "react";
import { TEXTOS } from "@/lib/textos";
import styles from "./ui.module.css";

/**
 * Los tres estados de cada pantalla (user-flow.md §7, marca.md §6): esqueleto
 * en vez de spinner, error con qué hacer, vacío con el próximo paso.
 */

export function EsqueletoTabla({
  etiqueta,
  filas = 8,
  columnas = 5,
}: {
  etiqueta: string;
  filas?: number;
  columnas?: number;
}) {
  return (
    <div className={styles.esqueleto} role="status" aria-label={etiqueta} aria-busy="true">
      {Array.from({ length: filas }, (_, f) => (
        <div key={f} className={styles.esqueletoFila}>
          {Array.from({ length: columnas }, (_, c) => (
            <span key={c} className={styles.esqueletoCelda} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EsqueletoDetalle({ etiqueta }: { etiqueta: string }) {
  return (
    <div className={styles.esqueleto} role="status" aria-label={etiqueta} aria-busy="true">
      <span className={styles.esqueletoTitulo} />
      <div className={styles.esqueletoZona} />
      <div className={styles.esqueletoZona} />
    </div>
  );
}

export function EstadoError({
  mensaje,
  onReintentar,
  volver,
}: {
  mensaje: string;
  onReintentar: () => void;
  volver?: { href: string; texto: string };
}) {
  return (
    <div className={styles.estadoError} role="alert">
      <p className={styles.estadoTexto}>{mensaje}</p>
      <div className={styles.acciones}>
        <button type="button" className={styles.botonSecundario} onClick={onReintentar}>
          {TEXTOS.comunes.reintentar}
        </button>
        {volver ? (
          <Link href={volver.href} className={styles.enlace}>
            {volver.texto}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function EstadoVacio({
  mensaje,
  accion,
  ayuda,
}: {
  mensaje: string;
  accion?: string;
  ayuda?: string;
}) {
  return (
    <div className={styles.estadoVacio}>
      <p className={styles.estadoTexto}>{mensaje}</p>
      {accion ? (
        <div className={styles.acciones}>
          {/* Solo lectura (DECISIONS 2026-10-06): la carga la hace el importador. */}
          <button type="button" className={styles.botonPrimario} disabled aria-describedby="ayuda-vacio">
            {accion}
          </button>
          {ayuda ? (
            <span id="ayuda-vacio" className={styles.ayuda}>
              {ayuda}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type TonoChip = "neutro" | "aviso" | "exito" | "info" | "error" | "atenuado";

/** Chip con la etiqueta siempre escrita: el estado nunca se comunica solo con color. */
export function Chip({ tono, children, titulo }: { tono: TonoChip; children: ReactNode; titulo?: string }) {
  return (
    <span className={`${styles.chip} ${styles[`chip_${tono}`]}`} title={titulo}>
      {children}
    </span>
  );
}

export function Aviso({ tono, children }: { tono: "aviso" | "info" | "error"; children: ReactNode }) {
  return (
    <div className={`${styles.aviso} ${styles[`aviso_${tono}`]}`} role={tono === "info" ? "note" : "status"}>
      {children}
    </div>
  );
}
