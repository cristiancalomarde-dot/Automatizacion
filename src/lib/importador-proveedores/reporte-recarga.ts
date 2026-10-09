import { contactoEnPalabras, type ComparacionDirectorio, type ProveedorBorrado } from "./cambios";
import { esSinMail } from "./importar";
import type { RegistroProveedor } from "./resolver";

/**
 * Reporte de la recarga del directorio para el owner (spec M1-07 §3 #11), en
 * llano: qué cambió (altas, bajas, movidos, renombrados, contactos) y lo que
 * no cierra (sin contacto, secciones duplicadas, el mismo nombre en más de una
 * ciudad). Es puro: recibe lo que devolvió la corrida y el directorio después
 * de la recarga.
 */

export interface DatosReporteRecarga {
  fecha: string;
  archivo: string;
  resumen: { procesados: number; insertados: number; actualizados: number };
  cambios: ComparacionDirectorio;
  borrados: ProveedorBorrado[];
  borradosQueVolvieron: RegistroProveedor[];
  /** El directorio después de la recarga. */
  directorio: Array<RegistroProveedor & { id: string }>;
  /** id de proveedor → códigos de producto que lo usan (Service Provider o Booking Supplier). */
  enUso: Map<string, string[]>;
}

function seccion(ciudad: string | null): string {
  return ciudad ?? "sin sección";
}

