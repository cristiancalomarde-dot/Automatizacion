import { Suspense } from "react";
import { ListaReservasPantalla } from "@/components/reservas/lista-reservas-pantalla";
import { EsqueletoTabla } from "@/components/ui/estados";
import { lineaDeLaLectura } from "@/lib/lectura-sales/consulta-estado";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEXTOS } from "@/lib/textos";

export const metadata = { title: "Reservas · HI Travel" };
// La línea de la lectura de sales@ (M2-07) se arma en cada pedido, con la sesión.
export const dynamic = "force-dynamic";

// La lista lee `?prueba=1` (M2-06): sin Suspense, Next no puede armar la página de antemano.
export default async function ReservasPage() {
  const lineaLectura = await lineaDeLaLectura(await createSupabaseServerClient());
  return (
    <Suspense fallback={<EsqueletoTabla etiqueta={TEXTOS.reservas.cargando} columnas={7} />}>
      <ListaReservasPantalla lineaLectura={lineaLectura} />
    </Suspense>
  );
}
