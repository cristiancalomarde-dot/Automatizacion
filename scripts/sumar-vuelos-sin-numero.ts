/**
 * Las reservas ya recibidas con el vuelo sin número de Kilroy (spec M3-26 fila 2b): recorre las
 * reservas `recibida` y `para_revision` con los vuelos vacíos, lee su mail con el reconocimiento
 * fijo de M3-26 ("Pax will be arriving at IGU airport at 20FEB2027 at 16:45"; sin IA, #3) y
 * muestra qué vuelos sumaría.
 *
 *   npm run sumar:vuelos-sin-numero              # solo muestra (no cambia nada)
 *   npm run sumar:vuelos-sin-numero -- --aplicar # los guarda y deja el historial
 *
 * Usa la base configurada en `.env.local` (como los importadores): lo corre el owner (#4).
 * Variables de entorno (#2): NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. No imprime
 * datos de pasajeros (#1): solo el número de reserva y los vuelos.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { renglonDelVuelo } from "@/lib/pedidos/renglon-vuelo";
import { vuelosSinNumeroDeLasGuardadas } from "@/lib/reservas/vuelos-sin-numero-guardadas";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  const aplicar = process.argv.slice(2).includes("--aplicar");

  const cliente = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { reservas, guardadas } = await vuelosSinNumeroDeLasGuardadas(cliente, { aplicar });

  if (reservas.length === 0) {
    console.log("No hay reservas recibidas o para revisión sin vuelos con un vuelo sin número en el mail.");
    return;
  }
  console.log(`${reservas.length} reserva(s) con vuelos sin número en el mail:`);
  for (const r of reservas) {
    console.log(`\n${r.bookingId ?? r.reservaId} (${r.estado})`);
    for (const v of r.vuelos) console.log(`  ${renglonDelVuelo(v)}`);
  }
  console.log(
    aplicar
      ? `\nGuardados: ${guardadas} de ${reservas.length}${guardadas < reservas.length ? " (las otras cambiaron mientras tanto: no se tocaron)" : ""}.`
      : "\nNo se guardó nada. Para guardarlos: npm run sumar:vuelos-sin-numero -- --aplicar",
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
