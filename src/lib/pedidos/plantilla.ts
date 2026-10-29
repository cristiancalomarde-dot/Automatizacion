import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Idioma } from "./idioma";
import { MARCA_NOMBRE, type Plantilla } from "./tipos";

/**
 * La plantilla del mail de pedido (spec M3-01 fila 6): un solo archivo
 * editable, `data/plantillas/pedido-proveedor.md`, con tres partes ("##
 * Asunto", "## Cuerpo", "## Firma"). Las líneas que empiezan con ">" son notas
 * para quien la edita y no salen. Los datos van entre llaves dobles.
 *
 * Cambiar el archivo cambia el texto de los pedidos sin tocar código. Si la
 * firma no tiene el lugar del nombre de quien envía, o si usa un dato que la
 * app no conoce, frena con un mensaje claro: ningún borrador sale sin firma.
 */

export const ARCHIVO_PLANTILLA = join("data", "plantillas", "pedido-proveedor.md");
/** M3-32: la de los proveedores de Brasil, en portugués (mismo formato y mismos datos). */
export const ARCHIVO_PLANTILLA_PT = join("data", "plantillas", "pedido-proveedor-pt.md");

/** Los datos que completa la app, por parte de la plantilla. */
export const DATOS_PLANTILLA = {
  // M3-16: la plantilla usa {{pasajero}} y {{fechas}}; los viejos se siguen aceptando.
  asunto: ["pasajero", "fechas", "pax", "producto", "referencia"],
  // M3-34: {{horario}} pide reconfirmar el horario si el pedido tiene excursiones.
  cuerpo: ["servicios", "horario", "pasajeros", "pendientes"],
  firma: ["nombre_de_quien_envia"],
} as const satisfies Record<keyof Plantilla, readonly string[]>;

const SECCIONES: Record<string, keyof Plantilla> = { asunto: "asunto", cuerpo: "cuerpo", firma: "firma" };

function sinAcentos(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function leerPlantilla(texto: string): Plantilla {
  const partes: Partial<Record<keyof Plantilla, string[]>> = {};
  let actual: keyof Plantilla | null = null;
  for (const linea of texto.replace(/\r\n?/g, "\n").split("\n")) {
    const titulo = linea.match(/^##\s+(.+?)\s*$/);
    if (titulo) {
      actual = SECCIONES[sinAcentos(titulo[1])] ?? null;
      if (actual) partes[actual] = [];
      continue;
    }
    if (!actual || /^\s*>/.test(linea)) continue;
    partes[actual]!.push(linea);
  }
  const limpia = (k: keyof Plantilla) => (partes[k] ?? []).join("\n").trim();
  const plantilla: Plantilla = { asunto: limpia("asunto").replace(/\s*\n\s*/g, " "), cuerpo: limpia("cuerpo"), firma: limpia("firma") };

  for (const k of Object.keys(SECCIONES) as Array<keyof Plantilla>) {
    if (!plantilla[k]) throw new Error(`La plantilla del pedido no tiene la parte "## ${k[0].toUpperCase()}${k.slice(1)}".`);
    const conocidos: readonly string[] = DATOS_PLANTILLA[k];
    for (const [, dato] of plantilla[k].matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
      if (!conocidos.includes(dato)) {
        throw new Error(`La plantilla del pedido usa {{${dato}}} en "${k}", y ahí la app solo completa: ${conocidos.map((c) => `{{${c}}}`).join(", ")}.`);
      }
    }
  }
  if (!plantilla.firma.includes(MARCA_NOMBRE)) {
    throw new Error(`La firma de la plantilla del pedido tiene que llevar ${MARCA_NOMBRE}: ahí va el nombre de quien envía.`);
  }
  if (!plantilla.cuerpo.includes("{{servicios}}")) {
    throw new Error("El cuerpo de la plantilla del pedido tiene que llevar {{servicios}}: ahí va lo que se pide.");
  }
  return plantilla;
}

/** Lee la plantilla del archivo del repo (solo servidor y scripts). */
export function cargarPlantilla(raiz: string = process.cwd(), idioma: Idioma = "es"): Plantilla {
  // M3-32: "pt", la de los proveedores de Brasil.
  return leerPlantilla(readFileSync(join(raiz, idioma === "pt" ? ARCHIVO_PLANTILLA_PT : ARCHIVO_PLANTILLA), "utf-8"));
}

/**
 * Completa los datos de un texto de la plantilla. Un dato vacío se va con su
 * renglón si estaba solo; nunca quedan más de una línea en blanco seguidas.
 */
export function completar(texto: string, valores: Record<string, string>): string {
  const lleno = texto.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (todo, dato: string) => (dato in valores ? valores[dato] : todo));
  return lleno
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Completa el asunto (M3-16): como `completar`, y un dato vacío no deja su
 * separador colgando ("Solicitud de reserva – Ana –" → "Solicitud de reserva – Ana"). M3-28:
 * sin cantidad de pax, tampoco queda la "x" de antes ("Ana x {{pax}}" → "Ana").
 */
export function completarAsunto(texto: string, valores: Record<string, string>): string {
  const base = valores.pax === "" ? texto.replace(/\s*\bx\s*\{\{\s*pax\s*\}\}/g, "") : texto;
  return completar(base, valores)
    .replace(/\s*([–·])(?:\s*[–·])+\s*/g, " $1 ")
    .replace(/^\s*[–·]\s*|\s*[–·]\s*$/g, "")
    .trim();
}

/** El texto final del mail (lo usa M3-03): cuerpo, un renglón en blanco y la firma con el nombre. */
export function textoParaEnviar(pedido: { cuerpo: string; firma: string }, nombreDeQuienEnvia: string): string {
  const nombre = nombreDeQuienEnvia.trim();
  if (!nombre) throw new Error("Falta el nombre de quien envía: va en la firma del pedido.");
  if (!pedido.firma.includes(MARCA_NOMBRE)) throw new Error("La firma del pedido perdió el lugar del nombre de quien envía.");
  return `${pedido.cuerpo.trim()}\n\n${pedido.firma.split(MARCA_NOMBRE).join(nombre).trim()}`;
}
