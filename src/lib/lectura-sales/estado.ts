import { TEXTOS } from "@/lib/textos";

/**
 * La línea de estado de la lectura de sales@ arriba de la lista de reservas
 * (spec M2-07 §4, criterio #20). Solo números y textos en llano: nunca
 * remitentes, asuntos ni contenido. Las horas, en hora de Argentina.
 */

const T = TEXTOS.lecturaSales.linea;
const ZONA = "America/Argentina/Buenos_Aires";
/** Si la última lectura que anduvo es más vieja que esto, el cron dejó de dispararse. */
export const HORAS_ATRASADA = 26;

export interface CorridaParaLinea {
  estado: "anduvo_bien" | "con_aviso" | "fallo";
  inicio: string;
  miro: number;
  de_agencias: number;
  reservas_nuevas: number;
  reservas_actualizadas: number;
  avisos: string[];
  errores: string[];
}

export interface EstadoParaLinea {
  activa: boolean;
  ahora: Date;
  error?: boolean;
  /** La última corrida que leyó (anduvo bien, con aviso o falló). */
  ultima: CorridaParaLinea | null;
  /** La última que anduvo (bien o con aviso). */
  ultimaBuena: Pick<CorridaParaLinea, "inicio"> | null;
  noSePudoLeer: number;
}

export interface LineaLectura {
  tono: "ok" | "aviso" | "error" | "neutro";
  lineas: string[];
}

function partes(fecha: Date) {
  const p = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { dia: `${v("year")}-${v("month")}-${v("day")}`, ddmm: `${v("day")}/${v("month")}`, hora: `${v("hour")}:${v("minute")}`, semana: v("weekday") };
}

/** "hoy 12:14", "ayer 12:10", "el lunes 12:10" o "el 01/10 12:10". */
export function cuandoEnArgentina(iso: string, ahora: Date): string {
  const f = partes(new Date(iso));
  const hoy = partes(ahora);
  const dias = Math.round((Date.parse(`${hoy.dia}T00:00:00Z`) - Date.parse(`${f.dia}T00:00:00Z`)) / 86_400_000);
  if (dias === 0) return T.hoy(f.hora);
  if (dias === 1) return T.ayer(f.hora);
  if (dias > 1 && dias < 7) return T.dia(f.semana, f.hora);
  return T.dia(f.ddmm, f.hora);
}

export function lineaDeLectura(e: EstadoParaLinea): LineaLectura {
  if (e.error) return { tono: "error", lineas: [T.error] };
  if (!e.activa) return { tono: "neutro", lineas: [T.apagada] };
  if (!e.ultima) return { tono: "neutro", lineas: [T.nunca] };

  const u = e.ultima;
  const cuando = cuandoEnArgentina(u.inicio, e.ahora);
  let tono: LineaLectura["tono"];
  let lineas: string[];
  if (u.estado === "fallo") {
    tono = "error";
    lineas = [T.fallo(cuando, u.errores[0] ?? TEXTOS.lecturaSales.motivos.inesperado)];
  } else {
    tono = u.estado === "con_aviso" ? "aviso" : "ok";
    lineas = [T.bien(cuando, T.resumen(u.reservas_nuevas, u.reservas_actualizadas, u.miro, u.de_agencias)), ...u.avisos, ...u.errores];
  }
  if (e.noSePudoLeer > 0) lineas.push(T.noSePudoLeer(e.noSePudoLeer));
  if (e.ultimaBuena && e.ahora.getTime() - Date.parse(e.ultimaBuena.inicio) > HORAS_ATRASADA * 3_600_000) {
    lineas.push(T.atrasada(cuandoEnArgentina(e.ultimaBuena.inicio, e.ahora)));
    if (tono === "ok") tono = "aviso";
  }
  return { tono, lineas };
}
