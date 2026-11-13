# M3-56 · El Overland se pide siempre en español

**Depende de:** M3-55. Pedida por el owner el 2026-11-13. Reserva real `DK1597513`.

## 1. Qué pasó
- El pedido a Imperio Inca de DK1597513 dice para el Overland San Pedro de Atacama to Uyuni (regular, dorm): servicio
  "tour regular", idioma **inglés**.
- El owner (2026-11-13): "el Overland regular o el que es en privado NUNCA es en inglés. Guía en inglés se pide aparte
  como opcional en todos los casos."
- Causa: `excursion()` en `src/lib/pedidos/armar.ts` pone inglés por defecto y solo pasa a español si la descripción
  coincide con `EN_ESPANOL` ("habla hispana", "sin guía en inglés"). El Overland privado de Journaway (UYUO01) lo dice;
  el regular del catálogo no.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Toda excursión con "Overland" en el nombre o la descripción sale en español**, regular o privada, en cualquier idioma de mail (castellano, portugués, inglés) | Unitario: Overland regular sin "habla hispana" en la descripción → idioma español |
| 2 | **El Overland privado sigue en español** | Unitario existente (UYUO01) sigue en verde |
| 3 | **Las demás excursiones no cambian** (siguen en inglés por defecto) | Unitario: una excursión común sin señal → inglés |
| 4 | **Lo que ya estaba no cambia** | Suite completa, de frente por tandas |

## 3. Qué queda afuera
- Pedir el guía en inglés como opcional (lo hace operaciones a mano si el pax lo compró).
- Rearmar el pedido de DK1597513: lo hace el owner desde la pantalla ("Volver a armar"), después de publicar.
