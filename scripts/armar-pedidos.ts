/**
 * Armar los borradores de pedido a proveedores (spec M3-01), en la BASE DE
 * PRUEBAS (`.env.pruebas.local`; frena si apunta a la real).
 *
 *   npm run armar:pedidos -- --reserva <id>   # arma y guarda los borradores de esa reserva y los muestra
 *   npm run armar:pedidos -- --ejemplos       # arma los de las reservas de prueba de ejemplo y escribe
 *                                             # docs/sdd/diagnosticos/M3-01-ejemplos-pedidos.md
 *
 * Sin IA (#3) y sin mandar nada (#4): solo deja borradores y tareas en la
 * reserva. El documento de ejemplos lleva los pasajeros enmascarados (#1); la
 * salida de `--reserva` no imprime datos de pasajeros más allá del texto del
 * pedido que se guarda.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { asegurarBaseDePruebas, cargarEntornoDePruebas } from "@/lib/entorno/base-de-pruebas";
import { armarPedidos } from "@/lib/pedidos/armar";
import { cargarCatalogoParaPedidos, cargarDiasServicio, cargarReservaParaPedidos } from "@/lib/pedidos/cargar";
import { documentoDeEjemplos, enmascararReserva, type EjemploDePedido } from "@/lib/pedidos/ejemplos";
import { armarYGuardarPedidos } from "@/lib/pedidos/guardar";
import { cargarPlantilla } from "@/lib/pedidos/plantilla";

const RAIZ = process.cwd();
const DOCUMENTO = join(RAIZ, "docs", "sdd", "diagnosticos", "M3-01-ejemplos-pedidos.md");

/** Las reservas de ejemplo (fila 12): agencia, producto y por qué está. */
const EJEMPLOS: Array<{ agencia: string; codigo: string; titulo: string; porQue: string }> = [
  {
    agencia: "Kilroy",
    codigo: "OD010D",
    titulo: "Kilroy · Iguazú con Cuenca del Plata (OD010D)",
    porQue: "Un paquete de Iguazú: los hoteles se piden cada uno a su casilla y el Paquete 105 va a Cuenca del Plata, con los traslados y los dos lados de las cataratas. Sin vuelo todavía: sale igual, con \"bus o vuelo pendiente\".",
  },
  {
    agencia: "Kilroy",
    codigo: "CHB31",
    titulo: "Kilroy · Tour compuesto San Pedro – Uyuni – La Paz (CHB31)",
    porQue: "Un tour armado con paquetes: cada proveedor recibe solo lo suyo, con las fechas del tour (el Tatio el día 3). El hostel que atiende por WhatsApp y el traslado de Transvip quedan como tareas.",
  },
  {
    agencia: "Kilroy",
    codigo: "ARCH31",
    titulo: "Kilroy · Patagonia Highlights (ARCH31): un caso con tareas",
    porQue: "Tour con buses que emite HI Travel (quedan como tarea \"emitir boleto\") y varios proveedores de alojamiento y excursiones.",
  },
  {
    agencia: "TourRadar",
    codigo: "AR09",
    titulo: "TourRadar · Patagonia Adventure Tour (AR09)",
    porQue: "Una reserva de TourRadar de un tour largo, para ver el mismo pedido con otra agencia.",
  },
  {
    agencia: "Journaway",
    codigo: "SPAP05",
    titulo: "Journaway · San Pedro + Uyuni en hoteles Tayka (SPAP05)",
    porQue: "Las excursiones de San Pedro van juntas a Horizonte Atacama; las noches en los Tayka van en el pedido de Imperio Inca. Los hoteles que reserva Journaway (Our Habitas y los demás) no se piden.",
  },
  {
    agencia: "Journaway",
    codigo: "SPAP01",
    titulo: "Journaway · All San Pedro + extensión (SPAP01 + SPAP03)",
    porQue: "Un mail con dos paquetes: todas las excursiones en un solo pedido por proveedor, en orden de fecha. Los shuttles de Calama son de reserva manual (tarea).",
  },
];

