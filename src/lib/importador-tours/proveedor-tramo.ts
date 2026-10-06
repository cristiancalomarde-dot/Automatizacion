import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { resolverProveedor, type IndiceProveedores, type Resolucion } from "@/lib/importador-productos/proveedores";

/**
 * A quién se le pide un bus del tour (`tramos-con-proveedor.csv`), con el
 * mismo criterio que los servicios de los paquetes (M1-04d):
 *
 * 1. Si en `data/equivalencias-proveedores.csv` el nombre está marcado
 *    `manual` (Kupos.cl, Transvipp: se compran en el sistema de ellos) en el
 *    destino de alguna de las dos puntas del bus, el servicio es manual: sin
 *    proveedor y sin revisión. Si ninguna punta tiene una equivalencia para
 *    ese nombre, vale la marca `manual` de cualquier destino.
 * 2. Si no, se resuelve como un servicio de paquete, probando el destino de
 *    cada punta (nombre exacto → equivalencias).
 */
export function resolverProveedorTramo(nombre: string, indice: IndiceProveedores, puntas: Array<string | null>): Resolucion {
  const clave = normalizarNombre(nombre);
  const destinos = puntas.filter((d): d is string => d !== null);
  const enPuntas = destinos.map((d) => indice.alias.get(`${d}|${clave}`)).filter((a) => a !== undefined);
  const manual = enPuntas.length
    ? enPuntas.some((a) => a.modo === "manual")
    : [...indice.alias.entries()].some(([k, a]) => k.endsWith(`|${clave}`) && a.modo === "manual");
  if (manual) return { id: null, paraRevisar: false, nota: null, manual: true };

  let primera: Resolucion | null = null;
  for (const destino of destinos.length ? destinos : [null]) {
    const r = resolverProveedor(nombre, indice, { destino });
    if (r.id) return r;
    primera ??= r;
  }
  return primera!;
}
