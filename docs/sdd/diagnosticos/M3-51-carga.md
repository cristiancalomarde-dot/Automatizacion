# M3-51 · En seco contra la base real (2026-11-06)

Corrido con `--en-seco` (`clienteEnSeco` + `fetchSoloLectura`, sin IA) contra la base real (`uhwkifqmexdktaseaxxo`), con
los Excel y el Word copiados del Drive el 2026-11-06 16:19 y los CSV del clon. **Ninguna fila cambió.** Es el estado
**antes** de la carga de la ficha §5.

## `npm run importar:paquetes -- --codigos ODBR50,COMPBR06,COMPBR13,COMPBR14 --en-seco`

| Tabla | Crearía | Actualizaría | Borraría |
|---|---|---|---|
| `producto` | 4 (ODBR50, COMPBR06, COMPBR13, COMPBR14) | 0 | 0 |
| `producto_servicio` | 13 | 0 | 0 |
| `codigo_externo` | 8 (HI Travel y Kilroy de cada uno) | 0 | 0 |
| `importacion` | 1 | 0 | 0 |

- ODBR50: 2 servicios (Pantanal Jungle Lodge "Todos los niveles"; el privado de Agmar). COMPBR06: 5 servicios (Bonito HI
  Hostel, Hotel Pira Miuna Budget Hotel, Floating Rio da Prata con Ygarape, el traslado de Agmar a las excursiones y el
  opcional Campo Grande - Bonito - Campo Grande). COMPBR13: 2 líneas (Fujima / O Hostel GRU Hostel; Sooz / Nacionalinn
  Hotel 3\*). COMPBR14: 2 líneas (Ceu do Mato Eco Hostel Hostel; Hotel Bahamas Dourados Hotel 3\*).
- IA: 0 llamadas. Otros puntos para revisar: ninguno. Códigos no encontrados: ninguno.
- **Sin resolver hoy en la real (2 nombres):** Hotel Pira Miuna (falta la equivalencia nueva: se resuelve con
  `importar:equivalencias`) y O Hostel GRU (segunda opción del Hostel de São Paulo; no está en el directorio y ya estaba
  pendiente en COMPBR10 desde M1-04d). Ygarape ya resuelve a la fila de Bonito (`ygarape@ygarape.com.br`).

## `npm run importar:tours -- --codigos BR20 --en-seco`

| Tabla | Crearía | Actualizaría | Borraría |
|---|---|---|---|
| `producto` | 1 (BR20) | 0 | 0 |
| `codigo_externo` | 1 | 0 | 0 |
| `importacion` | 1 | 0 | 0 |

- **BR20: para revisar**, con 0 componentes y 0 servicios: este comando lee la base como está, y ODBR50, COMPBR06, COMPBR13
  y COMPBR14 todavía no están en la real. Con los paquetes cargados (base de pruebas, estos archivos) queda armado, 19
  noches:

| Día | Componente | Noches |
|---|---|---|
| 1 | OD010B (Foz), transfer de llegada, **sin transfer de salida** | 3 |
| 4 | Bus Foz → Cascavel → Dourados, Plataforma10 | — |
| 4 | COMPBR14 (Dourados) | 1 |
| 5 | Bus Dourados → Bonito, Plataforma10 | — |
| 5 | COMPBR06 (Bonito); el día 6 el Floating Rio da Prata (Ygarape) con el traslado de Agmar | 2 |
| 7 | ODBR50 (Pantanal Jungle Lodge); Agmar lo lleva desde Bonito | 3 |
| 10 | Agmar a la Rodoviaria de Campo Grande y bus nocturno a São Paulo Barra Funda, Plataforma10 | 1 (en el bus) |
| 11 | COMPBR13 (São Paulo) | 1 |
| 12 | Bus São Paulo Tietê → Paraty, Plataforma10 | — |
| 12 | COMPBR02 (Paraty) | 2 |
| 14 | Transfer Paraty → Ilha Grande, Paraty Tours | — |
| 14 | COMPBR11 (Ilha Grande) | 3 |
| 17 | Transfer Ilha Grande → Río, Paraty Tours | — |
| 17 | OD032 (Río), con el traslado de salida al aeropuerto GIG | 3 |

Ajustes del tour (`data/traslados-tour.csv`): OD010B solo llegada, COMPBR06 y ODBR50 con el texto de Agmar, COMPBR02 anulado
(por tramos, como BR04) y OD032 invertido (como BR04).

## Lo que ya estaba: `npm run importar:tours -- --en-seco`, sin códigos

Los 15 tours cargados salen "armado", con **0 actualizaciones y 0 borrados** en productos, componentes, servicios y
ajustes. Lo único que crearía son el producto y el código de BR20 (para revisar, por lo de arriba). **Ninguna fila ya
cargada cambia**, tampoco con las ciudades nuevas (Dourados, Bonito, Pantanal, Campo Grande).

## Lo que haría `importar:equivalencias`

