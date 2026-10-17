import type { ProveedorDelReporte } from "./importar";
import type { PlanJournaway, ProductoJournaway, ServicioJournaway } from "./plan";
import { CIUDAD_DE_DESTINO } from "./planilla";
import type { FilaProveedorJournaway } from "./proveedores";

/**
 * El reporte para el owner de la carga del catálogo de Journaway (spec M2-08
 * §3 #12), en llano: cuántos productos por destino, a quién se le pide cada
 * uno, los paquetes armados, lo que no se vende suelto, lo que falta (con la
 * fila concreta a agregar al Excel de proveedores), lo que se hace a mano y
 * los nombres con que Journaway escribe cada producto. Sin jerga ni rutas.
 */

const ORDEN_DESTINOS = ["SPA", "UYU", "IGR", "PUQ", "PNT", "FTE", "CHA", "USH", "IPC"];

function ciudad(destino: string): string {
  return CIUDAD_DE_DESTINO[destino] ?? destino;
}

function porDestino(a: ProductoJournaway, b: ProductoJournaway): number {
  const i = (d: string) => (ORDEN_DESTINOS.indexOf(d) === -1 ? ORDEN_DESTINOS.length : ORDEN_DESTINOS.indexOf(d));
  return i(a.destino) - i(b.destino) || a.codigo.localeCompare(b.codigo);
}

function aQuien(s: ServicioJournaway, proveedores: Map<string, ProveedorDelReporte>): string {
  if (s.reserva_manual) return `a mano en ${s.booking_supplier_nombre}`;
  if (s.booking_supplier_id) {
    const p = proveedores.get(s.booking_supplier_id);
    const nombre = p?.nombre ?? s.booking_supplier_nombre;
    const contacto = p && p.mails.length ? p.mails.join(", ") : p?.canal === "whatsapp" ? "por WhatsApp" : "sin mail";
    return `${nombre} (${contacto})`;
  }
  if (s.proveedor_nota?.startsWith("Cambió en la planilla")) return `falta: revisar el cambio de la planilla («${s.booking_supplier_nombre}»)`;
  return `falta: «${s.booking_supplier_nombre}» no está en el Excel de proveedores`;
}

/** A quién se le piden los servicios de un producto simple: las opciones en orden ("si no hay lugar, …"). */
function aQuienProducto(p: ProductoJournaway, proveedores: Map<string, ProveedorDelReporte>): string {
  const porServicio = new Map<number, ServicioJournaway[]>();
  for (const s of p.servicios) porServicio.set(s.orden, [...(porServicio.get(s.orden) ?? []), s]);
  const textos = [...porServicio.values()].map((opciones) =>
    opciones
      .sort((a, b) => a.prioridad - b.prioridad)
      .map((s, i) => (i === 0 ? aQuien(s, proveedores) : `si no hay lugar, ${aQuien(s, proveedores)}`))
      .join("; "),
  );
  return [...new Set(textos)].join(" · ");
}

function escapar(texto: string): string {
  return texto.replace(/\|/g, "/").replace(/\n/g, " ");
}

