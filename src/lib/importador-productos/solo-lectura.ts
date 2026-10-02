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
