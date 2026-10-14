// @vitest-environment node
//
// Spec M2-01 — verificación 3: el recorrido de punta a punta con mails reales
// de `Insumos/Mails` (no están en Git: datos de pasajeros). El mail de Kilroy
// OD010D y un Booking Statement en PDF de TourRadar: se reconoce la agencia
// por el remitente, se guarda el mail, se crea una reserva de prueba
// `para_revision` con un motivo, se pasa a `recibida`, se lee el historial
// (2 entradas), se vuelve a guardar el mismo mail (no duplica) y se borra
// lo de prueba que creó el recorrido (solo eso: registro-de-prueba.ts).
//
// Privacidad: ningún assert compara el cuerpo como texto (un fallo
// imprimiría datos de pasajeros); se comparan igualdad y tamaños.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agenciaDelRemitente, direccionDelRemitente } from "@/lib/reservas/agencias";
import { cambiarEstado, crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import { BUCKET_ADJUNTOS, type MailEntrada } from "@/lib/reservas/tipos";
import { parrafosDeDocumentXml } from "@/lib/importador-tours/word";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { aNumeroDeTest } from "@/lib/reservas/numeros-de-test";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

/** Lo que crea este archivo: lo único que borra. */
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

const PREFIJO = "[test M2-01]";
const MAILS = resolve(__dirname, "..", "Insumos", "Mails");
const DOCX_KILROY = join(MAILS, "Reserva de Cliente Kilroy Aarhus -Iguazu Falls Combined  OD010D.docx");
const PDF_TOURRADAR = join(
  MAILS,
  "1# Booking Statement 1377583 - 25365166 - vendorbill Ejemplo Reserva TR Buenos Aires to Rio.pdf",
);

const MESES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

/** El texto del .docx con sus saltos de línea (Outlook pega el encabezado con `<w:br/>`). */
function textoDelDocx(ruta: string): string {
  const zip = XLSX.CFB.read(readFileSync(ruta), { type: "buffer" });
  const i = zip.FullPaths.findIndex((p: string) => p.replace(/\\/g, "/").endsWith("word/document.xml"));
  const xml = Buffer.from(zip.FileIndex[i].content as Uint8Array).toString("utf8");
  return parrafosDeDocumentXml(xml.replace(/<w:br\/>/g, "<w:t>\n</w:t>")).join("\n");
}

/** El mail reenviado tal como quedó en el Word: De / Enviado / Para / Asunto y el cuerpo. */
function mailDelDocx(ruta: string): MailEntrada {
  const lineas = textoDelDocx(ruta).split("\n");
  const campo = (nombre: string) => {
    const i = lineas.findIndex((l) => l.trim().startsWith(`${nombre}:`));
    return i === -1 ? null : { i, valor: lineas[i].trim().slice(nombre.length + 1).trim() };
  };
  const de = campo("De")!;
  const enviado = campo("Enviado")!;
  const para = campo("Para")!;
  const asunto = campo("Asunto")!;
  const f = /(\d{1,2}) de (\w+) de (\d{4}) (\d{2}):(\d{2})/.exec(enviado.valor)!;
  const fecha = `${f[3]}-${MESES[f[2].toLowerCase()]}-${f[1].padStart(2, "0")}T${f[4]}:${f[5]}:00-03:00`;
  const nombre = de.valor.replace(/<[^>]*>\s*$/, "").trim();

  return {
    origen: "archivo",
    carpeta: null,
    archivoOrigen: `Insumos/Mails/${ruta.split(/[\\/]/).pop()}`,
    messageId: null,
    remitente: de.valor,
    remitenteNombre: nombre || null,
    destinatarios: para.valor
      .split(/[;,]/)
      .map((d) => direccionDelRemitente(d))
      .filter((d): d is string => d !== null),
    // Número de reserva de test (DK1564627 → DK9564627): no choca con el modo prueba (M2-06).
    asunto: aNumeroDeTest(`${PREFIJO} ${asunto.valor}`),
    fechaMail: fecha,
    cuerpoTexto: aNumeroDeTest(lineas.slice(asunto.i + 1).join("\n").trim()),
    adjuntos: [],
    dePrueba: true,
  };
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const hayInsumos = existsSync(DOCX_KILROY) && existsSync(PDF_TOURRADAR);

(credencialesSupabaseDisponibles() && hayInsumos ? describe : describe.skip)(
  "M2-01 — recorrido de punta a punta con los mails reales (Kilroy OD010D y un PDF de TourRadar)",
  { timeout: 60_000 },
  () => {
    let admin: SupabaseClient;
    let soltarBloqueo: () => void;

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }, 360_000);

    afterAll(async () => {
      try {
        // Red de seguridad si el recorrido se cortó antes de su propio borrado.
        await registro.limpiar(admin);
      } finally {
        soltarBloqueo?.();
      }
    }, 120_000);

    it("Kilroy: agencia → mail → para revisión → recibida → historial → no duplica → borrado", async () => {
      const entrada = mailDelDocx(DOCX_KILROY);

      // 1. La agencia sale del remitente.
      const agencia = agenciaDelRemitente(entrada.remitente);
      expect(agencia).toBe("Kilroy");
      expect(direccionDelRemitente(entrada.remitente)).toBe("aarhus@kilroy.dk");

      // 2. Se guarda el mail tal cual.
      const { mail, nuevo } = await guardarMailRecibido({ ...entrada, agencia }, admin);
      expect(nuevo).toBe(true);
      expect(mail).toMatchObject({ origen: "archivo", carpeta: null, remitente: "aarhus@kilroy.dk", agencia: "Kilroy" });
      expect(mail.destinatarios).toContain("sales@hitravel.com.ar");
      expect(mail.huella).toMatch(/^sha256:/);
      expect(mail.cuerpo_texto === entrada.cuerpoTexto).toBe(true);
      expect((mail.cuerpo_texto ?? "").length).toBeGreaterThan(200);

      // 3. Reserva de prueba para revisión, con un motivo.
      const bookingId = /\b([A-Z]{2}\d{5,})\b/.exec(entrada.asunto!)![1];
      const { reserva } = await crearReserva(
        {
          agencia,
          mailRecibidoId: mail.id,
          bookingId,
          productoTextoAgencia: "Iguazu Falls Combined (2 nights in Brazil + 1 night in Argentina)",
          estado: "para_revision",
          motivosRevision: ["Falta el vuelo de llegada y el producto tiene traslado."],
          dePrueba: true,
        },
        admin,
      );
      expect(reserva).toMatchObject({ estado: "para_revision", booking_id: aNumeroDeTest("DK1564627"), de_prueba: true });

      // 4. Pasa a recibida.
      const recibida = await cambiarEstado(reserva.id, "recibida", {}, admin);
      expect(recibida).toMatchObject({ estado: "recibida", motivos_revision: [] });

      // 5. El historial: 2 entradas, en orden.
      const { data: historial } = await admin
        .from("evento_reserva")
        .select("tipo, estado_anterior, estado_nuevo, autor_id")
        .eq("reserva_id", reserva.id)
        .order("created_at");
      expect(historial).toEqual([
        { tipo: "creada", estado_anterior: null, estado_nuevo: "para_revision", autor_id: null },
        { tipo: "estado_cambiado", estado_anterior: "para_revision", estado_nuevo: "recibida", autor_id: null },
      ]);

      // 6. El mismo mail otra vez: no duplica.
      const otraVez = await guardarMailRecibido({ ...entrada, agencia }, admin);
      expect(otraVez).toMatchObject({ nuevo: false, mail: { id: mail.id } });
      const { count } = await admin
        .from("mail_recibido")
        .select("id", { count: "exact", head: true })
        .eq("huella", mail.huella);
      expect(count).toBe(1);

      // 7. Se borra lo de prueba del recorrido.
      await registro.limpiar(admin);
      expect((await admin.from("reserva").select("id").eq("id", reserva.id)).data).toEqual([]);
      expect((await admin.from("evento_reserva").select("id").eq("reserva_id", reserva.id)).data).toEqual([]);
      expect((await admin.from("mail_recibido").select("id").eq("id", mail.id)).data).toEqual([]);
    });

    it("TourRadar: el Booking Statement en PDF se guarda y se descarga idéntico; después se borra", async () => {
      const pdf = new Uint8Array(readFileSync(PDF_TOURRADAR));
      const remitente = "TourRadar Finance <system@sent-via.netsuite.com>";
      const agencia = agenciaDelRemitente(remitente);
      expect(agencia).toBe("TourRadar");

      const entrada: MailEntrada = {
        origen: "archivo",
        archivoOrigen: "Insumos/Mails/1# Booking Statement 1377583 - 25365166 - vendorbill.pdf",
        remitente,
        remitenteNombre: "TourRadar Finance",
        destinatarios: ["sales@hitravel.com.ar"],
        asunto: aNumeroDeTest(`${PREFIJO} Booking Statement 1377583 - 25365166 - vendorbill`),
        cuerpoTexto: "",
        adjuntos: [{ nombre: PDF_TOURRADAR.split(/[\\/]/).pop()!, tipo: "application/pdf", contenido: pdf }],
        agencia,
        dePrueba: true,
      };
      const { mail } = await guardarMailRecibido(entrada, admin);
      const [adjunto] = mail.adjuntos;
      expect(adjunto).toMatchObject({ tipo: "application/pdf", tamano: pdf.byteLength });

      const { data: archivo, error } = await admin.storage.from(BUCKET_ADJUNTOS).download(adjunto.ruta!);
      expect(error).toBeNull();
      const bajado = new Uint8Array(await archivo!.arrayBuffer());
      expect(bajado.byteLength).toBe(pdf.byteLength);
      expect(sha(bajado)).toBe(sha(pdf));

      // El mismo mail otra vez: no duplica ni vuelve a subir el PDF.
      expect((await guardarMailRecibido(entrada, admin)).nuevo).toBe(false);

      const { archivosBorrados } = await registro.limpiar(admin);
      expect(archivosBorrados).toBe(1);
      expect((await admin.storage.from(BUCKET_ADJUNTOS).download(adjunto.ruta!)).data).toBeNull();
      expect((await admin.from("mail_recibido").select("id").eq("id", mail.id)).data).toEqual([]);
    });
  },
);
