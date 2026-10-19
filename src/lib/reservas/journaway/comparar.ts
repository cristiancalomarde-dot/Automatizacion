import type { DetalleReserva, EstadoReserva } from "../tipos";

/**
 * Spec M2-09 fila 16: lo que dio el modo prueba con los 4 mails reales de
 * Journaway, contra la tabla de la spec (§3). Cada diferencia sale como
 * "esperado X, salió Y". Puro: el script (`probar:mails -- --journaway`) junta
 * los datos con `cargarReserva` y escribe `docs/sdd/diagnosticos/M2-09-journaway.md`.
 *
 * Los nombres de los pasajeros se comparan, pero el reporte solo los nombra si
 * no coinciden (son los de la spec).
 */

export interface ParteEsperada {
  codigo: string;
  fecha: string;
  pickUp?: string | null;
}

export interface TrasladoEsperado {
  vuelo: string;
  fecha: string;
  hora: string;
}

export interface ReservaEsperada {
  producto: string;
  /** Owner 2026-10-17: los demás productos de la misma reserva (SPAP01 + SPAP03). */
  otrosProductos?: string[];
  estado: EstadoReserva;
  tripNumber: string | null;
  pax: number;
  pasajeros: string[];
  partes: ParteEsperada[];
  vuelos: string[];
  trasladoLlegada?: TrasladoEsperado;
  trasladoSalida?: TrasladoEsperado;
  hoteles: number;
  notas?: string[];
}

export interface MailEsperado {
  letra: string;
  titulo: string;
  /** Un pedazo del nombre del archivo en `Insumos/Mails`. */
  archivo: string;
  reservas: ReservaEsperada[];
}

const conOtros = (codigo: string, otros: string[] = []) => [codigo, ...otros].join(" + ");
const ESTADO: Partial<Record<EstadoReserva, string>> = { recibida: "recibida", para_revision: "para revisión" };
const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const o = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? "vacío" : v);
const AEROPUERTO = "CJC";

