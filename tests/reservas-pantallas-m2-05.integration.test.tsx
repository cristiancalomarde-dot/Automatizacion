// @vitest-environment jsdom
//
// Spec M2-05 — verificación 2 (integración contra el Supabase real): se
// carga con la clave de servicio un juego de reservas DE PRUEBA (recibida de
// producto simple, tour con partes, para revisión por falta de vuelo, sin
// producto reconocido, y una con 2 mails y PDF) y se lee como lo hace la app:
// con una sesión del equipo, las consultas y las pantallas devuelven lo
// esperado; sin sesión, 0 filas y el PDF no se descarga (#15). Todo lleva
// `de_prueba = true` y se borra al terminar.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { agregarEvento, crearReserva, guardarMailRecibido as guardarMailRecibidoReal } from "@/lib/reservas/guardar";
import { MOTIVOS_EMPAREJADO as ME } from "@/lib/reservas/emparejar/motivos";
import { BUCKET_ADJUNTOS, type MailEntrada } from "@/lib/reservas/tipos";
import { tomarBloqueoDatosDePrueba } from "./helpers/bloqueo-datos-de-prueba";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearRegistroDePrueba } from "./helpers/registro-de-prueba";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

/** Lo que crea este archivo: lo único que borra al final. */
const registro = crearRegistroDePrueba();
const guardarMailRecibido = registro.conMail(guardarMailRecibidoReal);

const cliente = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => cliente.actual }));
// M3-08: la lista llega por una server action, con el cliente del servidor (la misma sesión de prueba).
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => cliente.actual }));
// M3-08: estos viajes sintéticos son de marzo a junio de 2026; "hoy" queda antes, para que ninguno cuente como terminado.
vi.mock("@/lib/reservas/lista/terminadas", async (original) => ({
  ...(await original<typeof import("@/lib/reservas/lista/terminadas")>()),
  hoyEnArgentina: () => "2026-01-01",
}));
// Con `?prueba=1` (M2-06): la lista muestra las de prueba.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/reservas",
  useSearchParams: () => new URLSearchParams("prueba=1"),
}));

import { cargarReserva, cargarReservas, urlDelPdf } from "@/lib/reservas/consultas";
import { ListaReservasPantalla } from "@/components/reservas/lista-reservas-pantalla";
import { DetalleReservaPantalla } from "@/components/reservas/detalle-reserva-pantalla";

const CORRE = credencialesSupabaseDisponibles();
const ESPERA = { timeout: 20_000 };
const PREFIJO = "[test M2-05]";

