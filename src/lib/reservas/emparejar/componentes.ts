import { diaDeServicioDelTour } from "@/lib/catalogo/reglas";
import type { ComponenteTour, DetalleProducto, Servicio } from "@/lib/catalogo/tipos";
import type { FichaLectura } from "../esquema-ficha";
import type { ComponenteEntrada } from "../tipos";

/**
 * Las partes de un tour compuesto para `reserva_componente` (spec M2-03 filas
 * 9 y 10), en orden y con fecha real (inicio + día del tour - 1):
 *
 * - cada paquete, como pedido a sus proveedores (un tour dentro de otro, como
 *   CHB31 en 5C01, se abre en sus paquetes);
 * - cada tramo de bus público y cada bus del tour que se emite a mano (Kupos,
 *   Plataforma10: `reserva_manual`) es una **tarea** "emitir boleto", sin
 *   proveedor;
 * - el bus que reserva un proveedor (Uyuni – La Paz con Imperio Inca) va como
 *   `servicio` del tour, con su proveedor;
 * - final de ARCH31/ARCH33 (DECISIONS 2026-10-06): si el pasajero vuela desde
 *   Puerto Natales, el bus a Punta Arenas se cambia por el transfer al
 *   aeropuerto PNT (Patagonia Planet).
 *
 * Lee el detalle del catálogo (`cargarProducto`, con los ajustes de M1-08);
 * no escribe nada.
 */

/** Quien hace el transfer al aeropuerto de Puerto Natales (DECISIONS 2026-10-06). */
export const PROVEEDOR_TRANSFER_PNT = "Patagonia Planet";
export const TRANSFER_PNT = "Transfer al aeropuerto de Puerto Natales (PNT)";
/** El bus del final de ARCH31/ARCH33 lleva la alternativa en su descripción (M1-05). */
const BUS_CON_ALTERNATIVA_PNT = /aeropuerto de Puerto Natales/i;

const VUELO_DESDE_PNT = /puerto\s+natales|\bPNT\b/i;
const HABLA_DE_VUELO = /flight|fly|flies|vuelo|airport|aeropuerto/i;

/** Fila 10: hay un vuelo que sale de PNT, o el mail dice que vuelan desde Puerto Natales. */
export function saleDePuertoNatales(ficha: Pick<FichaLectura, "vuelos" | "pedidos_especiales">): boolean {
  if (ficha.vuelos.some((v) => (v.origen ?? "").toUpperCase() === "PNT")) return true;
  return ficha.pedidos_especiales.some((p) => VUELO_DESDE_PNT.test(p.texto) && HABLA_DE_VUELO.test(p.texto));
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "Bus Uyuni – La Paz (nocturno, sale el día 6 del tour). Booking…" → "Bus Uyuni – La Paz". */
function rutaDelBus(s: Servicio): string {
  return (s.descripcion ?? "").split(/\s*[(.]/)[0].trim();
}

export interface OpcionesComponentes {
  finalPuertoNatales: boolean;
  /** El proveedor del transfer al aeropuerto PNT (Patagonia Planet), si está en el directorio. */
  proveedorTransferPNT: { id: string; nombre: string } | null;
}

interface Item {
  dia: number;
  /** Los buses del tour van antes que los paquetes del mismo día (se llega en ese bus). */
  primero: boolean;
  seq: number;
  parte: ComponenteEntrada;
}

export function componentesDeLaReserva(
  detalle: DetalleProducto,
  fechaInicio: string | null,
  opciones: OpcionesComponentes,
): ComponenteEntrada[] {
  if (!detalle.esTour || detalle.componentes.length === 0) return [];
  const items: Item[] = [];
  let seq = 0;
  const fecha = (dia: number, mas = 0) => (fechaInicio ? sumarDias(fechaInicio, dia - 1 + mas) : null);

  const busesDelTour = (servicios: Servicio[], desfase: number) => {
    // Una fila por servicio (las alternativas "/" del mismo orden no se repiten).
    const porOrden = new Map<string, Servicio>();
    for (const s of servicios) {
      if (s.tipo !== "bus") continue;
      const clave = String(s.orden ?? s.id);
      const previo = porOrden.get(clave);
      if (!previo || s.prioridad < previo.prioridad) porOrden.set(clave, s);
    }
    for (const s of porOrden.values()) {
      const diaTour = diaDeServicioDelTour(s.descripcion);
      if (diaTour === null) continue;
      const dia = diaTour + desfase;
      const nocturno = /nocturno/i.test(s.descripcion ?? "");
      const base = { productoServicioId: s.id, fechaInicio: fecha(dia), fechaFin: fecha(dia, nocturno ? 1 : 0) };
      let parte: ComponenteEntrada;
      if (BUS_CON_ALTERNATIVA_PNT.test(s.descripcion ?? "") && opciones.finalPuertoNatales) {
        parte = { ...base, tipo: "servicio", descripcionRuta: TRANSFER_PNT, esTarea: false, proveedorId: opciones.proveedorTransferPNT?.id ?? null, fechaFin: fecha(dia) };
      } else if (s.reservaManual) {
        parte = { ...base, tipo: "tramo_bus", descripcionRuta: rutaDelBus(s), esTarea: true, proveedorId: null };
      } else {
        parte = { ...base, tipo: "servicio", descripcionRuta: rutaDelBus(s), esTarea: false, proveedorId: s.bookingSupplier?.id ?? null };
      }
      items.push({ dia, primero: true, seq: seq++, parte });
    }
  };

  const recorrer = (componentes: ComponenteTour[], servicios: Servicio[], desfase: number) => {
    busesDelTour(servicios, desfase);
    for (const c of componentes) {
      const dia = (c.diaDesde ?? 1) + desfase;
      if (c.tipo === "tramo_bus") {
        items.push({
          dia,
          primero: false,
          seq: seq++,
          parte: {
            tipo: "tramo_bus",
            descripcionRuta: c.descripcionRuta,
            esTarea: true,
            proveedorId: null,
            fechaInicio: fecha(dia),
            fechaFin: fecha(dia, c.nocturno ? 1 : 0),
          },
        });
        continue;
      }
      if (!c.producto) continue;
      const adentro = c.producto.esTour && c.producto.componentes?.length ? c.producto.componentes : null;
      if (adentro) {
        recorrer(adentro, c.producto.servicios, dia - 1);
        continue;
      }
      items.push({
        dia,
        primero: false,
        seq: seq++,
        parte: {
          tipo: "paquete",
          productoId: c.producto.id,
          productoComponenteId: c.id ?? null,
          esTarea: false,
          fechaInicio: fecha(dia),
          fechaFin: fecha(dia, c.noches ?? 0),
        },
      });
    }
  };

  recorrer(detalle.componentes, detalle.servicios, 0);
  return items
    .sort((a, b) => a.dia - b.dia || Number(b.primero) - Number(a.primero) || a.seq - b.seq)
    .map((i) => i.parte);
}
