# M3-23 · Diagnóstico de AR10 Full Argentina Adventure – Route 40

Lo armé el 2026-10-26 solo con las fuentes. **No escribí en ninguna base** (ni en la de pruebas ni en la real), no corrí ningún importador y no llamé a la IA. Para ver qué haría el armado de tours con AR10, corrí una simulación en memoria, sin base.

Leí estas fuentes:
- el Word de Multi Destination (bloque "AR10- Full Argentina Adventure – Route 40 (20 nights)");
- el Excel de paquetes vigente (`Construccion de Paquetes 2019 con 3 y 4 estrellas.xls`, hojas "Analisis a Mayo 2026" y "Readme AI");
- `RutasenBus2020.xls` (hojas "Tours 2027" y "Buses para Tours");
- el directorio `Proveedores Hi Travel 2026 para IA.xlsx`;
- `Codigos Productos Tourradar.xlsx`;
- `Listado Ids de TourRadar … links de wetu.xlsx` y `Borrador codigos TourRadar.xlsx`. Estos dos están solo en la carpeta de Drive, no en el clon;
- las reglas de `data/*.csv`.

## En corto

- **AR10 se puede armar con las fuentes.** Está en RutasenBus (filas 94-104) con estos componentes: **OD027** Salta, **OD019** Mendoza, **OD024** Bariloche, El Chaltén (columna sin código), **OD013** El Calafate (menos 1 noche) y **OD022** Ushuaia. Entre ellos van cuatro columnas de buses.
- **Paquetes nuevos: 2.** Los dos tienen su bloque en el Excel:
  - **OD027** Salta and Jujuy, Northwest Argentina (4 noches: 3 en Salta + 1 en Purmamarca). Bloque en la fila 316.
  - **OD024** Bariloche, Patagonian Lakes (3 noches). Bloque en la fila 388.
- **Ya cargados que sirven:**
  - **OD019** Mendoza con 2 noches en lugar de 3.
  - **OD033** El Chaltén con 2 noches en lugar de 3.
  - **OD013** El Calafate con 3 noches en lugar de 4. Trae Perito Moreno y Torres del Paine, que son las dos excursiones de AR10.
  - **OD022** Ushuaia, tal cual (3 noches).
  - **OD016 no sirve:** no trae Torres del Paine.
- **Noches:** 17 en alojamientos más 3 en bus (días 5, 8 y 12) dan las 20 del título. Coinciden el Word, el Excel y los costos de RutasenBus. Hay una diferencia en RutasenBus (Mendoza y El Chaltén), que es la pregunta 1.
- **Código TourRadar: 152848**, "Full Argentina Adventure ( 21 Days )". Sale del listado de IDs y del borrador de códigos, que lo empareja con AR10 con confianza alta (pregunta 6). **Kilroy:** AR10 no figura en ninguna fuente ni en ningún mail.
- **Proveedores:** casi todos están en el directorio con mail. Faltan Trotamundos Salta (el Hostel de Salta), Achalay Hostel y NH Edelweiss (Bariloche). Hotel Plaza Bariloche, que se pide a Grupo Tierra Gaucha, tiene el mail del grupo en otra fila (pregunta 5).
- **Preguntas: 6** (abajo, en una sola lista).

## Parte por parte (salida del 19 dic 2026, la de la reserva #1389186)

| Días | Parte | Noches | Fechas | Componente |
|---|---|---|---|---|
| 1-5 | Salta + Purmamarca | 4 (Salta 1, Purmamarca 1, Salta 2) | sáb 19 → mié 23 dic | **OD027** (nuevo) |
| 5 → 6 | Bus nocturno Salta → Mendoza (cama) | 1 en el bus | mié 23 → jue 24 dic | tramo de bus |
| 6-8 | Mendoza | 2 | jue 24 → sáb 26 dic | **OD019** con 2 noches |
| 8 → 9 | Bus nocturno Mendoza → Bariloche (cama) | 1 en el bus | sáb 26 → dom 27 dic | tramo de bus |
| 9-12 | Bariloche | 3 | dom 27 → mié 30 dic | **OD024** (nuevo) |
| 12 → 13 | Bus Bariloche → El Chaltén (noche en el bus) | 1 en el bus | mié 30 → jue 31 dic | tramo de bus |
| 13-15 | El Chaltén, sin desayuno | 2 | jue 31 dic → sáb 2 ene | **OD033** con 2 noches |
| 15 | Bus El Chaltén → El Calafate | — | sáb 2 ene | bus del OD033 (Chalten Travel) |
| 15-18 | El Calafate | 3 | sáb 2 → mar 5 ene | **OD013** con 3 noches |
| 18 | Bus El Calafate → Río Gallegos → Ushuaia (sale 3:00 am) | — | mar 5 ene | tramo de bus |
| 18-21 | Ushuaia | 3 | mar 5 → vie 8 ene | **OD022** |