function pdfSintetico(): Uint8Array {
  return new TextEncoder().encode(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%${randomUUID()}\n%%EOF\n`,
  );
}

function mailDePrueba(extra: Partial<MailEntrada> = {}): MailEntrada {
  return {
    origen: "imap",
    carpeta: "inbox",
    imapUidvalidity: 1700000000,
    imapUid: Math.floor(Math.random() * 1_000_000_000),
    messageId: `<${randomUUID()}@test.kilroy.dk>`,
    remitente: "aarhus@kilroy.dk",
    remitenteNombre: "KILROY Aarhus",
    destinatarios: ["sales@hitravel.com.ar"],
    asunto: `${PREFIJO} DK0000001 - booking request`,
    fechaMail: "2026-10-12T14:20:00.000Z",
    cuerpoTexto: "Booking request de prueba (sintético).",
    agencia: "Kilroy",
    dePrueba: true,
    ...extra,
  };
}

function sinSesion(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

(CORRE ? describe : describe.skip)("M2-05 — ver las reservas (Supabase real)", { timeout: 60_000 }, () => {
  let admin: SupabaseClient;
  let equipo: SupabaseClient;
  let borrarSesion: () => Promise<void>;
  let soltarBloqueo: () => void;
  const ids = { simple: "", tour: "", revision: "", sinProducto: "", dosMails: "" };
  let od019: { id: string; codigo: string };
  let chb31: { id: string };
  let componentesTour: Array<{ orden: number; tipo: string; componente_producto_id: string | null; descripcion_ruta: string | null }>;
  let rutaPdf = "";

  beforeAll(async () => {
    soltarBloqueo = await tomarBloqueoDatosDePrueba();
    const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);
    ({ cliente: equipo, borrar: borrarSesion } = await crearSesionDePrueba());

    od019 = (await admin.from("producto").select("id,codigo").eq("codigo", "OD019").single()).data!;
    chb31 = (await admin.from("producto").select("id").eq("codigo", "CHB31").single()).data!;
    componentesTour = (
      await admin
        .from("producto_componente")
        .select("orden,tipo,componente_producto_id,descripcion_ruta")
        .eq("producto_id", chb31.id)
        .order("orden")
    ).data!;

    // 1. Recibida, producto simple.
    const m1 = (await guardarMailRecibido(mailDePrueba(), admin)).mail;
    ids.simple = (
      await crearReserva(
        { agencia: "Kilroy", mailRecibidoId: m1.id, bookingId: "dk0000001", bookingIdOriginal: "DK0000001", productoId: od019.id,
          fechaInicio: "2026-03-12", fechaFin: "2026-03-15", pax: 2, estado: "recibida", dePrueba: true,
          pasajeros: [{ nombre: "Ana", apellido: "Prueba" }], vuelos: [
            { numero: "LA8020", aerolinea: "LATAM", origen: "EZE", destino: "IGR", fecha_salida: "2026-03-12", hora_salida: "12:10", fecha_llegada: "2026-03-12", hora_llegada: "14:35", confianza: 1 },
          ] },
        admin,
      )
    ).reserva.id;

    // 2. Tour con sus partes, en el orden del tour.
    const m2 = (await guardarMailRecibido(mailDePrueba({ asunto: `${PREFIJO} DK0000002 - CHB31` }), admin)).mail;
    ids.tour = (
      await crearReserva(
        { agencia: "Kilroy", mailRecibidoId: m2.id, bookingId: "dk0000002", bookingIdOriginal: "DK0000002", productoId: chb31.id,
          fechaInicio: "2026-04-02", fechaFin: "2026-04-09", pax: 1, estado: "recibida", dePrueba: true,
          componentes: componentesTour.map((c) => ({
            tipo: c.tipo === "paquete" ? "paquete" : "tramo_bus",
            productoId: c.tipo === "paquete" ? c.componente_producto_id : null,
            descripcionRuta: c.descripcion_ruta,
            esTarea: c.tipo !== "paquete",
          })) },
        admin,
      )
    ).reserva.id;

    // 3. Para revisión por falta de vuelo.
    const m3 = (await guardarMailRecibido(mailDePrueba({ asunto: `${PREFIJO} DK0000003 - OD019` }), admin)).mail;
    ids.revision = (
      await crearReserva(
        { agencia: "Kilroy", mailRecibidoId: m3.id, bookingId: "dk0000003", bookingIdOriginal: "DK0000003", productoId: od019.id,
          fechaInicio: "2026-05-01", fechaFin: "2026-05-04", pax: 2, estado: "para_revision", dePrueba: true,
          motivosRevision: [ME.faltaVuelo("in", { ciudad: "Puerto Iguazú", codigos: ["IGR"] }, "el traslado de OD019")] },
        admin,
      )
    ).reserva.id;

    // 4. Sin producto reconocido, llegó a spam.
    const m4 = (
      await guardarMailRecibido(
        mailDePrueba({ carpeta: "spam", remitente: "explore@mail.tourradar.com", agencia: "TourRadar", asunto: `${PREFIJO} New booking 9377598` }),
        admin,
      )
    ).mail;
    ids.sinProducto = (
      await crearReserva(
        { agencia: "TourRadar", mailRecibidoId: m4.id, bookingId: "9377598", productoTextoAgencia: "Iguazu Falls on a Shoestring (3N)",
          productoClaveAgencia: "iguazu falls on a shoestring (3n)", estado: "para_revision", dePrueba: true,
          motivosRevision: [ME.noSeguro("Iguazu Falls on a Shoestring (3N)")] },
        admin,
      )
    ).reserva.id;

    // 5. Dos mails: el primero con PDF, el segundo sumado después (M2-04).
    const m5 = (
      await guardarMailRecibido(
        mailDePrueba({ asunto: `${PREFIJO} DK0000005 - NEW BOOKING`, fechaMail: "2026-10-13T10:00:00.000Z",
          adjuntos: [{ nombre: "Booking DK0000005.pdf", tipo: "application/pdf", contenido: pdfSintetico() }] }),
        admin,
      )
    ).mail;
    rutaPdf = m5.adjuntos.find((a) => a.ruta)!.ruta!;
    ids.dosMails = (
      await crearReserva(
        { agencia: "Kilroy", mailRecibidoId: m5.id, bookingId: "dk0000005", bookingIdOriginal: "DK0000005", productoId: od019.id,
          fechaInicio: "2026-06-01", fechaFin: "2026-06-04", pax: 2, estado: "recibida", dePrueba: true },
        admin,
      )
    ).reserva.id;
    const m6 = (
      await guardarMailRecibido(
        mailDePrueba({ asunto: `${PREFIJO} NEW FLIGHT: DK0000005`, fechaMail: "2026-10-14T09:00:00.000Z" }),
        admin,
      )
    ).mail;
    await agregarEvento(ids.dosMails, { tipo: "mail_agregado", mailRecibidoId: m6.id }, admin);
  }, 120_000);

  afterAll(async () => {
    try {
      await registro.limpiar(admin);
    } finally {
      await borrarSesion?.();
      soltarBloqueo?.();
    }
  }, 60_000);

  describe("con sesión del equipo", () => {
    it("la lista trae las 5, de prueba, con sus datos", async () => {
      const filas = (await cargarReservas(equipo)).filter((f) => Object.values(ids).includes(f.id));
      expect(filas).toHaveLength(5);
      expect(filas.every((f) => f.dePrueba)).toBe(true);
      const simple = filas.find((f) => f.id === ids.simple)!;
      expect(simple).toMatchObject({
        estado: "recibida",
        agencia: "Kilroy",
        numero: "DK0000001",
        producto: { id: od019.id, codigo: "OD019" },
        fechaInicio: "2026-03-12",
        fechaFin: "2026-03-15",
        pax: 2,
        llego: expect.stringMatching(/^2026-10-12T14:20/),
      });
      expect(filas.find((f) => f.id === ids.sinProducto)!.producto).toBeNull();
    });

    it("la reserva de un tour trae sus partes en el orden del tour", async () => {
      const r = (await cargarReserva(equipo, ids.tour))!;
      expect(r.partes.map((p) => p.orden)).toEqual(componentesTour.map((_, i) => i + 1));
      componentesTour.forEach((c, i) => {
        if (c.tipo === "paquete") expect(r.partes[i].producto?.id).toBe(c.componente_producto_id);
        else expect(r.partes[i]).toMatchObject({ tipo: "tramo_bus", producto: null, esTarea: true });
      });
    });

    it("owner 2026-10-16: el tour CHB31 sin vuelos trae el aviso calculado con el catálogo, en la lista y en el detalle", async () => {
      const aviso = "Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030";
      const r = (await cargarReserva(equipo, ids.tour))!;
      expect(r).toMatchObject({ estado: "recibida", motivos: [] });
      expect(r.avisosVuelo).toContain(aviso);
      const filas = await cargarReservas(equipo);
      expect(filas.find((f) => f.id === ids.tour)!.avisosVuelo).toEqual(r.avisosVuelo);
      // La de Iguazú con su vuelo de llegada no lleva aviso de vuelo.
      expect(filas.find((f) => f.id === ids.simple)!.avisosVuelo).toEqual([]);
    });

    it("owner 2026-10-16: la lista trae los pasajeros (para la columna 'Juan Perez x 3' y la búsqueda)", async () => {
      const filas = await cargarReservas(equipo);
      expect(filas.find((f) => f.id === ids.simple)!.pasajeros).toEqual(["Ana Prueba"]);
      expect(filas.find((f) => f.id === ids.tour)!.pasajeros).toEqual([]);
    });

    it("owner 2026-10-16: una cancelación se marca por su motivo o por su historial, aunque no haya cambiado de estado", async () => {
      expect((await cargarReserva(equipo, ids.simple))!.cancelacion).toBe(false);
      // La agencia cancela una reserva que ya no estaba en un estado tocable: queda solo en el historial.
      await agregarEvento(ids.simple, { tipo: "mail_agregado", detalle: { cancelacion: true } }, admin);
      expect((await cargarReserva(equipo, ids.simple))!.cancelacion).toBe(true);
      const filas = await cargarReservas(equipo);
      expect(filas.find((f) => f.id === ids.simple)!.cancelacion).toBe(true);
      expect(filas.find((f) => f.id === ids.tour)!.cancelacion).toBe(false);
    });

    it("la de 2 mails los trae en orden de llegada, con el PDF del primero", async () => {
      const r = (await cargarReserva(equipo, ids.dosMails))!;
      expect(r.mails.map((m) => m.asunto)).toEqual([`${PREFIJO} DK0000005 - NEW BOOKING`, `${PREFIJO} NEW FLIGHT: DK0000005`]);
      expect(r.mails[0].pdfs).toEqual([{ nombre: "Booking DK0000005.pdf", ruta: rutaPdf }]);
    });

    it("datos, vuelos y producto tal como se guardaron", async () => {
      const r = (await cargarReserva(equipo, ids.simple))!;
      expect(r.pasajeros).toEqual(["Ana Prueba"]);
      expect(r.vuelos[0]).toMatchObject({ numero: "LA8020", horaLlegada: "14:35", fechaLlegada: "2026-03-12" });
      const sin = (await cargarReserva(equipo, ids.sinProducto))!;
      expect(sin.productoTextoAgencia).toBe("Iguazu Falls on a Shoestring (3N)");
      expect(sin.mails[0].spam).toBe(true);
    });

    it("una reserva que no existe vuelve vacía, sin error", async () => {
      expect(await cargarReserva(equipo, randomUUID())).toBeNull();
    });

    it("el PDF se abre con la sesión y el enlace caduca a los 5 minutos", async () => {
      const url = await urlDelPdf(equipo, rutaPdf);
      const respuesta = await fetch(url);
      expect(respuesta.status).toBe(200);
      expect(new TextDecoder().decode(new Uint8Array(await respuesta.arrayBuffer())).startsWith("%PDF")).toBe(true);
      const token = new URL(url).searchParams.get("token")!;
      const datos = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf-8"));
      expect(datos.exp - datos.iat).toBe(300);
    });

    it("la lista real muestra las de prueba con su chip y el total separado", async () => {
      cliente.actual = equipo;
      render(<ListaReservasPantalla />);
      const tabla = await screen.findByRole("table", {}, ESPERA);
      for (const id of Object.values(ids)) {
        const fila = tabla.querySelector(`tr[data-id="${id}"]`) as HTMLElement;
        expect(fila, id).not.toBeNull();
        expect(within(fila).getByText("De prueba")).toBeInTheDocument();
      }
      expect(screen.getByText(/reservas · \d+ de prueba/)).toBeInTheDocument();
      const revision = tabla.querySelector(`tr[data-id="${ids.revision}"]`) as HTMLElement;
      expect(within(revision).getByText("para revisión")).toBeInTheDocument();
    });

    it("el detalle real de la de revisión: aviso de prueba, motivo, producto con enlace y el mail", async () => {
      cliente.actual = equipo;
      render(<DetalleReservaPantalla id={ids.revision} />);
      expect(await screen.findByText("Faltan los datos de vuelo, y el producto incluye traslados.", {}, ESPERA)).toBeInTheDocument();
      expect(screen.getByText("Vuelo de llegada a Puerto Iguazú (IGR), para el traslado de OD019.")).toBeInTheDocument();
      expect(screen.getByText(/^Reserva de prueba\./)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "OD019" })).toHaveAttribute("href", `/catalogo/${od019.id}`);
      expect(screen.getByTestId("cuerpo-mail").textContent).toBe("Booking request de prueba (sintético).");
      expect(screen.getByText("El mail no trae datos de vuelo.")).toBeInTheDocument();
    });
  });

  describe("sin sesión (#15)", () => {
    it("las reservas, sus partes y los mails devuelven 0 filas", async () => {
      const anon = sinSesion();
      expect(await cargarReservas(anon)).toEqual([]);
      expect(await cargarReserva(anon, ids.simple)).toBeNull();
      const mails = await anon.from("mail_recibido").select("id").limit(5);
      expect(mails.data ?? []).toHaveLength(0);
      const partes = await anon.from("reserva_componente").select("id").eq("reserva_id", ids.tour);
      expect(partes.data ?? []).toHaveLength(0);
    });

    it("el PDF no se firma ni se descarga", async () => {
      const anon = sinSesion();
      await expect(urlDelPdf(anon, rutaPdf)).rejects.toThrow();
      const descarga = await anon.storage.from(BUCKET_ADJUNTOS).download(rutaPdf);
      expect(descarga.data).toBeNull();
      expect(descarga.error).not.toBeNull();
    });
  });
});
