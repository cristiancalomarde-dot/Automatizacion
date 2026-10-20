/**
 * El filtro por operativo de la lista de reservas (spec M3-06 fila 7): "Todas"
 * (por defecto), "Mis reservas", "Sin responsable" y cada persona del equipo.
 * Se combina con el buscador y los demás filtros de la lista, y se recuerda
 * por persona en el navegador (no en la base). Sin base ni red.
 */
import { TEXTOS } from "@/lib/textos";

const F = TEXTOS.reservas.responsable;

export type FiltroResponsable = "todas" | "mias" | "sin" | `persona:${string}`;

export interface OpcionFiltro {
  valor: FiltroResponsable;
  texto: string;
}

export interface PersonaDelEquipo {
  id: string;
  nombre: string;
}

export function pasaFiltroResponsable(f: { responsableId?: string | null }, filtro: FiltroResponsable, yo: string | null): boolean {
  const responsable = f.responsableId ?? null;
  if (filtro === "todas") return true;
  if (filtro === "mias") return yo !== null && responsable === yo;
  if (filtro === "sin") return responsable === null;
  return responsable === filtro.slice("persona:".length);
}

/** Las opciones del filtro: sin saber quién soy no hay "Mis reservas"; yo no me repito como persona. */
export function opcionesFiltroResponsable(personas: readonly PersonaDelEquipo[], yo: string | null): OpcionFiltro[] {
  const otras = personas
    .filter((p) => p.id !== yo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((p): OpcionFiltro => ({ valor: `persona:${p.id}`, texto: p.nombre }));
  return [
    { valor: "todas", texto: F.todas },
    ...(yo ? [{ valor: "mias" as const, texto: F.mias }] : []),
    { valor: "sin", texto: F.sin },
    ...otras,
  ];
}

/** La clave del navegador: una por persona (dos personas en la misma compu no se pisan). */
export const claveFiltroResponsable = (yo: string | null): string => `hi-travel.reservas.responsable.${yo ?? "sin-sesion"}`;

/** Lo guardado vale si sigue entre las opciones; si no, "Todas". */
export function filtroGuardado(valor: string | null, opciones: readonly OpcionFiltro[]): FiltroResponsable {
  return opciones.find((o) => o.valor === valor)?.valor ?? "todas";
}
