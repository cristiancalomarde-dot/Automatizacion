# M3-24 · Diagnóstico de los avisos del itinerario (blackouts, fechas especiales, buses)

Lo armé el 2026-10-26 solo con las fuentes. **No escribí en ninguna base**, no corrí ningún importador, no llamé
a la IA y no escribí los CSV definitivos: abajo van como propuesta.

Leí:
- los cinco Word del clon (Multi Destination, Two Destination, One Destination, Unique Tours y el de precios de
  Journaway 2027), buscando "Blackout", "Validity", "Can't begin", "NOT on", "Runs all year round", días de la
  semana y "Not running";
- `RutasenBus2020.xls`, hoja "Buses para Tours" (y "Tours 2027", que solo tiene un horario de días para
  SLA - SPA, de ARCHB33, que no está cargado);
- el Excel de paquetes vigente (no tiene ningún blackout ni feriado);
- la lista de lo cargado: `data/paquetes-piloto.csv`, `TOURS_PILOTO` del importador de tours (11 tours) y los
  productos de Journaway (`data/journaway-*.csv`);
- el armado de AR10 para la #1389186 (`M3-23-carga.md`).

## En corto

- Los Word tienen **52 líneas "Blackout"**. **8 son de productos cargados** (AR10, AR09, ARCH31, ARBR23,
  BRARCH26, 5C01, OD013, OD032). Las otras 44 son de productos no cargados (lista al final).
- Además de las líneas "Blackout", hay restricciones de fecha escritas de otra forma en productos cargados:
  "Arrival to Salta NOT on Tuesdays" (AR10), "Can´t Begin Tuesdays" (BRARCH26, dentro de su línea de
  blackout), la **"Validity"** de temporada de ARCH33, ARCH33EXP, CH10 y CH11, y tres de Journaway (Salt Flats
  que no opera 25 y 31 dic y 1 ene; Jesuit Ruins solo lun/mié/sáb; W-Trek 1 oct – 26 abr).
- **Las fechas de Carnaval y Semana Santa de los Word son las de 2027.** Coinciden exactas con la Pascua
  2027 (28 mar): "04 Feb – 15 Feb" = jueves anterior al Carnaval → lunes siguiente; "22-28 March" = lunes
  Santo → domingo de Pascua. En 2028 la Pascua es el 16 abr y el Carnaval el 28-29 feb: con fechas fijas, una
  salida a Río el 26 feb 2028 no avisaría. Propongo cargarlas **relativas a la Pascua** (pregunta 3).
- **Buses:** la hoja "Buses para Tours" tiene días **solo para un tramo: "RGL - USH lu-mie-vie"**. Lo usan AR09
  y AR10. Ningún otro tramo de los tours cargados tiene días.
- **#1389186 (AR10, 2 pax, sale sáb 19 dic 2026):** saldrían **3 avisos**: Bodegas el jue 24 dic (Navidad),
  Alta Montaña el vie 25 dic (Navidad) y el bus Río Gallegos → Ushuaia el mar 5 ene (sale lun/mié/vie).
  Ningún blackout. Son los mismos tres que vio el loop a mano.
- **Preguntas: 8**, en una sola lista al final.

## Cómo leí los formatos del Word

- **"From 1st April to 1st October"** = del 1 abr al **30 sep**: el día "to" ya vale. Sale del propio Word:
  ARCH31 dice "Blackout: From 1st May to 1st September" y "Validity: 1 September – 31 April", y OD013 dice
  "1 Abr – 30 Sep" para la misma temporada que AR10.
- **"Can´t begin the trip: …"** y **"Arrival to … NOT on …"** (día 1) = se mira solo la **fecha de salida**.
- **"Blackout during Carnaval (…), Reveillon (…)…"** (paquetes de Río) = el paquete no debería **estar** en
  esas fechas (pregunta 1).
- **"31 April"** de la Validity de ARCH31 es un typo de 30 abr; no cambia nada (el blackout empieza el 1 may).

## 1. Blackouts de cada producto cargado (propuesta de `data/blackouts.csv`)

Forma propuesta:

```
producto,tipo,desde,hasta,mira,nota
```

