# M3-10 · Carga de los 6 productos que pidieron las agencias

Lo armé el 2026-10-21 con tus respuestas a las 8 preguntas del diagnóstico (`M3-10-diagnostico.md`).
**Está cargado y probado solo en la base de pruebas.** La base real no se tocó: se carga cuando des el OK
a este reporte.

## En corto

- **Entraron 8 productos:** los 6 que pidieron las agencias (CH11, AR34, OD014, ARCH33EXP, ARBR23,
  ARUY01) y los 2 paquetes de Uruguay que necesita ARUY01 (OD040 Montevideo y COMPUY03 Colonia).
- **Las reservas que los traen entran como recibidas**, ya no "para revisión". Probé una reserva de
  ejemplo de cada uno (pasajeros inventados): las 6 quedaron recibidas y armaron sus pedidos.
- **Lo que ya estaba no cambió:** comparé el catálogo entero antes y después de la carga (82 productos,
  sus servicios, partes, traslados, códigos y noches, y los 269 proveedores): idéntico.
- **Avisos que quedan** (detalle abajo): Hotel Oxford y Merit Montevideo sin mail; ferry y bus de Uruguay
  como tareas de HI Travel; el Fitz Camp de AR34 todavía no está en el Excel.

## Qué entró

| Código | Qué es | Noches | Cómo se arma |
|---|---|---|---|
| CH11 | W-Trek Express + Puerto Natales | 5 | 1 noche en Natales + 3 en la W Express + 1 en Natales (como CH10) |
| OD014 | El Calafate & El Chaltén full day | 4 | Alojamiento en El Calafate, traslado ida y vuelta, Perito Moreno el día 2, El Chaltén full day el día 3 |
| AR34 | El Chaltén + El Calafate, glaciares y trekking | 5 | Paquete propio (tu respuesta 1): 3 noches en El Chaltén + 2 en El Calafate, Perito Moreno el día 5 |
| OD040 | Montevideo Starter Package | 2 | Alojamiento, traslado del aeropuerto, city tour el día 2 |
| COMPUY03 | Extensión a Colonia | 1 | Alojamiento y bus a Montevideo |
| ARCH33EXP | Patagonia, Trekking Paradise con W-Trek EXPRESS | 10 | OD033 (días 1-3) → OD016 (4-5) → bus a Puerto Natales (día 6) → CH11 (6-10) → salida de Natales el día 11 (bus Kupos o traslado al aeropuerto de Natales) |
| ARBR23 | De Buenos Aires a Río | 11 | OD018 (1-3) → bus nocturno (día 4) → OD010A (5-7) → bus nocturno (día 8) → OD032 (9-11) |
| ARUY01 | Argentina y Uruguay, corazón del Río de la Plata | 6 | OD018 (1-3) → ferry a Colonia (día 4) → COMPUY03 (día 4) → bus a Montevideo y OD040 (5-6) |

En los tres tours, las noches suman lo que dice el Word, y las fechas de cada parte para una salida de
ejemplo coinciden con su día a día.

**Códigos de agencia que ahora se reconocen:**
- Kilroy: `HI_ARGENTINA_W_TREK_CH_11-677` (CH11), `HI_ARGENTINA_AR34-677` (AR34), `HI_ARGENTINA_OD014-677`
  (OD014) y `HI_TRAVEL_ARCH_EXP-677` (ARCH33EXP).
- TourRadar: 275366 (ARCH33EXP), 150104 "Buenos Aires to Rio de Janeiro 12 Days" (ARBR23) y 317766
  "Argentina and Uruguay, heart of the River Plate (7 days)" (ARUY01).
- La lista de "productos que existen pero no están cargados" quedó vacía.

## Proveedores por producto

Todos con mail, salvo los marcados con aviso.

- **CH11:** Puma House / Last Hope / Vertice (hostel), Big Sur / Loreto Belén / CL Mundo / Vendaval (3\*),
  Las Torres (W Trek Express). Igual que CH10.
- **OD014:** Del Glaciar y Always Glaciers (hostel y budget), Patagonian Group (Puerto San Julián),
  Rincón del Calafate y Sent (3\*), Mirador del Lago y Calafate Parque (4\*), Chalten Travel (traslado y
  Perito Moreno), South Road (El Chaltén full day).
