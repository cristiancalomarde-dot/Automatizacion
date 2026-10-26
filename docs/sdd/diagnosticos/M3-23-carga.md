# M3-23 · Carga de AR10 Full Argentina Adventure – Route 40

Lo armé el 2026-10-26 con tus respuestas al diagnóstico (`M3-23-diagnostico.md`, sección "Respuestas del owner").
**Está cargado y probado solo en la base de pruebas.** La base real no se tocó: se carga con el script de
abajo, cuando des el OK y **después** de cargar el directorio de proveedores unificado del Drive.

## En corto

- **AR10 queda en el catálogo:** 20 noches en 6 paquetes y 5 tramos de bus que emite HI Travel. Las fechas de
  cada parte para la salida del 19 dic 2026 coinciden con el día a día del Word.
- **Entraron 2 paquetes nuevos:** OD027 (Salta and Jujuy: 3 noches en Salta y 1 en Purmamarca) y OD024
  (Bariloche, Patagonian Lakes, 3 noches). Todos sus proveedores tienen mail.
- **TourRadar:** el statement "Full Argentina Adventure – 21 Days" (y "( 21 Days )", y con guion común) se
  reconoce como AR10. También el número 152848.
- **La reserva de ejemplo entra recibida, no para revisión,** y arma sus pedidos. Lo probé en DBL Hostel (como
  la #1389186) y en DBL Hotel 3\*. No queda ningún "revisar a mano": solo los 5 boletos de bus y, en Hostel, el
  WhatsApp de Lagares en Mendoza (como siempre).
- **Lo que ya estaba no cambió.** Comparé el catálogo entero antes y después de la carga. La única diferencia
  es que el OD033 suma su Hotel 4\* (Destino Sur), que lo pediste para AR10.
- **Cambios de reglas que tocan a otros productos (los pediste vos):**
  - En **Ushuaia**, el Parque Nacional pasa al día 2 y los lobos marinos (Beagle) al día 3, en todos los
    productos y tours.
  - El **OD033 vendido solo en Hotel 4\*** ahora pide Destino Sur. Antes salía "Elegir el hotel".
- **Avisos** (detalle abajo): el bus Río Gallegos → Ushuaia del martes 5 ene; la carga en la real depende del
  directorio unificado y de las equivalencias de Las Torres / Vertice / Factoria.

## Qué entró

| Días (salida 19 dic) | Parte | Noches | Proveedores |
|---|---|---|---|
| 1-5 (19 → 23 dic) | **OD027** Salta + Purmamarca | 4 | Salta: Trotamundos (Hostel), Inkai (3\*), Brizo / Design Suites Salta (4\*). Purmamarca: Posta de Purmamarca / Casa de Adobe (todos los niveles). La Ciénaga: traslado de llegada, Salinas y Purmamarca, Humahuaca |
| 5 → 6 (23 dic) | Bus nocturno Salta → Mendoza | 1 en el bus | lo emite HI Travel |
| 6-8 (24 → 26 dic) | **OD019** Mendoza | 2 | Lagares (Hostel, WhatsApp), Argentino (3\*), NH Cordillera / MOD (4\*). Huentata: Bodegas y Alta Montaña |
| 8 → 9 (26 dic) | Bus nocturno Mendoza → Bariloche | 1 en el bus | lo emite HI Travel |
| 9-12 (27 → 30 dic) | **OD024** Bariloche | 3 | Periko´s / Achalay (Hostel), Kenton / Carlos V (3\*), Design Suites / NH Edelweiss (4\*). Turacción: Circuito Chico e Isla Victoria |
| 12 → 13 (30 dic) | Bus Bariloche → El Chaltén (noche en el bus) | 1 en el bus | lo emite HI Travel |
| 13-15 (31 dic → 2 ene) | **OD033** El Chaltén | 2 | Rancho Grande y otros (Hostel), Kau Si Aike y otros (3\* = Budget), Destino Sur (4\*). Chalten Travel: bus a El Calafate el 2 ene, 8 am |
| 15-18 (2 → 5 ene) | **OD013** El Calafate | 3 | Hostel del Glaciar, Rincón / Sent (3\*), Mirador del Lago / Calafate Parque (4\*). South Road: Torres del Paine. Chalten Travel: Perito Moreno |
| 18 (5 ene) | Bus El Calafate → Río Gallegos y Río Gallegos → Ushuaia | — | los dos los emite HI Travel |
| 18-21 (5 → 8 ene) | **OD022** Ushuaia | 3 | Anum / Antarctica (Hostel), Los Naranjos / Altos (3\*), Albatros y otros (4\*). Rumbo Sur: Parque Nacional, lobos marinos y traslado al aeropuerto |

**Traslados:** solo la llegada al aeropuerto de Salta (La Ciénaga) y la salida al aeropuerto de Ushuaia
(Rumbo Sur). Las demás partes llegan y salen en bus, sin traslado.

**Días de las excursiones:**

| Excursión | Día de la estadía | Día del tour | Fecha (salida 19 dic) |
|---|---|---|---|
| Salinas y Purmamarca | 2 | 2 | 20 dic |
| Humahuaca | 3 | 3 | 21 dic |
| Bodegas (14:30) | 1 | 6 | 24 dic |
| Alta Montaña | 2 | 7 | 25 dic |
| Circuito Chico (14:30) | 2 | 10 | 28 dic |
| Isla Victoria (pick up 9:00) | 3 | 11 | 29 dic |
| Torres del Paine | 2 (solo en AR10) | 16 | 3 ene |
| Perito Moreno | 3 (solo en AR10) | 17 | 4 ene |
| Parque Nacional Tierra del Fuego | 2 | 19 | 6 ene |
| Lobos marinos (Beagle) | 3 | 20 | 7 ene |

**Códigos de agencia:** TourRadar 152848 → AR10, con el nombre "Full Argentina Adventure – 21 Days".
También se reconocen por nombre "Full Argentina Adventure ( 21 Days )" y "Full Argentina Adventure - 21 Days".
Kilroy no tiene código de AR10.

## Cómo se arma (lo nuevo)

- **Purmamarca vale para todos los niveles.** La línea de Purmamarca va con el nivel "Todos los niveles"
  (`data/niveles-confirmados.csv`). Se pide siempre, la noche 2, con cualquier nivel que se haya vendido.
- **Salta se pide en dos estadías al mismo hotel,** como el Puerto Natales de CH10: el 19 → 20 dic y el
  21 → 23 dic (`data/noches-servicio.csv`).
- **Salinas y Humahuaca cambian de alojamiento ese día.** El pedido a La Ciénaga dice dónde buscarlos y dónde
  dejarlos. Salinas: "Pick up: hotel de Salta · Drop off: Posta de Purmamarca (Purmamarca)". Humahuaca, al revés.
- **Regla de un tour.** `data/dias-servicio.csv` tiene una columna nueva, `tour`. Una fila con tour vale solo
  dentro de ese tour, y ahí reemplaza a la regla general. Hoy la usa solo AR10, para El Calafate.
- **El Word de AR10 tiene detalles de formato** que el lector ahora tolera:
  - "DAY 8" y "DAY 11" vienen pegados al párrafo anterior. Ahora se separan, solo si "DAY" está en mayúsculas.
  - "Night in the BUS" (día 12) ahora cuenta como bus nocturno.
  - Con esos dos arreglos, el Word suma las 20 noches.

## Avisos

1. **Bus Río Gallegos → Ushuaia del martes 5 ene 2027 (día 18 de la #1389186).** La hoja "Buses para Tours"
   de RutasenBus dice que ese tramo sale **lunes, miércoles y viernes**. La app arma igual la tarea
   "Emitir boleto: Río Gallegos – Ushuaia, 5 ene 2027", y **no avisa** que ese día puede no haber bus.
   Antes de confirmar hay que mirar el horario de ese año. Si el martes no hay bus, el Word (Important Note II)
   dice que se reacomoda el itinerario. Por ejemplo, salir de El Calafate el lunes 4, o seguir el miércoles 6.
   Las dos opciones cambian noches en El Calafate o en Ushuaia y el día de las excursiones. Ese cambio se
   hace a mano en la reserva.
2. **Mendoza en Navidad:** Bodegas va el jueves 24 dic y Alta Montaña el viernes 25 dic. Conviene confirmar
   con Huentata que operan esos días.
3. **Carga en la real: depende del directorio.**
   - La equivalencia de Trotamundos apunta a "Trotamundos Hostel", que es el nombre del directorio del Drive.
     Si la real todavía tiene el directorio viejo, el primer paso del script falla sin cargar nada.
   - **Además:** el directorio del Drive renombró las filas de Las Torres, Vertice y Factoria ("LAS TORRES: W
     Trek Standard y W Trek Express", etc.). Las equivalencias de esas filas (`data/equivalencias-proveedores.csv`,
     filas 45-47) todavía apuntan a los nombres viejos ("W trek LAS TORRES", "W trek VERTICE").
   - Con el directorio del Drive cargado, `importar:equivalencias` falla por esas tres filas, y eso **frena
     también la carga de AR10**. Hay que actualizarlas antes (es lo de Factoria aparte, M3-22). No las toqué:
     no son de esta pieza.
4. **Cómo lo probé.** Usé el directorio del clon con dos filas tomadas de la copia del Drive: "Trotamundos
   Hostel" y "Destino Sur". No cargué el directorio entero del Drive, porque con sus renombres fallan las
   equivalencias de Las Torres / Vertice / Factoria (aviso 3). El Insumos del clon no lo toqué.
5. **Destino Sur:**
   - El 2026-10-10 dijiste que Chalten Travel reserva Destino Sur, y AR34 lo sigue pidiendo a Chalten Travel.
   - En AR10 (y en OD033 vendido solo, en Hotel 4\*) el pedido va directo a Destino Sur
     (info@hoteldestinosur.com), como pediste hoy.
   - Si preferís que vaya por Chalten Travel, es cambiar una palabra en `data/renglones-agregados.csv`.
6. **"Las Marias Tilcara"** (bloque de OD027, sin "Accommodation:" ni proveedor) queda afuera, como dice el
   diagnóstico. La carga corre sin IA, así que no se lo pregunta a nadie.
7. **Dorm en Purmamarca:** si se vende un Dorm, el pedido a Posta de Purmamarca sale como dorm compartido, que
   es lo que dice la reserva. No hice nada especial: pasaría lo mismo que en Colonia.
8. **Opcionales del Word** (Parque Nacional con canoa, vuelo en lugar del bus): no se cargaron, como dice la
   spec.

## Pedido de muestra: AR10, 2 pax, salida 19 dic 2026

Pasajeros inventados (Ana Prueba y Luis Ensayo). El saludo, los datos de los pasajeros y el cierre son los de
siempre. Acá va solo lo que se pide en cada pedido.

### DBL Hostel (como la #1389186)

Tareas: los 5 "Emitir boleto" (Salta – Mendoza 23 dic, Mendoza – Bariloche 26 dic, Bariloche – El Chaltén
30 dic, El Calafate – Río Gallegos 5 ene, Río Gallegos – Ushuaia 5 ene). Además: "Contactar por WhatsApp a
Hostel Lagares Mendoza: Lagares Hostel (doble), IN 24 dic 2026, OUT 26 dic 2026".

**Trotamundos** (trotamundoshostelsalta@gmail.com)
```
1) Alojamiento: Trotamundos Salta
IN: 19 dic 2026
OUT: 20 dic 2026 (1 noche)
Habitación: DBL Standard con desayuno

2) Alojamiento: Trotamundos Salta
IN: 21 dic 2026
OUT: 23 dic 2026 (2 noches)
Habitación: DBL Standard con desayuno
```

**La Ciénaga** (florencia@lacienagaturismo.com.ar)
```
1) Traslado de llegada: Transfer SLA - Accommodation - SLA
Fecha: 19 dic 2026
Vuelo pendiente

2) Excursión: Salinas y Purmamarca
Fecha: 20 dic 2026
Servicio: regular · Idioma: inglés
Pick up: Trotamundos Salta (Salta) · hotel a confirmar · Drop off: Posta de Purmamarca (Purmamarca) · hotel a confirmar

3) Excursión: Humahuaca
Fecha: 21 dic 2026
Servicio: regular · Idioma: inglés
Pick up: Posta de Purmamarca (Purmamarca) · hotel a confirmar · Drop off: Trotamundos Salta (Salta) · hotel a confirmar
```

**Posta de Purmamarca** (consultas@postadepurmamarca.com.ar): IN 20 dic, OUT 21 dic (1 noche), DBL. Con el
aviso de siempre: "se tomó la primera opción del catálogo (otras: Casa de Adobe)".

**Huentata:** Bodegas half Day el 24 dic por la tarde (14:30 aprox.), Alta Montaña el 25 dic. Pick up en
Lagares Hostel.

**Periko´s** (infoperikos@gmail.com, denalibarilochesrl@gmail.com): IN 27 dic, OUT 30 dic (3 noches), DBL.
Otra opción: Achalay.

**Turacción** (info@turaccion.com.ar)
```
1) Excursión: Circuito Chico en ingles sin ticket al Campanario
Fecha: 28 dic 2026, por la tarde (14:30 aprox.)
Pick up y drop off: Periko´s (Bariloche) · hotel a confirmar

2) Excursión: Isla victoria y bosque de arrayanes with transfers
Fecha: 29 dic 2026, por la mañana (pick up 9:00 aprox.)
Pick up y drop off: Periko´s (Bariloche) · hotel a confirmar
```

**Chalten Travel** (agencias@chaltentravel.com)
```
1) Alojamiento: Rancho Grande
IN: 31 dic 2026
OUT: 2 ene 2027 (2 noches)
Habitación: DBL Standard con desayuno

2) Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station
Fecha: 2 ene 2027 · Horario: 8:00 am

3) Excursión: Perito Moreno Glaciar Excursion
Fecha: 4 ene 2027
Pick up y drop off: Hostel del Glaciar Pioneros (El Calafate) · hotel a confirmar
```

**Del Glaciar** (reservas@glaciar.com): Hostel del Glaciar Pioneros, IN 2 ene, OUT 5 ene (3 noches), DBL.

**South Road:** Torres del Paine Full Day from El Calafate, el 3 ene. Pick up en Hostel del Glaciar.

**Anum** (reservas@anum-travel.com): IN 5 ene, OUT 8 ene (3 noches), DBL.

**Rumbo Sur** (emiliao@rumbosur.com.ar)
```
1) Excursión: Tierra del Fuego National Park half Day
Fecha: 6 ene 2027

2) Excursión: Beagle Channel Boat Trip, 3 hours, no transfer to port
Fecha: 7 ene 2027

3) Traslado de salida: Transfer Round Trip: Rumbo Sur
Fecha: 8 ene 2027
Vuelo pendiente
```

### DBL Hotel 3\*

Tareas: solo los 5 "Emitir boleto". Cambian los hoteles:
- **Salta:** Inkai (info@hotelinkai.com), en las mismas dos estadías.
- **Purmamarca:** la misma Posta.
- **Mendoza:** 3\* Hotel Argentino (info@argentino-hotel.com.ar).
- **Bariloche:** Kenton Palace (reservas@kentonpalace.com.ar), otra opción Carlos V.
- **El Chaltén:** Kau Si Aike (hosteriakausiaike@gmail.com), el Budget del OD033. Otras opciones: Poincenot,
  Fitz Roy, Vertical Lodge, El Paraíso.
- **El Calafate:** Rincón del Calafate (reservas@rincondelcalafate.com.ar).
- **Ushuaia:** Los Naranjos (reservas@losnaranjosushuaia.com).

Chalten Travel recibe solo el bus del 2 ene y el Perito Moreno del 4 ene. Las excursiones y las fechas son las
mismas que en Hostel.

## Lo que necesito de vos

- **El OK para cargarlo en la base real,** con el script de carga. Antes hay que cargar el directorio unificado
  del Drive y poner al día las equivalencias de Las Torres / Vertice / Factoria (aviso 3).
- Que mires el **bus Río Gallegos → Ushuaia del martes 5 ene** de la #1389186 (aviso 1).
- Si Destino Sur se pide directo o por Chalten Travel (aviso 5).
