# M3-16 · El asunto del pedido sin códigos internos

**Depende de:** M3-01 (borradores de pedido), M3-09 (pedido a mano). Pedida por el owner el 2026-10-23 (feedback de
operaciones, G1: `docs/sdd/diagnosticos/feedback-operaciones-2026-10-23.md`).

## 1. Qué queremos lograr
Hoy el asunto de cada pedido es `Reserva {{pasajero}} x{{pax}} · {{producto}}{{referencia}}`, por ejemplo
"Reserva John Smith x2 · AR34 · Ref. DK1594177". El booking code de Kilroy, Jysk y Journaway (la referencia) es
interno entre HI Travel y el cliente y **no se le comparte al proveedor**; el código del tour (AR34, ARCH31…) tampoco
le sirve. El nombre del pasajero sí.

Asunto nuevo (owner, 2026-10-23): **`Solicitud de reserva – <pasajero principal> – <fechas>`**, por ejemplo
"Solicitud de reserva – John Smith – 5 al 10 mar 2027".

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | `data/plantillas/pedido-proveedor.md`: el asunto pasa a `Solicitud de reserva – {{pasajero}} – {{fechas}}`; la nota de la plantilla explica `{{fechas}}` y ya no ofrece `{{producto}}`/`{{referencia}}` para el asunto | Unitario: el asunto armado no contiene el código del producto ni el número de reserva de la agencia |
| 2 | `{{fechas}}` = del primer al último día de los servicios **de ese pedido** (no de toda la reserva), en el formato corto que ya usan los pedidos (`rangoCorto` / `fechaCorta` de `formato.ts`); un solo día → esa fecha | Unitario: pedido con servicios del 5 y del 10 mar → "5 al 10 mar 2027" (o el formato de `rangoCorto`); uno solo del 13 → "13 mar 2027" |
| 3 | Sin ninguna fecha conocida en el pedido → el asunto queda `Solicitud de reserva – <pasajero>` (sin guion colgando) | Unitario |
| 4 | Pedido a mano (M3-09): mismo formato, con las fechas de la reserva si las hay; si no, sin fechas | Unitario sobre `borradorAMano` |
| 5 | Sin nombre de pasajero sigue el aviso de hoy ("completalo en el asunto y el texto") | Unitario existente |
| 6 | El número de reserva de la agencia **se sigue guardando y viendo en la app** (pantallas de reserva/pedidos): solo sale del asunto que recibe el proveedor | Revisión del diff + suite |
| 7 | El modo prueba sigue anteponiendo "[PRUEBA]" | Unitario existente de `envio/mensaje.ts` |
| 8 | Nada más cambia (cuerpo, firma, renglones) | Suite existente en verde |

## 3. Qué ve el usuario
Sin pantallas nuevas: el asunto de los borradores cambia. "Volver a armar" actualiza los borradores sin editar; los
editados a mano no se tocan (como siempre).

## 4. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde. **#4:** no envía nada.

---

## Anexo técnico (para los agentes)
- El asunto sale de `asuntoYReferencia()` + `completar(plantilla.asunto, …)` en `src/lib/pedidos/armar.ts` (~línea
  1000) y de `borradorAMano()` en `src/lib/pedidos/a-mano-borrador.ts`. Los marcadores válidos del asunto están en
  `plantilla.ts` (`asunto: ["pasajero", "pax", "producto", "referencia"]`): sumar `fechas`; dejar los viejos
  aceptados si sacarlos rompe la validación de plantillas, pero la plantilla ya no los usa.
- Las fechas por pedido: cada pedido junta renglones con su fecha (desde/hasta); tomar mínimo y máximo. Si el
  armado no tiene las fechas a mano al completar el asunto, completarlo donde ya se conocen los renglones del pedido.
- Separador: guion largo "–" con espacios, como pidió el owner.
- Tests: ajustar los que esperan el asunto viejo (`ejemplos.ts`, tests de armado/a mano).
- Base de pruebas: `.env.pruebas.local`. Nunca la real.
