# M3-26 · Datos del vuelo completos y bien leídos

**Depende de:** M3-25. Pedida por el owner el 2026-10-27/28
(`docs/sdd/diagnosticos/M3-04-revision-owner.md`, "Generales" punto 5 y "Vuelos").

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Vuelo completo en el traslado:** cuando el traslado tiene vuelo, el pedido (y la tarea) muestran salida y llegada completas, no solo el lado que usa el traslado: "Vuelo: AR 1234 – sale Buenos Aires (AEP) 18 mar 08:30 hs – llega Puerto Iguazú (IGR) 18 mar 10:20 hs". Lo que falte del vuelo (aerolínea, hora, aeropuerto) se omite sin dejar huecos ni "null" | Unitario: vuelo con todos los datos; vuelo sin hora de salida; vuelo sin aeropuerto de origen |
| 2 | **No decir "vuelo pendiente" si la agencia pasó el vuelo:** en DK1597924 y DK1593775 (Cuenca del Plata) el pedido y el cartel amarillo dicen que falta el vuelo aunque la reserva lo trae. Corregir la causa encontrada en el diagnóstico (ver Anexo) | Unitario/integración con una reserva armada como las del diagnóstico: el traslado sale con el vuelo y sin el pendiente; el control de recepción tampoco avisa "falta vuelo" |
| 3 | **Sin vuelo sigue igual:** si de verdad no hay vuelo, "Vuelo pendiente" (o "Bus o vuelo pendiente" en Iguazú) como hoy | Unitario |
| 4 | **Nada más cambia** | Recorridos M3 en verde (actualizar los que esperaban el renglón viejo, con nota "M3-26 (owner, 2026-10-28)") |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA nueva. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Armado: `traslado()` y `buscarVuelo()` en `src/lib/pedidos/armar.ts`; el control de recepción usa
  `hayVuelo()` / `lugarDelTraslado()` en `src/lib/reservas/emparejar/vuelos-requeridos.ts`. Los dos tienen
  que coincidir en qué vuelo sirve para cada traslado.
- Los nombres de ciudad del aeropuerto: `AEROPUERTOS` de `vuelos-requeridos.ts`.
- **Diagnóstico de la real (#2):** lo corre el owner (solo lectura) y se anota acá antes de construir.
