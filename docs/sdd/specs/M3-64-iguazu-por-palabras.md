# M3-64 · Iguazú por sus palabras (Journaway)

**Depende de:** M3-63. Pedida por el owner el 2026-11-27, después de la reserva Journaway `63041086872` (mail uid 17693).
Journaway todavía no manda nuestros códigos y cambia cómo escribe el lado argentino en cada mail. Ya van tres formas:
"…Argentinean side of Iguazú Falls", "…Argentine Iguazú Falls" (67306527407) y "…Argentine side of the Iguazu Falls"
(63041086872). Cada una entraba sin producto hasta que se cargaba a mano.

## 1. Qué pasa
Una señal nueva, `palabras`, en `data/journaway-senales.csv`: si el nombre del renglón tiene todas las palabras, es ese
producto. Va después del nombre exacto y de las otras señales, y antes de la IA.
- **IGRE01:** "igua" + "argentin" + alguna de falls/side/seite/wasserf/catarata/lado/kant/waterval.
- **IGRE02:** lo mismo, con "brazil|brasil".
- En los dos casos, el nombre **no** tiene que decir transfer/transport/shuttle/traslado/package/paket/paquete/pakket.
- Si coinciden los dos lados, no vale ninguno y decide la IA.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Reconoce el lado argentino** en inglés, alemán y portugués, sin IA | `senales.test.ts` y `reconocer.test.ts` (M3-64) |
| 2 | **Reconoce el lado brasileño** | Ídem |
| 3 | **No toca traslados, paquetes, los dos lados juntos ni otros tours** | Casos de "no es ninguno" en `senales.test.ts`; "los dos lados" va a la IA |
| 4 | **Un IGRE01 que dice half-day lleva la nota de half-day** (fila `nota_tour,Half-day`) | `reconocer.test.ts` |
| 5 | **Una fila mal escrita frena con su número** | `senales.test.ts` |
| 6 | **Lo que ya estaba no cambia** | Suite de `src` por tandas; integraciones de Journaway, de a una |

## 3. Qué queda afuera
- Otros destinos: se suman filas `palabras` cuando Journaway cambie otro nombre.
