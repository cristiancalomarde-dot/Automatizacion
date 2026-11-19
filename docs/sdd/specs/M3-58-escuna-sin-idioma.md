# M3-58 · El paseo en escuna se pide sin idioma

**Depende de:** M3-57. Pedida por el owner el 2026-11-19. Reserva real `UK1594935` (también DK1598967 y 1397791).

## 1. Qué pasó
- El pedido a Paraty Tours dice para "Excursion Scuna Netuno 10.30 hs Islas paradisiacas": "Serviço: regular · Idioma: inglês".
- El owner (2026-11-19): no es un tour guiado, es un paseo en escuna (barco) por las islas; el idioma es un servicio que
  no se da en esos paseos y no hay que pedirlo.
- Causa: `excursion()` en `src/lib/pedidos/armar.ts` pone el idioma a toda excursión (inglés por defecto).

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **La excursión con "escuna", "scuna" o "schooner" en el nombre o la descripción sale sin idioma** ("Servicio: regular") | Unitario: Scuna Netuno → sin "Idioma:" |
| 2 | **Las demás excursiones no cambian** | Unitarios de M3-56 en verde |
| 3 | **Lo que ya estaba no cambia** | Suite completa, de frente por tandas |

## 3. Qué queda afuera
- Los pedidos ya enviados (UK1594935, DK1598967). El borrador de 1397791 lo rearma el owner ("Volver a armar").
