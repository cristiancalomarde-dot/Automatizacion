import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponenteTour, DetalleProducto, Servicio } from "@/lib/catalogo/tipos";
import { leerCsv } from "@/lib/importador-productos/csv";
import { limpiarNombreJournaway } from "@/lib/importador-journaway/nombres";
import type { CatalogoParaEmparejar, ProductoDeLista } from "@/lib/reservas/emparejar/catalogo";
import { catalogoJournawayDeDetalles } from "@/lib/reservas/journaway/catalogo";
import type { CatalogoJournaway } from "@/lib/reservas/journaway/tipos";

/**
 * El catálogo de Journaway para los tests, armado con los mismos archivos de
 * `data/` que carga M2-08 (los nombres, la composición de los SPAP) y los
 * nombres de producto del reporte de M2-08. Sin base ni IA.
 */

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (archivo: string) => leerCsv(readFileSync(join(RAIZ, "data", archivo), "utf-8"));

/** Los nombres de los productos como quedaron en la base (reporte de M2-08). */
const NOMBRES: Record<string, string> = {
  SPAE01: "Astrophotography Tour",
  SPAE02: "Rainbow Valley day Tour (entrance fee)",
  SPAE03: "Moon Valley Tour (entrance fee)",
  SPAE04: "El Tatio Geisers Tour (entrance fee)",
  SPAE05: "Salt Flats Route Tour (Trip F)",
  SPAE06: "Red Rocks and Altiplanic Lagoons Tour (w/breakfast and lunch)",
  SPAE07: "Laguna Cejar - Tebenchique Tour",
  SPAT01: "Regular shuttle Calama Airport - San Pedro - Calama Airport",
  SPAT02: "Transfer San Pedro - Hito Cajon regular",
  UYUO01: "Overland privado San Pedro – Uyuni en hoteles Tayka",
  IGRE01: "Argentina Side of the Falls, full day, Premium small groups",
  IGRE02: "Brazilian Side of the Falls, half day, Premium small groups (max 15)",
  SPAP01: "Trip A) Package All San Pedro de Atacama 3n/4d with transfers and day tours including fees",
  SPAP02: "Trip B) Package All San Pedro de Atacama 4n/5d",
  SPAP03: "Trip C) Extension of Trip A: 3 extra nights with Salt Flats",
  SPAP04: "Trip E) San Pedro de Atacama Secret Escape 5N/6D",
  SPAP05: "Trip D Option 1) San Pedro de Atacama + Uyuni Salt Flats in Tayka Hotels 7N/8D",
  SPAP06: "Trip D Option 2) San Pedro de Atacama + Uyuni Salt Flats in Tayka Hotels 8N/9D",
};

const idDe = (codigo: string) => `id-${codigo}`;
const esTraslado = (codigo: string) => /^[A-Z]{3}T\d/.test(codigo);

function servicio(codigo: string, ajuste?: Servicio["ajusteTour"]): Servicio {
  const traslado = esTraslado(codigo);
  return {
    id: `srv-${codigo}`,
    productoId: idDe(codigo),
    tipo: traslado ? "traslado" : "excursion",
    nivel: null,
    orden: 1,
    prioridad: 1,
    descripcion: NOMBRES[codigo] ?? codigo,
    opcional: false,
    reservaManual: false,
    sinResolver: false,
    paraRevisar: false,
    nota: null,
    filaExcel: null,
    serviceProviderNombre: null,
    bookingSupplierNombre: null,
    serviceProvider: null,
    bookingSupplier: null,
    sentido: traslado ? (codigo === "SPAT01" ? "ida_y_vuelta" : "sin_sentido") : null,
    ...(ajuste ? { ajusteTour: ajuste } : {}),
  };
}

export interface CatalogoDePrueba {
  catalogo: CatalogoParaEmparejar;
  journaway: CatalogoJournaway;
  detalles: Record<string, DetalleProducto>;
  detalle: (productoId: string) => Promise<DetalleProducto>;
}

let cache: CatalogoDePrueba | null = null;

export function catalogoJournawayDePrueba(): CatalogoDePrueba {
  if (cache) return cache;
  const nombres = leer("journaway-nombres.csv");
  const composicion = leer("journaway-composicion.csv");
  const codigos = [...new Set([...nombres.map((n) => n.codigo), ...composicion.map((c) => c.componente), ...composicion.map((c) => c.paquete), "OD030"])];
  const paquetes = new Set(composicion.map((c) => c.paquete));

  const productos: ProductoDeLista[] = codigos.sort().map((codigo) => ({
    id: idDe(codigo),
    codigo,
    nombre: NOMBRES[codigo] ?? nombres.find((n) => n.codigo === codigo)?.nombre ?? codigo,
    ciudades: [],
    destino: codigo.startsWith("SPA") ? "SPA" : null,
    esTour: paquetes.has(codigo),
    noches: null,
  }));
  const catalogo: CatalogoParaEmparejar = {
    productos,
    codigos: nombres.map((n) => ({
      productoId: idDe(n.codigo),
      agencia: "Journaway",
      codigo: limpiarNombreJournaway(n.nombre),
      nombreExterno: n.nombre,
    })),
  };

  const detalles: Record<string, DetalleProducto> = {};
  for (const p of productos) {
    const partes = composicion.filter((c) => c.paquete === p.codigo);
    const componentes: ComponenteTour[] = partes.map((c) => {
      const lado = c.lado as "solo_llegada" | "solo_salida" | "";
      const comp = productos.find((x) => x.codigo === c.componente)!;
      return {
        id: `pc-${p.codigo}-${c.orden}`,
        orden: Number(c.orden),
        tipo: "paquete",
        diaDesde: Number(c.dia),
        noches: null,
        nocturno: null,
        transferIn: false,
        transferOut: false,
        descripcionRuta: null,
        producto: {
          id: comp.id,
          codigo: comp.codigo,
          nombre: comp.nombre,
          ciudades: [],
          destino: comp.destino,
          updatedAt: "2026-10-17",
          esTour: false,
          servicios: [servicio(comp.codigo, lado ? { accion: lado, texto: null, motivo: "composición", origen: "regla" } : undefined)],
        },
      };
    });
    detalles[p.id] = {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      ciudades: [],
      destino: p.destino,
      updatedAt: "2026-10-17",
      esTour: componentes.length > 0,
      codigosExternos: [],
      servicios: componentes.length ? [] : [servicio(p.codigo)],
      componentes,
    };
  }
  const journaway = catalogoJournawayDeDetalles(Object.values(detalles).filter((d) => d.esTour));
  cache = {
    catalogo,
    journaway,
    detalles,
    detalle: async (id) => {
      const d = detalles[id];
      if (!d) throw new Error(`No hay detalle de ${id}`);
      return d;
    },
  };
  return cache;
}

export const productoDePrueba = (codigo: string) => catalogoJournawayDePrueba().catalogo.productos.find((p) => p.codigo === codigo)!;
