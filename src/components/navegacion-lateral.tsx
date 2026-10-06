"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TEXTOS } from "@/lib/textos";
import styles from "./navegacion-lateral.module.css";

const T = TEXTOS.navegacion;

/**
 * Barra lateral fija (user-flow.md §2). "Reservas" se suma cuando exista la
 * Bandeja (M2); por ahora, las secciones de datos de M1.
 */
const SECCIONES = [
  { href: "/catalogo", texto: T.catalogo },
  { href: "/proveedores", texto: T.proveedores },
  { href: "/pendientes", texto: T.pendientes },
] as const;

export function NavegacionLateral() {
  const pathname = usePathname();
  return (
    <nav className={styles.lateral} aria-label={T.titulo}>
      <ul className={styles.lista}>
        {SECCIONES.map((s) => {
          const activa = pathname === s.href || pathname.startsWith(`${s.href}/`);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                className={`${styles.enlace} ${activa ? styles.activa : ""}`}
                aria-current={activa ? "page" : undefined}
              >
                {s.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
