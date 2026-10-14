import type { SupabaseClient } from "@supabase/supabase-js";
import type { FilaLlamadaIA, RegistroLlamadasIA } from "@/lib/ia/registro-llamadas";
import { cargarProducto } from "@/lib/catalogo/consultas";
import type { DetalleProducto } from "@/lib/catalogo/tipos";
import type { FichaLectura, ProductoIA } from "../esquema-ficha";
import type { ResultadoLectura } from "../extraer";
import { crearReserva } from "../guardar";
import type { ComponenteEntrada, Reserva, ReservaComponente, ReservaEntrada } from "../tipos";
import type { LectorDeAgencia } from "./agencias";
import { cargarCatalogoParaEmparejar, type CatalogoParaEmparejar } from "./catalogo";
import { componentesDeLaReserva, PROVEEDOR_TRANSFER_PNT, saleDePuertoNatales } from "./componentes";
import { emparejarProducto, type ProponerProducto, type ResultadoEmparejado } from "./emparejar";
import { MOTIVOS_EMPAREJADO as M } from "./motivos";
import { motivosDeVuelos } from "./vuelos-requeridos";

/**
 * De la ficha de M2-02 a las reservas (spec M2-03 filas 8, 13 y 14): una
 * reserva por producto, con el mismo booking_id, cada una con su estado. Con
 * producto reconocido y sin motivos queda "recibida"; con uno o más motivos,
 * "para revisión" con todos. Solo las "reserva nueva" se emparejan del todo
 * (con IA, partes y vuelos); el resto queda para revisión.
 *
 * `armarReservas` no toca la base (sus dependencias se inyectan);
 * `crearReservasDelMail` las guarda (`crearReserva` de M2-01, que agrega la
 * entrada "creada" del historial con autor "el sistema") y registra cada
 * llamada a la IA con su reserva. Nunca escribe en el catálogo (fila 16).
 */

export interface DependenciasReservas {
  catalogo: CatalogoParaEmparejar;
  /** El detalle de un producto (`cargarProducto`, con los ajustes de M1-08). */
  detalle: (productoId: string) => Promise<DetalleProducto>;
  proponer?: ProponerProducto;
  proveedorTransferPNT: { id: string; nombre: string } | null;
  lectores?: Readonly<Record<string, LectorDeAgencia>>;
}

export type EntradaArmada = Omit<ReservaEntrada, "mailRecibidoId" | "dePrueba" | "motivosRevision"> & {
  motivosRevision: string[];
  productoId: string | null;
  componentes: ComponenteEntrada[];
};

export interface ReservaArmada {
  entrada: EntradaArmada;
  /** Las llamadas a la IA de esta reserva, para registrarlas con su id. */
  llamadas: FilaLlamadaIA[];
  costo: number;
}

const textoAgencia = (p: Pick<ProductoIA, "nombre" | "codigo">) =>
  p.codigo && p.nombre ? `${p.nombre} (${p.codigo})` : (p.codigo ?? p.nombre);

function base(ficha: FichaLectura | null, agencia: string): Omit<EntradaArmada, "estado"> {
  return {
    agencia,
    bookingId: ficha?.numero_reserva.limpio ?? null,
    productoId: null,
    productoTextoAgencia: null,
    fechaInicio: ficha?.fecha_inicio.valor ?? null,
    fechaFin: ficha?.fecha_fin.valor ?? null,
    pax: ficha?.pax.valor && ficha.pax.valor > 0 ? ficha.pax.valor : null,
    pasajeros: ficha?.pasajeros ?? [],
    vuelos: ficha?.vuelos ?? [],
    habitacion: null,
    pedidosEspeciales: ficha?.pedidos_especiales.length ? ficha.pedidos_especiales.map((p) => p.texto).join("\n") : null,
    motivosRevision: [],
    datosExtraidos: ficha,
    origenEmparejado: null,
    confianzaEmparejado: null,
    sugerenciaProductoId: null,
    componentes: [],
  };
}

function cerrar(entrada: Omit<EntradaArmada, "estado">): EntradaArmada {
  const motivos = [...new Set(entrada.motivosRevision)];
  return { ...entrada, motivosRevision: motivos, estado: motivos.length ? "para_revision" : "recibida" };
}

