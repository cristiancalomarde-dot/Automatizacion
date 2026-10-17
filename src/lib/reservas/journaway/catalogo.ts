import { AGENCIA_JOURNAWAY, ladosDeUnTraslado, type Lado } from "@/lib/catalogo/reglas";
import type { DetalleProducto, Servicio } from "@/lib/catalogo/tipos";
import type { CatalogoParaEmparejar } from "../emparejar/catalogo";
import type { CatalogoJournaway, PaqueteJournaway } from "./tipos";

/**
 * Los paquetes armados de Journaway (SPAP01…SPAP06, M2-08) para el
 * reconocedor: cada parte con su día, si es un traslado y qué lados se piden
 * en ese paquete (con los ajustes de M1-08: SPAP03 solo la salida, SPAP05 y
 * SPAP06 solo la llegada). Sale del mismo detalle que muestra la pantalla
 * (`cargarProducto`). Solo lectura.
 */

const esTraslado = (servicios: Servicio[]) => servicios.length > 0 && servicios.every((s) => s.tipo === "traslado");

function ladosDe(servicios: Servicio[]): Lado[] {
  const lados = new Set<Lado>();
  for (const s of servicios) if (s.tipo === "traslado") for (const l of ladosDeUnTraslado(s).quedan) lados.add(l);
  return (["in", "out"] as Lado[]).filter((l) => lados.has(l));
}

export function paqueteDeDetalle(detalle: DetalleProducto): PaqueteJournaway {
  return {
    productoId: detalle.id,
    codigo: detalle.codigo,
    nombre: detalle.nombre,
    partes: detalle.componentes
      .filter((c) => c.tipo === "paquete" && c.producto)
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({
        productoComponenteId: c.id ?? null,
        orden: c.orden,
        dia: c.diaDesde ?? 1,
        productoId: c.producto!.id,
        codigo: c.producto!.codigo,
        nombre: c.producto!.nombre,
        esTraslado: esTraslado(c.producto!.servicios),
        lados: ladosDe(c.producto!.servicios),
      })),
  };
}

export function catalogoJournawayDeDetalles(detalles: DetalleProducto[]): CatalogoJournaway {
  return {
    paquetes: detalles
      .filter((d) => d.esTour && d.componentes.length > 0)
      .map(paqueteDeDetalle)
      .sort((a, b) => a.codigo.localeCompare(b.codigo)),
  };
}

/** Los productos con nombre de Journaway que son paquetes armados (tienen partes). */
export function idsDePaquetesJournaway(catalogo: CatalogoParaEmparejar): string[] {
  const deJournaway = new Set(catalogo.codigos.filter((c) => c.agencia === AGENCIA_JOURNAWAY).map((c) => c.productoId));
  return catalogo.productos.filter((p) => p.esTour && deJournaway.has(p.id)).map((p) => p.id);
}

export async function cargarCatalogoJournaway(
  catalogo: CatalogoParaEmparejar,
  detalle: (productoId: string) => Promise<DetalleProducto>,
): Promise<CatalogoJournaway> {
  const detalles = await Promise.all(idsDePaquetesJournaway(catalogo).map((id) => detalle(id)));
  return catalogoJournawayDeDetalles(detalles);
}
