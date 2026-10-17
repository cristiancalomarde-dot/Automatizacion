import type { TipoServicio } from "@/lib/importador-productos/linea";
import type { IndiceProveedores } from "@/lib/importador-productos/proveedores";
import { sentidoDelTraslado, type SentidoTraslado } from "@/lib/importador-productos/sentido";
import type { FilaComposicion, Lado, ProductoInterno } from "./composicion";
import type { NombreJournaway } from "./nombres";
import { CIUDAD_DE_DESTINO, destinoDeLaPlanilla, type FilaPlanilla } from "./planilla";
import { resolverProveedoresDeProducto, type FilaProveedorJournaway, type OpcionProveedor } from "./proveedores";

/**
 * Qué se carga del catálogo de Journaway (spec M2-08 §3 #2 y #5-#8), armado
 * sin tocar la base: la planilla + los cuatro archivos de `data/` + el
 * directorio de proveedores (solo para buscar). Todo lo que no cierra corta
 * acá, antes de que el importador escriba nada.
 *
 * - Un producto simple por cada fila de la planilla que no es un paquete
 *   armado (los paquetes de un solo proveedor, como IGRP01, también son
 *   simples): un servicio del tipo que corresponde, pedido a su proveedor.
 * - Los productos internos (el Overland privado UYUO01), con sus servicios.
 * - Los paquetes armados (los de `data/journaway-composicion.csv`): sus
 *   partes en orden, con su día, sin servicios propios. El lado de un
 *   traslado sale solo de la composición y se guarda como ajuste del armado
 *   (origen `excepcion`): la regla de buses de M1-08 no se aplica.
 * - Los nombres de Journaway (limpios para buscar, tal cual para mostrar) y,
 *   en los productos en celeste, su propio código.
 */

/** Una fila de `producto_servicio`, sin `producto_id` (mismas columnas que M1). */
export interface ServicioJournaway {
  orden: number;
  prioridad: number;
  tipo_servicio: TipoServicio;
  nivel: null;
  fila_excel: number | null;
  descripcion: string;
  service_provider_nombre: string;
  booking_supplier_nombre: string;
  service_provider_id: null;
  booking_supplier_id: string | null;
  proveedor_sin_resolver: boolean;
  proveedor_para_revisar: boolean;
  proveedor_nota: string | null;
  opcional: boolean;
  reserva_manual: boolean;
  sentido: SentidoTraslado | null;
}

export interface NochesJournaway {
  orden: number;
  nocheDesde: number;
  noches: number;
  lugar: string | null;
}

export interface ComponenteJournaway {
  orden: number;
  dia: number;
  codigo: string;
}

export interface AjusteJournaway {
  /** El producto de la parte (SPAT01). */
  paquete: string;
  /** El `orden` del servicio de traslado dentro de esa parte. */
  orden: number;
  accion: Lado;
  motivo: string;
}

export interface CodigoJournaway {
  codigo: string;
  /** null = el código HI Travel del producto en celeste; si no, el nombre tal cual. */
  nombreExterno: string | null;
}

export interface ProductoJournaway {
  codigo: string;
  nombre: string;
  destino: string;
  ciudades: string[];
  celeste: boolean;
  interno: boolean;
  /** Fila de la planilla (null en los internos). */
  filaPlanilla: number | null;
  tipoPlanilla: string | null;
  comentario: string | null;
  servicios: ServicioJournaway[];
  noches: NochesJournaway[];
  componentes: ComponenteJournaway[];
  ajustes: AjusteJournaway[];
  codigos: CodigoJournaway[];
  /** Opciones de proveedor (una por prioridad); vacío en los armados. */
  opciones: OpcionProveedor[];
  /** Los nombres con su origen, para el reporte. */
  nombres: NombreJournaway[];
}

export interface PlanJournaway {
  productos: ProductoJournaway[];
}

const TIPO_DE_LA_PLANILLA: Record<string, TipoServicio> = {
  traslado: "traslado",
  excursion: "excursion",
  bus: "bus",
  alojamiento: "alojamiento",
  // Como el W Trek de CH10 (M1-07): un servicio "otro" pedido entero.
  trekking: "otro",
  // Un paquete de un solo proveedor (IGRP01, IPCP01…) se pide entero, como el 105 Premium de M1.
  paquete: "excursion",
};

export const MOTIVO_LADO: Record<Lado, string> = {
  solo_llegada: "En este paquete solo se pide la llegada.",
  solo_salida: "En este paquete solo se pide la salida.",
};

