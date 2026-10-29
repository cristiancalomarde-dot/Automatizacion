"use client";

import { useId, useState } from "react";
import { marcarMotivoResuelto } from "@/app/(app)/reservas/[id]/acciones-corregir";
import { esMotivoDeProducto } from "@/lib/reservas/emparejar/motivos-de-producto";
import type { LineaDeMotivo } from "@/lib/reservas/reglas";
import type { DetalleReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import ui from "@/components/ui/ui.module.css";
import { puedeConfirmarProducto } from "./confirmar-producto";
import { ErrorAlGuardar, puedeCorregir, useGuardar, versionDe } from "./corregir-vuelos";
import estilos from "./reservas.module.css";

const T = TEXTOS.reserva.corregir;
/** El máximo de una nota corta; el servidor y la base controlan lo mismo. */
const MAXIMO_NOTA = 200;

/**
 * Spec M3-39 fila 4: "Marcar como resuelto" va en los motivos que no tienen su
 * arreglo propio. Los datos dudosos tienen el suyo ("Está bien así" /
 * "Corregir", abajo) y el producto, "Confirmar producto" cuando se muestra.
 * Solo con la reserva para revisión y en un estado que se puede tocar.
 */
export function puedeMarcarResuelto(reserva: DetalleReserva, linea: LineaDeMotivo): boolean {
  if (reserva.estado !== "para_revision" || !puedeCorregir(reserva)) return false;
  if (linea.categoria === "datos_dudosos") return false;
  return !(puedeConfirmarProducto(reserva) && linea.motivos.some(esMotivoDeProducto));
}

/** Spec M3-39 filas 1 y 2: el botón y la nota obligatoria de cómo se resolvió. */
export function MarcarResuelto({
  reserva,
  linea,
  onListo,
  onRecargar,
}: {
  reserva: DetalleReserva;
  linea: LineaDeMotivo;
  onListo: (mensaje: string) => void;
  onRecargar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [errorNota, setErrorNota] = useState<string | null>(null);
  const { estado, guardar, limpiar } = useGuardar(reserva, onListo);
  const guardando = estado.tipo === "guardando";
  const id = useId();

  if (!abierto) {
    return (
      <button type="button" className={ui.botonSecundario} aria-label={`${T.marcarResuelto}: ${linea.frase}`} onClick={() => setAbierto(true)}>
        {T.marcarResuelto}
      </button>
    );
  }

  function enviar() {
    const texto = nota.trim();
    const error = !texto ? T.errores.faltaNota : texto.length > MAXIMO_NOTA ? T.errores.notaLarga(MAXIMO_NOTA) : null;
    setErrorNota(error);
    if (error) return;
    void guardar(() => marcarMotivoResuelto({ reservaId: reserva.id, version: versionDe(reserva), motivos: linea.motivos, nota: texto }));
  }

  return (
    <div className={estilos.formRevision} role="group" aria-label={`${T.marcarResuelto}: ${linea.frase}`}>
      <label className={ui.campo}>
        <span>{T.notaResuelto}</span>
        <textarea
          className={ui.input}
          rows={2}
          value={nota}
          disabled={guardando}
          aria-describedby={`${id}-ayuda`}
          aria-invalid={errorNota ? true : undefined}
          onChange={(e) => {
            setNota(e.target.value);
            setErrorNota(null);
          }}
        />
      </label>
      <span id={`${id}-ayuda`} className={errorNota ? estilos.errorCampo : ui.ayuda}>
        {errorNota ?? T.notaResueltoAyuda}
      </span>
      <ErrorAlGuardar estado={estado} onReintentar={enviar} onRecargar={onRecargar} />
      <div className={ui.acciones}>
        <button type="button" className={ui.botonPrimario} disabled={guardando} onClick={enviar}>
          {guardando ? T.guardando : T.guardar}
        </button>
        <button
          type="button"
          className={ui.botonSecundario}
          disabled={guardando}
          onClick={() => {
            setAbierto(false);
            setNota("");
            setErrorNota(null);
            limpiar();
          }}
        >
          {T.cancelar}
        </button>
      </div>
    </div>
  );
}
