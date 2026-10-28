// @vitest-environment node
//
// Spec M2-01 — verificación 2 (integración contra el Supabase real
// compartido, migración 0010 aplicada): filas 1-7, 10 y 11, con las pruebas
// de lo que no debe pasar. Todo lo que se crea lleva `de_prueba = true` y el
// asunto `[test M2-01]`, y se limpia con el borrado de prueba. La única
// excepción es la reserva "real" de las filas 5 y 7 (hace falta una sin la
// marca para probar que el borrado no la toca y que su historial no se
// edita): al final se le pone la marca con la service role y se borra igual.
// El borrado es solo de lo que creó este archivo (registro-de-prueba.ts): las
// reservas de prueba del modo prueba (M2-06) no se tocan.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agregarEvento,
  borrarDatosDePruebaDe,
  cambiarEstado,
  crearReserva,
  guardarMailRecibido as guardarMailRecibidoReal,
} from "@/lib/reservas/guardar";
import { BUCKET_ADJUNTOS, type MailEntrada } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const PREFIJO = "[test M2-01]";

/** Lo que crea este archivo: lo único que borra al final. */
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

/** Un PDF mínimo válido, sintético (sin datos de nadie). */
function pdfSintetico(): Uint8Array {
  const texto = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%${randomUUID()}\n%%EOF\n`;
  return new TextEncoder().encode(texto);
}

function mailKilroy(extra: Partial<MailEntrada> = {}): MailEntrada {
  return {
    origen: "imap",
    carpeta: "inbox",
    imapUidvalidity: 1700000000,
    // Cada mail con su propio UID: el id IMAP es único desde M2-04 (migración 0012).
    imapUid: Math.floor(Math.random() * 1_000_000_000),
    messageId: `<${randomUUID()}@test.kilroy.dk>`,
    remitente: "aarhus@kilroy.dk",
    remitenteNombre: "KILROY Aarhus",
    destinatarios: ["sales@hitravel.com.ar"],
    asunto: `${PREFIJO} DK0000001 - Iguazu Falls Combined - KILROY booking request`,
    fechaMail: "2026-06-16T12:19:00.000Z",
    cuerpoTexto: "Booking request de prueba (sintético).",
    cuerpoHtml: "<p>Booking request de prueba (sintético).</p>",
    adjuntos: [{ nombre: "firma.png", tipo: "image/png", tamano: 1234 }],
    agencia: "Kilroy",
    dePrueba: true,
    ...extra,
  };
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M2-01 — reservas en la base (Supabase real)",
  { timeout: 60_000 },
  () => {
    let admin: SupabaseClient;
    let anonimo: SupabaseClient;
    let equipo: SupabaseClient;
    let usuarioEquipoId: string;
    let borrarSesion: () => Promise<void>;
    let soltarBloqueo: () => void;
    const reservasReales: string[] = [];
    const mailsReales: string[] = [];

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
      admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
      anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones);
      const sesion = await crearSesionDePrueba();
      equipo = sesion.cliente;
      borrarSesion = sesion.borrar;
      const { data } = await equipo.auth.getUser();
      usuarioEquipoId = data.user!.id;
      // Como en la app: todo el que entra tiene su fila en `usuario` (autor del historial).
      const { error } = await admin
        .from("usuario")
        .insert({ id: usuarioEquipoId, email: data.user!.email, nombre: "Test M2-01" });
      if (error) throw new Error(`No se pudo dar de alta el usuario de prueba: ${error.message}`);
    }, 360_000);

    afterAll(async () => {
      try {
        // La reserva "real" de las filas 5 y 7: se le pone la marca y se borra con el resto.
        if (reservasReales.length) await admin.from("reserva").update({ de_prueba: true }).in("id", reservasReales);
        if (mailsReales.length) await admin.from("mail_recibido").update({ de_prueba: true }).in("id", mailsReales);
        await registro.limpiar(admin);
        const { data: quedan } = await admin.from("mail_recibido").select("id").like("asunto", `${PREFIJO}%`);
        expect(quedan ?? []).toEqual([]);
      } finally {
        await borrarSesion?.();
        soltarBloqueo?.();
      }
    }, 120_000);

    // --- Fila 1 y 2: el mail original, una sola vez ---------------------------------

    it("fila 1: guarda un mail de Kilroy con su cuerpo y se lee igual", async () => {
      const entrada = mailKilroy();
      const { mail, nuevo } = await guardarMailRecibido(entrada, admin);
      expect(nuevo).toBe(true);

      const { data: leido, error } = await admin.from("mail_recibido").select("*").eq("id", mail.id).single();
      expect(error).toBeNull();
      expect(leido).toMatchObject({
        origen: "imap",
        carpeta: "inbox",
        imap_uidvalidity: 1700000000,
        imap_uid: entrada.imapUid,
        message_id: entrada.messageId,
        huella: entrada.messageId!.slice(1, -1).toLowerCase(),
        remitente: "aarhus@kilroy.dk",
        remitente_nombre: "KILROY Aarhus",
        destinatarios: ["sales@hitravel.com.ar"],
        asunto: entrada.asunto,
        cuerpo_texto: entrada.cuerpoTexto,
        cuerpo_html: entrada.cuerpoHtml,
        agencia: "Kilroy",
        de_prueba: true,
      });
      expect(new Date(leido!.fecha_mail).toISOString()).toBe("2026-06-16T12:19:00.000Z");
      // Los adjuntos que no son PDF: solo nombre, tipo y tamaño.
      expect(leido!.adjuntos).toEqual([{ nombre: "firma.png", tipo: "image/png", tamano: 1234, ruta: null }]);
    });

    it("fila 1: guarda un mail de TourRadar con su PDF, que se descarga idéntico", async () => {
      const pdf = pdfSintetico();
      const { mail } = await guardarMailRecibido(
        mailKilroy({
          remitente: "System@Sent-Via.NetSuite.com",
          remitenteNombre: "TourRadar Finance",
          asunto: `${PREFIJO} Booking Statement 0000001`,
          agencia: "TourRadar",
          adjuntos: [
            { nombre: "1# Booking Statement 0000001 - vendorbill.pdf", tipo: "application/pdf", contenido: pdf },
            { nombre: "logo.gif", tipo: "image/gif", contenido: new Uint8Array([1, 2, 3]) },
          ],
        }),
        admin,
      );
      expect(mail.remitente).toBe("system@sent-via.netsuite.com");
      const [adjPdf, adjGif] = mail.adjuntos;
      expect(adjPdf).toMatchObject({ tipo: "application/pdf", tamano: pdf.byteLength });
      expect(adjPdf.ruta).toMatch(new RegExp(`^${mail.id}/`));
      // M3-30: las imágenes con contenido también se guardan en el bucket.
      expect(adjGif).toEqual({ nombre: "logo.gif", tipo: "image/gif", tamano: 3, ruta: `${mail.id}/logo.gif` });

      const { data: archivo, error } = await admin.storage.from(BUCKET_ADJUNTOS).download(adjPdf.ruta!);
      expect(error).toBeNull();
      const bajado = new Uint8Array(await archivo!.arrayBuffer());
      expect(bajado.byteLength).toBe(pdf.byteLength);
      expect(Buffer.from(bajado).equals(Buffer.from(pdf))).toBe(true);
    });

    it("fila 2: el mismo mail dos veces deja una sola fila y devuelve la misma", async () => {
      const entrada = mailKilroy();
      const primero = await guardarMailRecibido(entrada, admin);
      const segundo = await guardarMailRecibido(entrada, admin);
      expect(segundo.nuevo).toBe(false);
      expect(segundo.mail.id).toBe(primero.mail.id);

      // El mismo Message-ID visto en Spam (otro UID) tampoco se duplica.
      const enSpam = await guardarMailRecibido({ ...entrada, carpeta: "spam", imapUid: 99 }, admin);
      expect(enSpam.nuevo).toBe(false);
      expect(enSpam.mail.id).toBe(primero.mail.id);

      const { count } = await admin
        .from("mail_recibido")
        .select("id", { count: "exact", head: true })
        .eq("huella", primero.mail.huella);
      expect(count).toBe(1);
    });

    it("fila 2: dos mails distintos sin Message-ID quedan como dos filas", async () => {
      const a = await guardarMailRecibido(mailKilroy({ messageId: null, cuerpoTexto: `uno ${randomUUID()}` }), admin);
      const b = await guardarMailRecibido(mailKilroy({ messageId: null, cuerpoTexto: `dos ${randomUUID()}` }), admin);
      expect(a.mail.huella).toMatch(/^sha256:/);
      expect(b.mail.id).not.toBe(a.mail.id);
      // Y el mismo sin Message-ID, dos veces: uno solo.
      const sinId = mailKilroy({ messageId: null, cuerpoTexto: `tres ${randomUUID()}` });
      const c1 = await guardarMailRecibido(sinId, admin);
      const c2 = await guardarMailRecibido(sinId, admin);
      expect(c2.mail.id).toBe(c1.mail.id);
    });

    // --- Filas 3 y 4: la reserva y su estado inicial ---------------------------------

    it("fila 3: crea una reserva `recibida` con todos los datos y se lee igual", async () => {
      const { mail } = await guardarMailRecibido(mailKilroy(), admin);
      const { data: producto } = await admin.from("producto").select("id").eq("codigo", "OD010D").single();
      const datos = {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        bookingId: "DK0000001",
        productoId: producto!.id,
        productoTextoAgencia: "Iguazu Falls Combined (2 nights in Brazil + 1 night in Argentina)",
        fechaInicio: "2026-11-02",
        fechaFin: "2026-11-05",
        pax: 2,
        pasajeros: [{ nombre: "Pax Uno" }, { nombre: "Pax Dos" }],
        vuelos: [{ numero: "G3 1234", llegada: "2026-11-02T10:00" }],
        habitacion: "Doble",
        pedidosEspeciales: "Sin gluten",
        estado: "recibida" as const,
        datosExtraidos: { booking_id: { valor: "DK0000001", confianza: 0.98 } },
        dePrueba: true,
      };
      const { reserva } = await crearReserva(datos, admin);
      const { data: leida } = await admin.from("reserva").select("*").eq("id", reserva.id).single();
      expect(leida).toMatchObject({
        agencia: "Kilroy",
        mail_recibido_id: mail.id,
        booking_id: "DK0000001",
        producto_id: producto!.id,
        producto_texto_agencia: datos.productoTextoAgencia,
        fecha_inicio: "2026-11-02",
        fecha_fin: "2026-11-05",
        pax: 2,
        pasajeros: datos.pasajeros,
        vuelos: datos.vuelos,
        habitacion: "Doble",
        pedidos_especiales: "Sin gluten",
        estado: "recibida",
        motivos_revision: [],
        posible_duplicada: false,
        duplicada_de_id: null,
        datos_extraidos: datos.datosExtraidos,
        de_prueba: true,
      });
    });

    it("fila 3: booking_id y producto pueden faltar", async () => {
      const { mail } = await guardarMailRecibido(mailKilroy(), admin);
      const { reserva } = await crearReserva(
        { agencia: "Kilroy", mailRecibidoId: mail.id, estado: "para_revision", motivosRevision: ["Falta el producto."], dePrueba: true },
        admin,
      );
      expect(reserva.booking_id).toBeNull();
      expect(reserva.producto_id).toBeNull();
    });

    it("no debe pasar: una reserva nace en `confirmada` o en `pedido_a_proveedor` (la base la rechaza)", async () => {
      const { mail } = await guardarMailRecibido(mailKilroy(), admin);
      for (const estado of ["confirmada", "pedido_a_proveedor"]) {
        const { error } = await admin
          .from("reserva")
          .insert({ agencia: "Kilroy", mail_recibido_id: mail.id, estado, de_prueba: true });
        expect(error, estado).not.toBeNull();
      }
      const { count } = await admin
        .from("reserva")
        .select("id", { count: "exact", head: true })
        .eq("mail_recibido_id", mail.id);
      expect(count).toBe(0);
    });

    it("fila 4: `para_revision` se acepta con dos motivos y se leen los dos", async () => {
      const { mail } = await guardarMailRecibido(mailKilroy(), admin);
      const motivos = ["El producto no está en el catálogo.", "Falta el vuelo de llegada."];
      const { reserva } = await crearReserva(
        { agencia: "Kilroy", mailRecibidoId: mail.id, estado: "para_revision", motivosRevision: motivos, dePrueba: true },
        admin,
      );
      const { data } = await admin.from("reserva").select("motivos_revision").eq("id", reserva.id).single();
      expect(data!.motivos_revision).toEqual(motivos);
    });

    it("no debe pasar: `para_revision` sin motivos, o `recibida` con motivos (la base la rechaza)", async () => {
      const { mail } = await guardarMailRecibido(mailKilroy(), admin);
      const sinMotivo = await admin
        .from("reserva")
        .insert({ agencia: "Kilroy", mail_recibido_id: mail.id, estado: "para_revision", de_prueba: true });
      expect(sinMotivo.error).not.toBeNull();
      const recibidaConMotivo = await admin.from("reserva").insert({
        agencia: "Kilroy",
        mail_recibido_id: mail.id,
        estado: "recibida",
        motivos_revision: ["x"],
        de_prueba: true,
      });
      expect(recibidaConMotivo.error).not.toBeNull();
    });

    // --- Fila 6: componentes ------------------------------------------------------------

    it("fila 6: una reserva de 5C01 con 3 componentes en orden", async () => {
      const { data: tour } = await admin.from("producto").select("id").eq("codigo", "5C01").single();
      const { data: partes } = await admin
        .from("producto_componente")
        .select("id, orden, tipo, componente_producto_id, descripcion_ruta")
        .eq("producto_id", tour!.id)
        .order("orden")
        .limit(3);
      expect(partes).toHaveLength(3);
      const { mail } = await guardarMailRecibido(mailKilroy({ remitente: "travels@kilroy.co.uk" }), admin);
      const { reserva } = await crearReserva(
        {
          agencia: "Kilroy",
          mailRecibidoId: mail.id,
          bookingId: "UK0000001",
          productoId: tour!.id,
          estado: "recibida",
          dePrueba: true,
          componentes: partes!.map((p, i) => ({
            tipo: p.tipo,
            productoId: p.componente_producto_id,
            productoComponenteId: p.id,
            descripcionRuta: p.descripcion_ruta,
            fechaInicio: `2026-12-0${i + 1}`,
            fechaFin: `2026-12-0${i + 2}`,
          })),
        },
        admin,
      );
      const { data: leidos } = await admin
        .from("reserva_componente")
        .select("orden, producto_componente_id, fecha_inicio")
        .eq("reserva_id", reserva.id)
        .order("orden");
      expect(leidos).toEqual(
        partes!.map((p, i) => ({ orden: i + 1, producto_componente_id: p.id, fecha_inicio: `2026-12-0${i + 1}` })),
      );
    });

    it("fila 6: Journaway con un tour suelto sin producto reconocido (solo texto y fecha)", async () => {
      const { mail } = await guardarMailRecibido(
        mailKilroy({ remitente: "de@journaway.com", agencia: "Journaway" }),
        admin,
      );
      const { reserva, componentes } = await crearReserva(
        {
          agencia: "Journaway",
          mailRecibidoId: mail.id,
          estado: "para_revision",
          motivosRevision: ["El producto no está en el catálogo."],
          dePrueba: true,
          componentes: [{ tipo: "paquete", textoAgencia: "Iguazu Falls Argentinian Side", fechaInicio: "2026-11-10" }],
        },
        admin,
      );
      expect(componentes).toHaveLength(1);
      const { data } = await admin.from("reserva_componente").select("*").eq("reserva_id", reserva.id);
      expect(data).toEqual([
        expect.objectContaining({
          orden: 1,
          tipo: "paquete",
          producto_id: null,
          texto_agencia: "Iguazu Falls Argentinian Side",
          fecha_inicio: "2026-11-10",
          fecha_fin: null,
        }),
      ]);
    });

    // --- Fila 7: historial ----------------------------------------------------------------

    it("fila 7: al crear aparece 'creada'; al cambiar de estado, el cambio (anterior y nuevo)", async () => {
      const { mail } = await guardarMailRecibido(mailKilroy(), admin);
      const motivos = ["Falta el vuelo de llegada."];
      const { reserva } = await crearReserva(
        { agencia: "Kilroy", mailRecibidoId: mail.id, estado: "para_revision", motivosRevision: motivos, dePrueba: true },
        admin,
      );
      const cambiada = await cambiarEstado(reserva.id, "recibida", {}, admin);
      expect(cambiada.estado).toBe("recibida");
      expect(cambiada.motivos_revision).toEqual([]);

      const { data: eventos } = await admin
        .from("evento_reserva")
        .select("tipo, estado_anterior, estado_nuevo, autor_id, detalle, created_at")
        .eq("reserva_id", reserva.id)
        .order("created_at");
      expect(eventos).toEqual([
        expect.objectContaining({
          tipo: "creada",
          estado_anterior: null,
          estado_nuevo: "para_revision",
          autor_id: null,
          detalle: { motivos: motivos },
        }),
        expect.objectContaining({
          tipo: "estado_cambiado",
          estado_anterior: "para_revision",
          estado_nuevo: "recibida",
          autor_id: null,
        }),
      ]);
      expect(eventos!.every((e) => e.created_at)).toBe(true);
    });

    it("fila 7: cada entrada guarda su autor (una persona del equipo o el sistema)", async () => {
      const { mail } = await guardarMailRecibido(mailKilroy(), admin);
      const { reserva } = await crearReserva(
        { agencia: "Kilroy", mailRecibidoId: mail.id, estado: "para_revision", motivosRevision: ["x"], dePrueba: true },
        admin,
      );
      // Una persona del equipo la pasa a recibida desde su sesión.
      const { error } = await equipo
        .from("reserva")
        .update({ estado: "recibida", motivos_revision: [] })
        .eq("id", reserva.id);
      expect(error).toBeNull();
      // Y el sistema agrega un mail del mismo intercambio.
      const otro = await guardarMailRecibido(mailKilroy(), admin);
      await agregarEvento(reserva.id, { tipo: "mail_agregado", mailRecibidoId: otro.mail.id }, admin);

      const { data: eventos } = await admin
        .from("evento_reserva")
        .select("tipo, autor_id, mail_recibido_id")
        .eq("reserva_id", reserva.id)
        .order("created_at");
      expect(eventos).toEqual([
        { tipo: "creada", autor_id: null, mail_recibido_id: null },
        { tipo: "estado_cambiado", autor_id: usuarioEquipoId, mail_recibido_id: null },
        { tipo: "mail_agregado", autor_id: null, mail_recibido_id: otro.mail.id },
      ]);
    });

    // --- Filas 5 y 7: la reserva real ------------------------------------------------------

    it("filas 5 y 7: el borrado de prueba se lleva la de prueba con todo lo suyo y no toca la real ni otra de prueba ajena; el historial de la real no se edita ni se borra", async () => {
      const { mail: mailPrueba } = await guardarMailRecibido(
        mailKilroy({ adjuntos: [{ nombre: "reserva.pdf", tipo: "application/pdf", contenido: pdfSintetico() }] }),
        admin,
      );
      const prueba = await crearReserva(
        {
          agencia: "Kilroy",
          mailRecibidoId: mailPrueba.id,
          estado: "recibida",
          dePrueba: true,
          componentes: [{ tipo: "tramo_bus", descripcionRuta: "El Calafate - El Chaltén", fechaInicio: "2026-12-01" }],
        },
        admin,
      );
      await cambiarEstado(prueba.reserva.id, "para_revision", { motivos: ["Revisar."] }, admin);
      await admin.from("ia_llamada").insert({
        tarea: "leer_mail",
        modelo: "claude-sonnet-test",
        version_instrucciones: "test",
        resultado: "ok",
        reserva_id: prueba.reserva.id,
        mail_recibido_id: mailPrueba.id,
        de_prueba: true,
      });

      // La "real": sin la marca (la limpia el afterAll poniéndole la marca).
      const { mail: mailReal } = await guardarMailRecibido(mailKilroy({ dePrueba: false }), admin);
      mailsReales.push(mailReal.id);
      const real = await crearReserva(
        {
          agencia: "Kilroy",
          mailRecibidoId: mailReal.id,
          estado: "recibida",
          dePrueba: false,
          componentes: [{ tipo: "paquete", textoAgencia: "Tour real de test" }],
        },
        admin,
      );
      reservasReales.push(real.reserva.id);
      expect(real.reserva.de_prueba).toBe(false);

      // Otra de prueba que no es de este borrado (como las del modo prueba, M2-06), con su llamada a la IA.
      const { mail: mailAjeno } = await guardarMailRecibido(mailKilroy(), admin);
      const ajena = await crearReserva(
        { agencia: "Kilroy", mailRecibidoId: mailAjeno.id, estado: "recibida", dePrueba: true, componentes: [{ tipo: "paquete", textoAgencia: "x" }] },
        admin,
      );
      await admin.from("ia_llamada").insert({
        tarea: "leer_mail",
        modelo: "claude-sonnet-test",
        version_instrucciones: "test",
        resultado: "ok",
        mail_recibido_id: mailAjeno.id,
        de_prueba: true,
      });

      // No debe pasar: editar o borrar el historial de la real, ni siquiera desde el servidor.
      const { data: eventoReal } = await admin
        .from("evento_reserva")
        .select("id, tipo")
        .eq("reserva_id", real.reserva.id)
        .single();
      const edicion = await admin.from("evento_reserva").update({ tipo: "mail_agregado" }).eq("id", eventoReal!.id);
      expect(edicion.error).not.toBeNull();
      const borrado = await admin.from("evento_reserva").delete().eq("id", eventoReal!.id);
      expect(borrado.error).not.toBeNull();
      // Desde una sesión del equipo tampoco (sin policy: no toca ninguna fila).
      await equipo.from("evento_reserva").update({ tipo: "mail_agregado" }).eq("id", eventoReal!.id);
      await equipo.from("evento_reserva").delete().eq("id", eventoReal!.id);
      // Ni borrar la reserva real directamente.
      const borradoReserva = await admin.from("reserva").delete().eq("id", real.reserva.id);
      expect(borradoReserva.error).not.toBeNull();
      const { data: sigue } = await admin.from("evento_reserva").select("id, tipo").eq("id", eventoReal!.id).single();
      expect(sigue).toEqual(eventoReal);

      const rutaPdf = mailPrueba.adjuntos[0].ruta!;
      // El mail real en la lista no cambia nada: solo se borra lo que tiene la marca de prueba.
      const { archivosBorrados } = await borrarDatosDePruebaDe({ mails: [mailPrueba.id, mailReal.id] }, admin);
      expect(archivosBorrados).toBe(1);

      // La de prueba se fue entera: reserva, componentes, historial, llamadas a la IA, mail y PDF.
      const contar = async (tabla: string, columna: string, valor: string) =>
        (await admin.from(tabla).select("id", { count: "exact", head: true }).eq(columna, valor)).count;
      expect(await contar("reserva", "id", prueba.reserva.id)).toBe(0);
      expect(await contar("reserva_componente", "reserva_id", prueba.reserva.id)).toBe(0);
      expect(await contar("evento_reserva", "reserva_id", prueba.reserva.id)).toBe(0);
      expect(await contar("ia_llamada", "reserva_id", prueba.reserva.id)).toBe(0);
      expect(await contar("mail_recibido", "id", mailPrueba.id)).toBe(0);
      const { data: pdfBorrado } = await admin.storage.from(BUCKET_ADJUNTOS).download(rutaPdf);
      expect(pdfBorrado).toBeNull();

      // La real sigue entera.
      expect(await contar("reserva", "id", real.reserva.id)).toBe(1);
      expect(await contar("reserva_componente", "reserva_id", real.reserva.id)).toBe(1);
      expect(await contar("evento_reserva", "reserva_id", real.reserva.id)).toBe(1);
      expect(await contar("mail_recibido", "id", mailReal.id)).toBe(1);

      // La de prueba ajena sigue entera, con su llamada a la IA.
      expect(await contar("reserva", "id", ajena.reserva.id)).toBe(1);
      expect(await contar("reserva_componente", "reserva_id", ajena.reserva.id)).toBe(1);
      expect(await contar("evento_reserva", "reserva_id", ajena.reserva.id)).toBe(1);
      expect(await contar("ia_llamada", "mail_recibido_id", mailAjeno.id)).toBe(1);
      expect(await contar("mail_recibido", "id", mailAjeno.id)).toBe(1);
    });

    it("el borrado acotado se lleva solo las llamadas a la IA sueltas que se le pasan, y solo si son de prueba", async () => {
      const llamada = (deP: boolean) => ({
        tarea: "proponer_producto",
        modelo: "claude-sonnet-test",
        version_instrucciones: "test",
        resultado: "ok",
        de_prueba: deP,
      });
      const { data: propias } = await admin.from("ia_llamada").insert([llamada(true), llamada(false)]).select("id");
      const { data: ajena } = await admin.from("ia_llamada").insert(llamada(true)).select("id").single();
      const [propia, real] = propias!.map((f) => f.id as string);
      const quedan = async (id: string) => (await admin.from("ia_llamada").select("id").eq("id", id)).data ?? [];
      try {
        await borrarDatosDePruebaDe({ mails: [], llamadas: [propia, real] }, admin);
        expect(await quedan(propia)).toHaveLength(0);
        expect(await quedan(real)).toHaveLength(1);
        expect(await quedan(ajena!.id)).toHaveLength(1);
      } finally {
        // La "real" no se borra nunca por esta vía: se le pone la marca y se borra con la ajena.
        await admin.from("ia_llamada").update({ de_prueba: true }).eq("id", real);
        await borrarDatosDePruebaDe({ mails: [], llamadas: [propia, real, ajena!.id] }, admin);
      }
      expect(await quedan(real)).toHaveLength(0);
      expect(await quedan(ajena!.id)).toHaveLength(0);
    });

    // --- Fila 10: solo el equipo ------------------------------------------------------------

    it("fila 10: el equipo lee la reserva, su mail, su historial y su PDF; sin sesión, nada", async () => {
      const { mail } = await guardarMailRecibido(
        mailKilroy({ adjuntos: [{ nombre: "statement.pdf", tipo: "application/pdf", contenido: pdfSintetico() }] }),
        admin,
      );
      const { reserva } = await crearReserva(
        {
          agencia: "Kilroy",
          mailRecibidoId: mail.id,
          estado: "recibida",
          dePrueba: true,
          componentes: [{ tipo: "paquete", textoAgencia: "x" }],
        },
        admin,
      );
      const ruta = mail.adjuntos[0].ruta!;

      const conEquipo = {
        reserva: (await equipo.from("reserva").select("id").eq("id", reserva.id)).data,
        mail: (await equipo.from("mail_recibido").select("id").eq("id", mail.id)).data,
        historial: (await equipo.from("evento_reserva").select("id").eq("reserva_id", reserva.id)).data,
        componentes: (await equipo.from("reserva_componente").select("id").eq("reserva_id", reserva.id)).data,
      };
      expect(conEquipo.reserva).toHaveLength(1);
      expect(conEquipo.mail).toHaveLength(1);
      expect(conEquipo.historial).toHaveLength(1);
      expect(conEquipo.componentes).toHaveLength(1);
      const pdfEquipo = await equipo.storage.from(BUCKET_ADJUNTOS).download(ruta);
      expect(pdfEquipo.error).toBeNull();

      // No debe pasar: leer algo sin sesión.
      expect((await anonimo.from("reserva").select("id").eq("id", reserva.id)).data ?? []).toEqual([]);
      expect((await anonimo.from("mail_recibido").select("id").eq("id", mail.id)).data ?? []).toEqual([]);
      expect((await anonimo.from("evento_reserva").select("id").eq("reserva_id", reserva.id)).data ?? []).toEqual(
        [],
      );
      expect(
        (await anonimo.from("reserva_componente").select("id").eq("reserva_id", reserva.id)).data ?? [],
      ).toEqual([]);
      const pdfAnonimo = await anonimo.storage.from(BUCKET_ADJUNTOS).download(ruta);
      expect(pdfAnonimo.data).toBeNull();
      // Y sin sesión tampoco se escribe.
      const insertAnonimo = await anonimo
        .from("reserva")
        .insert({ agencia: "Kilroy", mail_recibido_id: mail.id, estado: "recibida", de_prueba: true });
      expect(insertAnonimo.error).not.toBeNull();
      // Ni el equipo sube PDFs (solo el servidor).
      const subidaEquipo = await equipo.storage
        .from(BUCKET_ADJUNTOS)
        .upload(`${mail.id}/intruso.pdf`, pdfSintetico(), { contentType: "application/pdf" });
      expect(subidaEquipo.error).not.toBeNull();
      // Ni el equipo ni nadie de afuera llama al borrado de prueba.
      expect((await equipo.rpc("borrar_datos_de_prueba")).error).not.toBeNull();
      expect((await anonimo.rpc("borrar_datos_de_prueba")).error).not.toBeNull();
      expect((await equipo.rpc("borrar_datos_de_prueba_de", { p_mails: [mail.id] })).error).not.toBeNull();
      expect((await anonimo.rpc("borrar_datos_de_prueba_de", { p_mails: [mail.id] })).error).not.toBeNull();
    });

    // --- Fila 11: ia_llamada ----------------------------------------------------------------

    it("fila 11: una llamada a la IA se guarda y se lee igual; sin sesión no se lee; resultado fuera de la lista se rechaza", async () => {
      const { mail } = await guardarMailRecibido(mailKilroy(), admin);
      const fila = {
        tarea: "leer_mail",
        modelo: "claude-sonnet-test",
        version_instrucciones: "lectura-v1-test",
        tokens_in: 3200,
        tokens_out: 450,
        costo_usd: 0.01635,
        resultado: "cortada",
        mail_recibido_id: mail.id,
        reserva_id: null,
        de_prueba: true,
      };
      const { data: creada, error } = await admin.from("ia_llamada").insert(fila).select("*").single();
      expect(error).toBeNull();
      expect({ ...creada, costo_usd: Number(creada!.costo_usd) }).toMatchObject(fila);
      expect(creada!.created_at).toBeTruthy();
      expect(Object.keys(creada!).some((c) => /cuerpo|contenido|texto/.test(c))).toBe(false);

      expect((await equipo.from("ia_llamada").select("id").eq("id", creada!.id)).data).toHaveLength(1);
      expect((await anonimo.from("ia_llamada").select("id").eq("id", creada!.id)).data ?? []).toEqual([]);

      for (const resultado of ["ok", "invalida", "error", "sin_presupuesto"]) {
        const r = await admin.from("ia_llamada").insert({ ...fila, resultado });
        expect(r.error, resultado).toBeNull();
      }
      const fuera = await admin.from("ia_llamada").insert({ ...fila, resultado: "perfecta" });
      expect(fuera.error).not.toBeNull();
    });
  },
);
