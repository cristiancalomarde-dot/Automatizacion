import { leerCsv } from "@/lib/importador-productos/csv";
import { primeraCiudad, ultimaCiudad } from "./ciudades";
import { normalizarCategoria } from "./rutas";

/**
 * Los dos archivos de datos de M1-05 (spec §3 #6 y #8, "Datos, no código"):
 * los completa el owner sin tocar el programa.
 *
 * - `data/tramos-con-proveedor.csv` (tour, ruta, booking_supplier, nota): los
 *   buses que reserva un proveedor y que, por eso, van como servicio propio
 *   del tour y no como `tramo_bus`. La ruta se escribe "Bus A – B"; vale en
 *   los dos sentidos (BOCHI04R hace el mismo bus al revés).
 * - `data/categorias-tour.csv` (tour, categoria_tour, componente,
 *   categoria_paquete, nota): qué categoría del paquete corresponde a una
 *   categoría del tour cuando no es la misma.
 *
 * Una fila incompleta o una ruta que no se entiende es un error explícito.
 */

export interface TramoConProveedor {
  tour: string;
  desde: string;
  hasta: string;
  /** La ruta como la escribió el owner ("Bus Uyuni – La Paz"). */
  ruta: string;
  bookingSupplier: string;
  nota?: string;
}

export interface CategoriaTour {
  tour: string;
  categoriaTour: string;
  componente: string;
  categoriaPaquete: string;
}

function requerir(columnas: string[], texto: string, archivo: string) {
  const encabezado = texto.replace(/^﻿/, "").split(/\r?\n/)[0].split(",").map((c) => c.trim());
  const faltan = columnas.filter((c) => !encabezado.includes(c));
  if (faltan.length) throw new Error(`${archivo}: faltan las columnas ${faltan.join(", ")}.`);
}

export function parsearTramosConProveedor(texto: string): TramoConProveedor[] {
  requerir(["tour", "ruta", "booking_supplier"], texto, "tramos-con-proveedor.csv");
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const tour = (r.tour ?? "").trim();
    const ruta = (r.ruta ?? "").trim();
    const bookingSupplier = (r.booking_supplier ?? "").trim();
    if (!tour || !ruta || !bookingSupplier) {
      throw new Error(`tramos-con-proveedor.csv, fila ${fila}: faltan tour, ruta o booking_supplier.`);
    }
    const partes = ruta.replace(/^\s*bus\s+/i, "").split(/\s+[–-]\s+/);
    const desde = partes.length === 2 ? ultimaCiudad(partes[0]) : null;
    const hasta = partes.length === 2 ? primeraCiudad(partes[1]) : null;
    if (!desde || !hasta) {
      throw new Error(`tramos-con-proveedor.csv, fila ${fila}: no entiendo la ruta "${ruta}" (escribila "Bus A – B").`);
    }
    return { tour, desde, hasta, ruta, bookingSupplier, nota: (r.nota ?? "").trim() || undefined };
  });
}

export function parsearCategoriasTour(texto: string): CategoriaTour[] {
  requerir(["tour", "categoria_tour", "componente", "categoria_paquete"], texto, "categorias-tour.csv");
  return leerCsv(texto).map((r, i) => {
    const valores = [r.tour, r.categoria_tour, r.componente, r.categoria_paquete].map((v) => (v ?? "").trim());
    if (valores.some((v) => !v)) throw new Error(`categorias-tour.csv, fila ${i + 2}: falta un dato.`);
    const [tour, categoriaTour, componente, categoriaPaquete] = valores;
    return {
      tour,
      categoriaTour: normalizarCategoria(categoriaTour),
      componente,
      categoriaPaquete: normalizarCategoria(categoriaPaquete),
    };
  });
}

/** true si el bus va entre esos dos destinos (en cualquier sentido). */
export function mismaRuta(t: Pick<TramoConProveedor, "desde" | "hasta">, a: string | null, b: string | null): boolean {
  return (t.desde === a && t.hasta === b) || (t.desde === b && t.hasta === a);
}
