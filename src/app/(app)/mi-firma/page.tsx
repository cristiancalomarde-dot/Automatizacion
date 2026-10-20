import { redirect } from "next/navigation";
import { MiFirmaPantalla } from "@/components/usuarios/mi-firma-pantalla";
import { nombreDeQuienFirma } from "@/lib/pedidos/pantalla";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leerNombreParaLaFirma } from "@/lib/usuarios/firma";

export const metadata = { title: "Mi nombre para la firma · HI Travel" };

/**
 * "Mi nombre para la firma" (spec M3-06 fila 1). Con sesión del equipo (el
 * proxy y el layout ya lo exigen; acá se vuelve a mirar porque el nombre de
 * Google y lo guardado salen de la sesión).
 */
export default async function MiFirmaPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=sesion_vencida");

  return <MiFirmaPantalla nombreGoogle={nombreDeQuienFirma(user)} guardado={await leerNombreParaLaFirma(supabase, user.id)} />;
}
