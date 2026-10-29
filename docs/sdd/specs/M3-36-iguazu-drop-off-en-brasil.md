# M3-36 · Iguazú combinado: el día del cruce a Brasil, drop off en el hotel de Brasil

**Depende de:** M3-12. Pedida por el owner el 2026-10-28 (staff, reserva DK1593147).

M3-12 ya resolvió el cruce **Brasil → Argentina** (OD010D): la excursión del día del cruce sale "Pick up: <hotel de
Foz> · Drop off: <hotel de Puerto Iguazú>" y el aviso "Ese día cruzan: el drop off es en el hotel de Argentina."
(`tests/recorrido-m3-12.integration.test.ts`). Falta el cruce al revés, **Argentina → Brasil** (DK1593147): la
excursión del lado brasilero del día del cruce tiene que decir **"Pick up: Beer Hostel (Puerto Iguazú) · Drop off:
Bambu Hostel (Foz do Iguaçu)"** (el staff lo escribió "Pick up Beer Hotel, drop off Bambu Hostel"), en la reserva y
en el pedido a Cuenca del Plata.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Paquete combinado Argentina → Brasil:** el día del cruce, la excursión (la del lado brasilero) lleva "Pick up: <hotel de la noche anterior en Argentina> · Drop off: <hotel de esa noche en Brasil>", con "· hotel a confirmar" como hoy cuando corresponde | Unitario y recorrido con el combinado AR → BR (el producto de DK1593147; ver en el catálogo cuál de OD010A-D/OD011 es) con Beer Hostel y Bambu Hostel: el renglón exacto |
| 2 | **El aviso del cruce dice el país correcto:** "Ese día cruzan: el drop off es en el hotel de Brasil." (para BR → AR sigue "de Argentina") | Unitario de los dos sentidos |
| 3 | **TRF IN / TRF OUT y la otra excursión** con el hotel de su noche, como en M3-12 (TRF IN: drop off en Beer; TRF OUT: pick up en Bambu) | Recorrido: los 4 renglones del pedido a Cuenca |
| 4 | **En el detalle de la reserva** la excursión del cruce muestra el mismo pick up / drop off | Pantalla/unitario del detalle |
| 5 | **Nada más cambia:** OD010D (BR → AR), los paquetes de un solo país, el 105 Premium y el resto de los pedidos quedan iguales; el pedido a Bambu sigue en el idioma de hoy (el portugués es M3-32) | Recorridos M3-12/M3-14/M3-28 en verde |

## Antes de construir
- Mirar la reserva DK1593147 en la base real **solo lectura** (o en el mail) para confirmar el producto, las fechas y
  qué día cruza; si el caso no es AR → BR como se describe acá, parar y reportarlo.

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- `paqueteConTraslados()` y `estadiaDe()` en `src/lib/pedidos/armar.ts` (hotel de cada renglón de M3-12); el aviso
  del cruce está en `src/lib/textos/index.ts`.
