import { redirect } from "next/navigation";

/** El inicio es la lista de reservas (spec M2-05 #1): lo que el equipo entra a mirar todos los días. */
export default function InicioPage() {
  redirect("/reservas");
}
