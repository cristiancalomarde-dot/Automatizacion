/**
 * Destino del paquete → ciudad del proveedor en el directorio (spec M1-04d
 * §3 #2). Sirve solo para desempatar un nombre REPETIDO en el directorio
 * (ej. dos "Rumbo sur": Ushuaia y Calafate): se elige el de la ciudad del
 * destino. Las ciudades son las que usa el Excel de proveedores
 * (`proveedor.ciudad`, M1-03); los destinos, los de `data/paquetes-piloto.csv`.
 */
export const CIUDADES_POR_DESTINO: Record<string, string[]> = {
  IGR: ["IGUAZU", "FOZ DO IGUAZU"],
  FTE: ["CALAFATE"],
  USH: ["USHUAIA"],
  CHA: ["EL CHALTEN", "CHALTEN"],
  PNT: ["PUERTO NATALES"],
  BUE: ["BUENOS AIRES"],
  MDZ: ["MENDOZA"],
  PMY: ["PUERTO MADRYN"],
  SCL: ["SANTIAGO"],
  VLP: ["VALPARAISO"],
  SPA: ["SAN PEDRO DE ATACAMA"],
  UYU: ["BOLIVIA"],
  LPB: ["BOLIVIA"],
  RIO: ["BRASIL"],
  SAO: ["SAO PAULO"],
};

export interface CandidatoProveedor {
  id: string;
  ciudad?: string | null;
  mails?: string[] | null;
  canal?: string | null;
  telefono?: string | null;
}

function contacto(p: CandidatoProveedor): string {
  return JSON.stringify([[...(p.mails ?? [])].map((m) => m.toLowerCase()).sort(), p.canal ?? null, p.telefono ?? null]);
}

/**
 * Entre varios proveedores con el mismo nombre, el del destino:
 * 1. uno solo → ese;
 * 2. varios → los de la ciudad del destino; si queda uno, ese;
 * 3. si siguen siendo varios (o ninguno es de la ciudad) pero todos tienen
 *    el MISMO contacto (mails, canal y teléfono), son el mismo proveedor
 *    cargado dos veces en el Excel (ej. "CHALTEN" y "EL CHALTEN"): el pedido
 *    sale igual al mismo lugar, así que se toma el primero (por la ciudad del
 *    destino, en orden) y se informa;
 * 4. si no, no se elige ninguno (null): nunca se adivina.
 */
export function elegirPorDestino<T extends CandidatoProveedor>(
  candidatos: T[],
  destino: string | null | undefined,
): { elegido: T | null; duplicadoMismoContacto: boolean } {
  if (candidatos.length === 1) return { elegido: candidatos[0], duplicadoMismoContacto: false };
  if (candidatos.length === 0 || !destino) return { elegido: null, duplicadoMismoContacto: false };
  const ciudades = CIUDADES_POR_DESTINO[destino] ?? [];
  const posicion = (p: T) => {
    const i = ciudades.indexOf((p.ciudad ?? "").trim().toUpperCase());
    return i === -1 ? ciudades.length : i;
  };
  const enCiudad = candidatos.filter((p) => posicion(p) < ciudades.length);
  if (enCiudad.length === 1) return { elegido: enCiudad[0], duplicadoMismoContacto: false };
  const grupo = enCiudad.length > 0 ? enCiudad : candidatos;
  if (new Set(grupo.map(contacto)).size === 1) {
    const [primero] = [...grupo].sort((a, b) => posicion(a) - posicion(b) || a.id.localeCompare(b.id));
    return { elegido: primero, duplicadoMismoContacto: true };
  }
  return { elegido: null, duplicadoMismoContacto: false };
}
