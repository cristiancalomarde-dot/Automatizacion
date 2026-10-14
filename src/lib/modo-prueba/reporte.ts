import { basename, extname } from "node:path";
import type { FichaLectura, VueloIA } from "@/lib/reservas/esquema-ficha";
import type { AccionPedido } from "@/lib/reservas/procesar-mail";
import type { EstadoReserva, OrigenEmparejado } from "@/lib/reservas/tipos";

/**
 * El reporte por mail del modo prueba (spec M2-06 filas 11 y 12), para que el
 * owner compare cada reserva con el mail original. En llano, como
 * `M1-08-traslados.md`: qué entendió la IA, con qué producto se emparejó y por
 * qué, en qué estado quedó y por qué quedó en revisión. Si el mail se salteó,
 * por qué.
 *
 * Sin datos personales (fila 12): de los pasajeros, solo la cantidad y el
 * apellido. Los pedidos especiales pasan por `sinDatosPersonales`. El asunto
 * no se muestra (los de Kilroy traen el nombre del pasajero): solo sus números.
 */

export type EstadoArchivo = "procesado" | "ya_procesado" | "salteado" | "no_procesado" | "error";

export interface ProductoCorto {
  codigo: string;
  nombre: string;
}

export interface ReservaParaReporte {
  accion: AccionPedido;
  bookingId: string | null;
  bookingIdOriginal: string | null;
  productoTexto: string | null;
  producto: ProductoCorto | null;
  origenEmparejado: OrigenEmparejado | null;
  confianzaEmparejado: number | null;
  sugerencia: (ProductoCorto & { confianza?: number | null }) | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  pax: number | null;
  estado: EstadoReserva;
  motivos: string[];
  /** Cantidad de partes (tour compuesto). */
  partes: number;
}

export interface ResultadoParaReporte {
  archivo: string;
  estado: EstadoArchivo;
  agencia: string | null;
  motivo?: string;
  /** Los números de reserva del asunto (para un mail salteado). */
  numerosAsunto?: string[];
  lectura?: { estado: "leido"; ficha: FichaLectura } | { estado: "para_revision"; motivo: string };
  reservas: ReservaParaReporte[];
  costo: number;
}

// --- privacidad ------------------------------------------------------------------------

const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const TELEFONO = /\+?\d[\d\s().-]{7,}\d/g;
const NACIMIENTO_KILROY = /\b\d{2}[A-Z]{3}\d{2}\b/g;
const DOCUMENTO = /\b((?:passport|pasaporte|pas|dni|id)\b\s*(?:no\.?|n°|nr\.?|number)?\s*:?\s*)[A-Z]{0,3}\d{6,}\b/gi;
const DOCUMENTO_SUELTO = /\b[A-Z]{1,3}\d{7,9}\b/g;

/** Saca mails, teléfonos, fechas de nacimiento (formato Kilroy) y números de documento. */
export function sinDatosPersonales(texto: string): string {
  return texto
    .replace(MAIL, "[mail]")
    .replace(DOCUMENTO, "$1[documento]")
    .replace(NACIMIENTO_KILROY, "[fecha]")
    .replace(TELEFONO, (m) => (/[\s+().-]/.test(m) && m.replace(/\D/g, "").length >= 8 ? "[teléfono]" : m))
    .replace(DOCUMENTO_SUELTO, (m) => (/^[A-Z]{2}\d{7}$/.test(m) ? m : "[documento]"));
}

/** El nombre del archivo del reporte. Un PDF de TourRadar usa su "Booking Statement N - M - tipo" (el resto del nombre son notas del owner). */
export function nombreDelReporte(archivo: string): string {
  return `${basename(nombreVisible(archivo), extname(archivo))}.md`;
}

/**
 * El nombre del archivo para mostrar (título del reporte, resumen): el de un
 * PDF de TourRadar sin las notas del owner, que pueden traer el nombre del pasajero.
 */
