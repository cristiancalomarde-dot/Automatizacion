/**
 * El renglón del vuelo de un traslado (spec M3-26 filas 1 y 2, owner 2026-10-28): el vuelo completo,
 * salida y llegada, no solo el lado que usa el traslado.
 *
 *   "Vuelo: AR 1234 – sale Buenos Aires (AEP) 18 mar 08:30 hs – llega Puerto Iguazú (IGR) 18 mar 10:20 hs"
 *   "Llegada: Foz do Iguaçu (IGU) 20 feb 16:45 hs (sin número de vuelo)"
 *
 * Lo que falta (aerolínea, aeropuerto, día, hora) se omite, sin huecos. La ciudad sale de los
 * aeropuertos de los traslados del catálogo (`AEROPUERTOS`); otro aeropuerto va con su código.
 * Puro: lo usan el armado (`armar.ts`) y el aviso de los pedidos ya enviados (`corregir/vuelos.ts`).
 */
import { AEROPUERTOS } from "@/lib/reservas/emparejar/vuelos-requeridos";
import { diaYMes } from "./formato";
import type { VueloDeReserva } from "./tipos";

const limpio = (s: string | null | undefined) => (s ?? "").trim();

/** "8:44" o "08.44" → "08:44"; otra cosa, tal cual. */
function hora(h: string): string {
  const m = h.match(/^(\d{1,2})[:.](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : h;
}

/** "Buenos Aires (AEP) 18 mar 08:30 hs"; vacío si no hay nada de ese lado. */
function extremo(aeropuerto: string | null | undefined, fecha: string | null | undefined, h: string | null | undefined): string {
  const codigo = limpio(aeropuerto).toUpperCase();
  const lugar = codigo ? (AEROPUERTOS[codigo] ? `${AEROPUERTOS[codigo]} (${codigo})` : codigo) : "";
  const dia = limpio(fecha) ? diaYMes(limpio(fecha)) : "";
  const cuando = limpio(h) ? `${hora(limpio(h))} hs` : "";
  return [lugar, dia, cuando].filter(Boolean).join(" ");
}

export function renglonDelVuelo(v: VueloDeReserva): string {
  const sale = extremo(v.origen, v.fecha_salida, v.hora_salida);
  const llega = extremo(v.destino, v.fecha_llegada, v.hora_llegada);
  const numero = limpio(v.numero);
  if (!numero) {
    if (llega && !sale) return `Llegada: ${llega} (sin número de vuelo)`;
    if (sale && !llega) return `Salida: ${sale} (sin número de vuelo)`;
  }
  const aerolinea = limpio(v.aerolinea);
  const cabeza = numero ? `Vuelo: ${numero}${aerolinea ? ` (${aerolinea})` : ""}` : `Vuelo sin número${aerolinea ? ` (${aerolinea})` : ""}`;
  return [cabeza, sale && `sale ${sale}`, llega && `llega ${llega}`].filter(Boolean).join(" – ");
}
