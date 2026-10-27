# M3-25 · Correcciones de la revisión de AR10 y Greeters por sistema

**Depende de:** M3-23 (AR10), M3-20 (buses de El Chaltén), M3-10 (reglas de traslados por tour).
Pedida por el owner el 2026-10-27 en la segunda revisión de M3-04 (`docs/sdd/diagnosticos/M3-04-revision-owner.md`, puntos 1-4 y 6).

## 1. Qué queremos lograr
Que los pedidos de una AR10 salgan como los pediría una operativa, y que Greeters deje de recibir mails.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **AR10 / OD027 (Salta):** el traslado de La Ciénaga es solo de llegada (aeropuerto SLA → alojamiento); el tour sigue en bus | Unitario: el pedido a La Ciénaga de una AR10 dice solo el traslado in |
| 2 | **AR10 / OD022 (Ushuaia):** el traslado es solo de salida (alojamiento → aeropuerto USH); llega en bus | Unitario: el pedido del traslado de una AR10 dice solo el out |
| 3 | **Beagle "sin transfer":** si el renglón dice sin transfer, no lleva datos de pick up (hotel/horario de recogida) | Unitario con el Beagle de OD022 |
| 4 | **Buses de Chalten Travel:** en AR10 los tramos Bariloche → El Chaltén y El Chaltén → El Calafate (y sus inversos donde aparezcan) se piden a Chalten Travel, dentro del mismo mail del OD033 | Unitario: el borrador a Chalten Travel de una AR10 lleva los buses con fecha |
| 5 | **Greeters manual:** Greeters reserva por su sistema: sus servicios quedan como tarea manual (sin mail), como Kupos / COT online, con su nota | Unitario/integración: un pedido con Greeters no genera mail y queda en la lista manual |
| 6 | **Nada más cambia** | Recorridos M3 existentes en verde (actualizar solo los que esperaban Greeters por mail, con nota) |

## 3. Qué queda afuera
- Mostrar el vuelo completo (punto 5 de la revisión): va en M3-26.
- Los días del bus Bariloche ↔ El Chaltén (timetable pendiente; M3-24 lo carga como fila).

## 4. Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Reglas en CSV con nota del owner: `data/traslados-tour.csv` (acciones existentes: anular, reemplazar,
  invertir, solo_llegada; si hace falta "solo_salida", agregarla), `data/tramos-con-proveedor.csv`,
  `data/equivalencias-proveedores.csv` (canal `manual`).
- Si Greeters manual requiere recargar equivalencias/paquetes en la real, dejarlo dicho (lo corre el owner).
