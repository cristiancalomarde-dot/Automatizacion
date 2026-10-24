# M3-19 · W Trek: el pedido dice el tipo de alojamiento

**Depende de:** M3-10 (CH11), M3-18 (renglón de habitación). Pedida por el owner el 2026-10-23 (feedback de
operaciones, DK1594177: `docs/sdd/diagnosticos/feedback-operaciones-2026-10-23.md`).

## 1. Qué queremos lograr
El pedido del W Trek (a Las Torres; CH10, CH11, también dentro de ARCH33/ARCH33EXP) sale hoy sin tipo de
alojamiento. Ej. DK1594177 (CH11), habitación de la reserva "Double Room - Hostel and W-Trek Tent":

```
W Trek Express
Desde: 1 mar 2027 · Hasta: 4 mar 2027
```

Las opciones del W Trek son tres: **Refugio Dorm a compartir · Tent DBL · Tent SGL**. El pedido tiene que decir cuál.

| Habitación de la reserva | Renglón en el pedido del W Trek |
|---|---|
| dice tent/carpa + doble/twin/matrimonial (ej. "Double Room - Hostel and W-Trek Tent") | `Alojamiento en el trek: Tent DBL` |
| dice tent/carpa + single | `Alojamiento en el trek: Tent SGL` |
| dorm / refugio / shared (ej. "Dormitory - Hostel", "Refugio") | `Alojamiento en el trek: Refugio Dorm a compartir` |
| doble/single **sin** mencionar tent ni refugio | Tent DBL / Tent SGL según la habitación (es la única opción privada del trek) |
| no se puede saber (sin habitación, triple, otra cosa) | `Alojamiento en el trek: a confirmar (Refugio Dorm a compartir / Tent DBL / Tent SGL)` + aviso para completarlo |

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | El pedido del W Trek (cualquier servicio W Trek: Standard, Express) lleva el renglón según la tabla | Unitario: un caso por fila |
| 2 | Vale dentro de los tours (ARCH33, ARCH33EXP) y en CH10/CH11 sueltos | Unitario/integración: CH11 con la habitación de DK1594177 → Tent DBL |
| 3 | Los alojamientos de Puerto Natales del mismo paquete siguen como hoy (M3-11, M3-18) | Suite existente en verde |
| 4 | Nada más cambia (Overland, excursiones, traslados) | Suite existente en verde |

## 3. Qué ve el usuario
Sin pantallas nuevas: el pedido del W Trek dice el tipo de alojamiento. "Volver a armar" actualiza los borradores sin
editar.

## 4. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde. **#4:** no envía nada.

---

## Anexo técnico (para los agentes)
- El W Trek es un servicio de tipo "otro" (`otro()` en `src/lib/pedidos/armar.ts`), como el Overland, que ya agrega
  su renglón de habitación con `habitacionDelOverland()` (`formato.ts`). Seguir el mismo patrón: una función pura
  en `formato.ts` (ej. `alojamientoDelTrek`) y el renglón en `otro()` cuando el nombre es W Trek.
- La habitación viene en `this.reserva.habitacion` (texto libre de la agencia). Si el texto trae dos partes
  ("Hostel and W-Trek Tent"), la parte del trek manda para este renglón.
- Los tests y `.env.pruebas.local` están en el clon `C:\Users\gs\dev\hi-travel-automatizacion` (hacé `git pull`
  primero; el origin es la carpeta de Drive). Después copiá los archivos tocados al árbol de Drive. Nunca la base real.
