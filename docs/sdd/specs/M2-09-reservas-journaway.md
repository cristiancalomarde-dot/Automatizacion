# M2-09 · Reservas de Journaway

**Depende de:** M2-06 y M2-08

## 1. Qué queremos lograr
Que un mail de reserva de Journaway entre y quede como reserva con **el producto correcto de
nuestro catálogo**, aunque Journaway no ponga código y escriba los tours con nombres que cambian.
El sistema arma el paquete con la lista de tours, los hoteles Tayka o el título. También lee los
vuelos y los pasajeros, que vienen con etiquetas en alemán. Y separa lo que nos piden a nosotros
de los hoteles que reserva Journaway.

Si no hay confianza, la reserva queda "para revisión" con un motivo que se entiende. **Nunca se
adivina el paquete.** El owner lo comprueba en el modo prueba con los 4 mails reales de Journaway.

## 2. Qué hay hoy
- **M2-01 a M2-06:** el circuito de Kilroy y TourRadar.
  - Un mail se lee con IA (M2-02).
  - El producto se reconoce por código, por nombre de la agencia (`codigo_externo`) o por la
    propuesta de la IA (M2-03).
  - El mismo intercambio no crea una reserva nueva (M2-04).
  - Se ven la lista y el detalle (M2-05).
  - El modo prueba procesa los mails de `Insumos/Mails` y da un reporte por mail (M2-06).
- **M2-08:** el catálogo de Journaway, cargado desde `Insumos/Borrador productos Journaway.xlsx`.
  - Las excursiones: SPAE01 a SPAE07, IGRE01 e IGRE02, entre otras.
  - Los paquetes SPAP01 a SPAP04, armados con esas excursiones.
  - SPAP05 y SPAP06, con el Overland privado de Imperio Inca.
  - Los nombres de Journaway, cargados como `codigo_externo`.
- **Remitentes de Journaway:** `operations@journaway.com` y `de@journaway.com`, en
  `data/agencias.csv` (M2-01).
- **Cómo escribe Journaway (los 4 mails de ejemplo):**
  - No pone código. Un paquete llega como una lista de tours sueltos, cada uno con su fecha.
  - Los hoteles los reserva Journaway: "All Hotels are booked by us" o "Accomodations booked by us".
  - Los vuelos y los pasajeros vienen con etiquetas en alemán.
  - El "Trip Number" viene en uno solo de los 4 mails.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

### Los 4 mails de ejemplo y lo que se espera de cada uno

Están en `Insumos/Mails`. Son la vara de esta pieza: el modo prueba tiene que dar exactamente esto.

| Mail | Qué trae | Resultado esperado |
|---|---|---|
| **A** · "Iguazu Fall Argentina Side" (de@journaway.com) | "From Foz do Iguaçu: Half-day tour to the Argentinean side of Iguazú Falls", 14.06.2027, 2 pax, pick up Hotel Rafain Centro. Sin Trip Number ni vuelos | **IGRE01** (lado argentino, full day), "recibida". Fecha 14.06.2027, 2 pax (Carolyn Katharina Gallien y Bennet Lenn Gallien). Pick up y drop off en Hotel Rafain Centro. Sin número de Journaway. Lleva una nota: "Journaway lo llama half-day; es el full day" |
| **B** · "Iguazu Falls Brazilian Side" (de@journaway.com) | "Half-day tour to the Brazilian Iguazú Falls", 13.06.2027, 2 pax, pick up Hotel Rafain Centro. Sin Trip Number ni vuelos | **IGRE02**, "recibida". Fecha 13.06.2027, los mismos 2 pasajeros, pick up en Hotel Rafain Centro. Es una reserva aparte de la del mail A |
| **C** · "All San Pedro 4 days mas San Pedro Extension" (operations@journaway.com) | Trip Number 62992. "Package All San Pedro de Atacama 8 Days". 7 tours con fecha: Astronomy, Tatio, Moon Valley, Quepiaco/Salt Flats, Rainbow Valley, Red Rocks y Laguna Cejar. "All Hotels are booked by us". Vuelos LA156 (16.03, SCL → CJC) y LA377 (23.03, CJC → SCL) | Dos reservas con booking_id **62992**: **SPAP01** (Trip A: Astronomy, Rainbow Valley, Moon Valley y Tatio) y **SPAP03** (Trip C, la extensión: Quepiaco/Salt Flats, Red Rocks y Laguna Cejar). Las dos "recibida", con 2 pax (Brit Sumfleth y Sarah Kirmse). Cada tour conserva su fecha. Shuttle de llegada con LA156 (16.03, llega 17:41) y de salida con LA377 (23.03, sale 20:39). Ningún hotel a pedir |
| **D** · "San Pedro de Atacama and Uyuni Salt Flats in Tayka Hotels 7N8D" (operations@journaway.com) | Título "Package San Pedro de Atacama + Uyuni Salt Flats 7 Days". 8 hoteles "booked by us". 4 tours en San Pedro (pick up en Our Habitas Atacama), del 11 al 14.10. 3 tours con pick up en Tayka: Sol de Mañana (15.10), Siloli (16.10) y Salar de Uyuni (17.10). 6 tramos de vuelo. Sin Trip Number | **SPAP05**, "recibida". Son 4 noches en San Pedro: del 11.10, que llega a Calama, al 15.10, que arranca el Overland. 2 pax (Kai Sacher y Jeannette Tschorba). Shuttle de llegada con LA148 (11.10, SCL → CJC, llega 16:11). Los 3 días del Overland son de Imperio Inca. Ninguno de los 8 hoteles genera algo a pedir. Sin número de Journaway |

