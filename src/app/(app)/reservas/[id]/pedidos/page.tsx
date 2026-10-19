import { redirect } from "next/navigation";
import { PedidosPantalla } from "@/components/pedidos/pedidos-pantalla";
import { configuracionDeEnvio, nombreDeQuienFirma } from "@/lib/pedidos/pantalla";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Pedidos a proveedores · HI Travel" };

/** M3-03: el envío habla con el correo; le damos tiempo (cada mail tiene su propio tiempo de espera). */
export const maxDuration = 60;

/**
 * Pedidos a proveedores de una reserva (spec M3-02). Con sesión del equipo
 * (el proxy y el layout ya lo exigen; acá se vuelve a mirar porque quien
 * firma sale de la sesión). El modo prueba y el CC se leen en el servidor.
 */
export default async function PedidosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=sesion_vencida");

  return <PedidosPantalla key={id} reservaId={id} firmante={nombreDeQuienFirma(user)} envio={configuracionDeEnvio(process.env)} />;
}
