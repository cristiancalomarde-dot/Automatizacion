# Feedback de operaciones — pedidos a proveedores (owner, 2026-10-23, desde el aeropuerto)

Tanda 1. El owner avisa que van a venir más correcciones chicas. Nada construido todavía: cada punto se
convierte en pieza cuando se ordene la tanda.

## Generales (todos los pedidos)

- **G1 · Códigos internos fuera del Subject.** El booking code de Kilroy, Jysk y Journaway es interno
  (HI Travel ↔ cliente), NO se comparte con el proveedor, y hoy sale en el Subject. El código interno del
  tour (ej. AR34, ARCH31) tampoco le sirve al proveedor. El **nombre del pasajero sí** es importante.
- **G2 · Habitación estándar con desayuno.** En hoteles suele haber upgrades no pedidos: estandarizar el
  renglón como "Hab DBL Standard con desayuno" / "Hab SGL Standard con desayuno". En hostels/hoteles
  aclarar siempre "con desayuno" (la mayoría ya lo tiene).
- **G3 · Excursiones con fecha fija: día 2 del componente.** Ej.: Torres del Paine Full Day = día 2 de la
  estadía en Puerto Natales; Big Dude = día 2 en Río; Península Valdés = día 2 en Puerto Madryn. "Y así en
  cada componente OD". El mecanismo ya existe (`data/dias-servicio.csv`); falta la regla/carga para el resto.

## Por reserva

- **DK1594177 · W Trek (Las Torres):** el pedido sale sin tipo de alojamiento. Opciones: Refugio Dorm a
  compartir · Tent DBL · Tent SGL. Tiene que figurar en el pedido a Las Torres.
- **DK1594177 · AR34 · "2) Regular Bus Round Trip FTE Airport - CHA - FTE city, Desde 5 mar · Hasta 10 mar":**
  confunde. Separar en dos renglones con su fecha:
  - FTE Airport → El Chaltén: 5 mar 2027 — horario según la frecuencia del día y la llegada del vuelo.
  - El Chaltén → El Calafate ciudad: 10 mar 2027 — **por defecto 8 am** (aclararlo).
  - Riesgo: **vuelo que llega después de las 17 hs** → puede no haber bus y hay que pasar a traslado
    privado (más caro), hablándolo con el vendedor de la agencia.
- **DK1592913 · "Traslado de llegada: Transfer El Calafate Airport to El Chalten" (10 mar, AR1840 08:40):**
  no existe como traslado. A Chalten Travel se le pide como **Bus Regular** aeropuerto → terminal de
  El Chaltén, horario según el vuelo. Si bus y vuelo no combinan, opción 2: shuttle de Las Lengas.
- **DK1592913 · "Bus: Public Bus El Chalten - El Calafate" (13 mar):** bien que sea public bus; **por defecto
  8 am** (se cambia a mano si el pasajero/viaje lo pide).
- **DK1592913 · Torres del Paine Full Day (Patagonia Planet):** sale "Fecha: a coordinar (estadía 16 al 18
  mar)". Debe salir fecha fija: día 2 en Puerto Natales (ver G3).
- **Vértice ("W trek VERTICE", Cubre OD017 · 16/03/2027):** el encabezado confunde; el pedido es alojamiento
  en Factoria (ARCH31, sin W). A Vértice Travel se le pide principalmente Hostal Factoria y eventualmente
  W Trek, pero de catálogo solo "W Trek Standard con Grey" (aún no cargada; está en el Excel y los Word).
  **Factoria tiene un email propio** en el Excel de proveedores. Pregunta del owner: ¿cambia el nombre del
  proveedor en el Excel?

## Respuestas del owner (2026-10-23)

1. **Subject:** sí → "Solicitud de reserva – <nombre del pasajero> – <fechas>", sin códigos (G1).
2. **Día 2:** no como regla general ciega. Hay destinos con más de una excursión y en San Pedro de Atacama
   los géiseres van el **día 3** (aclimatación). Se ve **caso a caso** → armar una lista por componente OD
   con sus excursiones y un día propuesto, y que el owner la valide antes de cargarla en `data/dias-servicio.csv` (G3).
