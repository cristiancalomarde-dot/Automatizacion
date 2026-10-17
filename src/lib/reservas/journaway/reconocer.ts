import type { FilaLlamadaIA } from "@/lib/ia/registro-llamadas";
import { limpiarNombreJournaway } from "@/lib/importador-journaway/nombres";
import { AGENCIA_JOURNAWAY } from "@/lib/catalogo/reglas";
import type { CatalogoParaEmparejar, ProductoDeLista } from "../emparejar/catalogo";
import { emparejarProducto, nochesEntre, UMBRAL_CONFIANZA_PRODUCTO, type ProponerProducto } from "../emparejar/emparejar";
import type { FichaLectura } from "../esquema-ficha";
import type { OrigenEmparejado } from "../tipos";
import { codigosDelMail } from "./codigo";
import { MOTIVOS_JOURNAWAY as M, NOTAS_JOURNAWAY as N } from "./motivos";
import { combinarPaquetes, excursionesDe, repartirTours } from "./paquete";
import { compacto, normal, type SenalesJournaway } from "./senales";
import type { CatalogoJournaway, PaqueteJournaway, ReservaJournaway, ResultadoJournaway, TourJournaway } from "./tipos";

/**
 * El reconocedor de Journaway (spec M2-09 filas 1 a 7): de la lista de tours
 * sueltos del mail a las reservas, sin adivinar nunca el paquete.
 *
 * 1. **Nuestro código, primero** (fila 1): si el mail trae un código del
 *    catálogo se usa ese, sin IA. Un código que no existe, o que contradice
 *    los tours, va a revisión. SPAP05 ↔ SPAP06 no es una contradicción: para
 *    HI Travel son el mismo tour (owner 2026-10-12), queda una nota.
 * 2. **Cada tour por su nombre** (fila 2): limpio (`limpiarNombreJournaway`)
 *    contra los nombres de Journaway (`codigo_externo`). Si no está, la IA
 *    propone con confianza (M2-03); si no, la reserva va a revisión.
 * 3. **El paquete con la lista** (filas 4 y 5): la combinación exacta y única.
 * 4. **Tayka** (filas 6 y 7): el Overland de Imperio Inca; las noches en San
 *    Pedro deciden entre SPAP05 y SPAP06, el título N/D es la tercera señal.
 *
 * La única IA es la propuesta de un tour cuyo nombre no está cargado (#3).
 * No escribe nada.
 */

export interface ContextoJournaway {
  catalogo: CatalogoParaEmparejar;
  journaway: CatalogoJournaway;
  senales: SenalesJournaway;
  /** Sin esto, un tour que no se reconoce por su nombre va a revisión. */
  proponer?: ProponerProducto;
}

interface Contexto extends ContextoJournaway {
  ficha: FichaLectura;
}

const conProductoId = (t: TourJournaway) => ({ ...t, productoId: t.producto?.id ?? null });

function reserva(tours: TourJournaway[], extra: Partial<ReservaJournaway> = {}): ReservaJournaway {
  const desdeTours = tours.length && tours.every((t) => t.origen) ? tours : [];
  const origen: OrigenEmparejado | null = desdeTours.some((t) => t.origen === "ia") ? "ia" : desdeTours.length ? "nombre" : null;
  const confianza = desdeTours.length ? Math.min(...desdeTours.map((t) => t.confianza ?? 1)) : null;
  return { producto: null, paquete: null, tours, motivos: [], notas: [], sinTrasladoDe: null, origen, confianza, sugerencia: null, ...extra };
}

const revision = (tours: TourJournaway[], motivos: string[], extra: Partial<ReservaJournaway> = {}) =>
  reserva(tours, { origen: null, confianza: null, ...extra, motivos });

/** "San Pedro de Atacama: Tour to Rainbow Valley" → "Tour to Rainbow Valley" (para los motivos). */
function nombreCorto(nombre: string): string {
  let t = nombre.replace(/^\s*\d+\s*[).]\s*/, "");
  for (let previo = ""; previo !== t; ) {
    previo = t;
    t = t.replace(/^\s*(?:[^\s:\d]+\s+){0,5}[^\s:\d]+\s*:\s+/u, "");
  }
  return t.trim();
}

