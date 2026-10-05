import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reporte de cierre de la carga de los paquetes de los tours (spec M1-04d
 * §3 #10), para el owner: por paquete, cuántos servicios quedaron con
 * proveedor y mail, cuántos por WhatsApp, cuántos manuales (Kupos) y la
 * lista de los que siguen sin resolver, con su motivo. Se arma leyendo la
 * base después de la carga (lo que quedó guardado, no lo que se planeó).
 *
 * La unidad es la opción de servicio (una fila de `producto_servicio`): cada
 * hotel de una lista "/" es un pedido posible a un proveedor.
 */

export interface ContactoProveedor {
  nombre: string;
  mails: string[] | null;
  canal: string | null;
  telefono: string | null;
  ciudad: string | null;
}

export interface ServicioCargado {
  codigo: string;
  producto: string;
  destino: string | null;
  orden: number;
  prioridad: number;
  tipo_servicio: string;
  nivel: string | null;
  fila_excel: number | null;
  descripcion: string;
  service_provider_nombre: string;
  booking_supplier_nombre: string | null;
  opcional: boolean;
  reserva_manual: boolean;
  proveedor_sin_resolver: boolean;
  proveedor_para_revisar: boolean;
  proveedor_nota: string | null;
  /** El Booking Supplier del directorio (a quien se le pide la reserva). */
  proveedor: ContactoProveedor | null;
}

export type EstadoServicio = "mail" | "whatsapp" | "manual" | "sin_resolver" | "sin_contacto";

export function clasificarServicio(s: ServicioCargado): EstadoServicio {
  if (s.reserva_manual) return "manual";
  if (!s.proveedor) return "sin_resolver";
  if (s.proveedor.canal === "whatsapp") return "whatsapp";
  if ((s.proveedor.mails ?? []).length > 0) return "mail";
  return "sin_contacto";
}

export interface ConteoPaquete {
  codigo: string;
  producto: string;
  destino: string | null;
  servicios: number;
  mail: number;
  whatsapp: number;
  manual: number;
  sinResolver: number;
  sinContacto: number;
}

export interface PendienteCarga {
  codigo: string;
  fila: number | null;
  descripcion: string;
  serviceProvider: string;
  bookingSupplier: string | null;
  motivo: string;
}

export interface ResumenCarga {
  porPaquete: ConteoPaquete[];
  totales: Omit<ConteoPaquete, "codigo" | "producto" | "destino">;
  /** Sin resolver + proveedores sin mail ni WhatsApp: a quién todavía no se le puede pedir. */
  sinResolver: PendienteCarga[];
  servicios: ServicioCargado[];
}

function motivo(s: ServicioCargado, estado: EstadoServicio): string {
  if (estado === "sin_contacto") return `"${s.proveedor!.nombre}" está en el directorio sin mail ni WhatsApp`;
  if (s.proveedor_nota) return s.proveedor_nota;
  if (s.booking_supplier_nombre === null) return "el Excel no dice a quién reservarle (no tiene \"Booking Supplier\")";
  return `"${s.booking_supplier_nombre}" no está en el directorio ni en las equivalencias de ${s.destino ?? "su destino"}`;
}

export function resumirCarga(servicios: ServicioCargado[]): ResumenCarga {
  const porCodigo = new Map<string, ConteoPaquete>();
  const sinResolver: PendienteCarga[] = [];
  const totales = { servicios: 0, mail: 0, whatsapp: 0, manual: 0, sinResolver: 0, sinContacto: 0 };
  for (const s of servicios) {
    const c =
      porCodigo.get(s.codigo) ??
      { codigo: s.codigo, producto: s.producto, destino: s.destino, servicios: 0, mail: 0, whatsapp: 0, manual: 0, sinResolver: 0, sinContacto: 0 };
    porCodigo.set(s.codigo, c);
    const estado = clasificarServicio(s);
    const campo = estado === "sin_resolver" ? "sinResolver" : estado === "sin_contacto" ? "sinContacto" : estado;
    c.servicios++;
    c[campo]++;
    totales.servicios++;
    totales[campo]++;
    if (estado === "sin_resolver" || estado === "sin_contacto") {
      sinResolver.push({
        codigo: s.codigo,
        fila: s.fila_excel,
        descripcion: s.descripcion.split("\n")[0],
        serviceProvider: s.service_provider_nombre,
        bookingSupplier: s.booking_supplier_nombre,
        motivo: motivo(s, estado),
      });
    }
  }
  return { porPaquete: [...porCodigo.values()], totales, sinResolver, servicios };
}

function celda(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\|/g, "/").replace(/\n/g, " ");
}

function contacto(s: ServicioCargado): string {
  const estado = clasificarServicio(s);
  if (estado === "manual") return "manual (no se le escribe)";
  if (estado === "sin_resolver") return "**sin resolver**";
  if (estado === "whatsapp") return `WhatsApp${s.proveedor!.telefono ? ` ${s.proveedor!.telefono}` : ""}`;
  if (estado === "sin_contacto") return "**sin mail ni WhatsApp**";
  return (s.proveedor!.mails ?? []).join(", ");
}

