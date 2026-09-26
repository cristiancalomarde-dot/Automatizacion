// @vitest-environment node
//
// Spec M1-02 §3 #8, #9, #10 — Anexo técnico: "test primero": este archivo se
// escribe y se corre ANTES de la migración `0002_catalogo.sql`, para verlo
// fallar por la razón correcta (las tablas todavía no existen). V2 y V3 de
// la spec piden que corra contra el proyecto Supabase real, no un mock — por
// eso usa `@supabase/supabase-js` directo con las credenciales de
// `.env.local` en vez de mockear el cliente.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const CORRE_CONTRA_SUPABASE_REAL = credencialesSupabaseDisponibles();

// Prefijo para poder identificar (y limpiar) sin ambigüedad los datos que
// crea este archivo dentro del proyecto real compartido por el equipo.
const PREFIJO = `TEST-M1-02-${randomUUID().slice(0, 8)}`;

const TABLAS_DEL_CATALOGO = [
  "proveedor",
  "producto",
  "producto_servicio",
  "codigo_externo",
  "producto_componente",
  "importacion",
] as const;

(CORRE_CONTRA_SUPABASE_REAL ? describe : describe.skip)(
  "esquema del catálogo — integración contra Supabase real (spec M1-02 §3 #8, #9, #10)",
  () => {
    let admin: SupabaseClient;
    let anonimo: SupabaseClient;

    // ids creados con la service role en cada test, para borrar al terminar
    // (la app nunca borra estas tablas — acá se usa la service role, que
    // saltea RLS, solo para no ensuciar la base real compartida entre corridas).
    const aBorrar = {
      productoComponente: [] as string[],
      productoServicio: [] as string[],
      codigoExterno: [] as string[],
      producto: [] as string[],
      proveedor: [] as string[],
      importacion: [] as string[],
    };

    beforeAll(() => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    });

    afterEach(async () => {
      // Orden por FKs: los hijos antes que los padres.
      if (aBorrar.productoComponente.length) {
        await admin.from("producto_componente").delete().in("id", aBorrar.productoComponente);
        aBorrar.productoComponente = [];
      }
      if (aBorrar.productoServicio.length) {
        await admin.from("producto_servicio").delete().in("id", aBorrar.productoServicio);
        aBorrar.productoServicio = [];
      }
      if (aBorrar.codigoExterno.length) {
        await admin.from("codigo_externo").delete().in("id", aBorrar.codigoExterno);
        aBorrar.codigoExterno = [];
      }
      if (aBorrar.producto.length) {
        await admin.from("producto").delete().in("id", aBorrar.producto);
        aBorrar.producto = [];
      }
      if (aBorrar.proveedor.length) {
        await admin.from("proveedor").delete().in("id", aBorrar.proveedor);
        aBorrar.proveedor = [];
      }
      if (aBorrar.importacion.length) {
        await admin.from("importacion").delete().in("id", aBorrar.importacion);
        aBorrar.importacion = [];
      }
    });

    it("#8: producto → producto_servicio → proveedor se leen en una sola consulta", async () => {
      const { data: serviceProvider, error: errorSP } = await admin
        .from("proveedor")
        .insert({
          nombre: `${PREFIJO} Hotel El Pueblito`,
          nombre_normalizado: `${PREFIJO.toLowerCase()} hotel el pueblito`,
          canal: "mail",
          mails: ["reservas@elpueblito.example.com"],
        })
        .select()
        .single();
      expect(errorSP).toBeNull();
      aBorrar.proveedor.push(serviceProvider!.id);

      const { data: bookingSupplier, error: errorBS } = await admin
        .from("proveedor")
        .insert({
          nombre: `${PREFIJO} Cuenca del Plata`,
          nombre_normalizado: `${PREFIJO.toLowerCase()} cuenca del plata`,
          canal: "whatsapp",
          mails: [],
        })
        .select()
        .single();
      expect(errorBS).toBeNull();
      aBorrar.proveedor.push(bookingSupplier!.id);

      const { data: producto, error: errorProducto } = await admin
        .from("producto")
        .insert({
          codigo: `${PREFIJO}-OD010A`,
          nombre: "Iguazu Falls on a Shoestring",
          ciudades: ["Puerto Iguazú"],
          destino: "IGUAZU",
        })
        .select()
        .single();
      expect(errorProducto).toBeNull();
      aBorrar.producto.push(producto!.id);

      const { data: servicio, error: errorServicio } = await admin
        .from("producto_servicio")
        .insert({
          producto_id: producto!.id,
          tipo_servicio: "alojamiento",
          service_provider_id: serviceProvider!.id,
          booking_supplier_id: bookingSupplier!.id,
          prioridad: 1,
        })
        .select()
        .single();
      expect(errorServicio).toBeNull();
      aBorrar.productoServicio.push(servicio!.id);

      // La cadena completa producto → servicios → proveedores, en una sola consulta.
      const { data: cadena, error: errorCadena } = await admin
        .from("producto")
        .select(
          `nombre,
           producto_servicio (
             tipo_servicio,
             prioridad,
             service_provider:service_provider_id ( nombre, canal ),
             booking_supplier:booking_supplier_id ( nombre, canal )
           )`,
        )
        .eq("id", producto!.id)
        .single();

      expect(errorCadena).toBeNull();
      expect(cadena?.nombre).toBe("Iguazu Falls on a Shoestring");
      expect(cadena?.producto_servicio).toHaveLength(1);
      const [servicioLeido] = cadena!.producto_servicio as unknown as Array<{
        tipo_servicio: string;
        prioridad: number;
        service_provider: { nombre: string; canal: string };
        booking_supplier: { nombre: string; canal: string };
      }>;
      expect(servicioLeido.tipo_servicio).toBe("alojamiento");
      expect(servicioLeido.service_provider.nombre).toBe(`${PREFIJO} Hotel El Pueblito`);
      expect(servicioLeido.service_provider.canal).toBe("mail");
      expect(servicioLeido.booking_supplier.nombre).toBe(`${PREFIJO} Cuenca del Plata`);
      expect(servicioLeido.booking_supplier.canal).toBe("whatsapp");
    });

    it("#3 (soporte de #8): dos producto_servicio del mismo producto, prioridad 1 y 2, se leen ordenados", async () => {
      const { data: proveedorA } = await admin
        .from("proveedor")
        .insert({
          nombre: `${PREFIJO} Beer Hostel`,
          nombre_normalizado: `${PREFIJO.toLowerCase()} beer hostel`,
        })
        .select()
        .single();
      aBorrar.proveedor.push(proveedorA!.id);

      const { data: proveedorB } = await admin
        .from("proveedor")
        .insert({
          nombre: `${PREFIJO} Hostel Inn`,
          nombre_normalizado: `${PREFIJO.toLowerCase()} hostel inn`,
        })
        .select()
        .single();
      aBorrar.proveedor.push(proveedorB!.id);

      const { data: producto } = await admin
        .from("producto")
        .insert({ codigo: `${PREFIJO}-OD010B`, nombre: "Producto con alternativas" })
        .select()
        .single();
      aBorrar.producto.push(producto!.id);

      const { data: servicio2 } = await admin
        .from("producto_servicio")
        .insert({
          producto_id: producto!.id,
          tipo_servicio: "alojamiento",
          service_provider_id: proveedorB!.id,
          prioridad: 2,
        })
        .select()
        .single();
      aBorrar.productoServicio.push(servicio2!.id);

      const { data: servicio1 } = await admin
        .from("producto_servicio")
        .insert({
          producto_id: producto!.id,
          tipo_servicio: "alojamiento",
          service_provider_id: proveedorA!.id,
          prioridad: 1,
        })
        .select()
        .single();
      aBorrar.productoServicio.push(servicio1!.id);

      const { data: leidos, error } = await admin
        .from("producto_servicio")
        .select("prioridad, service_provider_id")
        .eq("producto_id", producto!.id)
        .order("prioridad", { ascending: true });

      expect(error).toBeNull();
      expect(leidos).toHaveLength(2);
      expect(leidos![0].prioridad).toBe(1);
      expect(leidos![0].service_provider_id).toBe(proveedorA!.id);
      expect(leidos![1].prioridad).toBe(2);
      expect(leidos![1].service_provider_id).toBe(proveedorB!.id);
    });

    it("#9: un tour compuesto encadena dos paquetes + un tramo de bus, leído ordenado por `orden`", async () => {
      const { data: paqueteUno } = await admin
        .from("producto")
        .insert({ codigo: `${PREFIJO}-SPA`, nombre: "San Pedro de Atacama Explorer" })
        .select()
        .single();
      aBorrar.producto.push(paqueteUno!.id);

      const { data: paqueteDos } = await admin
        .from("producto")
        .insert({ codigo: `${PREFIJO}-BOL`, nombre: "Overland Bolivia" })
        .select()
        .single();
      aBorrar.producto.push(paqueteDos!.id);

      const { data: tour } = await admin
        .from("producto")
        .insert({ codigo: `${PREFIJO}-CHB31`, nombre: "Overland San Pedro–Uyuni–La Paz" })
        .select()
        .single();
      aBorrar.producto.push(tour!.id);

      const { data: compTramo } = await admin
        .from("producto_componente")
        .insert({
          producto_id: tour!.id,
          orden: 2,
          tipo: "tramo_bus",
          descripcion_ruta: "Uyuni → La Paz (tramo público)",
          transfer_in: false,
          transfer_out: false,
        })
        .select()
        .single();
      aBorrar.productoComponente.push(compTramo!.id);

      const { data: compUno } = await admin
        .from("producto_componente")
        .insert({
          producto_id: tour!.id,
          orden: 1,
          tipo: "paquete",
          componente_producto_id: paqueteUno!.id,
          transfer_in: true,
          transfer_out: false,
        })
        .select()
        .single();
      aBorrar.productoComponente.push(compUno!.id);

      const { data: compDos } = await admin
        .from("producto_componente")
        .insert({
          producto_id: tour!.id,
          orden: 3,
          tipo: "paquete",
          componente_producto_id: paqueteDos!.id,
          transfer_in: false,
          transfer_out: true,
        })
        .select()
        .single();
      aBorrar.productoComponente.push(compDos!.id);

      const { data: componentes, error } = await admin
        .from("producto_componente")
        .select(
          `orden, tipo, descripcion_ruta, transfer_in, transfer_out,
           componente:componente_producto_id ( nombre )`,
        )
        .eq("producto_id", tour!.id)
        .order("orden", { ascending: true });

      expect(error).toBeNull();
      expect(componentes).toHaveLength(3);

      const [uno, dos, tres] = componentes as unknown as Array<{
        orden: number;
        tipo: string;
        descripcion_ruta: string | null;
        transfer_in: boolean;
        transfer_out: boolean;
        componente: { nombre: string } | null;
      }>;

      expect(uno.tipo).toBe("paquete");
      expect(uno.componente?.nombre).toBe("San Pedro de Atacama Explorer");
      expect(uno.descripcion_ruta).toBeNull();
      expect(uno.transfer_in).toBe(true);

      expect(dos.tipo).toBe("tramo_bus");
      expect(dos.componente).toBeNull();
      expect(dos.descripcion_ruta).toBe("Uyuni → La Paz (tramo público)");

      expect(tres.tipo).toBe("paquete");
      expect(tres.componente?.nombre).toBe("Overland Bolivia");
      expect(tres.transfer_out).toBe(true);
    });

    it(
      "#10 (qué NO debe pasar): sin sesión, `anon` no puede leer ni insertar en ninguna de las 6 tablas",
      async () => {
      // Sembramos una fila real por tabla con la service role, así una lectura
      // vacía del lado de `anon` prueba que RLS la esconde (no que la tabla
      // está simplemente vacía).
      const { data: proveedorSemilla } = await admin
        .from("proveedor")
        .insert({ nombre: `${PREFIJO} RLS`, nombre_normalizado: `${PREFIJO.toLowerCase()} rls` })
        .select()
        .single();
      aBorrar.proveedor.push(proveedorSemilla!.id);

      const { data: productoSemilla } = await admin
        .from("producto")
        .insert({ codigo: `${PREFIJO}-RLS`, nombre: "Producto RLS" })
        .select()
        .single();
      aBorrar.producto.push(productoSemilla!.id);

      const { data: servicioSemilla } = await admin
        .from("producto_servicio")
        .insert({ producto_id: productoSemilla!.id, tipo_servicio: "otro" })
        .select()
        .single();
      aBorrar.productoServicio.push(servicioSemilla!.id);

      const { data: codigoSemilla } = await admin
        .from("codigo_externo")
        .insert({ producto_id: productoSemilla!.id, agencia: `${PREFIJO}-agencia`, codigo: "X1" })
        .select()
        .single();
      aBorrar.codigoExterno.push(codigoSemilla!.id);

      const { data: componenteSemilla } = await admin
        .from("producto_componente")
        .insert({
          producto_id: productoSemilla!.id,
          orden: 1,
          tipo: "tramo_bus",
          descripcion_ruta: "Ruta RLS",
        })
        .select()
        .single();
      aBorrar.productoComponente.push(componenteSemilla!.id);

      const { data: importacionSemilla } = await admin
        .from("importacion")
        .insert({ archivo: `${PREFIJO}.xlsx`, tipo_corrida: "rls-test" })
        .select()
        .single();
      aBorrar.importacion.push(importacionSemilla!.id);

      // Lecturas: rechazadas por RLS (error o 0 filas — nunca datos).
      for (const tabla of TABLAS_DEL_CATALOGO) {
        const { data, error } = await anonimo.from(tabla).select("*").limit(5);
        const rechazada = error !== null || (data?.length ?? 0) === 0;
        expect(rechazada, `select en "${tabla}" no debería devolver datos sin sesión`).toBe(true);
      }

      // Escrituras: rechazadas por RLS (siempre con error, nunca éxito).
      const payloadPorTabla: Record<(typeof TABLAS_DEL_CATALOGO)[number], Record<string, unknown>> = {
        proveedor: { nombre: `${PREFIJO} anon`, nombre_normalizado: `${PREFIJO.toLowerCase()} anon` },
        producto: { codigo: `${PREFIJO}-ANON`, nombre: "Producto anon" },
        producto_servicio: { producto_id: productoSemilla!.id, tipo_servicio: "otro" },
        codigo_externo: { producto_id: productoSemilla!.id, agencia: "anon", codigo: "ANON" },
        producto_componente: {
          producto_id: productoSemilla!.id,
          orden: 2,
          tipo: "tramo_bus",
          descripcion_ruta: "Ruta anon",
        },
        importacion: { archivo: "anon.xlsx", tipo_corrida: "anon" },
      };

      for (const tabla of TABLAS_DEL_CATALOGO) {
        const { error } = await anonimo.from(tabla).insert(payloadPorTabla[tabla]);
        expect(error, `insert en "${tabla}" sin sesión debería fallar`).not.toBeNull();
      }
      },
      20000, // 12 idas y vueltas reales de red (6 tablas × select+insert) superan el timeout por defecto de 5s.
    );

    it("#5 (constraint de `producto_componente`): `paquete` sin componente o `tramo_bus` con componente fallan", async () => {
      const { data: producto } = await admin
        .from("producto")
        .insert({ codigo: `${PREFIJO}-CHECK`, nombre: "Producto para el check" })
        .select()
        .single();
      aBorrar.producto.push(producto!.id);

      const { error: errorPaqueteSinComponente } = await admin.from("producto_componente").insert({
        producto_id: producto!.id,
        orden: 1,
        tipo: "paquete",
        componente_producto_id: null,
      });
      expect(errorPaqueteSinComponente).not.toBeNull();

      const { error: errorTramoConComponente } = await admin.from("producto_componente").insert({
        producto_id: producto!.id,
        orden: 1,
        tipo: "tramo_bus",
        componente_producto_id: producto!.id,
        descripcion_ruta: "Ruta inválida",
      });
      expect(errorTramoConComponente).not.toBeNull();
    });

    it(
      "V3 — recorrido completo de punta a punta: producto → servicios → proveedores → tour compuesto → lectura completa (spec M1-02, Anexo técnico)",
      async () => {
        // 1) Proveedores.
        const { data: hotel, error: e1 } = await admin
          .from("proveedor")
          .insert({
            nombre: `${PREFIJO} V3 Hotel Iguazú`,
            nombre_normalizado: `${PREFIJO.toLowerCase()} v3 hotel iguazu`,
            canal: "mail",
            mails: ["reservas@hoteliguazu.example.com"],
          })
          .select()
          .single();
        expect(e1).toBeNull();
        aBorrar.proveedor.push(hotel!.id);

        const { data: transferista, error: e2 } = await admin
          .from("proveedor")
          .insert({
            nombre: `${PREFIJO} V3 Transfer Bolivia`,
            nombre_normalizado: `${PREFIJO.toLowerCase()} v3 transfer bolivia`,
            canal: "whatsapp",
            mails: [],
          })
          .select()
          .single();
        expect(e2).toBeNull();
        aBorrar.proveedor.push(transferista!.id);

        // 2) Dos paquetes simples, cada uno con su servicio y proveedor.
        const { data: paqueteIguazu, error: e3 } = await admin
          .from("producto")
          .insert({
            codigo: `${PREFIJO}-V3-OD010A`,
            nombre: "Iguazu Falls on a Shoestring (V3)",
            ciudades: ["Puerto Iguazú"],
            destino: "IGUAZU",
          })
          .select()
          .single();
        expect(e3).toBeNull();
        aBorrar.producto.push(paqueteIguazu!.id);

        const { data: servicioIguazu, error: e4 } = await admin
          .from("producto_servicio")
          .insert({
            producto_id: paqueteIguazu!.id,
            tipo_servicio: "alojamiento",
            service_provider_id: hotel!.id,
            prioridad: 1,
          })
          .select()
          .single();
        expect(e4).toBeNull();
        aBorrar.productoServicio.push(servicioIguazu!.id);

        const { data: paqueteBolivia, error: e5 } = await admin
          .from("producto")
          .insert({ codigo: `${PREFIJO}-V3-BOL`, nombre: "Overland Bolivia (V3)" })
          .select()
          .single();
        expect(e5).toBeNull();
        aBorrar.producto.push(paqueteBolivia!.id);

        const { data: servicioBolivia, error: e6 } = await admin
          .from("producto_servicio")
          .insert({
            producto_id: paqueteBolivia!.id,
            tipo_servicio: "bus",
            service_provider_id: transferista!.id,
            prioridad: 1,
          })
          .select()
          .single();
        expect(e6).toBeNull();
        aBorrar.productoServicio.push(servicioBolivia!.id);

        // 3) El tour compuesto que encadena los dos paquetes + un tramo de bus externo.
        const { data: tour, error: e7 } = await admin
          .from("producto")
          .insert({ codigo: `${PREFIJO}-V3-CHB31`, nombre: "Overland San Pedro–Uyuni–La Paz (V3)" })
          .select()
          .single();
        expect(e7).toBeNull();
        aBorrar.producto.push(tour!.id);

        const { data: compUno, error: e8 } = await admin
          .from("producto_componente")
          .insert({
            producto_id: tour!.id,
            orden: 1,
            tipo: "paquete",
            componente_producto_id: paqueteIguazu!.id,
            transfer_in: true,
          })
          .select()
          .single();
        expect(e8).toBeNull();
        aBorrar.productoComponente.push(compUno!.id);

        const { data: compTramo, error: e9 } = await admin
          .from("producto_componente")
          .insert({
            producto_id: tour!.id,
            orden: 2,
            tipo: "tramo_bus",
            descripcion_ruta: "Puerto Iguazú → frontera (tramo público, V3)",
          })
          .select()
          .single();
        expect(e9).toBeNull();
        aBorrar.productoComponente.push(compTramo!.id);

        const { data: compDos, error: e10 } = await admin
          .from("producto_componente")
          .insert({
            producto_id: tour!.id,
            orden: 3,
            tipo: "paquete",
            componente_producto_id: paqueteBolivia!.id,
            transfer_out: true,
          })
          .select()
          .single();
        expect(e10).toBeNull();
        aBorrar.productoComponente.push(compDos!.id);

        // 4) Códigos externos del tour (partner Kilroy, por ejemplo).
        const { data: codigoExt, error: e11 } = await admin
          .from("codigo_externo")
          .insert({ producto_id: tour!.id, agencia: "Kilroy", codigo: `${PREFIJO}-KLR-CHB31` })
          .select()
          .single();
        expect(e11).toBeNull();
        aBorrar.codigoExterno.push(codigoExt!.id);

        // 5) Registro de la corrida en `importacion`.
        const { data: corrida, error: e12 } = await admin
          .from("importacion")
          .insert({
            archivo: `${PREFIJO}-v3.xlsx`,
            tipo_corrida: "recorrido-completo-v3",
            filas_cargadas: 3,
            filas_para_revisar: 0,
            detalle: { tour: tour!.codigo },
          })
          .select()
          .single();
        expect(e12).toBeNull();
        aBorrar.importacion.push(corrida!.id);

        // 6) Lectura completa de punta a punta: el tour, sus componentes en
        // orden, y cada paquete componente con su propio servicio y proveedor.
        const { data: tourLeido, error: eLectura } = await admin
          .from("producto")
          .select(
            `nombre,
             producto_componente:producto_componente!producto_componente_producto_id_fkey (
               orden, tipo, descripcion_ruta, transfer_in, transfer_out,
               componente:componente_producto_id (
                 nombre,
                 producto_servicio ( tipo_servicio, service_provider:service_provider_id ( nombre, canal ) )
               )
             )`,
          )
          .eq("id", tour!.id)
          .order("orden", { referencedTable: "producto_componente", ascending: true })
          .single();

        expect(eLectura).toBeNull();
        expect(tourLeido?.nombre).toBe("Overland San Pedro–Uyuni–La Paz (V3)");

        const componentes = tourLeido!.producto_componente as unknown as Array<{
          orden: number;
          tipo: string;
          descripcion_ruta: string | null;
          transfer_in: boolean;
          transfer_out: boolean;
          componente: {
            nombre: string;
            producto_servicio: Array<{ tipo_servicio: string; service_provider: { nombre: string; canal: string } }>;
          } | null;
        }>;

        expect(componentes).toHaveLength(3);
        const [uno, dos, tres] = componentes;

        expect(uno.tipo).toBe("paquete");
        expect(uno.transfer_in).toBe(true);
        expect(uno.componente?.nombre).toBe("Iguazu Falls on a Shoestring (V3)");
        expect(uno.componente?.producto_servicio[0]?.tipo_servicio).toBe("alojamiento");
        expect(uno.componente?.producto_servicio[0]?.service_provider.nombre).toBe(`${PREFIJO} V3 Hotel Iguazú`);

        expect(dos.tipo).toBe("tramo_bus");
        expect(dos.componente).toBeNull();
        expect(dos.descripcion_ruta).toContain("frontera");

        expect(tres.tipo).toBe("paquete");
        expect(tres.transfer_out).toBe(true);
        expect(tres.componente?.nombre).toBe("Overland Bolivia (V3)");
        expect(tres.componente?.producto_servicio[0]?.tipo_servicio).toBe("bus");
        expect(tres.componente?.producto_servicio[0]?.service_provider.nombre).toBe(
          `${PREFIJO} V3 Transfer Bolivia`,
        );

        // El código externo del tour resuelve al mismo producto.
        const { data: porCodigoExterno, error: eCodigo } = await admin
          .from("codigo_externo")
          .select("producto_id")
          .eq("agencia", "Kilroy")
          .eq("codigo", `${PREFIJO}-KLR-CHB31`)
          .single();
        expect(eCodigo).toBeNull();
        expect(porCodigoExterno?.producto_id).toBe(tour!.id);
      },
      20000,
    );
  },
);

describe("esquema del catálogo — credenciales de Supabase", () => {
  it("documenta si este archivo corrió contra el proyecto real o se salteó", () => {
    if (!CORRE_CONTRA_SUPABASE_REAL) {
      // No es un fallo del código: es la señal correcta de "faltan credenciales
      // reales" (spec M1-02, Anexo técnico — V2/V3 exigen el proyecto real).
      console.warn(
        "[M1-02] Tests de integración salteados: faltan NEXT_PUBLIC_SUPABASE_URL / " +
          "NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en .env.local.",
      );
    }
    expect(true).toBe(true);
  });
});
