# M3-59 · Journaway: los tours en holandés y el traslado de Calama con el nombre del hotel

**Depende de:** M3-58. Pedida por el owner el 2026-11-19. Reserva real `68296867683` (`eb1da7a7-…`, mail uid 17455).

## 1. Qué pasó
- JW mandó un SPAP01 (All San Pedro 3n/4d) sin nuestros códigos y con los tours en holandés. La IA reconoció
  Maanvallei (SPAE03), Rainbow Valley (SPAE02) y Tatio-geisers (SPAE04), pero no "astronomietour in de
  Atacama-woestijn" (SPAE01).
- Los traslados vinieron con el hotel: "Shared Transport: CJC - Don Raúl" y "Shared Transport: Don Raúl - CJC" (los
  nombres cargados dicen "Accom. San Pedro de Atacama"). No se reconocieron; la reserva fue a revisión sin producto.
- Fuera del Tayka, un traslado escrito como renglón quedaba como reserva suelta en vez de sumarse al paquete.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Los 4 tours en holandés** en `data/journaway-nombres.csv` | Unitario: los 6 renglones de 68296867683 dan SPAP01 sin motivos y sin IA |
| 2 | **"Shared Transport: CJC - <hotel>" y "Shared Transport: <hotel> - CJC" son SPAT01:** `empieza_con` para la llegada y señal nueva `termina_con` para la salida | Unitario de señales; el mismo unitario de la fila 1 (los dos traslados = SPAT01) |
| 3 | **El traslado escrito como renglón va con el paquete que lo tiene** (también fuera del Tayka) | Unitario con `armarJournaway`: una sola pieza SPAP01 con SPAT01 el 8, SPAE01 el 8, SPAE02 y SPAE03 el 9, SPAE04 el 10 |
| 4 | **Lo que ya estaba no cambia** | Suite completa, de frente por tandas |

## 3. Qué queda afuera
- Releer el mail de 68296867683: con OK del owner, `reprocesar:mail -- --uid 17455 --aplicar` (suma los nombres nuevos a
  la base y lo lee de nuevo; centavos de IA).
