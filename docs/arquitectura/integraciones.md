# Integraciones con otros sistemas — Gmail y el envío a proveedores

> **Dueño de:** la **regla #4** (aprobación humana para efectos hacia afuera). Qué sistemas
> externos toca la app.

## Los sistemas externos

1. **Gmail (casilla dedicada de reservas)** — la app **lee** esa casilla cada ~5 minutos buscando
   mails de reserva, y **envía** desde ella los pedidos a proveedores (así las respuestas de los
   proveedores vuelven al mismo lugar).
2. **API de Anthropic (Claude)** — interpreta los mails. Detalle y techo de gasto en
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

- Casilla: cuenta Gmail común nueva vs. dirección del dominio `hitravel.com.ar` (Google Workspace,
  ~US$ 7/mes). Definir antes de M2.
- ¿Se avisa al equipo (mail/Slack) cuando entra una reserva o cuando algo cae en "para revisión"?
  Posiblemente fuera de alcance del MVP; decidir en el roadmap.
