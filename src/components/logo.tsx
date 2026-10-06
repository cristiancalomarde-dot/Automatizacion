import Image from "next/image";
import { TEXTOS } from "@/lib/textos";

/** Proporción del logo recortado (public/marca/logo-hi-travel.png, 377×160). */
const PROPORCION = 377 / 160;

/**
 * Logo real de HI Travel (marca.md §4): sin recolorear, sin estirar, sin
 * sombra, siempre sobre fondo claro (las letras "hi" son transparentes).
 * `unoptimized`: el PNG ya está recortado y liviano (14 KB); se sirve tal cual.
 */
export function Logo({ alto, className }: { alto: number; className?: string }) {
  return (
    <Image
      src="/marca/logo-hi-travel.png"
      alt={TEXTOS.app.logoAlt}
      width={Math.round(alto * PROPORCION)}
      height={alto}
      priority
      unoptimized
      className={className}
    />
  );
}
