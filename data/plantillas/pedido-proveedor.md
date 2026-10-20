# Plantilla del mail de pedido a proveedores

> Este archivo es el texto de los pedidos que arma la app (M3-01). Se puede cambiar sin tocar
> código: lo que está debajo de "## Asunto", "## Cuerpo" y "## Firma" es lo que sale en el mail.
> Las líneas que empiezan con ">" (como esta) son notas y no salen.
>
> Los datos van entre llaves dobles y la app los completa sola:
> - En el asunto: {{pasajero}} (el pasajero principal), {{pax}} (cuántos viajan), {{producto}}
>   (el código del producto, ej. OD010B) y {{referencia}} (" · Ref. " y el número de reserva de la
>   agencia, o nada si no vino).
> - En el cuerpo: {{servicios}} (lo que se pide, con fechas), {{pasajeros}} (cuántos son y, si el
>   pedido los necesita, sus datos) y {{pendientes}} (lo que todavía falta, como el vuelo; si no
>   falta nada, no sale).
> - En la firma: {{nombre_de_quien_envia}} es obligatorio: ahí va el nombre de la persona que
>   aprueba el envío. Sin eso la app no arma el pedido.

## Asunto

Reserva {{pasajero}} x{{pax}} · {{producto}}{{referencia}}

## Cuerpo

¡Hola! ¿Cómo están? Esperamos que muy bien.

Les escribimos desde HI Travel para pedirles la siguiente reserva:

{{servicios}}

{{pasajeros}}

{{pendientes}}

¿Nos confirman cuando puedan? Si necesitan algún dato más, nos avisan y se lo pasamos enseguida.

¡Muchas gracias!
Un abrazo,

## Firma

{{nombre_de_quien_envia}}
Hi Travel South America
On duty phone: +54 9 11 5588-9443
www.hitravel.com.ar
Instagram @hitravelargentina