export async function armarReservas(
  lectura: FichaLectura | ResultadoLectura,
  deps: DependenciasReservas,
  opciones: { agencia?: string } = {},
): Promise<ReservaArmada[]> {
  if ("estado" in lectura && lectura.estado === "para_revision") {
    const entrada = base(null, opciones.agencia ?? "desconocida");
    entrada.motivosRevision = [M.lecturaFallida(lectura.motivo)];
    return [{ entrada: cerrar(entrada), llamadas: [], costo: 0 }];
  }
  const ficha: FichaLectura = "estado" in lectura ? lectura.ficha : lectura;
  const agencia = ficha.agencia.valor ?? opciones.agencia ?? "desconocida";
  const tipo = ficha.tipo_mail.valor;
  const dudosos = ficha.datos_dudosos.length ? [M.dudosos(ficha.datos_dudosos)] : [];

  if (ficha.productos.length === 0) {
    const entrada = base(ficha, agencia);
    entrada.motivosRevision = [tipo === "reserva_nueva" ? M.sinProducto : M.tipoMail[tipo], ...dudosos];
    return [{ entrada: cerrar(entrada), llamadas: [], costo: 0 }];
  }

  const armadas: ReservaArmada[] = [];
  for (const p of ficha.productos) {
    const entrada = base(ficha, agencia);
    entrada.productoTextoAgencia = textoAgencia(p);
    entrada.fechaInicio = p.fecha_inicio ?? (ficha.productos.length === 1 ? entrada.fechaInicio : null);
    entrada.fechaFin = p.fecha_fin ?? (ficha.productos.length === 1 ? entrada.fechaFin : null);
    entrada.habitacion = p.habitacion;
    const pedido = { nombre: p.nombre, codigo: p.codigo, fechaInicio: p.fecha_inicio, fechaFin: p.fecha_fin };

    // Fila 13: lo que no es una reserva nueva no gasta IA ni arma partes (pasos 1 y 2 sí, son gratis).
    const r: ResultadoEmparejado = await emparejarProducto(pedido, {
      agencia,
      catalogo: deps.catalogo,
      proponer: tipo === "reserva_nueva" ? deps.proponer : undefined,
      lectores: deps.lectores,
    });

    const motivos: string[] = [];
    if (tipo !== "reserva_nueva") {
      motivos.push(M.tipoMail[tipo]);
    } else if (!r.producto) {
      motivos.push(r.motivo!);
    }
    if (r.producto) {
      entrada.productoId = r.producto.id;
      entrada.origenEmparejado = r.origen;
      entrada.confianzaEmparejado = r.confianza;
    }
    entrada.sugerenciaProductoId = r.sugerencia?.producto.id ?? null;

    if (r.producto && tipo === "reserva_nueva") {
      const detalle = await deps.detalle(r.producto.id);
      const finalPuertoNatales = saleDePuertoNatales(ficha);
      entrada.componentes = componentesDeLaReserva(detalle, entrada.fechaInicio ?? null, {
        finalPuertoNatales,
        proveedorTransferPNT: deps.proveedorTransferPNT,
      });
      motivos.push(
        ...motivosDeVuelos(detalle, {
          vuelos: ficha.vuelos,
          pedidos: ficha.pedidos_especiales.map((x) => x.texto),
          producto: { ...p, fecha_inicio: entrada.fechaInicio ?? null, fecha_fin: entrada.fechaFin ?? null },
          finalPuertoNatales,
        }),
      );
      if (!entrada.fechaInicio) motivos.push(M.sinFechaInicio);
    }
    entrada.motivosRevision = [...motivos, ...dudosos];
    armadas.push({ entrada: cerrar(entrada), llamadas: r.llamada ? [r.llamada] : [], costo: r.costo });
  }
  return armadas;
}

/**
 * Crea las reservas del mail en la base y registra cada llamada a la IA con su
 * reserva. Una reserva que no se pudo crear corta (el error sube); las
 * llamadas ya hechas se registran igual, sin reserva.
 */
export async function crearReservasDelMail(
  lectura: FichaLectura | ResultadoLectura,
  opciones: {
    admin: SupabaseClient;
    mailRecibidoId: string;
    agencia: string;
    deps: DependenciasReservas;
    llamadas?: RegistroLlamadasIA;
    dePrueba?: boolean;
  },
): Promise<Array<{ reserva: Reserva; componentes: ReservaComponente[]; costo: number }>> {
  const armadas = await armarReservas(lectura, opciones.deps, { agencia: opciones.agencia });
  const creadas: Array<{ reserva: Reserva; componentes: ReservaComponente[]; costo: number }> = [];
  const pendientes = armadas.flatMap((a) => a.llamadas);
  try {
    for (const a of armadas) {
      const { reserva, componentes } = await crearReserva(
        { ...a.entrada, mailRecibidoId: opciones.mailRecibidoId, dePrueba: opciones.dePrueba ?? false },
        opciones.admin,
      );
      for (const l of a.llamadas) {
        await opciones.llamadas?.registrar({ ...l, reservaId: reserva.id, dePrueba: opciones.dePrueba ?? l.dePrueba });
        pendientes.splice(pendientes.indexOf(l), 1);
      }
      creadas.push({ reserva, componentes, costo: a.costo });
    }
  } finally {
    for (const l of pendientes) await opciones.llamadas?.registrar({ ...l, reservaId: null });
  }
  return creadas;
}

/**
 * Las dependencias reales: el catálogo de la base, el detalle de cada
 * producto con la misma lectura que la pantalla (`cargarProducto`) y el
 * proveedor del transfer al aeropuerto PNT (Patagonia Planet, DECISIONS
 * 2026-10-06). Solo lectura.
 */
export async function cargarDependenciasReservas(
  admin: SupabaseClient,
  proponer?: ProponerProducto,
): Promise<DependenciasReservas> {
  const [catalogo, proveedor] = await Promise.all([
    cargarCatalogoParaEmparejar(admin),
    admin.from("proveedor").select("id,nombre").ilike("nombre", PROVEEDOR_TRANSFER_PNT).limit(1).maybeSingle(),
  ]);
  if (proveedor.error) throw new Error(`No se pudo leer el proveedor del transfer a PNT: ${proveedor.error.message}`);
  return {
    catalogo,
    detalle: (id) => cargarProducto(admin, id),
    proponer,
    proveedorTransferPNT: (proveedor.data as { id: string; nombre: string } | null) ?? null,
  };
}