export function nombreVisible(archivo: string): string {
  const ext = extname(archivo);
  const sinExt = basename(archivo, ext);
  const statement = /booking statement\s+\d+\s*-\s*\d+\s*-\s*[a-z]+/i.exec(sinExt);
  const base = (statement ? statement[0] : sinExt).replace(/[\\/:*?"<>|#]/g, "").replace(/\s+/g, " ").trim();
  return `${base}${ext}`;
}

// --- formato ---------------------------------------------------------------------------

const usd = (n: number) => `US$ ${n.toFixed(4).replace(".", ",")}`;
const dec = (n: number) => n.toFixed(2).replace(".", ",");

function fecha(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function rango(inicio: string | null | undefined, fin: string | null | undefined): string {
  const a = fecha(inicio);
  const b = fecha(fin);
  if (a && b) return `${a} al ${b}`;
  return a ? `desde el ${a}` : b ? `hasta el ${b}` : "sin fechas";
}

const ESTADO: Record<EstadoReserva, string> = {
  recibida: "Recibida",
  para_revision: "Para revisión",
  pedido_a_proveedor: "Pedido al proveedor",
  confirmada: "Confirmada",
  con_cambios: "Con cambios",
  rechazada: "Rechazada",
  cerrada: "Cerrada",
  descartada: "Descartada",
};

function vuelo(v: VueloIA): string {
  const sale = [v.origen, fecha(v.fecha_salida), v.hora_salida].filter(Boolean).join(" ");
  const llega = [v.destino, fecha(v.fecha_llegada), v.hora_llegada].filter(Boolean).join(" ");
  return `${[v.numero, v.aerolinea].filter(Boolean).join(" ") || "Vuelo sin número"}: ${sale || "?"} → ${llega || "?"}`;
}

function porQueProducto(r: ReservaParaReporte): string {
  if (!r.producto) {
    const sug = r.sugerencia
      ? ` La IA sugirió **${r.sugerencia.codigo}** ${r.sugerencia.nombre}${r.sugerencia.confianza != null ? ` (confianza ${dec(r.sugerencia.confianza)})` : ""}, pero no alcanza para darlo por bueno.`
      : "";
    return `No se emparejó con ningún producto.${sug}`;
  }
  const como =
    r.origenEmparejado === "codigo"
      ? "por el código exacto que mandó la agencia"
      : r.origenEmparejado === "nombre"
        ? "por el nombre que usa la agencia (cargado en el sistema)"
        : r.origenEmparejado === "ia"
          ? `por propuesta de la IA, con confianza ${dec(r.confianzaEmparejado ?? 0)}`
          : "sin dato de cómo";
  return `**${r.producto.codigo}** ${r.producto.nombre}, ${como}.`;
}

function queEntendio(f: FichaLectura): string[] {
  const l: string[] = ["## Qué entendió la IA", ""];
  l.push(`- **Agencia:** ${f.agencia.valor ?? "no la dice"}`);
  l.push(`- **Número de reserva:** ${f.numero_reserva.valor ?? "no lo trae"}`);
  l.push(`- **Tipo de mail:** ${f.tipo_mail.valor.replace(/_/g, " ")}`);
  if (f.productos.length === 0) l.push("- **Producto nombrado:** ninguno");
  for (const p of f.productos) {
    l.push(`- **Producto nombrado:** ${p.nombre}${p.codigo ? ` (código ${p.codigo})` : ""} · ${rango(p.fecha_inicio, p.fecha_fin)}${p.habitacion ? ` · ${p.habitacion}` : ""}`);
    for (const o of p.opcionales) l.push(`  - Opcional: ${sinDatosPersonales(o)}`);
  }
  l.push(`- **Fechas:** ${rango(f.fecha_inicio.valor, f.fecha_fin.valor)}`);
  const apellidos = f.pasajeros.map((p) => p.apellido).filter(Boolean);
  const pax = f.pax.valor ?? (apellidos.length || null);
  l.push(`- **Pasajeros:** ${pax ? `${pax} ${pax === 1 ? "pasajero" : "pasajeros"}` : "no dice cuántos"}${apellidos.length ? ` (apellidos: ${apellidos.join(", ")})` : ""}`);
  if (f.vuelos.length === 0) l.push("- **Vuelos:** Sin vuelos en el mail");
  else {
    l.push("- **Vuelos:**");
    for (const v of f.vuelos) l.push(`  - ${vuelo(v)}`);
  }
  if (f.pedidos_especiales.length === 0) l.push("- **Pedidos especiales:** ninguno");
  else {
    l.push("- **Pedidos especiales:**");
    for (const p of f.pedidos_especiales) l.push(`  - ${sinDatosPersonales(p.texto)}`);
  }
  if (f.datos_dudosos.length) l.push(`- **Dudoso:** ${f.datos_dudosos.join(", ")} (la IA no estaba segura o un control del código falló)`);
  return l;
}

function seccionReserva(r: ReservaParaReporte, i: number, total: number): string[] {
  const l: string[] = [total > 1 ? `### Reserva ${i + 1}` : "### La reserva", ""];
  if (r.accion === "sumada") {
    l.push(
      `No creó una reserva nueva: se sumó al historial de la reserva ${r.bookingIdOriginal ?? r.bookingId ?? "sin número"} (mismo número y mismo producto: es el mismo intercambio).`,
    );
  }
  l.push(`- **Lo que pidió la agencia:** ${r.productoTexto ?? "sin producto"}`);
  l.push(`- **Producto:** ${porQueProducto(r)}`);
  if (r.partes > 0) l.push(`- **Partes del tour:** ${r.partes}`);
  l.push(`- **Fechas:** ${rango(r.fechaInicio, r.fechaFin)} · **Pax:** ${r.pax ?? "sin dato"}`);
  l.push(`- **Estado:** ${ESTADO[r.estado]}${r.accion === "posible_duplicada" ? " · marcada como posible duplicada" : ""}`);
  if (r.motivos.length) {
    l.push("- **Por qué quedó en revisión:**");
    for (const m of r.motivos) l.push(`  - ${sinDatosPersonales(m)}`);
  }
  l.push("");
  return l;
}

export function armarReporteMail(r: ResultadoParaReporte): string {
  const l: string[] = [`# ${nombreVisible(r.archivo)}`, ""];
  l.push(`- **Agencia:** ${r.agencia ?? "ninguna (no es un mail de agencia)"}`);
  l.push(`- **Gasto de IA de este mail:** ${usd(r.costo)}`);
  l.push("");

  if (r.estado === "salteado") {
    l.push("**No se leyó con IA.** " + (r.motivo ?? ""));
    if (r.numerosAsunto?.length) l.push("", `Números de reserva en el asunto: ${r.numerosAsunto.join(", ")}.`);
    return `${l.join("\n")}\n`;
  }
  if (r.estado === "no_procesado" || r.estado === "error") {
    l.push(`**${r.motivo ?? "No procesado."}**`, "", "No se guardó ninguna reserva de este mail: no se inventa nada.");
    return `${l.join("\n")}\n`;
  }
  // Un archivo ya procesado (otra corrida) se describe igual: su ficha y su gasto quedaron guardados.

  if (r.lectura?.estado === "leido") l.push(...queEntendio(r.lectura.ficha), "");
  else if (r.lectura?.estado === "para_revision") l.push("## Qué entendió la IA", "", `No se pudo leer: ${r.lectura.motivo}`, "");

  l.push("## Qué quedó en el sistema", "");
  const nuevas = r.reservas.filter((x) => x.accion !== "sumada").length;
  if (r.reservas.length > 1) l.push(`Salieron ${r.reservas.length} reservas${nuevas !== r.reservas.length ? ` (${nuevas} nuevas)` : ""}.`, "");
  if (r.reservas.length === 0) l.push("Ninguna reserva.", "");
  r.reservas.forEach((x, i) => l.push(...seccionReserva(x, i, r.reservas.length)));
  return `${l.join("\n").replace(/\n+$/, "")}\n`;
}