export function reporteJournawayMarkdown(datos: {
  fecha: string;
  plan: PlanJournaway;
  proveedores: Map<string, ProveedorDelReporte>;
  filasProveedores: FilaProveedorJournaway[];
}): string {
  const { plan, proveedores } = datos;
  const productos = [...plan.productos].sort(porDestino);
  const porCodigo = new Map(productos.map((p) => [p.codigo, p]));
  const armados = productos.filter((p) => p.componentes.length > 0);
  const simples = productos.filter((p) => p.componentes.length === 0);
  const celestes = productos.filter((p) => p.celeste);
  const l: string[] = [];

  l.push("# Catálogo de Journaway: qué se cargó");
  l.push("");
  l.push(`Carga del ${datos.fecha}, desde la planilla de productos de Journaway que completaste, el tarifario 2027 y los mails de ejemplo.`);
  l.push("");
  l.push(
    `Se cargaron **${productos.length} productos**: ${celestes.length} que Journaway pide de verdad (los celestes de la planilla), ` +
      `${productos.filter((p) => !p.celeste && !p.interno).length} que solo van dentro de un paquete, ` +
      `${productos.filter((p) => p.interno).length} interno (el Overland privado con los Tayka) y, entre todos, ${armados.length} paquetes armados con sus partes.`,
  );
  l.push("");
  l.push("En el catálogo de la app, escribí «journaway» en el buscador para verlos a todos: llevan el chip «Journaway».");

  // --- por destino ---
  l.push("");
  l.push("## Cuántos productos por destino");
  l.push("");
  l.push("| Destino | Productos |");
  l.push("|---|---|");
  const cuenta = new Map<string, number>();
  for (const p of productos) cuenta.set(p.destino, (cuenta.get(p.destino) ?? 0) + 1);
  for (const [destino, n] of [...cuenta.entries()].sort((a, b) => ORDEN_DESTINOS.indexOf(a[0]) - ORDEN_DESTINOS.indexOf(b[0]))) {
    l.push(`| ${ciudad(destino)} | ${n} |`);
  }

  // --- a quién ---
  l.push("");
  l.push("## A quién se le pide cada uno");
  l.push("");
  l.push("| Código | Producto | A quién se le pide |");
  l.push("|---|---|---|");
  for (const p of simples) l.push(`| ${p.codigo} | ${escapar(p.nombre)} | ${escapar(aQuienProducto(p, proveedores))} |`);
  for (const p of armados) l.push(`| ${p.codigo} | ${escapar(p.nombre)} | cada parte a su proveedor (ver los paquetes armados) |`);

  // --- armados ---
  l.push("");
  l.push("## Los paquetes armados");
  l.push("");
  l.push("Cada paquete es la suma de sus excursiones y traslados, en el orden del tarifario. Ninguno lleva alojamiento.");
  for (const p of armados) {
    l.push("");
    l.push(`**${p.codigo}** · ${p.nombre}`);
    l.push("");
    for (const c of p.componentes) {
      const parte = porCodigo.get(c.codigo)!;
      const ajuste = p.ajustes.find((a) => a.paquete === c.codigo);
      const lado = ajuste ? (ajuste.accion === "solo_llegada" ? " (solo la llegada)" : " (solo la salida)") : "";
      l.push(`- Día ${c.dia}: ${parte.nombre}${lado} · ${c.codigo}, ${aQuienProducto(parte, proveedores)}`);
    }
  }

  // --- no se vende suelto ---
  l.push("");
  l.push("## Lo que no se vende suelto a Journaway");
  l.push("");
  l.push("Van solo dentro de un paquete. Su código es interno: Journaway no lo pone en la reserva.");
  l.push("");
  for (const p of productos.filter((x) => !x.celeste)) {
    const usos = armados.filter((a) => a.componentes.some((c) => c.codigo === p.codigo)).map((a) => a.codigo);
    l.push(`- **${p.codigo}** · ${p.nombre}${usos.length ? ` (va en ${usos.join(", ")})` : ""}`);
  }

  // --- falta ---
  l.push("");
  l.push("## Falta el proveedor");
  l.push("");
  const faltan = simples.filter((p) => p.servicios.some((s) => s.proveedor_sin_resolver));
  if (faltan.length === 0) {
    l.push("Ninguno: todos los productos saben a quién se le piden.");
  } else {
    l.push("Mientras falte, la app los muestra como pendientes y no se les puede armar el pedido.");
    const grupos = new Map<string, ProductoJournaway[]>();
    for (const p of faltan) {
      const s = p.servicios.find((x) => x.proveedor_sin_resolver)!;
      const clave = s.proveedor_nota?.startsWith("Cambió en la planilla") ? `cambio|${p.codigo}` : `falta|${s.booking_supplier_nombre}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
    }
    for (const [clave, lista] of grupos) {
      l.push("");
      const [tipo, nombre] = clave.split("|");
      const items = lista.map((p) => `${p.codigo} (${p.nombre})`).join(", ");
      if (tipo === "cambio") {
        const s = lista[0].servicios.find((x) => x.proveedor_sin_resolver)!;
        l.push(`- **Revisar ${nombre}:** ${s.proveedor_nota}`);
        continue;
      }
      const notas = datos.filasProveedores.filter((f) => f.proveedor === nombre && lista.some((p) => p.codigo === f.codigo)).map((f) => f.nota ?? "");
      const mails = [...new Set(notas.flatMap((n) => n.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []))];
      l.push(
        `- **Agregar en el Excel de proveedores una fila «${nombre}»**${mails.length ? ` con el mail ${mails.join(", ")}` : " con su mail"}, para: ${items}.`,
      );
    }
  }

  // --- manuales ---
  l.push("");
  l.push("## Lo que se hace a mano");
  l.push("");
  l.push("No se le escribe a nadie: alguien de HI Travel lo saca en el sistema de cada uno.");
  l.push("");
  const manuales = new Map<string, string[]>();
  for (const p of simples) {
    for (const s of p.servicios.filter((x) => x.reserva_manual)) {
      manuales.set(s.booking_supplier_nombre, [...new Set([...(manuales.get(s.booking_supplier_nombre) ?? []), p.codigo])]);
    }
  }
  for (const [sistema, codigos] of manuales) {
    const alternativas = codigos.flatMap((c) =>
      porCodigo.get(c)!.servicios.filter((s) => s.prioridad > 1).map((s) => aQuien(s, proveedores)),
    );
    l.push(`- **${sistema}:** ${codigos.join(", ")}${alternativas.length ? `. Si no hay lugar: ${[...new Set(alternativas)].join("; ")}` : ""}.`);
  }

  // --- nombres ---
  l.push("");
  l.push("## Los nombres de Journaway");
  l.push("");
  l.push(
    "Con estos nombres la app va a reconocer cada producto cuando llegue una reserva de Journaway. " +
      "Los celestes llevan además su código, porque le pediste a Journaway que lo ponga en cada reserva.",
  );
  l.push("");
  for (const p of productos) {
    const lista = p.nombres.map((n) => `«${n.nombre}» (${n.origen})`).join(", ");
    l.push(`- **${p.codigo}**${p.celeste ? ` (código ${p.codigo})` : ""}: ${lista}`);
  }
  const sinMail = productos.filter((p) => !p.nombres.some((n) => n.origen === "mail de ejemplo"));
  l.push("");
  l.push("### Sin ningún nombre de mail todavía");
  l.push("");
  l.push(
    "Para estos todavía no hay un mail de ejemplo: la app los reconoce por su código o por el nombre del tarifario. " +
      "Cuando llegue la primera reserva de cada uno, se suma el nombre con que la escribe Journaway.",
  );
  l.push("");
  l.push(sinMail.map((p) => p.codigo).join(", "));
  l.push("");
  return l.join("\n");
}
