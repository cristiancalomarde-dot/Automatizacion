import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leerCsv } from "@/lib/importador-productos/csv";

/**
 * Remitentes conocidos de cada agencia (spec M2-01, filas 8 y 9).
 *
 * `data/agencias.csv` (listado del owner): cada fila es una dirección exacta o
 * un dominio, con su agencia. `leerAgencias` es una función pura sobre el
 * texto del archivo (M2-07 decide cómo viaja el CSV con la función de
 * Vercel). `agenciaDelRemitente` busca primero la dirección exacta y después
 * el dominio (que cubre sus subdominios, nunca un dominio que solo lo
 * contiene). Lo que no matchea es "desconocida": nunca se adivina.
 */

export const AGENCIA_DESCONOCIDA = "desconocida";

export type TipoReglaRemitente = "direccion" | "dominio";
export type EstadoReglaRemitente = "confirmado" | "a_confirmar";

export interface ReglaRemitente {
  agencia: string;
  tipo: TipoReglaRemitente;
  /** Dirección o dominio, en minúscula. */
  valor: string;
  estado: EstadoReglaRemitente;
  nota: string;
}

const DOMINIO_PROPIO = "hitravel.com.ar";
const DOMINIO = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const DIRECCION = /^[^\s@<>"]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

function esDelDominio(host: string, dominio: string): boolean {
  return host === dominio || host.endsWith(`.${dominio}`);
}

/** Lee y valida el CSV de agencias. Cualquier fila dudosa es un error con su número de fila. */
export function leerAgencias(textoCsv: string): ReglaRemitente[] {
  const reglas: ReglaRemitente[] = [];
  const vistos = new Map<string, string>();

  leerCsv(textoCsv).forEach((fila, i) => {
    const n = i + 2; // 1 = encabezado
    const agencia = (fila.agencia ?? "").trim();
    const tipo = (fila.tipo ?? "").trim();
    const valor = (fila.valor ?? "").trim().toLowerCase();
    const estado = (fila.estado ?? "").trim();
    const nota = (fila.nota ?? "").trim();

    if (!agencia) throw new Error(`agencias.csv fila ${n}: falta la agencia.`);
    if (tipo !== "direccion" && tipo !== "dominio") {
      throw new Error(`agencias.csv fila ${n}: tipo "${tipo}" desconocido (direccion | dominio).`);
    }
    if (estado !== "confirmado" && estado !== "a_confirmar") {
      throw new Error(`agencias.csv fila ${n}: estado "${estado}" desconocido (confirmado | a_confirmar).`);
    }
    if (tipo === "direccion" && !DIRECCION.test(valor)) {
      throw new Error(`agencias.csv fila ${n}: "${valor}" no es una dirección de mail.`);
    }
    if (tipo === "dominio" && !DOMINIO.test(valor)) {
      throw new Error(`agencias.csv fila ${n}: "${valor}" no es un dominio.`);
    }
    const host = tipo === "direccion" ? valor.slice(valor.indexOf("@") + 1) : valor;
    if (esDelDominio(host, DOMINIO_PROPIO)) {
      throw new Error(`agencias.csv fila ${n}: "${valor}" es de ${DOMINIO_PROPIO}, no de una agencia.`);
    }
    const clave = `${tipo}:${valor}`;
    const anterior = vistos.get(clave);
    if (anterior) {
      throw new Error(`agencias.csv fila ${n}: "${valor}" ya figura (agencia ${anterior}).`);
    }
    vistos.set(clave, agencia);

    reglas.push({ agencia, tipo, valor, estado, nota });
  });

  return reglas;
}

/**
 * La dirección de un remitente, en minúscula: de `Nombre <dir@dominio>` solo
 * la parte entre `<>` (el nombre visible no cuenta nunca). Null si no hay una
 * dirección.
 */
export function direccionDelRemitente(remitente: string): string | null {
  const entreAngulos = /<([^<>]*)>\s*$/.exec(remitente);
  const direccion = (entreAngulos ? entreAngulos[1] : remitente).trim().toLowerCase();
  return DIRECCION.test(direccion) ? direccion : null;
}

let reglasDelArchivoCache: ReglaRemitente[] | null = null;

/** Las reglas de `data/agencias.csv` (leídas una vez por proceso). */
export function reglasDelArchivo(): ReglaRemitente[] {
  if (!reglasDelArchivoCache) {
    reglasDelArchivoCache = leerAgencias(readFileSync(join(process.cwd(), "data", "agencias.csv"), "utf-8"));
  }
  return reglasDelArchivoCache;
}

/**
 * La agencia de un remitente, o `AGENCIA_DESCONOCIDA`. Solo cuentan las filas
 * confirmadas. Primero la dirección exacta; después el dominio más largo que
 * cubra al del remitente (`x.tourradar.com` está cubierto por
 * `tourradar.com`; `kilroy.dk.ejemplo.com` y `notkilroy.dk` no).
 */
export function agenciaDelRemitente(remitente: string, reglas: ReglaRemitente[] = reglasDelArchivo()): string {
  const direccion = direccionDelRemitente(remitente);
  if (!direccion) return AGENCIA_DESCONOCIDA;
  const confirmadas = reglas.filter((r) => r.estado === "confirmado");

  const exacta = confirmadas.find((r) => r.tipo === "direccion" && r.valor === direccion);
  if (exacta) return exacta.agencia;

  const host = direccion.slice(direccion.indexOf("@") + 1);
  const porDominio = confirmadas
    .filter((r) => r.tipo === "dominio" && esDelDominio(host, r.valor))
    .sort((a, b) => b.valor.length - a.valor.length)[0];
  return porDominio ? porDominio.agencia : AGENCIA_DESCONOCIDA;
}
