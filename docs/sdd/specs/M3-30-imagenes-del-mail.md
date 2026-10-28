# M3-30 · Leer las imágenes del mail (Journaway Petzold, Kilroy)

**Depende de:** M2-09 (reservas de Journaway), M3-28. Pedida por el owner el 2026-10-28: la primera reserva
real de Journaway (mail "Program Booking / Client Petzold/ ID 66688059968", sales@ uid 16682, 28/10 08:34)
trae los hoteles y las actividades como **imágenes pegadas en el cuerpo** (`cid:`), y la app no las ve.
Kilroy a veces manda los datos de los pax (DOB, etc.) también en imagen.

## Lo que dice el mail (leído a mano el 2026-10-28, confirmado por el owner)
- Texto: Trip Number 65037, 17.05.27–07.06.27, 2 pax, 1 DBL; Night Bus Peru 31.05–01.06 (Double Seat nomeal);
  2 renglones "Shared Transport: CJC - Accom. San Pedro de Atacama" 22.05; pasajeros en alemán.
- Imagen 1 (bajo "hotels and night bus"): Tayka del Desierto 26–27.05, Tayka del Sal 27–28.05 (Standard
  fullboard DR), Night Bus Uyuni – La Paz 28–29.05 (Private Cabin nomeal DR).
- Imágenes 2 y 3 (bajo "activities"), **en alemán**: "Astronomie-Tour in der Atacama-Wüste" 22.05,
  "Tour durch das Mondtal" 23.05, "Tour zum Fluss Quepiaco, Monjes de la Pacana & den Salzwüsten" 24.05,
  "Tour zu den Tatio-Geysiren" 25.05 (**una fila por pax**: cada uno aparece 2 veces), "Ab San Pedro: Sol de
  Mañana Geysire, Licancabur Vulkan & Laguna Colorada" 26.05, "Siloli: Ganztägige Tour in die Siloli Wüste &
  zur schwarzen Lagune" 27.05, "Salar de Uyuni: Ganztägige Tour nach Uyuni" 28.05 (una fila cada uno).
- **Es una venta de SPAP05** (Trip D Option 1, "San Pedro de Atacama + Uyuni Salt Flats in Tayka Hotels
  7N/8D"), aunque Journaway lo mande desordenado y sin el nombre del paquete. Día 1 = 22.05.
- El hotel de San Pedro (22–26) lo reserva Journaway y nos lo comunica para los pick ups: no es un faltante.
- "FOC till weeks prior arrival": ignorar (es siempre 1 mes antes; no es dato de la reserva).

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Las imágenes del mail se guardan** (las pegadas en el cuerpo y las adjuntas), en el bucket privado de adjuntos como los PDF, y se pueden ver desde el detalle de la reserva | Integración: un mail con 3 imágenes `cid:` deja 3 archivos con ruta en `adjuntos` |
| 2 | **La IA lee las imágenes** de los mails de agencias conocidas, en el lugar del cuerpo donde estaban (el `cid:` se reemplaza por una marca "[imagen N]" para que la IA sepa bajo qué título va cada una). Owner 2026-10-28: se leen todas, aunque alguna sea un pasaporte. Se saltean las imágenes de firma/íconos externos (links http, no `cid:`) y las chiquitas (logos) | Unitario de `prepararMail`: 3 imágenes `cid:` viajan; los íconos http no |
| 3 | **Tope de gasto:** máximo de imágenes y de bytes por mail; las imágenes suman al peor caso estimado. Si se pasa, no se lee y queda "para revisión" con motivo, como hoy con un PDF grande | Unitario: un mail con imágenes de más da el motivo "grande" |
| 4 | **Los nombres en alemán de Journaway se reconocen sin IA:** los 7 de arriba se cargan en `data/journaway-nombres.csv` (SPAE01, SPAE03, SPAE05, SPAE04 y los 3 días de UYUO01) | Test de nombres: los 7 dan su código sin IA |
| 5 | **Una fila por pax no son dos tours:** dos renglones iguales (mismo servicio, mismas fechas) en un mail de Journaway con 2 pax cuentan como un servicio para 2 | Recorrido Petzold: un solo Astronomy Tour para 2 pax |
| 6 | **Petzold sale SPAP05:** con los nombres + Tayka + 4 noches en San Pedro, la reserva queda SPAP05 con día 1 = 22.05.2027 | Recorrido con el mail Petzold como fixture (pasajeros anonimizados, las 3 imágenes reales): sale SPAP05, 2 pax, 1 DBL, fechas de la tabla |
| 6b | **Lo que no es del paquete no se pide:** el "Night Bus Peru" (31.05–01.06) no es parte de SPAP05 (owner 2026-10-28: "debe ser un error o algo nuevo"). No se arma pedido para él; la reserva va a "para revisión" con el motivo "Journaway pide 'Night Bus Peru' (31.05–01.06), que no es parte de SPAP05: consultarlo con Journaway" | Recorrido Petzold: ningún pedido del bus Perú; motivo en la reserva |
| 7 | **Kilroy con pax en imagen:** misma lectura (no hace falta un ejemplo real para esta pieza; si el owner trae uno, se suma como caso) | Unitario: un mail de Kilroy con una imagen `cid:` la manda a la IA |
| 8 | **Reprocesar Petzold en la real:** comando de un solo uso que vuelve a bajar el mail uid 16682 de sales@ y lo pasa de nuevo por la lectura. Lo corre el owner con `!` | El owner ve en la reserva los hoteles y las actividades |
| 9 | **Nada más cambia** | Recorridos M2/M3 en verde |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** techo de gasto (tope por mail). **#4** nada a la base real ni a proveedores
  desde los tests. **#2** sin claves en el código.

## Anexo técnico
- Hoy `prepararMail` (`src/lib/reservas/preparar-mail.ts`) manda solo PDF y anota el resto en
  `adjuntosNoLeidos`; `guardarMail` (`src/lib/reservas/guardar.ts`) sube solo PDF. La IA recibe el PDF como
  bloque `document`; las imágenes van como bloques `image` (PNG/JPEG/GIF/WebP).
- La lectura de la casilla (`src/lib/lectura-sales/casilla.ts`, mailparser) ya trae las imágenes `cid:` como
  adjuntos con su `cid`: usarlo para ubicarlas en el cuerpo.
- Las 3 imágenes reales (solo servicios, sin datos personales) están en `tests/fixtures/journaway/petzold-imagenes/`
  (img1 = hoteles, img2 y img3 = actividades). El cuerpo del mail se arma anonimizado en el fixture.
