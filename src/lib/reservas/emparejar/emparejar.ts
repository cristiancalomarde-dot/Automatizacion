import type { FilaLlamadaIA } from "@/lib/ia/registro-llamadas";
import type { OrigenEmparejado } from "../tipos";
import { lectorDe, LECTORES_POR_AGENCIA, type LectorDeAgencia } from "./agencias";
import type { CatalogoParaEmparejar, ProductoDeLista } from "./catalogo";
import { MOTIVOS_EMPAREJADO as M } from "./motivos";
import { buscarNoCargado, type ProductoNoCargado } from "./productos-no-cargados";

/**
 * Reconocer el producto de lo que pidió una agencia (spec M2-03 filas 1-7 y
 * 15). Tres pasos, en orden, y nunca se adivina:
 *
 * 1. **Código exacto** de ESA agencia en `codigo_externo` (con el lector de la
 *    agencia: Kilroy saca el envoltorio). Si el mail trae código y no está
 *    cargado, el producto no está en el catálogo: no se llama a la IA.
 * 2. **Nombre de la agencia**: igual al `nombre_externo` de ESA agencia después
 *    de ignorar mayúsculas, espacios dobles y acentos. Nada de "contiene".
 * 3. **Propuesta de la IA** (solo sin código): elige de la lista cerrada del
 *    catálogo, o "ninguno". Se acepta con confianza ≥ 0,9 y, en un tour, si
 *    sus noches coinciden con las fechas del mail.
 *
 * Un producto conocido que todavía no está cargado (`data/productos-no-cargados.csv`,
 * owner 2026-10-14) se reconoce en el paso 1 o 2 y queda para revisión sin IA.
 * TourRadar manda el número de tour: un número que no está cargado sigue por
 * el nombre y la IA (`siguePorNombreSinCodigo`).
 *
 * Los pasos 1 y 2 son gratis y van primero (#3). Esta función no escribe en
 * ningún lado (fila 16): lo que aprende la IA no se guarda como código.
 */

/** Umbral para aceptar la propuesta de la IA (`integraciones-ia.md`). Se ajusta con el modo prueba (M2-06). */
export const UMBRAL_CONFIANZA_PRODUCTO = 0.9;

