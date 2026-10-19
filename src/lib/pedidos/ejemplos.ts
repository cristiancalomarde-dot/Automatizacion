/**
 * El documento de ejemplos para el owner (spec M3-01 fila 12): los borradores
 * armados desde reservas de prueba, con los datos de los pasajeros
 * enmascarados (#1), en llano y sin rutas ni jerga. Puro: recibe lo armado y
 * devuelve el texto.
 */
import { MARCA_NOMBRE, type PasajeroDeReserva, type ReservaParaPedidos, type ResultadoArmado } from "./tipos";

const inicial = (t: string | null | undefined) => (t?.trim() ? `${t.trim()[0].toUpperCase()}.` : null);

function enmascararPasajero(p: PasajeroDeReserva): PasajeroDeReserva {
  const anio = p.fecha_nacimiento?.match(/^(\d{4})-\d{2}-\d{2}$/)?.[1];
  return {
    ...p,
    nombre: inicial(p.nombre) ?? p.nombre,
    apellido: inicial(p.apellido) ?? p.apellido,
    fecha_nacimiento: p.fecha_nacimiento ? (anio ? `**/**/${anio}` : "**/**/****") : p.fecha_nacimiento,
    pasaporte: p.pasaporte ? `******${p.pasaporte.trim().slice(-2)}` : p.pasaporte,
    telefono: p.telefono ? "+** *** *** ****" : p.telefono,
  };
}

/** La reserva con los pasajeros enmascarados: nombres en iniciales, sin día ni mes de nacimiento, sin pasaporte ni teléfono. */
export function enmascararReserva(r: ReservaParaPedidos): ReservaParaPedidos {
  return { ...r, pasajeros: r.pasajeros.map(enmascararPasajero) };
}

export interface EjemploDePedido {
  titulo: string;
  porQue: string;
  resultado: ResultadoArmado;
}

const cita = (texto: string) =>
  texto
    .split("\n")
    .map((l) => (l.trim() ? `> ${l}` : ">"))
    .join("\n");

export function documentoDeEjemplos(opciones: { fecha: string; ejemplos: EjemploDePedido[]; preguntas: string[] }): string {
  const partes: string[] = [
    "# Ejemplos de pedidos a proveedores",
    "",
    `Armados el ${opciones.fecha} desde reservas de prueba de las tres agencias (Kilroy, TourRadar y Journaway). ` +
      "Son los mails que la app le escribiría a cada proveedor. Todavía no se manda nada: esto es para revisar el tono y el contenido.",
    "",
    "Los nombres de los pasajeros están en iniciales y las fechas de nacimiento sin día ni mes, para cuidar sus datos. " +
      "En el mail de verdad van completos, solo a los proveedores que los necesitan (hoteles y excursiones).",
    "",
    "**Cómo leerlo:** cada reserva tiene sus pedidos (uno por casilla de proveedor), lo que queda como tarea para hacer a mano " +
      "(buses que emite HI Travel, reservas en sistemas propios, proveedores que solo atienden por WhatsApp) y lo que conviene " +
      "revisar antes de enviar. La firma lleva arriba el nombre de quien aprueba el envío.",
    "",
    "**Qué se puede cambiar sin tocar la app:** el saludo, la frase del pedido, el agradecimiento, el cierre y la firma están en " +
      "un solo archivo de texto. Si querés otro tono, marcá acá qué frase cambiarías y por cuál.",
    "",
  ];

  opciones.ejemplos.forEach((e, i) => {
    partes.push(`## ${i + 1}. ${e.titulo}`, "", e.porQue, "");
    if (!e.resultado.ok) {
      partes.push(`No se armó: ${e.resultado.error}`, "");
      return;
    }
    const { pedidos, tareas, avisos } = e.resultado;
    if (pedidos.length === 0) partes.push("No sale ningún mail para esta reserva.", "");
    pedidos.forEach((p, j) => {
      const para = p.destinatarios.length ? p.destinatarios.join(", ") : `nadie todavía (${p.sinDestinatario})`;
      partes.push(
        `### Pedido ${j + 1} de ${pedidos.length}: ${p.proveedores.map((x) => x.nombre).join(" y ")}`,
        "",
        `**Para:** ${para}`,
        "",
        `**Asunto:** ${p.asunto}`,
        "",
        cita(`${p.cuerpo}\n\n${p.firma.split(MARCA_NOMBRE).join("(nombre de quien envía)")}`),
        "",
      );
      if (p.avisos.length) partes.push("Antes de enviar:", "", ...p.avisos.map((a) => `- ${a}`), "");
    });
    if (tareas.length) partes.push("**Queda como tarea (no va por mail):**", "", ...tareas.map((t) => `- ${t.texto}`), "");
    if (avisos.length) partes.push("**No se pidió:**", "", ...avisos.map((a) => `- ${a}`), "");
  });

  if (opciones.preguntas.length) {
    partes.push("## Preguntas para vos", "", ...opciones.preguntas.map((p, i) => `${i + 1}. ${p}`), "");
  }
  return `${partes.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