### Salta + Purmamarca · OD027 (nuevo, 4 noches)

Bloque del Excel en la fila 316. Su itinerario coincide con el de AR10:

| Día | Qué |
|---|---|
| 1 | Airport pickup y día libre |
| 2 | Salinas y Purmamarca, noche en Purmamarca |
| 3 | Humahuaca |
| 4 | Día libre en Salta |
| 5 | Salida |

Alojamiento:

| Nivel | Salta (noches 1, 3 y 4) | Purmamarca (noche 2) |
|---|---|---|
| Hostel | Trotamundos Salta (**sin mail en el directorio**, pregunta 5) | Posta de Purmamarca / Casa de Adobe |
| Hotel 3\* | Hotel 3\* Inkai (info@hotelinkai.com) | ídem |
| Hotel 4\* | Brizo Salta (reservas.salta@brizohoteles.com) / Design Suites Salta (reservas.sla@gruposolanas.com) | ídem |

Cómo se arma la estadía:
- **Purmamarca usa los mismos hoteles en todos los niveles.** Es un solo renglón, "Posta de Purmamarca / Casa de Adobe", con un costo de 185 por habitación. Mails: consultas@postadepurmamarca.com.ar e info@casadeadobe.com.ar.
- **Dorm Hostel en Purmamarca:** según los costos del Excel, ese pasajero paga la habitación entera (3 × 21 + 185 = 250). O sea que en Purmamarca no hay dorm y se le pide una habitación para él solo, como en Colonia en ARUY01. Si no es así, avisame.
- **Salta se pide en dos estadías,** como el Puerto Natales de CH10: noche 1, y noches 3 y 4. Las opciones de hotel son las mismas. El Word dice que el pasajero deja el equipaje en el alojamiento de Salta, duerme en Purmamarca y vuelve "to the same accommodation".

Servicios (todos de La Ciénaga, florencia@lacienagaturismo.com.ar):
- **Salinas y Purmamarca, el día 2.**
- **Humahuaca, el día 3.**
- **Traslado aeropuerto – alojamiento – aeropuerto.** En AR10 solo se usa la llegada (pregunta 3).

### Bus nocturno Salta → Mendoza

- Lo emite HI Travel (tarea manual), como los demás buses entre componentes (ARBR23, AR09).
- "Buses para Tours" tiene el costo (SLA - MDZ, 165.000 ARS) pero no nombra proveedor.

### Mendoza · OD019 con 2 noches (ya cargado)

- **Niveles:** Hostel Lagares, Hotel 3\* Argentino y Hotel 4\* NH Cordillera / MOD. Los mismos proveedores que ya están cargados.
- **Sin traslados.** El Word excluye los traslados desde y hacia las terminales, y RutasenBus usa el costo "No Transfers".
- **Excursiones (Huentata):** Bodegas el día 6, a las 14:30 (día 1 de la estadía), y Alta Montaña el día 7 (día 2). Coincide con la regla que ya está en `dias-servicio.csv` (owner, 2026-10-22).
- **Por qué 2 noches:** el costo de RutasenBus (192 por el Dorm) es el precio de 3 noches menos una noche extra. Pero la celda dice "OD019" y no "(menos 1 noche)". Es la pregunta 1.

### Bus nocturno Mendoza → Bariloche (cama)

- Lo emite HI Travel (tarea manual). Costo: MDZ - BRC, 210.000 ARS.

### Bariloche · OD024 (nuevo, 3 noches)

Bloque del Excel en la fila 388. Su itinerario coincide con el de AR10:

| Día del paquete | Qué |
|---|---|
| 1 | Llegada |
| 2 | Campanario y Circuito Chico |
| 3 | Isla Victoria y Arrayanes |
| 4 | Salida |

