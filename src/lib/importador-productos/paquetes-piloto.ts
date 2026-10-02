import { limpiarNombre } from "@/lib/importador-proveedores/nombre";
import { leerCsv } from "./csv";

/**
 * Lista de paquetes piloto (spec M1-04c §3 #1): qué códigos lee el importador
 * de productos y de qué destino es cada uno. Es un archivo de datos
 * (`data/paquetes-piloto.csv`, columnas `codigo,destino`; puede traer más
 * columnas, como una nota) y no una lista fija en el código, para que sumar
 * paquetes no requiera tocar el programa.
 *
 * Un código repetido o una fila incompleta es un error explícito: nunca se
 * adivina.
 */

export interface PaquetePiloto {
  codigo: string;
  destino: string;
}

export function parsearPaquetesPiloto(texto: string): PaquetePiloto[] {
  const encabezado = texto.replace(/^﻿/, "").split(/\r?\n/)[0].split(",").map((c) => c.trim());
  if (!encabezado.includes("codigo") || !encabezado.includes("destino")) {
    throw new Error("Paquetes piloto: el encabezado tiene que tener las columnas codigo y destino.");
  }
  const vistos = new Map<string, number>();
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const codigo = limpiarNombre(r.codigo ?? "");
    const destino = limpiarNombre(r.destino ?? "");
    if (!codigo || !destino) throw new Error(`Paquetes piloto, fila ${fila}: faltan codigo o destino.`);
    const anterior = vistos.get(codigo);
    if (anterior !== undefined) {
      throw new Error(`Paquetes piloto, fila ${fila}: el código ${codigo} está repetido (ya está en la fila ${anterior}).`);
    }
    vistos.set(codigo, fila);
    return { codigo, destino };
  });
}
