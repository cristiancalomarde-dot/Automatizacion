import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // M2-07: la lectura de sales@ lee en el servidor `data/*.csv` (agencias, códigos,
  // productos no cargados) y las instrucciones de la IA; Vercel tiene que subirlos
  // junto con la función del cron.
  outputFileTracingIncludes: {
    "/api/cron/leer-sales": ["./data/*.csv", "./src/lib/reservas/instrucciones/*.md"],
    // M3-08: el filtro por agencia de la lista lee data/agencias.csv en la server action.
    "/reservas": ["./data/agencias.csv"],
    // M3-11/M3-13: armar los pedidos lee data/*.csv (días, hostels, opciones del pasajero) y la plantilla del pedido.
    "/reservas/[id]": ["./data/*.csv", "./data/plantillas/*.md"],
    "/reservas/[id]/pedidos": ["./data/*.csv", "./data/plantillas/*.md"],
  },
};

export default nextConfig;