function indiceDeNombres(catalogo: CatalogoParaEmparejar): Map<string, ProductoDeLista | null> {
  const porId = new Map(catalogo.productos.map((p) => [p.id, p]));
  const indice = new Map<string, ProductoDeLista | null>();
  for (const c of catalogo.codigos) {
    if (c.agencia !== AGENCIA_JOURNAWAY) continue;
    const p = porId.get(c.productoId);
    if (!p) continue;
    const previo = indice.get(c.codigo);
    // Un nombre que apunta a dos productos no sirve (no pasa: M2-08 lo frena al cargar).
    indice.set(c.codigo, previo && previo.id !== p.id ? null : p);
  }
  return indice;
}

// --- Tayka (filas 6 y 7) ---------------------------------------------------------------------

function esTayka(tours: TourJournaway[], ctx: Contexto): boolean {
  const overland = new Set(ctx.senales.diasOverland.map((d) => d.codigo));
  const titulo = compacto(ctx.ficha.titulo_paquete.valor ?? "");
  return (
    tours.some((t) => t.pickUp && ctx.senales.hotelesTayka.some((h) => normal(t.pickUp!).includes(h))) ||
    tours.some((t) => t.producto && overland.has(t.producto.codigo)) ||
    (!!titulo && ctx.senales.familiaTayka.claves.some((c) => titulo.includes(c)))
  );
}

const sumarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** El día del paquete en que arranca el Overland, menos uno: las noches en San Pedro (SPAP05 = 4, SPAP06 = 5). */
function nochesDelPaquete(p: PaqueteJournaway, overland: Set<string>): number | null {
  const parte = p.partes.find((x) => overland.has(x.codigo));
  return parte ? parte.dia - 1 : null;
}

interface DecisionTayka {
  reservas: ReservaJournaway[];
  /** El paquete que dan los tours (aunque vaya a revisión) y las noches, para el código del mail. */
  paquete: PaqueteJournaway | null;
  noches: number | null;
}

