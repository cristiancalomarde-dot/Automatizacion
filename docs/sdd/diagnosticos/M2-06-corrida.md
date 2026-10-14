# Modo prueba (M2-06): la corrida con los mails de verdad

Corrida del 2026-10-14, con la IA real (Claude Sonnet 5.5, instrucciones `lectura-mail.v2`).
Todo quedó guardado como **de prueba** en la base: se ve en Reservas con "Ver las de prueba" y
no se mezcla con las reservas reales. No se tocó la casilla `sales@` ni se mandó ningún mail: los
mails salieron de archivos guardados en `Insumos/`.

- El detalle de cada mail (qué entendió la IA, con qué producto lo emparejó y por qué, y en qué
  estado quedó) está en `docs/sdd/diagnosticos/M2-06-mails/`, un archivo por mail.
- La lista de reservas con su marca y la comparación de modelos está en `M2-06-resumen.md`. Se
  rearma con `npm run probar:mails -- --resumen`.

## En números

| | Mails de ejemplo (`Insumos/Mails`) | Mails reales del 12 y 13/10 (`sales@`) | Total |
|---|---|---|---|
| Archivos | 28 | 44 | **72** |
| Leídos con IA | 16 | 6 | **22** |
| Salteados sin gastar IA | 12 | 38 | **50** |
| Reservas de prueba creadas | 18 | 6 | **24** |
| Quedaron "recibida" | 1 | 1 | **2** |
| Quedaron "para revisión" | 17 | 5 | **22** |
| Gasto de IA | US$ 0,36 | US$ 0,10 | **US$ 0,46** |

El gasto del mes quedó en US$ 1,76 de los US$ 20 del techo. Una segunda corrida sobre los mismos
archivos no leyó nada de nuevo ni gastó IA (idempotente).

## Qué no se leyó, y por qué

- **8 "Pedido Proveedor"**: son mails de HI Travel a sus proveedores, no de una agencia.
- **4 de Journaway**: entran con M2-09.
- **21 de Jysk**: no se leen (decisión del owner: casi todo es a medida). Quedan registrados.
- **17 respuestas de Kilroy** ("Re:", "Sv:", "RV:"…): ninguna trae el número de una reserva
  cargada que esté esperando un vuelo. Por ejemplo, "Re: NEW FLIGHT: DK1562336" no se leyó porque
  la reserva DK1562336 llegó antes del 12/10 y no está en el sistema.

## Por qué quedaron 22 para revisión

| Motivo | Cuántas | Cuáles |
|---|---|---|
| Falta el vuelo y el producto tiene traslado | 10 | CHB31 (5), ARCH33, ARCH31, 5C01, OD032, BOCHI04R |
| El producto existe pero no está cargado | 3 | ARBR23 (TourRadar 1377583), ARUY01 (TourRadar 1383503), ARCH33EXP (Kilroy DK1586168) |
| El código de Kilroy no está en el catálogo | 4 | OD014 ("varias"), `HI_ARGENTINA_IGUAZU_BR_4DAYS-677` (2 mails reales), `HI_ARGENTINA_SAN_PEDRO_ATACAMA_4DAYS-677` (1 mail real) |
| La IA no estuvo segura del producto | 1 | TourRadar 1377598: sugiere AR09 con 0,82 (hace falta 0,90) |
| Cancelación | 1 | TourRadar 1363612 (OD010A): la resuelve una persona |
| La IA no estuvo segura de la cantidad de pasajeros | 1 | OD010D de "varias" (las otras dos de ese mail también lo tienen, además de su motivo) |
| No es una reserva | 2 | Kilroy "Madidi National Park" (consulta) y "New request 6-days Buenos Aires + Uruguay" (pedido de cotización) |

## Comparado con lo que esperaba la ficha (§2 de la spec)

**Coincide:**
- "varias" dio **3 reservas**, no 4 (el Overland repetido es el mismo intercambio).
- "2 NEW BOOKINGS" (ARCH33) dio **2 reservas**, ARCH33 y CHB31, y anotó que el vuelo de salida es
  desde Puerto Natales.
- El segundo PDF de TourRadar 1377598 **no creó otra reserva**: se sumó al historial de la primera.
- La cancelación 1363612 quedó **para revisión**, nunca recibida.
- Trekking Paradise EXPRESS, Buenos Aires to Rio y River Plate quedaron "no cargado".
- El Overland de TourRadar 1376833 quedó como CHB31 (propuesta de la IA, confianza 0,93) y pide el
  vuelo de llegada a Calama.

**No coincide (hallazgos, no se forzó nada):**
1. **Kilroy OD010D (DK1564627) quedó "recibida"**, y la ficha esperaba "para revisión: falta el
   vuelo". El mail no trae vuelos, pero OD010D no pide ningún vuelo en el catálogo. Lo mismo pasó
   con un mail real de OD010C (DK1587664). Hay que confirmar si Iguazú necesita el vuelo de llegada.
2. **TourRadar 1377598 no se emparejó con AR09.** El PDF no trae el número de tour (150146), y la
   IA sugiere AR09 con 0,82, por debajo de 0,90. Se arregla cargando el nombre "Patagonia
   Adventure Tour 16 Days" como nombre de TourRadar para AR09: así entra por nombre, sin IA.
3. **"varias": la IA dudó de la cantidad de pasajeros** en las 3 reservas. Por eso la de OD010D
   quedó para revisión, pero por pax y no por vuelo.
4. Se sumó un ejemplo nuevo que la ficha no tenía: el **Overland reverse (BOCHI04R)**, que se
   reconoció por el código y pide el vuelo de salida de Calama.

**Para cargar** (lo pide el owner o se confirma con él):
- `HI_ARGENTINA_IGUAZU_BR_4DAYS-677` ("Iguazu Falls on a Shoestring - 4 Days - Start in
  Brazil"): ¿es OD010B? Llegó 2 veces en dos días.
- `HI_ARGENTINA_SAN_PEDRO_ATACAMA_4DAYS-677` ("San Pedro de Atacama Explorer - 4 Days").
- OD014 ("El Calafate & El Chalten full day - 4 nights").

## Sonnet contra Opus

Mismo set de evaluación (6 mails validados por el owner), corrido hoy con cada modelo:

| | Sonnet 5.5 | Opus 5.5 |
|---|---|---|
| Aciertos totales | **100%** | 64,3% |
| Costo de la corrida | US$ 0,14 | US$ 0,20 |

Opus no leyó los 2 PDF de TourRadar: con su precio (el doble), el peor caso de esos mails pasa el
tope de US$ 0,10 por mail y quedan para revisión sin gastar. De los 4 que leyó, erró en un dato
(la fecha de llegada de los vuelos de Journaway quedó vacía). **Recomendación: seguir con
Sonnet 5.5.** El cambio de modelo se decide con el OK del owner y se anota en `DECISIONS.md`.

## Lo que falta para la medición

El % que necesita corrección sale de la marca del owner en cada reserva ("Está bien" / "Hay que
corregir"). Todavía no hay marcas: las 24 están sin revisar. Si más del 20% de las revisadas está
mal, se frena y no se activa la lectura automática (M2-07).
