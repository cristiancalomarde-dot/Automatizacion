import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import {
  leerSeccion1,
  nivelesConPrecioEnResumen,
  ubicarBloquesEnHoja,
  type CodigoDuplicado,
  type CodigoNoUbicado,
  type CorreccionAplicada,
  type Filas,
} from "./bloque";
import { HOJA_PAQUETES } from "./importar";
import type { TipoServicio } from "./linea";
import type { NivelConfirmado } from "./niveles-confirmados";
import type { PaquetePiloto } from "./paquetes-piloto";
import { MOTIVO_ALOJAMIENTO_SIN_NIVEL, MOTIVO_NIVEL_AMBIGUO, planificarBloques } from "./plan";
import { crearIndiceProveedores, resolverProveedor, type IndiceProveedores } from "./proveedores";
import { clienteSoloLectura } from "./solo-lectura";

/**
 * Diagnóstico de paquetes, modo "solo leer" (spec M1-04c).
 *
 * Corre el mismo análisis que el importador de productos (M1-04 / M1-04b):
 * ubica el bloque de cada código de la lista, lee sus servicios, niveles y
 * prioridades con las mismas reglas, y empareja cada Booking Supplier contra
 * el directorio (`proveedor`) y las equivalencias (`proveedor_alias`). Pero
 * no escribe nada en ninguna tabla: el cliente va envuelto en
 * `clienteSoloLectura` (y quien lo llama, además, le pasa `fetchSoloLectura`).
 *
 * Tampoco llama a la IA (aunque haya clave): cada llamada se registra en
 * `uso_ia`, que es una escritura. Lista los bloques y líneas que la habrían
 * necesitado.
 *
 * Las sugerencias de proveedor por parecido de nombre son solo eso: van al
 * reporte para que el owner elija; nunca se aplican ni se guardan.
 */

export type Emparejado =
  | "exacto"
  | "por_equivalencia"
  | "equivalencia_para_revisar"
  | "sin_emparejar"
  | "sin_booking_supplier";

export interface OpcionDiagnostico {
  prioridad: number;
  serviceProvider: string;
  bookingSupplier: string | null;
  emparejado: Emparejado;
  /** Nombre del proveedor del directorio con el que emparejó (si emparejó). */
  proveedorDirectorio: string | null;
  nota: string | null;
}

export interface ServicioDiagnostico {
  /** Fila del Excel de la línea (1-based). */
  fila: number;
  tipo: TipoServicio;
  nivel: string | null;
  noches: number | null;
  /** La línea del Excel tal cual (más su "Includes: …"). */
  linea: string;
  opciones: OpcionDiagnostico[];
}

export interface PaqueteDiagnostico {
  codigo: string;
  /** Destino según la lista (data/paquetes-piloto.csv). */
  destino: string;
  /** Destino que dice la columna A del Excel en la fila del título; null si no dice. */
  destinoExcel: string | null;
  encontrado: boolean;
  nombre: string | null;
  /** Celda del título del bloque ("B480"). */
  celda: string | null;
  /** El bloque está pero no calza con la estructura esperada: sus servicios no se leyeron. */
  bloqueNoCalza: boolean;
  servicios: ServicioDiagnostico[];
  /** Niveles sin proveedor y sin precio: se toman como no ofrecidos (como el Budget de OD010A). */
  nivelesNoOfrecidos: string[];
  correcciones: CorreccionAplicada[];
  /** El código aparece en RutasenBus (hoja "Tours 2027"); null = no se revisó. */
  enRutasEnBus: boolean | null;
}

export interface SugerenciaProveedor {
  nombre: string;
  ciudad: string | null;
  /** 0-1: qué tanto se parece el nombre. Es solo una sugerencia; no se aplica. */
  parecido: number;
}

export interface Donde {
  codigo: string;
  fila: number;
}

