# M3-55 · Las reservas descartadas no reciben mails

**Depende de:** M3-53. Pedida por el owner el 2026-11-11. Reserva real de Journaway `66925083976`.

## 1. Qué pasó
- Dos relecturas dejaron 2 reservas descartadas (`ffb7faeb-…`, `bfa479c1-…`) y una vigente (`0fb1b57e-…`).
- El 2026-11-11 llegó "RE: Program Booking / Client Kündig/ ID 66925083976": Journaway pregunta si los hoteles están
  confirmados. No es una reserva nueva.
- Al decidir a qué reserva va un mail, el sistema contó también las descartadas: "No se sabe a cuál de las 3 reservas
  con la referencia 66925083976 corresponde". Creó una reserva vacía (`50fdde78-…`) para revisión; al marcar los
  motivos como resueltos pasó a "recibida".
- M3-53 ya había sacado las descartadas de la relectura, pero no de la lectura de los mails que llegan.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Una descartada no cuenta como "misma referencia"**: el mail va a la única vigente | Unitario: Journaway con 2 descartadas y 1 vigente → se suma a la vigente |
| 2 | **Con solo descartadas, la reserva es nueva** y no se enlaza a ellas | Unitario: una descartada con ese número → nueva, sin enlazadas |
| 3 | **Una descartada no marca "posible duplicada"** | Unitario: misma fecha, producto y pax que una descartada → nueva |
| 4 | **Lo que ya estaba no cambia** | Suite completa, de frente por tandas |

## 3. En la real (no lo hace el builder)
Con OK del owner (2026-11-11): `50fdde78-…` pasó a "descartada" (hecho; el historial guarda las explicaciones del owner).

## 4. Qué queda afuera
- Un botón para descartar una reserva desde la pantalla.
- Responderle a Journaway sobre los hoteles (lo hace operaciones).
