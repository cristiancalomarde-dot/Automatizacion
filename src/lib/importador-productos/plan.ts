import { limpiarNombre } from "@/lib/importador-proveedores/nombre";
import { UMBRAL_CONFIANZA_IA } from "@/lib/importador-proveedores/resolver";
import {
  leerSeccion1,
  nivelesDelResumen,
  textoDelBloque,
  ubicarBloques,
  ubicarDestino,
  type Filas,
  type LineaDudosa,
  type CorreccionAplicada,
  type NivelSinProveedor,
} from "./bloque";
import { nivelDeAlojamiento, type ServicioLeido, type TipoServicio } from "./linea";
import { aplicarNivelesConfirmados, type NivelConfirmado } from "./niveles-confirmados";

/**
 * De la hoja a "qué productos y servicios cargar" (spec M1-04 §3 #1, #3,
 * #10), sin tocar la base: reglas simples primero; la IA solo interpreta el
 * bloque puntual (o las líneas puntuales) que las reglas no resuelven, y lo
 * que tampoco resuelve con confianza queda "para revisar".
 *
 * Guardas sobre la respuesta de la IA (nunca se inventa un dato):
 * - confianza global ≥ UMBRAL_CONFIANZA_IA (el mismo 0,8 de M1-03);
 * - cada línea que la IA dice interpretar tiene que existir en el bloque;
 * - cada Service Provider / Booking Supplier tiene que estar escrito literal
 *   en esa línea.
 */

export interface ConsultaBloqueIA {
  codigo: string;
  nombre: string;
  /** Sección 1 del bloque como texto ("B5: …"), sin números de costos. */
  textoBloque: string;
  /** `null` = interpretar el bloque entero (no calza su estructura); si no, solo estas líneas. */
  lineasDudosas: string[] | null;
}

export interface ServicioIA {
  /** La línea del bloque de la que sale el servicio, tal cual. */
  linea: string;
  tipo: TipoServicio;
  opciones: Array<{ service_provider: string; booking_supplier: string | null }>;
}

export interface RespuestaBloqueIA {
  servicios: ServicioIA[];
  /** Líneas consultadas que NO son un servicio (ej. una categoría sin proveedor). */
  lineas_sin_servicio: string[];
  confianza: number;
}

/** `null` = no se llamó a la IA (no configurada, techo de gasto agotado o error). */
export type InterpretarBloque = (consulta: ConsultaBloqueIA) => Promise<RespuestaBloqueIA | null>;

export interface ProductoPlaneado {
  codigo: string;
  nombre: string;
  destino: string;
  ciudades: string[];
  servicios: ServicioLeido[];
  lineasParaRevisar: LineaDudosa[];
  /** El bloque no calza y nadie lo pudo interpretar: el producto se crea, sus servicios no se tocan. */
  bloqueParaRevisar: boolean;
  /** Niveles de alojamiento que no quedan identificables con su proveedor (para revisar). */
  nivelesParaRevisar: NivelParaRevisar[];
  /**
   * Niveles que figuran solo en la tabla de precios / el resumen, sin línea
   * "Accommodation … Booking Supplier": el owner los dejó vacantes a propósito
   * (ej. Budget Hotel de OD010A). No se cargan ni van a revisar; se reportan.
   */
  nivelesNoOfrecidos: string[];
  /** Correcciones de tipeo aplicadas por las reglas (ej. "7" leído como "/"). */
  correcciones: CorreccionAplicada[];
  /** Niveles confirmados (M1-04b) de este producto cuya línea no apareció en el bloque: para revisar el archivo. */
  nivelesConfirmadosSinLinea: NivelConfirmado[];
  origen: "reglas" | "ia" | "reglas+ia";
}

export interface NivelParaRevisar {
  /** Etiqueta del nivel, si el Excel la escribe. */
  nivel: string | null;
  /** Fila del Excel (1-based) de la línea; null si el nivel solo aparece en el resumen. */
  fila: number | null;
  texto: string | null;
  motivo: string;
}

export const MOTIVO_ALOJAMIENTO_SIN_NIVEL = "alojamiento sin etiqueta de nivel escrita en la línea";
export const MOTIVO_NIVEL_AMBIGUO =
  "nivel del resumen que puede corresponder a una línea de alojamiento sin etiqueta";

/**
 * Niveles de alojamiento del bloque (indicación del owner, 2026-09-27):
 * producto → niveles → opciones "/" en orden de prioridad.
 * - Nivel con línea "Accommodation … Booking Supplier" → se carga (servicios).
 * - Alojamiento cuya línea no escribe el nivel → para revisar.
 * - Nivel que figura solo en la tabla de precios o en el resumen (sin línea
 *   con proveedor) → NO ofrecido (vacante a propósito). Excepción: si el
 *   bloque tiene alojamientos sin etiqueta, un nivel del resumen podría ser
 *   uno de ellos → para revisar, no se lo da por no ofrecido.
 */
