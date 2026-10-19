import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComponenteEntrada, ContactoDelCliente, HotelDeLaAgencia, ReservaEntrada } from "../tipos";
import { ordenarPorFecha, partesNuevas, type ParteGuardada } from "./sumar";

/**
 * Owner 2026-10-17: un mail de pedido de Journaway con un ID ya cargado suma
 * sus tours a esa reserva (la acción "sumada" de M2-04). Acá se escriben:
 *
 * - las partes nuevas (sin duplicar el mismo producto en la misma fecha), y
 *   todas las partes vuelven a quedar en orden de fecha;
 * - el producto nuevo en `otros_productos` (o como producto, si no tenía);
 * - las fechas del viaje ampliadas, y las notas, los hoteles de la agencia,
 *   el número de viaje y el contacto que falten.
 *
 * Devuelve lo que hay que actualizar en `reserva` (lo hace quien llama, junto
 * con el estado) y qué se sumó, para el historial. No borra nada.
 */

interface ReservaJournawayGuardada {
  producto_id: string | null;
  otros_productos: string[] | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  notas: string[] | null;
  hoteles_agencia: HotelDeLaAgencia[] | null;
  trip_number: string | null;
  contacto_cliente: ContactoDelCliente | null;
}

const unicos = <T>(xs: T[]) => [...new Set(xs)];

export async function sumarTourJournaway(
  admin: SupabaseClient,
  reservaId: string,
  entrada: Pick<
    ReservaEntrada,
    "productoId" | "otrosProductos" | "origenEmparejado" | "confianzaEmparejado" | "fechaInicio" | "fechaFin" | "componentes" | "notas" | "hotelesAgencia" | "tripNumber" | "contactoCliente"
  >,
): Promise<{ actualizar: Record<string, unknown>; partesSumadas: number; productosSumados: string[] }> {
  const { data: r, error } = await admin
    .from("reserva")
    .select("producto_id,otros_productos,fecha_inicio,fecha_fin,notas,hoteles_agencia,trip_number,contacto_cliente")
    .eq("id", reservaId)
    .single();
  if (error) throw new Error(`No se pudo leer la reserva ${reservaId}: ${error.message}`);
  const actual = r as unknown as ReservaJournawayGuardada;

  const { data: filas, error: errorPartes } = await admin
    .from("reserva_componente")
    .select("id,orden,producto_id,fecha_inicio,texto_agencia")
    .eq("reserva_id", reservaId)
    .order("orden");
  if (errorPartes) throw new Error(`No se pudieron leer las partes de la reserva ${reservaId}: ${errorPartes.message}`);
  const guardadas = (filas ?? []) as Array<ParteGuardada & { id: string; orden: number }>;
  const nuevas = partesNuevas(guardadas, (entrada.componentes ?? []) as ComponenteEntrada[]);

  if (nuevas.length) {
    const maximo = guardadas.reduce((m, p) => Math.max(m, p.orden), 0);
    const { data: insertadas, error: errorInsertar } = await admin
      .from("reserva_componente")
      .insert(
        nuevas.map((c, i) => ({
          reserva_id: reservaId,
          orden: maximo + i + 1,
          tipo: c.tipo,
          producto_id: c.productoId ?? null,
          producto_componente_id: c.productoComponenteId ?? null,
          descripcion_ruta: c.descripcionRuta ?? null,
          texto_agencia: c.textoAgencia ?? null,
          fecha_inicio: c.fechaInicio ?? null,
          fecha_fin: c.fechaFin ?? null,
          es_tarea: c.esTarea ?? false,
          producto_servicio_id: c.productoServicioId ?? null,
          proveedor_id: c.proveedorId ?? null,
          ...(c.pickUp ? { pick_up: c.pickUp } : {}),
        })),
      )
      .select("id,orden,producto_id,fecha_inicio,texto_agencia");
    if (errorInsertar) throw new Error(`No se pudieron sumar las partes a la reserva ${reservaId}: ${errorInsertar.message}`);

    // Todas en orden de fecha: primero se corren fuera del rango (el orden es único por reserva) y después se numeran.
    const todas = ordenarPorFecha([...guardadas, ...((insertadas ?? []) as typeof guardadas)], (p) => p.fecha_inicio);
    const corrimiento = todas.length + maximo + 1000;
    for (const [i, p] of todas.entries()) {
      const { error: e1 } = await admin.from("reserva_componente").update({ orden: corrimiento + i }).eq("id", p.id);
      if (e1) throw new Error(`No se pudieron ordenar las partes de la reserva ${reservaId}: ${e1.message}`);
    }
    for (const [i, p] of todas.entries()) {
      const { error: e2 } = await admin.from("reserva_componente").update({ orden: i + 1 }).eq("id", p.id);
      if (e2) throw new Error(`No se pudieron ordenar las partes de la reserva ${reservaId}: ${e2.message}`);
    }
  }

  const actualizar: Record<string, unknown> = {};
  const otrosAntes = actual.otros_productos ?? [];
  const entrantes = [entrada.productoId, ...(entrada.otrosProductos ?? [])].filter((id): id is string => !!id);
  let principal = actual.producto_id;
  if (!principal && entrantes.length) {
    principal = entrantes[0];
    actualizar.producto_id = principal;
    actualizar.origen_emparejado = entrada.origenEmparejado ?? null;
    actualizar.confianza_emparejado = entrada.confianzaEmparejado ?? null;
  }
  const otros = unicos([...otrosAntes, ...entrantes]).filter((id) => id !== principal);
  const productosSumados = otros.filter((id) => !otrosAntes.includes(id));
  if (productosSumados.length) actualizar.otros_productos = otros;

  const fechas = [actual.fecha_inicio, actual.fecha_fin, entrada.fechaInicio, entrada.fechaFin].filter((f): f is string => !!f).sort();
  if (fechas.length && fechas[0] !== actual.fecha_inicio) actualizar.fecha_inicio = fechas[0];
  if (fechas.length && fechas[fechas.length - 1] !== actual.fecha_fin) actualizar.fecha_fin = fechas[fechas.length - 1];

  const notas = unicos([...(actual.notas ?? []), ...(entrada.notas ?? [])]);
  if (notas.length !== (actual.notas ?? []).length) actualizar.notas = notas;
  const hotelesAntes = actual.hoteles_agencia ?? [];
  const clave = (h: HotelDeLaAgencia) => `${h.nombre}|${h.desde ?? ""}|${h.hasta ?? ""}`;
  const hotelesNuevos = (entrada.hotelesAgencia ?? []).filter((h) => !hotelesAntes.some((x) => clave(x) === clave(h)));
  if (hotelesNuevos.length) actualizar.hoteles_agencia = [...hotelesAntes, ...hotelesNuevos];
  if (!actual.trip_number && entrada.tripNumber) actualizar.trip_number = entrada.tripNumber;
  if (!actual.contacto_cliente && entrada.contactoCliente) actualizar.contacto_cliente = entrada.contactoCliente;

  return { actualizar, partesSumadas: nuevas.length, productosSumados };
}
