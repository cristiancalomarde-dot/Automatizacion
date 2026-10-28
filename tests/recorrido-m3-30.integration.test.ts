// @vitest-environment node
//
// Spec M3-30 — verificación 3 (regla #5): el recorrido. El mail Petzold (anonimizado,
// con las 3 imágenes reales pegadas en el cuerpo) llega a una casilla sales@ FALSA y
// pasa por la lectura de todos los días (M2-07: casilla → .eml → guardar → IA FALSA,
// que no gasta → reconocedor de Journaway → reserva) contra la BASE DE PRUEBAS:
// - la IA recibe las 3 imágenes (y no los íconos de la firma);
// - las imágenes quedan en el bucket y se ven desde el detalle;
// - sale SPAP05, 2 pax, 1 DBL, día 1 = 22.05.2027, un solo Astronomy Tour;
// - el "Night Bus Peru" no es parte de SPAP05: va a revisión con el motivo, y
//   cuando el equipo la pasa a recibida, ningún pedido lo incluye.
// Nada se envía (#4). Lo que crea se marca de prueba y se borra al terminar.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { sumarNombresJournaway } from "@/lib/importador-journaway/sumar-nombres";
import { abrirCasillaImap } from "@/lib/lectura-sales/casilla";
import { leerSales } from "@/lib/lectura-sales/corrida";
import { armarYGuardarPedidos } from "@/lib/pedidos/guardar";
import { respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarReserva } from "@/lib/reservas/consultas";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA, type ClienteMensajesIA } from "@/lib/reservas/extraer";
import { cambiarEstado } from "@/lib/reservas/guardar";
import { emlPetzold, fichaIAPetzold, IMAGENES_PETZOLD } from "./fixtures/journaway/petzold";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { comandosDeEscritura, crearImapFalso, type ImapFalso } from "./helpers/imap-falso";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const registro = crearRegistroDePrueba();
const USUARIO = "sales@falso.test";
const CLAVE = `clave-falsa-${randomUUID()}`;
const ID = `667${String(Date.now()).slice(-8)}`;
const MOTIVO_BUS = "Journaway pide 'Night Bus Peru' (31.05–01.06), que no es parte de SPAP05: consultarlo con Journaway";
const registroMes = (): RegistroUsoIA => ({ gastoDelMes: async () => 0, sumar: async () => {} });

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M3-30 — recorrido: el mail Petzold con sus imágenes sale SPAP05",
  { timeout: 400_000 },
  () => {
    let admin: SupabaseClient;
    let deps: DependenciasReservas;
    let soltarBloqueo: () => void;
    let falso: ImapFalso;
    const guardados: string[] = [];
    let corrida: string | null = null;
    const create = vi.fn(async () => respuestaCon({ ...fichaIAPetzold(), numero_reserva: { valor: `ID ${ID} · Trip 65037`, confianza: 1 } }));
    let reservaId: string;
    /** Lo que recibió la IA falsa (copiado: Vitest limpia los mocks antes de cada test). */
    type Parametros = { messages: Array<{ content: Array<{ type: string; text?: string }> }> };
    const llamadasIA: Parametros[] = [];

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await sumarNombresJournaway(admin, { aplicar: true });
      deps = await cargarDependenciasReservas(admin);

      falso = await crearImapFalso({ usuario: USUARIO, clave: CLAVE, carpetas: [{ path: "INBOX" }, { path: "INBOX.spam" }] });
      const fecha = new Date(Date.now() - 3_600_000);
      const eml = (await emlPetzold({ messageId: `<m3-30-${randomUUID()}@falso.test>`, fecha })).toString("utf8").replace("66688059968", ID);
      falso.agregar("INBOX", { fuente: eml, fecha });

      const resumen = await leerSales({
        admin,
        origen: "manual",
        casilla: () => abrirCasillaImap({ host: "127.0.0.1", puerto: falso.puerto, seguro: false, usuario: USUARIO, clave: CLAVE, esperaMs: 3_000 }),
        registroUso: registroMes(),
        alcance: () => guardados,
        alGuardar: (id) => {
          guardados.push(id);
          registro.mail(id);
        },
        leer: (mail, ctx) =>
          leerMailConIA(mail, { cliente: { messages: { create } } as unknown as ClienteMensajesIA, registro: ctx.registro, mes: "2026-10", mailRecibidoId: ctx.mailRecibidoId }),
        deps: () => deps,
      });
      corrida = resumen.id;
      llamadasIA.push(...(create.mock.calls as unknown as Array<[Parametros]>).map((c) => c[0]));
      expect(comandosDeEscritura(falso.comandos)).toEqual([]);
      expect(resumen).toMatchObject({ procesados: 1, reservas_nuevas: 1 });
      const { data, error } = await admin.from("reserva").select("id").in("mail_recibido_id", guardados);
      if (error) throw new Error(error.message);
      expect(data).toHaveLength(1);
      reservaId = data![0].id;
    }, 600_000);

    afterAll(async () => {
      try {
        if (guardados.length) {
          // Lo que crea la lectura de sales@ nace real (M2-07 #11): se marca de prueba para poder borrarlo.
          await admin.from("reserva").update({ de_prueba: true }).in("mail_recibido_id", guardados);
          await admin.from("mail_recibido").update({ de_prueba: true }).in("id", guardados);
        }
        await registro.limpiar(admin);
        if (corrida) await admin.from("lectura_casilla").delete().eq("id", corrida);
        await falso?.detener();
      } finally {
        soltarBloqueo?.();
      }
    }, 120_000);

    it("la IA recibe el texto con las marcas y las 3 imágenes; los íconos de la firma no viajan", () => {
      expect(llamadasIA).toHaveLength(1);
      const contenido = llamadasIA[0].messages[0].content;
      expect(contenido.filter((b) => b.type === "image")).toHaveLength(3);
      const texto = contenido[0].text!;
      expect(texto.indexOf("[imagen 1]")).toBeGreaterThan(texto.indexOf("hotels and night bus"));
      expect(texto.indexOf("[imagen 2]")).toBeGreaterThan(texto.indexOf("following activities"));
      expect(texto).not.toMatch(/hubspot|phone_icon|mail_icon/);
    });

    it("las imágenes quedan en el bucket y el detalle de la reserva las muestra", async () => {
      const detalle = await cargarReserva(admin, reservaId);
      expect(detalle!.mails[0].pdfs.map((p) => [p.nombre, p.esImagen])).toEqual(IMAGENES_PETZOLD.map((i) => [i.cid.split("@")[0], true]));
    });

    it("sale SPAP05, 2 pax, 1 DBL, del 22 al 28.05.2027, con un solo Astronomy Tour y el motivo del bus Perú", async () => {
      const { data, error } = await admin
        .from("reserva")
        .select("agencia, booking_id, trip_number, estado, motivos_revision, pax, habitacion, fecha_inicio, fecha_fin, producto:producto_id(codigo)")
        .eq("id", reservaId)
        .single();
      if (error) throw new Error(error.message);
      expect(data).toMatchObject({
        agencia: "Journaway",
        booking_id: ID,
        trip_number: "65037",
        estado: "para_revision",
        pax: 2,
        habitacion: "1 DBL",
        fecha_inicio: "2027-05-22",
        fecha_fin: "2027-05-28",
        producto: { codigo: "SPAP05" },
      });
      expect(data.motivos_revision).toEqual([MOTIVO_BUS]);

      const { data: partes } = await admin
        .from("reserva_componente")
        .select("orden, texto_agencia, fecha_inicio, fecha_fin, producto:producto_id(codigo)")
        .eq("reserva_id", reservaId)
        .order("orden");
      const filas = partes as unknown as Array<{ texto_agencia: string | null; fecha_inicio: string; fecha_fin: string; producto: { codigo: string } | null }>;
      expect(filas.map((p) => [p.producto?.codigo, p.fecha_inicio, p.fecha_fin])).toEqual([
        ["SPAT01", "2027-05-22", "2027-05-22"],
        ["SPAE01", "2027-05-22", "2027-05-22"],
        ["SPAE03", "2027-05-23", "2027-05-23"],
        ["SPAE05", "2027-05-24", "2027-05-24"],
        ["SPAE04", "2027-05-25", "2027-05-25"],
        ["SPAT02", "2027-05-26", "2027-05-26"],
        ["UYUO01", "2027-05-26", "2027-05-28"],
      ]);
      expect(filas.filter((p) => p.producto?.codigo === "SPAE01")).toHaveLength(1);
      expect(filas.some((p) => /Night Bus Peru/.test(p.texto_agencia ?? ""))).toBe(false);
    });

    it("6b: con la consulta resuelta (el equipo la pasa a recibida), ningún pedido incluye el bus Perú", async () => {
      await cambiarEstado(reservaId, "recibida", {}, admin);
      const armado = await armarYGuardarPedidos(admin, reservaId);
      expect(armado.ok).toBe(true);
      if (!armado.ok) return;
      expect(armado.pedidos.length).toBeGreaterThan(0);
      for (const p of armado.pedidos) expect(`${p.asunto}\n${p.cuerpo}`).not.toMatch(/Night Bus Peru|Peru/i);
    });
  },
);
