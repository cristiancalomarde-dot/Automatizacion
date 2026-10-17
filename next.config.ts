import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // M2-07: la lectura de sales@ lee en el servidor `data/*.csv` (agencias, códigos,
  // productos no cargados) y las instrucciones de la IA; Vercel tiene que subirlos
  // junto con la función del cron.
  outputFileTracingIncludes: {
    "/api/cron/leer-sales": ["./data/*.csv", "./src/lib/reservas/instrucciones/*.md"],
  },
};

export default nextConfig;
