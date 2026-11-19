# M3-61 · El City Tour de Buenos Aires se pide en versión clásica

**Depende de:** M3-60. Pedida por el owner el 2026-11-19 (pedido a Grupo Summa: "Half Day Buenos Aires City Tour", 2 pax,
inglés, Patios de San Telmo).

## 1. Qué pasa
Grupo Summa tiene el City Tour en dos versiones, clásica y premium. Si el pedido no aclara cuál, siempre preguntan.
Nosotros vendemos la clásica.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **El City Tour de OD018 y OD020** (que tienen el mismo servicio de Grupo Summa), solo o dentro de un tour, suma el renglón "Versión: clásica (no premium)" | Unitario en `armar.test.ts`: City Tour de OD018 lo lleva; el Tango Show de OD018 no |
| 2 | **Lo que ya estaba no cambia** | Suite de `src` por tandas y las integraciones que tocan OD018 y OD020, de a una |

## 3. Qué queda afuera
- El Bike Tour (La Bicicleta Naranja) y las otras excursiones de Buenos Aires: no tienen versión premium.
- Los pedidos ya enviados. Los borradores sin enviar toman el renglón con "Volver a armar".
