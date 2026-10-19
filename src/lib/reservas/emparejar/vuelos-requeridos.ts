import { ladosDeUnTraslado, pasosDelTour, type Lado } from "@/lib/catalogo/reglas";
import type { DetalleProducto, Servicio } from "@/lib/catalogo/tipos";
import type { ProductoIA, VueloIA } from "../esquema-ficha";
import { MOTIVOS_EMPAREJADO as M } from "./motivos";

/**
 * Los vuelos que pide una reserva (spec M2-03 filas 10, 11 y 12): se miran los
 * traslados que se van a pedir (en un tour, después de los ajustes de M1-08 y
 * con la misma regla de "se llega/sale en bus" que la pantalla:
 * `pasosDelTour`). Una llegada pide el vuelo de llegada a ese aeropuerto y
 * una salida el de salida (número y horario). Los servicios "a pedido" u
 * opcionales cuentan solo si el mail pide un traslado. Devuelve un motivo por
 * vuelo que falta.
 */

/** Aeropuertos de los traslados del catálogo: código → ciudad. */
export const AEROPUERTOS: Record<string, string> = {
  CJC: "Calama",
  FTE: "El Calafate",
  PNT: "Puerto Natales",
  PUQ: "Punta Arenas",
  EZE: "Buenos Aires",
  AEP: "Buenos Aires",
  REL: "Trelew",
  SCL: "Santiago de Chile",
  LPB: "La Paz",
  GIG: "Río de Janeiro",
  USH: "Ushuaia",
  MDZ: "Mendoza",
  IGR: "Puerto Iguazú",
  IGU: "Foz do Iguaçu",
};
/** "El Calafate Airport", "La Paz Airport", "aeropuerto de Calama" → código. */
const POR_NOMBRE: Array<[RegExp, string]> = [
  [/el calafate airport|aeropuerto de el calafate/i, "FTE"],
  [/la paz airport|aeropuerto de la paz/i, "LPB"],
  [/calama airport|aeropuerto de calama/i, "CJC"],
  [/puerto natales airport|aeropuerto de puerto natales/i, "PNT"],
];

export interface Lugar {
  ciudad: string;
  codigos: string[];
}

export function lugarDelTraslado(texto: string, destino: string | null): Lugar | null {
  const codigos = [...new Set((texto.toUpperCase().match(/\b[A-Z]{3}\b/g) ?? []).filter((c) => c in AEROPUERTOS))];
  if (codigos.length === 0) for (const [re, c] of POR_NOMBRE) if (re.test(texto)) codigos.push(c);
  if (codigos.length === 0 && destino && destino in AEROPUERTOS) codigos.push(destino);
  if (codigos.length === 0) return null;
  return { ciudad: AEROPUERTOS[codigos[0]], codigos };
}

function hayVuelo(vuelos: VueloIA[], lado: Lado, lugar: Lugar | null, fecha: string | null): boolean {
  return vuelos.some((v) => {
    if (!v.numero) return false;
    const aeropuerto = (lado === "in" ? v.destino : v.origen)?.toUpperCase() ?? null;
    const hora = lado === "in" ? v.hora_llegada : v.hora_salida;
    const dia = lado === "in" ? v.fecha_llegada : v.fecha_salida;
    if (!hora) return false;
    if (aeropuerto && lugar) return lugar.codigos.includes(aeropuerto);
    // Sin aeropuerto escrito: cuenta si es del día del traslado.
    return !!fecha && dia === fecha;
  });
}

const PIDE_TRASLADO = /transfer|traslado|pick ?up/i;
const CON_TRASLADOS = /\b(with|con|incl\.?|including)\s+(the\s+)?(transfers?|traslados?)\b/i;
const SIN_TRASLADOS = /\b(without|sin|no)\s+(the\s+)?(transfers?|traslados?)\b/i;

export interface DatosParaVuelos {
  vuelos: VueloIA[];
  pedidos: string[];
  producto: Pick<ProductoIA, "nombre" | "opcionales" | "fecha_inicio" | "fecha_fin"> | undefined;
  finalPuertoNatales: boolean;
  /**
   * M2-09 fila 15: los lados que lleva otra reserva del mismo pedido (SPAP01
   * seguido de SPAP03: la salida va con SPAP03). No piden vuelo acá.
   */
  omitir?: readonly Lado[];
}

