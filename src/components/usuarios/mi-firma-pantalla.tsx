"use client";

import { useState } from "react";
import { guardarMiNombreParaLaFirma } from "@/app/(app)/mi-firma/acciones";
import { TEXTOS } from "@/lib/textos";
import { MAX_NOMBRE_FIRMA } from "@/lib/usuarios/nombre";
import { Aviso } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";

const T = TEXTOS.miFirma;

type Estado = { tipo: "nada" } | { tipo: "guardando" } | { tipo: "listo" } | { tipo: "error"; mensaje: string };

/**
 * "Mi nombre para la firma" (spec M3-06 fila 1 y §4): cómo aparece el nombre
 * de la persona al final de los pedidos a proveedores. Propone el nombre de
 * Google; vacío vuelve a él.
 */
export function MiFirmaPantalla({ nombreGoogle, guardado }: { nombreGoogle: string; guardado: string | null }) {
  const [texto, setTexto] = useState(guardado ?? nombreGoogle);
  const [firmaComo, setFirmaComo] = useState(guardado ?? nombreGoogle);
  const [estado, setEstado] = useState<Estado>({ tipo: "nada" });

  async function guardar() {
    setEstado({ tipo: "guardando" });
    const r = await guardarMiNombreParaLaFirma(texto).catch(() => ({ ok: false as const, error: T.error(T.motivos.conexion) }));
    if (!r.ok) {
      setEstado({ tipo: "error", mensaje: r.error });
      return;
    }
    setFirmaComo(r.firmaComo);
    setTexto(r.nombreFirma ?? r.firmaComo);
    setEstado({ tipo: "listo" });
  }

  return (
    <div className={ui.pagina}>
      <div className={ui.encabezado}>
        <h1 className={ui.titulo}>{T.titulo}</h1>
      </div>
      <section className={ui.seccion}>
        <p className={ui.migas}>{T.ayuda}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <label className={ui.campo}>
            <span>{T.campo}</span>
            <input
              type="text"
              className={ui.input}
              value={texto}
              maxLength={MAX_NOMBRE_FIRMA + 20}
              onChange={(e) => {
                setTexto(e.target.value);
                if (estado.tipo === "listo") setEstado({ tipo: "nada" });
              }}
            />
          </label>
          <p className={ui.meta}>{T.vistaPrevia(firmaComo)}</p>
          <div className={ui.acciones}>
            <button type="submit" className={ui.botonPrimario} disabled={estado.tipo === "guardando"}>
              {estado.tipo === "guardando" ? T.guardando : T.guardar}
            </button>
            {estado.tipo === "listo" ? (
              <span className={ui.meta} role="status">
                {T.listo}
              </span>
            ) : null}
          </div>
        </form>
        {estado.tipo === "error" ? (
          <Aviso tono="error">
            {estado.mensaje}{" "}
            <button type="button" className={ui.botonSecundario} onClick={() => void guardar()}>
              {T.reintentar}
            </button>
          </Aviso>
        ) : null}
      </section>
    </div>
  );
}
