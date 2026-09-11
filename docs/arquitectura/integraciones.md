# Integraciones con otros sistemas — Gmail y el envío a proveedores

> **Dueño de:** la **regla #4** (aprobación humana para efectos hacia afuera). Qué sistemas
> externos toca la app.

## Los sistemas externos

1. **Gmail (casilla dedicada de reservas)** — la app **lee** esa casilla cada ~5 minutos buscando
   mails de reserva, y **envía** desde ella los pedidos a proveedores (así las respuestas de los
   proveedores vuelven al mismo lugar). **Resuelto:** es el Gmail ya existente al que Ferozo
   reenvía automáticamente lo que llega a `sales@hitravel.com.ar` — no hace falta tocar la casilla
   original ni migrar de Ferozo/Outlook. **Confirmado (2026-09-11):** el reenvío es una regla del
   servidor de Ferozo — funciona 24/7, no depende de Outlook de escritorio ni de que una PC esté
   prendida.
2. **El remitente de los pedidos a proveedores no es la casilla de lectura.** Los pedidos tienen
   que salir como `operations@hitravel.com.ar` — no desde el Gmail dedicado de lectura — para que
   las respuestas de los proveedores caigan donde el equipo ya las mira siempre. *Pendiente de
   definir (no bloquea M1, se resuelve antes de M3):* si se manda con las credenciales SMTP que ya
   existen para esa casilla en Ferozo, o con un servicio de envío transaccional (ej. Resend)
   configurado para enviar como `operations@hitravel.com.ar` vía registros DNS del dominio —
   recomendado por confiabilidad y para no depender de límites de envío de un hosting compartido.
   A confirmar con quien administra el dominio `hitravel.com.ar`.
3. **PDF adjunto en algunas agencias** — Kilroy/Jysk mandan la reserva en el cuerpo del mail;
   TourRadar la manda como PDF adjunto. Claude puede leer el PDF directamente (no hace falta
   convertirlo a texto aparte); la única diferencia es que la lectura revisa primero si hay un PDF
   adjunto y, si lo hay, extrae de ahí en vez del cuerpo. Detalle en
   [`integraciones-ia.md`](integraciones-ia.md).
4. **API de Anthropic (Claude)** — interpreta los mails. Detalle y techo de gasto en
   [`integraciones-ia.md`](integraciones-ia.md).

No hay pagos, ni publicación, ni ningún otro sistema externo en el MVP.

## Regla #4 — todo lo que sale hacia afuera pasa por aprobación humana

El único efecto hacia afuera del MVP es **mandar mails a proveedores**. Nunca sale uno solo sin
que una persona lo apruebe:

- La app **redacta** todos los pedidos de una reserva (uno por proveedor, con fechas y servicios).
- Una persona los **revisa** en pantalla, edita el texto si quiere, y **confirma el envío de a una
  reserva por vez** (un clic manda todos los pedidos de esa reserva; se puede dejar alguno
  afuera).
- Recién ahí salen los mails. La reserva pasa a "pedido a proveedor" y queda registrado quién
  aprobó y cuándo.

**Leer la casilla no es un efecto hacia afuera** y corre solo. También corren solos: interpretar
el mail con IA, emparejar el producto y armar los borradores. El envío es el único paso con
aprobación.

La automatización del envío (sacar la aprobación humana) está **descartada para el MVP** y anotada
como evaluación futura: recién se considera si la extracción demuestra menos de ~2-3% de
corrección manual sostenida, y cambiarla exige editar esta regla y anotarlo en
[`DECISIONS.md`](../../DECISIONS.md). Ver PRD §6.1.

## Tours compuestos: los tramos de bus público nunca son un efecto hacia afuera de la app

Un tour compuesto (ej. Patagonia Highlights) puede incluir **tramos de bus público** entre sus
paquetes-componente. Esos tramos **no pasan por la regla #4 porque la app no ejecuta ninguna
acción sobre ellos**: no se le escribe a nadie, no se reserva, no se emite nada desde acá. La app
solo los muestra como una tarea pendiente ("emitir boleto: ruta, fecha") dentro de la reserva,
para que una persona lo haga en el sistema de emisión de pasajes que ya usa HI Travel. Distinto es
un servicio de bus que forma parte del producto de un proveedor (ej. el traslado Uyuni→La Paz del
Overland): ese sí genera un pedido a proveedor por mail, como cualquier otro servicio.

## Casos de borde

- **Proveedor sin mail cargado, o que solo se contacta por WhatsApp:** su pedido no sale. Es el
  mismo caso en ambos: el MVP solo automatiza el canal mail. La reserva pasa a "pedido a
  proveedor" con flag "pedido incompleto" y un recordatorio hasta que se complete el mail (si es
  que existe) y se reenvíe, o hasta que una persona confirme que lo hizo por WhatsApp.
- **Falla el envío de un mail:** se muestra cuál falló, con "reintentar". Si fallan todos, la
  reserva no cambia de estado.
- **La casilla o la Gmail API no responden:** la ingesta reintenta en la próxima corrida; nada se
  pierde.

## Anexo técnico

- Gmail API con OAuth de la cuenta dedicada. Scopes: `gmail.readonly` (ingesta), `gmail.send`
  (pedidos). Client id/secret + refresh token en variables de entorno ([`secretos.md`](secretos.md)).
- Ingesta: Vercel Cron `*/5 * * * *` → Route Handler protegido con `CRON_SECRET`. Filtro de
  búsqueda tipo `subject:(NEW BOOKING) newer_than:30d` (ajustable por agencia). Marca los mails
  procesados (label o `historyId`) para no re-procesar.
- Envío: los pedidos se mandan como mails nuevos por proveedor desde la casilla. El asunto lleva
  un identificador de la reserva para poder cruzar la respuesta a mano.
- Idempotencia: un `reserva_pedido` ya enviado no se re-envía salvo acción explícita "reenviar".
- Idioma del mail al proveedor: español; portugués para proveedores de Brasil (según país del
  proveedor en su ficha). Las plantillas se definen al construir M3.

## Abierto

- ~~Casilla: cuenta Gmail común nueva vs. dirección del dominio `hitravel.com.ar`~~ — **resuelto:**
  se usa el Gmail existente al que Ferozo reenvía `sales@hitravel.com.ar`. Confirmar antes de M2
  que ese reenvío es una regla de servidor (ver arriba).
- **Cómo se manda desde `operations@hitravel.com.ar`:** SMTP de Ferozo vs. servicio transaccional
  (Resend) con DNS del dominio. El owner no lo sabe todavía — a confirmar con quien administra
  `hitravel.com.ar`. No bloquea M1; se resuelve antes de M3.
- ¿Se avisa al equipo (mail/Slack) cuando entra una reserva o cuando algo cae en "para revisión"?
  Posiblemente fuera de alcance del MVP; decidir en el roadmap.