- **AR34:**
  - El Chaltén, noches 1-3: Chalten Travel (Rancho Grande, Poincenot, Destino Sur), Pioneros del Valle,
    Kau Si Aike, Vertical Lodge (Patagonian Group).
  - El Calafate, noches 4-5: Del Glaciar, Always Glaciers, Patagonian Group, Rincón del Calafate, Sent,
    Mirador del Lago, Calafate Parque.
  - Chalten Travel: bus ida y vuelta aeropuerto – El Chaltén – El Calafate, Perito Moreno y traslado al
    aeropuerto.
  - Fitz Camp / Receptivo Chaltén: la segunda noche en Fitz Camp, opcional (ver avisos).
- **OD040:** Comercial Cono Sur (Viajero Hostel), Dcom Travel (traslado y city tour; el pedido va a sus dos
  mails del directorio: operaciones@ y macarena.perez@), **Hotel Oxford / Merit Montevideo sin mail**.
- **COMPUY03:** "Viajero en Colonia" (hostel y B&B; natalyp@ y dfarinati@), **bus COT online a mano**.
- **ARCH33EXP:** los de OD033, OD016 y CH11; el bus El Calafate – Puerto Natales lo emite HI Travel; la
  salida de Natales, Kupos (a mano) o Patagonia Planet.
- **ARBR23:** los de OD018, OD010A (Cuenca del Plata, con traslados desde y hacia la terminal de buses de
  Puerto Iguazú) y OD032 (el traslado de Buzios Transfers / Alex va al revés, del alojamiento al
  aeropuerto de Río); los dos buses nocturnos los emite HI Travel.
- **ARUY01:** los de OD018 (solo el traslado de llegada de Greeters), COMPUY03 y OD040 (el traslado de
  Dcom Travel va al revés, del alojamiento al aeropuerto de Carrasco).

## Avisos

1. **Hotel Oxford y Merit Montevideo no tienen mail** (tu respuesta 5b). Si una reserva pide el Hotel 3\* de
   Montevideo, la app deja la tarea "Pedir a mano: Hotel Oxford Montevideo … Sin mail todavía: pedilo a
   mano". Cuando los agregues al Excel de proveedores con su mail, recargo el directorio y salen solos.
2. **Tareas de HI Travel, sin mail** (tu respuesta 6): el ferry Buenos Aires → Colonia (Buquebus) y el bus
   Colonia → Montevideo (COT online) aparecen como "Emitir boleto" con su fecha.
3. **Fitz Camp en AR34** (tu respuesta 2): en el Excel todavía no está el renglón. Lo cargué igual desde
   un archivo aparte (`data/renglones-agregados.csv`), como opcional para Receptivo Chaltén. El pedido
   avisa "No se pidió … porque es opcional: agregalo si el pasajero lo compró". Cuando lo agregues al
   bloque AR34 del Excel, la app no lo duplica y me avisa para borrarlo del archivo.
   **Ojo:** si lo agregás en el medio del bloque (antes del Perito Moreno), cambia la posición del Perito
   Moreno y hay que corregir su día fijo. Lo más simple es agregarlo al final del bloque.
4. **Bus ida y vuelta de AR34:** el pedido a Chalten Travel lo pide "Desde el día 1 hasta el día 6". La ida
   es el día 1 y la vuelta el día 4 (de El Chaltén a El Calafate). Revisá esa fecha antes de enviar.
5. **Tours vendidos en "Hotel 3\*" o "Budget Hotel"** (ya pasaba con ARCH33 y BRARCH26, no lo cambié): la
   app todavía no usa la equivalencia de categorías del tour para elegir el hotel de cada paquete. Por
   ejemplo, un ARCH33EXP en Hotel 3\* deja la tarea "Elegir el hotel de OD033", y un ARBR23 en Budget deja
   "Elegir el hotel" de OD010A y OD032. En Hostel sale todo solo.
6. **Excursiones sin día fijo:** en ARCH33EXP el Perito Moreno de OD016 sigue con "fecha a coordinar", y
   en ARBR23 y ARUY01 los de Buenos Aires y Río también, igual que hoy. Fijé solo los días que me diste
   (OD014, AR34 y OD040).
7. **Colonia:** el pasajero de dorm va en dorm (tu corrección 4): no hice nada especial.
8. **Nombres con la categoría:** algunos hoteles de AR34 salen con la categoría delante del nombre, como
   está escrito en el Excel ("Budget Hotel Kau Si Aike"). Es solo cómo se lee en el pedido.

## Un pedido de muestra por producto

Pasajeros inventados. El saludo y el cierre son los de siempre; acá van solo el asunto y lo que se pide.

