import type { Diagnostico, Donde, Emparejado, PaqueteDiagnostico, ServicioDiagnostico } from "./diagnostico";
import type { TipoServicio } from "./linea";

/**
 * Reporte del diagnóstico de paquetes (spec M1-04c §3 #4-#6, #8).
 *
 * - `reporteMarkdown`: para el owner (no técnico). Arriba, "Lo que necesito
 *   que confirmes": una sola lista, sin repetir nombres, escrita para que se
 *   entienda sin saber de código. Abajo, el detalle de cada paquete.
 * - `reporteJson`: la misma información, para que el loop principal arme la
 *   propuesta de equivalencias.
 */

const TIPO: Record<TipoServicio, string> = {
  alojamiento: "Alojamiento",
  excursion: "Excursión",
  traslado: "Traslado",
  bus: "Bus",
  crucero: "Crucero",
  otro: "Otro servicio",
};

function estado(o: { emparejado: Emparejado; proveedorDirectorio: string | null; nota: string | null }): string {
  const nota = o.nota ? ` (${o.nota})` : "";
  switch (o.emparejado) {
    case "exacto":
      return "exacto";
    case "por_equivalencia":
      return `por equivalencia, es «${o.proveedorDirectorio}» del directorio`;
    case "equivalencia_para_revisar":
      return `por equivalencia, falta confirmar: «${o.proveedorDirectorio}» del directorio${nota}`;
    case "sin_emparejar":
      return `**sin emparejar**${nota}`;
    case "sin_booking_supplier":
      return "**el Excel no dice a quién reservarle**";
  }
}

function donde(lista: Donde[]): string {
  return lista.map((d) => `${d.codigo} (fila ${d.fila})`).join(", ");
}

function cita(texto: string): string {
  return `“${texto.replace(/\n/g, " · ")}”`;
}

function lineaServicio(s: ServicioDiagnostico): string[] {
  const out = [`- Fila ${s.fila}: ${cita(s.linea.split("\n")[0])}`];
  for (const o of s.opciones) {
    const bs = o.bookingSupplier ?? "(no escrito)";
    out.push(`  ${o.prioridad}. ${o.serviceProvider} → se reserva a **${bs}**: ${estado(o)}`);
  }
  return out;
}

function seccionPaquete(p: PaqueteDiagnostico, d: Diagnostico): string[] {
  if (!p.encontrado) {
    const motivo = d.aConfirmar.bloquesNoEncontrados.find((n) => n.codigo === p.codigo)?.motivo ?? "";
    return [`### ${p.codigo} · no encontrado`, "", `No encontré el bloque de este paquete en el Excel: ${motivo}.`, ""];
  }
  const out = [
    `### ${p.codigo} · ${p.nombre}`,
    "",
    `Está en la celda ${p.celda} · destino ${p.destino}${p.destinoExcel && p.destinoExcel !== p.destino ? ` (en el Excel figura bajo ${p.destinoExcel})` : ""}.`,
    "",
  ];
  if (p.bloqueNoCalza) {
    out.push("El bloque no tiene la forma de siempre y no pude leer sus servicios.", "");
    return out;
  }
  const alojamientos = p.servicios.filter((s) => s.tipo === "alojamiento");
  const otros = p.servicios.filter((s) => s.tipo !== "alojamiento");
  if (alojamientos.length) {
    out.push("**Alojamiento, por categoría** (las opciones van en el orden en que se piden):", "");
    const niveles = [...new Set(alojamientos.map((s) => s.nivel))];
    for (const nivel of niveles) {
      out.push(`*${nivel ?? "Sin categoría escrita"}*`, "");
      for (const s of alojamientos.filter((x) => x.nivel === nivel)) out.push(...lineaServicio(s));
      out.push("");
    }
  }
  if (otros.length) {
    out.push("**Otros servicios:**", "");
    for (const s of otros) {
      const [primera, ...resto] = lineaServicio(s);
      out.push(primera.replace("- Fila", `- ${TIPO[s.tipo]}, fila`), ...resto);
    }
    out.push("");
  }
  if (!p.servicios.length) out.push("No encontré servicios en este bloque.", "");
  if (p.nivelesNoOfrecidos.length) {
    out.push(
      `Categorías que figuran sin hotel y sin precio (las tomo como no ofrecidas): ${p.nivelesNoOfrecidos.join(", ")}.`,
      "",
    );
  }
  for (const c of p.correcciones) out.push(`Corrección automática en la fila ${c.fila}: ${c.correccion}.`, "");
  return out;
}

