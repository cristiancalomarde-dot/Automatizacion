import type { ComponenteEntrada } from "../tipos";

/**
 * Owner 2026-10-17: el ID de Journaway es del pasajero y no cambia. Un mail
 * nuevo de pedido con un ID ya cargado suma sus tours a esa reserva (como la
 * acción "sumada" de M2-04), sin duplicar los que ya estaban. Y las partes de
 * una reserva van en orden de fecha (un mail = una reserva, aunque traiga dos
 * paquetes). Funciones puras; las usa `procesar-mail.ts`.
 */

export interface ParteGuardada {
  producto_id: string | null;
  fecha_inicio: string | null;
  texto_agencia: string | null;
}

const normal = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Ya está: el mismo producto en la misma fecha; sin producto, el mismo texto de la agencia en la misma fecha. */
function yaEsta(p: ComponenteEntrada, guardadas: readonly ParteGuardada[]): boolean {
  return guardadas.some((g) =>
    p.productoId
      ? g.producto_id === p.productoId && g.fecha_inicio === (p.fechaInicio ?? null)
      : normal(g.texto_agencia) === normal(p.textoAgencia) && g.fecha_inicio === (p.fechaInicio ?? null),
  );
}

/** Las partes del mail nuevo que la reserva todavía no tiene. */
export function partesNuevas(guardadas: readonly ParteGuardada[], entrantes: readonly ComponenteEntrada[]): ComponenteEntrada[] {
  const vistas: ParteGuardada[] = [...guardadas];
  const nuevas: ComponenteEntrada[] = [];
  for (const p of entrantes) {
    if (yaEsta(p, vistas)) continue;
    nuevas.push(p);
    vistas.push({ producto_id: p.productoId ?? null, fecha_inicio: p.fechaInicio ?? null, texto_agencia: p.textoAgencia ?? null });
  }
  return nuevas;
}

/** Por fecha; lo que no tiene fecha va al final y los empates conservan su orden (la llegada antes que el tour del mismo día). */
export function ordenarPorFecha<T>(xs: readonly T[], fecha: (x: T) => string | null | undefined): T[] {
  return xs
    .map((x, i) => ({ x, i, f: fecha(x) ?? null }))
    .sort((a, b) => {
      if (a.f && b.f && a.f !== b.f) return a.f < b.f ? -1 : 1;
      if (a.f && !b.f) return -1;
      if (!a.f && b.f) return 1;
      return a.i - b.i;
    })
    .map((e) => e.x);
}
