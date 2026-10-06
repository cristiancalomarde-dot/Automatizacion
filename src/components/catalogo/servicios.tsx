import Link from "next/link";
import type { ReactNode } from "react";
import { estadoServicio, queEs } from "@/lib/catalogo/reglas";
import type { Servicio } from "@/lib/catalogo/tipos";
import { TEXTOS } from "@/lib/textos";
import { Chip, type TonoChip } from "@/components/ui/estados";
import ui from "@/components/ui/ui.module.css";

const T = TEXTOS.producto;
const E = TEXTOS.estadoServicio;

const TONO_ESTADO: Record<ReturnType<typeof estadoServicio>["tipo"], TonoChip> = {
  con_mail: "exito",
  whatsapp: "info",
  manual: "neutro",
  sin_resolver: "aviso",
};

/** Chips de estado de un servicio (#15): siempre con la etiqueta escrita. */
export function ChipsServicio({ servicio }: { servicio: Servicio }) {
  const estado = estadoServicio(servicio);
  return (
    <span className={ui.chips}>
      <Chip tono={TONO_ESTADO[estado.tipo]}>{E[estado.tipo]}</Chip>
      {servicio.opcional ? <Chip tono="atenuado">{E.opcional}</Chip> : null}
    </span>
  );
}

function EnlaceProveedor({ id, nombre }: { id: string; nombre: string }) {
  return (
    <Link href={`/proveedores/${id}`} className={ui.enlace} onClick={(e) => e.stopPropagation()}>
      {nombre}
    </Link>
  );
}

/** Columnas de una fila de servicio, en el orden de `ENCABEZADOS_SERVICIO`. */
export const ENCABEZADOS_SERVICIO = ["Servicio", "Nivel / opción", "Pedido a", "Mail", "Estado", "Origen"] as const;

/**
 * Una opción de un servicio: qué es, a quién se le pide (con mail visible sin
 * clic extra, #3), su estado y de qué fila del Excel sale (#5).
 */
export function FilaServicio({
  servicio,
  opcion,
  mostrarNivel = false,
  celdaInicial,
}: {
  servicio: Servicio;
  /** Número de opción (1ª, 2ª…) si el servicio tiene alternativas. */
  opcion: number | null;
  mostrarNivel?: boolean;
  celdaInicial?: ReactNode;
}) {
  const estado = estadoServicio(servicio);
  const bs = servicio.bookingSupplier;
  const sp = servicio.serviceProvider;
  const nivelYOpcion = [mostrarNivel ? servicio.nivel : null, opcion ? T.opcionN(opcion) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr className={estado.tipo === "sin_resolver" ? ui.filaAtencion : undefined}>
      {celdaInicial !== undefined ? <td className={ui.nowrap}>{celdaInicial}</td> : null}
      <td title={servicio.descripcion ?? undefined}>
        <div>{queEs(servicio)}</div>
        {servicio.tipo !== "alojamiento" ? <div className={ui.meta}>{T.tipos[servicio.tipo]}</div> : null}
        {estado.motivo ? <div className={ui.meta}>{estado.motivo}</div> : null}
      </td>
      <td className={`${ui.secundario} ${ui.nowrap}`}>{nivelYOpcion}</td>
      <td>
        {bs ? (
          <EnlaceProveedor id={bs.id} nombre={bs.nombre} />
        ) : (
          <span className={ui.secundario}>{servicio.bookingSupplierNombre ?? TEXTOS.comunes.sinDato}</span>
        )}
        {sp && sp.id !== bs?.id ? (
          <div className={ui.meta}>
            {T.serviceProvider}: <EnlaceProveedor id={sp.id} nombre={sp.nombre} />
          </div>
        ) : null}
      </td>
      <td>
        {bs && bs.mails.length > 0 ? (
          bs.mails.map((mail) => <div key={mail}>{mail}</div>)
        ) : bs ? (
          <span className={ui.secundario}>
            {bs.telefono ?? (bs.canal === "whatsapp" ? TEXTOS.comunes.sinDato : T.sinMailCargado)}
          </span>
        ) : null}
      </td>
      <td>
        <ChipsServicio servicio={servicio} />
      </td>
      <td className={ui.meta}>{servicio.filaExcel !== null ? T.origenExcel(servicio.filaExcel) : T.origenTramos}</td>
    </tr>
  );
}

/** Filas de un grupo de alternativas (mismo servicio, opciones "/" por prioridad). */
export function FilasAlternativas({
  grupo,
  mostrarNivel = false,
  conCeldaInicial = false,
}: {
  grupo: Servicio[];
  mostrarNivel?: boolean;
  conCeldaInicial?: boolean;
}) {
  return (
    <>
      {grupo.map((servicio, i) => (
        <FilaServicio
          key={servicio.id}
          servicio={servicio}
          opcion={grupo.length > 1 ? i + 1 : null}
          mostrarNivel={mostrarNivel}
          celdaInicial={conCeldaInicial ? "" : undefined}
        />
      ))}
    </>
  );
}
