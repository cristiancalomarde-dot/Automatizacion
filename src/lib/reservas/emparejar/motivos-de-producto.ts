import { MOTIVOS_EMPAREJADO as M } from "./motivos";

/**
 * Los motivos de "para revisión" que hablan del producto (spec M3-05, anexo):
 * los que resuelve "Confirmar el producto". Se reconocen con los MISMOS
 * generadores de `motivos.ts`: cada uno se arma con marcadores y se convierte
 * en un patrón, así un cambio de texto allá cambia el reconocedor acá (y el
 * test de este archivo lo cubre). Sin base ni navegador: lo usa también la
 * pantalla.
 */

const TEXTO = "\u0001";
const NUMERO = 987654321;
const CONFIANZA = 0.12;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Un motivo armado con marcadores → patrón: cada texto es `(.+?)`, cada número `(\d+)` y la confianza `(\d+,\d+)`. */
function patron(armado: string): RegExp {
  const cuerpo = escapar(armado)
    .split(TEXTO)
    .join("(.+?)")
    .split(String(NUMERO))
    .join("(\\d+)")
    .split(CONFIANZA.toFixed(2).replace(".", ","))
    .join("(\\d+,\\d+)");
  return new RegExp(`^${cuerpo}$`, "s");
}

const CON_SUGERENCIA = patron(M.noSeguro(TEXTO, { codigo: TEXTO, confianza: CONFIANZA }));
const NOCHES = patron(M.nochesNoCoinciden(TEXTO, TEXTO, NUMERO, NUMERO));

const PATRONES: readonly RegExp[] = [
  CON_SUGERENCIA,
  NOCHES,
  patron(M.noSeguro(TEXTO)),
  patron(M.codigoFueraDeLista(TEXTO)),
  patron(M.iaInvalida(TEXTO)),
  patron(M.iaNoDisponible(TEXTO)),
  patron(M.noEstaEnCatalogo(TEXTO)),
  patron(M.codigoNoCargado(TEXTO, TEXTO)),
  patron(M.codigoNoCargado(TEXTO, null)),
];
const FIJOS: ReadonlySet<string> = new Set([M.sinProducto, M.techo, M.iaNoRespondio]);

/** true si el motivo es de producto (noSeguro, codigoFueraDeLista, nochesNoCoinciden, iaInvalida, iaNoDisponible, noEstaEnCatalogo, codigoNoCargado, sinProducto, techo, iaNoRespondio). */
export function esMotivoDeProducto(motivo: string): boolean {
  const texto = (motivo ?? "").trim();
  return FIJOS.has(texto) || PATRONES.some((p) => p.test(texto));
}

/** Lo que sugirió la IA según el motivo guardado: el código y su confianza (null si el motivo no la dice). */
export function sugerenciaDelMotivo(motivo: string): { codigo: string; confianza: number | null } | null {
  const texto = (motivo ?? "").trim();
  const con = CON_SUGERENCIA.exec(texto);
  if (con) return { codigo: con[2], confianza: Number(con[3].replace(",", ".")) };
  const noches = NOCHES.exec(texto);
  if (noches) return { codigo: noches[2], confianza: null };
  return null;
}