/** "EL CHALTEN" y "CHALTEN" son la misma sección escrita de dos formas. */
function claveSeccion(ciudad: string): string {
  return ciudad
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/^(EL|LA|LOS|LAS)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function reporteRecargaMarkdown(d: DatosReporteRecarga): string {
  const { cambios } = d;
  const out: string[] = [];
  out.push("# Recarga del directorio de proveedores (M1-07)", "");
  out.push(
    `Recargué el directorio desde **${d.archivo}** (${d.fecha}). Leí ${d.resumen.procesados} proveedores: ` +
      `${d.resumen.insertados} nuevos y ${d.resumen.actualizados} que ya estaban (con sus datos al día).`,
    "",
  );

  out.push("## Qué cambió", "");
  const hubo =
    cambios.altas.length + cambios.movidos.length + cambios.renombrados.length + cambios.cambiosContacto.length > 0;
  if (!hubo) out.push("- Nada: el Excel dice lo mismo que la base.");
  for (const a of cambios.altas) out.push(`- **Nuevo:** ${a.nombre} (${seccion(a.ciudad)}), ${contactoEnPalabras(a)}.`);
  for (const m of cambios.movidos) {
    out.push(`- **Cambió de sección:** ${m.nombre}, de ${seccion(m.antes)} a ${seccion(m.despues)}. Es el mismo proveedor: lo actualicé, no quedó repetido.`);
  }
  for (const r of cambios.renombrados) {
    out.push(`- **Cambió de nombre:** “${r.antes}” ahora es “${r.despues}” (${seccion(r.ciudad)}, mismo mail). Lo actualicé; los servicios que lo usaban siguen apuntándole.`);
  }
  for (const c of cambios.cambiosContacto) {
    out.push(`- **Cambió el contacto:** ${c.nombre} (${seccion(c.ciudad)}): antes ${c.antes}, ahora ${c.despues}.`);
  }
  out.push("");

  out.push("## Ya no están en el Excel", "");
  if (cambios.bajas.length === 0) {
    out.push("- Ninguno: todo lo que está en la base sigue en el Excel.");
  } else {
    out.push(
      `Estos ${cambios.bajas.length} están en la base pero ya no en el Excel. **No los borré** (un proveedor que sacás del Excel no se borra solo): decime cuáles borro. Los que dicen “en uso” los usa algún producto; antes de borrarlos hay que pasar esos servicios a otro proveedor.`,
      "",
    );
    const bajas = [...cambios.bajas].sort((a, b) => seccion(a.ciudad).localeCompare(seccion(b.ciudad)) || a.nombre.localeCompare(b.nombre));
    for (const b of bajas) {
      const uso = d.enUso.get(b.id) ?? [];
      out.push(`- [ ] ${b.nombre} (${seccion(b.ciudad)})${uso.length ? ` — **en uso** en ${uso.join(", ")}` : ""}`);
    }
  }
  out.push("");

  out.push("## Borrados con tu OK", "");
  for (const b of d.borrados) {
    const vueltos = d.borradosQueVolvieron.filter((r) => r.nombre_normalizado === b.nombreNormalizado);
    if (vueltos.length) {
      for (const v of vueltos) {
        out.push(`- [ ] **${b.nombre}** (${seccion(v.ciudad)}) volvió a aparecer en el Excel: no lo cargué. Si tiene que volver, sacalo de \`data/proveedores-borrados.csv\`.`);
      }
    } else {
      out.push(`- ${b.nombre}: no está en el Excel ni volvió a la base.`);
    }
  }
  out.push("");

  out.push("## Lo que no cierra", "");
  // Se mira lo que sigue en el Excel; las bajas ya están listadas arriba.
  const idsBaja = new Set(cambios.bajas.map((b) => b.id));
  const vigentes = d.directorio.filter((p) => !idsBaja.has(p.id));
  const sinContacto = vigentes.filter(esSinMail).sort((a, b) => seccion(a.ciudad).localeCompare(seccion(b.ciudad)) || a.nombre.localeCompare(b.nombre));
  out.push(`**Sin contacto (${sinContacto.length}):** no tienen mail ni WhatsApp en el Excel. Si alguno se usa en un producto, ese pedido no se puede mandar.`, "");
  for (const p of sinContacto) {
    const uso = d.enUso.get(p.id) ?? [];
    out.push(`- ${p.nombre} (${seccion(p.ciudad)})${uso.length ? ` — **en uso** en ${uso.join(", ")}` : ""}`);
  }
  out.push("");

  const secciones = new Map<string, Set<string>>();
  for (const p of d.directorio) {
    if (!p.ciudad) continue;
    const k = claveSeccion(p.ciudad);
    secciones.set(k, (secciones.get(k) ?? new Set()).add(p.ciudad));
  }
  const duplicadas = [...secciones.values()].filter((s) => s.size > 1).map((s) => [...s].sort());
  out.push("**Secciones duplicadas:** la misma ciudad escrita de dos formas, cada una con sus proveedores.", "");
  if (duplicadas.length === 0) out.push("- Ninguna.");
  for (const s of duplicadas) {
    const enExcel = s.filter((c) => vigentes.some((p) => p.ciudad === c));
    const soloBase = s.filter((c) => !enExcel.includes(c));
    if (enExcel.length > 0 && soloBase.length > 0) {
      for (const c of soloBase) {
        const deEsa = d.directorio.filter((p) => p.ciudad === c);
        const enUso = deEsa.filter((p) => (d.enUso.get(p.id) ?? []).length > 0).map((p) => p.nombre);
        out.push(
          `- La sección “${c}” ya no está en el Excel (quedó ${enExcel.map((x) => `“${x}”`).join(" y ")}), pero sus ${deEsa.length} proveedores siguen en la base: están en “Ya no están en el Excel”.${enUso.length ? ` En uso: ${enUso.join(", ")}.` : ""}`,
        );
      }
    } else {
      const cuenta = s.map((c) => `${d.directorio.filter((p) => p.ciudad === c).length} en “${c}”`).join(", ");
      out.push(`- ${s.map((c) => `“${c}”`).join(" y ")} (${cuenta}).`);
    }
  }
  out.push("");

  const porNombre = new Map<string, Array<RegistroProveedor & { id: string }>>();
  for (const p of vigentes) porNombre.set(p.nombre_normalizado, [...(porNombre.get(p.nombre_normalizado) ?? []), p]);
  const repetidos = [...porNombre.values()]
    .filter((ps) => new Set(ps.map((p) => p.ciudad)).size > 1)
    .filter((ps) => duplicadas.every((s) => !ps.every((p) => p.ciudad !== null && s.includes(p.ciudad))))
    .sort((a, b) => a[0].nombre.localeCompare(b[0].nombre));
  out.push("**El mismo nombre en más de una ciudad** (sin contar las secciones duplicadas): puede ser una cadena con un hotel por ciudad o un proveedor cargado en la sección equivocada.", "");
  if (repetidos.length === 0) out.push("- Ninguno.");
  for (const ps of repetidos) out.push(`- ${ps[0].nombre}: ${ps.map((p) => seccion(p.ciudad)).sort().join(", ")}.`);
  out.push("");

  return out.join("\n");
}
