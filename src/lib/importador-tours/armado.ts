import { nombraDestino, nombreDestino } from "./ciudades";
import { mismaRuta, type TramoConProveedor } from "./datos";
import type { TourExcel } from "./rutas";
import type { DiaItinerario, ItemIncluido, ItinerarioWord } from "./word";

/**
 * Armado de un tour compuesto (spec M1-05 §3 #2-#7 y #9): cruza los códigos
 * de RutasenBus (qué paquetes) con el itinerario del Word (orden, noches,
 * buses nocturnos) y devuelve la secuencia con el día de inicio de cada
 * componente. Es puro: no lee archivos ni la base.
 *
 * Cómo se arma:
 * 1. El "Included" del Word da, en orden, las estadías ("3 nights in El
 *    Chalten") y los buses. Contando noches se sabe el día de cada cosa: una
 *    estadía de N noches que empieza el día d termina el día d+N; un bus
 *    nocturno que sale el día d llega el d+1 (esa noche se pasa en el bus).
 *    Un bus es nocturno si el Included lo dice (Night / PM / overnight) o si
 *    el texto de ese día del itinerario dice "night bus" / "overnight bus".
 * 2. Cada estadía va al componente del Excel cuyo destino es el suyo (un tour
 *    anidado, como CHB31 dentro de 5C01, cubre los destinos de sus paquetes).
 *    Las estadías seguidas de un mismo componente se suman (CH10 = Puerto
 *    Natales + W Trek).
 * 3. Los buses entre dos componentes son `tramo_bus` (los emite HI Travel),
 *    salvo que el bus esté en `tramos-con-proveedor.csv`: entonces es un
 *    servicio propio del tour (CHB31: Uyuni – La Paz con Imperio Inca), o
 *    parte del tour anidado si el bus es de ese tour (5C01 → CHB31). Los
 *    buses antes de la primera estadía o después de la última (aeropuerto,
 *    salida) los cubre el paquete de la punta: no se cargan.
 * 4. Transfer: solo el primer componente lleva `transfer_in` y solo el
 *    último `transfer_out`; Iguazú (IGR) los conserva aunque esté en el medio.
 *
 * Lo que no cierra no se arma: el tour queda "para revisar" con sus motivos
 * (falta un paquete, las noches del Word no coinciden con el Excel, la suma
 * no da la duración del título, un bus no cae el día que dice el itinerario,
 * un destino sin paquete o repetido, más de un nivel de anidado).
 */

export interface PaqueteConocido {
  codigo: string;
  destino: string;
  /** Noches del paquete vendido solo (Excel de paquetes); null = no se encontraron. */
  nochesBase: number | null;
  nombre?: string;
}

export interface ComponenteArmado {
  orden: number;
  tipo: "paquete" | "tramo_bus";
  /** Código del paquete o del tour anidado; null en tramo_bus. */
  codigo: string | null;
  esTour: boolean;
  destinos: string[];
  /** Solo tramo_bus. */
  desde: string | null;
  hasta: string | null;
  descripcionRuta: string | null;
  noches: number | null;
  diaDesde: number;
  nocturno: boolean | null;
  transferIn: boolean;
  transferOut: boolean;
  /** Solo paquete: de dónde salen las noches esperadas ("3 + 1"). */
  ajusteNoches?: number;
  nochesBase?: number | null;
}

export interface ServicioPropio {
  /** "Bus Uyuni – La Paz" (como en tramos-con-proveedor.csv). */
  ruta: string;
  desde: string;
  hasta: string;
  bookingSupplier: string;
  diaDesde: number;
  nocturno: boolean;
  /** Ruta en el sentido de este tour ("La Paz – Uyuni"). */
  sentido: string;
}

interface Base {
  codigo: string;
  nombre: string;
  noches: number | null;
  notas: string[];
}

export type TourArmado =
  | (Base & {
      estado: "armado";
      componentes: ComponenteArmado[];
      serviciosPropios: ServicioPropio[];
      /** Ciudades en el orden del viaje (la primera es la de inicio). */
      ciudades: string[];
    })
  | (Base & { estado: "para_revisar"; motivos: string[] });

export interface EntradaArmado {
  codigo: string;
  excel: TourExcel | null;
  word: ItinerarioWord | null;
  paquetes: Map<string, PaqueteConocido>;
  /** Los códigos de los tours compuestos (para reconocer un tour dentro de otro). */
  codigosTour: Set<string>;
  /** Los tours ya armados en esta corrida (los anidados se arman primero). */
  tours: Map<string, TourArmado>;
  tramosConProveedor: TramoConProveedor[];
}

