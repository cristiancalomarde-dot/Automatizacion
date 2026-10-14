import { DetalleReservaPantalla } from "@/components/reservas/detalle-reserva-pantalla";

export const metadata = { title: "Reserva · HI Travel" };

export default async function DetalleReservaPage({ params }: PageProps<"/reservas/[id]">) {
  const { id } = await params;
  return <DetalleReservaPantalla key={id} id={id} />;
}
