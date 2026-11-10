# M3-54 · Journaway: un código para un solo tour no se come los demás

**Depende de:** M3-53. Pedida por el owner el 2026-11-10. Reserva real de Journaway `67734240405` (id
`5a830d3a-8569-4707-a03b-a4d3fecb2b05`): entró "recibida" como FTEE05 entera, con 4 de sus 5 partes sin producto.

## 1. Qué pasó
- El mail trae un solo código nuestro, FTEE05 (El Chaltén), y la IA lo copió a los 5 renglones.
- El reconocedor (M2-09 fila 1) usa el código del mail primero. Como 4 tours no estaban por nombre, aplicó "manda el
  código, sin IA": toda la reserva quedó FTEE05 y no le preguntó a la IA por los demás.
- Los demás están en el catálogo: cataratas (IGRE01, por nombre), Perito Moreno (FTEE01), Chaltén (FTEE05), Laguna
  Esmeralda (USHE07) y el traslado del aeropuerto de Iguazú (IGRT01).
- Lo mismo pasó con `67697149819` (BUS02, 2 de 3 partes sin producto; ya pedida a mano) y `67720778908` (IGRE02, una
  parte).

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Con más tours que códigos en el mail**, cada tour se reconoce por su nombre y, si no está, la IA lo propone por cercanía (como sin código) | Unitario: el caso de 67734240405 da IGRE01, FTEE01, FTEE05, USHE07 e IGRT01, sin motivos |
| 2 | **Un tour que la IA no reconoce manda la reserva a revisión**; nunca todo como el código del mail | Unitario: IA sin confianza → revisión con "No se reconoce el tour…" |
| 3 | **El código del mail tiene que salir de algún tour**; si no, revisión con las dos versiones | Unitario: "El mail dice FTEE05, pero los tours dan …" |
| 5 | **Los nombres que confirmó el owner (2026-11-10):** Perito Moreno = FTEE01 y Chaltén = FTEE05 en `data/journaway-nombres.csv`; señal nueva `empieza_con`: "Shared Transfer: IGU - …" (con cualquier hotel) = IGRT01 | Unitarios: las señales leen `empieza_con`; el caso de 67734240405 (y con otro hotel) solo le pregunta a la IA por la Laguna Esmeralda |
| 4 | **Lo que ya estaba no cambia** (un tour con un código, todos conocidos por nombre, Tayka) | Suite completa, de frente por tandas |

## 3. En la real (no lo hace el builder)
Con OK del owner (2026-11-10), después de publicar: volver a leer el mail de 67734240405 (`reprocesar:mail`, primero en
seco). La reserva actual pasa a "descartada" y entran las nuevas.

Hecho (primera parte, `ac97736`): la relectura dejó la reserva para revisión; la IA no se animó con el Perito Moreno, el
Chaltén y el traslado de Iguazú. El owner confirmó los tres (fila 5). Después: `importar:journaway` (suma los 2 nombres)
y otra relectura, con su OK.

## 4. Qué queda afuera
- `67697149819` (ya pedida) y `67720778908`: se miran con el owner.
- La alarma de fechas del Overland en los Tayka (66925083976): anotada para después.