interface Grupo {
  indice: number;
  codigo: string;
  esTour: boolean;
  destinos: Set<string>;
  esperadas: number | null;
  detalleEsperadas: string;
  ajuste: number;
  base: number | null;
  tramosPropios: TramoConProveedor[];
}

interface Paso {
  item: ItemIncluido;
  dia: number;
  nocturno: boolean;
}

// "night bus", "overnight bus" y el typo del Word "nigh bus" (AR09, día 8).
const NOCTURNO_DIA = /\b(over)?night?\s+bus\b|\bovernight\b/i;
const DESTINOS_CON_TRANSFER = new Set(["IGR", "IGU"]);

function ruta(desde: string, hasta: string): string {
  return `${nombreDestino(desde)} – ${nombreDestino(hasta)}`;
}

function nochesTexto(n: number): string {
  return `${n} ${n === 1 ? "noche" : "noches"}`;
}

export function armarTour(e: EntradaArmado): TourArmado {
  const nombre = e.word?.nombre || e.excel?.nombre || e.codigo;
  const base: Base = { codigo: e.codigo, nombre, noches: e.word?.noches ?? null, notas: [] };
  const motivos: string[] = [];
  const revisar = (): TourArmado => ({ ...base, estado: "para_revisar", motivos });

  if (!e.excel) motivos.push(`no encontré ${e.codigo} en la hoja "Tours 2027" de RutasenBus (o no tiene su fila "Net Prices:")`);
  if (!e.word) motivos.push(`no encontré ${e.codigo} en los Word de catálogo`);
  if (!e.excel || !e.word) return revisar();
  const { excel, word } = e;

  // --- 1. los componentes del Excel ---
  if (excel.componentes.length === 0) motivos.push("RutasenBus no tiene la fila de códigos de este tour");
  for (const r of excel.noReconocidos) motivos.push(`RutasenBus, columna ${r.columna}: no entiendo “${r.texto}”`);
  for (const i of excel.incluidos) {
    if (!excel.componentes.some((c) => c.codigo === i.incluidoEn)) {
      motivos.push(`RutasenBus, columna ${i.columna}: dice “incluido en ${i.incluidoEn}”, pero ${i.incluidoEn} no está en el tour`);
    } else {
      base.notas.push(`La columna ${i.columna} (“${i.encabezado}”) está incluida en ${i.incluidoEn}: no es un componente propio.`);
    }
  }
  const grupos: Grupo[] = [];
  for (const c of excel.componentes) {
    const indice = grupos.length;
    if (e.codigosTour.has(c.codigo)) {
      const anidado = e.tours.get(c.codigo);
      if (!anidado) {
        motivos.push(`${c.codigo} es un tour y todavía no está armado`);
        continue;
      }
      if (anidado.estado !== "armado") {
        motivos.push(`incluye el tour ${c.codigo}, que quedó para revisar`);
        continue;
      }
      if (anidado.componentes.some((x) => x.esTour)) {
        motivos.push(`incluye el tour ${c.codigo}, que a su vez incluye otro tour (se admite máximo un nivel de anidado)`);
        continue;
      }
      const destinos = new Set(anidado.componentes.flatMap((x) => (x.tipo === "paquete" ? x.destinos : [])));
      const esperadas = anidado.noches === null ? null : anidado.noches + c.ajusteNoches;
      grupos.push({
        indice,
        codigo: c.codigo,
        esTour: true,
        destinos,
        esperadas,
        detalleEsperadas: `el tour ${c.codigo} tiene ${nochesTexto(anidado.noches ?? 0)}`,
        ajuste: c.ajusteNoches,
        base: anidado.noches,
        tramosPropios: e.tramosConProveedor.filter((t) => t.tour === c.codigo),
      });
      continue;
    }
    const paquete = e.paquetes.get(c.codigo);
    if (!paquete) {
      motivos.push(`falta el paquete ${c.codigo} (no está cargado o no está en data/paquetes-piloto.csv)`);
      continue;
    }
    if (paquete.nochesBase === null) {
      motivos.push(`no encontré las noches de ${c.codigo} en el Excel de paquetes, así que no puedo controlar las del Word`);
      continue;
    }
    const esperadas = paquete.nochesBase + c.ajusteNoches;
    grupos.push({
      indice,
      codigo: c.codigo,
      esTour: false,
      destinos: new Set([paquete.destino]),
      esperadas,
      detalleEsperadas:
        c.ajusteNoches === 0
          ? `el paquete tiene ${nochesTexto(paquete.nochesBase)}`
          : `el Excel dice “${c.texto}” de un paquete de ${nochesTexto(paquete.nochesBase)}`,
      ajuste: c.ajusteNoches,
      base: paquete.nochesBase,
      tramosPropios: [],
    });
  }
  const porDestino = new Map<string, Grupo[]>();
  for (const g of grupos) for (const d of g.destinos) porDestino.set(d, [...(porDestino.get(d) ?? []), g]);

  // --- 2. el Word: noches y días ---
  for (const p of word.problemas) motivos.push(p);
  const textoDia = new Map<number, DiaItinerario>();
  for (const d of word.dias) if (!textoDia.has(d.numero)) textoDia.set(d.numero, d);
  const pasos: Paso[] = [];
  let dia = 1;
  for (const item of word.items) {
    if (item.tipo === "estadia") {
      pasos.push({ item, dia, nocturno: false });
      dia += item.noches;
    } else {
      const nocturno = item.nocturnoTexto || NOCTURNO_DIA.test(textoDia.get(dia)?.texto ?? "");
      pasos.push({ item, dia, nocturno });
      if (nocturno) dia += 1;
    }
  }
  const total = dia - 1;
  if (word.noches === null) motivos.push(`el título del Word no dice la duración (“${word.titulo}”)`);
  else if (total !== word.noches) {
    motivos.push(
      `el Word suma ${nochesTexto(total)} (estadías más buses nocturnos) y el título dice ${nochesTexto(word.noches)}`,
    );
  }
  const ultimoDia = Math.max(0, ...word.dias.map((d) => d.numero));
  if (word.noches !== null && ultimoDia > 0 && ultimoDia !== word.noches + 1) {
    motivos.push(`el itinerario termina el día ${ultimoDia} y el título dice ${nochesTexto(word.noches)}`);
  }

  // --- 3. cada estadía a su componente ---
  const grupoDePaso = new Map<number, Grupo>();
  const vistos: Grupo[] = [];
  pasos.forEach((p, i) => {
    if (p.item.tipo !== "estadia") return;
    if (!p.item.destino) {
      motivos.push(`no sé en qué destino es “${p.item.texto}”`);
      return;
    }
    const candidatos = porDestino.get(p.item.destino) ?? [];
    if (candidatos.length === 0) {
      motivos.push(`el Word tiene ${nochesTexto(p.item.noches)} en ${nombreDestino(p.item.destino)} y RutasenBus no tiene un paquete de ese destino`);
      return;
    }
    if (candidatos.length > 1) {
      motivos.push(`${nombreDestino(p.item.destino)} está en más de un componente (${candidatos.map((g) => g.codigo).join(", ")}): el orden es ambiguo`);
      return;
    }
    const g = candidatos[0];
    const anterior = vistos[vistos.length - 1];
    if (anterior !== g && vistos.includes(g)) {
      motivos.push(`${g.codigo} aparece dos veces separado en el itinerario: el orden es ambiguo`);
      return;
    }
    if (anterior !== g) vistos.push(g);
    grupoDePaso.set(i, g);
  });
  for (const g of grupos) {
    if (!vistos.includes(g)) motivos.push(`RutasenBus trae ${g.codigo} pero el Word no tiene noches en su destino`);
  }
  if (motivos.length) return revisar();

  // --- 4. los buses y la secuencia ---
  const indicesEstadia = [...grupoDePaso.keys()].sort((a, b) => a - b);
  const primera = indicesEstadia[0];
  const ultima = indicesEstadia[indicesEstadia.length - 1];
  const grupoAntes = (i: number) => grupoDePaso.get(Math.max(...indicesEstadia.filter((k) => k < i)));
  const grupoDespues = (i: number) => grupoDePaso.get(Math.min(...indicesEstadia.filter((k) => k > i)));

  const nochesGrupo = new Map<Grupo, number>();
  const diaGrupo = new Map<Grupo, number>();
  type Elemento = { tipo: "grupo"; grupo: Grupo } | { tipo: "bus"; paso: Paso };
  const secuencia: Elemento[] = [];
  const serviciosPropios: ServicioPropio[] = [];
  const ciudades: string[] = [];
  const sumarCiudad = (d: string) => {
    const n = nombreDestino(d);
    if (!ciudades.includes(n)) ciudades.push(n);
  };

  const controlarDia = (p: Paso, hasta: string) => {
    const hoy = textoDia.get(p.dia);
    const manana = textoDia.get(p.dia + 1);
    if (!hoy) return; // el Word no tiene ese día escrito: no hay con qué controlar
    const llega = nombraDestino(hoy.titulo, hasta) || (p.nocturno && manana !== undefined && nombraDestino(manana.titulo, hasta));
    if (!llega) {
      motivos.push(
        `según las noches, el bus a ${nombreDestino(hasta)} sale el día ${p.dia}, pero el itinerario ese día dice “${hoy.titulo}”`,
      );
    }
  };

  pasos.forEach((p, i) => {
    if (p.item.tipo === "estadia") {
      const g = grupoDePaso.get(i)!;
      nochesGrupo.set(g, (nochesGrupo.get(g) ?? 0) + p.item.noches);
      if (!diaGrupo.has(g)) {
        diaGrupo.set(g, p.dia);
        secuencia.push({ tipo: "grupo", grupo: g });
      }
      sumarCiudad(p.item.destino!);
      return;
    }
    const bus = p.item;
    const antes = i < primera ? undefined : grupoAntes(i);
    const despues = i > ultima ? undefined : grupoDespues(i);
    const propio = e.tramosConProveedor.find((t) => t.tour === e.codigo && mismaRuta(t, bus.desde, bus.hasta));
    if (propio) {
      controlarDia(p, bus.hasta!);
      serviciosPropios.push({
        ruta: propio.ruta,
        desde: propio.desde,
        hasta: propio.hasta,
        bookingSupplier: propio.bookingSupplier,
        diaDesde: p.dia,
        nocturno: p.nocturno,
        sentido: ruta(bus.desde!, bus.hasta!),
      });
      sumarCiudad(bus.desde!);
      sumarCiudad(bus.hasta!);
      return;
    }
    if (antes && despues && antes === despues) {
      // Dentro de un mismo componente (W Trek de CH10): no es un tramo propio.
      if (p.nocturno) nochesGrupo.set(antes, (nochesGrupo.get(antes) ?? 0) + 1);
      return;
    }
    const anidado = [antes, despues].find(
      (g) => g?.esTour && g.tramosPropios.some((t) => mismaRuta(t, bus.desde, bus.hasta)),
    );
    if (anidado) {
      // El bus es del tour anidado (5C01 → el Uyuni – La Paz de CHB31).
      controlarDia(p, bus.hasta!);
      if (p.nocturno) nochesGrupo.set(anidado, (nochesGrupo.get(anidado) ?? 0) + 1);
      if (anidado === despues && !diaGrupo.has(anidado)) diaGrupo.set(anidado, p.dia);
      sumarCiudad(bus.desde!);
      sumarCiudad(bus.hasta!);
      return;
    }
    if (!antes || !despues) {
      base.notas.push(
        `“${bus.texto}” va ${!antes ? "antes de la primera" : "después de la última"} estadía: lo cubre el paquete de la punta, no se carga como tramo.`,
      );
      return;
    }
    if (!bus.desde || !bus.hasta) {
      motivos.push(`no sé entre qué ciudades va “${bus.texto}”`);
      return;
    }
    controlarDia(p, bus.hasta);
    secuencia.push({ tipo: "bus", paso: p });
    sumarCiudad(bus.desde);
    sumarCiudad(bus.hasta);
  });

  for (const g of grupos) {
    const noches = nochesGrupo.get(g) ?? 0;
    if (g.esperadas !== null && noches !== g.esperadas) {
      const destinos = [...g.destinos].map(nombreDestino).join(" + ");
      motivos.push(
        `${g.codigo}: el Word dice ${nochesTexto(noches)} en ${destinos} y ${g.detalleEsperadas}, así que espero ${g.esperadas}`,
      );
    }
  }
  if (motivos.length) return revisar();

  // --- 5. componentes y transfers ---
  const componentes: ComponenteArmado[] = secuencia.map((el, k) => {
    if (el.tipo === "grupo") {
      const g = el.grupo;
      return {
        orden: k + 1,
        tipo: "paquete",
        codigo: g.codigo,
        esTour: g.esTour,
        destinos: [...g.destinos],
        desde: null,
        hasta: null,
        descripcionRuta: null,
        noches: nochesGrupo.get(g) ?? 0,
        diaDesde: diaGrupo.get(g)!,
        nocturno: null,
        transferIn: false,
        transferOut: false,
        ajusteNoches: g.ajuste,
        nochesBase: g.base,
      };
    }
    const bus = el.paso.item as Extract<ItemIncluido, { tipo: "bus" }>;
    return {
      orden: k + 1,
      tipo: "tramo_bus",
      codigo: null,
      esTour: false,
      destinos: [],
      desde: bus.desde,
      hasta: bus.hasta,
      descripcionRuta: ruta(bus.desde!, bus.hasta!),
      noches: null,
      diaDesde: el.paso.dia,
      nocturno: el.paso.nocturno,
      transferIn: false,
      transferOut: false,
    };
  });
  const paquetes = componentes.filter((c) => c.tipo === "paquete");
  for (const c of paquetes) {
    const conTransfer = c.destinos.some((d) => DESTINOS_CON_TRANSFER.has(d));
    c.transferIn = c === paquetes[0] || conTransfer;
    c.transferOut = c === paquetes[paquetes.length - 1] || conTransfer;
  }

  return { ...base, estado: "armado", componentes, serviciosPropios, ciudades };
}
