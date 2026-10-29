# M3-34 · Pedir que reconfirmen el horario de las excursiones

**Depende de:** M3-28. Pedida por el staff vía el owner el 2026-10-28.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Todo pedido que incluye al menos una excursión** lleva el renglón "¿Nos confirman el horario de las excursiones, por favor?", después del bloque de servicios y antes de los datos de los pasajeros. Incluye los pedidos que mezclan excursiones con alojamiento o traslados (ej. Cuenca del Plata, Paquete 105 Premium: "especialmente" ahí, owner) | Unitario: pedido a Cuenca con OD010A/OD010B tiene el renglón entre el bloque del paquete y los pax |
| 2 | **Singular con una sola excursión:** "¿Nos confirman el horario de la excursión, por favor?" | Unitario: pedido con 1 excursión → singular; con 2 o más → plural |
| 3 | **Sin excursiones, sin renglón:** pedidos solo de alojamiento, traslados o buses no cambian | Unitario: pedido solo de hotel y pedido solo de transfer no lo tienen |
| 4 | **Nada más cambia** | Recorridos M3 en verde (actualizar los que comparan el cuerpo del pedido entero, con nota) |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Cuerpo del pedido: `src/lib/pedidos/armar.ts` / `cuerpo.ts` y la plantilla `data/plantillas/pedido-proveedor.md`
  (el texto del renglón va en la plantilla o en `src/lib/textos`, no suelto en el código).
- Qué es una excursión: usar el tipo de servicio que ya distingue el armado (no inventar una lista nueva).
