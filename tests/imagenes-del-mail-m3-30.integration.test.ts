// @vitest-environment node
//
// Spec M3-30 — verificación 2: las imágenes del mail contra la BASE DE PRUEBAS,
// con la IA FALSA (no gasta, #4).
// - Fila 1: un mail con 3 imágenes cid: deja 3 archivos con ruta en `adjuntos`,
//   en el bucket privado, y el detalle de la reserva los muestra.
// - Fila 8: reprocesar un mail ya guardado (como Petzold, que entró antes de
//   M3-30 sin sus imágenes): en seco no cambia nada; con --aplicar sube las
//   imágenes, descarta la reserva vieja y deja la nueva (SPAP05). Una reserva
//   que ya avanzó no se toca.
// Todo lo que crea lleva la marca de prueba y se borra al terminar, solo eso.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sumarNombresJournaway } from "@/lib/importador-journaway/sumar-nombres";
import { camposDeEml } from "@/lib/modo-prueba/leer-archivo";
import { clienteFalso, registroFalso, respuestaCon } from "@/lib/reservas/__fixtures__/cargar";
import { cargarReserva } from "@/lib/reservas/consultas";
import { cargarDependenciasReservas, type DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import type { FichaIA } from "@/lib/reservas/esquema-ficha";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { procesarMail, type OpcionesProceso } from "@/lib/reservas/procesar-mail";
import { reprocesarMailGuardado } from "@/lib/reservas/reprocesar";
import { BUCKET_ADJUNTOS, type AdjuntoGuardado, type MailEntrada } from "@/lib/reservas/tipos";
import { emlPetzold, fichaIAPetzold, IMAGENES_PETZOLD, imagenPetzold } from "./fixtures/journaway/petzold";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const registro = crearRegistroDePrueba();
/** Un ID de Journaway (11 dígitos) único por corrida. */
const idUnico = (prefijo: string) => `${prefijo}${String(Date.now()).slice(-8)}`;

/** La ficha de antes de M3-30: sin las imágenes, la IA solo veía el texto (el bus Perú y el traslado). */
function fichaSinImagenes(id: string): FichaIA {
  const f = fichaIAPetzold();
  return {
    ...f,
    numero_reserva: { valor: `ID ${id} · Trip 65037`, confianza: 1 },
    productos: f.productos.filter((p) => /Night Bus Peru|Shared Transport/.test(p.nombre)),
  };
}

async function entradaPetzold(id: string, extra: Partial<MailEntrada> = {}): Promise<MailEntrada> {
  const campos = await camposDeEml(new Uint8Array(await emlPetzold({ messageId: `<m3-30-${randomUUID()}@prueba.test>` })));
  return {
    origen: "imap",
    carpeta: "inbox",
    imapUidvalidity: 999,
    imapUid: 100_000 + Math.floor(Math.random() * 900_000_000),
    messageId: `<m3-30-${randomUUID()}@prueba.test>`,
    ...campos,
    asunto: campos.asunto!.replace("66688059968", id),
    dePrueba: true,
    ...extra,
  };
}

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M3-30 — las imágenes del mail en la base de pruebas (IA falsa)",
  { timeout: 300_000 },
  () => {
    let admin: SupabaseClient;
    let deps: DependenciasReservas;
    let soltarBloqueo: () => void;

    function opciones(ficha: FichaIA): OpcionesProceso & { create: ReturnType<typeof clienteFalso>["create"] } {
      const { cliente, create } = clienteFalso(respuestaCon(ficha));
      const { registro: uso } = registroFalso();
      return {
        admin,
        dePrueba: true,
        alcance: () => registro.mails,
        leer: (mail, ctx) => {
          registro.mail(ctx.mailRecibidoId);
          return leerMailConIA(mail, { cliente, registro: uso, mes: "2026-10", mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
        },
        deps: () => deps,
        create,
      };
    }

    async function reservasDe(mailId: string) {
      const { data, error } = await admin
        .from("reserva")
        .select("id, estado, motivos_revision, producto:producto_id(codigo)")
        .eq("mail_recibido_id", mailId)
        .order("created_at");
      if (error) throw new Error(error.message);
      return data as unknown as Array<{ id: string; estado: string; motivos_revision: string[]; producto: { codigo: string } | null }>;
    }

    async function adjuntosDe(mailId: string): Promise<AdjuntoGuardado[]> {
      const { data, error } = await admin.from("mail_recibido").select("adjuntos").eq("id", mailId).single();
      if (error) throw new Error(error.message);
      return data.adjuntos as AdjuntoGuardado[];
    }

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      // Los nombres en alemán (fila 4) en la base de pruebas: lo mismo que hace el script en la real.
      const nombres = await sumarNombresJournaway(admin, { aplicar: true });
      expect(nombres.sinProducto).toEqual([]);
      expect(nombres.enOtroProducto).toEqual([]);
      expect((await sumarNombresJournaway(admin, { aplicar: false })).sumados).toEqual([]);
      deps = await cargarDependenciasReservas(admin);
    }, 420_000);

    afterAll(async () => {
      try {
        await registro.limpiar(admin);
      } finally {
        soltarBloqueo?.();
      }
    }, 120_000);

    it("fila 1: las 3 imágenes cid: quedan en el bucket con su ruta y el detalle las muestra", async () => {
      const id = idUnico("664");
      const o = opciones({ ...fichaIAPetzold(), numero_reserva: { valor: `ID ${id} · Trip 65037`, confianza: 1 } });
      const r = await procesarMail(await entradaPetzold(id), o);
      registro.mail(r.mailRecibidoId);
      expect(r.estado).toBe("procesado");

      const adjuntos = await adjuntosDe(r.mailRecibidoId);
      expect(adjuntos.map((a) => [a.nombre, a.tipo, !!a.ruta])).toEqual(IMAGENES_PETZOLD.map((i) => [i.cid.split("@")[0], "image/png", true]));
      for (const [i, a] of adjuntos.entries()) {
        const { data, error } = await admin.storage.from(BUCKET_ADJUNTOS).download(a.ruta!);
        expect(error).toBeNull();
        expect(new Uint8Array(await data!.arrayBuffer())).toEqual(imagenPetzold(IMAGENES_PETZOLD[i].archivo));
      }

      // La IA recibió las 3 imágenes.
      const contenido = (o.create.mock.calls[0] as unknown as [{ messages: Array<{ content: Array<{ type: string }> }> }])[0].messages[0].content;
      expect(contenido.filter((b) => b.type === "image")).toHaveLength(3);

      const [reserva] = await reservasDe(r.mailRecibidoId);
      expect(reserva.producto?.codigo).toBe("SPAP05");
      const detalle = await cargarReserva(admin, reserva.id);
      expect(detalle!.mails[0].pdfs.map((p) => [p.nombre, p.esImagen])).toEqual(IMAGENES_PETZOLD.map((i) => [i.cid.split("@")[0], true]));
    });

    it("fila 8: reprocesar un mail guardado sin sus imágenes (en seco no cambia nada; con aplicar queda SPAP05)", async () => {
      const id = idUnico("665");
      // El mail como entró antes de M3-30: las imágenes sin contenido, la IA solo con el texto.
      const completa = await entradaPetzold(id);
      const vieja = { ...completa, adjuntos: completa.adjuntos!.map((a) => ({ nombre: a.nombre, tipo: a.tipo, tamano: a.contenido!.byteLength })) };
      const antes = await procesarMail(vieja, opciones(fichaSinImagenes(id)));
      registro.mail(antes.mailRecibidoId);
      const [reservaVieja] = await reservasDe(antes.mailRecibidoId);
      expect(reservaVieja.estado).toBe("para_revision");
      expect((await adjuntosDe(antes.mailRecibidoId)).every((a) => a.ruta === null)).toBe(true);

      // En seco: dice qué haría, sin escribir ni llamar a la IA.
      const seco = opciones(fichaIAPetzold());
      const r1 = await reprocesarMailGuardado(completa, { ...seco, aplicar: false });
      expect(r1).toMatchObject({ estado: "en_seco", mailRecibidoId: antes.mailRecibidoId, imagenes: IMAGENES_PETZOLD.map((i) => i.cid.split("@")[0]) });
      expect(seco.create).not.toHaveBeenCalled();
      expect((await reservasDe(antes.mailRecibidoId)).map((x) => x.estado)).toEqual(["para_revision"]);

      // Con aplicar.
      const o = opciones({ ...fichaIAPetzold(), numero_reserva: { valor: `ID ${id} · Trip 65037`, confianza: 1 } });
      const r2 = await reprocesarMailGuardado(completa, { ...o, aplicar: true });
      expect(r2).toMatchObject({ estado: "reprocesado", subidas: 3 });
      expect(o.create).toHaveBeenCalledTimes(1);
      const despues = await reservasDe(antes.mailRecibidoId);
      expect(despues.map((x) => [x.estado, x.producto?.codigo ?? null])).toEqual([
        ["descartada", null],
        ["para_revision", "SPAP05"],
      ]);
      expect(despues[1].motivos_revision).toContain(
        "Journaway pide 'Night Bus Peru' (31.05–01.06), que no es parte de SPAP05: consultarlo con Journaway",
      );
      expect((await adjuntosDe(antes.mailRecibidoId)).map((a) => !!a.ruta)).toEqual([true, true, true]);

      // Una reserva que ya avanzó (pedida a un proveedor) no se toca.
      await admin.from("reserva").update({ estado: "pedido_a_proveedor", motivos_revision: [] }).eq("id", despues[1].id);
      const r3 = await reprocesarMailGuardado(completa, { ...opciones(fichaIAPetzold()), aplicar: true });
      expect(r3.estado).toBe("no_se_toca");
      expect((await reservasDe(antes.mailRecibidoId)).map((x) => x.estado)).toEqual(["descartada", "pedido_a_proveedor"]);
    });

    it("un mail que no está guardado no se reprocesa", async () => {
      const r = await reprocesarMailGuardado(await entradaPetzold(idUnico("666"), { imapUid: 1, imapUidvalidity: 1 }), {
        ...opciones(fichaIAPetzold()),
        aplicar: true,
      });
      expect(r.estado).toBe("no_esta");
    });
  },
);