3. **Vuelo después de las 17 hs:** sí → aviso interno en la reserva ("revisar con el vendedor: puede necesitar
   privado"); el pedido a Chalten Travel no lo dice.
4. **Vértice / Factoria:** correcto → el pedido de Factoria va al email propio de Factoria (del Excel); no se
   cambia el nombre de Vértice en el Excel, se separa el proveedor Factoria del de W Trek.

## G3 · Propuesta de días de excursión, para validar 1 a 1 con el owner

Fuente: excursiones cargadas (`M1-04d-carga.md`, `M3-10-diagnostico.md`) + lo que ya está en `data/dias-servicio.csv`.
Día = día de la estadía en ese destino (vale también dentro de los tours).

Ya fijados (no cambian): OD030 Géiseres día 3 · OD031 Tiwanaco día 2 · Perito Moreno día 2 en OD013/OD014/OD016
(día 5 en AR34) · OD014 Chaltén full day día 3 · OD019 Bodegas día 1 tarde y Alta Montaña/Rafting día 2 ·
OD018/OD020 City Tour o Bike Tour día 2 · OD040 City Tour Montevideo día 2.

Pendientes (propuesta):

| # | Componente | Excursión (proveedor) | Propuesta |
|---|---|---|---|
| 1 | OD017 Puerto Natales | Torres del Paine Full Day (Patagonia Planet) | día 2 (dicho por el owner) |
| 2 | OD032 Río | Big Dude (Local 55) | día 2 (dicho por el owner) |
| 3 | OD025 Puerto Madryn | Península Valdés Full Day (All Peninsula) | día 2 (dicho por el owner) |
| 4 | OD013 El Calafate + TdP | Torres del Paine Full Day from El Calafate (South Road) | día 3 (Perito Moreno ya va el 2) |
| 5 | OD018 Buenos Aires | Tango Show con cena (Madero Tango) | día 3, de noche |
| 6 | OD020 Buenos Aires + Uruguay | Colonia Day Trip (Buquebus) | día 3 |
| 7 | OD022 Ushuaia | Canal Beagle 3 hs (Rumbo Sur) | día 2 |
| 8 | OD022 Ushuaia | PN Tierra del Fuego medio día (Rumbo Sur) | día 3 (¿o el mismo día 2, mañana/tarde?) |
| 9 | OD029 Santiago | Bike Tour (Bicicleta Verde) | día 2 |
| 10 | OD010A-D / OD011 Iguazú | Paquete Receptivo 105 Premium (Cuenca del Plata) | ¿necesita día fijo o lo arma Cuenca del Plata? |

### G3 · Respuestas del owner (2026-10-23)

- **1 a 9: ok** tal como están en la tabla (TdP Puerto Natales día 2, Big Dude día 2, Península Valdés día 2,
  TdP desde El Calafate día 3, Tango día 3 de noche, Colonia día 3, Beagle día 2, PN Tierra del Fuego día 3,
  Bike Tour Santiago día 2).
- **10 Iguazú:** en general **lado argentino primero (día 2) y lado brasileño después (día 3)**; puede cambiar
  a mano. "La regla es la que te dije, en general."
- Reconfirma: **Tiwanaco (LPB) día 2** y **Bike Tour SCL día 2**.
- **Río, paquete aún no cargado** (no es OD032): tour de Río que NO es Big Dude → día 2; **Angra dos Reis e
  Ilha Grande day tour → día 3**. Se carga el día cuando entre ese paquete al catálogo (¿cuál es el código?).
- **El otro de Río es OD037** (no está cargado): tour de Río día 2, Angra dos Reis e Ilha Grande día 3.
- **Montevideo:** el City Tour regular de Turismo Dcom (OD040) va el día 2 — ya estaba fijado (`dias-servicio.csv`, 2026-10-21).
- **OD010D (2 noches BRA + 1 ARG), owner 2026-10-23:** queda como está: lado brasileño día 2 y lado argentino día 3;
  "así cambian de alojamiento cuando termina el tour del lado argentino".
- **W Trek con "Dormitory - Hostel and W-Trek Tent" (owner 2026-10-23):** dorm en el hostel + carpa según los pax:
  2 pax → Tent DBL, 1 pax → Tent SGL. (Hoy M3-19 lo deja "a confirmar"; ajuste chico después de M3-20.)
