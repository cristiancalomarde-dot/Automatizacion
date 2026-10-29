# M3-41 · El pick up del Overland es el hotel de San Pedro

**Depende de:** M3-38. Confirmado por el owner el 2026-10-29 (Petzold, ID 66688059968, SPAP05).

Hoy, en SPAP05/SPAP06, el renglón del Overland en el pedido a Imperio Inca dice "Pick up: Tayka del Desierto
(Uyuni) · hotel a confirmar" (sale del renglón UYUO01 del mail de Journaway: "Pick up / Drop off: Tayka del
Desierto Hotel"). Está mal: el Tayka es la primera noche del Overland, no donde lo buscan. El owner: **el pick up
es en San Pedro, en el hotel que reserva Journaway y nos confirma** (suele ser Don Raul, a veces Our Habitas
Atacama). Nunca se inventa: si la reserva no lo trae, queda a confirmar.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **El pick up del Overland (UYUO01) nunca es un hotel Tayka.** Se toma el hotel de San Pedro de la reserva: el pick up que trae Journaway para las excursiones/traslado de San Pedro (ej. "Our Habitas Atacama") o el alojamiento en San Pedro de la noche anterior al Overland | Unitario: SPAP05 con excursiones de San Pedro con pick up "Our Habitas Atacama" → "Pick up: Our Habitas Atacama"; ningún "Tayka" en la línea del pick up |
| 2 | **Si no se sabe el hotel de San Pedro** (Petzold: el mail no lo trae), el renglón dice "Pick up: hotel en San Pedro de Atacama a confirmar (lo informa Journaway)" y queda el pendiente de alojamiento como hoy (se le avisa al proveedor que se lo pasamos) | Unitario con el fixture Petzold: ese texto exacto + el pendiente |
| 3 | **En el detalle de la reserva**, el pick up del Overland sigue la misma regla (no muestra el Tayka como pick up) | Unitario/pantalla del detalle con SPAP05 |
| 4 | **No se adivina:** Don Raul / Our Habitas solo salen si están en la reserva | Unitario: sin hotel de San Pedro no aparece ningún nombre de hotel |
| 5 | **Nada más cambia:** las noches en los Tayka siguen en sus renglones de alojamiento; M3-38 (Hito Cajón dentro del Overland, siempre regular) igual; CHB31 y el resto de los pick ups igual | Recorridos M2-09/M3 en verde |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Pick up: `pickUp()` en `src/lib/pedidos/armar.ts` (usa `b.pickUp` si la agencia lo mandó; ahí entra el Tayka).
  Señal `hotel_tayka` en `data/journaway-senales.csv`; respuesta de ejemplo
  `src/lib/reservas/__fixtures__/respuestas/journaway-spap05.json`; fixture `tests/fixtures/journaway/petzold.ts`.
- La reserva Petzold real (d9fecf93…) ya está guardada: el arreglo es en el armado, no hace falta reprocesar.
