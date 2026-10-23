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