**CH11 · a Big Sur** (reservas@hotelbigsur.cl), "Reserva Pasajera Uno x2 · CH11"
```
1) Alojamiento: Big Sur
IN: 10 ene 2027
OUT: 11 ene 2027 (1 noche)
Habitación: doble

2) Alojamiento: Big Sur
IN: 14 ene 2027
OUT: 15 ene 2027 (1 noche)
Habitación: doble
```
A Las Torres va aparte: "W Trek Express, desde el 11 hasta el 14 ene 2027".

**AR34 · a Chalten Travel** (agencias@chaltentravel.com), en Budget Hotel
```
1) Regular Bus Round Trip FTE Airport - CHA - FTE city
Desde: 16 ene 2027 · Hasta: 21 ene 2027

2) Excursión: Perito Moreno Glaciar Excursion
Fecha: 20 ene 2027
Servicio: regular · Idioma: inglés
Pick up y drop off: Budget Hotel Del Glaciar Libertador (El Calafate) · hotel a confirmar

3) Traslado de salida: Transfer El Calafate - FTE Airport
Fecha: 21 ene 2027
Vuelo pendiente
```
Kau Si Aike recibe "IN 16 ene, OUT 19 ene (3 noches)" y Del Glaciar "IN 19 ene, OUT 21 ene (2 noches)".

**OD014 · a Chalten Travel**, en dorm
```
1) Traslado de llegada: Transfer Round Trip
Fecha: 1 feb 2027
Vuelo pendiente

2) Excursión: Perito Moreno Glaciar Excursion
Fecha: 2 feb 2027
Pick up y drop off: Hostel del Glaciar Pioneros (El Calafate) · hotel a confirmar

3) Traslado de salida: Transfer Round Trip
Fecha: 5 feb 2027
Vuelo pendiente
```
South Road recibe el El Chaltén full day el 3 feb.

**ARCH33EXP · a Chalten Travel**, en Hostel
```
1) Alojamiento: Rancho Grande
IN: 10 feb 2027
OUT: 13 feb 2027 (3 noches)

2) Traslado de llegada: Transfer El Calafate Airport to El Chalten
Fecha: 10 feb 2027

3) Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station
Fecha: 13 feb 2027

4) Excursión: Perito Moreno Glaciar Excursion
Fecha: a coordinar (estadía del 13 al 15 feb 2027)
```
Además salen Del Glaciar (13 al 15), Puma House (15 al 16 y 19 al 20), Las Torres (W Express del 16 al 19)
y dos tareas: "Emitir boleto: El Calafate – Puerto Natales, 15 feb" y "Bus Puerto Natales – Punta Arenas,
20 feb".

**ARBR23 · a Cuenca del Plata** (reservas8@cuencadelplata.com), en Hostel
```
Paquete 105 Premium con transfer in desde la terminal de buses de Puerto Iguazú y transfer out a la terminal de buses de Puerto Iguazú
TRF IN, regular: 5 mar 2027 · Bus o vuelo pendiente
Lado argentino, regular en inglés: 6 mar 2027
Lado brasileño, regular en inglés: 7 mar 2027
TRF OUT, regular: 8 mar 2027 · Bus o vuelo pendiente
```
Tareas: "Emitir boleto: Buenos Aires – Iguazú, 4 mar" e "Iguazú – Río de Janeiro, 8 mar". Buzios Transfers
recibe el traslado de salida al aeropuerto de Río el 12 mar.

**ARUY01 · a Dcom Travel** (operaciones@ y macarena.perez@dcomtravel.com), en Hotel 3\*
```
1) Excursión: Montevideo City Tour (regular)
Fecha: 15 mar 2027
Pick up y drop off: Hotel Oxford Montevideo (Montevideo) · hotel a confirmar

2) Traslado de salida: Regular Transfer MVD Airport - hotel / hostel
Fecha: 16 mar 2027
Vuelo pendiente
```
Viajero en Colonia recibe la noche del 13 al 14 mar (B&B superior). Tareas: "Emitir boleto: Ferry Buenos
Aires – Colonia del Sacramento, 13 mar", "Bus regular Colonia - Montevideo (terminal de buses Tres
Cruces), 14 mar" y "Pedir a mano: Hotel Oxford Montevideo (OD040), IN 14 mar, OUT 16 mar. Sin mail
todavía: pedilo a mano".

## Lo que necesito de vos

- **El OK para cargarlo en la base real.**
- Cuando puedas: el mail de Hotel Oxford y de Merit Montevideo en el Excel de proveedores, y el renglón
  del Fitz Camp al final del bloque AR34 del Excel de paquetes.
