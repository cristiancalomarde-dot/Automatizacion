# Plantilla del mail de pedido a proveedores de Brasil (en portugués)

> Este archivo es el texto de los pedidos a los proveedores de Brasil (M3-32): los que tienen en el
> directorio una ciudad de data/ciudades-portugues.csv. Mismo formato que pedido-proveedor.md (la de
> castellano): lo que está debajo de "## Asunto", "## Cuerpo" y "## Firma" es lo que sale en el mail.
> Las líneas que empiezan con ">" (como esta) son notas y no salen.
>
> Los datos entre llaves dobles son los mismos que en la de castellano y la app los completa sola,
> en portugués: {{pasajero}}, {{pax}} y {{fechas}} en el asunto ("30 jan a 2 fev 2027");
> {{servicios}}, {{horario}} ("Vocês podem nos confirmar o horário do passeio, por favor?"),
> {{pasajeros}} y {{pendientes}} en el cuerpo. La firma es la misma que en castellano y tiene que
> llevar {{nombre_de_quien_envia}}.
>
> El texto lo revisa el owner (o alguien del equipo) antes del envío real: cualquier ajuste se hace
> acá, sin tocar código.

## Asunto

Solicitação de reserva – {{pasajero}} x {{pax}} – {{fechas}}

## Cuerpo

Olá! Tudo bem? Esperamos que sim.

Escrevemos da HI Travel para solicitar a seguinte reserva:

{{servicios}}

{{horario}}

{{pasajeros}}

{{pendientes}}

Vocês podem nos confirmar quando puderem? Se precisarem de mais algum dado, é só avisar que enviamos na hora.

Muito obrigado!
Abraços!

## Firma

{{nombre_de_quien_envia}}
Hi Travel South America
On duty phone: +54 9 11 5588-9443
www.hitravel.com.ar
Instagram @hitravelargentina
