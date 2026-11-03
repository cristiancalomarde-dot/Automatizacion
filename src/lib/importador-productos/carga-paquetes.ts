import type { SupabaseClient } from "@supabase/supabase-js";
import { nochesBasePaquete } from "@/lib/importador-tours/noches-base";
import { cargarServiciosAPedido, type FilaAPedido, type ResumenAPedido } from "./a-pedido";
import { importarProductosSimples, leerFilasPaquetes, type ResumenImportacionProductos } from "./importar";
import type { NivelConfirmado } from "./niveles-confirmados";
import { cargarNochesServicio, type FilaNochesServicio, type ResumenNochesServicio } from "./noches-servicio";
import type { PaquetePiloto } from "./paquetes-piloto";
import type { InterpretarBloque } from "./plan";
import type { RenglonAgregado } from "./renglones-agregados";

/** `importacion.tipo_corrida` de la carga de los paquetes de los tours (M1-04d). */
export const TIPO_CORRIDA_PAQUETES = "paquetes-de-los-tours";

/**
 * Lo que la corrida dejó para revisar además de los proveedores (spec M1-04d
 * §3 #10): bloques no encontrados o que no calzan, renglones que no se
 * entendieron, alojamientos sin nivel y niveles confirmados que no
 * encontraron su línea. En lenguaje llano, una línea por punto.
 */
export function otrosPuntosDeLaCarga(r: ResumenImportacionProductos): string[] {
  const puntos: string[] = [];
  for (const c of r.codigosNoEncontrados) puntos.push(`${c}: no encontré su bloque en el Excel de paquetes.`);
  for (const p of r.productos) {
    if (p.bloqueParaRevisar) puntos.push(`${p.codigo}: el bloque no tiene la forma esperada; no cargué sus servicios.`);
    for (const l of p.lineasParaRevisar) {
      puntos.push(`${p.codigo} (fila ${l.fila}): no entendí el renglón “${l.texto}” (${l.motivo}); no lo cargué.`);
    }
    for (const n of p.nivelesParaRevisar) {
      puntos.push(
        n.fila !== null
          ? `${p.codigo} (fila ${n.fila}): el alojamiento “${n.texto}” no dice su categoría (Hostel, Budget, 3*, 4*).`
          : `${p.codigo}: la tabla de precios nombra “${n.nivel}”, que podría ser uno de los alojamientos sin categoría.`,
      );
    }
    for (const r of p.renglonesAgregadosYaEnElExcel ?? []) {
      puntos.push(`${p.codigo}: el renglón “${r}” ya está en el Excel; sacalo de data/renglones-agregados.csv.`);
    }
    for (const c of p.nivelesConfirmadosSinLinea) {
      puntos.push(`${p.codigo}: la categoría confirmada “${c.nivel}” no encontró su renglón (“${c.texto_linea}”).`);
    }
  }
  return puntos;
}

// --- M3-46: carga por lista y en seco -------------------------------------------------

export interface OpcionesCarga {
  /** `--codigos A,B`: solo esos. null = todos, como siempre. */
  codigos: string[] | null;
  /** `--en-seco`: muestra qué haría, sin escribir. */
  enSeco: boolean;
  /** Los argumentos sueltos (la ruta del Excel de paquetes). */
  posicionales: string[];
}

/** Las opciones de `importar:paquetes` e `importar:tours`. Una opción mal escrita corta: nunca corre todo por un error de tipeo. */
export function leerOpcionesCarga(argumentos: string[]): OpcionesCarga {
  const opciones: OpcionesCarga = { codigos: null, enSeco: false, posicionales: [] };
  const leerCodigos = (texto: string | undefined) => {
    const codigos = [...new Set((texto ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean))];
    if (codigos.length === 0 || (texto ?? "").startsWith("--")) throw new Error("--codigos necesita uno o más códigos: --codigos BR18 o --codigos ODBR15,COMPBR04.");
    return codigos;
  };
  for (let i = 0; i < argumentos.length; i++) {
    const a = argumentos[i];
    if (a === "--en-seco") opciones.enSeco = true;
    else if (a === "--codigos") opciones.codigos = leerCodigos(argumentos[++i]);
    else if (a.startsWith("--codigos=")) opciones.codigos = leerCodigos(a.slice("--codigos=".length));
    else if (a.startsWith("--")) throw new Error(`No conozco la opción ${a}. Las que hay: --codigos, --en-seco.`);
    else opciones.posicionales.push(a);
  }
  return opciones;
}