### Los requisitos

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Nuestro código, primero.** Si el mail trae un código de nuestro catálogo (ej. "SPAP05" o "IGRE01"), se usa ese, sin IA para el producto. Hay dos casos que van a "para revisión": el código no está en el catálogo ("el código X no está en el catálogo"), o el código contradice los tours del mail (ej. "el mail dice SPAP06, pero son 4 noches en San Pedro: sería SPAP05") | Test con variantes de los mails reales. El mail A con "IGRE01" agregado da IGRE01 sin llamar a la IA. El mail D con "SPAP06" agregado va a "para revisión" con ese motivo. Un mail con "SPAP99" va a "para revisión" |
| 2 | **Cada tour suelto se reconoce por su nombre.** Antes de comparar, el nombre se limpia: se sacan los prefijos ("San Pedro de Atacama:", "From Foz do Iguaçu:", "Tour:"), las mayúsculas y los acentos. Después se busca en los nombres de Journaway (`codigo_externo`). Si no está, la IA propone con confianza (M2-03). Un tour que no se reconoce con confianza no se descarta: manda la reserva a "para revisión" con el motivo "no se reconoce el tour '<nombre>'" | Test con los 7 nombres del mail C y los 4 de San Pedro del mail D: todos dan su SPAE sin IA. "…and the salt flats" (minúscula, mail D) y "…and the Salt Flats" (mail C) dan los dos SPAE05. Un nombre inventado ("Tour to the Moon Crater") va a "para revisión" con ese motivo |
| 3 | **"Half-day tour to the Argentinean side" es IGRE01.** Es el full day: el error es de Journaway y lo confirmó el owner. La reserva lleva la nota "Journaway lo llama half-day; es el full day" | Test con el mail A: da IGRE01 con la nota. **Nunca** da IGRE02 ni el paquete IGRP02, aunque diga "half-day" |
| 4 | **El paquete se arma con la lista de tours.** Se busca la combinación de paquetes del catálogo que usa **todos** los tours de la lista, cada uno una sola vez, sin que sobre ni falte ninguno. Se elige solo si esa combinación es **una sola**. Si son dos paquetes (como Trip A + extensión C), salen dos reservas con el mismo booking_id. Las fechas de cada tour se respetan como vienen, aunque se intercalen. El "N Days" del título no decide nada acá: los hoteles son de Journaway | Test con el mail C: da SPAP01 + SPAP03 (la única combinación que cierra) y no SPAP02 ni SPAP04. Test con Astronomy + Rainbow + Moon Valley + Tatio + Salt Flats: da SPAP02 |
| 5 | **Si los tours no alcanzan o sobran, no se elige un paquete a ciegas.** Pasa cuando ninguna combinación cierra o cuando hay más de una. La reserva va a "para revisión" con el motivo en llano: "estos tours no arman ningún paquete conocido: sobra Red Rocks" o "pueden ser SPAP0X o SPAP0Y" | Test con el mail C sin Laguna Cejar: va a "para revisión" con "sobra …" y **no** crea SPAP01, SPAP02 ni SPAP03. Test con solo Astronomy + Moon Valley: "para revisión", sin producto |
| 6 | **Los hoteles Tayka llevan a SPAP05 o SPAP06.** Si hay tours con pick up en un hotel Tayka ("Tayka del Desierto", "Tayka del Sal", "Tayka de Sal"), es el Overland de Imperio Inca. Los 3 días son "Sol de Mañana Geysers…", "Siloli…" y "Salar de Uyuni…". Cuál de los dos lo deciden las noches en San Pedro: desde que llega a Calama (vuelo a CJC o primer tour de San Pedro) hasta el primer día del Overland. 4 noches es SPAP05 y 5 es SPAP06. Los tours de San Pedro de la lista tienen que ser los del paquete en el catálogo (M2-08). Va a "para revisión" si falta un día del Overland, si las noches no dan 4 ni 5, o si sobra o falta un tour de San Pedro | Test con el mail D: da SPAP05 (llega el 11.10, Overland el 15.10). Una variante con el Overland corrido al 16.10 da SPAP06. El mail D sin "Siloli" va a "para revisión" con "falta el día 2 del Overland". El mail D sin el tour del Tatio va a "para revisión" con "falta Tatio para SPAP05", y **no** se elige SPAP05 igual |
| 7 | **El título como tercera señal.** "…in Tayka Hotels 7N/8D" da SPAP05 y "…8N/9D" da SPAP06. "Package San Pedro de Atacama + Uyuni Salt Flats" (sin N/D) indica la familia Tayka, pero no decide entre 05 y 06: eso lo deciden las noches (fila 6). Si el título y los tours dicen cosas distintas, va a "para revisión" con las dos versiones | Test: el mail D con el título cambiado a "…Tayka Hotels 8N/9D" va a "para revisión" ("el título dice 8N/9D, los tours dan 4 noches en San Pedro"). Un mail con solo el título "…Tayka Hotels 7N/8D" y los tours del Overland, sin tours de San Pedro, va a "para revisión" por faltar tours |
| 8 | **Vuelos en alemán.** Se lee cada tramo: fecha, origen y destino ("nach"), aerolínea y número, salida ("Abflug"), llegada ("Ankunft") y equipaje ("Gepäck"). Si la llegada es otro día ("Ankunft: 08:25 (07.10.2026)"), se toma esa fecha. Se guardan todos los tramos, aunque vengan varios en una línea. Para el traslado se usan el que llega a Calama y el que sale de Calama | Modo prueba con el mail D: lee 6 tramos. MAD → SCL LA5404 llega el 07.10 a las 08:25. El traslado de llegada queda con LA148, 11.10, llega 16:11. Con el mail C: 2 tramos, LA156 y LA377 |
| 9 | **Pasajeros en alemán.** Se lee "Anrede" (mr/mrs → Sr./Sra.), "Vorname" (nombre), "Nachname" (apellido), "Geburtsdatum" (dd.mm.aaaa) y "Nationality". Se ignoran "Reisender: 0" e "Ist Fahrer". Sirve con o sin las líneas "Reisender". Si "Pax" no coincide con la cantidad de pasajeros, va a "para revisión" con el motivo "Pax dice 3 y hay 2 pasajeros" | Modo prueba: los 4 mails dan 2 pasajeros cada uno, con nombre, apellido y nacimiento correctos (ej. Gallien Carolyn Katharina, 09.03.1978). Variante del mail B con "Pax: 3": va a "para revisión" |
| 10 | **Los hoteles "booked by us" no generan nada a pedir.** Lo que Journaway reserva ("All Hotels are booked by us", "Accomodations booked by us") se guarda solo como información: hotel y fechas. No se convierte en componente ni en pedido. Vale aunque el bloque arranque con "Please Book the following accomodation:", como en el mail D. Los Tayka tampoco se piden aparte: van dentro del Overland | Integración con el mail D: ningún componente ni servicio a pedir menciona Hub Providencia, Fauna, Our Habitas, MET, Sonesta, Night Bus Peru, Viza, Saska ni Tayka. Los 8 hoteles aparecen en la sección informativa. Con el mail C: cero hoteles a pedir |
| 11 | **Pick up y drop off por tour.** Cada tour guarda su lugar de pick up / drop off tal como viene ("Hotel Rafain Centro", "Our Habitas Atacama", "Tayka del Sal Hotel"). Si el mail no lo trae (mail C), queda vacío: no se inventa | Modo prueba: los mails A, B y D muestran el pick up en cada tour. En el mail C, el pick up queda vacío y la reserva no va a revisión por eso |
| 12 | **Booking id.** Se usa el "Trip Number" cuando viene (mail C: 62992). Si no viene, el booking_id queda **vacío**: no se arma uno con nombres ni fechas. El detalle muestra "Journaway no mandó número de viaje", y la referencia visible es el pasajero principal + la fecha del primer servicio. Si no hay booking_id, M2-04 compara por remitente + producto + fechas + pax. Un mail repetido queda como "posible duplicada" y no se crea otra reserva en silencio. La falta de número **no** manda la reserva a revisión | Test: los mails A, B y D quedan con booking_id vacío. A y B son dos reservas aparte (distinto producto), no el mismo intercambio. Procesar dos veces el mail A da la marca "posible duplicada". El mail C queda con 62992 en sus dos reservas |
| 13 | **"Client reference" no se confunde con nosotros.** Si trae nombre, mail o teléfono del cliente (mails B, C y D), se guarda como contacto del pasajero. Si trae una dirección de HI Travel (mail A: operaciones3@hitravel.com.ar), se ignora | Test con el mail A: el contacto del cliente queda vacío y no figura ninguna dirección @hitravel.com.ar. Con el mail B: Carolyn Katharina Gallien, caro.gallien@yahoo.de, +49 179 4911927 |
| 14 | **Los adjuntos de Journaway no son la reserva.** Son pasaportes ("Attached you can find a copy of the travellers passports"). No se mandan a la IA: se lee el cuerpo y el detalle dice "trae adjuntos: pasaportes". Es lo contrario de TourRadar, donde el PDF sí es la reserva | Test con un `.eml` armado del mail D más un PDF adjunto: la llamada a la IA lleva solo el cuerpo y el detalle muestra el aviso del adjunto |
| 15 | **Traslados del paquete según la reserva.** Cuando a SPAP01 le sigue SPAP03, el shuttle de SPAP01 queda solo de llegada y la salida va con SPAP03. Así no se piden dos regresos. Si el paquete tiene traslado y falta el vuelo que lo usa, va a "para revisión" (regla de M2-03) | Integración con el mail C: un solo traslado de llegada (16.03, LA156) y uno solo de salida (23.03, LA377). Variante del mail C sin la línea de LA377: "para revisión" con "falta el vuelo de salida de Calama" |
| 16 | **Pasa por el modo prueba.** Los 4 mails corren por el circuito completo de M2-06 como reservas "de prueba", y el reporte para el owner dice, por mail, qué entendió y qué no. El resultado se compara con la tabla de arriba: cada diferencia figura en el reporte como "esperado X, salió Y" | Corrida del modo prueba sobre los 4 mails: coinciden en producto, fechas, pax, vuelos, pick up y estado. El reporte queda en `docs/sdd/diagnosticos/M2-09-journaway.md`, en llano |

