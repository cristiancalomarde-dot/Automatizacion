# M3-35 · Alojamientos que no ofrecen desayuno

**Depende de:** M3-18, M3-21. Pedida por el staff vía el owner el 2026-10-28.

Hoy todo pedido de alojamiento dice "con desayuno" (M3-18: "DBL Standard con desayuno", "dorm compartido, con
desayuno", "a confirmar (dorm / DBL / SGL), con desayuno"…). Hay alojamientos que no lo ofrecen.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Lista de excepciones en un CSV** (`data/alojamientos-sin-desayuno.csv`: alojamiento, nota con fuente), con los 3 confirmados por el owner: **San Pedro Backpackers** (en el catálogo también "Backpacker San Pedro Hostel"), **Puma House**, **Bambu Hostel** (Foz; en el catálogo "Bambu", "Bambu Foz", "Bambu hostel", "Bambu Hostel Foz"). El owner suma después hostels de Brasil editando el CSV | El CSV existe con los 3 y su nota |
| 2 | **En esos alojamientos el pedido no dice "con desayuno"** en ninguna de las variantes de M3-18/M3-21 (ej. "DBL Standard", "dorm compartido", "a confirmar (dorm / DBL / SGL)"). El resto sigue igual | Unitario: Puma House 2 pax → "DBL Standard"; Bambu hostel sin tipo → "a confirmar (dorm / DBL / SGL)"; un hotel cualquiera sigue "DBL Standard con desayuno" |
| 3 | **El reconocimiento tolera las variantes del nombre** (mayúsculas, acentos, "Foz", "Hostel/Hostal") sin agarrar otro alojamiento por error | Unitario con las variantes del catálogo de arriba |
| 4 | **El CSV viaja a producción** (`outputFileTracingIncludes` en `next.config.ts`, ver nota de Vercel en PROGRESS: mirar el `.nft.json` de la ruta de pedidos) | Build: el `.nft.json` de la ruta de pedidos incluye el CSV |
| 5 | **Nada más cambia** | Recorridos M3 en verde |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Texto de la habitación: `src/lib/pedidos/formato.ts` (~línea 133, `con desayuno`). Tests de referencia:
  `standard-con-desayuno-m3-18.test.ts`, `habitacion-segun-pax-m3-21.test.ts`.