export interface ItemsAConfirmar {
  proveedoresSinEmparejar: Array<{
    nombre: string;
    paquetes: string[];
    nota: string | null;
    sugerencias: SugerenciaProveedor[];
  }>;
  equivalenciasParaRevisar: Array<{ nombre: string; proveedorDirectorio: string | null; paquetes: string[]; nota: string | null }>;
  serviciosSinBookingSupplier: Array<{ linea: string; donde: Donde[] }>;
  alojamientosSinNivel: Array<{ codigo: string; lineas: Array<{ fila: number; texto: string }>; nivelesDeLaTabla: string[] }>;
  nivelesSoloEnPrecios: Array<{ codigo: string; nivel: string }>;
  lineasNoEntendidas: Array<{ texto: string; motivo: string; donde: Donde[] }>;
  bloquesNoEncontrados: CodigoNoUbicado[];
  bloquesDuplicados: CodigoDuplicado[];
  bloquesQueNoCalzan: string[];
  destinosAConfirmar: Array<{ codigo: string; destinoLista: string; destinoExcel: string | null }>;
  nivelesConfirmadosSinLinea: NivelConfirmado[];
}

export interface Diagnostico {
  generado: string;
  archivo: string;
  hoja: string;
  paquetes: PaqueteDiagnostico[];
  omitidosPorYaCargados: string[];
  aConfirmar: ItemsAConfirmar;
  habriaNecesitadoIA: Array<{ codigo: string; bloqueEntero: boolean; lineas: Array<{ fila: number; texto: string }> }>;
  /** Códigos de la lista que no aparecen en RutasenBus; null = no se revisó. */
  codigosAusentesEnRutas: string[] | null;
}

export interface ProveedorDirectorio {
  id: string;
  nombre: string;
  nombre_normalizado: string;
  ciudad: string | null;
}

// --- sugerencias por parecido (solo para el reporte) ------------------------

const PALABRAS_GENERICAS = new Set([
  "hotel", "hostel", "hostal", "hosteria", "the", "de", "del", "la", "las", "el", "los", "y", "and", "o",
]);

function simplificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function palabras(texto: string): string[] {
  return simplificar(texto)
    .split(" ")
    .filter((p) => p.length >= 3 && !PALABRAS_GENERICAS.has(p));
}

function bigramas(texto: string): string[] {
  const t = simplificar(texto).replace(/ /g, "");
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  const ba = bigramas(a);
  const bb = bigramas(b);
  if (!ba.length || !bb.length) return 0;
  const resto = [...bb];
  let comunes = 0;
  for (const x of ba) {
    const i = resto.indexOf(x);
    if (i !== -1) {
      comunes++;
      resto.splice(i, 1);
    }
  }
  return (2 * comunes) / (ba.length + bb.length);
}

function contencion(nombre: string, candidato: string): number {
  const propias = palabras(nombre);
  if (!propias.length) return 0;
  const ajenas = palabras(candidato);
  const coincide = (p: string) => ajenas.some((q) => q === p || (p.length >= 4 && q.length >= 4 && (q.startsWith(p) || p.startsWith(q))));
  return propias.filter(coincide).length / propias.length;
}

const PARECIDO_MINIMO = 0.35;
const MAXIMO_SUGERENCIAS = 3;

export function sugerirProveedores(nombre: string, directorio: ProveedorDirectorio[]): SugerenciaProveedor[] {
  return directorio
    .map((p) => ({
      nombre: p.nombre,
      ciudad: p.ciudad,
      parecido: Math.round((0.5 * dice(nombre, p.nombre) + 0.5 * contencion(nombre, p.nombre)) * 100) / 100,
    }))
    .filter((s) => s.parecido >= PARECIDO_MINIMO)
    .sort((a, b) => b.parecido - a.parecido || a.nombre.localeCompare(b.nombre))
    .slice(0, MAXIMO_SUGERENCIAS);
}

// --- emparejado (mismo criterio que el importador) -------------------------

