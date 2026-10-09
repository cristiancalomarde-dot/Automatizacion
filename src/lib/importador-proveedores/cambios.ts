import { leerCsv } from "@/lib/importador-productos/csv";
import { limpiarNombre, normalizarNombre } from "./nombre";
import type { RegistroProveedor } from "./resolver";

/**
 * Comparación del Excel de proveedores con el directorio ya cargado (spec
 * M1-07 §3 #1 y #11). Es pura: no lee ni escribe la base.
 *
 * La identidad de un proveedor es `nombre_normalizado` + ciudad (sección del
 * Excel, M1-03). Cuando el owner corrige el Excel, un proveedor puede cambiar
 * de sección o de nombre sin dejar de ser el mismo; si se lo tratara como
 * nuevo quedaría duplicado (y el viejo seguiría usado por los servicios).
 * Por eso, lo que no empareja por clave se busca, en este orden, entre los
 * cargados que tampoco emparejaron:
 *
 * 1. **Movido:** el mismo nombre en otra ciudad, si hay uno solo (Tetris:
 *    BRASIL → FOZ DO IGUAZU).
 * 2. **Renombrado:** la misma ciudad y un mail en común, si hay uno solo
 *    (Cuenca Del Plata: Natalia → Analia).
 *
 * Con más de un candidato no se adivina. Lo que queda en la base sin
 * emparejar es una "baja": se informa y no se borra (borrar un proveedor es
 * una decisión del owner, como pasó con "Selina La Paz").
 */

export interface ProveedorEnBase extends RegistroProveedor {
  id: string;
}

export interface Movido {
  id: string;
  nombre: string;
  antes: string | null;
  despues: string | null;
}

export interface Renombrado {
  id: string;
  ciudad: string | null;
  antes: string;
  despues: string;
}

export interface CambioContacto {
  id: string;
  nombre: string;
  ciudad: string | null;
  antes: string;
  despues: string;
}

export interface ComparacionDirectorio {
  /** Por cada registro del Excel (mismo índice), el id del proveedor cargado que actualiza; null = alta. */
  idDe: Array<string | null>;
  altas: RegistroProveedor[];
  bajas: ProveedorEnBase[];
  movidos: Movido[];
  renombrados: Renombrado[];
  cambiosContacto: CambioContacto[];
}

/** El contacto en palabras: "mail a@x.com", "WhatsApp" o "sin contacto". */
export function contactoEnPalabras(p: Pick<RegistroProveedor, "mails" | "canal">): string {
  if (p.mails.length > 0) return `mail ${p.mails.join(", ")}`;
  if (p.canal === "whatsapp") return "WhatsApp";
  return "sin contacto";
}

function clave(nombreNormalizado: string, ciudad: string | null): string {
  return `${ciudad ?? ""}\u0000${nombreNormalizado}`;
}

export function compararDirectorio(registros: RegistroProveedor[], existentes: ProveedorEnBase[]): ComparacionDirectorio {
  const porClave = new Map<string, ProveedorEnBase>();
  for (const p of existentes) {
    const k = clave(p.nombre_normalizado, p.ciudad);
    if (!porClave.has(k)) porClave.set(k, p);
  }
  const usados = new Set<string>();
  const idDe: Array<string | null> = registros.map((r) => {
    const p = porClave.get(clave(r.nombre_normalizado, r.ciudad));
    if (!p || usados.has(p.id)) return null;
    usados.add(p.id);
    return p.id;
  });

  const libres = () => existentes.filter((p) => !usados.has(p.id));
  const movidos: Movido[] = [];
  const renombrados: Renombrado[] = [];

  // 1. movidos: mismo nombre, otra ciudad
  registros.forEach((r, i) => {
    if (idDe[i]) return;
    const candidatos = libres().filter((p) => p.nombre_normalizado === r.nombre_normalizado);
    if (candidatos.length !== 1) return;
    const p = candidatos[0];
    idDe[i] = p.id;
    usados.add(p.id);
    movidos.push({ id: p.id, nombre: r.nombre, antes: p.ciudad, despues: r.ciudad });
  });

  // 2. renombrados: misma ciudad, un mail en común
  registros.forEach((r, i) => {
    if (idDe[i] || r.mails.length === 0) return;
    const mails = new Set(r.mails.map((m) => m.toLowerCase()));
    const candidatos = libres().filter((p) => p.ciudad === r.ciudad && p.mails.some((m) => mails.has(m.toLowerCase())));
    if (candidatos.length !== 1) return;
    const p = candidatos[0];
    idDe[i] = p.id;
    usados.add(p.id);
    renombrados.push({ id: p.id, ciudad: r.ciudad, antes: p.nombre, despues: r.nombre });
  });

  const porId = new Map(existentes.map((p) => [p.id, p]));
  const cambiosContacto: CambioContacto[] = [];
  registros.forEach((r, i) => {
    const p = idDe[i] ? porId.get(idDe[i]!) : undefined;
    if (!p) return;
    const antes = contactoEnPalabras(p);
    const despues = contactoEnPalabras(r);
    if (antes !== despues) cambiosContacto.push({ id: p.id, nombre: r.nombre, ciudad: r.ciudad, antes, despues });
  });

  return {
    idDe,
    altas: registros.filter((_, i) => idDe[i] === null),
    bajas: libres(),
    movidos,
    renombrados,
    cambiosContacto,
  };
}

// === Borrados con el OK del owner ===========================================

/**
 * `data/proveedores-borrados.csv` (nombre, ciudad, fecha, nota): proveedores
 * que se borraron de la base con el OK del owner (ej. "Selina La Paz", que
 * cerró). Si vuelven a aparecer en el Excel, la recarga no los trae de vuelta:
 * los aparta y avisa. `ciudad` vacía = en cualquier sección.
 */
export interface ProveedorBorrado {
  nombre: string;
  nombreNormalizado: string;
  ciudad: string | null;
  nota?: string;
}

export function parsearProveedoresBorrados(texto: string): ProveedorBorrado[] {
  const filas = leerCsv(texto);
  return filas.map((r, i) => {
    const nombre = limpiarNombre(r.nombre ?? "");
    if (!nombre) throw new Error(`proveedores-borrados.csv, fila ${i + 2}: falta el nombre.`);
    const ciudad = (r.ciudad ?? "").trim() || null;
    const nota = (r.nota ?? "").trim();
    return { nombre, nombreNormalizado: normalizarNombre(nombre), ciudad, ...(nota ? { nota } : {}) };
  });
}

export function apartarBorrados(
  registros: RegistroProveedor[],
  borrados: ProveedorBorrado[],
): { quedan: RegistroProveedor[]; vueltos: RegistroProveedor[] } {
  const esBorrado = (r: RegistroProveedor) =>
    borrados.some((b) => b.nombreNormalizado === r.nombre_normalizado && (b.ciudad === null || b.ciudad === r.ciudad));
  return { quedan: registros.filter((r) => !esBorrado(r)), vueltos: registros.filter(esBorrado) };
}
