# M3-15 · Mendoza: Bodegas el día 1 y la excursión de día entero el día 2; Bike Tour con punto de encuentro

**Depende de:** M3-13 (opciones del pasajero). Pedida por el owner el 2026-10-22 al ver los pedidos de BRARCH26.

## 1. Qué queremos lograr
1. **Bike Tour (La Bicicleta Naranja, Buenos Aires):** no tiene pick up. El pedido no dice "Pick up …" sino
   **"Punto de encuentro: Pasaje Giuffra 370, San Telmo (el pasajero va directo)"**.
2. **Mendoza (OD019, suelto o en tours):** el bus llega de mañana.
   - **Bodegas half Day = día 1** de la estadía en Mendoza, **por la tarde** (~14:30).
   - **La excursión de día entero = día 2**: Alta Montaña, o Rafting (si lo eligió, M3-13), o Cabalgata (si en
     el futuro se agrega como opción).
   - Hoy salen "Fecha: a coordinar".

Hoy el servicio 5 de OD019 es un solo renglón "Bodegas half Day and Alta Montaña" (Huentata); con rafting se
renombra a "Bodegas half Day" y se agrega "Rafting" a Kahuak (`data/opciones-pasajero.csv`).

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Punto de encuentro como regla de datos (archivo en `data/`, con nota del owner): para el Bike Tour de OD018 reemplaza el renglón de pick up | Unitario: con bike, el pedido a La Bicicleta Naranja dice el punto de encuentro y no "Pick up"; el City Tour sigue con pick up en el hotel |
| 2 | OD019 sin elección: el pedido a Huentata lleva **Bodegas half Day: día 1 (tarde)** y **Alta Montaña: día 2**, cada una con su fecha | Unitario: llegada a Mendoza el 22 → Bodegas 22 (tarde), Alta Montaña 23 |
| 3 | OD019 con rafting: Huentata solo Bodegas el día 1 (tarde) y Kahuak Rafting el día 2 | Unitario |
| 4 | Vale dentro de los tours (BRARCH26, ARBR23, 5C01…) con el día contado desde el inicio del componente Mendoza | Unitario/integración: BRARCH26 |
| 5 | Las reglas viven en `data/` (p. ej. `dias-servicio.csv` / `opciones-pasajero.csv` o un archivo nuevo), sin casos especiales en código | Revisión del diff |
| 6 | Nada más cambia | Suite existente en verde |

## 3. Qué ve el usuario
Sin pantallas nuevas: los pedidos de Mendoza salen con fecha y el del Bike Tour con el punto de encuentro.
"Volver a armar" actualiza los borradores sin editar.

## 4. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde. **#4:** no envía nada.

---

## Anexo técnico (para los agentes)
- `data/dias-servicio.csv` va por (codigo, orden): el servicio 5 de OD019 junta Bodegas y Alta Montaña en un
  renglón, así que hace falta poder dar fecha por excursión (partir el renglón o una regla por nombre). Elegí lo
  más simple que deje la regla en datos.
- `pickUp()` y `excursion()` en `armar.ts`; `opciones-pasajero.csv` / `eleccionesDe` / `agregarElegido` (M3-13);
  no romper M3-11/12/13/14.
- Base de pruebas: `.env.pruebas.local`. Nunca la real.