const PREGUNTAS = [
  "**Tono:** ¿te gusta el saludo (\"¡Hola! ¿Cómo están? Esperamos que muy bien.\"), la frase del pedido y el cierre (\"¿Nos confirman cuando puedan? … ¡Muchas gracias, como siempre! Un abrazo\")? ¿Va \"ustedes\" o preferís \"vos\" con los proveedores de confianza?",
  "**Excursiones sin día fijo:** cuando un paquete de varias noches tiene una excursión y el catálogo no dice qué día va (Perito Moreno, Torres del Paine, city tours), el pedido dice \"a coordinar (estadía del … al …)\" y avisa que falta la fecha. ¿Preferís que la app ponga un día por defecto (por ejemplo, el segundo día) o lo completa quien revisa? Los días que ya sepas se cargan en una lista, como el Tatio el día 3.",
  "**Hoteles con varias opciones:** se pide a la primera opción del catálogo y el pedido avisa cuáles son las otras. ¿Está bien así?",
  "**Paquete 105 de Iguazú:** se desglosa como hoy (traslado de llegada el primer día, lado argentino el segundo, lado brasileño el tercero y traslado de salida el último). ¿Es el orden que usan siempre?",
  "**Régimen y tipo de habitación:** la habitación sale de lo que manda la agencia (doble, single, cama en compartida). El régimen (con desayuno) no lo dice la reserva, así que no se pone. ¿Lo agregamos siempre como \"con desayuno\" en los hostels, o lo deja quien revisa?",
  "**Idioma de las excursiones:** va \"inglés\" por defecto. ¿Hay algún caso (por ejemplo, Journaway con pasajeros alemanes) en que pidan otro idioma?",
  "**Firma:** arriba va el nombre de quien aprueba el envío y debajo la de HI Travel. ¿Querés que lleve también el cargo (por ejemplo, \"Operaciones\")?",
];

function conectar(): SupabaseClient {
  cargarEntornoDePruebas(RAIZ);
  asegurarBaseDePruebas();
  for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[v]) throw new Error(`Falta la variable de entorno ${v} (.env.pruebas.local).`);
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function unaReserva(admin: SupabaseClient, id: string) {
  const r = await armarYGuardarPedidos(admin, id);
  if (!r.ok) {
    console.log(`No se armó: ${r.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Guardado: ${r.guardado.insertados} borradores nuevos, ${r.guardado.reemplazados} reemplazados, ${r.guardado.conservados} editados conservados, ${r.guardado.tareas} tareas.\n`);
  for (const p of r.pedidos) {
    console.log(`--- Para: ${p.destinatarios.join(", ") || `(sin destinatario: ${p.sinDestinatario})`}`);
    console.log(`Asunto: ${p.asunto}\n\n${p.cuerpo}\n\n${p.firma}\n`);
    for (const a of p.avisos) console.log(`  ! ${a}`);
  }
  for (const t of r.tareas) console.log(`Tarea: ${t.texto}`);
  for (const a of r.avisos) console.log(`Aviso: ${a}`);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST */
async function ejemplos(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("reserva")
    .select("id,agencia,estado,created_at,producto:producto_id(codigo)")
    .eq("de_prueba", true)
    .eq("estado", "recibida")
    .order("created_at");
  if (error) throw new Error(`No se pudieron leer las reservas de prueba: ${error.message}`);
  const plantilla = cargarPlantilla();
  const dias = cargarDiasServicio();
  const salida: EjemploDePedido[] = [];
  for (const e of EJEMPLOS) {
    const fila = (data as any[]).find((r) => r.agencia === e.agencia && r.producto?.codigo === e.codigo);
    if (!fila) {
      console.log(`- ${e.titulo}: no hay una reserva de prueba recibida en la base de pruebas.`);
      continue;
    }
    // El recorrido de verdad: arma y guarda los borradores en la base de pruebas.
    const guardado = await armarYGuardarPedidos(admin, fila.id, { plantilla, dias });
    const resumen = guardado.ok ? `${guardado.pedidos.length} pedidos, ${guardado.tareas.length} tareas` : guardado.error;
    console.log(`- ${e.titulo}: ${resumen}`);
    // El documento, con los pasajeros enmascarados (mismo armado, otros nombres).
    const reserva = await cargarReservaParaPedidos(admin, fila.id);
    const catalogo = await cargarCatalogoParaPedidos(admin, reserva!, dias);
    salida.push({ titulo: e.titulo, porQue: e.porQue, resultado: armarPedidos(enmascararReserva(reserva!), catalogo, plantilla) });
  }
  writeFileSync(DOCUMENTO, documentoDeEjemplos({ fecha: new Date().toISOString().slice(0, 10), ejemplos: salida, preguntas: PREGUNTAS }));
  console.log(`\nDocumento: docs/sdd/diagnosticos/M3-01-ejemplos-pedidos.md (${salida.length} reservas).`);
}

async function main() {
  const a = process.argv.slice(2);
  const admin = conectar();
  const i = a.indexOf("--reserva");
  if (i >= 0 && a[i + 1]) return unaReserva(admin, a[i + 1]);
  if (a.includes("--ejemplos")) return ejemplos(admin);
  console.log("Uso: npm run armar:pedidos -- --reserva <id>  |  npm run armar:pedidos -- --ejemplos");
  process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Error inesperado.");
  process.exit(1);
});
