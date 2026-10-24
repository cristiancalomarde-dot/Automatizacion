# M3-18 · Alojamiento: habitación Standard con desayuno

**Depende de:** M3-01 (borradores de pedido). Pedida por el owner el 2026-10-23 (feedback de operaciones, G2:
`docs/sdd/diagnosticos/feedback-operaciones-2026-10-23.md`).

## 1. Qué queremos lograr
En los hoteles suele haber upgrades a habitaciones superiores que no pedimos. Hay que estandarizar el pedido para
que no dé lugar a eso, y aclarar siempre que el alojamiento (hotel u hostel) es **con desayuno**. La mayoría ya lo
incluye, pero conviene decirlo.

Hoy el renglón dice, por ejemplo, `Habitación: doble`. Tiene que decir:

| Habitación de la reserva | Renglón nuevo |
|---|---|
| doble / matrimonial | `Habitación: DBL Standard con desayuno` |
| twin | `Habitación: TWIN Standard con desayuno` |
| single | `Habitación: SGL Standard con desayuno` |
| triple | `Habitación: TPL Standard con desayuno` |
| dorm compartido (y "viajan juntos") | `Habitación: dorm compartido, con desayuno` (y "(viajan juntos)" como hoy) |
| otra cosa que no se reconoce | lo de hoy + `, con desayuno` |
| sin habitación en la reserva | `Habitación: Standard con desayuno (tipo a confirmar)` y, si hoy no avisa, un aviso para completarla |

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | El renglón de habitación de **los pedidos de alojamiento** (hoteles, hostels, Budget) sale como en la tabla | Unitario: un caso por fila de la tabla |
| 2 | Vale también dentro de los tours y en los pedidos de Iguazú/Puerto Natales que ya eligen hotel u hostel (M3-11, M3-12, M3-14) | Unitario/integración: un tour (ej. BRARCH26 o ARCH31) |
| 3 | **No** cambia lo que no es alojamiento de hotel/hostel: el Overland de Uyuni (`habitacionDelOverland`), el W Trek (refugios/carpas, va en otra pieza), excursiones, traslados | Suite existente en verde + un test que lo deje fijo para el Overland |
| 4 | El texto para la tarea interna (`queParaTarea`) puede quedar como hoy (es interno) | Revisión del diff |
| 5 | Nada más cambia | Suite existente en verde |

## 3. Qué ve el usuario
Sin pantallas nuevas: el renglón de habitación de los pedidos de alojamiento cambia. "Volver a armar" actualiza los
borradores sin editar.

## 4. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde. **#4:** no envía nada.

---

## Anexo técnico (para los agentes)
- El renglón sale de `alojamiento()` en `src/lib/pedidos/armar.ts` (`Habitación: ${tipoDeHabitacion(...)}`) y
  `tipoDeHabitacion()` en `src/lib/pedidos/formato.ts`. Buscá si hay otro lugar que arme `Habitación:` para
  alojamientos (hay uno en `otro()` para el Overland: ese NO cambia).
- Ojo con quién más usa `tipoDeHabitacion` (tareas, hostel según habitación M3-11): no cambies su resultado si lo
  usan para decidir; armá el texto del pedido aparte.
- Los tests y `.env.pruebas.local` están en el clon `C:\Users\gs\dev\hi-travel-automatizacion` (hacé `git pull`
  primero; el origin es la carpeta de Drive). Después copiá los archivos tocados al árbol de Drive. Nunca la base real.