function normal(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

function servicioDe(
  base: { orden: number; tipo: TipoServicio; queEs: string; descripcion: string; filaExcel: number | null },
  opcion: OpcionProveedor,
): ServicioJournaway {
  return {
    orden: base.orden,
    prioridad: opcion.prioridad,
    tipo_servicio: base.tipo,
    nivel: null,
    fila_excel: base.filaExcel,
    descripcion: base.descripcion,
    service_provider_nombre: base.queEs,
    booking_supplier_nombre: opcion.proveedorNombre,
    service_provider_id: null,
    booking_supplier_id: opcion.proveedorId,
    proveedor_sin_resolver: opcion.sinResolver,
    proveedor_para_revisar: opcion.paraRevisar,
    proveedor_nota: opcion.nota,
    opcional: false,
    reserva_manual: opcion.manual,
    sentido: base.tipo === "traslado" ? sentidoDelTraslado(base.descripcion) : null,
  };
}

export function planificarJournaway(opciones: {
  planilla: FilaPlanilla[];
  proveedores: FilaProveedorJournaway[];
  composicion: FilaComposicion[];
  internos: ProductoInterno[];
  nombres: NombreJournaway[];
  indice: IndiceProveedores;
}): PlanJournaway {
  const { planilla, proveedores, composicion, internos, nombres, indice } = opciones;
  const deLaPlanilla = new Set(planilla.map((f) => f.codigo));
  for (const p of internos) {
    if (deLaPlanilla.has(p.codigo)) throw new Error(`Productos internos de Journaway: ${p.codigo} ya está en la planilla. No se cargó nada.`);
  }
  const todos = new Set([...deLaPlanilla, ...internos.map((p) => p.codigo)]);
  const armados = new Set(composicion.map((c) => c.paquete));

  // --- validaciones cruzadas (antes de armar nada) ---
  for (const c of composicion) {
    if (!deLaPlanilla.has(c.paquete)) {
      throw new Error(`Composición de Journaway, fila ${c.fila}: el paquete ${c.paquete} no existe en la planilla. No se cargó nada.`);
    }
    if (!todos.has(c.componente)) {
      throw new Error(`Composición de Journaway, fila ${c.fila}: la parte ${c.componente} no existe (ni en la planilla ni en los internos). No se cargó nada.`);
    }
    if (armados.has(c.componente)) {
      throw new Error(`Composición de Journaway, fila ${c.fila}: ${c.componente} es un paquete armado; no puede ir dentro de otro. No se cargó nada.`);
    }
  }
  for (const f of planilla) {
    if (normal(f.tipo) === "tour compuesto" && !armados.has(f.codigo)) {
      throw new Error(`La planilla de Journaway: ${f.codigo} es un tour compuesto y no tiene partes en la composición. No se cargó nada.`);
    }
  }
  for (const n of nombres) {
    if (!todos.has(n.codigo)) throw new Error(`Nombres de Journaway, fila ${n.fila}: el código ${n.codigo} no existe. No se cargó nada.`);
  }
  for (const p of proveedores) {
    if (!todos.has(p.codigo)) throw new Error(`Proveedores de Journaway, fila ${p.fila}: el código ${p.codigo} no existe. No se cargó nada.`);
    if (armados.has(p.codigo)) {
      throw new Error(`Proveedores de Journaway, fila ${p.fila}: ${p.codigo} es un paquete armado; sus proveedores son los de sus partes. No se cargó nada.`);
    }
  }

  const nombresDe = (codigo: string) => nombres.filter((n) => n.codigo === codigo);
  const codigosDe = (codigo: string, celeste: boolean): CodigoJournaway[] => {
    const lista = nombresDe(codigo);
    if (lista.length === 0) {
      throw new Error(`Nombres de Journaway: ${codigo} no tiene ningún nombre (al menos el del tarifario). No se cargó nada.`);
    }
    return [...(celeste ? [{ codigo, nombreExterno: null }] : []), ...lista.map((n) => ({ codigo: n.limpio, nombreExterno: n.nombre }))];
  };

  const productos: ProductoJournaway[] = [];

  // --- simples, de la planilla ---
  for (const f of planilla) {
    if (armados.has(f.codigo)) continue;
    const tipo = TIPO_DE_LA_PLANILLA[normal(f.tipo)];
    if (!tipo) throw new Error(`La planilla de Journaway, fila ${f.fila}: tipo «${f.tipo}» de ${f.codigo} desconocido. No se cargó nada.`);
    const { destino } = destinoDeLaPlanilla(f.destino);
    const opcionesProveedor = resolverProveedoresDeProducto({ codigo: f.codigo, destino, confirmado: f.confirmado, filas: proveedores, indice });
    const base = {
      orden: 1,
      tipo,
      queEs: f.nombreTarifario,
      descripcion: f.incluye ? `${f.nombreTarifario}\n${f.incluye}` : f.nombreTarifario,
      filaExcel: f.fila,
    };
    productos.push({
      codigo: f.codigo,
      nombre: f.nombreTarifario,
      destino,
      ciudades: [],
      celeste: f.celeste,
      interno: false,
      filaPlanilla: f.fila,
      tipoPlanilla: f.tipo,
      comentario: f.comentario || null,
      servicios: opcionesProveedor.map((o) => servicioDe(base, o)),
      noches: [],
      componentes: [],
      ajustes: [],
      codigos: codigosDe(f.codigo, f.celeste),
      opciones: opcionesProveedor,
      nombres: nombresDe(f.codigo),
    });
  }

  // --- internos (UYUO01) ---
  for (const p of internos) {
    const opcionesProveedor = resolverProveedoresDeProducto({ codigo: p.codigo, destino: p.destino, confirmado: "ok", filas: proveedores, indice });
    productos.push({
      codigo: p.codigo,
      nombre: p.nombre,
      destino: p.destino,
      ciudades: [],
      celeste: false,
      interno: true,
      filaPlanilla: null,
      tipoPlanilla: null,
      comentario: null,
      servicios: p.servicios.flatMap((s) =>
        opcionesProveedor.map((o) => servicioDe({ orden: s.orden, tipo: s.tipo, queEs: s.queEs, descripcion: s.descripcion, filaExcel: null }, o)),
      ),
      noches: p.servicios.filter((s) => s.noches).map((s) => ({ orden: s.orden, ...s.noches! })),
      componentes: [],
      ajustes: [],
      codigos: codigosDe(p.codigo, false),
      opciones: opcionesProveedor,
      nombres: nombresDe(p.codigo),
    });
  }

  // --- armados (los paquetes de San Pedro) ---
  const porCodigo = new Map(productos.map((p) => [p.codigo, p]));
  for (const f of planilla) {
    if (!armados.has(f.codigo)) continue;
    const partes = composicion.filter((c) => c.paquete === f.codigo).sort((a, b) => a.orden - b.orden);
    const { destino, ciudades } = destinoDeLaPlanilla(f.destino);
    const ajustes: AjusteJournaway[] = [];
    for (const c of partes) {
      if (!c.lado) continue;
      const traslados = [...new Set(porCodigo.get(c.componente)!.servicios.filter((s) => s.tipo_servicio === "traslado").map((s) => s.orden))];
      if (traslados.length === 0) {
        throw new Error(`Composición de Journaway, fila ${c.fila}: ${c.componente} no es un traslado; no lleva lado. No se cargó nada.`);
      }
      for (const orden of traslados) ajustes.push({ paquete: c.componente, orden, accion: c.lado, motivo: MOTIVO_LADO[c.lado] });
    }
    productos.push({
      codigo: f.codigo,
      nombre: f.nombreTarifario,
      destino,
      ciudades: ciudades.map((c) => CIUDAD_DE_DESTINO[c] ?? c),
      celeste: f.celeste,
      interno: false,
      filaPlanilla: f.fila,
      tipoPlanilla: f.tipo,
      comentario: f.comentario || null,
      servicios: [],
      noches: [],
      componentes: partes.map((c) => ({ orden: c.orden, dia: c.dia, codigo: c.componente })),
      ajustes,
      codigos: codigosDe(f.codigo, f.celeste),
      opciones: [],
      nombres: nombresDe(f.codigo),
    });
  }

  return { productos };
}

/**
 * Fila 10 de la spec: la carga de Journaway no pisa productos de otro
 * catálogo. Un código de la planilla que ya existe en la base y no tiene
 * ningún código de Journaway corta todo, sin escribir.
 */
export function verificarOtroCatalogo(codigos: string[], existentes: Array<{ codigo: string; deJournaway: boolean }>): void {
  const ajenos = existentes.filter((e) => codigos.includes(e.codigo) && !e.deJournaway).map((e) => e.codigo);
  if (ajenos.length) {
    throw new Error(`${ajenos.map((c) => `${c} ya es un producto de otro catálogo`).join("; ")}. No se cargó nada.`);
  }
}
