import { redirect } from "next/navigation";

/** Hasta que exista la Bandeja de reservas (M2), el inicio es el Catálogo. */
export default function InicioPage() {
  redirect("/catalogo");
}