No tiene modo en seco: se corrió la misma función con `clienteEnSeco` + `fetchSoloLectura` contra la real (solo lectura).
130 filas en el CSV, 129 en la real: **1 nueva, 0 cambiadas.**

- BON · Hotel Pira Miuna → Pira Miuna (Bonito, `reservas@hotelpiramiuna.com.br`), ya en el directorio.

`importar:proveedores` no hace falta: los proveedores de Bonito, Dourados y Pantanal ya se cargaron el 2026-11-06.
`importar:codigos-kilroy` suma 1 código: `HI_TRAVEL_BR20-677` → BR20.

## La reserva de ejemplo (base de pruebas)

Con las fechas de DK1598967: 19/02 → 10/03/2027, 2 pax, "Double Room at Hostel and Jungle Lodge". Queda recibida, con BR20.

**Pedidos por mail (9):**

| A quién | Qué | Fechas |
|---|---|---|
| Bambu Hostel Foz (portugués) | DBL Standard, sin desayuno | 19 → 22 feb (3 noches) |
| Cuenca del Plata | 105 Premium x Foz: TRF IN (bus o vuelo pendiente), lado argentino y lado brasileño; **sin TRF OUT** | 19, 20 y 21 feb |
| Bonito HI Hostel (portugués) | DBL Standard, sin desayuno | 23 → 25 feb (2 noches) |
| Ygarape (portugués) | Floating Rio da Prata, sin pick up (lo lleva Agmar) | 24 feb |
| Pantanal Jungle Lodge (portugués) | DBL Standard com pensão completa | 25 → 28 feb (3 noches) |
| Paraty Tours (portugués) | Scuna Netuno (punto de encuentro en el puerto); Transfer Paraty – Ilha Grande; Transfer Ilha Grande – Rio de Janeiro | 3, 4 y 7 mar |
| Holandes Hostel (portugués) | DBL Standard con café da manhã | 4 → 7 mar (3 noches) |
| Local 55 (portugués) | Cabanacopa Hostel y Big Dude | 7 → 10 mar; Big Dude 8 mar |
| Buzios Transfers (portugués) | Transfer de salida Cabanacopa Hostel - Aeropuerto GIG | 10 mar |

**Tareas (8):**

- Emitir pasaje: Bus Foz do Iguaçu – Cascavel – Dourados, el primero de la mañana a Cascavel, que suele salir a las 6 hs,
  para conectar a Dourados, en Plataforma10, 22 feb 2027.
- WhatsApp a Ceu Do Mato Eco Hostel: doble, IN 22 feb, OUT 23 feb.
- Emitir pasaje: Bus Dourados – Bonito, el primero de la mañana, que suele salir a las 7 hs, para llegar temprano, en
  Plataforma10, 23 feb 2027.
- WhatsApp a Agmar: Transfer privado ida y vuelta a la excursión Floating Rio da Prata, 24 feb; Transfer privado
  alojamiento en Bonito - Pantanal Jungle Lodge (llegada) y Pantanal Jungle Lodge - Rodoviaria de Campo Grande (salida,
  bus nocturno a São Paulo), del 25 al 28 feb.
- Emitir pasaje: Bus nocturno Campo Grande – São Paulo Barra Funda, en Plataforma10, 28 feb 2027.
- WhatsApp a Fujima Hostel: doble, IN 1 mar, OUT 2 mar.
- Emitir pasaje: Bus São Paulo Tietê – Paraty, en Plataforma10, 2 mar 2027.
- Reservar a mano en Che Lagarto: doble, IN 2 mar, OUT 4 mar. Si no hay lugar: Casa do Rio, Casa Viva, Agatha.

## Preguntas para el owner

1. ~~**Ygarape y el pick up.**~~ Contestada (owner, 2026-11-06): "SI, ESO LO HACE AGMAR". El mail a Ygarape va sin pick up.
2. ~~**Pantanal Jungle Lodge, "com café da manhã".**~~ Contestada (owner, 2026-11-06): "ES EL PROGRAMA QUE TIENE PENSION
   COMPLETA Y ACTIVIDADES". El pedido dice "com pensão completa".
3. **Hotel Pira Miuna (Budget Hotel de COMPBR06)** quedó cargado como Budget Hotel, por la tabla del bloque. No se usa en
   BR20 (solo Hostel). Confirmalo cuando entre una venta Budget.
4. **O Hostel GRU** (segunda opción del Hostel de São Paulo, en COMPBR10 y ahora en COMPBR13) sigue sin estar en el
   directorio. Fujima va primero, así que hoy no frena nada.

## Orden de la carga

Ficha §5, con el OK del owner y copiando antes los Excel del Drive: `importar:equivalencias` →
`importar:paquetes --codigos ODBR50,COMPBR06,COMPBR13,COMPBR14` → `importar:tours --codigos BR20` →
`importar:codigos-kilroy`. Después, asignar BR20 a DK1598967 y armar sus pedidos.