export function reporteCargaMarkdown(
  r: ResumenCarga,
  meta: { fecha: string; archivo: string; otrosPuntos: string[] },
): string {
  const t = r.totales;
  const l: string[] = [];
  l.push("# Carga de los paquetes de los 7 tours (M1-04d)");
  l.push("");
  l.push(
    `Cargué en el sistema los paquetes de un destino de los 7 tours desde **${meta.archivo}** (${meta.fecha}). ` +
      "Cada servicio de cada paquete ya sabe a qué proveedor pedírselo, salvo los de la lista de abajo.",
  );
  l.push("");
  l.push(
    `- Paquetes: ${r.porPaquete.length}. Servicios (cada opción de hotel o excursión cuenta una vez): ${t.servicios}.`,
  );
  l.push(`- Con proveedor y mail: **${t.mail}**.`);
  l.push(`- Por WhatsApp (el pedido lo hace una persona): **${t.whatsapp}**.`);
  l.push(`- Manuales, no se le escribe a nadie (se reservan a mano en el sistema de ellos: Kupos.cl, Buquebus, Transvipp): **${t.manual}**.`);
  l.push(`- Sin resolver: **${t.sinResolver}**${t.sinContacto ? `; y ${t.sinContacto} con proveedor pero sin mail ni WhatsApp` : ""}.`);
  l.push("");
  l.push("## Por paquete");
  l.push("");
  l.push("| Paquete | Destino | Servicios | Con mail | WhatsApp | Manual | Sin resolver | Sin contacto |");
  l.push("|---|---|---|---|---|---|---|---|");
  for (const p of r.porPaquete) {
    l.push(
      `| ${p.codigo} | ${p.destino ?? ""} | ${p.servicios} | ${p.mail} | ${p.whatsapp} | ${p.manual} | ${p.sinResolver} | ${p.sinContacto} |`,
    );
  }
  l.push("");
  l.push("## Lo que sigue sin resolver");
  l.push("");
  if (r.sinResolver.length === 0) {
    l.push("Nada: todos los servicios saben a quién pedírselos.");
  } else {
    l.push("Estos servicios todavía no saben a quién escribirle. Cuando completes el dato en el Excel de proveedores, alcanza con volver a correr la importación.");
    l.push("");
    for (const s of r.sinResolver) {
      l.push(
        `- [ ] **${s.codigo}**${s.fila ? ` (fila ${s.fila})` : ""}: ${celda(s.serviceProvider)} → ${s.bookingSupplier ? `«${celda(s.bookingSupplier)}»` : "(sin Booking Supplier)"}. ${celda(s.motivo)}.`,
      );
    }
  }
  if (meta.otrosPuntos.length) {
    l.push("");
    l.push("## Otros puntos para revisar");
    l.push("");
    for (const o of meta.otrosPuntos) l.push(`- [ ] ${o}`);
  }
  l.push("");
  l.push("## Detalle: servicio → nivel → opción → a quién se le pide → contacto");
  for (const p of r.porPaquete) {
    l.push("");
    l.push(`### ${p.codigo} · ${p.producto}`);
    l.push("");
    l.push("| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |");
    l.push("|---|---|---|---|---|---|---|---|");
    for (const s of r.servicios.filter((x) => x.codigo === p.codigo)) {
      const tipo = `${s.tipo_servicio}${s.opcional ? " (opcional)" : ""}`;
      l.push(
        `| ${s.fila_excel ?? ""} | ${tipo} | ${celda(s.nivel) || "—"} | ${s.prioridad} | ${celda(s.service_provider_nombre)} | ${celda(s.booking_supplier_nombre) || "—"} | ${celda(s.proveedor?.nombre) || "—"} | ${celda(contacto(s))} |`,
      );
    }
  }
  l.push("");
  return l.join("\n");
}

/** Lee de la base los servicios de esos productos, con el contacto de su Booking Supplier. */
export async function leerServiciosCargados(admin: SupabaseClient, codigos: string[]): Promise<ServicioCargado[]> {
  const { data: productos, error } = await admin.from("producto").select("id, codigo, nombre, destino").in("codigo", codigos);
  if (error) throw new Error(`No se pudo leer producto: ${error.message}`);
  const porId = new Map((productos ?? []).map((p) => [p.id as string, p]));
  const { data, error: e } = await admin
    .from("producto_servicio")
    .select(
      "producto_id, orden, prioridad, tipo_servicio, nivel, fila_excel, descripcion, service_provider_nombre, booking_supplier_nombre, opcional, reserva_manual, proveedor_sin_resolver, proveedor_para_revisar, proveedor_nota, proveedor:booking_supplier_id(nombre, mails, canal, telefono, ciudad)",
    )
    .in("producto_id", [...porId.keys()])
    .not("orden", "is", null)
    .range(0, 9999);
  if (e) throw new Error(`No se pudo leer producto_servicio: ${e.message}`);
  const orden = new Map(codigos.map((c, i) => [c, i]));
  return ((data ?? []) as unknown as Array<Omit<ServicioCargado, "codigo" | "producto" | "destino"> & { producto_id: string }>)
    .map(({ producto_id, ...f }) => {
      const p = porId.get(producto_id)!;
      return { ...f, codigo: p.codigo as string, producto: p.nombre as string, destino: (p.destino as string) ?? null };
    })
    .sort((a, b) => (orden.get(a.codigo) ?? 0) - (orden.get(b.codigo) ?? 0) || a.orden - b.orden || a.prioridad - b.prioridad);
}
