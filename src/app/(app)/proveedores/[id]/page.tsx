import { DetalleProveedorPantalla } from "@/components/catalogo/detalle-proveedor-pantalla";

export const metadata = { title: "Proveedor · HI Travel" };

export default async function DetalleProveedorPage({ params }: PageProps<"/proveedores/[id]">) {
  const { id } = await params;
  return <DetalleProveedorPantalla key={id} id={id} />;
}
