# M3-57 · Journaway: un Overland en Taykas es siempre SPAP05 o SPAP06

**Depende de:** M3-56. Pedida por el owner el 2026-11-17. Reserva real `68032580478` (`01694eac-…`).

## 1. Qué pasó
- El mail de 68032580478 trae el SPAP05 completo, pero con nombres que no estaban cargados:
  "…Licancabur Volcano & Laguna Colorada **Tour**", "Siloli: Full-**D**ay Tour to the Siloli Desert & Black Lagoon",
  "Salar de Uyuni: Full-**D**ay Tour to Uyuni", "San Pedro de Atacama: **El Tatio Geysers Tour**",
  "San Pedro de Atacama: **Quepiaco River, Monjes de la Pacana & Salt Flats Tour**", "San Pedro de Atacama: Moon Valley Tour".
- Los Tayka y el bus se reconocieron (`parte_de` → UYUO01), así que `armarTayka` eligió SPAP05, pero con 8 motivos
  ("Falta el día 1/2 del Overland", "Falta SPAE05/SPAE04", "… no es parte de SPAP05"). Fue a revisión **sin producto**
  (SPAP05 solo como sugerencia).
- El owner resolvió los 8 motivos ("es claramente un SPAP05"). La reserva quedó recibida sin producto y
  `componentesDe` (sin paquete) dejó cada renglón como una parte suelta: el pedido a Imperio Inca salió con 4 Overland,
  6 Tayka y 4 buses. (La reserva ya se corrigió a mano el 2026-11-17 con el pedido del owner.)
- La regla del owner (2026-11-17): **"SIEMPRE que esté un pedido de un Overland en Taykas, el producto es SPAP05 o
  SPAP06 (si tiene un día libre en San Pedro)"**, y el hotel informado para los tours en San Pedro (Horizonte) es el
  mismo pick up del Overland privado con Tayka. JW manda los pedidos partidos y con nombres que cambian.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **En un mail Tayka, cada tour se reconoce por una palabra clave**, no por el nombre exacto: señal nueva `clave_tayka` en `data/journaway-senales.csv` (texto normalizado contenido en el nombre → código y, para el Overland, día). Filas mínimas: `sol de manana` → UYUO01 día 1 (también `sol de manana geysire`, alemán), `siloli` → UYUO01 día 2, `tour to uyuni` y `tour nach uyuni` → UYUO01 día 3, `astronom` → SPAE01, `moon valley` → SPAE03, `quepiaco` → SPAE05, `tatio` → SPAE04. Solo aplica cuando `esTayka` es verdadero (en otros mails no cambia nada); el nombre exacto sigue ganando si está cargado | Unitario con los 12 renglones de 68032580478 (los de `datos_extraidos.productos`, vuelo LA392 a CJC el 23): sale **SPAP05, sin motivos**, las 7 partes del paquete con fechas 23 (SPAT01, SPAE01), 24 SPAE03, 25 SPAE05, 26 SPAE04, 27 SPAT02, UYUO01 27→30 |
| 2 | **Un Tayka nunca queda sin producto:** si `armarTayka` elige paquete (por noches, título o SPAP05 por defecto), la reserva lleva ese producto y su paquete aunque queden motivos para revisar (los motivos siguen, la reserva sigue en revisión). Así las partes salen del paquete (un solo Overland) y no renglón por renglón | Unitario: un mail Tayka con un renglón que no se reconoce (el "Night Bus Peru" de Petzold) → producto SPAP05, el motivo "… no es parte de SPAP05" sigue, las partes son las del paquete |
| 3 | **SPAP06 si hay un día libre en San Pedro:** se mantiene la regla por noches (4 = SPAP05, 5 = SPAP06) con el día 1 reconocido por palabra clave | Unitario: el mismo mail de 68032580478 con el Overland corrido un día (llegada 23, Sol de Mañana el 28) → SPAP06 |
| 4 | **Pick up del Overland = el hotel de San Pedro:** el pedido a Imperio Inca lleva de pick up el mismo hotel que el pedido a Horizonte (el hotel de la agencia en San Pedro) | Unitario de armado de pedidos con la reserva de la fila 1 y hotel "Don Raúl" 23→27: Overland "Pick up: Don Raúl", un solo Overland, 2 Tayka, 1 bus |
| 5 | **Lo que ya estaba no cambia** (Petzold, 66925083976, los mails de ejemplo SPAP05) | Suite completa, de frente por tandas |

## 3. Qué queda afuera
- Que al resolver los motivos de una reserva sin producto se tome sola la sugerencia (otra pieza, si hace falta).
- Releer el mail de 68032580478: ya se corrigió a mano.
