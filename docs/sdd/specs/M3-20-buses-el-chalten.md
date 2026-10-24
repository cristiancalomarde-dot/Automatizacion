# M3-20 · Buses de El Chaltén: renglones claros, horario por defecto y aviso de vuelo tarde

**Depende de:** M1-08 (traslados según el tour), M3-10 (AR34). Pedida por el owner el 2026-10-23 (feedback de
operaciones, DK1594177 y DK1592913: `docs/sdd/diagnosticos/feedback-operaciones-2026-10-23.md`).

## 1. Qué queremos lograr
Entre el aeropuerto de El Calafate (FTE) y El Chaltén (CHA) **no hay traslado**: hay un bus regular (Chalten Travel)
del aeropuerto a la terminal de El Chaltén, cuyo horario depende del vuelo; si no combinan, la opción 2 es el shuttle
de Las Lengas. La vuelta El Chaltén → El Calafate es un bus público que **por defecto sale a las 8 am** (se cambia a
mano si el pasajero lo pide).

Hoy salen así:

- **DK1594177 (AR34)**, un solo renglón que confunde:
  `2) Regular Bus Round Trip FTE Airport - CHA - FTE city / Desde: 5 mar 2027 · Hasta: 10 mar 2027`
- **DK1592913 (ARCH31, OD033)**:
  `2) Traslado de llegada: Transfer El Calafate Airport to El Chalten / Fecha: 10 mar 2027 / Vuelo: AR1840 (FTE) llegada 08:40 hs`
  y `3) Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station / Fecha: 13 mar 2027` (sin horario).

Tienen que salir así:

```
2) Bus regular El Calafate Airport → El Chaltén (terminal)
   Fecha: 5 mar 2027 · Horario: según la llegada del vuelo
   Vuelo: AR1840 (FTE) llegada 08:40 hs          ← si lo hay; si no, el pendiente del vuelo como hoy
3) Bus regular El Chaltén → El Calafate (ciudad)
   Fecha: 10 mar 2027 · Horario: 8:00 am
```

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | AR34: el "Round Trip FTE Airport - CHA - FTE city" sale en **dos renglones**, cada uno con su fecha (ida = llegada a El Chaltén, vuelta = salida de El Chaltén), como en el ejemplo | Unitario con las fechas de DK1594177 (5 y 10 mar) |
| 2 | OD033 (suelto y en ARCH31/ARCH33/ARCH33EXP): la llegada desde el aeropuerto FTE a El Chaltén deja de decir "Traslado de llegada: Transfer…" y sale como **Bus regular El Calafate Airport → El Chaltén (terminal)**, horario según el vuelo, con el vuelo si lo hay | Unitario con DK1592913 (10 mar, AR1840 08:40) |
| 3 | Bus El Chaltén → El Calafate (público o el tramo de vuelta del round trip): **Horario: 8:00 am** por defecto | Unitario: OD033 13 mar → "Horario: 8:00 am"; AR34 vuelta 10 mar → "8:00 am" |
| 4 | **Vuelo que llega a FTE después de las 17:00** con bus a El Chaltén: **aviso interno** en la reserva/borrador (no en el texto al proveedor): "El vuelo llega después de las 17 hs: puede no haber bus a El Chaltén. Revisalo con el vendedor de la agencia (traslado privado, más caro; o shuttle de Las Lengas)." | Unitario: llegada 18:30 → aviso; 08:40 → sin aviso; sin vuelo → sin este aviso |
| 5 | Las reglas (horario por defecto, hora límite 17:00, textos) viven en `data/` (archivo nuevo o uno existente como `traslados-tour.csv`/`transfers-tour.csv`), con nota del owner | Revisión del diff |
| 6 | Nada más cambia (otros traslados, otros buses, el resto de AR34/ARCH31) | Suite existente en verde |

## 3. Qué ve el usuario
Sin pantallas nuevas: los pedidos a Chalten Travel salen con renglones claros y horario, y el borrador avisa si el
vuelo llega tarde. "Volver a armar" actualiza los borradores sin editar.

## 4. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde. **#4:** no envía nada.

---

## Anexo técnico (para los agentes)
- Mirá cómo se arman hoy: el round trip de AR34 sale por `otro()` (Desde/Hasta) en `src/lib/pedidos/armar.ts`; el
  "Traslado de llegada" por la lógica de traslados (M1-08: `data/traslados-tour.csv`, `data/transfers-tour.csv`);
  el public bus por `bus()`. Encontrá el punto mínimo para cada uno.
- La fecha de la vuelta del round trip: el día de salida del componente El Chaltén (no el fin del paquete AR34).
  Ojo: en M3-10 quedó anotado que el bus ida y vuelta de AR34 salía "día 1 a día 6" y la vuelta es el día 4 —
  verificá con el catálogo cuál es la fecha correcta (la salida de El Chaltén) y reportalo.
- El vuelo de llegada ya se lee hoy para el traslado (renglón "Vuelo: …"). Reusá eso para el aviso de las 17 hs.
- Los avisos internos ya existen (`avisos` del armado): el de las 17 hs va ahí, no en `renglones`.
- Los tests y `.env.pruebas.local` están en el clon `C:\Users\gs\dev\hi-travel-automatizacion` (hacé `git pull`
  primero; el origin es la carpeta de Drive). Después copiá los archivos tocados al árbol de Drive. Nunca la base real.
