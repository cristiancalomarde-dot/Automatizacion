# M3-43 · Teléfono y pasaporte del pasajero en el pedido

**Depende de:** M3-42. Pedida por el owner el 2026-11-01 (tercera ronda de M3-04; operaciones: Cuenca del Plata y
Horizonte Atacama necesitan el teléfono para ubicar al pasajero en destino; UK1595157, Journaway 67141036449).

Hoy la línea del pax ya sabe mostrar "Pasaporte: …" y "Teléfono: …" (`formato.ts`), pero la ficha que lee el mail
no saca ni el pasaporte ni el teléfono de cada pasajero, y el teléfono de contacto de Journaway no llega a la línea.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **La ficha lee pasaporte y teléfono** de cada pasajero cuando están en el cuerpo del mail (no de adjuntos ni fotos). Si no están, null; nunca inventados | Unitario del esquema/validación con un mail de ejemplo con y sin los datos (IA falsa) |
| 2 | **Journaway:** el teléfono del contacto del pasajero principal (`contactoCliente.telefono`) va como teléfono del PAX 1 si no tiene otro | Unitario |
| 3 | **El pasaporte va siempre que esté** (en todo pedido, como hoy "Pasaporte: pendiente" cuando falta) | Unitario |
| 4 | **El teléfono va solo a los proveedores que lo piden:** lista en `data/proveedores-con-telefono.csv` (proveedor, nota): Cuenca del Plata, Horizonte Atacama. El owner suma más editando el CSV. Viaja a producción (`outputFileTracingIncludes`) | Unitario: Cuenca y Horizonte con "Teléfono: …"; otro proveedor sin el teléfono; build con el CSV en el `.nft.json` de pedidos |
| 5 | **Las reservas ya leídas** no se releen: toman el dato solo las nuevas (o las que el equipo reprocese) | — |
| 6 | **Nada más cambia** | Suite completa en verde |

## Reglas
- **#5** las 3 verificaciones. **#3** la IA solo extrae; el texto del pedido es fijo. **#4** nada a la base real
  ni a proveedores. Los datos de pasajeros nunca en logs ni en el chat.

## Anexo técnico
- Esquema de la ficha: `src/lib/reservas/esquema-ficha.ts` (pasajeros: nombre, apellido, nacionalidad,
  fecha_nacimiento). Línea del pax: `formato.ts` (~l. 245). Journaway: `src/lib/reservas/journaway/cuerpo.ts`.
- Si la columna de pasajeros es jsonb no hace falta migración; si hiciera falta, la corre el owner.
