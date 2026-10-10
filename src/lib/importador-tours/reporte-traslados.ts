import type { AjusteTraslado } from "./traslados";

/**
 * Reporte de traslados por tour para el owner (spec M1-08 §3 #10): qué se
 * anuló, qué cambió (reemplazado o invertido) y qué quedó de un solo lado en
 * cada tour, y los traslados cuyo sentido no se deduce del texto. En llano.
 * Lo escribe `npm run importar:tours` en `docs/sdd/diagnosticos/M1-08-traslados.md`.
 */

/** "Transfer X. Booking Supplier: Y" → "Transfer X (Y)". */
function servicioEnLlano(texto: string): string {
  const [que, quien] = texto.split(/[\s.:/]*\b(?:booking\s+)?book(?:ing|ind|inkg)\s+sup{1,2}lier\b\s*:?\s*/i);
  return quien ? `${que.trim()} (${quien.trim()})` : que.trim();
}

function queHace(x: AjusteTraslado): string {
  switch (x.accion) {
    case "anular":
      return "no se pide";
    case "solo_llegada":
      return "solo la llegada";
    case "solo_salida":
      return "solo la salida";
    case "reemplazar":
      return `se pide como “${x.texto ?? ""}”`;
    case "invertir":
      return `cambia de sentido: “${x.texto ?? ""}”`;
  }
}

export function lineaAjuste(x: AjusteTraslado): string {
  const motivo = x.motivo.replace(/\.$/, "");
  const porque = x.origen === "excepcion" ? `${motivo} (data/traslados-tour.csv)` : motivo;
  const texto = x.texto && (x.accion === "anular" || x.accion === "solo_llegada" || x.accion === "solo_salida") ? ` (“${x.texto}”)` : "";
  return `- **${x.paquete}** · ${servicioEnLlano(x.servicio)}: ${queHace(x)}${texto} — ${porque}.`;
}

export function reporteTrasladosMarkdown(
  r: {
    tours: Array<{ codigo: string; nombre: string; ajustes: AjusteTraslado[] }>;
    sinSentido: Array<{ paquete: string; orden: number; servicio: string }>;
  },
  meta: { fecha: string },
): string {
  const out: string[] = [];
  out.push("# Los traslados de cada paquete según el tour (M1-08)", "");
  out.push(
    `Generado el ${meta.fecha} por la carga de los tours. Dentro de un tour, entre un paquete y el siguiente se viaja en bus: al paquete al que se llega en bus no se le pide el traslado de llegada, y al que se sale en bus no se le pide el de salida. Un traslado de ida y vuelta queda solo del lado que corresponde. El primer paquete conserva la llegada y el último la salida. Iguazú conserva los suyos. Las excepciones que pediste están en \`data/traslados-tour.csv\` y le ganan a la regla.`,
    "",
  );
  out.push("El paquete vendido solo sigue con todos sus servicios. Esto vale solo dentro de cada tour.", "");

  for (const t of r.tours) {
    out.push(`## ${t.codigo} · ${t.nombre}`, "");
    if (t.ajustes.length === 0) {
      out.push("Sin cambios: cada paquete pide sus traslados como se vende solo.", "");
      continue;
    }
    const grupos: Array<[string, AjusteTraslado[]]> = [
      ["Se anulan", t.ajustes.filter((x) => x.accion === "anular")],
      ["Cambian", t.ajustes.filter((x) => x.accion === "reemplazar" || x.accion === "invertir")],
      ["De un solo lado", t.ajustes.filter((x) => x.accion === "solo_llegada" || x.accion === "solo_salida")],
    ];
    for (const [titulo, lista] of grupos) {
      if (lista.length === 0) continue;
      out.push(`**${titulo}**`, "", ...lista.map(lineaAjuste), "");
    }
  }

  out.push("## Traslados sin sentido deducido", "");
  if (r.sinSentido.length === 0) {
    out.push("Ninguno: todos los traslados dicen de dónde a dónde van.", "");
  } else {
    out.push(
      "El texto del Excel no dice si son de llegada, de salida o de ida y vuelta. En el medio de un tour se anulan igual (se llega y se sale en bus); en una punta se dejan enteros. Si querés que se separen, escribí en el Excel de dónde a dónde van (ej. “Transfer MDZ Airport - Accommodation”):",
      "",
    );
    for (const s of r.sinSentido) out.push(`- [ ] **${s.paquete}** · ${servicioEnLlano(s.servicio)}.`);
    out.push("");
  }
  return out.join("\n");
}