export function compararJournaway(esperado: MailEsperado, obtenidas: DetalleReserva[]): { ok: boolean; diferencias: string[] } {
  const d: string[] = [];
  if (obtenidas.length !== esperado.reservas.length) {
    const salieron = obtenidas.map((r) => (r.producto ? conOtros(r.producto.codigo, (r.otrosProductos ?? []).map((o) => o.codigo)) : "sin producto"));
    d.push(
      `Reservas: esperado ${esperado.reservas.length} (${esperado.reservas.map((r) => conOtros(r.producto, r.otrosProductos)).join("; ")}), ` +
        `salieron ${obtenidas.length}${salieron.length ? ` (${salieron.join("; ")})` : ""}.`,
    );
    return { ok: false, diferencias: d };
  }
  esperado.reservas.forEach((e, i) => {
    const r = obtenidas.find((x) => x.producto?.codigo === e.producto) ?? obtenidas[i];
    const p = (texto: string) => d.push(`${e.producto} · ${texto}`);
    if (r.producto?.codigo !== e.producto) p(`Producto: esperado ${e.producto}, salió ${r.producto?.codigo ?? "sin producto"}.`);
    const otros = (r.otrosProductos ?? []).map((x) => x.codigo);
    if (otros.join(" + ") !== (e.otrosProductos ?? []).join(" + ")) {
      p(`Otros productos: esperado ${(e.otrosProductos ?? []).join(" + ") || "ninguno"}, salió ${otros.join(" + ") || "ninguno"}.`);
    }
    if (r.estado !== e.estado) {
      p(`Estado: esperado ${ESTADO[e.estado] ?? e.estado}, salió ${ESTADO[r.estado] ?? r.estado}${r.motivos.length ? ` (${r.motivos.join("; ")})` : ""}.`);
    }
    if ((r.tripNumber ?? null) !== e.tripNumber) p(`Número de viaje: esperado ${o(e.tripNumber)}, salió ${o(r.tripNumber)}.`);
    if (r.pax !== e.pax) p(`Pax: esperado ${e.pax}, salió ${r.pax ?? "vacío"}.`);
    const nombres = (xs: string[]) => xs.map(normal).sort().join(" | ");
    if (nombres(r.pasajeros) !== nombres(e.pasajeros)) p(`Pasajeros: esperado ${e.pasajeros.join(", ")}; salió ${r.pasajeros.join(", ") || "ninguno"}.`);

    // Partes: cada una con su fecha y su pick up.
    const libres = [...r.partes];
    for (const pe of e.partes) {
      let k = libres.findIndex((x) => x.producto?.codigo === pe.codigo && x.fechaInicio === pe.fecha);
      if (k < 0) k = libres.findIndex((x) => x.producto?.codigo === pe.codigo);
      const parte = k >= 0 ? libres.splice(k, 1)[0] : undefined;
      if (!parte) {
        p(`Parte ${pe.codigo}: esperada el ${pe.fecha}, no salió.`);
        continue;
      }
      if (parte.fechaInicio !== pe.fecha) p(`Fecha de ${pe.codigo}: esperado ${pe.fecha}, salió ${o(parte.fechaInicio)}.`);
      if (pe.pickUp !== undefined && (parte.pickUp ?? null) !== pe.pickUp) p(`Pick up de ${pe.codigo}: esperado ${o(pe.pickUp)}, salió ${o(parte.pickUp)}.`);
    }
    for (const x of libres) p(`Parte de más: ${x.producto?.codigo ?? x.descripcion ?? "sin producto"} (${o(x.fechaInicio)}).`);

    const vuelos = r.vuelos.map((v) => v.numero ?? "?");
    if (vuelos.join(",") !== e.vuelos.join(",")) p(`Vuelos: esperado ${e.vuelos.join(", ") || "ninguno"}, salió ${vuelos.join(", ") || "ninguno"}.`);
    const traslado = (lado: "llegada" | "salida", t: TrasladoEsperado | undefined) => {
      if (!t) return;
      const v = r.vuelos.find((x) => (lado === "llegada" ? x.destino : x.origen)?.toUpperCase() === AEROPUERTO);
      const fecha = lado === "llegada" ? v?.fechaLlegada : v?.fechaSalida;
      const hora = lado === "llegada" ? v?.horaLlegada : v?.horaSalida;
      if (!v || v.numero !== t.vuelo || fecha !== t.fecha || hora !== t.hora) {
        p(`Traslado de ${lado}: esperado ${t.vuelo} (${t.fecha}, ${t.hora}), salió ${v ? `${o(v.numero)} (${o(fecha)}, ${o(hora)})` : "sin vuelo"}.`);
      }
    };
    traslado("llegada", e.trasladoLlegada);
    traslado("salida", e.trasladoSalida);
    if (r.avisosVuelo.length) p(`Avisos de vuelo: esperado ninguno, salió ${r.avisosVuelo.join("; ")}.`);

    const hoteles = r.hotelesAgencia?.length ?? 0;
    if (hoteles !== e.hoteles) p(`Hoteles de Journaway (no se piden): esperado ${e.hoteles}, salió ${hoteles}.`);
    for (const n of e.notas ?? []) if (!(r.notas ?? []).includes(n)) p(`Nota: esperado «${n}», no salió.`);
  });
  return { ok: d.length === 0, diferencias: d };
}

export interface DatosReporte {
  fecha: string;
  base: "pruebas" | "real";
  modelo: string;
  gasto: number;
  mails: Array<{ esperado: MailEsperado; reservas: DetalleReserva[]; costo: number; error?: string | null }>;
}

const usd = (n: number) => `US$ ${n.toFixed(4).replace(".", ",")}`;