function armarTayka(tours: TourJournaway[], ctx: Contexto): DecisionTayka {
  const s = ctx.senales;
  const codigosOverland = new Set(s.diasOverland.map((d) => d.codigo));
  const paquetes = ctx.journaway.paquetes.filter((p) => s.familiaTayka.codigos.includes(p.codigo));
  const esOverland = (t: TourJournaway) =>
    (t.producto && codigosOverland.has(t.producto.codigo)) || (!!t.pickUp && s.hotelesTayka.some((h) => normal(t.pickUp!).includes(h)));
  const overland = tours.filter(esOverland);
  const deSanPedro = new Set(paquetes.flatMap((p) => excursionesDe(p)).filter((id) => !overland.some((t) => t.producto?.id === id)));
  const sanPedro = tours.filter((t) => !esOverland(t) && t.producto && deSanPedro.has(t.producto.id));
  const sueltos = tours.filter((t) => !overland.includes(t) && !sanPedro.includes(t));
  const motivos: string[] = [];
  const notas: string[] = [];

  // Los 3 días del Overland, por su nombre.
  const fechaDia = new Map<number, string | null>();
  for (const d of s.diasOverland) {
    const t = overland.find((x) => limpiarNombreJournaway(x.nombre) === d.limpio);
    if (t) fechaDia.set(d.dia, t.fecha);
    else motivos.push(M.faltaDiaOverland(d.dia));
  }
  const arranque = [...fechaDia].filter(([, f]) => f).map(([dia, f]) => sumarDias(f!, -(dia - 1)))[0] ?? null;

  // Desde que llega a Calama (vuelo o primer tour de San Pedro) hasta el primer día del Overland.
  const iatas = s.aeropuertos.filter((a) => paquetes.some((p) => a.paquetes.includes(p.codigo))).map((a) => a.iata);
  const vuelo = ctx.ficha.vuelos.find((v) => v.destino && iatas.includes(v.destino.toUpperCase()));
  const primerTour = sanPedro.map((t) => t.fecha).filter(Boolean).sort()[0] ?? null;
  const llegada = vuelo?.fecha_llegada ?? vuelo?.fecha_salida ?? primerTour;
  const noches = arranque && llegada ? nochesEntre(llegada, arranque) : null;

  const porNoches = noches === null ? null : (paquetes.find((p) => nochesDelPaquete(p, codigosOverland) === noches) ?? null);
  const titulo = compacto(ctx.ficha.titulo_paquete.valor ?? "");
  const senalTitulo = titulo ? s.titulos.find((t) => titulo.includes(t.clave)) : undefined;
  const porTitulo = senalTitulo ? (paquetes.find((p) => p.codigo === senalTitulo.codigo) ?? null) : null;

  let elegido: PaqueteJournaway | null = null;
  if (noches !== null && !porNoches) {
    motivos.push(
      M.nochesFuera(
        noches,
        paquetes.map((p) => ({ codigo: p.codigo, noches: nochesDelPaquete(p, codigosOverland) ?? 0 })),
      ),
    );
  } else if (porNoches) {
    elegido = porNoches;
    if (porTitulo && porTitulo !== porNoches) {
      notas.push(N.tituloDistinto(senalTitulo!.texto.replace(/^.*?(\d+N\/\d+D)$/i, "$1"), noches!, porNoches.codigo));
    }
  } else if (porTitulo) {
    elegido = porTitulo;
  } else {
    motivos.push(M.sinNoches);
  }

  // Los tours de San Pedro tienen que ser los del paquete (M2-08).
  if (elegido) {
    const pide = elegido.partes.filter((p) => !p.esTraslado && !codigosOverland.has(p.codigo));
    const libres = [...sanPedro];
    for (const parte of pide) {
      const i = libres.findIndex((t) => t.producto?.id === parte.productoId);
      if (i >= 0) libres.splice(i, 1);
      else motivos.push(M.faltaTour(parte.codigo, parte.nombre, elegido.codigo));
    }
    for (const t of libres) motivos.push(M.sobraTour(nombreCorto(t.nombre), elegido.codigo));
  }

  const propios = tours.filter((t) => overland.includes(t) || sanPedro.includes(t));
  const principal = motivos.length
    ? revision(propios, motivos, { notas, sugerencia: elegido ? productoDe(ctx, elegido) : null })
    : reserva(propios, { producto: productoDe(ctx, elegido!), paquete: elegido, notas });
  return { reservas: [principal, ...sueltos.map((t) => sueltoOPaquete([t], ctx))], paquete: elegido, noches };
}

function productoDe(ctx: Contexto, p: PaqueteJournaway): ProductoDeLista {
  return ctx.catalogo.productos.find((x) => x.id === p.productoId)!;
}

/** Un tour suelto: su producto (si es un paquete armado, con sus partes). */
function sueltoOPaquete(tours: TourJournaway[], ctx: Contexto): ReservaJournaway {
  const producto = tours[0].producto!;
  const paquete = ctx.journaway.paquetes.find((p) => p.productoId === producto.id) ?? null;
  return reserva(tours, { producto, paquete });
}

// --- La lista de tours (filas 4 y 5) -------------------------------------------------------

interface Armado {
  reservas: ReservaJournaway[];
  /** Los paquetes que dan los tours, si cierran (para comparar con el código del mail). */
  productos: ProductoDeLista[] | null;
  tayka: DecisionTayka | null;
}

const porPrimerTour = (a: ReservaJournaway, b: ReservaJournaway) =>
  Math.min(...a.tours.map((t) => t.indice)) - Math.min(...b.tours.map((t) => t.indice));

