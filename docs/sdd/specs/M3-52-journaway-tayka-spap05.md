# M3-52 · Journaway: los Tayka salen SPAP05 aunque el mail varíe los nombres

**Depende de:** M3-30. Pedida por el owner el 2026-11-09. Reserva real de Journaway `66925083976` (id
`ffb7faeb-1521-40ae-9e2a-181dcbcb07cd`), 2 pax, 14 al 21/01/2027: entró "para revisión" sin producto y con la
sugerencia SPAP06; es SPAP05.

## 1. Qué pasó
- Journaway escribió tres renglones con palabras distintas a las cargadas: "Tour **of** the Moon Valley" (SPAE03),
  "Tour **of** the Tatio Geysers" (SPAE04) y "Sol de Mañana Geysers, Licancabur Volcano**, and** Laguna Colorada" (día 1
  del Overland, UYUO01). El reconocedor busca el nombre exacto (limpio): no los encontró.
- Sin el día 1, el arranque del Overland se contó desde Siloli (día 2), que en el mail venía un día corrido: 5 noches en
  San Pedro = SPAP06.
- El owner (2026-11-09): SPAP05 y SPAP06 solo se distinguen por un día libre en San Pedro (cambia fechas, no precio) y
  **casi siempre piden SPAP05**. Los comentarios del owner al resolver los motivos lo confirman (es SPAP05; el bus Uyuni
  - La Paz es parte del paquete).

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Las tres variantes en `data/journaway-nombres.csv`** (SPAE03, SPAE04, UYUO01) y el día 1 en `data/journaway-senales.csv` | Unitario: el mail de ejemplo SPAP05 con los tres nombres de 66925083976 da SPAP05 sin motivos |
| 2 | **Las noches se cuentan solo desde el día 1 del Overland** | Unitario: sin el día 1 y con Siloli corrido, no aparece SPAP06 ni un motivo de noches |
| 3 | **Sin el día 1 (y sin título N/D), la sugerencia es SPAP05**, el primero de la familia Tayka en las señales | El mismo unitario: la sugerencia es SPAP05 y el motivo dice "Falta el día 1 del Overland" |
| 4 | **Lo que ya estaba no cambia** | Suite completa, de frente por tandas |

## 3. En la real (no lo hace el builder)
Con OK del owner: `importar:journaway` (suma los 3 nombres a `codigo_externo`) y volver a leer el mail de 66925083976
(`reprocesar:mail -- --uid 17080`, primero en seco). La reserva actual pasa a "descartada" y entra una nueva.

## 4. Qué queda afuera
El selector de producto para las reservas de Journaway (el owner lo deja para después: Journaway va a mandar nuestros
códigos). Hacer tolerante la búsqueda por nombre (sinónimos, "&" = "and"): se siguen sumando las variantes al CSV.
