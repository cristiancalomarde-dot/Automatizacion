# M3-37 · Avisar que recibimos la reserva (agencia + operations@)

**Depende de:** M3-30, el envío de pedidos (`src/lib/pedidos/envio/`). Pedida por el staff vía el owner el
2026-10-28. Los mails a sales@ son ~500 por día para 3-4 reservas reales: no se reenvía sales@ entero.

## Texto aprobado por el owner (2026-10-28)

> **Subject:** Booking received – <booking code de la agencia> – <passenger> x <N> – <dates>
>
> Dear <nombre del vendedor, si se sabe; si no, "Dear colleague">,
>
> Thank you very much for your booking <booking code de la agencia> for <passenger> x <N> (<tour>, <dates>).
> We have received it and are now processing it with our suppliers. We will get back to you with the
> confirmation as soon as possible.
>
> We may contact you if we need any further information, such as flight details or passport data.
>
> Kind regards,
> HI Travel Operations

El booking code es el de la agencia (Kilroy DK…, Journaway ID/Trip Number, TourRadar…). Si la reserva no tiene
booking code, el botón muestra el aviso y deja mandarlo sin el código (no se inventa uno).

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Botón "Avisar que la recibimos"** en el detalle de la reserva: muestra el mail armado (para, asunto, cuerpo) y se manda solo al confirmar (#4: aprobación humana) | Pantalla: el botón abre la vista previa; sin confirmar no se manda nada |
| 2 | **Va al vendedor que escribió** (remitente del mail original de la reserva), desde operations@ con el SMTP de los pedidos, con copia a `PEDIDOS_CC` | Unitario: destinatario = remitente del mail; desde = SMTP de pedidos |
| 3 | **Con el texto aprobado** de arriba, en una plantilla editable (`data/plantillas/`), con el booking code de la agencia en el asunto y el cuerpo | Unitario: Kilroy (DK…) y Journaway (ID + Trip Number) salen con su código |
| 4 | **Una sola vez por reserva:** queda registrado (evento en la reserva: quién y cuándo) y el botón pasa a "Aviso enviado el <fecha> por <persona>"; reenviar pide confirmación de nuevo | Integración: mandar dos veces pide confirmar; el evento queda guardado |
| 5 | **Aviso interno a operations@ por cada reserva NUEVA** que crea la lectura de sales@ (no por cada mail; no por reservas de prueba ni reprocesos de una reserva ya avisada): asunto "Nueva reserva: <agencia> – <booking code> – <pasajero> x <N>", con fechas, producto, estado y el link a la reserva en la app | Integración con casilla falsa: 1 reserva nueva → 1 aviso; un mail de sales@ sin reserva → ninguno |
| 6 | **Modo prueba (#4):** sin `PEDIDOS_ENVIO_REAL=si`, ambos mails van a `PEDIDOS_DESTINO_PRUEBA` como hoy los pedidos | Unitario: sin la variable, el destinatario es el de prueba |
| 7 | **Nada más cambia** | Recorridos M2/M3 en verde |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#4** aprobación humana para el mail a la agencia y modo prueba por defecto.
  **#2** sin claves en el código. **#3** sin IA.