- `tipo`:
  - `rango`: fechas fijas `MM-DD` inclusive; puede cruzar el año (`12-27` → `01-03`).
  - `dia_semana`: `desde` = días en que **no** puede empezar (`mar`; o `dom mar jue vie`).
  - `feriado`: rango relativo a la Pascua del año de la salida: `desde`/`hasta` = días desde el domingo de
    Pascua (`P-53`, `P0`). Para los rangos de Carnaval y Semana Santa de los Word (pregunta 3).
- `mira`: `salida` (la salida del producto, o el inicio de su parte si va dentro de un tour) o `estadia`
  (cualquier día del producto). Pregunta 1.
- `nota`: la línea del Word y de qué bloque sale.

### Tours

| Producto | tipo | desde | hasta | mira | Línea del Word / interpretación |
|---|---|---|---|---|---|
| AR10 | rango | 04-01 | 09-30 | salida | "Blackout: From 1st April to 1st October due to winter season" |
| AR10 | dia_semana | mar | | salida | "Arrival to Salta NOT on Tuesdays" (día 1) |
| AR09 | rango | 04-01 | 08-31 | salida | "Blackout: From 1st April to 1st September due to winter season." |
| ARCH31 | rango | 05-01 | 08-31 | salida | "Blackout: From 1st May to 1st September due to winter season" |
| ARCH33 | rango | 05-01 | 10-31 | salida | Sin línea Blackout. "Validity: 1 November – 30 April" (pregunta 2) |
| ARCH33EXP | rango | 04-21 | 09-30 | salida | Sin línea Blackout. "Validity: 01 October – 20 April" (pregunta 2) |
| BRARCH26 | rango | 12-27 | 01-03 | salida | "Can´t begin the trip: 27 December – 3 January" |
| BRARCH26 | feriado | P-53 | P-47 | salida | "… // 03-09 February" (= 2027; pregunta 3) |
| BRARCH26 | feriado | P-6 | P0 | salida | "… // 22-28 March" (= 2027; pregunta 3) |
| BRARCH26 | dia_semana | mar | | salida | "Can´t Begin Tuesdays." |
| 5C01 | rango | 12-27 | 01-03 | salida | "Can´t begin the trip: 27 December – 3 January … (Reveillon, Carnaval and Easter Holidays in Rio)" |
| 5C01 | feriado | P-53 | P-47 | salida | "03-09 February" (= 2027) |
| 5C01 | feriado | P-6 | P0 | salida | "22-28 March" (= 2027) |
| ARBR23 | rango | 12-17 | 12-27 | salida | "Can´t begin the trip: 17 December – 27 December" |
| ARBR23 | feriado | P-60 | P-50 | salida | "27 January - 06 February" (= 2027) |
| ARBR23 | feriado | P-6 | P0 | salida | "22 – 28 March" (= 2027). **Parece no corrida** (pregunta 4) |
| ARUY01 | — | | | | Sin blackout ("Validity: 1 January – 31 December") |
| CHB31 | — | | | | Sin blackout ("Validity: 1 January – 31 December") |
| BOCHI04R | — | | | | Sin blackout ("Validity: 1 January - 31 December") |

Nota: las líneas de blackout que aparecen justo después de ARUY01 y de BOCHI04R en el Word son de los bloques
siguientes (BR03 y BR04; BR30), que no están cargados.

### Paquetes (valen vendidos solos y al inicio de su parte dentro de un tour, como dice la ficha)

| Producto | tipo | desde | hasta | mira | Línea del Word / interpretación |
|---|---|---|---|---|---|
| OD013 | rango | 04-01 | 09-30 | salida | "*Blackout due to winter season: 1 Abr – 30 Sep (… the Torres del Paine tour can`t be provided …)" |
| OD032 | feriado | P-52 | P-41 | estadia | "Blackout during Carnaval (04 Feb – 15 Feb)" (= 2027) |
| OD032 | rango | 12-28 | 01-02 | estadia | "Reveillon (28 Dec – 2 Jan)" |
| OD032 | feriado | P-5 | P0 | estadia | "Easter Holidays (23 to 28 March)" (= 2027) |
| OD032 | rango | 09-01 | 09-20 | estadia | "Festivals in Rio (1-20 September)" (pregunta 3) |
| CH10 | rango | 04-27 | 09-30 | salida | Sin línea Blackout. "Validity: 1 October – 26 April" (pregunta 2) |
| CH11 | rango | 04-28 | 09-30 | salida | Sin línea Blackout. "Validity: 1 October – 27 April" (pregunta 2) |