export interface PedidoDeProducto {
  /** El nombre del producto tal como lo escribe la agencia. */
  nombre: string;
  /** El código tal como lo escribe la agencia, si lo trae. */
  codigo: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export type ResultadoPropuesta =
  | { tipo: "respuesta"; codigo: string | null; confianza: number; motivo: string }
  | { tipo: "fallo"; causa: "techo" | "error" | "invalida" | "cortada" | "grande" };

/** El paso 3, inyectado: la IA real (`propuesta-ia.ts`) o una simulada en los tests. */
export type ProponerProducto = (entrada: {
  lista: ProductoDeLista[];
  pedido: PedidoDeProducto;
  agencia: string;
}) => Promise<{ resultado: ResultadoPropuesta; llamada: FilaLlamadaIA | null; costo: number }>;

export interface ContextoEmparejado {
  agencia: string;
  catalogo: CatalogoParaEmparejar;
  /** Sin esto no hay paso 3 (la reserva queda para revisión). */
  proponer?: ProponerProducto;
  lectores?: Readonly<Record<string, LectorDeAgencia>>;
  /** Productos conocidos que todavía no están cargados (`data/productos-no-cargados.csv`). */
  noCargados?: readonly ProductoNoCargado[];
}

export interface ResultadoEmparejado {
  producto: ProductoDeLista | null;
  origen: OrigenEmparejado | null;
  confianza: number | null;
  /** Lo que propuso la IA y no se aceptó. */
  sugerencia: { producto: ProductoDeLista; confianza: number } | null;
  /** Por qué no se reconoció (null si se reconoció). */
  motivo: string | null;
  /** La llamada a la IA, para registrarla con la reserva (`ia_llamada`). */
  llamada: FilaLlamadaIA | null;
  costo: number;
}

/** Para comparar nombres: sin acentos, en minúscula y con los espacios de más colapsados. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function nochesEntre(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null;
  const d = Date.parse(`${desde}T00:00:00Z`);
  const h = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(d) || Number.isNaN(h)) return null;
  return Math.round((h - d) / 86_400_000);
}

const sinReconocer = (motivo: string, extra: Partial<ResultadoEmparejado> = {}): ResultadoEmparejado => ({
  producto: null,
  origen: null,
  confianza: null,
  sugerencia: null,
  motivo,
  llamada: null,
  costo: 0,
  ...extra,
});

/** Paso 1: códigos que el lector de la agencia saca del mail, contra las filas de esa agencia. */
function porCodigo(ctx: ContextoEmparejado, candidatos: string[]): ProductoDeLista | null {
  for (const candidato of candidatos) {
    const fila = ctx.catalogo.codigos.find((c) => c.agencia === ctx.agencia && c.codigo === candidato);
    const producto = fila && ctx.catalogo.productos.find((p) => p.id === fila.productoId);
    if (producto) return producto;
  }
  return null;
}

/** Paso 2: el nombre guardado de esa agencia, igual después de normalizar. Ambiguo = no hay. */
function porNombre(ctx: ContextoEmparejado, nombre: string): ProductoDeLista | null {
  const buscado = normalizarNombre(nombre);
  if (!buscado) return null;
  const ids = new Set(
    ctx.catalogo.codigos
      .filter((c) => c.agencia === ctx.agencia && c.nombreExterno && normalizarNombre(c.nombreExterno) === buscado)
      .map((c) => c.productoId),
  );
  if (ids.size !== 1) return null;
  const [id] = ids;
  return ctx.catalogo.productos.find((p) => p.id === id) ?? null;
}

export async function emparejarProducto(pedido: PedidoDeProducto, ctx: ContextoEmparejado): Promise<ResultadoEmparejado> {
  const lector = lectorDe(ctx.agencia, ctx.lectores ?? LECTORES_POR_AGENCIA);
  const codigo = lector.usaCodigo ? (pedido.codigo?.trim() ?? "") : "";
  const nombre = pedido.nombre.trim() || codigo;

  const noCargado = (p: ProductoNoCargado) => sinReconocer(M.productoNoCargado(p.codigo, p.nombre));

  // Paso 1 — código exacto. Un código que no está es un producto no cargado: sin IA (fila 5).
  if (codigo) {
    const candidatos = lector.codigosCandidatos(codigo);
    const producto = porCodigo(ctx, candidatos);
    if (producto) return { ...sinReconocer(""), producto, origen: "codigo", confianza: 1, motivo: null };
    const conocido = buscarNoCargado(ctx.noCargados ?? [], ctx.agencia, { codigos: [...candidatos, codigo], nombre: null });
    if (conocido) return noCargado(conocido);
    if (!lector.siguePorNombreSinCodigo) return sinReconocer(M.codigoNoCargado(codigo, pedido.nombre.trim() || null));
  }

  // Paso 2 — sin código: el nombre que usa la agencia.
  const producto = porNombre(ctx, nombre);
  if (producto) return { ...sinReconocer(""), producto, origen: "nombre", confianza: 1, motivo: null };
  const conocido = buscarNoCargado(ctx.noCargados ?? [], ctx.agencia, { codigos: [], nombre });
  if (conocido) return noCargado(conocido);

  // Paso 3 — la IA, con la lista cerrada.
  if (!ctx.proponer) return sinReconocer(M.iaNoDisponible(nombre));
  const lista = ctx.catalogo.productos;
  const { resultado, llamada, costo } = await ctx.proponer({ lista, pedido, agencia: ctx.agencia });
  const conLlamada = { llamada, costo };

  if (resultado.tipo === "fallo") {
    const motivo =
      resultado.causa === "techo"
        ? M.techo
        : resultado.causa === "error"
          ? M.iaNoRespondio
          : M.iaInvalida(nombre);
    return sinReconocer(motivo, conLlamada);
  }

  if (resultado.codigo === null) {
    const motivo = resultado.confianza >= UMBRAL_CONFIANZA_PRODUCTO ? M.noEstaEnCatalogo(nombre) : M.noSeguro(nombre);
    return sinReconocer(motivo, conLlamada);
  }

  const propuesto = lista.find((p) => p.codigo === resultado.codigo);
  if (!propuesto) return sinReconocer(M.codigoFueraDeLista(nombre), conLlamada);

  const sugerencia = { producto: propuesto, confianza: resultado.confianza };
  if (resultado.confianza < UMBRAL_CONFIANZA_PRODUCTO) {
    return sinReconocer(M.noSeguro(nombre, { codigo: propuesto.codigo, confianza: resultado.confianza }), {
      ...conLlamada,
      sugerencia,
    });
  }

  const nochesMail = nochesEntre(pedido.fechaInicio, pedido.fechaFin);
  if (propuesto.esTour && propuesto.noches !== null && nochesMail !== null && propuesto.noches !== nochesMail) {
    return sinReconocer(M.nochesNoCoinciden(nombre, propuesto.codigo, propuesto.noches, nochesMail), {
      ...conLlamada,
      sugerencia,
    });
  }

  return {
    producto: propuesto,
    origen: "ia",
    confianza: resultado.confianza,
    sugerencia: null,
    motivo: null,
    ...conLlamada,
  };
}
