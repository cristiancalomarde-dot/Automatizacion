# M3-49 · Un mail con imágenes pesadas se lee igual

**Depende de:** M3-30 (imágenes en la lectura). Pedida por el owner el 2026-11-06, con su OK.

**El caso real:** `DK1595014` (Kilroy, `copenhagen@kilroy.dk`, 2026-11-05; mail `079d1e60-93a1-4304-818c-2d2a5b8969e8`,
reserva `a1c28d7d-1a99-42fd-a1ab-462472c28f9e`). Trae 3 imágenes pegadas en el cuerpo: una de 136.771 bytes bajo "Extra
Requests" y dos fotos de pasaporte de 3.386.877 y 3.707.515 bytes. Suman más que `MAX_BYTES_IMAGENES` (5 MB), y
`prepararMail` devuelve "mail demasiado grande" sin leer nada. La reserva quedó en "para revisión" sin producto, fechas
ni pax, aunque el texto lo dice todo: `HI_ARGENTINA_OD010D-677`, del 2 al 5 de abril de 2027, 2 pax, Double Room - Hostel.
Es el único mail así desde el 2026-10-01.

## 1. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Si las imágenes no entran** (más de `MAX_IMAGENES` o más de `MAX_BYTES_IMAGENES`), se dejan afuera las más pesadas hasta que entren, y el mail se lee igual. Una imagen que sola supera el tope también queda afuera | Unitario en `preparar-mail-imagenes.test.ts`: el caso de DK1595014 da `ok: true`; cae la de 3.707.515 bytes y viajan la de 136.771 y la de 3.386.877 (juntas entran en 5 MB). Corregido 2026-11-06: la ficha esperaba que no viajara ninguna pesada, y eso contradice la regla por peso; viajar un pasaporte es lo que ya pasaba con los mails bajo el tope. DK1598967 (5 PNG, ~7,2 MB): cae solo la de ~4 MB |
| 2 | **Las que quedan afuera se anotan** en `adjuntosNoLeidos`, igual que hoy las que no se leen, y la persona lo ve como hoy ve los adjuntos no leídos. La numeración `[imagen N]` sigue siendo la de las que viajan; la marca de una que no viaja no aparece en el cuerpo | Unitario: nombres en `adjuntosNoLeidos`, marcas del cuerpo 1..N sin huecos |
| 3 | **Lo que hoy entra no cambia:** mismas imágenes, mismo orden, mismo resultado. Los demás topes (caracteres, PDF, `TOPE_POR_MAIL_USD`) siguen cortando como hoy | Los tests de M3-30 siguen en verde sin tocar sus asserts, salvo los dos que comprobaban el corte que esta ficha saca ("más de 8 imágenes" y "una imagen de más de 5 MB" → "mail demasiado grande"): ahora la que sobra queda anotada y el mail se lee |
| 4 | **De punta a punta:** un mail de Kilroy como el de DK1595014 (texto real, imágenes falsas con esos tamaños) arma la reserva con OD010D, fechas y pax, con IA falsa | Integración en la base de pruebas |
| 5 | **En seco contra la real:** `npm run reprocesar:mail -- --uid <imap_uid del mail>` **sin `--aplicar`**, para ver qué haría con DK1595014. No escribe ni gasta IA. **No se corre con `--aplicar`**: eso lo decide el owner | Reporte con la salida |

## 2. Qué ve el usuario
Hoy, nada. Después de la carga, con OK del owner, DK1595014 vuelve a leerse: la reserva actual queda descartada (no se
borra) y entra una nueva con su tour, sus fechas y sus pax, **sin responsable** (alguien la vuelve a tomar).

## 3. Qué queda afuera
- Achicar las imágenes en lugar de dejarlas afuera.
- Detectar si una imagen es un pasaporte. Las fotos de pasaporte no hacen falta para los pedidos (los datos vienen en el
  texto) y es mejor que no viajen a la IA, pero la regla es por peso, no por contenido.
- Cambiar los topes.
