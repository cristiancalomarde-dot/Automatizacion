import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import type { DetalleProducto } from "@/lib/catalogo/tipos";
import type { DatoClave, FichaLectura, TipoMail, VueloIA } from "../../esquema-ficha";
import { armarCatalogo, type CatalogoParaEmparejar, type FilasCatalogo } from "../catalogo";
import { leerCodigosKilroy } from "../codigos-kilroy";
import { leerCodigosTourRadarCsv } from "../codigos-tourradar-csv";
import { leerProductosNoCargados, type ProductoNoCargado } from "../productos-no-cargados";

/**
 * Ayudas de los tests de M2-03: la foto del catálogo real (sin contactos de
 * proveedores) y las fichas de M2-02 de los mails de ejemplo. Nunca llaman a
 * la API ni a la base.
 */

const DIR = __dirname;

interface FotoCatalogo extends FilasCatalogo {
  proveedorPatagoniaPlanet: { id: string; nombre: string } | null;
  detalles: Record<string, DetalleProducto>;
}

let foto: FotoCatalogo | null = null;
function fotoCatalogo(): FotoCatalogo {
  foto ??= JSON.parse(readFileSync(join(DIR, "catalogo.json"), "utf-8")) as FotoCatalogo;
  return foto;
}

/** Las filas de `data/codigos-kilroy.csv` como filas de `codigo_externo` (lo que deja la carga). */
export function filasCodigosKilroy(): FilasCatalogo["codigos"] {
  const f = fotoCatalogo();
  const idPorCodigo = new Map(f.productos.map((p) => [p.codigo, p.id]));
  const csv = readFileSync(join(process.cwd(), "data", "codigos-kilroy.csv"), "utf-8");
  // La foto es de antes de M3-10: los códigos de productos que no están en ella (CH11, AR34…) no van.
  return leerCodigosKilroy(csv)
    .filter((c) => idPorCodigo.has(c.codigoHiTravel))
    .map((c) => ({
    producto_id: idPorCodigo.get(c.codigoHiTravel)!,
    agencia: "Kilroy",
    codigo: c.codigoKilroy,
    nombre_externo: c.nombreKilroy,
  }));
}

/** Las filas de `data/codigos-tourradar.csv` como filas de `codigo_externo` (owner 2026-10-14: 150146 → AR09). */
export function filasCodigosTourRadarCsv(): FilasCatalogo["codigos"] {
  const idPorCodigo = new Map(fotoCatalogo().productos.map((p) => [p.codigo, p.id]));
  const csv = readFileSync(join(process.cwd(), "data", "codigos-tourradar.csv"), "utf-8");
  // La foto es de antes de M3-10: los códigos de productos que no están en ella (ARBR23, ARUY01…) no van.
  return leerCodigosTourRadarCsv(csv)
    .filter((c) => idPorCodigo.has(c.nuestroCodigo))
    .map((c) => ({
    producto_id: idPorCodigo.get(c.nuestroCodigo)!,
    agencia: "TourRadar",
    codigo: c.codigo,
    nombre_externo: c.nombre,
  }));
}

/**
 * La lista de productos no cargados como estaba antes de M3-10 (owner 2026-10-14 y
 * 2026-10-16: ARCH33EXP, ARBR23, ARUY01 y OD014), coherente con la foto del catálogo:
 * prueba el mecanismo. Desde M3-10 esos productos están cargados y
 * `data/productos-no-cargados.csv` quedó vacío.
 */
export function noCargadosDePrueba(): ProductoNoCargado[] {
  return leerProductosNoCargados(readFileSync(join(DIR, "productos-no-cargados.csv"), "utf-8"));
}

/**
 * El catálogo real con lo que dejan las cargas de `data/codigos-tourradar.csv`
 * y, salvo `codigosKilroy: false`, `data/codigos-kilroy.csv`.
 */
export function catalogoDePrueba(opciones: { codigosKilroy?: boolean } = {}): CatalogoParaEmparejar {
  const f = fotoCatalogo();
  const extra = [...(opciones.codigosKilroy === false ? [] : filasCodigosKilroy()), ...filasCodigosTourRadarCsv()];
  const yaEstan = new Set(f.codigos.map((c) => `${c.agencia}|${c.codigo}`));
  return armarCatalogo({ ...f, codigos: [...f.codigos, ...extra.filter((c) => !yaEstan.has(`${c.agencia}|${c.codigo}`))] });
}