Alojamiento:

| Nivel del paquete | Hotel | Quién lo reserva |
|---|---|---|
| Hostel | Periko´s / Achalay Hostel | Periko´s (infoperikos@gmail.com // denalibarilochesrl@gmail.com). Achalay **sin mail** |
| Budget Hotel | Hotel Plaza Bariloche | Grupo Tierra Gaucha (pregunta 5) |
| Hotel 3\* | Kenton Palace / Carlos V | Kenton (reservas@kentonpalace.com.ar) / Carlos V (info@carlosvpatagonia.com.ar) |
| Hotel 4\* | Design Bariloche / NH Edelweiss | Design Suites (reservas.brc@gruposolanas.com). NH Edelweiss **sin mail** |

Excursiones (Turacción, info@turaccion.com.ar):
- **Circuito Chico, el día 10, a las 14:30 (día 2 de la estadía).** El Excel dice "en inglés, sin ticket al Campanario": la aerosilla la paga el pasajero.
- **Isla Victoria y Bosque de Arrayanes con traslados, el día 11, a eso de las 9:00 (día 3).**

Traslados y niveles:
- **En AR10 no hay traslados.** Se llega y se sale en bus, y RutasenBus usa el costo "sin transfers". OD024 vendido solo sí trae el traslado del aeropuerto (Turacción).
- **Niveles en AR10 según los costos de RutasenBus** (pregunta 2):
  - El "Hotel 3\*" del tour es el **Budget** del paquete (Hotel Plaza): 349 / 518 = Budget sin transfers.
  - El "Hotel 4\*" del tour es el **Hotel 3\*** del paquete (Kenton / Carlos V): 406 / 631.

### Bus Bariloche → El Chaltén (noche en el bus)

- Lo emite HI Travel (tarea manual). Costo: BRC - CHA, 337.500 ARS. Ninguna fuente nombra proveedor.
- El Word avisa que el horario cambia todos los años.

### El Chaltén · OD033 con 2 noches (ya cargado)

- **RutasenBus no le pone código:** la columna dice "2 NT CHA" (pregunta 1). El costo es solo alojamiento: 2 × la noche extra de OD033 (Dorm 93 = 2 × 46; DBL Hostel 175 = 2 × 88).
- **Hotel 3\* y Hotel 4\* del tour = Budget del OD033** (Kau Si Aike y similares). Cuestan lo mismo, 188 = 2 × 94. Es la misma regla que ARCH33 y ARCH33EXP; OD033 no tiene ni 3\* ni 4\* (pregunta 2).
- **Sin traslado de llegada:** viene en bus desde Bariloche.
- **Bus a El Calafate:** el del propio OD033 ("Public Bus El Chalten Bus Station - El Calafate Bus Station", Chalten Travel). Sale a las 8 am por defecto, por M3-20. Es igual que en ARCH33.
- El Word dice "no breakfast". La línea de Hostel del OD033 dice "Dorm con desayuno". Es un detalle de precio, no cambia el pedido.

### El Calafate · OD013 con 3 noches (ya cargado)

- **RutasenBus dice "OD013 (menos 1 noche)" y el costo lo confirma:** Dorm 396 = 427 − 31.
- **Niveles:**
  - Hostel: Pioneros / Calafate Hostel.
  - Hotel 3\*: Rincón / Sent (DBL 498 = 567 − 69).
  - Hotel 4\*: Mirador del Lago / Calafate Parque.
  - Son los niveles de OD013 tal cual.
- **Sin traslados:** llega en bus y sale en bus. El Word excluye los traslados desde y hacia la terminal de El Calafate.
- **Excursiones:** Torres del Paine el día 16 (South Road) y Perito Moreno el día 17 (Chalten Travel). **El orden está al revés de la regla general** de `dias-servicio.csv` (Perito Moreno el día 2 y Torres del Paine el día 3). Es la pregunta 4.

### Bus El Calafate → Río Gallegos → Ushuaia

- Lo emite HI Travel (tarea manual).
- Check-out a las 2 am y salida a las 3 am. Conexión en Río Gallegos a las 8:30 o 9 am.
- "Buses para Tours" dice **"RGL - USH lu-mie-vie"** (ver avisos para #1389186).

### Ushuaia · OD022 (ya cargado, 3 noches)

- **Niveles:** Hostel Anum / Antarctica, Hotel 3\* Los Naranjos / Altos de Ushuaia, Hotel 4\* Albatros / Los Acebos / Las Hayas. RutasenBus usa el costo de OD022 tal cual (287 / 419 / 513).
- **Traslado:** solo el de salida al aeropuerto, el día 21 (Rumbo Sur). Llega en bus, y la terminal no está incluida. Es el último componente, igual que en AR09.
- **Excursiones (Rumbo Sur):** PN Tierra del Fuego el día 19 (día 2 de la estadía) y Lobos marinos el día 20 (día 3). **Al revés de la regla general** (Beagle el día 2, Parque el día 3). Es la pregunta 4.
- **Opcional "PN con trekking y canoa" (+167):** ya está en el bloque de OD022 como "Optional Excursion… Booking Supplier: Canal Fun". Queda afuera de esta pieza, como dice la spec.

## Avisos para la reserva #1389186 (no son del catálogo)

1. **Bus Río Gallegos → Ushuaia, martes 5 ene 2027 (día 18).** "Buses para Tours" dice que ese tramo sale lunes, miércoles y viernes. El Word (Important Note II) avisa que, si ese día no hay bus, se reacomoda el itinerario. Hay que revisarlo antes de confirmar.
2. **Mendoza en Navidad.** Bodegas va el jueves 24 dic y Alta Montaña el viernes 25 dic. Conviene confirmar con Huentata que operan esos días.
3. **El Chaltén el 31 dic** (llegada en el bus desde Bariloche) y **Salta desde el sábado 19 dic.** El Word pide no llegar a Salta un martes; esta reserva cumple.

## Inconsistencias entre las fuentes

1. **RutasenBus, fila 96** (pregunta 1):
   - La columna E ("2 NT CHA") no tiene código.
   - La columna I dice "OD019" sin "(menos 1 noche)", pero el Word y el costo dicen 2 noches.
   - Con la fila así, el armado manda AR10 a revisión.
2. **Traslado de llegada en Salta** (pregunta 3):
   - El día 1 del Word lo da ("Transfer from Airport to accommodation").
   - El "Included" no lo lista.
   - RutasenBus usa el costo de Salta "sin transfers" (443 / 342 / 469).
3. **Orden de las excursiones en El Calafate y en Ushuaia.** El Word de AR10 las invierte respecto de la regla general que ya está cargada (pregunta 4).
4. **Hostel de Bariloche:** la tabla de precios de OD024 dice "Tangoinn or Periko´s"; la línea de reserva dice "Periko´s / Achalay Hostel". Uso la línea de reserva, porque la hoja "Readme AI" dice que la sección 1 manda.
5. **"Las Marias Tilcara 150"** está en el bloque de OD027 sin "Accommodation:" ni "Booking Supplier". No aparece en el itinerario de OD027 ni en AR10, así que lo ignoro.
6. **Word, detalles de formato** (no cambian el armado, pero el lector los tiene que tolerar):
   - Los encabezados "DAY 8" y "DAY 11" están pegados al párrafo anterior ("Back to town at 7 - 8 pmDAY 8: Mendoza-Bariloche").
   - El día 12 dice "Night in the BUS". El lector actual no lo toma como bus nocturno, así que la simulación suma 18 noches en lugar de 20.
7. **Word, opcional de vuelo:** dice "Flight from Ushuaia to El Calafate instead of bus", pero el tour va de El Calafate a Ushuaia. Es un opcional y queda afuera.
8. **Directorio:** la copia de Drive (23 oct) es más nueva que la del clon (17 oct). Las diferencias son Las Torres / Vertice / Factoria y Hotel Oxford / Merit, y ninguna toca AR10. Los archivos de IDs de TourRadar (listado y borrador) están solo en Drive.

## Lo que necesito que me confirmes

1. **RutasenBus, fila 96: Mendoza y El Chaltén con 2 noches.**
   - La celda I96 dice "OD019" sin "(menos 1 noche)" y la E96 ("2 NT CHA") no tiene código.
   - **Sugerido:** corregís esas dos celdas en RutasenBus: I96 → "OD019 (menos 1 noche)" y E96 → "OD033 (menos 1 noche)". El armado de tours ya entiende esa anotación (la usa OD013 en esta misma fila).
   - Si preferís no tocar el Excel, lo cargo con una regla en `data/` con nota.
   - De dónde sale: el Included del Word (2 noches en Mendoza y 2 en El Chaltén) y los costos de RutasenBus (= noches extra de OD019 y OD033).
2. **Niveles de AR10 en El Chaltén y en Bariloche.** AR10 vende Hostel, Hotel 3\* y Hotel 4\*, pero esos dos paquetes no tienen los mismos niveles.
   - **Sugerido, según los costos de RutasenBus:**
     - **El Chaltén:** el 3\* y el 4\* del tour son el **Budget** del OD033 (Kau Si Aike / Poincenot / Fitz Roy / Vertical Lodge / El Paraíso), como en ARCH33.
     - **Bariloche:** el 3\* del tour es el **Budget** del OD024 (Hotel Plaza) y el 4\* del tour es el **Hotel 3\*** del OD024 (Kenton / Carlos V).
   - De dónde sale: RutasenBus, filas 101-104. El Chaltén cobra 188 para el 3\* y para el 4\* (= Budget de OD033). Bariloche cobra 349/518 (Budget) y 406/631 (3\*).
3. **Traslado de llegada en Salta.**
   - El día 1 del Word dice "Transfer from Airport to accommodation". El "Included" no lo lista y RutasenBus usa el costo de Salta sin traslados.
   - **Sugerido: pedirlo** a La Ciénaga, solo la llegada (el aeropuerto de Salta → el alojamiento). Es lo que lee el pasajero en su itinerario, y la regla de los tours ya le da el traslado de llegada al primer componente.
   - Si no va, hay que sacarlo del día 1 del Word.
4. **Días de las excursiones de El Calafate y de Ushuaia dentro de AR10.**
   - La regla general (owner, 2026-10-22/23) pone Perito Moreno el día 2 y Torres del Paine el día 3 en El Calafate, y en Ushuaia Beagle el día 2 y Parque el día 3. El Word de AR10 las invierte.
   - **Sugerido: seguir el Word solo en AR10** (salvo cambio manual):
     - El Calafate: Torres del Paine el día 16 y Perito Moreno el día 17.
     - Ushuaia: PN Tierra del Fuego el día 19 y Lobos marinos el día 20.
     - En el resto de los paquetes y tours no cambia nada.
   - Si preferís la regla general también en AR10, decímelo: el pasajero va a tener un orden distinto del de su itinerario.
5. **Contactos que faltan en el directorio.**
   - a. **Trotamundos Salta** (Hostel de OD027) no está. El único hostel de Salta en el directorio es Ferienhaus (reservas@ferienhaushostelsalta.com).
     - **Sugerido:** agregalo con su mail en la sección Salta. Mientras tanto, ese pedido sale con aviso de "sin mail".
     - Si en realidad el hostel de Salta hoy es Ferienhaus, decímelo y uso ese.
   - b. **Hotel Plaza Bariloche**, que se pide a "Grupo Tierra Gaucha". En el directorio, el mail del grupo (centralreservas@grupotierragaucha.com.ar) está en la fila "Hotel Concept Bariloche".
     - **Sugerido: usar ese mail** para Grupo Tierra Gaucha.
   - c. **Achalay Hostel** (2ª opción del Hostel de Bariloche) y **NH Edelweiss** (2ª opción del 4\* de OD024) no están.
     - **Sugerido:** agregalos cuando puedas. Hasta entonces se pide primero a Periko´s y a Design Suites, que van primeros en el orden de prioridad, y la 2ª opción sale con aviso de "sin mail".
     - Si se confirma la pregunta 2, AR10 no usa NH Edelweiss: solo lo usa OD024 vendido solo.
   - De dónde sale: Excel, filas 318-329 (OD027) y 390-412 (OD024). Directorio, secciones SALTA, PURMAMARCA y BARILOCHE.
6. **Código TourRadar de AR10.**
   - El listado de IDs de TourRadar tiene **152848 "Full Argentina Adventure ( 21 Days )"**, y el borrador de códigos lo empareja con AR10 con confianza "alta". La reserva #1389186 lo nombra "Full Argentina Adventure – 21 Days".
   - **Sugerido:** cargarlo en `codigos-tourradar.csv` como 152848 → AR10, con el nombre del statement, para que el emparejado lo reconozca por el nombre (el PDF no trae el número).
   - Kilroy no tiene código de AR10 en ninguna fuente: no cargo ninguno.

---

## Anexo técnico (para la fase B)

- **Simulación del armado (en memoria, sin base),** con los insumos reales y OD027/OD024 como si estuvieran cargados. AR10 queda "para revisar" por estos motivos:
  - el lector no conoce Salta, Purmamarca ni Bariloche;
  - El Chaltén no tiene código en RutasenBus;
  - el Word suma 18 noches en lugar de 20 (no detecta el bus nocturno del día 12, y los días 8 y 11 están pegados).
  - RutasenBus se lee bien: componentes OD013(−1), OD022, OD027, OD019 y OD024; categorías Hostel, Hotel 3\* y Hotel 4\*. Noches base del Excel: OD027 4, OD024 3, OD013 4, OD019 3, OD022 3, OD033 3.
- **`ciudades.ts`:** agregar salta → SLA, purmamarca → SLA (Purmamarca es parte de OD027: las dos estadías seguidas se suman, como en CH10) y bariloche → BRC, más `NOMBRE_DESTINO`.
- **`armado.ts` / `word.ts`:**
  - `NOCTURNO_DIA` no reconoce "Night in the BUS" (día 12).
  - Los encabezados "DAY 8" y "DAY 11" vienen pegados al párrafo anterior. Hay que partir "DAY N:" también en medio de un párrafo, o el control de "el bus cae el día que dice el itinerario" falla.
- **`paquetes-piloto.csv`:** OD027 (SLA, bloque en la fila 316) y OD024 (BRC, bloque en la fila 388).
- **`noches-servicio.csv`, OD027:**
  - Alojamiento de Salta (las líneas Trotamundos, Inkai y Brizo / Design): noche 1 (1 noche) y noche 3 (2 noches), como CH10.
  - "Posta de Purmamarca / Casa de Adobe": noche 2 (1 noche).
- **`niveles-confirmados.csv`:**
  - La línea de Purmamarca no tiene nivel y vale para los tres.
  - El Dorm va en habitación privada en Purmamarca, como Colonia en ARUY01.
  - Hay un typo: "Ho.tel 4\*Design Suites".
- **`categorias-tour.csv` (según la pregunta 2):**
  - AR10 / OD033: Hotel 3\* = Budget Hotel, y Hotel 4\* = Budget Hotel.
  - AR10 / OD024: Hotel 3\* = Budget Hotel, y Hotel 4\* = Hotel 3\*.
- **`dias-servicio.csv`:**
  - OD027: Salinas y Purmamarca el día 2, Humahuaca el día 3.
  - OD024: Circuito Chico el día 2, por la tarde (14:30); Isla Victoria el día 3 (~9:00).
  - La excepción de AR10 en OD013 y OD022 (pregunta 4) necesita una regla por tour: una columna `tour` con nota. Hoy el archivo es solo por paquete.
- **`equivalencias-proveedores.csv`:**
  - SLA: Trotamundos Salta (según la pregunta 5a), Hotel 3\* Inkai → Inkai Hotel, Brizo Salta → Brizo Hotel, Design Suites Salta, Posta de Purmamarca → Ecohotel Posta de Purmamarca, Casa de Adobe (está dos veces en el directorio, en Salta y en Purmamarca, con el mismo mail) y La Ciénaga.
  - BRC: Periko´s → Periko´s youth Hostel, Grupo Tierra Gaucha → la fila "Hotel Concept Bariloche" (pregunta 5b), Kenton → Kenton palace (la fila BRC no tiene categoría; el mail viene como "Reservas BRC -Kenton Palace <reservas@kentonpalace.com.ar>"), Carlos V → Hotel Carlos V Patagonia, Design → Design Suites (BRC) y Turaccion.
- **Traslados en AR10:** la regla general alcanza (el primer componente lleva la llegada y el último la salida).
  - OD027: solo la llegada del "Transfer SLA - Accommodation - SLA", si se confirma la pregunta 3.
  - OD019, OD024, OD033 y OD013: sin traslados.
  - OD022: solo la salida, como en AR09.
  - OD033 sigue con su bus El Chaltén → El Calafate (Chalten Travel). En `buses-el-chalten.csv`, AR10 tiene que salir el día 15 del tour (día 3 de la estadía de 2 noches), no el último día de OD033 vendido solo.
- **Buses Salta → Mendoza, Mendoza → Bariloche, Bariloche → El Chaltén y El Calafate → Río Gallegos → Ushuaia:** `tramo_bus` (los emite HI Travel). No van a `tramos-con-proveedor.csv`, porque ninguna fuente nombra proveedor.
- **`importar.ts`:** agregar AR10 a `TOURS_PILOTO`.
- **`codigos-tourradar.csv`:** 152848, "Full Argentina Adventure – 21 Days", AR10, con nota que diga de dónde sale (listado de IDs y borrador, nombre del statement #1389186). `productos-no-cargados.csv` está vacío: no hay nada que borrar.
- **Fuera de alcance (se anotan):** los opcionales (PN con canoa por Canal Fun, vuelo en lugar del bus) y la variante de invierno ("Tour can be reorganized in winter").

---

## Respuestas del owner (2026-10-26)

1. **RutasenBus, fila 96:** el owner la corrigió en el Excel. Verificado en `Insumos/RutasenBus2020.xls` (copia del Drive del 26 oct): I96 = "OD019 (menos 1 noche)" y E96 = "OD033 (menos 1 noche)". AR10 ya no necesita ninguna regla en `data/` para esas noches.
2. **Niveles:**
   - **El Chaltén:** AR10 Hotel 3\* = el Budget del OD033 (Kau Si Aike / Poincenot / hoteles del Patagonian Group). AR10 Hotel 4\* = **Hotel Destino Sur** (4\*; en el Excel figura solo como precio, filas 1057-1058 "Destino Sur 4\* DBL/SGL"). Se agrega al OD033 como renglón de Hotel 4\* (`data/renglones-agregados.csv`). El directorio del Drive ya lo tiene: "Destino Sur", info@hoteldestinosur.com.
   - **Bariloche (OD024):** Hostel = Periko´s / Achalay; Hotel 3\* = Kenton / Carlos V; Hotel 4\* = NH Edelweiss / Design Suites. Son los mismos nombres de nivel, no hace falta regla en `categorias-tour.csv`. (Esto reemplaza la sugerencia de la pregunta 2, que usaba los costos de RutasenBus.)
3. **Traslado de llegada en Salta:** sí, a La Ciénaga, solo la llegada (aeropuerto → alojamiento).
4. **Días:**
   - **El Calafate, solo dentro de AR10:** Torres del Paine el día 2 de la estadía (día 16 del tour) y Perito Moreno el día 3 (día 17). Motivo: no juntar dos días cansadores (TdP es largo, Perito Moreno es light y después viene el bus largo a Ushuaia). Se carga como regla de tour: `data/dias-servicio.csv` suma la columna `tour`. El resto de los productos no cambia.
   - **Ushuaia, regla general corregida:** el listado de M3-17 estaba al revés. Ahora va el Parque Nacional Tierra del Fuego el día 2 y el Beagle Channel Boat Trip (lobos marinos) el día 3, en todos los productos y tours. En AR10 quedan el Parque el día 19 y los lobos el día 20, sin regla especial.
5. **Proveedores:**
   - Trotamundos es el hostel de Salta (trotamundoshostelsalta@gmail.com). En el directorio del Drive figura como "Trotamundos Hostel". **Ferienhaus cerró: no se usa.**
   - Hotel Plaza Bariloche se pide a Grupo Tierra Gaucha (centralreservas@grupotierragaucha.com.ar).
   - Achalay Hostel: info@hostelachalay.com. NH Edelweiss: rsvt.nhedelweiss@nh-hotels.com. Kenton Palace: reservas@kentonpalace.com.ar.
   - El directorio de la base real **no se reimporta** en esta pieza: se carga cuando el owner unifique la copia del Drive.
6. **TourRadar 152848 → AR10,** con el nombre "Full Argentina Adventure – 21 Days" (el del statement) y la variante "Full Argentina Adventure ( 21 Days )".

**Ajuste del 2026-10-26 (después de las respuestas):** la reserva real #1389186 es **2 pax "Double Hostel"**. El reporte de carga trae el pedido de muestra en DBL Hostel y también en DBL Hotel 3\*.

Lo que quedó cargado (en la base de pruebas) está en `M3-23-carga.md`.
