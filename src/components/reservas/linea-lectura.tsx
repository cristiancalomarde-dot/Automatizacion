import type { LineaLectura } from "@/lib/lectura-sales/estado";
import estilos from "./reservas.module.css";

/**
 * La línea de la última lectura de sales@ (spec M2-07 §4), arriba de la lista
 * de reservas. Llega armada desde el servidor (`page.tsx`); acá solo se
 * muestra. Nunca lleva remitentes, asuntos ni contenido de los mails.
 */
export function LineaLecturaSales({ linea }: { linea: LineaLectura }) {
  const [principal, ...resto] = linea.lineas;
  return (
    <div className={`${estilos.lineaLectura} ${estilos[`lineaLectura_${linea.tono}`] ?? ""}`} role="status" data-testid="linea-lectura" data-tono={linea.tono}>
      <span>{principal}</span>
      {resto.map((l) => (
        <span key={l} className={estilos.lineaLecturaDetalle}>
          {l}
        </span>
      ))}
    </div>
  );
}
