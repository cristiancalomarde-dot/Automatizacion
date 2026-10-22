# M3-12 · Iguazú: el pedido a Cuenca del Plata lleva el hotel de cada día

**Depende de:** M3-01 (armado de pedidos). Pedida por el owner el 2026-10-22: hoy el pedido del paquete
receptivo de Iguazú (105 Premium, Cuenca del Plata) no dice en qué hotel buscar ni dejar a los pasajeros.

## 1. Qué queremos lograr
Que cada renglón del pedido del paquete de Iguazú (OD010A-D, OD011 y dentro de los tours) diga el alojamiento,
como ya lo hacen las excursiones sueltas de los otros destinos:

| Renglón | Qué agrega |
|---|---|
| **TRF IN** | el vuelo/bus (como hoy) y **Drop off: <hotel de la primera noche>** |
| **Cada excursión** | **Pick up y drop off: <hotel de esa noche>** |
| **Día del cruce** (paquetes combinados) | **Pick up: <hotel de la noche anterior>** y **Drop off: <hotel de la noche de ese día>** (el del otro país), además del aviso de check out y lockers de hoy |
| **TRF OUT** | **Pick up: <hotel de la última noche>** y el vuelo/bus (como hoy) |

**Premium (owner, 2026-10-22, "muy importante"):** el pedido deja claro que es el **paquete 105 Premium** (en el
título) y que las excursiones lado argentino y lado brasileño van **en Premium** ("Lado argentino, Premium, en
inglés: …"), no "regular". Si el servicio no es el Premium, queda como hoy.

El hotel es el que reserva la agencia (si vino) o el que pide la app en esta misma reserva, con "· hotel a
confirmar" igual que en el resto (`pickUp()`/`estadiaDe()` de `armar.ts`). Si no se sabe: "alojamiento a
confirmar" y el pendiente de alojamiento, como hoy en las excursiones. Si la agencia mandó un pick up, manda
ese (como hoy).

## 2. Qué hay hoy
`armar.ts` `paqueteConTraslados()`: TRF IN, excursiones y TRF OUT con fechas y vuelo/bus, pero el hotel solo
aparece si vino `b.pickUp`. Las estadías (`this.estadias`) ya están calculadas para la reserva.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | TRF IN con el hotel de la primera noche | Unitario: OD010A con hotel 3* → "Drop off: <hotel> (Puerto Iguazú) · hotel a confirmar" |
| 2 | Cada excursión con el hotel de esa noche | Unitario: las dos excursiones de OD010A con el mismo hotel |
| 3 | Paquete combinado: el día del cruce, pick up en el hotel de un país y drop off en el del otro | Unitario: paquete combinado de Iguazú con dos hoteles |
| 4 | TRF OUT con el hotel de la última noche | Unitario |
| 5 | Hotel que reserva la agencia: sale sin "a confirmar"; sin hotel conocido: "alojamiento a confirmar" + pendiente | Unitario |
| 6 | Dentro de un tour (BRARCH26: llega y sale en bus) también lleva el hotel | Unitario/integración: BRARCH26 con su OD010A |
| 7 | Nada más cambia: los otros pedidos de la reserva quedan iguales | Los tests existentes del armado siguen en verde (solo se actualizan los que esperan el texto exacto del pedido de Iguazú) |

## 4. Qué ve el usuario
Sin pantallas nuevas: el borrador a Cuenca del Plata trae el hotel en cada renglón. Los borradores ya armados
sin editar se actualizan con "Volver a armar".

## 5. Qué queda afuera
- Otros proveedores o destinos (ya llevan el hotel por `pickUp()`).

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde.
- **#4:** no envía nada; solo cambia el texto del borrador.

---

## Anexo técnico (para los agentes)
- Reusar `estadiaDe(fecha)` / la lógica de `pickUp()`; no inventar hoteles.
- Pick up de un día = estadía de la noche anterior (`fecha - 1`); drop off = estadía de la noche de esa fecha.
- Las 3 verificaciones: 1) unitarios + lint + tipos + build; 2) integración en la base de pruebas
  (`.env.pruebas.local`): `armarPedidos` de una reserva OD010A y una BRARCH26; 3) recorrido en modo prueba con
  una reserva de Kilroy de Iguazú.
