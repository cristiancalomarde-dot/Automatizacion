import type { SupabaseClient } from "@supabase/supabase-js";
import { diaDeServicioDelTour } from "@/lib/catalogo/reglas";

/**
 * Lo que el emparejado necesita del catálogo de M1 (spec M2-03): los
 * productos cargados (la lista cerrada para la IA, con sus noches si son
 * tours) y los códigos y nombres de cada agencia (`codigo_externo`).
 *
 * Solo lectura (DECISIONS 2026-10-06, fila 16): nada de este archivo escribe
 * en el catálogo.
 */

export interface ProductoDeLista {
  id: string;
  codigo: string;
  nombre: string;
  ciudades: string[];
  destino: string | null;
  esTour: boolean;
  /** Noches del tour (de sus componentes y buses nocturnos); null en un paquete. */
  noches: number | null;
}

export interface CodigoDeAgencia {
  productoId: string;
  agencia: string;
  codigo: string;
  nombreExterno: string | null;
}

export interface CatalogoParaEmparejar {
  productos: ProductoDeLista[];
  codigos: CodigoDeAgencia[];
}

/** Las filas crudas de la base que hacen falta (también la foto de los tests). */
export interface FilasCatalogo {
  productos: Array<{ id: string; codigo: string; nombre: string; ciudades: string[] | null; destino: string | null }>;
  codigos: Array<{ producto_id: string; agencia: string; codigo: string; nombre_externo: string | null }>;
  componentes: Array<{
    producto_id: string;
    tipo: "paquete" | "tramo_bus";
    dia_desde: number | null;
    noches: number | null;
    nocturno: boolean | null;
  }>;
  /** Los servicios de tipo bus (los del tour mismo dicen "sale el día N del tour"). */
  buses: Array<{ producto_id: string; descripcion: string | null }>;
}

/**
 * Noches de un tour: hasta el último día que ocupa (cada paquete desde su día
 * más sus noches; un bus nocturno, una noche más) menos uno. CHB31 = 6 (3 en
 * San Pedro, 2 en Uyuni y el bus nocturno a La Paz); AR09 = 15; 5C01 = 29.
 */
export function nochesDelTour(
  componentes: FilasCatalogo["componentes"],
  buses: FilasCatalogo["buses"],
): number | null {
  let fin: number | null = null;
  const llegar = (dia: number) => {
    fin = fin === null ? dia : Math.max(fin, dia);
  };
  for (const c of componentes) {
    if (c.dia_desde === null) continue;
    if (c.tipo === "paquete") llegar(c.dia_desde + (c.noches ?? 0));
    else llegar(c.dia_desde + (c.nocturno ? 1 : 0));
  }
  for (const b of buses) {
    const dia = diaDeServicioDelTour(b.descripcion);
    if (dia !== null) llegar(dia + (/nocturno/i.test(b.descripcion ?? "") ? 1 : 0));
  }
  return fin === null ? null : fin - 1;
}

export function armarCatalogo(filas: FilasCatalogo): CatalogoParaEmparejar {
  const componentesPorTour = new Map<string, FilasCatalogo["componentes"]>();
  for (const c of filas.componentes) componentesPorTour.set(c.producto_id, [...(componentesPorTour.get(c.producto_id) ?? []), c]);
  const busesPorProducto = new Map<string, FilasCatalogo["buses"]>();
  for (const b of filas.buses) busesPorProducto.set(b.producto_id, [...(busesPorProducto.get(b.producto_id) ?? []), b]);

  const productos = [...filas.productos]
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((p): ProductoDeLista => {
      const componentes = componentesPorTour.get(p.id) ?? [];
      const esTour = componentes.length > 0;
      return {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        ciudades: p.ciudades ?? [],
        destino: p.destino ?? null,
        esTour,
        noches: esTour ? nochesDelTour(componentes, busesPorProducto.get(p.id) ?? []) : null,
      };
    });
  return {
    productos,
    codigos: filas.codigos.map((c) => ({
      productoId: c.producto_id,
      agencia: c.agencia,
      codigo: c.codigo,
      nombreExterno: c.nombre_externo ?? null,
    })),
  };
}

function verificar<T>(r: { data: T | null; error: { message: string } | null }, que: string): T {
  if (r.error) throw new Error(`No se pudo leer ${que}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

/** Lee el catálogo de la base (con la service role o la sesión del equipo). Solo lectura. */
export async function cargarCatalogoParaEmparejar(cliente: SupabaseClient): Promise<CatalogoParaEmparejar> {
  const [productos, codigos, componentes, buses] = await Promise.all([
    cliente.from("producto").select("id,codigo,nombre,ciudades,destino").range(0, 9999),
    cliente.from("codigo_externo").select("producto_id,agencia,codigo,nombre_externo").range(0, 9999),
    cliente.from("producto_componente").select("producto_id,tipo,dia_desde,noches,nocturno").range(0, 9999),
    cliente.from("producto_servicio").select("producto_id,descripcion").eq("tipo_servicio", "bus").range(0, 9999),
  ]);
  return armarCatalogo({
    productos: verificar(productos, "los productos"),
    codigos: verificar(codigos, "los códigos de las agencias"),
    componentes: verificar(componentes, "los componentes de los tours"),
    buses: verificar(buses, "los buses del catálogo"),
  });
}