## 4. Qué ve el usuario
- **Pantalla que cambia:** el detalle de la reserva (M2-05), solo lectura. Para Journaway suma:
  - **"Lo que reserva Journaway (no se pide)":** los hoteles con sus fechas.
  - **Pick up / drop off** al lado de cada tour.
  - **El número de viaje**, o "Journaway no mandó número de viaje".
  - **Las notas**, como "Journaway lo llama half-day; es el full day" o "trae adjuntos:
    pasaportes".
- **Recorrido:** el owner corre el modo prueba y abre la lista. Ve cinco reservas "de prueba":
  IGRE01, IGRE02, SPAP01 y SPAP03 (con el mismo 62992) y SPAP05. Abre la de SPAP05 y ve los 8
  hoteles en la sección informativa, los tours con su pick up y el vuelo LA148 en el traslado de
  llegada.
- **Estados:** los mismos de M2-05 (carga, error y vacío). Si no hay hoteles de Journaway, la
  sección no aparece. No se muestra una caja vacía.

## 5. Qué queda afuera
- **Pedirle a Journaway** que mande a `sales@` y ponga nuestro código: es tarea del owner. Esta
  pieza ya usa el código si viene (fila 1).
- **El reenvío de operaciones3@ a sales@:** se configura en Ferozo. La lectura de la casilla es
  M2-07.
