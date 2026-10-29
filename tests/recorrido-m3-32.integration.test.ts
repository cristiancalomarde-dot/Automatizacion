// @vitest-environment node
//
// Spec M3-32 — verificaciones 2 y 3 (regla #5): el recorrido. Una reserva de Kilroy del combinado de
// Iguazú (OD010C, como la real DK1593147: 2 noches en Puerto Iguazú y 1 en Foz) llega por el flujo de M2
// (mail → lectura → emparejado → reserva, en modo prueba y con la IA FALSA: no gasta) contra la BASE DE
// PRUEBAS, queda recibida y arma los borradores: el de Bambu hostel (ciudad FOZ DO IGUAZU en el
// directorio) sale en portugués de Brasil (asunto, cuerpo, "1 noite", sin "com café da manhã" porque
// Bambu no ofrece desayuno, M3-35, y la firma de siempre); el de Cuenca del Plata sigue en castellano,
// con los renglones de M3-36. En la pantalla (con una sesión del equipo) la tarjeta de Bambu dice
// "En portugués" y la de Cuenca no; lo interno sigue en castellano.
//
// Mails y pasajeros sintéticos, con números de reserva de test (empiezan con 9). Lo que crea lleva la
// marca de prueba y se borra al terminar, solo eso. No manda nada (#4).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { cargarNochesServicio, parsearNochesServicio } from "@/lib/importador-productos/noches-servicio";
import { armarYGuardarPedidos, cargarPedidos } from "@/lib/pedidos/guardar";
import { buscarEnElDirectorio, prepararPedidos } from "@/lib/pedidos/revision";
import { TEXTOS } from "@/lib/textos";
import { clienteFalso, registroFalso, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { procesarMail as procesarMailReal, type OpcionesProceso } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
/** Un sufijo por corrida: los números de reserva no chocan con otra corrida a medio borrar. */
const SUFIJO = String(Date.now()).slice(-2);

const MAIL = {
  numero: `DK93132${SUFIJO}/test`,
  nombre: "Iguazu Falls Combined (2 nights in Argentina 1 night in Brazil)",
  codigo: "HI_ARGENTINA_OD010C-677",
  habitacion: "Double Room - Hostel",
  inicio: "2027-01-30",
  fin: "2027-02-02",
};

function ficha() {
  const producto = { nombre: MAIL.nombre, codigo: MAIL.codigo, fecha_inicio: MAIL.inicio, fecha_fin: MAIL.fin, habitacion: MAIL.habitacion };
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "Kilroy", confianza: 1 },
    numero_reserva: { valor: MAIL.numero, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [{ ...producto, noches: null, punto_recogida: null, opcionales: [], confianza: 1 }],
    fecha_inicio: { valor: MAIL.inicio, confianza: 1 },
    fecha_fin: { valor: MAIL.fin, confianza: 1 },
    pax: { valor: 2, confianza: 1 },
    pasajeros: [
      { nombre: "Ana", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17", confianza: 1 },
      { nombre: "Luis", apellido: "Ensayo", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03", confianza: 1 },
    ],
    vuelos: [],
    hoteles_agencia: [],
    todos_hoteles_agencia: { valor: false, confianza: 1 },
    pedidos_especiales: [],
    pdf_ilegible: false,
    aviso: null,
  };
}

/** El texto del mail sintético: lo que la IA "leyó" tiene que estar escrito (los controles de M2-02). */
function cuerpo(f: ReturnType<typeof ficha>): string {
  return [
    "Mail sintético de prueba (sin datos de nadie).",
    `Booking ${f.numero_reserva.valor}`,
    ...f.productos.map((p) => `${p.nombre} ${p.codigo} from ${p.fecha_inicio} to ${p.fecha_fin} - ${p.habitacion}`),
    `Passengers (2): ${f.pasajeros.map((p) => `${p.nombre} ${p.apellido}, ${p.nacionalidad}, ${p.fecha_nacimiento}`).join("; ")}`,
  ].join("\n");
}

const renglon = (texto: string, empieza: string) => texto.split("\n").find((l) => l.startsWith(empieza)) ?? "";

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-32 — recorrido: el pedido a Bambu (Foz) sale en portugués y el de Cuenca del Plata en castellano", { timeout: 300_000 }, () => {
  let admin: SupabaseClient;
  let deps: DependenciasReservas;
  let soltarBloqueo: () => void;
  let reserva: { id: string; estado: string; producto: string | null } | null = null;

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const filas = parsearNochesServicio(readFileSync(resolve(__dirname, "..", "data", "noches-servicio.csv"), "utf-8")).filter((f) => f.paquete === "OD010C");
    await cargarNochesServicio({ admin, filas, nochesPaquete: () => 3 });
    deps = await cargarDependenciasReservas(admin);
    const f = ficha();
    const { cliente } = clienteFalso(respuestaCon(f));
    const { registro: uso } = registroFalso();
    const leer: OpcionesProceso["leer"] = (mail, ctx) =>
      leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", llamadas: crearRegistroLlamadasSupabase(admin), mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    const entrada: MailEntrada = {
      origen: "archivo",
      messageId: `<m3-32-${randomUUID()}@prueba.hitravel.local>`,
      remitente: "aarhus@kilroy.dk",
      asunto: `${MAIL.numero} - NEW BOOKING - KILROY booking request`,
      cuerpoTexto: cuerpo(f),
      adjuntos: [],
      dePrueba: true,
    };
    const r = await procesarMail(entrada, {
      admin,
      leer: (mail, ctx) => {
        registro.mail(ctx.mailRecibidoId);
        return leer(mail, ctx);
      },
      deps: () => deps,
      llamadas: crearRegistroLlamadasSupabase(admin),
      dePrueba: true,
      alcance: () => registro.mails,
    });
    expect(r.estado).toBe("procesado");
    if (r.estado !== "procesado") return;
    const [p] = r.pedidos;
    const { data, error } = await admin.from("reserva").select("id, estado, producto:producto_id(codigo)").eq("id", p.reservaId).single();
    if (error) throw new Error(error.message);
    const fila = data as unknown as { id: string; estado: string; producto: { codigo: string } | null };
    reserva = { id: fila.id, estado: fila.estado, producto: fila.producto?.codigo ?? null };
  }, 300_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      soltarBloqueo?.();
    }
  }, 120_000);

  async function pedidos() {
    const armado = await armarYGuardarPedidos(admin, reserva!.id);
    if (!armado.ok) throw new Error(armado.error);
    return (await cargarPedidos(admin, reserva!.id)).pedidos;
  }

  it("la reserva queda recibida con el producto OD010C", () => {
    expect(reserva && [reserva.producto, reserva.estado]).toEqual(["OD010C", "recibida"]);
  });

  it("el pedido a Bambu sale entero en portugués, con la firma de siempre", async () => {
    const bambu = (await pedidos()).find((x) => x.destinatarios.includes("hostelsbambu@gmail.com"))!;
    expect(bambu.estado).toBe("borrador");
    expect(bambu.asunto).toBe("Solicitação de reserva – Ana Prueba x 2 – 1 a 2 fev 2027");
    expect(bambu.cuerpo).toBe(
      [
        "Olá! Tudo bem? Esperamos que sim.",
        "",
        "Escrevemos da HI Travel para solicitar a seguinte reserva:",
        "",
        "Hospedagem: Bambu",
        "IN: 1 fev 2027",
        "OUT: 2 fev 2027 (1 noite)",
        "Quarto: DBL Standard",
        "",
        "Passageiros: 2",
        "PAX 1: Ana Prueba · Nacionalidade: Denmark · Data de nascimento: 17/05/1990 · Passaporte: pendente",
        "PAX 2: Luis Ensayo · Nacionalidade: Denmark · Data de nascimento: 03/02/1991 · Passaporte: pendente",
        "",
        "Vocês podem nos confirmar quando puderem? Se precisarem de mais algum dado, é só avisar que enviamos na hora.",
        "",
        "Muito obrigado!",
        "Abraços!",
      ].join("\n"),
    );
    const cuenca = (await pedidos()).find((x) => x.destinatarios.includes("reservas8@cuencadelplata.com"))!;
    expect(bambu.firma).toBe(cuenca.firma);
    expect(bambu.firma).toContain("{{nombre_de_quien_envia}}\nHi Travel South America");
  });

  it("el pedido a Cuenca del Plata sigue en castellano, con los renglones de M3-36", async () => {
    const c = (await pedidos()).find((x) => x.destinatarios.includes("reservas8@cuencadelplata.com"))!;
    const beer = "Beer (Puerto Iguazú) · hotel a confirmar";
    const bambu = "Bambu (Foz do Iguaçu) · hotel a confirmar";
    expect(c.asunto).toMatch(/^Solicitud de reserva – Ana Prueba x 2 – /);
    expect(c.cuerpo).toMatch(/^¡Hola! ¿Cómo están\? Esperamos que muy bien\./);
    expect(renglon(c.cuerpo, "TRF IN")).toBe(`TRF IN: 30 ene 2027 · Bus o vuelo pendiente · Drop off: ${beer}`);
    expect(renglon(c.cuerpo, "Lado brasileño")).toBe(`Lado brasileño, Premium, en inglés: 1 feb 2027 · Pick up: ${beer} · Drop off: ${bambu}`);
    expect(renglon(c.cuerpo, "Ese día cruzan")).toMatch(/^Ese día cruzan: el drop off es en el hotel de Brasil\./);
    expect(c.cuerpo).toContain("¿Nos confirman el horario de las excursiones, por favor?");
    expect(c.cuerpo).toContain("Pasajeros: 2\nPAX 1: Ana Prueba · Nacionalidad: Denmark");
    expect(c.cuerpo).not.toMatch(/Passageiros|Olá|fev/);
  });

  it("en la pantalla (sesión del equipo): la tarjeta de Bambu dice En portugués, la de Cuenca no; el pedido a mano tiene su borrador pt", async () => {
    const sesion = await crearSesionDePrueba();
    try {
      const { data } = await sesion.cliente.auth.getUser();
      const alta = await admin.from("usuario").insert({ id: data.user!.id, email: data.user!.email, nombre: "Test M3-32" });
      if (alta.error) throw new Error(alta.error.message);
      try {
        const r = await prepararPedidos(sesion.cliente, reserva!.id);
        if (!r.ok) throw new Error(r.error);
        const bambu = r.pedidos.find((x) => x.destinatarios.includes("hostelsbambu@gmail.com"))!;
        const cuenca = r.pedidos.find((x) => x.destinatarios.includes("reservas8@cuencadelplata.com"))!;
        expect(r.enPortugues).toContain(bambu.id);
        expect(r.enPortugues).not.toContain(cuenca.id);
        expect(r.aManoPt?.asunto).toMatch(/^Solicitação de reserva – Ana Prueba x 2/);
        expect(r.aMano?.asunto).toMatch(/^Solicitud de reserva/);
        // Lo interno sigue en castellano.
        for (const aviso of r.avisos) expect(aviso).not.toMatch(/Olá|Passageiros|Hospedagem/);
        // Buscar en el directorio marca a Bambu como de Brasil.
        const busqueda = await buscarEnElDirectorio(sesion.cliente, "Bambu hostel");
        if (!busqueda.ok) throw new Error(busqueda.error);
        expect(busqueda.proveedores.find((p) => p.nombre === "Bambu hostel")?.enPortugues).toBe(true);
        expect(TEXTOS.pedidos.enPortugues).toBe("En portugués");
      } finally {
        await admin.from("usuario").delete().eq("id", data.user!.id);
      }
    } finally {
      await sesion.borrar();
    }
  });
});