Sin ninguna restricción de fecha en el Word: OD010A, OD010B, OD010C, OD010D, OD011, OD014 ("Runs all year
round"), OD016 ("Runs all year round"), OD017 ("Runs all year round"), OD018, OD019, OD020, OD022, OD024,
OD025, OD027, OD029, OD030, OD031 ("Runs all year round"), OD033 ("Runs all year round"), OD040, AR34
("Validity: 1 January – 31 December"). COMPCH01, COMPBO20, COMPBR10 y COMPUY03 no tienen bloque en los Word y
el Excel no trae fechas: sin blackout.

Ejemplo de lo que suma: **AR09 que sale el 20 ago** pasa el blackout del tour (termina el 31 ago), pero llega a
El Calafate (OD013) a fin de agosto, con Torres del Paine cerrado hasta el 30 sep: avisa por OD013.

### Journaway (Word de precios 2027)

| Producto | tipo | desde | hasta | mira | Línea del Word / interpretación |
|---|---|---|---|---|---|
| SPAE05 | rango | 12-25 | 12-25 | salida | Salt Flats Route Tour: "Not running: 25 and 31 December, 1 January" |
| SPAE05 | rango | 12-31 | 01-01 | salida | ídem. Dentro de SPAP02, SPAP03, SPAP04, SPAP05 y SPAP06 se mira la fecha de la excursión |
| IGRE03 | dia_semana | dom mar jue vie | | salida | "Ruinas de San Ignacio and Minas de Wanda IGRE03 full day, departures Mondays, Wednesdays and Saturdays" |
| PNTW01 | rango | 04-27 | 09-30 | salida | W-Trek Standard: "Validity: 01 October – 26 April"; "The self guided treks are offered between the 1st October and the 26th April" |
| PNTW02 | rango | 04-27 | 09-30 | salida | W-Trek Express: ídem |

El resto de los productos de Journaway (SPAP01, SPAT01/02, SPAE01-04/06/07, UYUO01, IGRE01/02, IGRT01,
IGRP01/02, FTE, USH, IPC, PNTE01) no tiene restricción de fecha en el Word. Todo lo de Journaway depende de la
pregunta 8.

## 2. Fechas especiales (propuesta de `data/fechas-especiales.csv`)

Pascua por computus: 2026 → 5 abr; **2027 → 28 mar**; 2028 → 16 abr; 2029 → 1 abr.

```
feriado,donde,regla,desde,hasta,nota
```

- `donde`: `todos` o una lista de destinos del catálogo (`RIO`, `SAO`, …). La fila más específica gana.
- `regla`: `fija` (`MM-DD`) o `pascua` (días desde el domingo de Pascua).

| feriado | donde | regla | desde | hasta | 2027 | De dónde sale |
|---|---|---|---|---|---|---|
| Navidad | todos | fija | 12-24 | 12-25 | 24-25 dic | Owner (ficha) |
| Año Nuevo | todos | fija | 12-31 | 01-01 | 31 dic – 1 ene | Owner (ficha) |
| Año Nuevo (Reveillon) | RIO | fija | 12-28 | 01-02 | 28 dic – 2 ene | Word, OD032 |
| Carnaval | todos menos Chile y Brasil | pascua | P-48 | P-47 | lun 8 – mar 9 feb | Feriado de lunes y martes (anexo de la ficha) |
| Carnaval | SAO (Brasil) | pascua | P-50 | P-46 | sáb 6 – mié 10 feb | Sábado a miércoles de Ceniza (pregunta 5) |
| Carnaval | RIO | pascua | P-52 | P-41 | jue 4 – lun 15 feb | Word, OD032 "Carnaval (04 Feb – 15 Feb)" |
| Semana Santa | todos | pascua | P-3 | P0 | jue 25 – dom 28 mar | Jueves Santo a domingo de Pascua (pregunta 5) |
| Semana Santa | RIO | pascua | P-5 | P0 | mar 23 – dom 28 mar | Word, OD032 "Easter Holidays (23 to 28 March)" |
| Semana Santa (de Turismo) | COL MVD | pascua | P-6 | P0 | lun 22 – dom 28 mar | Uruguay: toda la semana (pregunta 5) |

- Qué se mira: cada servicio con día (excursión, traslado, bus) contra el destino de su paquete; el bus,
  contra su ciudad de salida.
- Chile no tiene feriado de Carnaval: sin fila (pregunta 5).
- 2028 de ejemplo: Carnaval Río 24 feb – 6 mar; Carnaval AR 28-29 feb; Semana Santa 13-16 abr.

## 3. Días de operación de los buses de los tours

La hoja "Buses para Tours" tiene una sola ruta con días: **fila 16, "RGL - USH lu-mie-vie"**. El resto no dice
nada. Si nadie agrega días, los tomo como diarios (sin aviso).

| Tramo del catálogo | Tours | Fila de la hoja | Días |
|---|---|---|---|
| Río Gallegos → Ushuaia | AR09 (día 13), AR10 (día 18) | 16 "RGL - USH lu-mie-vie" | **lun, mié, vie** |
| El Calafate → Río Gallegos (3 am) | AR09, AR10 | 15/22 "RGL - FTE" (al revés) | sin días (pregunta 7) |
| Río Gallegos → El Calafate | AR09 | 15/22 "RGL - FTE" | sin días |
| Buenos Aires → Puerto Madryn | AR09 | 13 "BUE - PMY" | sin días |
| Puerto Madryn → Río Gallegos | AR09 | 14 "PMY - RGL" | sin días |
| Salta → Mendoza | AR10 | 7 "SLA - MDZ" | sin días |
| Mendoza → Bariloche | AR10 | 11 "MDZ - BRC" | sin días |
| Bariloche → El Chaltén | AR10 | 17 "BRC - CHA" | sin días |
| El Chaltén → El Calafate (Chalten Travel, del OD033) | AR10, ARCH31, ARCH33, ARCH33EXP | 26 "FTE - CHA" (al revés) | sin días |
| El Calafate → Puerto Natales | ARCH31, ARCH33, ARCH33EXP | 24 "FTE - PNT" | sin días |
| Puerto Natales → Punta Arenas (Kupos) | ARCH31, ARCH33, ARCH33EXP | 25 "PNT - Aep PUQ" | sin días |
| Buenos Aires ↔ Iguazú | ARBR23, BRARCH26, 5C01 | 5 "BUE - IGR" | sin días |
| Iguazú ↔ Río de Janeiro | ARBR23, BRARCH26 | 8/28 "IGU - RIO" | sin días |
| Buenos Aires → Mendoza | BRARCH26, 5C01 | 10 "BUE - MDZ" | sin días |
| Mendoza → Santiago | BRARCH26, 5C01 | 9 "MDZ - SCL" | sin días |
| Río → São Paulo | 5C01 | 49 "SAO - RIO BRL" (al revés) | sin días |
| São Paulo → Iguazú | 5C01 | 38 "IGU-SAO BRL" (al revés) | sin días |
| Santiago → Valparaíso (Kupos) | 5C01 | 40 "SCL Valparaiso" | sin días |
| Valparaíso → Calama | 5C01 | 41 "VLP CALAMA" | sin días |
| Calama → San Pedro (Kupos) | 5C01 | 42 "CALAMA SPA" | sin días |
| Uyuni ↔ La Paz (Imperio Inca) | CHB31, BOCHI04R, 5C01 | 56 "UYU - LPB" | sin días |
| Ferry Buenos Aires → Colonia | ARUY01 | 30 "Ferry BUE COL" | sin días |

Cómo se cruza:
- Cada tramo del catálogo (`tramo_bus`) tiene origen y destino con los códigos de `ciudades.ts`. Son los
  mismos de la hoja (la hoja escribe Iguazú como IGU o IGR; los dos son IGR).
- **El día que se mira es el de salida del bus.** El sentido importa: "RGL - USH" vale para Río Gallegos →
  Ushuaia. Ningún tour cargado hace Ushuaia → Río Gallegos.
- Propongo pasar los días a `data/dias-bus.csv` (`origen,destino,dias,nota`), con la nota de la celda de
  origen. RutasenBus está en Insumos y no se despliega, así que el armado no puede leer el xls. Hoy tendría
  una sola fila:
  `RGL,USH,lun mié vie,"RutasenBus, Buses para Tours, fila 16: RGL - USH lu-mie-vie"`.
- El Word de AR09 y de AR10 confirma el problema: "bus services between El Calafate and Ushuaia are currently
  operating on a limited and variable schedule".
- Journaway tiene otro bus con días, que no es de un tour: **BUS02 Punta Arenas ↔ Ushuaia**. Va de Punta
  Arenas a Ushuaia los días impares y de Ushuaia a Punta Arenas los días pares ("EVERY OTHER DAY Odd/Even DAY
  DEPARTURES"). Necesita otro tipo de día: `impares` / `pares` (pregunta 8).
- Afuera, porque no hay tours cargados que lo usen: Navimag (solo martes; ARCH35, CH08), SLA - SPA (horario en
  "Tours 2027" de ARCHB33, "LU MI VIE DOM") y el shuttle Jericoacoara (BR30).

## 4. #1389186: AR10, 2 pax, salida sábado 19 dic 2026

**Blackouts: ninguno.**
- AR10: 19 dic está fuera de 1 abr – 30 sep, y es sábado, no martes.
- Partes: OD027, OD019, OD024 y OD022 no tienen blackout. OD033 "runs all year round". OD013 empieza el 2 ene,
  fuera de 1 abr – 30 sep.

**Fechas especiales: 2 avisos** (Navidad y Año Nuevo, regla de Argentina; Carnaval y Semana Santa 2027 caen
después del viaje).

| Servicio | Fecha | ¿Aviso? |
|---|---|---|
| Traslado de llegada a Salta | sáb 19 dic | no |
| Salinas y Purmamarca / Humahuaca | 20 y 21 dic | no |
| Bus Salta → Mendoza (nocturno) | sale mié 23 dic, llega el 24 | no (pregunta 6) |
| **Bodegas (Huentata, 14:30)** | **jue 24 dic** | **sí, Navidad** |
| **Alta Montaña (Huentata)** | **vie 25 dic** | **sí, Navidad** |
| Bus Mendoza → Bariloche (nocturno) | sáb 26 dic | no |
| Circuito Chico / Isla Victoria | 28 y 29 dic | no |
| Bus Bariloche → El Chaltén (noche en el bus) | sale mié 30 dic, llega el 31 | no (pregunta 6: con "también la llegada", avisaría Año Nuevo) |
| Bus El Chaltén → El Calafate (8 am) | sáb 2 ene | no |
| Torres del Paine / Perito Moreno | 3 y 4 ene | no |
| Bus El Calafate → Río Gallegos (3 am) | mar 5 ene | no (sin días en la hoja) |
| Bus Río Gallegos → Ushuaia | mar 5 ene | ver buses |
| PN Tierra del Fuego / Lobos marinos / traslado de salida | 6, 7 y 8 ene | no |

**Buses: 1 aviso.**
- Río Gallegos → Ushuaia el **martes 5 ene 2027**; la hoja dice lun/mié/vie.

Lo que vería el operativo en el bloque amarillo:
1. "Bodegas (Mendoza) cae jueves 24 dic, Navidad: confirmá con Huentata que opera."
2. "Alta Montaña (Mendoza) cae viernes 25 dic, Navidad: confirmá con Huentata que opera."
3. "El bus Río Gallegos → Ushuaia cae martes 5 ene; según la planilla sale lun/mié/vie."

## 5. Lo que necesito que me confirmes

1. **Blackouts "during" de los paquetes de Río: ¿se mira la salida o toda la estadía?**
   - La ficha dice "la salida (o el inicio de una parte)". Para "Can´t begin the trip" y las temporadas de los
     tours, eso es lo que dice el Word.
   - Pero OD032 dice "Blackout **during** Carnaval (04 Feb – 15 Feb)…". Si se mira solo la salida, un OD032
     del 2 al 5 feb no avisa, aunque pasa por el Carnaval.
   - **Sugerido:** "Can´t begin", "NOT on" y las temporadas de los tours → solo la salida. "Blackout during"
     (OD032) → cualquier día de la estadía.
   - De dónde sale: la redacción de cada línea en los Word.
2. **¿La "Validity" de temporada cuenta como blackout?**
   - ARCH33 (1 nov – 30 abr), ARCH33EXP (1 oct – 20 abr), CH10 (1 oct – 26 abr) y CH11 (1 oct – 27 abr) no
     tienen línea "Blackout"; la temporada está solo en la "Validity". El W-Trek de Journaway dice lo mismo
     (1 oct – 26 abr).
   - **Sugerido: sí.** Salir fuera de la validez avisa como blackout de temporada, cada producto con su fecha
     tal cual está escrita. Ojo: ARCH33 dice 1 nov y su CH10, 1 oct. Si ARCH33 sale el 15 oct, avisa por
     ARCH33 y no por CH10.
   - De dónde sale: las líneas "Validity" de esos bloques y el Word de Journaway ("The self guided treks are
     offered between the 1st October and the 26th April").
3. **Fechas de Carnaval y Semana Santa escritas para 2027.**
   - Todas las de los Word coinciden con la Pascua 2027: Río 4-15 feb y 23-28 mar; "Can´t begin" 03-09 feb y
     22-28 mar; ARBR23 27 ene – 6 feb. AR28, que no está cargado, lo dice explícito: "02 Feb – 10 Feb 2027".
   - **Sugerido:** cargarlas relativas a la Pascua (por ejemplo, Río = 52 a 41 días antes de Pascua), para que
     en 2028 sigan solas el calendario (Carnaval 28-29 feb, Pascua 16 abr). En el Word no cambia nada.
   - Aparte, OD032 tiene "Festivals in Rio (1-20 September)". **Sugerido:** cargarlo fijo todos los años,
     salvo que sea un festival de un año puntual (por ejemplo, Rock in Rio). En ese caso decime de qué años.
4. **ARBR23: la Semana Santa parece no estar corrida.**
   - ARBR23 llega a Río el día 9. Por eso sus rangos de Reveillon (17-27 dic) y Carnaval (27 ene – 6 feb)
     están corridos unos 8 días antes que los de Río. Pero el de Semana Santa es el mismo de los tours que
     empiezan en Río: "22 – 28 March". Con ese rango, el Río de ARBR23 cae del 30 mar al 2 abr, después de
     Pascua.
   - **Sugerido:** corregirlo en el Word a **12 – 20 March** (2027) y cargarlo relativo a la Pascua. Así ARBR23
     no está en Río entre el 23 y el 28 de marzo. Si preferís, lo cargo tal cual está.
   - De dónde sale: el bloque de ARBR23 (Multi Destination) y el rango de Río de OD032.
5. **Fechas especiales fuera de Argentina.** Los Word solo dan el rango de Río.
   - **Sugerido:**
     - São Paulo: Carnaval de sábado a miércoles de Ceniza (feriado de Brasil).
     - Iguazú (los dos lados): como Argentina.
     - Uruguay (Colonia, Montevideo): la Semana de Turismo entera, de lunes a domingo.
     - Chile: sin Carnaval (no es feriado allá).
     - Resto (Argentina, Chile, Bolivia): Semana Santa de jueves Santo a domingo de Pascua; Carnaval lunes y
       martes.
   - De dónde sale: no lo resuelve ninguna fuente; son los feriados oficiales de cada país.
6. **Buses nocturnos: ¿se mira la fecha de salida o también la de llegada?**
   - **Sugerido: solo la salida**, para fechas especiales y para días de operación. Es el día en que el bus
     tiene que salir.
   - En la #1389186, el bus Bariloche → El Chaltén sale el 30 dic y llega el 31: con lo sugerido, no avisa
     Año Nuevo. Si preferís que avise, sumo también la llegada.
7. **El Calafate → Río Gallegos de las 3 am (AR09, AR10): ¿tiene días?**
   - La hoja solo pone días al Río Gallegos → Ushuaia. Es la conexión del mismo viaje.
   - **Sugerido:** tomar como diarios todos los tramos sin días en la hoja. Si alguno tiene días, agregalos en
     la celda de la ruta, como "RGL - USH lu-mie-vie", y los paso a `data/dias-bus.csv`.
8. **Journaway: ¿sus restricciones de servicio entran en esta pieza?**
   - Del Word de precios de Journaway 2027:
     - Salt Flats Route (SPAE05): no opera el 25 y el 31 dic ni el 1 ene. Está dentro de SPAP02 a SPAP06.
     - Jesuit Ruins (IGRE03): solo lunes, miércoles y sábados.
     - W-Trek (PNTW01 y PNTW02): 1 oct – 26 abr.
     - BUS02 Punta Arenas ↔ Ushuaia: días impares a Ushuaia, pares a Punta Arenas.
   - **Sugerido: sí.** Las tres primeras son las mismas formas de aviso (rango, día de semana). El bus suma
     "días pares/impares".
   - De dónde sale: el Word "San Pedro de Atacama, Iguazu, Patagonia and Easter Island Prices for Journaway
     2027".

---

## Anexo: líneas "Blackout" de productos no cargados (44)

No se interpretan en esta pieza; entran como filas del CSV cuando se cargue el producto.

- **Multi Destination:**
  - ARCHB33, AR32, AR11, AR12, AR08, CH17, ARCH35, BR03, BR04, BR20, ARCH31R y BR30: 1 línea cada uno.
  - BCHAR10, BCHAR11, BCHAR12, BCHARBR10, ARCH20 y BR19: 2 cada uno.
  - ARCHB34: 3.
  - Además: "Arrival to Buenos Aires (NOT on Wednesdays)" (AR06, AR05), "(not on Tuesdays)" (AR07),
    "Arrival in Puerto Iguazu (NOT on Fridays)" (AR03), "Can not begin the trip arriving to La Paz on
    WEDNESDAYS" (BCHAR10-12), "Departures: Every day except Fridays" (ARCHB33), "Everyday except Mondays"
    (ARCHB34) y Navimag solo martes (ARCH35, CH08).
- **One Destination:** OD015 ("No Blackouts"), OD037, OD036, OD034, OD035, ODBR15, ODBR16, BR052 y ODBR50.
- **Two Destination:** ARCH27, AR13, CH13, BR051, BR18, BR17 y BR010. También "Arrival to Buenos Aires (NOT on
  Wednesdays)" de AR16.
- **Unique Tours:** AR28 ("Carnaval: 02 Feb – 10 Feb 2027", el único que escribe el año).

## Anexo técnico (para la fase B)

- **Fuentes:** el texto de los .docx sale de `word/document.xml` (`unzip -p` + quitar etiquetas). El bloque de
  cada producto va desde su encabezado ("CODIGO- Nombre") hasta el siguiente. Hay encabezados sin guion
  ("CHB31 Overland…", "CH08 All Chile…", "BR30 Fortaleza…") y uno que empieza con número ("5C01-"). Si el
  bloque se corta mal, las líneas se asignan al producto anterior.
- **Pascua:** computus (Meeus/Jones/Butcher). Verificado: 2026-04-05, 2027-03-28, 2028-04-16, 2029-04-01.
  Carnaval = P-48/P-47.
- **Fechas de #1389186 para el test** (de `M3-23-carga.md`): Bodegas 2026-12-24 (jue), Alta Montaña
  2026-12-25 (vie), RGL → USH 2027-01-05 (mar).
- **Unitarios de la ficha:**
  - "AR10 en junio avisa / 19 dic no": `AR10,rango,04-01,09-30`.
  - "Can't begin Tuesdays en martes avisa": BRARCH26.
  - "Carnaval 2027 calculado bien": Argentina 8-9 feb; Río 4-15 feb.
