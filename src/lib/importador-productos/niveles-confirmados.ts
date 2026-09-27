import { limpiarNombre, normalizarNombre } from "@/lib/importador-proveedores/nombre";
import type { LineaDudosa } from "./bloque";
import { leerCsv } from "./csv";
import type { ServicioLeido } from "./linea";

/**
 * Niveles de alojamiento confirmados por el owner para las líneas del Excel
 * que no escriben su nivel (spec M1-04b §3 #5, DECISIONS.md 2026-09-27).
 *
 * Son datos (`data/niveles-confirmados.csv`: producto + texto de la línea +
 * nivel + si se ofrece), no condiciones en el código, para que M1-05 sume
 * los suyos.
 * - `ofrecido = si`: el nivel se pone a los alojamientos de ese producto cuya
 *   línea NO escribe nivel; nunca pisa un nivel escrito en el Excel.
 * - `ofrecido = no`: la línea es un resto de un nivel dado de baja (ej.
 *   "Green + Dann Inn" en los combinados): no se carga, no va a revisar ni
 *   se le pregunta a la IA, y el nivel se informa como no ofrecido (mismo
 *   criterio que el Budget Hotel de OD010A).
 * - El texto de la línea se compara normalizado (espacios y mayúsculas),
 *   igual que los nombres de proveedor. Sin parecidos.
 */

export interface NivelConfirmado {
  producto: string;
  texto_linea: string;
  nivel: string;
  ofrecido: boolean;
}

export function parsearNivelesConfirmados(texto: string): NivelConfirmado[] {
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const producto = limpiarNombre(r.producto ?? "");
    const texto_linea = limpiarNombre(r.texto_linea ?? "");
    const nivel = limpiarNombre(r.nivel ?? "");
    if (!producto || !texto_linea || !nivel) {
      throw new Error(`Niveles confirmados, fila ${fila}: faltan producto, texto_linea o nivel.`);
    }
    const ofrecido = limpiarNombre(r.ofrecido ?? "").toLowerCase();
    if (ofrecido !== "si" && ofrecido !== "no") {
      throw new Error(`Niveles confirmados, fila ${fila}: ofrecido "${r.ofrecido ?? ""}" inválido (usar si | no).`);
    }
    return { producto, texto_linea, nivel, ofrecido: ofrecido === "si" };
  });
}

/** La línea del Excel de un servicio (su descripción puede traer más renglones debajo). */
function lineaDe(texto: string): string {
  return normalizarNombre(texto.split("\n")[0]);
}

export function aplicarNivelesConfirmados(
  codigo: string,
  lectura: { servicios: ServicioLeido[]; dudosas: LineaDudosa[] },
  confirmados: NivelConfirmado[],
): {
  servicios: ServicioLeido[];
  dudosas: LineaDudosa[];
  /** Niveles de líneas descartadas por no ofrecidas. */
  nivelesNoOfrecidos: string[];
  /** Confirmados de este producto que encontraron su línea. */
  usados: NivelConfirmado[];
} {
  const delProducto = confirmados.filter((c) => c.producto === codigo);
  const buscar = (texto: string) => delProducto.find((c) => normalizarNombre(c.texto_linea) === lineaDe(texto));
  const usados = new Set<NivelConfirmado>();
  const noOfrecidos: string[] = [];
  const descartar = (c: NivelConfirmado) => {
    usados.add(c);
    if (!noOfrecidos.includes(c.nivel)) noOfrecidos.push(c.nivel);
  };

  const dudosas = lectura.dudosas.filter((d) => {
    const c = buscar(d.texto);
    if (c && !c.ofrecido) {
      descartar(c);
      return false;
    }
    return true;
  });

  const servicios: ServicioLeido[] = [];
  for (const s of lectura.servicios) {
    const c = buscar(s.descripcion);
    if (!c) {
      servicios.push(s);
    } else if (!c.ofrecido) {
      descartar(c);
    } else if (s.tipo === "alojamiento" && s.nivel === null) {
      usados.add(c);
      servicios.push({ ...s, nivel: c.nivel });
    } else {
      servicios.push(s);
    }
  }

  return { servicios, dudosas, nivelesNoOfrecidos: noOfrecidos, usados: [...usados] };
}
