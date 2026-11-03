/**
 * Guardas del modo diagnóstico, "solo leer" (spec M1-04c §3 #3): el
 * diagnóstico de paquetes no escribe en ninguna tabla, ni siquiera en
 * `importacion`.
 *
 * - `clienteSoloLectura`: envuelve el cliente de Supabase; `from(t)` sigue
 *   leyendo, pero insert / update / upsert / delete (y `rpc`) tiran
 *   `EscrituraProhibida` antes de armar el pedido.
 * - `fetchSoloLectura`: el `fetch` que se le pasa al cliente; corta cualquier
 *   pedido que no sea GET o HEAD antes de que salga a la red. Es la red de
 *   seguridad por si alguien saltea la primera guarda.
 * - `clienteEnSeco` (M3-46): para correr un importador sin escribir. Las
 *   lecturas van a la base; las escrituras no salen, responden "ok" y quedan
 *   anotadas. Así corre el mismo código que la carga de verdad y el resumen
 *   dice qué haría. Se usa junto con `fetchSoloLectura`.
 */

export class EscrituraProhibida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "EscrituraProhibida";
  }
}

const METODOS_DE_ESCRITURA = new Set(["insert", "update", "upsert", "delete"]);
const PROHIBIDOS_EN_CLIENTE = new Set(["rpc"]);

function envolverConsulta(consulta: object, tabla: string): object {
  return new Proxy(consulta, {
    get(objetivo, propiedad) {
      if (typeof propiedad === "string" && METODOS_DE_ESCRITURA.has(propiedad)) {
        return () => {
          throw new EscrituraProhibida(`Modo diagnóstico (solo leer): se intentó ${propiedad} en "${tabla}".`);
        };
      }
      const valor = Reflect.get(objetivo, propiedad, objetivo);
      return typeof valor === "function" ? valor.bind(objetivo) : valor;
    },
  });
}

export function clienteSoloLectura<T extends object>(cliente: T): T {
  return new Proxy(cliente, {
    get(objetivo, propiedad) {
      if (propiedad === "from") {
        const from = Reflect.get(objetivo, "from", objetivo) as (tabla: string) => object;
        return (tabla: string) => envolverConsulta(from.call(objetivo, tabla), tabla);
      }
      if (typeof propiedad === "string" && PROHIBIDOS_EN_CLIENTE.has(propiedad)) {
        return () => {
          throw new EscrituraProhibida(`Modo diagnóstico (solo leer): se intentó llamar ${propiedad}.`);
        };
      }
      const valor = Reflect.get(objetivo, propiedad, objetivo);
      return typeof valor === "function" ? valor.bind(objetivo) : valor;
    },
  });
}

function metodoDe(entrada: RequestInfo | URL, opciones?: RequestInit): string {
  const metodo = opciones?.method ?? (entrada instanceof Request ? entrada.method : "GET");
  return metodo.toUpperCase();
}

export function fetchSoloLectura(base: typeof fetch = fetch): typeof fetch {
  return (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const metodo = metodoDe(entrada, opciones);
    if (metodo !== "GET" && metodo !== "HEAD") {
      throw new EscrituraProhibida(`Modo diagnóstico (solo leer): se cortó un pedido ${metodo} a la base.`);
    }
    return base(entrada, opciones);
  }) as typeof fetch;
}

export interface EscrituraEnSeco {
  tabla: string;
  operacion: "insert" | "update" | "upsert" | "delete";
  fila: Record<string, unknown> | null;
}

/** Lo que devuelve una escritura en seco: se encadena como el builder de PostgREST y responde sin error. */
function respuestaEnSeco(fila: Record<string, unknown> | null): object {
  const exito = (data: unknown) => ({ data, error: null, count: null, status: 200, statusText: "en seco" });
  const respuesta: object = new Proxy(
    {},
    {
      get(_, propiedad) {
        if (propiedad === "then") {
          return (ok: (v: unknown) => unknown, mal?: (e: unknown) => unknown) => Promise.resolve(exito(null)).then(ok, mal);
        }
        if (propiedad === "single" || propiedad === "maybeSingle") {
          // Con un id de verdad: lo que después se busca por ese id no encuentra nada, como un producto recién creado.
          return () => Promise.resolve(exito({ ...fila, id: globalThis.crypto.randomUUID() }));
        }
        return () => respuesta;
      },
    },
  );
  return respuesta;
}

export function clienteEnSeco<T extends object>(cliente: T): { cliente: T; escrituras: EscrituraEnSeco[] } {
  const escrituras: EscrituraEnSeco[] = [];
  const envuelto = new Proxy(cliente, {
    get(objetivo, propiedad) {
      if (propiedad === "from") {
        const from = Reflect.get(objetivo, "from", objetivo) as (tabla: string) => object;
        return (tabla: string) =>
          new Proxy(from.call(objetivo, tabla), {
            get(consulta, metodo) {
              if (typeof metodo === "string" && METODOS_DE_ESCRITURA.has(metodo)) {
                return (datos?: unknown) => {
                  const fila = metodo === "delete" ? null : ((Array.isArray(datos) ? datos[0] : datos) as Record<string, unknown>);
                  escrituras.push({ tabla, operacion: metodo as EscrituraEnSeco["operacion"], fila });
                  return respuestaEnSeco(fila);
                };
              }
              const valor = Reflect.get(consulta, metodo, consulta);
              return typeof valor === "function" ? valor.bind(consulta) : valor;
            },
          });
      }
      if (typeof propiedad === "string" && PROHIBIDOS_EN_CLIENTE.has(propiedad)) {
        return () => {
          throw new EscrituraProhibida(`En seco: se intentó llamar ${propiedad}.`);
        };
      }
      const valor = Reflect.get(objetivo, propiedad, objetivo);
      return typeof valor === "function" ? valor.bind(objetivo) : valor;
    },
  });
  return { cliente: envuelto, escrituras };
}

/** Lo que haría la corrida: cuántas escrituras por tabla y qué productos crearía. */
export function resumirEscrituras(escrituras: EscrituraEnSeco[]): {
  porTabla: Record<string, { insert: number; update: number; delete: number }>;
  productosNuevos: string[];
} {
  const porTabla: Record<string, { insert: number; update: number; delete: number }> = {};
  const productosNuevos: string[] = [];
  for (const e of escrituras) {
    porTabla[e.tabla] ??= { insert: 0, update: 0, delete: 0 };
    porTabla[e.tabla][e.operacion === "upsert" ? "insert" : e.operacion]++;
    if (e.tabla === "producto" && e.operacion === "insert") productosNuevos.push(String(e.fila?.codigo));
  }
  return { porTabla, productosNuevos };
}
