import Link from "next/link";
import type { ReactNode } from "react";
import { estadoServicio, origenDelServicio, queEs } from "@/lib/catalogo/reglas";
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

const TONO_AJUSTE: Record<NonNullable<Servicio["ajusteTour"]>["accion"], TonoChip> = {
  anular: "atenuado",
  solo_llegada: "info",
  solo_salida: "info",
  reemplazar: "aviso",
  invertir: "aviso",
};

/**
 * Chips de estado de un servicio (#15): siempre con la etiqueta escrita. M1-08:
 * dentro de un tour, cómo queda en ese tour; en el paquete, si es a pedido o
 * según la reserva.
 */
export function ChipsServicio({ servicio }: { servicio: Servicio }) {
  const estado = estadoServicio(servicio);
  const ajuste = servicio.ajusteTour;
  return (
    <span className={ui.chips}>
      {ajuste ? <Chip tono={TONO_AJUSTE[ajuste.accion]}>{T.ajuste[ajuste.accion]}</Chip> : null}
      <Chip tono={TONO_ESTADO[estado.tipo]}>{E[estado.tipo]}</Chip>
      {servicio.opcional ? <Chip tono="atenuado">{E.opcional}</Chip> : null}
      {servicio.aPedido ? <Chip tono="atenuado">{E[servicio.aPedido]}</Chip> : null}
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
  const ajuste = servicio.ajusteTour;
  const anulado = ajuste?.accion === "anular";
  const textoNuevo = ajuste && (ajuste.accion === "reemplazar" || ajuste.accion === "invertir") ? ajuste.texto : null;
  const clase = anulado ? ui.filaAnulada : estado.tipo === "sin_resolver" ? ui.filaAtencion : undefined;

  return (
    <tr className={clase}>
      {celdaInicial !== undefined ? <td className={ui.nowrap}>{celdaInicial}</td> : null}
      <td title={servicio.descripcion ?? undefined}>
        <div>{anulado ? <s>{queEs(servicio)}</s> : (textoNuevo ?? queEs(servicio))}</div>
        {servicio.tipo !== "alojamiento" ? <div className={ui.meta}>{T.tipos[servicio.tipo]}</div> : null}
        {ajuste ? <div className={ui.meta}>{ajuste.motivo}</div> : null}
        {textoNuevo ? <div className={ui.meta}>{T.enElExcel(queEs(servicio))}</div> : null}
        {ajuste && !textoNuevo && !anulado && ajuste.texto ? <div className={ui.meta}>{ajuste.texto}</div> : null}
        {servicio.aPedido && servicio.aPedidoNota ? <div className={ui.meta}>{servicio.aPedidoNota}</div> : null}
        {estado.motivo && !anulado ? <div className={ui.meta}>{estado.motivo}</div> : null}
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
      <td className={ui.meta}>{origenDelServicio(servicio)}</td>
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
