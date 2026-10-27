"use client";

import { avisosDelItinerario } from "@/app/(app)/reservas/[id]/acciones-itinerario";
import { useConsulta } from "@/lib/catalogo/use-consulta";
import type { EstadoReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { Aviso } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";
import estilos from "./reservas.module.css";

const T = TEXTOS.reserva.revisarAntes;

/** Los estados en que todavía se pide (spec M3-24): después, el bloque ya no sirve. */
const CON_AVISO: ReadonlySet<EstadoReserva> = new Set(["recibida", "para_revision", "pedido_a_proveedor"]);

export const muestraRevisarAntes = (estado: EstadoReserva) => CON_AVISO.has(estado);

/**
 * "Revisar antes de pedir" (spec M3-24 fila 5): arriba de todo en el detalle, en amarillo, los
 * problemas de fechas del itinerario (blackouts del Word, Navidad / Año Nuevo / Carnaval / Semana
 * Santa, buses que no salen ese día). Se calculan en el servidor con las reglas de `data/*.csv`, sin
 * IA. Sin avisos no aparece; avisa, no frena.
 */
export function RevisarAntesDePedir({ reservaId }: { reservaId: string }) {
  const { estado, reintentar } = useConsulta(async () => {
    const r = await avisosDelItinerario(reservaId);
    if (!r.ok) throw new Error(r.error);
    return r.avisos;
  });
  if (estado.tipo === "cargando") return null;
  if (estado.tipo === "error") {
    return (
      <p className={ui.migas} data-testid="revisar-antes-error">
        {T.error}{" "}
        <button type="button" className={ui.enlace} onClick={reintentar}>
          {T.reintentar}
        </button>
      </p>
    );
  }
  if (estado.datos.length === 0) return null;
  return (
    <Aviso tono="aviso">
      <div data-testid="revisar-antes-de-pedir">
        <p className={estilos.avisoTitulo}>{T.titulo}</p>
        <p>{T.bajada}</p>
        <ul className={estilos.motivos}>
          {estado.datos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </Aviso>
  );
}