function armarDesdeTours(tours: TourJournaway[], ctx: Contexto): Armado {
  if (tours.length === 0) return { reservas: [revision([], [M.sinTours])], productos: null, tayka: null };
  if (esTayka(tours, ctx)) {
    const tayka = armarTayka(tours, ctx);
    const ok = tayka.reservas.every((r) => r.producto);
    return { reservas: tayka.reservas, productos: ok ? tayka.reservas.map((r) => r.producto!) : null, tayka };
  }
  if (tours.length === 1) {
    const r = sueltoOPaquete(tours, ctx);
    return { reservas: [r], productos: [r.producto!], tayka: null };
  }

  const paquetes = ctx.journaway.paquetes;
  const deAlgunPaquete = new Set(paquetes.flatMap(excursionesDe));
  let enPaquete = tours.filter((t) => deAlgunPaquete.has(t.producto!.id));
  if (enPaquete.length < 2) enPaquete = [];
  const sueltos = tours.filter((t) => !enPaquete.includes(t)).map((t) => sueltoOPaquete([t], ctx));
  const reservas = [...sueltos];

  if (enPaquete.length) {
    const combinacion = combinarPaquetes(
      enPaquete.map((t) => t.producto!.id),
      paquetes,
    );
    if (combinacion.exactas.length === 1) {
      const partes = repartirTours(enPaquete.map(conProductoId), combinacion.exactas[0]);
      // Fila 15: si uno de la combinación tiene solo la salida (SPAP03), los demás no piden la salida.
      const conSalida = partes.find((p) => p.paquete.partes.some((x) => x.esTraslado && x.lados.length === 1 && x.lados[0] === "out"));
      for (const { paquete, tours: propios } of partes) {
        const sinSalida =
          !!conSalida && conSalida.paquete !== paquete && paquete.partes.some((x) => x.esTraslado && x.lados.includes("out"));
        const r = reserva(
          propios.map((t) => tours.find((x) => x.indice === t.indice)!),
          { producto: productoDe(ctx, paquete), paquete, sinTrasladoDe: sinSalida ? "salida" : null },
        );
        if (sinSalida) r.notas.push(N.soloLlegada(conSalida!.paquete.codigo));
        reservas.push(r);
      }
    } else if (combinacion.exactas.length > 1) {
      const opciones = combinacion.exactas.map((c) => c.map((p) => p.codigo).join(" + "));
      reservas.push(revision(enPaquete, [M.variasCombinaciones(opciones)]));
    } else if (combinacion.mejores.length === 1) {
      const usados = repartirTours(enPaquete.map(conProductoId), combinacion.mejores[0]).flatMap((p) => p.tours.map((t) => t.indice));
      const sobran = enPaquete.filter((t) => !usados.includes(t.indice)).map((t) => nombreCorto(t.nombre));
      reservas.push(revision(enPaquete, [M.sobran(sobran)]));
    } else if (combinacion.mejores.length > 1) {
      const opciones = combinacion.mejores.map((c) => c.map((p) => p.codigo).join(" + "));
      reservas.push(revision(enPaquete, [`${M.ningunPaquete} (podrían ser parte de ${opciones.join(" o ")})`]));
    } else {
      reservas.push(revision(enPaquete, [M.ningunPaquete]));
    }
  }
  reservas.sort(porPrimerTour);
  const ok = reservas.every((r) => r.producto);
  return { reservas, productos: ok ? reservas.map((r) => r.producto!) : null, tayka: null };
}

// --- Notas por tour (fila 3) ---------------------------------------------------------------

function agregarNotasDeTours(reservas: ReservaJournaway[], senales: SenalesJournaway): void {
  for (const r of reservas) {
    for (const t of r.tours) {
      for (const n of senales.notas) {
        if (t.producto?.codigo === n.codigo && normal(t.nombre).includes(n.clave) && !r.notas.includes(n.nota)) r.notas.push(n.nota);
      }
    }
  }
}

// --- Orquestación --------------------------------------------------------------------------

