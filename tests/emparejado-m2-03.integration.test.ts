// @vitest-environment node
//
// Spec M2-03 — verificación 2 (integración contra el Supabase real, con la IA
// simulada): carga de data/codigos-kilroy.csv, emparejado contra el catálogo
// cargado, `reserva_componente` de los 7 tours (fila 9), historial "creada"
// por el sistema, `ia_llamada` con su reserva y el catálogo sin cambios
// (fila 16). Todo lo que se crea lleva `de_prueba = true` y se borra al final.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { borrarDatosDePruebaDe, guardarMailRecibido } from "@/lib/reservas/guardar";
import { fichaDePrueba as fichaDePruebaReal } from "@/lib/reservas/emparejar/__fixtures__/cargar";
import { importarCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { importarCodigosTourRadarCsv } from "@/lib/reservas/emparejar/codigos-tourradar-csv";
import type { ProponerProducto } from "@/lib/reservas/emparejar/emparejar";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { aNumeroDeTest, conNumerosDeTest } from "@/lib/reservas/numeros-de-test";

const CSV = readFileSync(join(process.cwd(), "data", "codigos-kilroy.csv"), "utf-8");
const CSV_TR = readFileSync(join(process.cwd(), "data", "codigos-tourradar.csv"), "utf-8");

/**
 * Las fichas con números de reserva de test (DK1576932 → DK9576932): las del
 * modo prueba (M2-06) usan los reales en la misma base, y el índice único de
 * booking_id + producto chocaría.
 */
const fichaDePrueba = (nombre: string) => conNumerosDeTest(fichaDePruebaReal(nombre));

(credencialesSupabaseDisponibles() ? describe : describe.skip)(
  "M2-03 — reconocer el producto contra Supabase real",
  { timeout: 120_000 },
  () => {
    let admin: SupabaseClient;
    let soltarBloqueo: () => void;
    let mailId: string;
    const idPorCodigo = new Map<string, string>();

    async function codigosExternos() {
      const { data, error } = await admin
        .from("codigo_externo")
        .select("producto_id,agencia,codigo,nombre_externo")
        .order("agencia")
        .order("codigo")
        .range(0, 9999);
      if (error) throw new Error(error.message);
      return data;
    }

    async function crear(ficha: FichaLectura, proponer?: ProponerProducto) {
      const deps = await cargarDependenciasReservas(admin, proponer);
      return crearReservasDelMail(ficha, {
        admin,
        mailRecibidoId: mailId,
        agencia: ficha.agencia.valor!,
        deps,
        llamadas: crearRegistroLlamadasSupabase(admin),
        dePrueba: true,
      });
    }

    async function componentesDe(reservaId: string) {
      const { data, error } = await admin
        .from("reserva_componente")
        .select("orden,tipo,producto_id,descripcion_ruta,fecha_inicio,fecha_fin,es_tarea,proveedor_id,producto_servicio_id")
        .eq("reserva_id", reservaId)
        .order("orden");
      if (error) throw new Error(error.message);
      return data!;
    }

    const conCodigo = (base: string, codigo: string, inicio: string, fin: string) => {
      const f = fichaDePrueba(base);
      f.productos = [{ ...f.productos[0], nombre: `Tour ${codigo}`, codigo: `HI_ARGENTINA_${codigo}-677`, fecha_inicio: inicio, fecha_fin: fin }];
      return f;
    };

    beforeAll(async () => {
      soltarBloqueo = await tomarBloqueoDatosDePrueba();
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await admin.from("producto").select("id,codigo");
      for (const p of data ?? []) idPorCodigo.set(p.codigo, p.id);
      const { mail } = await guardarMailRecibido(
        {
          origen: "archivo",
          remitente: "copenhagen@kilroy.dk",
          asunto: `[test M2-03] ${randomUUID()}`,
          cuerpoTexto: "mail de prueba de M2-03",
          agencia: "Kilroy",
          dePrueba: true,
        },
        admin,
      );
      mailId = mail.id;
    }, 360_000);

    afterAll(async () => {
      try {
        // Solo lo de este archivo: el mail, sus reservas y sus llamadas a la IA.
        await borrarDatosDePruebaDe({ mails: [mailId] }, admin);
        const { data: quedan } = await admin.from("reserva").select("id").eq("mail_recibido_id", mailId);
        expect(quedan ?? []).toEqual([]);
      } finally {
        soltarBloqueo?.();
      }
    }, 120_000);

    it("fila 2: una fila con ARCH33EXP (no cargado) hace fallar la carga y no escribe nada", async () => {
      const antes = await codigosExternos();
      const malo = `${CSV.trim()}\nHI_TRAVEL_ARCH_EXP-677,ARCH33EXP,Trekking Paradise EXPRESS,no cargado\n`;
      await expect(importarCodigosKilroy(admin, malo)).rejects.toThrow(/ARCH33EXP no existe en el catálogo.*No se cargó nada/);
      expect(await codigosExternos()).toEqual(antes);
    });

    it("fila 2: data/codigos-kilroy.csv se carga en codigo_externo (agencia Kilroy) y es re-ejecutable", async () => {
      await importarCodigosKilroy(admin, CSV);
      const segunda = await importarCodigosKilroy(admin, CSV);
      expect(segunda.creados).toBe(0);
      expect(segunda.actualizados).toBe(0);
      const filas = await codigosExternos();
      expect(filas).toContainEqual(
        expect.objectContaining({ agencia: "Kilroy", codigo: "HI_ARGENTINA_OVERLAND_7DAYS-677", producto_id: idPorCodigo.get("CHB31") }),
      );
      expect(filas).toContainEqual(
        expect.objectContaining({ agencia: "Kilroy", codigo: "HI_ARGENTINA_W_TREK_ARCH_33-677", producto_id: idPorCodigo.get("ARCH33") }),
      );
    });

    it("filas 8, 9, 10, 11 y 14: el Kilroy DK1576932 deja ARCH33 (final PNT) y CHB31, con historial 'creada' del sistema", async () => {
      const creadas = await crear(fichaDePrueba("kilroy-dk1576932"));
      expect(creadas.map((c) => c.reserva.producto_id)).toEqual([idPorCodigo.get("ARCH33"), idPorCodigo.get("CHB31")]);
      for (const c of creadas) {
        expect(c.reserva).toMatchObject({ booking_id: aNumeroDeTest("DK1576932"), estado: "para_revision", origen_emparejado: "codigo", de_prueba: true });
        const { data: eventos } = await admin.from("evento_reserva").select("tipo,autor_id,estado_nuevo").eq("reserva_id", c.reserva.id);
        expect(eventos).toEqual([{ tipo: "creada", autor_id: null, estado_nuevo: "para_revision" }]);
      }
      expect(creadas[0].reserva.motivos_revision).toEqual([
        "Falta el vuelo de llegada a El Calafate (FTE) para el traslado de OD033",
        "Falta el vuelo de salida de Puerto Natales (PNT) para el traslado al aeropuerto de Puerto Natales",
      ]);
      const partes = await componentesDe(creadas[0].reserva.id);
      expect(partes.at(-1)).toMatchObject({ tipo: "servicio", es_tarea: false, descripcion_ruta: "Transfer al aeropuerto de Puerto Natales (PNT)" });
      expect(partes.at(-1)!.proveedor_id).toBeTruthy();
    });

    it("fila 9: CHB31 desde el 13 Sep 2026 → OD030 el 13/9, COMPBO20 el 16/9, bus Uyuni – La Paz el 18/9 con Imperio Inca", async () => {
      const [c] = await crear(fichaDePrueba("kilroy-chb31-dk1547743"));
      expect(c.reserva.motivos_revision).toEqual(["Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030"]);
      const partes = await componentesDe(c.reserva.id);
      expect(partes.map((p) => [p.tipo, p.producto_id ?? p.descripcion_ruta, p.fecha_inicio])).toEqual([
        ["paquete", idPorCodigo.get("OD030"), "2026-09-13"],
        ["paquete", idPorCodigo.get("COMPBO20"), "2026-09-16"],
        ["servicio", "Bus Uyuni – La Paz", "2026-09-18"],
      ]);
      const { data: imperio } = await admin.from("proveedor").select("nombre").eq("id", partes[2].proveedor_id!).single();
      expect(imperio?.nombre).toMatch(/imperio inca/i);
    });

    it.each([
      ["BOCHI04R", "kilroy-bochi04r-dk1559523", 2],
      ["ARCH31", "kilroy-arch31-no1569851", 3],
      ["AR09", null, 4],
      ["BRARCH26", null, 5],
      ["5C01", "kilroy-5c01-uk1586142", 10],
    ])("fila 9: %s deja sus paquetes en orden y ningún bus Kupos/Plataforma10 como pedido", async (codigo, base, paquetes) => {
      const ficha = base ? fichaDePrueba(base) : conCodigo("kilroy-arch31-no1569851", codigo, "2027-04-01", "2027-04-16");
      const [c] = await crear(ficha);
      expect(c.reserva.producto_id).toBe(idPorCodigo.get(codigo));
      const partes = await componentesDe(c.reserva.id);
      expect(partes.filter((p) => p.tipo === "paquete")).toHaveLength(paquetes);
      for (const p of partes) {
        if (p.tipo === "tramo_bus") expect(p.es_tarea).toBe(true);
        if (p.es_tarea) expect(p.proveedor_id).toBeNull();
        if (p.tipo === "servicio") expect(p.descripcion_ruta).not.toMatch(/kupos|plataforma/i);
      }
      const fechas = partes.map((p) => p.fecha_inicio!);
      expect([...fechas].sort()).toEqual(fechas);
    });

    it("filas 4, 14 y 16: el Overland de TourRadar por IA → CHB31, ia_llamada con la reserva, y codigo_externo no cambió", async () => {
      const antes = await codigosExternos();
      const proponer = vi.fn<ProponerProducto>(async () => ({
        resultado: { tipo: "respuesta", codigo: "CHB31", confianza: 0.95, motivo: "simulada" },
        llamada: {
          tarea: "propuesta_producto",
          modelo: "modelo-de-prueba",
          versionInstrucciones: "propuesta-producto.v1",
          tokensIn: 1000,
          tokensOut: 50,
          costoUsd: 0.0025,
          resultado: "ok",
          mailRecibidoId: mailId,
          dePrueba: true,
        },
        costo: 0.0025,
      }));
      const [c] = await crear(fichaDePrueba("tourradar-overland-1376833"), proponer);
      expect(c.reserva).toMatchObject({
        producto_id: idPorCodigo.get("CHB31"),
        origen_emparejado: "ia",
        estado: "para_revision",
        motivos_revision: ["Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030"],
      });
      expect(Number(c.reserva.confianza_emparejado)).toBe(0.95);
      const { data: llamadas } = await admin
        .from("ia_llamada")
        .select("tarea,version_instrucciones,reserva_id,mail_recibido_id")
        .eq("reserva_id", c.reserva.id);
      expect(llamadas).toEqual([
        { tarea: "propuesta_producto", version_instrucciones: "propuesta-producto.v1", reserva_id: c.reserva.id, mail_recibido_id: mailId },
      ]);
      expect(await codigosExternos()).toEqual(antes);
    });

    it("fila 4: con confianza baja queda la sugerencia guardada, sin producto", async () => {
      const proponer = vi.fn<ProponerProducto>(async () => ({
        resultado: { tipo: "respuesta", codigo: "CHB31", confianza: 0.7, motivo: "simulada" },
        llamada: null,
        costo: 0,
      }));
      const [c] = await crear(fichaDePrueba("tourradar-overland-1376833"), proponer);
      expect(c.reserva).toMatchObject({ producto_id: null, origen_emparejado: null, sugerencia_producto_id: idPorCodigo.get("CHB31") });
      expect(c.componentes).toEqual([]);
    });

    it("filas 3 y 14: TourRadar Shoestring por nombre; Kilroy OD010D con vuelos → recibida", async () => {
      const [tr] = await crear(fichaDePrueba("tourradar-shoestring"));
      expect(tr.reserva).toMatchObject({ producto_id: idPorCodigo.get("OD010A"), origen_emparejado: "nombre", estado: "recibida" });
      const [k] = await crear(fichaDePrueba("kilroy-od010d-dk1564627"));
      expect(k.reserva).toMatchObject({ producto_id: idPorCodigo.get("OD010D"), origen_emparejado: "codigo", estado: "recibida", motivos_revision: [] });
    });

    // --- Productos y códigos (owner, 2026-10-14) --------------------------------------------

    /** Las llamadas a la IA registradas con una reserva. */
    async function llamadasDe(reservaId: string) {
      const { data, error } = await admin.from("ia_llamada").select("id").eq("reserva_id", reservaId);
      if (error) throw new Error(error.message);
      return data!;
    }
    const iaQueNoSeDebeLlamar = () => vi.fn<ProponerProducto>(async () => ({ resultado: { tipo: "fallo", causa: "error" }, llamada: null, costo: 0 }));

    it("owner 2026-10-14: Kilroy HI_TRAVEL_ARCH_EXP-677 → para revisión con 'no cargado' y 0 llamadas a la IA", async () => {
      const proponer = iaQueNoSeDebeLlamar();
      const [c] = await crear(fichaDePrueba("kilroy-arch-exp-dk1586168"), proponer);
      expect(c.reserva).toMatchObject({ estado: "para_revision", producto_id: null });
      expect(c.reserva.motivos_revision).toEqual([
        "El producto ARCH33EXP (Patagonia, Trekking Paradise with W-Trek EXPRESS) existe en el catálogo de HI Travel pero todavía no está cargado en el sistema.",
      ]);
      expect(proponer).not.toHaveBeenCalled();
      expect(await llamadasDe(c.reserva.id)).toEqual([]);
    });

    it("owner 2026-10-14: TourRadar número de tour 150104 → ARBR23 no cargado, 0 llamadas a la IA", async () => {
      const proponer = iaQueNoSeDebeLlamar();
      const ficha = fichaDePrueba("tourradar-ba-rio-1377583");
      ficha.productos[0].codigo = "150104";
      const [c] = await crear(ficha, proponer);
      expect(c.reserva).toMatchObject({ estado: "para_revision", producto_id: null });
      expect(c.reserva.motivos_revision).toEqual([
        "El producto ARBR23 (From Buenos Aires to Rio) existe en el catálogo de HI Travel pero todavía no está cargado en el sistema.",
      ]);
      expect(proponer).not.toHaveBeenCalled();
      expect(await llamadasDe(c.reserva.id)).toEqual([]);
    });

    it("owner 2026-10-14: data/codigos-tourradar.csv deja 150146 → AR09 (re-ejecutable) y el TourRadar 150146 empareja AR09 por código", async () => {
      await importarCodigosTourRadarCsv(admin, CSV_TR);
      const segunda = await importarCodigosTourRadarCsv(admin, CSV_TR);
      expect(segunda).toMatchObject({ creados: 0, actualizados: 0 });
      expect(await codigosExternos()).toContainEqual(
        expect.objectContaining({ agencia: "TourRadar", codigo: "150146", producto_id: idPorCodigo.get("AR09") }),
      );
      const proponer = iaQueNoSeDebeLlamar();
      const ficha = fichaDePrueba("tourradar-patagonia-adventure-1377598");
      ficha.productos[0].codigo = "150146";
      const [c] = await crear(ficha, proponer);
      expect(c.reserva).toMatchObject({ producto_id: idPorCodigo.get("AR09"), origen_emparejado: "codigo" });
      expect(proponer).not.toHaveBeenCalled();
    });

    it("fila 13: la cancelación de TourRadar queda para revisión, nunca recibida", async () => {
      const [c] = await crear(fichaDePrueba("tourradar-cancelacion-1363612"));
      expect(c.reserva.estado).toBe("para_revision");
      expect(c.reserva.motivos_revision).toEqual(["El mail es una cancelación: la resuelve una persona"]);
    });
  },
);
