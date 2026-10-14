import { medirRevision, textoMedicion } from "@/lib/reservas/medicion-prueba";
import type { EstadoReserva } from "@/lib/reservas/tipos";
import { sinDatosPersonales } from "./reporte";

/**
 * El resumen del modo prueba (spec M2-06 fila 15):
 * `docs/sdd/diagnosticos/M2-06-resumen.md`. La medición (con el mismo texto
 * que la pantalla, `medicion-prueba.ts`), el gasto, el modelo usado, la
 * comparación de modelos de `npm run eval:lectura` y la lista de reservas con
 * su marca. Puro: el script junta los datos.
 */

export interface ReservaDelResumen {
  archivo: string | null;
  reporte: string | null;
  bookingId: string | null;
  agencia: string;
  producto: string | null;
  estado: EstadoReserva;
  motivos: string[];
  marca: { resultado: "bien" | "mal"; queMal: string[]; nota: string | null } | null;
}

export interface ArchivoDelResumen {
  archivo: string;
  estado: string;
  motivo?: string;
  reservas: number;
  reporte: string;
}

export interface EvalDeModelo {
  modelo: string;
  version: string;
  total: number;
  gasto: number;
  porCampo: Record<string, number>;
  cuando: string;
}

export interface DatosResumen {
  fecha: string;
  reservas: ReservaDelResumen[];
  archivos: ArchivoDelResumen[];
  gasto: { total: number; lecturas: number; propuestas: number };
  modelos: string[];
  versiones: string[];
  evals: EvalDeModelo[];
  /** False si la tabla de marcas no existe todavía (migración 0014 sin aplicar). */
  marcasDisponibles?: boolean;
}

const usd = (n: number) => `US$ ${n.toFixed(4).replace(".", ",")}`;
const pct = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")}%`;

const ESTADO: Partial<Record<EstadoReserva, string>> = { recibida: "Recibida", para_revision: "Para revisión" };
const QUE: Record<string, string> = {
  producto: "producto",
  fechas: "fechas",
  pasajeros: "pasajeros",
  vuelos: "vuelos",
  estado_motivo: "estado o motivo",
  otro: "otro",
};

const celda = (t: string) => t.replace(/\|/g, "/").replace(/\n/g, " ");

function marca(m: ReservaDelResumen["marca"]): string {
  if (!m) return "sin marcar";
  if (m.resultado === "bien") return "Bien";
  const nota = m.nota ? ` (${celda(sinDatosPersonales(m.nota))})` : "";
  return `Mal: ${m.queMal.map((q) => QUE[q] ?? q).join(", ")}${nota}`;
}

export function armarResumen(d: DatosResumen): string {
  const l: string[] = ["# Modo prueba (M2-06): resumen", "", `Generado el ${d.fecha} con \`npm run probar:mails -- --resumen\`.`, ""];

  l.push("## La medición", "");
  if (d.marcasDisponibles === false) {
    l.push("La marca del owner todavía no está disponible (falta aplicar la migración 0014): no hay medición.", "");
  } else {
    const m = medirRevision(d.reservas.map((r) => (r.marca ? { resultado: r.marca.resultado, queMal: r.marca.queMal } : null)));
    l.push(`**${textoMedicion(m)}**`, "");
    if (m.porcentajeProductoMal !== null) {
      l.push(`Producto mal: ${m.productoMal} de ${m.revisadas} revisadas (${pct(m.porcentajeProductoMal)}). Es el número del PRD (riesgo #1).`, "");
    }
    l.push("Si más del 20% de las reservas revisadas está mal, se frena y no se activa la lectura automática (M2-07).", "");
  }

  l.push("## Gasto y modelo", "");
  l.push(`- Gasto de IA de las reservas de prueba: **${usd(d.gasto.total)}** (${d.gasto.lecturas} lecturas de mails y ${d.gasto.propuestas} propuestas de producto).`);
  l.push(`- Modelo usado: ${d.modelos.length ? d.modelos.join(", ") : "ninguno"}. Instrucciones: ${d.versiones.length ? d.versiones.join(", ") : "—"}.`);
  l.push("");

  if (d.evals.length) {
    l.push("## Sonnet contra Opus (`npm run eval:lectura`)", "");
    l.push("El mismo set de evaluación (las fichas que validó el owner), leído por cada modelo. Es el % de aciertos por campo.", "");
    const campos = [...new Set(d.evals.flatMap((e) => Object.keys(e.porCampo)))];
    l.push(`| Campo | ${d.evals.map((e) => e.modelo).join(" | ")} |`);
    l.push(`|---|${d.evals.map(() => "---").join("|")}|`);
    for (const c of campos) l.push(`| ${c} | ${d.evals.map((e) => (e.porCampo[c] === undefined ? "—" : pct(e.porCampo[c]))).join(" | ")} |`);
    l.push(`| **Total** | ${d.evals.map((e) => `**${pct(e.total)}**`).join(" | ")} |`);
    l.push(`| Costo de la corrida | ${d.evals.map((e) => usd(e.gasto)).join(" | ")} |`);
    l.push(`| Instrucciones | ${d.evals.map((e) => e.version).join(" | ")} |`);
    l.push(`| Cuándo | ${d.evals.map((e) => e.cuando).join(" | ")} |`);
    l.push("", "El modelo se fija en `src/lib/ia/modelos.ts` con el OK del owner (y se anota en `DECISIONS.md`).", "");
  }

  l.push(`## Las reservas de prueba (${d.reservas.length})`, "");
  if (d.reservas.length === 0) l.push("No hay reservas de prueba cargadas.", "");
  else {
    l.push("| Archivo | Agencia | Número | Producto | Estado | Marca del owner |", "|---|---|---|---|---|---|");
    for (const r of d.reservas) {
      l.push(
        `| ${celda(r.archivo ?? "—")} | ${r.agencia} | ${celda(r.bookingId ?? "sin número")} | ${r.producto ?? "sin producto"} | ${ESTADO[r.estado] ?? r.estado} | ${marca(r.marca)} |`,
      );
    }
    l.push("");
  }

  if (d.archivos.length) {
    l.push("## Qué pasó con cada archivo", "", "Cada uno tiene su reporte en `docs/sdd/diagnosticos/M2-06-mails/`.", "");
    l.push("| Archivo | Resultado | Reservas | Reporte |", "|---|---|---|---|");
    for (const a of d.archivos) {
      const resultado = a.estado === "procesado" || a.estado === "ya_procesado" ? "Leído con IA" : (a.motivo ?? a.estado);
      l.push(`| ${celda(a.archivo)} | ${celda(resultado)} | ${a.reservas} | [${celda(a.reporte)}](M2-06-mails/${encodeURI(a.reporte)}) |`);
    }
    l.push("");
  }
  return `${l.join("\n").replace(/\n+$/, "")}\n`;
}