export async function reconocerJournaway(ficha: FichaLectura, texto: string, contexto: ContextoJournaway): Promise<ResultadoJournaway> {
  const ctx: Contexto = { ...contexto, ficha };
  const llamadas: FilaLlamadaIA[] = [];
  let costo = 0;
  const nombres = indiceDeNombres(ctx.catalogo);

  const tours: TourJournaway[] = ficha.productos.map((p, indice) => {
    const producto = nombres.get(limpiarNombreJournaway(p.nombre)) ?? null;
    return {
      indice,
      nombre: p.nombre,
      fecha: p.fecha_inicio,
      pickUp: p.punto_recogida,
      producto,
      origen: producto ? "nombre" : null,
      confianza: producto ? 1 : null,
    };
  });

  // Fila 1: nuestro código, primero (en el texto o en lo que la IA copió como código del tour).
  const codigos = codigosDelMail([texto, ...ficha.productos.map((p) => p.codigo ?? "")].join("\n"), ctx.catalogo);
  const terminar = (reservas: ReservaJournaway[]): ResultadoJournaway => {
    agregarNotasDeTours(reservas, ctx.senales);
    return { reservas, llamadas, costo };
  };

  if (codigos.desconocidos.length) {
    return terminar([revision(tours, codigos.desconocidos.map(M.codigoNoEsta))]);
  }
  if (codigos.productos.length) {
    const delMail = codigos.productos;
    const todosConocidos = tours.length > 0 && tours.every((t) => t.producto);
    const armado = todosConocidos ? armarDesdeTours(tours, ctx) : null;
    const comoCodigo = (r: ReservaJournaway): ReservaJournaway => ({ ...r, origen: "codigo", confianza: 1 });
    if (armado?.productos) {
      const segunTours = armado.productos.map((p) => p.codigo);
      const iguales = segunTours.length === delMail.length && delMail.every((p) => segunTours.includes(p.codigo));
      if (iguales) return terminar(armado.reservas.map(comoCodigo));
      // SPAP05 ↔ SPAP06: el mismo tour para HI Travel (owner 2026-10-12).
      const familia = ctx.senales.familiaTayka.codigos;
      if (delMail.length === 1 && segunTours.length === 1 && familia.includes(delMail[0].codigo) && familia.includes(segunTours[0])) {
        const paquete = ctx.journaway.paquetes.find((p) => p.productoId === delMail[0].id) ?? null;
        const r = comoCodigo({ ...armado.reservas[0], producto: delMail[0], paquete });
        r.notas = [...r.notas, N.codigoDeLaFamilia(delMail[0].codigo, armado.tayka?.noches ?? null, segunTours[0])];
        return terminar([r]);
      }
      return terminar([revision(tours, [M.codigoContradice(delMail.map((p) => p.codigo), segunTours.join(" + "))])]);
    }
    if (armado) {
      const motivo = armado.reservas.flatMap((r) => r.motivos)[0] ?? M.ningunPaquete;
      return terminar([revision(tours, [M.codigoContradice(delMail.map((p) => p.codigo), motivo.charAt(0).toLowerCase() + motivo.slice(1))])]);
    }
    // Los tours no se reconocen por nombre: manda el código, sin IA.
    return terminar(
      delMail.map((producto, i) =>
        comoCodigo(
          reserva(delMail.length === 1 || i === 0 ? tours : [], {
            producto,
            paquete: ctx.journaway.paquetes.find((p) => p.productoId === producto.id) ?? null,
          }),
        ),
      ),
    );
  }

  // Fila 2: los tours que no están por nombre, a la IA (solo en una reserva nueva).
  const usarIA = ficha.tipo_mail.valor === "reserva_nueva" && !!ctx.proponer;
  const noReconocidos: string[] = [];
  for (const t of tours.filter((x) => !x.producto)) {
    if (!usarIA) {
      noReconocidos.push(t.nombre);
      continue;
    }
    const r = await emparejarProducto(
      { nombre: t.nombre, codigo: null, fechaInicio: t.fecha, fechaFin: null },
      { agencia: AGENCIA_JOURNAWAY, catalogo: ctx.catalogo, proponer: ctx.proponer },
    );
    if (r.llamada) llamadas.push(r.llamada);
    costo += r.costo;
    if (r.producto && (r.origen !== "ia" || (r.confianza ?? 0) >= UMBRAL_CONFIANZA_PRODUCTO)) {
      t.producto = r.producto;
      t.origen = r.origen;
      t.confianza = r.confianza;
    } else noReconocidos.push(t.nombre);
  }
  if (noReconocidos.length) return terminar([revision(tours, noReconocidos.map(M.tourNoReconocido))]);

  return terminar(armarDesdeTours(tours, ctx).reservas);
}
