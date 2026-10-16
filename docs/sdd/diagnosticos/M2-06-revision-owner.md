# M2-06 · La revisión del owner del modo prueba

Copia de lo que marcó el owner en la pantalla, sacada de la base el 2026-10-16 (tabla
`revision_prueba` + las reservas de prueba). Se guarda acá para que no se pierda si las reservas de
prueba se borran y se vuelven a crear.

## El resultado

- **23 reservas de prueba, las 23 revisadas.**
- **20 bien (87%) · 3 mal (13%).** Por debajo del 20%: se puede seguir.
- **Con el producto mal: 1 de 23 (4%).** Es la de DK1594100 OD010D, pero lo que marca la nota no es
  el producto sino cómo se parte un mail con varias reservas (ver abajo).
- Las otras 2 "mal" son la cancelación de TourRadar 1363612: no se veía que era una cancelación y
  se partió en dos reservas.

## Lo que marcó mal, con su nota

| Agencia | Número | Producto que nombra la agencia | Estado | Qué estaba mal | Nota del owner |
|---|---|---|---|---|---|
| Kilroy | DK1594100 | Iguazu Falls Combined (2 nights in Brazil 1 night in Argentina) (OD010D) | para revisión | producto | "es un mail con 3 reservas en el mismo mensaje, que el sistema no reconocio. no se como lo vamos a mandejar, si en una unica reserva, o si tenemos que partirlo por producto" |
| TourRadar | 1363612 | Iguazu Falls on a Shoestring (3N) | para revisión | estado o motivo | "en realidad es una cancelacion, no una reserva nueva. No dice en ningun lado que sea cancelacion. tal vez haya que especificar en algun lado que es cancellation..." |
| TourRadar | 1363612 | Hotel La Aldea 4* | para revisión | estado o motivo | "es una cancelacion que quedo duplicada" |

Qué se hace con cada una (decidido con el owner el 2026-10-16):
- **Kilroy con varias reservas en un mail:** se sigue partiendo por producto (una reserva por
  producto, mismo número). El owner lo aceptó.
- **TourRadar 1363612:** un número de reserva de TourRadar es una sola reserva; la noche de hotel
  extra va dentro de esa reserva. Y una cancelación tiene que decir "CANCELACIÓN" de forma evidente,
  en la lista y en el detalle.

## Todas las reservas marcadas

| Agencia | Número | Producto que nombra la agencia | Estado | Resultado | Qué estaba mal | Nota |
|---|---|---|---|---|---|---|
| Kilroy | DK1547743 | Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days | para revisión | bien | | |
| Kilroy | DK1559523 | Overland Uyuni to San Pedro de Atacama - 7 Days (BOCHI04R) | para revisión | bien | | |
| Kilroy | DK1564627 | Iguazu Falls Combined (2 nights in Brazil 1 night in Argentina) (OD010D) | recibida | bien | | |
| Kilroy | DK1576836 | HI - Rio de Janeiro Starter Package (Cabanacopa Hostel) | para revisión | bien | | |
| Kilroy | DK1576932 | Patagonia, Trekking Paradise with W-Trek (12 Days) - Self Guided | para revisión | bien | | |
| Kilroy | DK1576932 | Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days | para revisión | bien | | |
| Kilroy | DK1585447 | Iguazu Falls on a Shoestring - 4 Days - Start in Brazil | recibida | bien | | |
| Kilroy | DK1586168 | Patagonia, Trekking Paradise with W-Trek EXPRESS (10 nights) | para revisión | bien | | |
| Kilroy | DK1587664 | Iguazu Falls Combined (2 nights in Argentina 1 night in Brazil) (OD010C) | recibida | bien | | |
| Kilroy | DK1593111 | Iguazu Falls on a Shoestring - 4 Days - Start in Brazil | recibida | bien | | |
| Kilroy | DK1593111 | San Pedro de Atacama Explorer - 4 Days | para revisión | bien | | |
| Kilroy | DK1594100 | El Calafate & El Chalten full day - 4 nights (OD014) | para revisión | bien | | |
| Kilroy | DK1594100 | Iguazu Falls Combined (2 nights in Brazil 1 night in Argentina) (OD010D) | para revisión | **mal** | producto | ver arriba |
| Kilroy | DK1594100 | Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days | para revisión | bien | | |
| Kilroy | DK1594392 | Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days | para revisión | bien | | |
| Kilroy | NO1569851 | Patagonia Highlights - 9 Days (Start Argentina) (ARCH31) | para revisión | bien | | |
| Kilroy | UK1586142 | 5 Countries: Rio de Janeiro to La Paz (29 nights) (5C01) | para revisión | bien | | |
| TourRadar | 1363612 | Iguazu Falls on a Shoestring (3N) | para revisión | **mal** | estado o motivo | ver arriba |
| TourRadar | 1363612 | Hotel La Aldea 4* | para revisión | **mal** | estado o motivo | ver arriba |
| TourRadar | 1376833 | Overland San Pedro de Atacama to Uyuni end in La Paz (7 Days) | para revisión | bien | | |
| TourRadar | 1377583 | Buenos Aires to Rio de Janeiro 12 Days | para revisión | bien | | |
| TourRadar | 1377598 | Patagonia Adventure Tour 16 Days | para revisión | bien | | |
| TourRadar | 1383503 | Argentina and Uruguay, heart of the River Plate (7 days) | para revisión | bien | | |

## Por qué quedó cada una en revisión (el motivo que vio el owner)

- **Falta un vuelo** (12 reservas): CHB31 (llegada a Calama), BOCHI04R (salida de Calama), OD032 y
  5C01 (llegada a Río), ARCH33 (llegada a El Calafate y salida de Puerto Natales), OD030 (llegada a
  Calama), ARCH31 (llegada a El Calafate), AR09 (llegada a Buenos Aires y salida de Ushuaia). Desde
  el ajuste del 2026-10-16 esto deja de mandar a revisión: queda "recibida" con un aviso.
- **Producto existe pero no está cargado** (3): ARCH33EXP, ARBR23, ARUY01.
- **Producto no está en el catálogo** (1): OD014 (Kilroy DK1594100). Desde el ajuste del 2026-10-16
  dice "existe pero todavía no está cargado".
- **La IA dudó de la cantidad de pasajeros** (3, las de DK1594100): el mail dice "3 bookings" y
  lista 2 pasajeros. En Kilroy "3 bookings" son 3 productos para los mismos pasajeros; se ajusta en
  las instrucciones v3.
- **Cancelación de una reserva que no está en el sistema** (2, TourRadar 1363612).
