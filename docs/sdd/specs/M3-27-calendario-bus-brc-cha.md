# M3-27 · Calendario del bus Bariloche ↔ El Chaltén

**Depende de:** M3-24 (avisos del itinerario). Pedida por el owner el 2026-10-27; el dato completo llegó el
2026-10-29: `Insumos/Calendario_Buses_BRC_CHA_Nov2026_Feb2027.xlsx` (hoja "Calendario diario", una fila por día
con SI/NO por sentido, y hoja "Reglas y notas").

Hoy `data/dias-bus.csv` tiene BRC → CHA y CHA → BRC **sin días** ("no avisa"). Con el calendario, el aviso
amarillo "Revisar antes de pedir" de M3-24 tiene que avisar cuando un tramo Bariloche ↔ El Chaltén de una reserva
cae en un día que ese bus no sale.

## El dato (del Excel, tal cual; owner 2026-10-29: "dejalo como está")
- **CHA → BRC** (sale 21:00, llega al día siguiente 22:20): 1, 4, 7 y 10/11; 12/11 y día por medio hasta el 30/11;
  desde el 1/12 todos los días hasta el 28/02/2027.
- **BRC → CHA** (sale 08:30, llega al día siguiente 10:30): 3, 6, 9 y 12/11; 14/11 y día por medio hasta el 30/11;
  desde el 2/12 todos los días hasta el 28/02/2027.
- El 12/11 desde CHA y el 14/11 desde BRC quedan como salidas (el Excel decía "confirmar"; el owner lo deja así).
- **Cobertura:** salidas del 1/11/2026 al 28/02/2027.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **El calendario en un CSV** que el owner pueda leer y ampliar (ej. `data/salidas-bus.csv`: origen, destino, desde, hasta, regla —fechas sueltas / todos los días—, nota con la fuente), con las salidas de arriba. Las reglas por día de la semana de `dias-bus.csv` (RGL ↔ USH, PUQ ↔ USH) siguen igual | Unitario: el CSV real da exactamente las fechas SI del Excel para los dos sentidos (comparar contra las 120 filas del Excel, 1/11 a 28/02) |
| 2 | **Aviso si el bus no sale ese día:** "El bus Bariloche → El Chaltén cae el lun 2 nov 2026 y ese día no sale (sale 3, 6, 9 nov…)." — en el mismo bloque amarillo y con el mismo estilo que el aviso de RGL → USH de M3-24 | Unitario: BRC → CHA el 2/11/2026 avisa; el 3/11 no avisa; el 15/12 no avisa (diario); CHA → BRC el 2/11 avisa, el 1/11 no |
| 3 | **Fuera de la cobertura:** un tramo BRC ↔ CHA después del 28/02/2027 (o antes del 1/11/2026) avisa "Calendario del bus Bariloche ↔ El Chaltén sin cargar para el <fecha>: confirmar con Chalten Travel." | Unitario: BRC → CHA el 5/03/2027 da ese aviso |
| 4 | **El CSV viaja a producción** (`outputFileTracingIncludes`; mirar el `.nft.json` de reservas/[id] y reservas/[id]/pedidos) | Build: los `.nft.json` incluyen el CSV |
| 5 | **Nada más cambia:** los demás avisos de M3-24 y los pedidos quedan iguales | Recorridos M3-24/M3-25 en verde |

## Recorrido
AR10 (o la reserva de AR34/ARCH31 que tenga BRC ↔ CHA) en la base de pruebas: con una fecha que cae en día sin
bus aparece el aviso en el detalle; corriendo la fecha a un día con salida, el aviso desaparece.

## Qué queda afuera
- Poner el horario del bus en el pedido a Chalten Travel (hoy el pedido no lo lleva; si el owner lo quiere, pieza
  aparte).
- Otros buses con calendario por fechas.

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- El aviso de buses de M3-24: `src/lib/pedidos/itinerario.ts` / `itinerario-reserva.ts` / `revision.ts`, carga en
  `cargar.ts` y `guardar.ts` (todos leen `data/dias-bus.csv`).
- Leer el Excel con `xlsx` (ya en node_modules) solo para generar/validar el CSV en el test; la app lee el CSV.
