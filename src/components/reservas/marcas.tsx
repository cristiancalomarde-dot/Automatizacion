import { Chip, type TonoChip } from "@/components/ui/estados";
import type { EstadoReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import estilos from "./reservas.module.css";

const T = TEXTOS.reservas;

/** Color de cada estado (marca.md §1). Los de M3 y M4 se afinan cuando existan. */
const TONO: Record<EstadoReserva, TonoChip> = {
  recibida: "neutro",
  para_revision: "aviso",
  pedido_a_proveedor: "info",
  confirmada: "exito",
  con_cambios: "info",
  rechazada: "error",
  cerrada: "atenuado",
  descartada: "atenuado",
};

/** Triángulo de atención (estilo lineal, marca.md §4). Decorativo: la etiqueta va escrita al lado. */
export function IconoTriangulo() {
  return (
    <svg
      data-icono="triangulo"
      className={estilos.icono}
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 1.75 14.75 13.75H1.25Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6v3.5M8 11.5v.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** El estado, con la etiqueta siempre escrita; "para revisión" lleva además el triángulo. */
export function ChipEstado({ estado }: { estado: EstadoReserva }) {
  return (
    <Chip tono={TONO[estado]}>
      {estado === "para_revision" ? <IconoTriangulo /> : null}
      {T.estados[estado]}
    </Chip>
  );
}

/** Las marcas que se apilan sobre el estado: posible duplicada y de prueba. */
export function MarcasReserva({ posibleDuplicada, dePrueba }: { posibleDuplicada: boolean; dePrueba: boolean }) {
  return (
    <>
      {posibleDuplicada ? <Chip tono="aviso">{T.posibleDuplicada}</Chip> : null}
      {dePrueba ? <Chip tono="info">{T.dePrueba}</Chip> : null}
    </>
  );
}
