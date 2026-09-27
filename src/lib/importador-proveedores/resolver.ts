import { clasificarCeldaMail, extraerMails } from "./celda-mail";
import type { ProveedorAgrupado } from "./hoja";

/**
 * Convierte un proveedor agrupado de la hoja en el registro de la tabla
 * `proveedor` (esquema de M1-02), aplicando las reglas simples por celda y,
 * solo para las celdas ambiguas, el respaldo de IA (spec M1-03 §3 #4-#9).
 *
 * Dónde queda cada dato del Excel (M1-02 no creó campos propios de
 * "destino" ni "categoría" para `proveedor`, y la spec pide no inventarlos):
 *   - destino (fila-bloque del Excel) → `ciudad`, tal cual el rótulo del bloque.
 *   - categoría (col A / sub-bloque), estrellas (col "CATEGORIAS"), la
 *     columna "Aclaraciones" y el texto original de "Mail/web" cuando no es un
 *     mail limpio → `aclaraciones`, una línea por dato con su rótulo:
 *       "Categoría: …" / "Estrellas: …" / "Aclaraciones: …" / "Mail/web original: …"
 *   - "Nro para el voucher" y teléfono: no se cargan (spec §5).
 */

export const UMBRAL_CONFIANZA_IA = 0.8;

export interface ConsultaIA {
  nombre: string;
  textoMailWeb: string;
  aclaraciones: string;
}

export interface RespuestaIA {
  mails: string[];
  canal: "mail" | "whatsapp" | "ninguno";
  confianza: number;
}

/** `null` = no se llamó a la IA (no configurada o techo de gasto agotado). */
export type ConsultarIA = (consulta: ConsultaIA) => Promise<RespuestaIA | null>;

export interface RegistroProveedor {
  nombre: string;
  nombre_normalizado: string;
  ciudad: string | null;
  mails: string[];
  canal: "mail" | "whatsapp" | null;
  aclaraciones: string | null;
}

export interface ResolucionProveedor {
  registro: RegistroProveedor;
  /** Celdas "Mail/web" que no calzaron con ninguna regla simple. */
  celdasAmbiguas: number;
  /** Celdas ambiguas que la IA resolvió con confianza (mail o whatsapp). */
  resueltasPorIA: number;
  /** Mails que propuso la IA y se descartaron por no estar literales en el Excel. */
  mailsRechazadosIA: string[];
}

/** ¿El texto de la celda trae algo más que mails y separadores? */
function tieneTextoExtra(celda: string, mails: string[]): boolean {
  let resto = celda.toLowerCase();
  for (const mail of mails) resto = resto.split(mail).join(" ");
  resto = resto.replace(/mailto:/g, " ");
  return /\p{L}/u.test(resto);
}

function armarAclaraciones(
  grupo: ProveedorAgrupado,
  mailWebOriginales: string[],
): string | null {
  const lineas = [
    ...grupo.categorias.map((c) => `Categoría: ${c}`),
    ...grupo.estrellas.map((e) => `Estrellas: ${e}`),
    ...grupo.aclaraciones.map((a) => `Aclaraciones: ${a}`),
    ...mailWebOriginales.map((m) => `Mail/web original: ${m.replace(/\s+/g, " ").trim()}`),
  ];
  return lineas.length ? lineas.join("\n") : null;
}

export async function resolverProveedor(
  grupo: ProveedorAgrupado,
  consultarIA: ConsultarIA | null,
): Promise<ResolucionProveedor> {
  const mails: string[] = [];
  const agregarMails = (nuevos: string[]) =>
    nuevos.forEach((m) => {
      if (!mails.includes(m)) mails.push(m);
    });

  let whatsapp = false;
  const mailWebOriginales: string[] = [];
  const ambiguas: string[] = [];

  for (const celda of grupo.celdasMailWeb) {
    const r = clasificarCeldaMail(celda);
    switch (r.tipo) {
      case "vacia":
        break;
      case "mail":
        agregarMails(r.mails);
        if (tieneTextoExtra(celda, r.mails)) mailWebOriginales.push(celda);
        break;
      case "whatsapp":
        whatsapp = true;
        mailWebOriginales.push(celda);
        break;
      case "web":
        mailWebOriginales.push(celda);
        break;
      case "ambigua":
        ambiguas.push(celda);
        mailWebOriginales.push(celda);
        break;
    }
  }

  let resueltasPorIA = 0;
  const mailsRechazadosIA: string[] = [];
  const textoAclaraciones = grupo.aclaraciones.join(" // ");

  // La IA solo entra si las reglas no dieron ya un canal para este proveedor.
  if (consultarIA && mails.length === 0 && !whatsapp) {
    // Fuente literal contra la que se valida todo mail propuesto por la IA.
    const fuente = [...grupo.celdasMailWeb, ...grupo.aclaraciones].join("\n").toLowerCase();

    for (const celda of ambiguas) {
      const respuesta = await consultarIA({
        nombre: grupo.nombre,
        textoMailWeb: celda,
        aclaraciones: textoAclaraciones,
      });
      if (!respuesta || respuesta.confianza < UMBRAL_CONFIANZA_IA) continue;

      if (respuesta.canal === "whatsapp") {
        whatsapp = true;
        resueltasPorIA++;
        continue;
      }
      const propuestos = respuesta.mails.flatMap((m) => {
        const validos = extraerMails(m);
        if (validos.length === 0) mailsRechazadosIA.push(m);
        return validos;
      });
      const aceptados = propuestos.filter((m) => {
        const literal = fuente.includes(m);
        if (!literal) mailsRechazadosIA.push(m);
        return literal;
      });
      if (aceptados.length) {
        agregarMails(aceptados);
        resueltasPorIA++;
      }
    }
  }

  return {
    registro: {
      nombre: grupo.nombre,
      nombre_normalizado: grupo.nombreNormalizado,
      ciudad: grupo.destino,
      mails,
      canal: mails.length ? "mail" : whatsapp ? "whatsapp" : null,
      aclaraciones: armarAclaraciones(grupo, mailWebOriginales),
    },
    celdasAmbiguas: ambiguas.length,
    resueltasPorIA,
    mailsRechazadosIA,
  };
}
