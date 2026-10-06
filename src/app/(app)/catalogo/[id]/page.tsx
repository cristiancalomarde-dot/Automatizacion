import { DetalleProductoPantalla } from "@/components/catalogo/detalle-producto-pantalla";

export const metadata = { title: "Producto · HI Travel" };

export default async function DetalleProductoPage({ params }: PageProps<"/catalogo/[id]">) {
  const { id } = await params;
  return <DetalleProductoPantalla key={id} id={id} />;
}
