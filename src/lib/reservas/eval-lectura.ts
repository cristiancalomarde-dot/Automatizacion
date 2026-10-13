import type { FichaLectura, TipoMail } from "./esquema-ficha";

/**
 * El comparador del set de evaluación de la lectura (spec M2-02 fila 28;
 * `integraciones-ia.md`, "Medir la calidad"). Compara la ficha que sacó la IA
 * con la ficha correcta que validó el owner, campo por campo: exacto en
 * códigos, números y fechas; normalizado (mayúsculas, acentos, signos) en
 * nombres. Lo usa `scripts/eval-lectura.ts`.
 */

export const CAMPOS_EVAL = ["tipo", "agencia", "numero", "producto", "fechas", "pax", "vuelos"] as const;
export type CampoEval = (typeof CAMPOS_EVAL)[number];

export interface ProductoEsperado {
  nombre: string;
  codigo?: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

export interface VueloEsperado {
  numero: string;
  origen: string | null;
  destino: string | null;
  fecha_salida: string | null;
  hora_salida: string | null;
  fecha_llegada: string | null;
  hora_llegada: string | null;
}

export interface FichaEsperada {
  tipo_mail: TipoMail;
  agencia: string;
  /** El número limpio. */
  numero_reserva: string | null;
  productos: ProductoEsperado[];
  /** Fechas del viaje: solo se comparan si se esperan (no null). */
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  pax: number | null;
  vuelos: VueloEsperado[];
}

export interface ResultadoEval {
  campos: Record<CampoEval, boolean>;
  /** Qué no coincidió, para leer el reporte (sin datos de pasajeros). */
  diferencias: string[];
}

export function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mismoNombre(a: string, b: string): boolean {
  const x = normalizarNombre(a);
  const y = normalizarNombre(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 12 && (x.includes(y) || y.includes(x)));
}

export function compararFicha(esperada: FichaEsperada, obtenida: FichaLectura | null): ResultadoEval {
  const campos = Object.fromEntries(CAMPOS_EVAL.map((c) => [c, false])) as Record<CampoEval, boolean>;
  const diferencias: string[] = [];
  if (!obtenida) return { campos, diferencias: ["La lectura quedó para revisión: no hay ficha."] };

  const igual = (campo: CampoEval, esperado: unknown, obtenido: unknown, rotulo: string) => {
    campos[campo] = esperado === obtenido;
    if (!campos[campo]) diferencias.push(`${rotulo}: esperado ${String(esperado)}, salió ${String(obtenido)}.`);
  };
  igual("tipo", esperada.tipo_mail, obtenida.tipo_mail.valor, "Tipo de mail");
  igual("agencia", esperada.agencia, obtenida.agencia.valor, "Agencia");
  igual("numero", esperada.numero_reserva, obtenida.numero_reserva.limpio, "Número de reserva");
  igual("pax", esperada.pax, obtenida.pax.valor, "Pax");

  // Productos: cada esperado con uno obtenido (por código si se espera, si no por nombre).
  const usados = new Set<number>();
  const pares: Array<[ProductoEsperado, FichaLectura["productos"][number] | null]> = esperada.productos.map((p) => {
    const i = obtenida.productos.findIndex(
      (o, j) => !usados.has(j) && (p.codigo ? o.codigo === p.codigo : mismoNombre(p.nombre, o.nombre)),
    );
    if (i >= 0) usados.add(i);
    return [p, i >= 0 ? obtenida.productos[i] : null];
  });
  const faltantes = pares.filter(([, o]) => !o).map(([p]) => p.codigo ?? p.nombre);
  const sobrantes = obtenida.productos.filter((_, j) => !usados.has(j)).map((o) => o.codigo ?? o.nombre);
  campos.producto = faltantes.length === 0 && sobrantes.length === 0;
  if (faltantes.length) diferencias.push(`Productos que no salieron: ${faltantes.join("; ")}.`);
  if (sobrantes.length) diferencias.push(`Productos de más: ${sobrantes.join("; ")}.`);

  // Fechas: las de cada producto encontrado y las del viaje si se esperan.
  const fechasMal: string[] = [];
  for (const [p, o] of pares) {
    if (!o) {
      fechasMal.push(`${p.codigo ?? p.nombre}: no salió el producto`);
      continue;
    }
    if (o.fecha_inicio !== p.fecha_inicio) fechasMal.push(`${p.codigo ?? p.nombre} inicio ${p.fecha_inicio} → ${o.fecha_inicio}`);
    if (o.fecha_fin !== p.fecha_fin) fechasMal.push(`${p.codigo ?? p.nombre} fin ${p.fecha_fin} → ${o.fecha_fin}`);
  }
  if (esperada.fecha_inicio && obtenida.fecha_inicio.valor !== esperada.fecha_inicio) {
    fechasMal.push(`viaje inicio ${esperada.fecha_inicio} → ${obtenida.fecha_inicio.valor}`);
  }
  if (esperada.fecha_fin && obtenida.fecha_fin.valor !== esperada.fecha_fin) {
    fechasMal.push(`viaje fin ${esperada.fecha_fin} → ${obtenida.fecha_fin.valor}`);
  }
  campos.fechas = fechasMal.length === 0;
  if (fechasMal.length) diferencias.push(`Fechas: ${fechasMal.join("; ")}.`);

  // Vuelos: los mismos tramos, con todos sus datos exactos.
  const vuelosMal: string[] = [];
  const vuelosUsados = new Set<number>();
  for (const v of esperada.vuelos) {
    const i = obtenida.vuelos.findIndex((o, j) => !vuelosUsados.has(j) && o.numero === v.numero);
    if (i < 0) {
      vuelosMal.push(`${v.numero} no salió`);
      continue;
    }
    vuelosUsados.add(i);
    const o = obtenida.vuelos[i];
    for (const k of ["origen", "destino", "fecha_salida", "hora_salida", "fecha_llegada", "hora_llegada"] as const) {
      if (o[k] !== v[k]) vuelosMal.push(`${v.numero} ${k} ${v[k]} → ${o[k]}`);
    }
  }
  const vuelosDeMas = obtenida.vuelos.filter((_, j) => !vuelosUsados.has(j)).map((o) => o.numero ?? "(sin número)");
  if (vuelosDeMas.length) vuelosMal.push(`de más: ${vuelosDeMas.join(", ")}`);
  campos.vuelos = vuelosMal.length === 0;
  if (vuelosMal.length) diferencias.push(`Vuelos: ${vuelosMal.join("; ")}.`);

  return { campos, diferencias };
}

export function resumirEval(resultados: ResultadoEval[]): { porCampo: Record<CampoEval, number>; total: number } {
  const pct = (aciertos: number, total: number) => (total === 0 ? 0 : Math.round((aciertos / total) * 1000) / 10);
  const porCampo = Object.fromEntries(
    CAMPOS_EVAL.map((c) => [c, pct(resultados.filter((r) => r.campos[c]).length, resultados.length)]),
  ) as Record<CampoEval, number>;
  const aciertos = resultados.reduce((s, r) => s + CAMPOS_EVAL.filter((c) => r.campos[c]).length, 0);
  return { porCampo, total: pct(aciertos, resultados.length * CAMPOS_EVAL.length) };
}