- **Mandar pedidos a Imperio Inca, Horizonte Atacama, Transvip o Cuenca del Plata:** es M3.
- **Resolver las reservas "para revisión" desde la app:** es M4.
- **Otros productos de Journaway** (Patagonia, Ushuaia, Pascua, W Trek, buses): entran por el
  mismo camino (código → nombre → IA). No tienen reglas propias acá, porque no hay mails de
  ejemplo. Si llega uno que no se reconoce, queda "para revisión".
- **Cargar o corregir el catálogo de Journaway:** es M2-08.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#3** — **una sola lectura con IA por mail**, bajo el techo de `uso_ia` y con tope por mail.
  Lo demás no gasta IA: buscar nuestro código, limpiar los nombres de los tours, armar el paquete
  y decidir por Tayka o por el título. La IA solo propone un tour cuyo nombre no está en
  `codigo_externo`. Los adjuntos (pasaportes) no se mandan.
- **#1** — si hace falta una columna nueva (pick up por tour, hoteles de la agencia, notas), va
  en una migración nueva con RLS activa. Cada reserva deja su evento en `evento_reserva`.
- **#4** — la pieza no manda mails ni toca la casilla.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. Tests unitarios + linter + tipos (`npm test`, `npm run lint`, `tsc --noEmit`). El
     reconocedor de Journaway se prueba con datos ya extraídos (fixtures), sin IA: filas 1-7, 10,
     12, 13 y 15.
  2. Integración contra el Supabase real con el catálogo de M2-08 cargado: se crean las reservas,
     los componentes y los eventos de las filas 4, 6, 10, 12 y 15. Con las reservas marcadas "de
     prueba", que se pueden limpiar.
  3. El recorrido completo: el modo prueba (M2-06) sobre los 4 `.docx` reales, con la IA real
     bajo el techo, y la pantalla de detalle de las 5 reservas en el navegador. Más
     `npm run build`.