function clasificarNiveles(
  servicios: ServicioLeido[],
  sinProveedor: NivelSinProveedor[],
  delResumen: string[],
): { paraRevisar: NivelParaRevisar[]; noOfrecidos: string[] } {
  const paraRevisar: NivelParaRevisar[] = [];
  const filasVistas = new Set<number>();
  for (const s of servicios) {
    if (s.tipo !== "alojamiento" || s.nivel !== null || filasVistas.has(s.fila)) continue;
    filasVistas.add(s.fila);
    paraRevisar.push({
      nivel: null,
      fila: s.fila,
      texto: s.descripcion.split("\n")[0],
      motivo: MOTIVO_ALOJAMIENTO_SIN_NIVEL,
    });
  }
  const hayAlojamientosSinNivel = filasVistas.size > 0;
  const cargados = new Set(servicios.map((s) => s.nivel).filter((n): n is string => n !== null));

  const noOfrecidos: string[] = [];
  for (const nivel of [...sinProveedor.map((n) => n.nivel), ...delResumen]) {
    if (cargados.has(nivel) || noOfrecidos.includes(nivel) || paraRevisar.some((p) => p.nivel === nivel)) continue;
    if (hayAlojamientosSinNivel) {
      paraRevisar.push({ nivel, fila: null, texto: null, motivo: MOTIVO_NIVEL_AMBIGUO });
    } else {
      noOfrecidos.push(nivel);
    }
  }
  return { paraRevisar, noOfrecidos };
}

export interface Plan {
  destinoEncontrado: boolean;
  productos: ProductoPlaneado[];
  codigosNoEncontrados: string[];
  /** Códigos cuyo bloque no calzó entero con las reglas (se le pidió o se le habría pedido a la IA). */
  bloquesQueNecesitanIA: string[];
  lineasDescartadasPorIA: Array<{ codigo: string; fila: number; texto: string }>;
}

const TIPOS_VALIDOS: TipoServicio[] = ["alojamiento", "excursion", "traslado", "bus", "crucero", "otro"];

function norm(texto: string): string {
  return limpiarNombre(texto).toLowerCase();
}

/** Convierte un servicio de la IA en `ServicioLeido`, o `null` si no pasa las guardas. */
function servicioDeIA(s: ServicioIA, fila: number): ServicioLeido | null {
  if (!TIPOS_VALIDOS.includes(s.tipo) || !Array.isArray(s.opciones) || s.opciones.length === 0) return null;
  const linea = norm(s.linea);
  const opciones = [];
  for (const [i, o] of s.opciones.entries()) {
    const sp = limpiarNombre(o.service_provider ?? "");
    const bs = o.booking_supplier ? limpiarNombre(o.booking_supplier) : null;
    if (!sp || !linea.includes(sp.toLowerCase())) return null;
    if (bs && !linea.includes(bs.toLowerCase())) return null;
    opciones.push({ prioridad: i + 1, serviceProvider: sp, bookingSupplier: bs });
  }
  const antesDelBookingSupplier = s.linea.split(/booking supplier/i)[0];
  const nivel = s.tipo === "alojamiento" ? nivelDeAlojamiento(antesDelBookingSupplier) : null;
  return { tipo: s.tipo, descripcion: limpiarNombre(s.linea), noches: null, nivel, fila, opciones };
}

function confiable(r: RespuestaBloqueIA | null): r is RespuestaBloqueIA {
  return !!r && typeof r.confianza === "number" && r.confianza >= UMBRAL_CONFIANZA_IA && Array.isArray(r.servicios);
}

