import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { NIVEL_TODOS } from "@/lib/catalogo/reglas";
import { leerCsv } from "./csv";

/**
 * En qué noches del paquete va cada servicio (spec M1-07 §3 #8), desde
 * `data/noches-servicio.csv` (paquete, servicio, noche_desde, noches, lugar,
 * nota), a la tabla `producto_servicio_noches` (migración 0008).
 *
 * `servicio` es `alojamiento` (todos los alojamientos del paquete, de todos
 * los niveles: el pasajero elige uno) o el nombre del servicio tal como lo
 * escribe el Excel ("W Trek Standard"). Un servicio puede ir en más de un
 * tramo de noches: el alojamiento de CH10 va en la noche 1 y en la 6, y se
 * pide dos veces (fechas distintas) con las mismas opciones de hotel.
 *
 * Controles (si no cierran, se corta antes de escribir): el servicio existe
 * en el paquete; para cada nivel de alojamiento, sus noches más las de los
 * otros servicios no se pisan y suman las noches del paquete.
 *
 * M1-08: un alojamiento también se puede nombrar por su hotel, cuando la
 * línea del Excel junta dos ("2 Nights Nacional inn Foz + 1 Night El
 * Pueblito" ya se carga como dos servicios del mismo nivel): OD010D va noches
 * 1-2 en Foz y 3 en Puerto Iguazú. Los hoteles de un mismo nivel suman juntos.
 */

export interface FilaNochesServicio {
  paquete: string;
  servicio: string;
  nocheDesde: number;
  noches: number;
  lugar?: string;
  nota?: string;
}

export interface ServicioDelPaquete {
  orden: number;
  prioridad: number;
  tipo: string;
  serviceProviderNombre: string | null;
  /** Nivel de alojamiento (M1-08): los hoteles de un mismo nivel suman juntos (OD010D: Foz + Puerto Iguazú). */
  nivel?: string | null;
}

export interface NochesDeServicio {
  orden: number;
  nocheDesde: number;
  noches: number;
  lugar: string | null;
  nota: string | null;
}

function entero(valor: string | undefined, columna: string, fila: number): number {
  const n = Number((valor ?? "").trim());
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`noches-servicio.csv, fila ${fila}: ${columna} tiene que ser un número entero desde 1 (dice "${valor ?? ""}").`);
  }
  return n;
}

export function parsearNochesServicio(texto: string): FilaNochesServicio[] {
  return leerCsv(texto).map((r, i) => {
    const fila = i + 2;
    const paquete = (r.paquete ?? "").trim().toUpperCase();
    const servicio = (r.servicio ?? "").trim();
    if (!paquete || !servicio) throw new Error(`noches-servicio.csv, fila ${fila}: faltan paquete o servicio.`);
    const lugar = (r.lugar ?? "").trim();
    const nota = (r.nota ?? "").trim();
    return {
      paquete,
      servicio,
      nocheDesde: entero(r.noche_desde, "noche_desde", fila),
      noches: entero(r.noches, "noches", fila),
      ...(lugar ? { lugar } : {}),
      ...(nota ? { nota } : {}),
    };
  });
}

function nochesTexto(n: number): string {
  return `${n} ${n === 1 ? "noche" : "noches"}`;
}

export function planNochesServicio(
  paquete: string,
  filas: FilaNochesServicio[],
  servicios: ServicioDelPaquete[],
  nochesPaquete: number | null,
): NochesDeServicio[] {
  const propias = filas.filter((f) => f.paquete === paquete);
  const plan: NochesDeServicio[] = [];
  // M3-23: un alojamiento de "Todos los niveles" (Purmamarca en OD027) suma con cada nivel, como
  // el W Trek de CH10: no es un nivel propio.
  const deUnNivel = (s: ServicioDelPaquete) => s.tipo === "alojamiento" && s.nivel !== NIVEL_TODOS;
  const alojamientos = [...new Set(servicios.filter(deUnNivel).map((s) => s.orden))];
  // El nivel de cada alojamiento (sin nivel cargado, cada servicio es su propio grupo, como en CH10).
  const grupoDe = new Map<number, string>();
  for (const s of servicios) {
    if (deUnNivel(s) && !grupoDe.has(s.orden)) grupoDe.set(s.orden, s.nivel ?? `orden-${s.orden}`);
  }
  const otrosConNoches = new Set<number>();
  for (const f of propias) {
    let ordenes: number[];
    if (normalizarNombre(f.servicio) === "alojamiento") {
      ordenes = alojamientos;
    } else {
      const clave = normalizarNombre(f.servicio);
      ordenes = [
        ...new Set(
          servicios
            .filter((s) => s.prioridad === 1 && s.serviceProviderNombre && normalizarNombre(s.serviceProviderNombre) === clave)
            .map((s) => s.orden),
        ),
      ];
      for (const o of ordenes) if (!grupoDe.has(o)) otrosConNoches.add(o);
    }
    if (ordenes.length === 0) {
      throw new Error(`noches-servicio.csv: ${paquete} no tiene el servicio "${f.servicio}" (¿está cargado el paquete?).`);
    }
    if (nochesPaquete !== null && f.nocheDesde + f.noches - 1 > nochesPaquete) {
      throw new Error(`noches-servicio.csv: en ${paquete}, "${f.servicio}" termina la noche ${f.nocheDesde + f.noches - 1} y el paquete tiene ${nochesTexto(nochesPaquete)}.`);
    }
    for (const orden of ordenes) {
      plan.push({ orden, nocheDesde: f.nocheDesde, noches: f.noches, lugar: f.lugar ?? null, nota: f.nota ?? null });
    }
  }
  if (plan.length === 0) return [];

  // Cada nivel de alojamiento + los otros servicios con noches = el viaje entero, sin pisarse.
  const otros = plan.filter((p) => otrosConNoches.has(p.orden));
  const niveles = [...new Set(alojamientos.filter((o) => plan.some((p) => p.orden === o)).map((o) => grupoDe.get(o)!))];
  for (const nivel of niveles.length ? niveles : [null]) {
    const partes = [...plan.filter((p) => nivel !== null && grupoDe.get(p.orden) === nivel), ...otros];
    const ocupadas = new Set<number>();
    for (const p of partes) {
      for (let n = p.nocheDesde; n < p.nocheDesde + p.noches; n++) {
        if (ocupadas.has(n)) throw new Error(`noches-servicio.csv: en ${paquete}, la noche ${n} está en más de un servicio.`);
        ocupadas.add(n);
      }
    }
    if (nochesPaquete !== null && ocupadas.size !== nochesPaquete) {
      throw new Error(`noches-servicio.csv: en ${paquete} los servicios suman ${nochesTexto(ocupadas.size)} y el paquete tiene ${nochesPaquete}.`);
    }
  }
  return plan.sort((a, b) => a.orden - b.orden || a.nocheDesde - b.nocheDesde);
}

