# M3-21 · La habitación según los pax (hoteles sin tipo y carpa del W Trek)

**Depende de:** M3-18 (Standard con desayuno), M3-19 (alojamiento del W Trek). Pedida por el owner el 2026-10-23
(feedback de operaciones, últimas entradas: `docs/sdd/diagnosticos/feedback-operaciones-2026-10-23.md`).

## 1. Qué queremos lograr
Hay reservas que no dicen el tipo de habitación, solo el nivel ("Budget Hotel", "Hotel 3*"), y el pedido hoy sale
`Habitación: Budget Hotel, con desayuno`. El owner: **"Budget Hotel" NO es un tipo de habitación.** En un hotel es DBL
o SGL: **2 pax → DBL, 1 pax → SGL**, salvo que la reserva explique otra cosa (ej. "2 SGLs"), y hay que revisarlo con
el vendedor.

En el W Trek, una carpa sin cantidad ("Dormitory - Hostel and W-Trek Tent") con 2 pax es Tent DBL. Pero **con 1 pax
no se asume Tent SGL**: es mucho más caro que el Shared Dorm, así que solo va Tent SGL si la reserva lo pide para el
trek.

### Hoteles (pedidos de alojamiento, M3-18)

| Caso | Renglón |
|---|---|
| Hotel (Budget, Hotel 3*, Hotel 4*, Tayka del Overland privado…) sin tipo de habitación, **2 pax** | `Habitación: DBL Standard con desayuno` + aviso "La reserva no dice el tipo de habitación: va DBL por 2 pax. Revisalo con el vendedor." |
| Ídem, **1 pax** | `Habitación: SGL Standard con desayuno` + el mismo aviso (SGL por 1 pax) |
| Ídem, 3 o más pax, o pax desconocido | `Habitación: Standard con desayuno (tipo a confirmar)` + aviso (como hoy) |
| La reserva dice otra cosa explícita (ej. "2 SGLs", "2 single rooms", "twin") | Lo que dice: `2 SGL Standard con desayuno`, `TWIN Standard con desayuno`… |
| **Hostel** sin aclarar dorm / DBL / SGL | `Habitación: a confirmar (dorm / DBL / SGL), con desayuno` + aviso |
| Habitación con tipo (doble, single, dorm…) | Como hoy (M3-18) |

"Sin tipo" incluye la habitación vacía y la que solo dice el nivel ("Budget Hotel", "Hotel 3*", "Hostel").

### W Trek (M3-19)

| Caso | Renglón |
|---|---|
| Carpa con cantidad (tent + doble/twin; tent + single) | Como hoy: Tent DBL / Tent SGL |
| Carpa sin cantidad, **2 pax** | `Alojamiento en el trek: Tent DBL` |
| Carpa sin cantidad, **1 pax** | a confirmar + aviso ("1 pax: Tent SGL es mucho más caro que el Refugio Dorm; revisalo con el vendedor") |
| Dorm / refugio | Como hoy: Refugio Dorm a compartir |
| **Single que no menciona el trek** (ej. "Single Room - Hotel 3*") | **cambia**: hoy da Tent SGL → pasa a a confirmar + el aviso de 1 pax |
| Doble que no menciona el trek, 2 pax | Tent DBL (como hoy) |
| Resto | a confirmar + aviso (como hoy) |

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Las tablas de arriba, para hoteles y para el W Trek | Unitario: un caso por fila de cada tabla |
| 2 | El pax sale de la reserva (`pax`, o la cantidad de pasajeros si no viene) | Unitario |
| 3 | Vale dentro de los tours y en SPAP05 (Tayka) | Integración: SPAP05 con 2 pax → DBL + aviso; ARCH33 dorm + tent con 1 y 2 pax |
| 4 | Los avisos son internos (no van en el texto al proveedor) | Unitario |
| 5 | El Overland regular (`habitacionDelOverland`) y el hostel según la habitación (M3-11) no cambian | Suite existente en verde |
| 6 | Nada más cambia | Suite existente en verde |

## 3. Qué ve el usuario
Sin pantallas nuevas: los pedidos de hotel ya no dicen "Budget Hotel" como habitación, y los avisos piden revisar con
el vendedor cuando la app tuvo que deducir. "Volver a armar" actualiza los borradores sin editar.

## 4. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde. **#4:** no envía nada.

---

## Anexo técnico (para los agentes)
- `habitacionDelPedido()` y `alojamientoDelTrek()` en `src/lib/pedidos/formato.ts`; los usan `alojamiento()` y
  `otro()` en `src/lib/pedidos/armar.ts`. Hoy son funciones de la habitación sola: van a necesitar también el pax.
- Qué es "hotel" y qué es "hostel" para la regla: el nivel del servicio en el catálogo (Hostel / Budget Hotel /
  Hotel 3* …) o, si no está, el texto de la habitación. Elegí lo más simple y reportalo.
- No cambies `tipoDeHabitacion()` (lo usan M3-11 y las tareas).
- Los tests y `.env.pruebas.local` están en el clon `C:\Users\gs\dev\hi-travel-automatizacion` (hacé `git pull`
  primero; el origin es la carpeta de Drive). Después copiá los archivos tocados al árbol de Drive. Nunca la base real.
