// @vitest-environment node
//
// Spec M3-49 — verificaciones 2 y 3: un mail de Kilroy como el de DK1595014
// (texto real con los datos personales cambiados, imágenes falsas con los
// tamaños reales: juntas pasan los 5 MB) entra por el circuito de siempre
// contra la BASE DE PRUEBAS, con la IA FALSA (no gasta, #4): se lee igual,
// sin la imagen más pesada, y arma la reserva con OD010D, fechas y pax.
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clienteFalso, registroFalso, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { procesarMail as procesarMailReal } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { mailKilroyPesado, TAMANOS_KILROY_PESADO } from "./fixtures/kilroy/imagenes-pesadas";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const registro = crearRegistroDePrueba();
const procesarMail = registro.conMailRecibido(procesarMailReal);
/** Un número de test (Kilroy: DK + 7 dígitos, empieza con 9) único por corrida. */
const NUMERO = `DK9349${String(Date.now()).slice(-3)}`;

/** Lo que la IA (falsa) lee del mail: está todo en el texto. */
function fichaKilroy() {
  return {
    tipo_mail: { valor: "reserva_nueva", confianza: 1 },
    agencia: { valor: "Kilroy", confianza: 1 },
    numero_reserva: { valor: `${NUMERO}/test`, confianza: 1 },
    titulo_paquete: { valor: null, confianza: 0 },
    productos: [
      {
        nombre: "Iguazu Falls Combined (2 nights in Brazil + 1 night in Argentina)",
        codigo: "HI_ARGENTINA_OD010D-677",
        fecha_inicio: "2027-04-02",
        fecha_fin: "2027-04-05",
        habitacion: "Double Room - Hostel",
        noches: null,
        punto_recogida: null,
        opcionales: [],
        confianza: 1,
      },
    ],
    fecha_inicio: { valor: "2027-04-02", confianza: 1 },
    fecha_fin: { valor: "2027-04-05", confianza: 1 },
    pax: { valor: 2, confianza: 1 },
    pasajeros: [
      { nombre: "Ana Ensayo", apellido: "Prueba", nacionalidad: "Denmark", fecha_nacimiento: "2004-03-03", confianza: 1 },
      { nombre: "Lea Ficticia", apellido: "Muestra", nacionalidad: "Denmark", fecha_nacimiento: "2004-07-21", confianza: 1 },
    ],
    vuelos: [],
    hoteles_agencia: [],
    todos_hoteles_agencia: { valor: false, confianza: 1 },
    pedidos_especiales: [],
    pdf_ilegible: false,
    aviso: null,
  };
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M3-49 — un mail de Kilroy con imágenes pesadas se lee igual (base de pruebas, IA falsa)",
  { timeout: 300_000 },
  () => {
    let admin: SupabaseClient;
    let deps: DependenciasReservas;
    let soltarBloqueo: () => void;

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      deps = await cargarDependenciasReservas(admin);
    }, 300_000);

    afterAll(async () => {
      try {
        await registro.limpiar(admin);
      } finally {
        soltarBloqueo?.();
      }
    }, 120_000);

    it("fila 4: arma la reserva con OD010D, del 2 al 5 de abril de 2027, 2 pax, habitación doble en hostel", async () => {
      const { cliente, create } = clienteFalso(respuestaCon(fichaKilroy()));
      const { registro: uso } = registroFalso();
      const entrada: MailEntrada = {
        origen: "archivo",
        messageId: `<m3-49-${randomUUID()}@prueba.hitravel.local>`,
        remitente: "copenhagen@kilroy.dk",
        asunto: `${NUMERO} - NEW BOOKING - KILROY booking request`,
        ...mailKilroyPesado(NUMERO),
        dePrueba: true,
      };
      const r = await procesarMail(entrada, {
        admin,
        leer: (mail, ctx) => {
          registro.mail(ctx.mailRecibidoId);
          return leerMailConIA(mail, { cliente, registro: uso, mes: "2026-11", mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
        },
        deps: () => deps,
        dePrueba: true,
        alcance: () => registro.mails,
      });
      expect(r.estado).toBe("procesado");
      if (r.estado !== "procesado") return;

      // A la IA viajaron dos imágenes (la de "Extra Requests" y el primer pasaporte); la más pesada no.
      expect(create).toHaveBeenCalledTimes(1);
      const contenido = (create.mock.calls[0] as unknown as [{ messages: Array<{ content: Array<{ type: string; text?: string; source?: { data: string } }> }> }])[0]
        .messages[0].content;
      const imagenes = contenido.filter((b) => b.type === "image");
      expect(imagenes.map((b) => Buffer.from(b.source!.data, "base64").byteLength)).toEqual([TAMANOS_KILROY_PESADO.extra, TAMANOS_KILROY_PESADO.pasaporte1]);

      expect(r.pedidos).toHaveLength(1);
      const { data, error } = await admin
        .from("reserva")
        .select("estado, booking_id, fecha_inicio, fecha_fin, pax, habitacion, motivos_revision, producto:producto_id(codigo)")
        .eq("id", r.pedidos[0].reservaId)
        .single();
      if (error) throw new Error(error.message);
      const reserva = data as unknown as {
        estado: string;
        booking_id: string;
        fecha_inicio: string;
        fecha_fin: string;
        pax: number;
        producto: { codigo: string } | null;
        habitacion: string | null;
        motivos_revision: string[];
      };
      expect(reserva.producto?.codigo).toBe("OD010D");
      expect([reserva.booking_id, reserva.fecha_inicio, reserva.fecha_fin, reserva.pax]).toEqual([NUMERO, "2027-04-02", "2027-04-05", 2]);
      expect(reserva.estado).toBe("recibida");
      expect(reserva.habitacion).toBe("Double Room - Hostel");
    });
  },
);