export function detalleDePrueba(codigo: string): DetalleProducto {
  const d = fotoCatalogo().detalles[codigo];
  if (!d) throw new Error(`La foto del catálogo no trae el detalle de ${codigo}.`);
  return structuredClone(d);
}

/** Busca el detalle por id de producto (como lo hace la base). */
export const detallePorId = vi.fn(async (id: string): Promise<DetalleProducto> => {
  const d = Object.values(fotoCatalogo().detalles).find((x) => x.id === id);
  if (!d) throw new Error(`La foto del catálogo no trae el detalle del producto ${id}.`);
  return structuredClone(d);
});

export function proveedorPatagoniaPlanet() {
  return fotoCatalogo().proveedorPatagoniaPlanet;
}

export function idDe(codigo: string): string {
  const p = fotoCatalogo().productos.find((x) => x.codigo === codigo);
  if (!p) throw new Error(`No hay producto ${codigo} en la foto.`);
  return p.id;
}

interface FichaCompacta {
  agencia: string;
  numero: string | null;
  tipo?: TipoMail;
  productos: Array<{ nombre: string; codigo: string | null; fecha_inicio: string | null; fecha_fin: string | null }>;
  pax?: number;
  vuelos?: Array<Partial<VueloIA>>;
  pedidos?: string[];
}

/** Una ficha de M2-02 (`FichaLectura`) de un mail de ejemplo, con cambios opcionales. */
export function fichaDePrueba(
  nombre: string,
  cambios: { datosDudosos?: DatoClave[]; vuelos?: Array<Partial<VueloIA>>; pedidos?: string[]; tipo?: TipoMail } = {},
): FichaLectura {
  const todas = JSON.parse(readFileSync(join(DIR, "fichas.json"), "utf-8")) as Record<string, FichaCompacta>;
  const c = todas[nombre];
  if (!c) throw new Error(`No hay ficha de prueba "${nombre}".`);
  const fechas = c.productos.flatMap((p) => [p.fecha_inicio, p.fecha_fin]).filter((x): x is string => !!x).sort();
  const vuelos = (cambios.vuelos ?? c.vuelos ?? []).map((v) => ({
    numero: null,
    aerolinea: null,
    origen: null,
    destino: null,
    fecha_salida: null,
    hora_salida: null,
    fecha_llegada: null,
    hora_llegada: null,
    confianza: 1,
    ...v,
  }));
  return {
    tipo_mail: { valor: cambios.tipo ?? c.tipo ?? "reserva_nueva", confianza: 1 },
    agencia: { valor: c.agencia, confianza: 1 },
    numero_reserva: { valor: c.numero, limpio: c.numero ? c.numero.split(/[/-]/)[0] : null, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: c.productos.map((p) => ({
      ...p,
      noches: null,
      habitacion: null,
      punto_recogida: null,
      opcionales: [],
      confianza: 1,
    })),
    fecha_inicio: { valor: fechas[0] ?? null, confianza: 1 },
    fecha_fin: { valor: fechas.at(-1) ?? null, confianza: 1 },
    pax: { valor: c.pax ?? null, confianza: 1 },
    pasajeros: Array.from({ length: c.pax ?? 0 }, (_, i) => ({
      nombre: "Pasajero",
      apellido: `De Prueba ${i + 1}`,
      nacionalidad: null,
      fecha_nacimiento: null,
      confianza: 1,
    })),
    vuelos,
    hoteles_agencia: [],
    todos_hoteles_agencia: { valor: false, confianza: 1 },
    pedidos_especiales: (cambios.pedidos ?? c.pedidos ?? []).map((texto) => ({ texto, confianza: 1 })),
    aviso: null,
    adjuntos_no_leidos: [],
    datos_dudosos: cambios.datosDudosos ?? [],
    notas: [],
    version_instrucciones: "lectura-mail.v2",
    modelo: "modelo-de-prueba",
  };
}
