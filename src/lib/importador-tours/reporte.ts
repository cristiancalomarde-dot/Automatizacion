import { nombreDestino } from "./ciudades";
import type { ResumenImportacionTours, ResumenTour } from "./importar";

/**
 * Reporte para el owner (spec M1-05 §3 #10): cada tour con su secuencia día
 * por día (paquete, noches, bus diurno o nocturno y quién lo reserva), los
 * que quedaron para revisar con su motivo y "Lo que necesito que confirmes".
 * En lenguaje llano y sin datos de pasajeros.
 */

function noches(n: number): string {
  return `${n} ${n === 1 ? "noche" : "noches"}`;
}

function ajuste(c: ResumenTour["componentes"][number]): string {
  if (!c.ajusteNoches) return "";
  return c.ajusteNoches > 0
    ? ` (${noches(c.ajusteNoches)} más que el paquete solo)`
    : ` (${noches(-c.ajusteNoches)} menos que el paquete solo)`;
}

function transfer(c: ResumenTour["componentes"][number]): string {
  if (c.transferIn && c.transferOut) return "transfer de llegada y de salida";
  if (c.transferIn) return "transfer de llegada";
  if (c.transferOut) return "transfer de salida";
  return "sin transfer";
}

function secuencia(t: ResumenTour): string[] {
  const filas: Array<{ dia: number; orden: number; linea: string }> = [];
  for (const c of t.componentes) {
    if (c.tipo === "paquete") {
      const que = c.esTour
        ? `**${c.codigo}** (tour completo: ${c.nombreComponente ?? ""})`
        : `**${c.codigo}** ${c.nombreComponente ?? ""} (${c.destinos.map(nombreDestino).join(", ")})`;
      filas.push({ dia: c.diaDesde, orden: c.orden, linea: `| ${c.diaDesde} | ${que} | ${noches(c.noches ?? 0)}${ajuste(c)} | ${transfer(c)} |` });
    } else {
      const llega = c.nocturno ? `nocturno, llega el día ${c.diaDesde + 1}` : "diurno";
      filas.push({
        dia: c.diaDesde,
        orden: c.orden,
        linea: `| ${c.diaDesde} | Bus ${c.descripcionRuta} (${llega}) | — | lo emite HI Travel (tarea manual) |`,
      });
    }
  }
  for (const s of t.serviciosPropios) {
    const llega = s.nocturno ? `nocturno, llega el día ${s.diaDesde + 1}` : "diurno";
    const quien = s.reservaManual
      ? `se reserva a mano en ${s.bookingSupplier} (sistema propio, no se le escribe)`
      : s.sinResolver
        ? `lo reserva ${s.bookingSupplier} — **no lo encontré en el directorio**`
        : `lo reserva ${s.bookingSupplier} (servicio del tour)`;
    filas.push({ dia: s.diaDesde, orden: 0, linea: `| ${s.diaDesde} | Bus ${s.sentido} (${llega}) | — | ${quien} |` });
  }
  filas.sort((a, b) => a.dia - b.dia || a.orden - b.orden);
  return ["| Día | Qué | Noches | Transfer / quién lo reserva |", "|---|---|---|---|", ...filas.map((f) => f.linea)];
}