export interface ResumenNochesServicio {
  paquetes: string[];
  creadas: number;
  actualizadas: number;
  borradas: number;
}

/**
 * Carga el plan en `producto_servicio_noches`, paquete por paquete.
 * Idempotente: identidad (producto, orden, noche_desde). Primero arma y
 * controla todos los paquetes; si uno no cierra, no escribe nada.
 */
export async function cargarNochesServicio(opciones: {
  admin: SupabaseClient;
  filas: FilaNochesServicio[];
  nochesPaquete: (codigo: string) => number | null;
}): Promise<ResumenNochesServicio> {
  const { admin, filas } = opciones;
  const codigos = [...new Set(filas.map((f) => f.paquete))];
  const resumen: ResumenNochesServicio = { paquetes: codigos, creadas: 0, actualizadas: 0, borradas: 0 };
  if (codigos.length === 0) return resumen;

  const { data: productos, error } = await admin.from("producto").select("id, codigo").in("codigo", codigos);
  if (error) throw new Error(`No se pudo leer producto: ${error.message}`);
  const idDe = new Map((productos ?? []).map((p) => [p.codigo as string, p.id as string]));
  const faltan = codigos.filter((c) => !idDe.has(c));
  if (faltan.length) throw new Error(`noches-servicio.csv: no están cargados ${faltan.join(", ")}.`);

  const planes = new Map<string, NochesDeServicio[]>();
  for (const codigo of codigos) {
    const { data: servicios, error: e } = await admin
      .from("producto_servicio")
      .select("orden, prioridad, tipo_servicio, service_provider_nombre, nivel")
      .eq("producto_id", idDe.get(codigo)!)
      .not("orden", "is", null);
    if (e) throw new Error(`No se pudo leer los servicios de ${codigo}: ${e.message}`);
    planes.set(
      codigo,
      planNochesServicio(
        codigo,
        filas,
        (servicios ?? []).map((s) => ({
          orden: s.orden as number,
          prioridad: s.prioridad as number,
          tipo: s.tipo_servicio as string,
          serviceProviderNombre: (s.service_provider_nombre as string | null) ?? null,
          nivel: (s.nivel as string | null) ?? null,
        })),
        opciones.nochesPaquete(codigo),
      ),
    );
  }

  const ahora = new Date().toISOString();
  for (const [codigo, plan] of planes) {
    const productoId = idDe.get(codigo)!;
    const { data: actuales, error: e } = await admin
      .from("producto_servicio_noches")
      .select("id, orden, noche_desde, noches, lugar, nota")
      .eq("producto_id", productoId);
    if (e) throw new Error(`No se pudo leer las noches de ${codigo}: ${e.message}`);
    const porClave = new Map((actuales ?? []).map((a) => [`${a.orden}:${a.noche_desde}`, a]));
    for (const p of plan) {
      const clave = `${p.orden}:${p.nocheDesde}`;
      const actual = porClave.get(clave);
      porClave.delete(clave);
      const fila = { noches: p.noches, lugar: p.lugar, nota: p.nota };
      if (!actual) {
        const { error: ei } = await admin
          .from("producto_servicio_noches")
          .insert({ producto_id: productoId, orden: p.orden, noche_desde: p.nocheDesde, ...fila });
        if (ei) throw new Error(`No se pudo guardar las noches de ${codigo}: ${ei.message}`);
        resumen.creadas++;
      } else if (actual.noches !== fila.noches || (actual.lugar ?? null) !== fila.lugar || (actual.nota ?? null) !== fila.nota) {
        const { error: eu } = await admin
          .from("producto_servicio_noches")
          .update({ ...fila, updated_at: ahora })
          .eq("id", actual.id);
        if (eu) throw new Error(`No se pudo actualizar las noches de ${codigo}: ${eu.message}`);
        resumen.actualizadas++;
      }
    }
    const sobrantes = [...porClave.values()].map((a) => a.id as string);
    if (sobrantes.length) {
      const { error: ed } = await admin.from("producto_servicio_noches").delete().in("id", sobrantes);
      if (ed) throw new Error(`No se pudo borrar noches viejas de ${codigo}: ${ed.message}`);
      resumen.borradas += sobrantes.length;
    }
  }
  return resumen;
}