- **Test primero:** los casos de §3 se escriben primero como fixtures y tests, y se los ve fallar
  antes de implementar.
- **Dónde va cada cosa (orientativo):**
  - El reconocedor, como una rama de la agencia dentro del emparejado de M2-03:
    `src/lib/reservas/journaway/`.
    - `codigo.ts`: busca nuestros códigos como palabra entera, contra la tabla `producto`.
    - `nombres.ts`: limpia los nombres de los tours.
    - `paquete.ts`: arma el paquete con la combinación exacta y única, y aplica las reglas de
      Tayka, del título y de las noches.
    - `reconocer.ts`: orquesta y devuelve el producto o productos, o los motivos.
  - El armado de paquetes es una búsqueda exacta y chica (pocas excursiones): con fuerza bruta
    alcanza. Devuelve todas las combinaciones que cierran, para poder decir "hay más de una".
  - Las señales de Journaway se declaran en `data/journaway-senales.csv`, editable por el owner:
    las palabras de Tayka, los 3 días del Overland, los títulos con N/D y la nota de IGRE01. Si
    nombra un código que no existe, falla con un mensaje claro y no escribe nada.
  - La extracción de M2-02 suma los campos de Journaway:
    - `hoteles_agencia[]` (nombre, desde, hasta);
    - `pick_up` por tour;
    - `trip_number`;
    - `contacto_cliente`;
    - los vuelos con `llegada_fecha` cuando la llegada es al otro día.
    El prompt nombra las etiquetas alemanas. El esquema se extiende, no se duplica:
    `src/lib/ia/`.
  - Los adjuntos de Journaway no van a la IA: se decide por agencia en el paso de M2-02 que hoy
    elige "PDF o cuerpo".
  - Los textos de pantalla van en `src/lib/textos/`. Los cambios de detalle, en los componentes de
    M2-05.
  - Si hace falta guardar pick up, hoteles de la agencia o notas y M2-01 no lo tiene:
    `supabase/migrations/0011_...` (el siguiente número libre), con RLS.
  - Documentar en `docs/arquitectura/modelo-de-datos.md` los datos nuevos de la reserva.
- **Fixtures:**
  - Los 4 `.docx` de `Insumos/Mails` (Drive). Si no están en el clon, copiarlos a
    `Insumos/Mails/` antes de correr.
  - Las variantes de §3 (sin Laguna Cejar, con "SPAP06", con "Pax: 3", el `.eml` con pasaporte)
    van en `tests/fixtures/journaway/`, armadas a partir de los mails reales.
  - El resultado esperado de la tabla de §3, en `tests/fixtures/journaway/esperado.ts`.
- **No hay correcciones manuales en la base.**
- `next dev` agrega un bloque a `CLAUDE.md`: no commitearlo.