export function reporteJournaway(datos: DatosReporte): string {
  const l: string[] = [
    "# M2-09: los 4 mails de Journaway en el modo prueba",
    "",
    `Generado el ${datos.fecha} con \`npm run probar:mails -- --journaway${datos.base === "pruebas" ? " --base-de-pruebas" : ""}\`, ` +
      `contra la base ${datos.base === "pruebas" ? "de pruebas" : "real (reservas marcadas de prueba)"}. Modelo de la lectura: ${datos.modelo}. ` +
      `Gasto de IA de la corrida: ${usd(datos.gasto)}.`,
    "",
    "Se compara cada mail con lo que pide la spec (tabla de §3): producto, estado, número de viaje, pax, pasajeros, " +
      "cada tour con su fecha y su pick up, vuelos, traslados y los hoteles que reserva Journaway (no se piden).",
    "",
  ];
  const resultados = datos.mails.map((m) => ({ ...m, comparacion: m.error ? null : compararJournaway(m.esperado, m.reservas) }));
  const bien = resultados.filter((r) => r.comparacion?.ok).length;
  l.push(`**${bien} de ${datos.mails.length} mails coinciden con lo esperado.**`, "");
  l.push("| Mail | Esperado | Salió | Resultado |", "|---|---|---|---|");
  for (const r of resultados) {
    const salio =
      r.reservas.map((x) => `${x.producto ? conOtros(x.producto.codigo, (x.otrosProductos ?? []).map((o) => o.codigo)) : "sin producto"} (${ESTADO[x.estado] ?? x.estado})`).join("; ") || "nada";
    const esperado = r.esperado.reservas.map((x) => `${conOtros(x.producto, x.otrosProductos)} (${ESTADO[x.estado]})`).join("; ");
    l.push(`| ${r.esperado.letra} · ${r.esperado.titulo} | ${esperado} | ${salio} | ${r.error ? "Error" : r.comparacion!.ok ? "Coincide" : "Hay diferencias"} |`);
  }
  l.push("");
  for (const r of resultados) {
    l.push(`## ${r.esperado.letra} · ${r.esperado.titulo}`, "");
    if (r.error) {
      l.push(`No se pudo procesar: ${r.error}`, "");
      continue;
    }
    l.push(r.comparacion!.ok ? "Coincide con lo esperado." : "Diferencias:", "");
    for (const dif of r.comparacion!.diferencias) l.push(`- ${dif}`);
    if (!r.comparacion!.ok) l.push("");
    for (const x of r.reservas) {
      const partes = x.partes.map((p) => `${p.producto?.codigo ?? "?"} ${p.fechaInicio ?? "—"}${p.pickUp ? ` (pick up: ${p.pickUp})` : ""}`).join(" · ");
      l.push(`- **${x.producto ? conOtros(x.producto.codigo, (x.otrosProductos ?? []).map((o) => o.codigo)) : "sin producto"}** · ${ESTADO[x.estado] ?? x.estado} · número de viaje: ${x.tripNumber ?? "no vino"} · ${x.pax ?? "?"} pax`);
      if (x.motivos.length) l.push(`  - Motivos: ${x.motivos.join("; ")}`);
      l.push(`  - Partes: ${partes || "ninguna"}`);
      l.push(`  - Vuelos: ${x.vuelos.map((v) => v.numero ?? "?").join(", ") || "ninguno"}`);
      if (x.hotelesAgencia?.length) l.push(`  - Lo que reserva Journaway (no se pide): ${x.hotelesAgencia.map((h) => h.nombre).join(", ")}`);
      if (x.notas?.length) l.push(`  - Notas: ${x.notas.join("; ")}`);
      if (x.avisosVuelo.length) l.push(`  - Avisos: ${x.avisosVuelo.join("; ")}`);
    }
    l.push(`- Gasto de este mail: ${usd(r.costo)}`, "");
  }
  return `${l.join("\n").replace(/\n+$/, "")}\n`;
}