/** Un servicio por orden: las alternativas "/" del mismo traslado no se piden dos veces. */
function trasladosPorOrden(servicios: Servicio[]): Servicio[] {
  const porOrden = new Map<string, Servicio>();
  for (const s of servicios) {
    if (s.tipo !== "traslado") continue;
    const clave = String(s.orden ?? s.id);
    const previo = porOrden.get(clave);
    if (!previo || s.prioridad < previo.prioridad) porOrden.set(clave, s);
  }
  return [...porOrden.values()];
}

export function motivosDeVuelos(detalle: DetalleProducto, datos: DatosParaVuelos): string[] {
  const motivos: string[] = [];
  const textoDelMail = [...datos.pedidos, datos.producto?.nombre ?? "", ...(datos.producto?.opcionales ?? [])].join("\n");
  const mailPideTraslado = datos.pedidos.some((p) => PIDE_TRASLADO.test(p));

  const pasos = detalle.esTour
    ? pasosDelTour(detalle.componentes, detalle.servicios).map((p) => ({
        codigo: p.componente.producto!.codigo,
        destino: p.componente.producto!.destino,
        servicios: p.componente.producto!.servicios,
        dia: p.dia,
        noches: p.componente.noches,
        llegaEnBus: p.llegaEnBus,
        saleEnBus: p.saleEnBus,
      }))
    : [{ codigo: detalle.codigo, destino: detalle.destino, servicios: detalle.servicios, dia: 1, noches: null, llegaEnBus: false, saleEnBus: false }];

  const inicio = datos.producto?.fecha_inicio ?? null;
  const fechaDe = (dia: number | null, mas = 0) => {
    if (!inicio || dia === null) return null;
    const d = new Date(`${inicio}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dia - 1 + mas);
    return d.toISOString().slice(0, 10);
  };

  for (const paso of pasos) {
    for (const s of trasladosPorOrden(paso.servicios)) {
      let lados: Lado[];
      if (s.aPedido === "segun_reserva" && !s.ajusteTour) {
        // Fila 12: depende de la variante vendida (OD019 CON o SIN traslados).
        if (SIN_TRASLADOS.test(textoDelMail)) continue;
        if (!CON_TRASLADOS.test(textoDelMail)) {
          motivos.push(M.elegirVariante(paso.codigo));
          continue;
        }
        lados = s.sentido === "llegada" ? ["in"] : s.sentido === "salida" ? ["out"] : ["in", "out"];
      } else {
        lados = ladosDeUnTraslado(s).quedan;
      }
      if ((s.aPedido === "a_pedido" || s.opcional) && !mailPideTraslado) continue;

      const texto = s.ajusteTour?.texto ?? s.descripcion ?? "";
      const lugar = lugarDelTraslado(texto, paso.destino);
      for (const lado of lados) {
        if (datos.omitir?.includes(lado)) continue;
        if (lado === "in" && paso.llegaEnBus) continue;
        if (lado === "out" && paso.saleEnBus) continue;
        const fecha = lado === "in" ? fechaDe(paso.dia) : (datos.producto?.fecha_fin ?? null);
        if (!hayVuelo(datos.vuelos, lado, lugar, fecha)) motivos.push(M.faltaVuelo(lado, lugar, `el traslado de ${paso.codigo}`));
      }
    }
  }

  // Fila 10: el transfer al aeropuerto de Puerto Natales del final de ARCH31/ARCH33.
  const tieneFinalPNT = detalle.servicios.some((s) => s.tipo === "bus" && /aeropuerto de Puerto Natales/i.test(s.descripcion ?? ""));
  if (tieneFinalPNT && datos.finalPuertoNatales) {
    const pnt = { ciudad: AEROPUERTOS.PNT, codigos: ["PNT"] };
    if (!hayVuelo(datos.vuelos, "out", pnt, datos.producto?.fecha_fin ?? null)) {
      motivos.push(M.faltaVuelo("out", pnt, "el traslado al aeropuerto de Puerto Natales"));
    }
  }
  return motivos;
}
