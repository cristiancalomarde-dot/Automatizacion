import { Suspense } from "react";
import { ListaReservasPantalla } from "@/components/reservas/lista-reservas-pantalla";
import { EsqueletoTabla } from "@/components/ui/estados";
import { TEXTOS } from "@/lib/textos";

export const metadata = { title: "Reservas · HI Travel" };

// La lista lee `?prueba=1` (M2-06): sin Suspense, Next no puede armar la página de antemano.
export default function ReservasPage() {
  return (
    <Suspense fallback={<EsqueletoTabla etiqueta={TEXTOS.reservas.cargando} columnas={7} />}>
      <ListaReservasPantalla />
    </Suspense>
  );
}
