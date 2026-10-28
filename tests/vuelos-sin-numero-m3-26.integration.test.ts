// @vitest-environment node
//
// Spec M3-26 fila 2b — verificación 2 (integración contra la BASE DE PRUEBAS): las reservas ya
// recibidas con el vuelo sin número de Kilroy en el mail. Sin `aplicar` no cambia nada; con
// `aplicar` guarda los dos vuelos y deja el historial como la corrección de vuelos (M3-07).
// Una reserva que ya tiene vuelos no se toca. Todo lo que crea el test es de prueba y se borra al final.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mailDePrueba } from "@/lib/reservas/__fixtures__/cargar";
import { crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import type { FichaLectura } from "@/lib/reservas/esquema-ficha";
import type { ReservaEntrada } from "@/lib/reservas/tipos";
import { vuelosSinNumeroDeLasGuardadas } from "@/lib/reservas/vuelos-sin-numero-guardadas";
import { TEXTOS } from "@/lib/textos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";

const PREFIJO = "[test M3-26]";
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);
const mailDk = mailDePrueba("kilroy-dk1597924");

const LLEGADA = { numero: null, aerolinea: null, origen: null, destino: "IGU", fecha_salida: null, hora_salida: null, fecha_llegada: "2027-02-20", hora_llegada: "16:45", confianza: 1 };
const SALIDA = { numero: null, aerolinea: null, origen: "IGR", destino: null, fecha_salida: "2027-02-23", hora_salida: "13:30", fecha_llegada: null, hora_llegada: null, confianza: 1 };

(credencialesSupabaseDisponibles() ? describe : describe.skip)("M3-26 — vuelos sin número de las reservas ya recibidas (base de pruebas)", { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let od010b: string | null = null;

  async function reserva(extra: Partial<ReservaEntrada> = {}): Promise<string> {
    const { mail } = await guardarMailRecibido(
      {
        origen: "archivo",
        archivoOrigen: `${PREFIJO} ${randomUUID()}.txt`,
        messageId: `<${randomUUID()}@test-m3-26.hitravel.local>`,
        remitente: "aarhus@kilroy.dk",
        asunto: `${PREFIJO} ${mailDk.asunto}`,
        fechaMail: "2026-10-26T09:19:00.000Z",
        cuerpoTexto: mailDk.cuerpoTexto,
        agencia: "Kilroy",
        dePrueba: true,
      },
      admin,
    );
    const { reserva: r } = await crearReserva(
      {
        agencia: "Kilroy",
        mailRecibidoId: mail.id,
        bookingId: `TEST326${randomUUID().slice(0, 8)}`,
        estado: "recibida",
        motivosRevision: [],
        productoId: od010b,
        productoTextoAgencia: "OD010B",
        fechaInicio: "2027-02-20",
        fechaFin: "2027-02-23",
        pax: 2,
        vuelos: [],
        datosExtraidos: { tipo_mail: { valor: "reserva_nueva", confianza: 1 } } as unknown as FichaLectura,
        dePrueba: true,
        ...extra,
      },
      admin,
    );
    return r.id;
  }

  const leer = async (id: string) => (await admin.from("reserva").select("vuelos,estado").eq("id", id).single()).data!;
  const eventos = async (id: string) =>
    (await admin.from("evento_reserva").select("tipo,detalle").eq("reserva_id", id).eq("tipo", "vuelos_corregidos")).data ?? [];

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const p = await admin.from("producto").select("id").eq("codigo", "OD010B").maybeSingle();
    od010b = p.data?.id ?? null;
  }, 120_000);

  afterAll(async () => {
    await registro.limpiar(admin);
  }, 120_000);

  it("sin aplicar: muestra los 2 vuelos y no cambia nada; con aplicar: los guarda con historial; otra vez: ya no aparece", async () => {
    const id = await reserva();
    const conVuelos = await reserva({ vuelos: [{ ...LLEGADA, numero: "G3 1234" }] });
    const ids = [id, conVuelos];

    const vista = await vuelosSinNumeroDeLasGuardadas(admin, { reservaIds: ids });
    expect(vista.guardadas).toBe(0);
    expect(vista.reservas).toHaveLength(1);
    expect(vista.reservas[0]).toMatchObject({ reservaId: id, estado: "recibida", vuelos: [LLEGADA, SALIDA] });
    expect((await leer(id)).vuelos).toEqual([]);
    expect(await eventos(id)).toEqual([]);

    const aplicada = await vuelosSinNumeroDeLasGuardadas(admin, { reservaIds: ids, aplicar: true });
    expect(aplicada.guardadas).toBe(1);
    expect(await leer(id)).toEqual({ vuelos: [LLEGADA, SALIDA], estado: "recibida" });
    const ev = await eventos(id);
    expect(ev).toHaveLength(1);
    expect(ev[0].detalle).toMatchObject({
      persona: TEXTOS.reserva.corregir.lecturaDelMail,
      vuelos: [
        { lado: "llegada", numero: "", aeropuerto: "IGU", fecha: "2027-02-20", hora: "16:45" },
        { lado: "salida", numero: "", aeropuerto: "IGR", fecha: "2027-02-23", hora: "13:30" },
      ],
    });
    expect((await leer(conVuelos)).vuelos).toEqual([{ ...LLEGADA, numero: "G3 1234" }]);
    expect(await eventos(conVuelos)).toEqual([]);

    const otraVez = await vuelosSinNumeroDeLasGuardadas(admin, { reservaIds: ids, aplicar: true });
    expect(otraVez).toEqual({ reservas: [], guardadas: 0 });
    expect(await eventos(id)).toHaveLength(1);
  });
});
