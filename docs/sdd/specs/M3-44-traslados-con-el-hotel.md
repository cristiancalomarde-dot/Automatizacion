# M3-44 · Todo traslado nombra el hotel; horario del Overland; Beer Hostel

**Depende de:** M3-42. Pedida por el owner el 2026-11-01 (segunda parte de la tercera ronda de M3-04,
`docs/sdd/diagnosticos/M3-04-revision-owner.md`).

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Todo traslado nombra el hotel.** En el renglón de cualquier traslado (texto del catálogo, del ajuste del tour o el armado de M3-25/M3-42), la palabra "accommodation" / "Accommodation" / "alojamiento" / "Alojamiento" (con su "en <ciudad>" / "in <ciudad>" o la ciudad delante: "La Paz Accommodation", "Accommodation in San Pedro de Atacama", "alojamiento en La Paz") se cambia por el nombre del hotel de la reserva en esa ciudad: el que entra la fecha del traslado de llegada / el que sale la fecha del de salida (misma búsqueda que M3-42; reusarla). Sin hotel que coincida, el texto queda como hoy. Vale para el pedido en portugués también | Unitarios: "Transfer SCL - accommodation" → "Transfer SCL - Hostal Providencia" (UK1598158, CL Mundo); "Transfer La Paz Airport - La Paz Accommodation" → "Transfer La Paz Airport - <hotel en La Paz>" (Imperio Inca); sin hotel, igual que hoy; M3-42 sigue igual |
| 2 | **Horario del Overland.** Si las excursiones del pedido son solo el Overland (UYUO01), el renglón de M3-34 dice "¿Nos confirman el horario de salida del Overland desde San Pedro de Atacama, por favor?". Con otras excursiones, el de hoy | Recorrido SPAP05 (Petzold) |
| 3 | **Beer Hostel.** `data/equivalencias-proveedores.csv`: "Tangoinn Bed & Brewery IGR" → "Beer Hostel". Script de un solo uso `scripts/renombrar-beer-hostel.ts` (en seco por defecto, `--aplicar` escribe) que renombra ese proveedor en el directorio de la base real; lo corre el owner. Tests y fixtures que dependan del nombre viejo se actualizan | Unitario del script con la base de pruebas; el importador de catálogo sigue encontrando el proveedor |
| 4 | **Nada más cambia** | Suite completa en verde |

## Reglas
- **#5** las 3 verificaciones. **#3** sin IA en los textos. **#4** nada a la base real (el script lo corre el owner).