export function reporteToursMarkdown(r: ResumenImportacionTours, meta: { fecha: string; archivos: string[] }): string {
  const armados = r.tours.filter((t) => t.estado === "armado");
  const revisar = r.tours.filter((t) => t.estado === "para_revisar");
  const out: string[] = [];
  out.push("# Los 7 tours compuestos (M1-05)", "");
  out.push(
    `Armé los tours top-seller con los códigos de RutasenBus y el itinerario día por día de los Word de catálogo (${meta.fecha}). Leí: ${meta.archivos.join(", ")}.`,
    "",
  );
  out.push(`- Armados: **${armados.length} de ${r.tours.length}**. Para revisar: **${revisar.length}**.`);
  out.push(
    "- Cada tour guarda su secuencia: cada paquete con sus noches en el tour y el día en que empieza, y cada bus con el día en que sale y si es nocturno. Las fechas reales se calculan cuando llegue la reserva con su fecha de inicio.",
  );
  out.push("- Transfer: solo la llegada del primer destino y la salida del último. Iguazú conserva los suyos aunque esté en el medio.", "");

  out.push("## Resumen", "", "| Tour | Nombre | Noches | Estado | Paquetes | Buses que emite HI Travel | Buses con proveedor |", "|---|---|---|---|---|---|---|");
  for (const t of r.tours) {
    const paquetes = t.componentes.filter((c) => c.tipo === "paquete").map((c) => c.codigo).join(" → ");
    const buses = t.componentes.filter((c) => c.tipo === "tramo_bus").length;
    out.push(
      `| ${t.codigo} | ${t.nombre} | ${t.noches ?? "?"} | ${t.estado === "armado" ? "armado" : "**para revisar**"} | ${paquetes || "—"} | ${t.estado === "armado" ? buses : "—"} | ${t.estado === "armado" ? t.serviciosPropios.length : "—"} |`,
    );
  }
  out.push("");

  if (revisar.length) {
    out.push("## Para revisar", "", "Estos tours no se armaron (no se inventa nada). Cuando corrijas el dato, alcanza con volver a correr la carga.", "");
    for (const t of revisar) {
      out.push(`- [ ] **${t.codigo}** · ${t.nombre}:`);
      for (const m of t.motivos) out.push(`  - ${m}.`);
    }
    out.push("");
  }

  out.push("## Secuencia de cada tour", "");
  for (const t of armados) {
    out.push(`### ${t.codigo} · ${t.nombre} (${noches(t.noches ?? 0)}, ${(t.noches ?? 0) + 1} días)`, "");
    out.push(`Empieza en ${t.ciudades[0]} y termina en ${t.ciudades[t.ciudades.length - 1]}. Itinerario: ${t.wordArchivo ?? "?"}; códigos: RutasenBus, fila ${t.filaRutas}.`, "");
    out.push(...secuencia(t), "");
    if (t.notas.length) {
      for (const n of t.notas) out.push(`- ${n}`);
      out.push("");
    }
  }

  out.push("## Lo que necesito que confirmes", "");
  const faltantes = r.tours.flatMap((t) => t.categoriasFaltantes);
  if (faltantes.length) {
    out.push(
      "**Categorías del tour sin equivalente en el paquete.** El tour vende esa categoría, pero el paquete no la tiene con ese nombre. Decime cuál corresponde y la sumo a `data/categorias-tour.csv`:",
      "",
    );
    for (const t of r.tours.filter((x) => x.categoriasFaltantes.length)) {
      const porCategoria = new Map<string, string[]>();
      for (const f of t.categoriasFaltantes) {
        const texto = `${f.componente} (tiene ${f.disponibles.join(", ")}${f.porArchivo ? `; el archivo dice ${f.buscada}` : ""})`;
        porCategoria.set(f.categoriaTour, [...(porCategoria.get(f.categoriaTour) ?? []), texto]);
      }
      for (const [categoria, comps] of porCategoria) out.push(`- [ ] **${t.codigo}**, “${categoria}”: ${comps.join("; ")}.`);
    }
    out.push("");
  }

  out.push(
    "**Buses.** Los buses entre destinos los cargué como pasajes que emite HI Travel (no se le escribe a nadie). Si alguno lo reserva un proveedor, sumalo a `data/tramos-con-proveedor.csv`, como el Uyuni – La Paz de Imperio Inca:",
    "",
  );
  for (const t of armados) {
    const tramos = t.componentes.filter((c) => c.tipo === "tramo_bus").map((c) => `${c.descripcionRuta}${c.nocturno ? " (nocturno)" : ""}`);
    const columnas = t.columnasSinCodigo.map((c) => `“${c.encabezado}”`).join(", ");
    out.push(
      `- [ ] **${t.codigo}**: ${tramos.length ? tramos.join("; ") : "ningún bus de HI Travel"}. En RutasenBus, las columnas sin código son: ${columnas || "ninguna"}.`,
    );
  }
  const propios = armados.flatMap((t) => t.serviciosPropios.map((s) => ({ t, s })));
  for (const { t, s } of propios) {
    if (!s.ambosSentidos && s.sentido !== `${nombreDestino(s.desde)} – ${nombreDestino(s.hasta)}`) {
      out.push(`- [ ] **${t.codigo}**: el bus va ${s.sentido} (al revés que en el archivo, “${s.ruta}”). Lo cargué con ${s.bookingSupplier}; confirmá que también lo reserva ese proveedor.`);
    }
    if (s.sinResolver) out.push(`- [ ] **${t.codigo}**: “${s.bookingSupplier}” no está en el directorio de proveedores (o está repetido).`);
  }
  out.push("");

  const diferencias = r.tours.filter((t) => t.diasSinEncabezado.length);
  if (diferencias.length) {
    out.push("**El Word.** Le faltan encabezados “DAY N:” (el texto está, pero pegado al día anterior). No cambia el armado porque las noches salen del “Included”, pero conviene corregirlo:", "");
    for (const t of diferencias) out.push(`- [ ] **${t.codigo}**: día${t.diasSinEncabezado.length > 1 ? "s" : ""} ${t.diasSinEncabezado.join(", ")}.`);
    out.push("");
  }

  out.push("## Anexo: noches de cada paquete vendido solo", "");
  out.push("Las saqué del Excel de paquetes para controlar las anotaciones “(menos/mas N noche)” de RutasenBus.", "");
  out.push("| Paquete | Noches |", "|---|---|");
  for (const [codigo, n] of Object.entries(r.nochesBase)) out.push(`| ${codigo} | ${n ?? "no encontradas"} |`);
  out.push("");
  return out.join("\n");
}