export async function planificarProductos(opciones: {
  filas: Filas;
  destino: string;
  codigos: string[];
  interpretarIA: InterpretarBloque | null;
  /** Niveles confirmados por el owner (data/niveles-confirmados.csv, spec M1-04b). */
  nivelesConfirmados?: NivelConfirmado[];
}): Promise<Plan> {
  const { filas, codigos, interpretarIA } = opciones;
  const nivelesConfirmados = opciones.nivelesConfirmados ?? [];
  const rango = ubicarDestino(filas, opciones.destino);
  if (!rango) {
    return {
      destinoEncontrado: false,
      productos: [],
      codigosNoEncontrados: [...codigos],
      bloquesQueNecesitanIA: [],
      lineasDescartadasPorIA: [],
    };
  }

  const { bloques, noEncontrados } = ubicarBloques(filas, rango, codigos);
  const productos: ProductoPlaneado[] = [];
  const bloquesQueNecesitanIA: string[] = [];
  const lineasDescartadasPorIA: Plan["lineasDescartadasPorIA"] = [];

  // Secuencial a propósito: cada llamada de IA pasa por el techo de gasto de a una.
  for (const bloque of bloques) {
    const leida = leerSeccion1(filas, bloque, rango);
    // Niveles confirmados antes de la IA: las líneas de un nivel no ofrecido
    // ni se le preguntan (M1-04b).
    const confirmados = aplicarNivelesConfirmados(bloque.codigo, leida, nivelesConfirmados);
    const lectura = { ...leida, servicios: confirmados.servicios, dudosas: confirmados.dudosas };
    const usados = new Set(confirmados.usados);
    const producto: ProductoPlaneado = {
      codigo: bloque.codigo,
      nombre: bloque.nombre,
      destino: bloque.destino,
      ciudades: [],
      servicios: lectura.servicios,
      lineasParaRevisar: lectura.dudosas,
      bloqueParaRevisar: false,
      nivelesParaRevisar: [],
      nivelesNoOfrecidos: [],
      correcciones: lectura.correcciones,
      nivelesConfirmadosSinLinea: [],
      origen: "reglas",
    };

    if (!lectura.estructuraOk) {
      // El bloque entero no calza (ej. columnas corridas): IA sobre el bloque, o para revisar.
      bloquesQueNecesitanIA.push(bloque.codigo);
      const textoBloque = textoDelBloque(filas, bloque, rango);
      const r = interpretarIA
        ? await interpretarIA({ codigo: bloque.codigo, nombre: bloque.nombre, textoBloque, lineasDudosas: null })
        : null;
      const servicios = confiable(r)
        ? r.servicios.map((s) => (norm(textoBloque).includes(norm(s.linea)) ? servicioDeIA(s, 0) : null))
        : null;
      if (servicios && servicios.length > 0 && servicios.every((s) => s !== null)) {
        producto.servicios = servicios as ServicioLeido[];
        producto.lineasParaRevisar = [];
        producto.origen = "ia";
      } else {
        producto.servicios = [];
        producto.lineasParaRevisar = [];
        producto.bloqueParaRevisar = true;
      }
    } else if (lectura.dudosas.length > 0) {
      // El bloque calza pero tiene líneas sueltas que no: IA solo sobre esas líneas.
      bloquesQueNecesitanIA.push(bloque.codigo);
      const r = interpretarIA
        ? await interpretarIA({
            codigo: bloque.codigo,
            nombre: bloque.nombre,
            textoBloque: textoDelBloque(filas, bloque, rango),
            lineasDudosas: lectura.dudosas.map((d) => d.texto),
          })
        : null;
      if (confiable(r)) {
        const pendientes: LineaDudosa[] = [];
        const agregados: ServicioLeido[] = [];
        for (const dudosa of lectura.dudosas) {
          const propios = r.servicios.filter((s) => norm(s.linea) === norm(dudosa.texto));
          const convertidos = propios.map((s) => servicioDeIA(s, dudosa.fila));
          if (propios.length > 0 && convertidos.every((s) => s !== null)) {
            agregados.push(...(convertidos as ServicioLeido[]));
          } else if (propios.length === 0 && r.lineas_sin_servicio?.some((l) => norm(l) === norm(dudosa.texto))) {
            lineasDescartadasPorIA.push({ codigo: bloque.codigo, fila: dudosa.fila, texto: dudosa.texto });
          } else {
            pendientes.push(dudosa);
          }
        }
        if (agregados.length || pendientes.length < lectura.dudosas.length) producto.origen = "reglas+ia";
        producto.servicios = [...lectura.servicios, ...agregados].sort((a, b) => a.fila - b.fila);
        producto.lineasParaRevisar = pendientes;
      }
    }

    if (!producto.bloqueParaRevisar) {
      // Lo que interpretó la IA también recibe su nivel confirmado.
      const trasIA = aplicarNivelesConfirmados(
        bloque.codigo,
        { servicios: producto.servicios, dudosas: [] },
        nivelesConfirmados,
      );
      producto.servicios = trasIA.servicios;
      trasIA.usados.forEach((c) => usados.add(c));
      const noOfrecidosConfirmados = [...confirmados.nivelesNoOfrecidos, ...trasIA.nivelesNoOfrecidos];

      const niveles = clasificarNiveles(
        producto.servicios,
        lectura.nivelesSinProveedor,
        nivelesDelResumen(filas, bloque, rango, lectura.filaFin),
      );
      producto.nivelesParaRevisar = niveles.paraRevisar.filter(
        (n) => !(n.fila === null && n.nivel !== null && noOfrecidosConfirmados.includes(n.nivel)),
      );
      const cargados = new Set(producto.servicios.map((s) => s.nivel));
      producto.nivelesNoOfrecidos = [
        ...new Set([...niveles.noOfrecidos, ...noOfrecidosConfirmados.filter((n) => !cargados.has(n))]),
      ];
    }
    producto.nivelesConfirmadosSinLinea = nivelesConfirmados.filter(
      (c) => c.producto === bloque.codigo && !usados.has(c),
    );
    productos.push(producto);
  }

  return {
    destinoEncontrado: true,
    productos,
    codigosNoEncontrados: noEncontrados,
    bloquesQueNecesitanIA,
    lineasDescartadasPorIA,
  };
}
