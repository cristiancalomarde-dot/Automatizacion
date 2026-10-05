/**
 * Noches de un paquete vendido solo, del Excel de paquetes (hoja "Analisis a
 * Mayo 2026"). Hacen falta para controlar las anotaciones de RutasenBus:
 * "OD019 (menos 1 noche)" en un tour = las noches de OD019 menos una (spec
 * M1-05 §3 #3).
 *
 * El Excel las escribe junto al título del paquete en el itinerario:
 * "Mendoza Mountains and Wineries OD019 | 3 nights" (en la celda siguiente o
 * hasta 3 columnas más allá), o adentro del mismo título: "San Pedro de
 * Atacama Explorer 3 nights OD030", "W Trek … (6 nights) CH10", "Overland …
 * 3 dias / 2 noches". Se toma la primera fila donde el código aparece como
 * palabra entera con sus noches al lado. Si no aparece, null (el armado no
 * adivina: manda el tour a revisión).
 */

const NOCHES = /(\d+)\s*(?:nights?|noches)\b/i;

function tieneCodigo(texto: string, codigo: string): boolean {
  return texto.split(/[^A-Za-z0-9]+/).includes(codigo);
}

export function nochesBasePaquete(filas: string[][], codigo: string): number | null {
  for (const fila of filas) {
    for (let c = 0; c < fila.length; c++) {
      const texto = String(fila[c] ?? "");
      if (!tieneCodigo(texto, codigo)) continue;
      const enLaCelda = NOCHES.exec(texto);
      if (enLaCelda) return Number(enLaCelda[1]);
      for (let k = c + 1; k <= c + 3 && k < fila.length; k++) {
        const vecina = String(fila[k] ?? "").trim();
        if (!vecina) continue;
        const m = NOCHES.exec(vecina);
        if (m) return Number(m[1]);
        break; // la primera celda con algo no son las noches: esta fila no sirve
      }
    }
  }
  return null;
}