/** Los paquetes de esta corrida. Un código que no está en la lista corta, sin cargar nada. */
export function seleccionarPaquetes(lista: PaquetePiloto[], codigos: string[] | null): PaquetePiloto[] {
  if (!codigos) return lista;
  const faltan = codigos.filter((c) => !lista.some((p) => p.codigo === c));
  if (faltan.length) {
    throw new Error(`${faltan.join(", ")} no está en la lista de esta carga (data/paquetes-piloto.csv, sin los de Iguazú). No se cargó nada.`);
  }
  return lista.filter((p) => codigos.includes(p.codigo));
}

/**
 * El paquete, sus noches por servicio y sus marcas "a pedido": lo que corre
 * `npm run importar:paquetes`. Con `codigos` solo toca esos paquetes (también en
 * los códigos TourRadar, las noches y las marcas). Sin `codigos`, todo.
 *
 * `enSeco`: quien llama pasa un cliente en seco (`clienteEnSeco`). Las noches y
 * las marcas se controlan contra lo que hay en la base, así que las de un
 * paquete que todavía no existe quedan en `sinComprobar`.
 */
export async function correrCargaPaquetes(o: {
  admin: SupabaseClient;
  rutaPaquetes: string;
  rutaCodigosTourRadar: string | null;
  interpretarIA: InterpretarBloque | null;
  estadisticasIA?: () => { llamadas: number; cortadasPorTecho: number; errores: number };
  nivelesConfirmados: NivelConfirmado[];
  paquetes: PaquetePiloto[];
  renglonesAgregados: readonly RenglonAgregado[];
  nochesServicio: FilaNochesServicio[] | null;
  aPedido: FilaAPedido[] | null;
  codigos: string[] | null;
  enSeco?: boolean;
}): Promise<{
  resumen: ResumenImportacionProductos;
  paquetes: PaquetePiloto[];
  noches: ResumenNochesServicio | null;
  aPedido: ResumenAPedido | null;
  sinComprobar: string[];
}> {
  const paquetes = seleccionarPaquetes(o.paquetes, o.codigos);
  const elegidos = paquetes.map((p) => p.codigo);
  const deLaCorrida = <T extends { paquete: string }>(filas: readonly T[]) => (o.codigos ? filas.filter((f) => elegidos.includes(f.paquete)) : [...filas]);

  const resumen = await importarProductosSimples({
    admin: o.admin,
    rutaPaquetes: o.rutaPaquetes,
    rutaCodigosTourRadar: o.rutaCodigosTourRadar,
    interpretarIA: o.interpretarIA,
    estadisticasIA: o.estadisticasIA,
    nivelesConfirmados: o.nivelesConfirmados,
    paquetes,
    tipoCorrida: TIPO_CORRIDA_PAQUETES,
    renglonesAgregados: deLaCorrida(o.renglonesAgregados),
    tourRadarSoloDeLaCorrida: o.codigos !== null,
  });

  let nochesFilas = o.nochesServicio && deLaCorrida(o.nochesServicio);
  let aPedidoFilas = o.aPedido && deLaCorrida(o.aPedido);
  const sinComprobar: string[] = [];
  if (o.enSeco) {
    const pedidos = [...new Set([...(nochesFilas ?? []), ...(aPedidoFilas ?? [])].map((f) => f.paquete))];
    const { data, error } = await o.admin.from("producto").select("codigo").in("codigo", pedidos);
    if (error) throw new Error(`No se pudo leer producto: ${error.message}`);
    const enLaBase = new Set((data ?? []).map((p) => p.codigo as string));
    sinComprobar.push(...pedidos.filter((c) => !enLaBase.has(c)));
    nochesFilas = nochesFilas && nochesFilas.filter((f) => enLaBase.has(f.paquete));
    aPedidoFilas = aPedidoFilas && aPedidoFilas.filter((f) => enLaBase.has(f.paquete));
  }

  const filasHoja = leerFilasPaquetes(o.rutaPaquetes);
  const noches = nochesFilas
    ? await cargarNochesServicio({
        admin: o.admin,
        filas: nochesFilas,
        nochesPaquete: (codigo) => nochesBasePaquete(filasHoja, codigo),
      })
    : null;
  const aPedido = aPedidoFilas
    ? await cargarServiciosAPedido({ admin: o.admin, filas: aPedidoFilas, ...(o.codigos ? { soloPaquetes: elegidos } : {}) })
    : null;
  return { resumen, paquetes, noches, aPedido, sinComprobar };
}
