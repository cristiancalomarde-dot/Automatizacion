# M3-45 · Aviso de traslado nocturno (Cuenca del Plata, Iguazú)

**Depende de:** M3-24 (avisos "Revisar antes de pedir"). Pedida por el owner el 2026-11-01 (DK1592913). Regla del
catálogo de Cuenca del Plata: "Transfer In o Transfer Out realizados desde las 21 hs. hasta las 07 hs. se realizan
únicamente en forma privada y se confirma con las tarifas en privado."

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **La regla en un CSV** (`data/traslados-nocturnos.csv`: proveedor, desde, hasta, nota) con Cuenca del Plata, 21:00 a 07:00. El owner suma proveedores | El CSV existe |
| 2 | **Aviso** en el bloque amarillo "Revisar antes de pedir" (detalle y pedidos), mismo estilo que M3-24: si un traslado de llegada de ese proveedor tiene vuelo con hora de llegada entre 21:00 y 07:00 (o uno de salida con hora de salida en ese rango): "Traslado nocturno (vuelo AR1234, llega 22:40): Cuenca del Plata lo hace solo en privado, con tarifa privada. Confirmar con la agencia antes de pedir." | Unitarios: llega 22:40 avisa; 07:00 avisa; 07:01 no; 20:59 no; sale 05:30 avisa; vuelo sin hora o pendiente no avisa; otro proveedor no avisa |
| 3 | **Viaja a producción** (`outputFileTracingIncludes` en las rutas de reservas/[id] y pedidos) | Build |
| 4 | **Nada más cambia** | Recorridos M3-24 en verde |

## Qué queda afuera
- Cambiar solo el servicio a privado o recalcular tarifas.

## Reglas
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Avisos: `src/lib/pedidos/itinerario.ts` / `itinerario-reserva.ts` / `revision.ts`. Vuelos: `horaLlegada` / `horaSalida`
  (`src/lib/reservas/tipos.ts`).
