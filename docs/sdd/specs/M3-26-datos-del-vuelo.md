# M3-26 · Datos del vuelo completos y bien leídos

**Depende de:** M3-25. Pedida por el owner el 2026-10-27/28
(`docs/sdd/diagnosticos/M3-04-revision-owner.md`, "Generales" punto 5 y "Vuelos").

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Vuelo completo en el traslado:** cuando el traslado tiene vuelo, el pedido (y la tarea) muestran salida y llegada completas, no solo el lado que usa el traslado: "Vuelo: AR 1234 – sale Buenos Aires (AEP) 18 mar 08:30 hs – llega Puerto Iguazú (IGR) 18 mar 10:20 hs". Lo que falte del vuelo (aerolínea, hora, aeropuerto) se omite sin dejar huecos ni "null" | Unitario: vuelo con todos los datos; vuelo sin hora de salida; vuelo sin aeropuerto de origen |
| 2 | **Vuelo sin número también sirve:** Kilroy a veces escribe en "Extra Requests" solo aeropuerto, día y hora ("Pax will be arriving at IGU airport at 20FEB2027 at 16:45" / "Pax will be departing from IGR airport at 23FEB2027 at 13:30"). Al leer el mail esos renglones se guardan como vuelo **sin número** (reconocimiento fijo, sin IA, solo si la IA no trajo ya ese vuelo). El armado y el control de recepción lo toman para el traslado: "Llegada: Foz do Iguaçu (IGU) 20 feb 16:45 hs (sin número de vuelo)", sin "pendiente" | Unitario con el texto de DK1597924: lectura → 2 vuelos sin número; armado → TRF IN/OUT con llegada/salida y sin pendiente; control → sin "falta vuelo" |
| 2b | **Las reservas ya recibidas:** un script (`npm run` nuevo) recorre las reservas `recibida`/`para_revision` con vuelos vacíos, aplica el reconocimiento del #2 a su mail y **muestra** qué vuelos sumaría; solo con `--aplicar` los guarda (lo corre el owner, #4) | Integración en la base de prueba: sin `--aplicar` no cambia nada; con `--aplicar` guarda los dos vuelos |
| 3 | **Sin vuelo sigue igual:** si de verdad no hay vuelo, "Vuelo pendiente" (o "Bus o vuelo pendiente" en Iguazú) como hoy | Unitario |
| 4 | **Nada más cambia** | Recorridos M3 en verde (actualizar los que esperaban el renglón viejo, con nota "M3-26 (owner, 2026-10-28)") |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA nueva. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Armado: `traslado()` y `buscarVuelo()` en `src/lib/pedidos/armar.ts`; el control de recepción usa
  `hayVuelo()` / `lugarDelTraslado()` en `src/lib/reservas/emparejar/vuelos-requeridos.ts`. Los dos tienen
  que coincidir en qué vuelo sirve para cada traslado.
- Los nombres de ciudad del aeropuerto: `AEROPUERTOS` de `vuelos-requeridos.ts`.
- **Diagnóstico de la real (2026-10-28, owner con script de solo lectura):**
  - DK1597924 (OD010B): `vuelos = []`. El mail trae en "Extra Requests (transfers etc):" los dos renglones del #2,
    sin número de vuelo; la IA no los guardó y `buscarVuelo` / `hayVuelo` exigen `numero`.
  - DK1593775 (OD010A): el mail no trae ningún vuelo ("Extra Requests" vacío) y no hay otra reserva con ese
    número: "Bus o vuelo pendiente" es correcto. No se toca.
  - NO1595016: vuelo `LA383` con origen CJC y sin destino; sale bien.
- Lectura: `src/lib/reservas/limpiar-ficha.ts` (después de la IA); el esquema del vuelo ya admite `numero: null`.
  Un vuelo sin número no pasa por el chequeo "el número aparece en el mail".
- Corregir vuelos (M3-07, `corregir/vuelos.ts`) sigue pidiendo número: no se cambia en esta pieza.