function emparejar(
  nombre: string | null,
  indice: IndiceProveedores,
  nombrePorId: Map<string, string>,
): Pick<OpcionDiagnostico, "emparejado" | "proveedorDirectorio" | "nota"> {
  if (!nombre) return { emparejado: "sin_booking_supplier", proveedorDirectorio: null, nota: null };
  const exactos = indice.exactos.get(normalizarNombre(nombre));
  if (exactos && exactos.length === 1) {
    return { emparejado: "exacto", proveedorDirectorio: nombrePorId.get(exactos[0]) ?? null, nota: null };
  }
  const r = resolverProveedor(nombre, indice);
  const alias = indice.alias.get(normalizarNombre(nombre));
  const nota =
    alias?.nota ??
    (exactos && exactos.length > 1 ? `El directorio tiene ${exactos.length} proveedores con este mismo nombre` : null);
  if (r.id === null) return { emparejado: "sin_emparejar", proveedorDirectorio: null, nota };
  return {
    emparejado: r.paraRevisar ? "equivalencia_para_revisar" : "por_equivalencia",
    proveedorDirectorio: nombrePorId.get(r.id) ?? null,
    nota: r.paraRevisar ? nota : null,
  };
}

// --- lecturas (solo select) ------------------------------------------------

async function leerTodo<T>(admin: SupabaseClient, tabla: string, columnas: string): Promise<T[]> {
  const { data, error } = await admin.from(tabla).select(columnas).range(0, 9999);
  if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`);
  return (data ?? []) as T[];
}

function agregarDonde<T extends { donde: Donde[] }>(lista: Map<string, T>, clave: string, nuevo: () => T, donde: Donde) {
  const item = lista.get(clave) ?? nuevo();
  if (!item.donde.some((d) => d.codigo === donde.codigo && d.fila === donde.fila)) item.donde.push(donde);
  lista.set(clave, item);
}

export async function diagnosticarPaquetes(opciones: {
  admin: SupabaseClient;
  filas: Filas;
  archivo: string;
  paquetes: PaquetePiloto[];
  nivelesConfirmados?: NivelConfirmado[];
  /** Saltear los códigos que ya son productos en la base (ej. los 5 de Iguazú). */
  omitirCargados?: boolean;
  /** Filas de RutasenBus (hoja "Tours 2027"), para confirmar que cada código sale de ahí. */
  filasRutas?: Filas | null;
}): Promise<Diagnostico> {
  const admin = clienteSoloLectura(opciones.admin);
  const { filas } = opciones;
  const nivelesConfirmados = opciones.nivelesConfirmados ?? [];

  let paquetes = opciones.paquetes;
  const omitidosPorYaCargados: string[] = [];
  if (opciones.omitirCargados) {
    const cargados = new Set(
      (await leerTodo<{ codigo: string }>(admin, "producto", "codigo")).map((p) => p.codigo),
    );
    omitidosPorYaCargados.push(...paquetes.filter((p) => cargados.has(p.codigo)).map((p) => p.codigo));
    paquetes = paquetes.filter((p) => !cargados.has(p.codigo));
  }

  const directorio = await leerTodo<ProveedorDirectorio>(admin, "proveedor", "id, nombre, nombre_normalizado, ciudad");
  const alias = await leerTodo<{
    alias_normalizado: string;
    proveedor_id: string | null;
    estado: "confirmado" | "para_revisar";
    nota: string | null;
  }>(admin, "proveedor_alias", "alias_normalizado, proveedor_id, estado, nota");
  const indice = crearIndiceProveedores(directorio, alias);
  const nombrePorId = new Map(directorio.map((p) => [p.id, p.nombre]));

  const ubicacion = ubicarBloquesEnHoja(filas, paquetes);
  const plan = await planificarBloques({
    filas,
    bloques: ubicacion.ubicados.map((u) => ({ bloque: u.bloque, rango: u.rango })),
    interpretarIA: null,
    nivelesConfirmados,
  });
  const ubicadoPorCodigo = new Map(ubicacion.ubicados.map((u) => [u.bloque.codigo, u]));
  const planPorCodigo = new Map(plan.productos.map((p) => [p.codigo, p]));

  const textoRutas = opciones.filasRutas ? opciones.filasRutas.map((f) => f.join(" ")).join("\n") : null;
  const enRutas = (codigo: string) =>
    textoRutas === null ? null : new RegExp(`(?<![A-Za-z0-9])${codigo}(?![A-Za-z0-9])`).test(textoRutas);

  const sinEmparejar = new Map<string, ItemsAConfirmar["proveedoresSinEmparejar"][number]>();
  const paraRevisar = new Map<string, ItemsAConfirmar["equivalenciasParaRevisar"][number]>();
  const sinBS = new Map<string, ItemsAConfirmar["serviciosSinBookingSupplier"][number]>();
  const noEntendidas = new Map<string, ItemsAConfirmar["lineasNoEntendidas"][number]>();
  const aConfirmar: ItemsAConfirmar = {
    proveedoresSinEmparejar: [],
    equivalenciasParaRevisar: [],
    serviciosSinBookingSupplier: [],
    alojamientosSinNivel: [],
    nivelesSoloEnPrecios: [],
    lineasNoEntendidas: [],
    bloquesNoEncontrados: ubicacion.noUbicados,
    bloquesDuplicados: ubicacion.duplicados,
    bloquesQueNoCalzan: [],
    destinosAConfirmar: [],
    nivelesConfirmadosSinLinea: [],
  };
  const habriaNecesitadoIA: Diagnostico["habriaNecesitadoIA"] = [];

  const resultado: PaqueteDiagnostico[] = paquetes.map(({ codigo, destino }) => {
    const u = ubicadoPorCodigo.get(codigo);
    const p = planPorCodigo.get(codigo);
    if (!u || !p) {
      return {
        codigo,
        destino,
        destinoExcel: null,
        encontrado: false,
        nombre: null,
        celda: null,
        bloqueNoCalza: false,
        servicios: [],
        nivelesNoOfrecidos: [],
        correcciones: [],
        enRutasEnBus: enRutas(codigo),
      };
    }
    if (u.destinoExcel !== destino) {
      aConfirmar.destinosAConfirmar.push({ codigo, destinoLista: destino, destinoExcel: u.destinoExcel });
    }

    const servicios: ServicioDiagnostico[] = p.servicios.map((s) => ({
      fila: s.fila,
      tipo: s.tipo,
      nivel: s.nivel,
      noches: s.noches,
      linea: s.descripcion,
      opciones: s.opciones.map((o) => ({
        prioridad: o.prioridad,
        serviceProvider: o.serviceProvider,
        bookingSupplier: o.bookingSupplier,
        ...emparejar(o.bookingSupplier, indice, nombrePorId),
      })),
    }));

    for (const s of servicios) {
      for (const o of s.opciones) {
        if (o.emparejado === "sin_booking_supplier") {
          const linea = s.linea.split("\n")[0];
          agregarDonde(sinBS, normalizarNombre(linea), () => ({ linea, donde: [] }), { codigo, fila: s.fila });
        } else if (o.emparejado === "sin_emparejar") {
          const clave = normalizarNombre(o.bookingSupplier!);
          const item = sinEmparejar.get(clave) ?? {
            nombre: o.bookingSupplier!,
            paquetes: [],
            nota: o.nota,
            sugerencias: sugerirProveedores(o.bookingSupplier!, directorio),
          };
          if (!item.paquetes.includes(codigo)) item.paquetes.push(codigo);
          sinEmparejar.set(clave, item);
        } else if (o.emparejado === "equivalencia_para_revisar") {
          const clave = normalizarNombre(o.bookingSupplier!);
          const item = paraRevisar.get(clave) ?? {
            nombre: o.bookingSupplier!,
            proveedorDirectorio: o.proveedorDirectorio,
            paquetes: [],
            nota: o.nota,
          };
          if (!item.paquetes.includes(codigo)) item.paquetes.push(codigo);
          paraRevisar.set(clave, item);
        }
      }
    }

    // Alojamientos sin nivel escrito, con los niveles que nombra la tabla de precios.
    const sinNivel = p.nivelesParaRevisar.filter((n) => n.motivo === MOTIVO_ALOJAMIENTO_SIN_NIVEL);
    if (sinNivel.length) {
      aConfirmar.alojamientosSinNivel.push({
        codigo,
        lineas: sinNivel.map((n) => ({ fila: n.fila!, texto: n.texto! })),
        nivelesDeLaTabla: p.nivelesParaRevisar
          .filter((n) => n.motivo === MOTIVO_NIVEL_AMBIGUO && n.nivel !== null)
          .map((n) => n.nivel!),
      });
    }

    // Niveles sin línea de alojamiento: con precio en la tabla → se pregunta;
    // sin precio (o confirmados como no ofrecidos por el owner) → no ofrecidos.
    const lectura = leerSeccion1(filas, u.bloque, u.rango);
    const conPrecio = new Set(nivelesConPrecioEnResumen(filas, u.bloque, u.rango, lectura.filaFin));
    const confirmadosNo = new Set(
      nivelesConfirmados.filter((c) => c.producto === codigo && !c.ofrecido).map((c) => c.nivel),
    );
    const nivelesNoOfrecidos: string[] = [];
    for (const nivel of p.nivelesNoOfrecidos) {
      if (conPrecio.has(nivel) && !confirmadosNo.has(nivel)) aConfirmar.nivelesSoloEnPrecios.push({ codigo, nivel });
      else nivelesNoOfrecidos.push(nivel);
    }

    for (const l of p.lineasParaRevisar) {
      agregarDonde(noEntendidas, normalizarNombre(l.texto), () => ({ texto: l.texto, motivo: l.motivo, donde: [] }), {
        codigo,
        fila: l.fila,
      });
    }
    if (p.bloqueParaRevisar) aConfirmar.bloquesQueNoCalzan.push(codigo);
    aConfirmar.nivelesConfirmadosSinLinea.push(...p.nivelesConfirmadosSinLinea);
    if (plan.bloquesQueNecesitanIA.includes(codigo)) {
      habriaNecesitadoIA.push({
        codigo,
        bloqueEntero: p.bloqueParaRevisar,
        lineas: p.lineasParaRevisar.map((l) => ({ fila: l.fila, texto: l.texto })),
      });
    }

    return {
      codigo,
      destino,
      destinoExcel: u.destinoExcel,
      encontrado: true,
      nombre: p.nombre,
      celda: u.celda,
      bloqueNoCalza: p.bloqueParaRevisar,
      servicios,
      nivelesNoOfrecidos,
      correcciones: p.correcciones,
      enRutasEnBus: enRutas(codigo),
    };
  });

  const porNombre = <T extends { nombre: string }>(a: T, b: T) => a.nombre.localeCompare(b.nombre);
  aConfirmar.proveedoresSinEmparejar = [...sinEmparejar.values()].sort(porNombre);
  aConfirmar.equivalenciasParaRevisar = [...paraRevisar.values()].sort(porNombre);
  aConfirmar.serviciosSinBookingSupplier = [...sinBS.values()];
  aConfirmar.lineasNoEntendidas = [...noEntendidas.values()];

  return {
    generado: new Date().toISOString(),
    archivo: opciones.archivo,
    hoja: HOJA_PAQUETES,
    paquetes: resultado,
    omitidosPorYaCargados,
    aConfirmar,
    habriaNecesitadoIA,
    codigosAusentesEnRutas: textoRutas === null ? null : resultado.filter((p) => !p.enRutasEnBus).map((p) => p.codigo),
  };
}