export function reporteMarkdown(d: Diagnostico): string {
  const c = d.aConfirmar;
  const encontrados = d.paquetes.filter((p) => p.encontrado);
  const opciones = encontrados.flatMap((p) => p.servicios.flatMap((s) => s.opciones));
  const cuenta = (e: Emparejado) => opciones.filter((o) => o.emparejado === e).length;

  const out: string[] = [
    "# Diagnóstico de los paquetes de un destino de los 7 tours (M1-04c)",
    "",
    `Leí el Excel **${d.archivo}** (hoja "${d.hoja}") el ${d.generado.slice(0, 10)}. **No cargué ni cambié nada en el sistema:** esto es solo una lectura para que confirmes lo que no pude resolver solo.`,
    "",
    `- Paquetes revisados: ${d.paquetes.length}. Encontrados en el Excel: ${encontrados.length}.`,
    `- Reservas de servicios (cada opción de hotel o excursión): ${opciones.length}. Proveedor encontrado en el directorio: ${cuenta("exacto")} por nombre exacto y ${cuenta("por_equivalencia")} por una equivalencia que ya confirmaste; ${cuenta("equivalencia_para_revisar")} con equivalencia a confirmar; ${cuenta("sin_emparejar")} sin encontrar; ${cuenta("sin_booking_supplier")} sin decir a quién reservarle.`,
  ];
  if (d.omitidosPorYaCargados.length) {
    out.push(`- No revisé los que ya están cargados en el sistema: ${d.omitidosPorYaCargados.join(", ")}.`);
  }
  if (d.codigosAusentesEnRutas) {
    out.push(
      d.codigosAusentesEnRutas.length
        ? `- Estos códigos no aparecen en RutasenBus (hoja "Tours 2027"): ${d.codigosAusentesEnRutas.join(", ")}.`
        : `- Todos los códigos revisados aparecen en RutasenBus (hoja "Tours 2027").`,
    );
  }
  out.push("", "## Lo que necesito que confirmes", "");

  let n = 0;
  const titulo = (t: string, explicacion: string) => out.push(`### ${++n}. ${t}`, "", explicacion, "");

  if (c.proveedoresSinEmparejar.length) {
    titulo(
      "Proveedores que no encuentro en el directorio",
      "Son a quienes se les pide la reserva, según el Excel de paquetes. No los encuentro con ese nombre en el Excel de proveedores. Para cada uno decime cuál es del directorio, o si falta agregarlo. Las sugerencias son solo nombres parecidos: no las apliqué.",
    );
    for (const p of c.proveedoresSinEmparejar) {
      out.push(`- [ ] **${p.nombre}** — aparece en ${p.paquetes.join(", ")}.${p.nota ? ` Nota: ${p.nota}.` : ""}`);
      if (p.sugerencias.length) {
        const sug = p.sugerencias.map((s) => `«${s.nombre}»${s.ciudad ? ` (${s.ciudad})` : ""}`).join(", ");
        out.push(`  - Sugerencia, sin aplicar: ¿es ${sug}?`);
      } else {
        out.push("  - No encontré ningún nombre parecido en el directorio.");
      }
    }
    out.push("");
  }
  if (c.equivalenciasParaRevisar.length) {
    titulo("Equivalencias que todavía falta confirmar", "Ya están en la lista de equivalencias, pero marcadas para revisar.");
    for (const e of c.equivalenciasParaRevisar) {
      out.push(`- [ ] **${e.nombre}** → «${e.proveedorDirectorio}» (en ${e.paquetes.join(", ")}).${e.nota ? ` Nota: ${e.nota}.` : ""}`);
    }
    out.push("");
  }
  if (c.serviciosSinBookingSupplier.length) {
    titulo(
      "Renglones que no dicen a quién reservarle",
      "Parecen un servicio pero no tienen \"Booking Supplier\". ¿A quién se le pide la reserva? ¿O es solo un título y no un servicio?",
    );
    for (const s of c.serviciosSinBookingSupplier) out.push(`- [ ] ${cita(s.linea)} — ${donde(s.donde)}`);
    out.push("");
  }
  if (c.alojamientosSinNivel.length) {
    titulo(
      "Alojamientos que no dicen su categoría",
      "La línea del hotel no dice si es Hostel, Budget Hotel, Hotel 3* u Hotel 4*. ¿Qué categoría es cada una? Te pongo las categorías que nombra la tabla de precios del paquete.",
    );
    for (const a of c.alojamientosSinNivel) {
      const tabla = a.nivelesDeLaTabla.length ? ` La tabla de precios nombra: ${a.nivelesDeLaTabla.join(", ")}.` : "";
      out.push(`- **${a.codigo}**:${tabla}`);
      for (const l of a.lineas) out.push(`  - [ ] Fila ${l.fila}: ${cita(l.texto)}`);
    }
    out.push("");
  }
  if (c.nivelesSoloEnPrecios.length) {
    titulo(
      "Categorías con precio pero sin hotel asignado",
      "La tabla de precios tiene precio para esta categoría, pero no hay una línea de alojamiento que diga qué hotel es y a quién reservarle. ¿Se ofrece? Si se ofrece, ¿qué hotel es?",
    );
    for (const x of c.nivelesSoloEnPrecios) out.push(`- [ ] **${x.codigo}**: ${x.nivel}`);
    out.push("");
  }
  if (c.lineasNoEntendidas.length) {
    titulo(
      "Renglones que no entiendo",
      "No tienen la forma \"Accommodation / Excursion / Transfer …. Booking Supplier: …\". Decime qué son (un servicio, una aclaración o algo para ignorar).",
    );
    for (const l of c.lineasNoEntendidas) {
      const motivo = l.motivo === "no calza con ningún patrón conocido" ? "" : ` (${l.motivo})`;
      out.push(`- [ ] ${cita(l.texto)}${motivo} — ${donde(l.donde)}`);
    }
    out.push("");
  }
  if (c.bloquesNoEncontrados.length || c.bloquesDuplicados.length || c.bloquesQueNoCalzan.length) {
    titulo("Paquetes que no pude ubicar bien en el Excel", "");
    for (const b of c.bloquesNoEncontrados) {
      const ap = b.apariciones.length ? ` Aparece en ${b.apariciones.map((a) => a.celda).join(", ")}.` : "";
      const ctx = b.contexto.length ? ` Al lado dice: ${b.contexto.map((x) => `${x.celda} ${cita(x.texto)}`).join("; ")}.` : "";
      out.push(`- [ ] **${b.codigo}**: ${b.motivo}.${ap}${ctx} ¿Dónde está su bloque (con su línea "Accommodation … Booking Supplier")?`);
    }
    for (const b of c.bloquesDuplicados) {
      out.push(`- [ ] **${b.codigo}**: está en dos bloques distintos (${b.celdaUsada} y ${b.otrasCeldas.join(", ")}). Leí el de ${b.celdaUsada}. ¿Cuál es el bueno?`);
    }
    for (const codigo of c.bloquesQueNoCalzan) {
      out.push(`- [ ] **${codigo}**: el bloque no tiene la forma de siempre y no pude leer sus servicios.`);
    }
    out.push("");
  }
  if (c.destinosAConfirmar.length) {
    titulo("Destino de algunos paquetes", "Les puse un destino en la lista de paquetes que no coincide con lo que dice el Excel (o el Excel no dice ninguno). ¿Está bien?");
    for (const x of c.destinosAConfirmar) {
      out.push(`- [ ] **${x.codigo}**: puse ${x.destinoLista}; ${x.destinoExcel ? `el Excel lo tiene bajo ${x.destinoExcel}` : "el Excel no dice el destino"}.`);
    }
    out.push("");
  }
  if (c.nivelesConfirmadosSinLinea.length) {
    titulo("Categorías que ya confirmaste pero cuya línea ya no está igual en el Excel", "");
    for (const x of c.nivelesConfirmadosSinLinea) out.push(`- [ ] **${x.producto}**: ${cita(x.texto_linea)} (${x.nivel})`);
    out.push("");
  }
  if (n === 0) out.push("Nada: pude leer todo.", "");

  out.push("## Habría necesitado IA", "");
  out.push("No usé la IA. Estos son los bloques o renglones que las reglas no pudieron leer y que con la IA se intentarían interpretar (igual quedan en la lista de arriba):", "");
  if (!d.habriaNecesitadoIA.length) out.push("Ninguno.");
  for (const h of d.habriaNecesitadoIA) {
    if (h.bloqueEntero) out.push(`- ${h.codigo}: el bloque entero.`);
    else out.push(`- ${h.codigo}: ${h.lineas.map((l) => `fila ${l.fila}`).join(", ")}.`);
  }
  out.push("", "## Detalle por paquete", "");
  for (const p of d.paquetes) out.push(...seccionPaquete(p, d));
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function reporteJson(d: Diagnostico): string {
  return JSON.stringify(d, null, 2) + "\n";
}
