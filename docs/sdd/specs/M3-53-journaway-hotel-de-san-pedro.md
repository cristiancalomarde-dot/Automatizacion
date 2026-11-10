# M3-53 · Journaway: el hotel de San Pedro sale de la lista de hoteles, y los Tayka se piden

**Depende de:** M3-52. Pedida por el owner el 2026-11-10. Reserva real de Journaway `66925083976` (id
`bfa479c1-bebd-452f-aa8f-3449ebe2a475`, SPAP05): los pedidos salen con "HOTEL: A CONFIRMAR", y el Tayka del Desierto no se
pide ("lo reserva la agencia").

## 1. Qué pasó
El mail trae dos tablas en imágenes:
- **"Please book the following hotels:"**: Tayka del Desierto, Tayka del Sal y el bus nocturno Uyuni – La Paz. Son parte
  del SPAP05: los pide HI Travel.
- **"List of all hotels (rest is booked by us):"**: todos los alojamientos del viaje. Entre ellos está **Hotel Cumbres San
  Pedro de Atacama, del 14.01 al 19.01.2027**: lo reserva Journaway, y es donde se busca a los pasajeros.

La IA (lectura-mail.v6) puso la primera tabla en "hoteles de la agencia" y no copió la segunda. Resultado:
- El armado de pedidos saltea el Tayka del Desierto porque cree que lo reserva la agencia.
- No hay hotel para el pick up de los tours ni para el traslado desde Calama.

El código ya sabe usar los hoteles de la agencia por fecha (M3-30): falta que lleguen bien.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Instrucciones lectura-mail.v7.** En Journaway, "Please book the following hotels" son servicios que le piden a HI Travel: van en productos, no en hoteles de la agencia. "List of all hotels (rest is booked by us)" lista todos los alojamientos: cada renglón que no está en "Please book" es un hotel de la agencia, con sus fechas, de todas las ciudades | Unitario: la versión es v7 y el texto dice las dos cosas |
| 2 | **Un Tayka o el bus Uyuni – La Paz nunca es un hotel de la agencia**, aunque la IA lo ponga ahí (señales `hotel_tayka` y `parte_de` de `data/journaway-senales.csv`) | Unitario: una ficha de Journaway con los Tayka y el bus en hoteles de la agencia guarda solo los demás (el Cumbres) |
| 3 | **Con el Cumbres en los hoteles de la agencia**, los pedidos de San Pedro dicen el hotel para el pick up y el Tayka del Desierto se pide | Unitario de pedidos: reserva SPAP05 con el Cumbres del 14 al 19 → "HOTEL: Hotel Cumbres San Pedro de Atacama" y sin "lo reserva la agencia" |
| 4 | **Lo que ya estaba no cambia** | Suite completa, de frente por tandas |
| 5 | **Releer un mail por segunda vez no lo suma a la reserva que descartó la primera relectura**: las descartadas del mail tampoco cuentan como "mismo intercambio" | Integración: releer dos veces → descartada, descartada, nueva; la primera sin partes ni eventos nuevos |
| 6 | **Migración 0025: una reserva descartada no bloquea una nueva** con el mismo booking_id y producto (el índice único de 0012 pasa a excluir las descartadas) | La misma integración (la nueva SPAP05 se crea aunque haya una SPAP05 descartada) |

## 3. En la real (no lo hace el builder)
Con OK del owner, después de publicar: volver a leer el mail de 66925083976 (`reprocesar:mail -- --uid 17080`,
primero en seco). La reserva actual pasa a "descartada" y entra una nueva. Revisar con la previa de pedidos que el
Cumbres y los dos Tayka estén.

**Lo que pasó el 2026-11-10 (05:11 UTC):** la primera relectura con v7 leyó bien (el Cumbres del 14 al 19, sin Tayka
como hotel de la agencia), pero se sumó a `ffb7faeb` (descartada por la relectura de M3-52) y falló al guardar. Quedaron
las dos reservas descartadas y, en `ffb7faeb`, 4 partes y un evento "mail agregado" de más. Orden, con OK del owner:
1. el owner aplica 0025 en el SQL Editor de Supabase;
2. se limpian las partes y el evento de más en `ffb7faeb` (script del scratchpad, en seco primero);
3. suite en verde, se publica, y se vuelve a leer el mail.

Hecho: 0025 aplicada a la real por el owner (SQL Editor) y a la base de pruebas (`supabase db push`, con OK). En
`ffb7faeb` se borraron las 4 partes y se renumeraron las 5 originales; el evento "mail agregado" de más queda, porque
el historial de una reserva no se edita ni se borra (la reserva está descartada).

## 4. Qué queda afuera
- Las fechas del Overland que escribe Journaway (los Tayka un día después que el catálogo): se le consulta al owner.
- Releer otras reservas de Journaway ya entradas.
