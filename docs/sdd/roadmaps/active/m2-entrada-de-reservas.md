# M2 — Entrada de reservas por mail y detección del producto — plan

## 1. Qué logramos con este milestone

Que un mail de reserva de Kilroy, TourRadar o Journaway entre solo al sistema y quede como una
reserva con:
- su producto reconocido en el catálogo de M1, y los componentes si es un tour;
- fechas, pasajeros y vuelos;
- un estado visible: "recibida", o "para revisión" con el motivo.

Al terminar, el owner ve en la app las reservas que llegaron a `sales@` sin haber cargado nada a
mano. Ver `docs/prd.md` M2.

## 2. Qué queda afuera

- **Mandar mails a proveedores:** es M3. M2 no escribe a nadie.
- **La bandeja completa** (filtros, tablero, cambiar estados, editar datos, resolver revisiones):
  es M4. M2 entrega una lista y un detalle de solo lectura, para ver qué entró y por qué quedó
  en revisión.
- **Leer las respuestas de los proveedores y responderle a la agencia:** fuera del MVP (`prd.md`
  §5).
- **Más agencias que Kilroy (con Jysk, el mismo formato), TourRadar y Journaway.**
- **Avisos por mail o Slack cuando entra una reserva:** se evalúa después de usarlo.
- **Cargar el resto del catálogo de Kilroy y TourRadar (los ~100 tours):** se suma de a tandas en
  paralelo. Si llega una reserva de un producto que no está cargado, queda "para revisión" con
  ese motivo.

## 3. Preguntas y riesgos

**Respondidas antes de planear (owner, 2026-10-11):**
- **De dónde se leen los mails:** directo de `sales@` en Ferozo por IMAP, revisando también la
  carpeta Spam. Así ninguna reserva se pierde por el antispam. Ver `DECISIONS.md`.
- **Agencias:** Kilroy + TourRadar + Journaway. Journaway entra con las últimas piezas. Ver
  `DECISIONS.md`; el PRD §5 quedó actualizado.
- **Arranque:** primero un **modo prueba** sobre los mails de ejemplo y unos reales elegidos, con
  revisión del owner. Recién con su OK se activa la lectura automática.
- **Journaway:**
  - Su catálogo está en `Insumos/Borrador productos Journaway.xlsx`, completado por el owner: los
    códigos van sin guion y lo que se usa está en celeste.
  - SPAP05 y SPAP06 se reconocen por los hoteles Tayka o por el título ("San Pedro de Atacama +
    Uyuni Salt Flats in Tayka Hotels 7N/8D" u "8N/9D").
  - Los Tayka son parte del Overland y los reserva Imperio Inca.
  - Plataforma10 es el sistema donde HI Travel emite los pasajes a mano: queda como tarea, no
    como mail.

**Respuestas del owner a las preguntas de las fichas (2026-10-12).** Pisan lo que diga cada
ficha.

- **M2-03, códigos y productos:**
  - `HI_ARGENTINA_OVERLAND_7DAYS-677` es siempre CHB31.
  - El código de BOCHI04R en Kilroy está en un mail de ejemplo nuevo, en `Insumos/Mails`.
  - "Argentina and Uruguay, heart of the River Plate" (TourRadar) es **ARUY01**, que no está
    cargado: queda "para revisión" con motivo "producto no cargado".
- **M2-03 y M2-04, cancelaciones:** quedan "para revisión" y las resuelve una persona.
- **M2-04, vuelos que llegan después:** si lo único que faltaba era el vuelo, la reserva **pasa
  sola a "recibida"**.
- **M2-08, Cuenca del Plata:** IGRP02, IGRT01 e IGRE03 se piden al **mail general de Cuenca del
  Plata** (`reservas8@cuencadelplata.com`; antes era reservas3@, el owner lo cambió en el Excel
  de proveedores el 2026-10-13 y se carga al recargar el directorio en M2-08). No hacen falta filas propias.
- **M2-08, buses con Plataforma10:**
  - Los tramos USH ↔ PUQ (BUS02) y FTE ↔ PNT (BUS03, en los dos sentidos) se emiten en
    Plataforma10 como tarea manual.
  - Si ese día no hay bus, se pide la opción a **Patagonia Planet**: es la alternativa, con
    proveedor y mail.
- **M2-08 y M2-09, SPAP05 y SPAP06:**
  - Para HI Travel son **el mismo tour**, con los mismos servicios y precio. Journaway solo le da
    al pasajero una noche extra sin servicios.
  - No hace falta distinguirlos: se puede cargar un solo producto (o dos con los mismos
    servicios), y elegir entre 7N/8D y 8N/9D nunca manda la reserva a revisión.
  - El owner piensa ofrecer una sola opción.
- **M2-01, remitentes:**
  - TourRadar escribe desde `explore@mail.tourradar.com` y `msg@notify.tourradar.com`. Los
    statements llegan desde `system@sent-via.netsuite.com` (TourRadar Finance,
    finance@tourradar.com).
  - **Listado de dominios del owner (2026-10-12), pisa lo anterior:**
    - Kilroy: `kilroy.dk`, `kilroy.se`, `kilroy.no`, `kilroy.fi`, `kilroy.nl`, `kilroy.is`,
      `kilroy.be`, `kilroy.net`, `kilroy.uk`, más `kilroy.co.uk`, que aparece en los ejemplos.
    - Jysk: `jr.dk`.
    - TourRadar: `tourradar.com` y sus subdominios (`notify.`, `mail.`). Además, la dirección
      exacta `system@sent-via.netsuite.com`; el dominio entero no, porque NetSuite lo usan miles
      de empresas.
    - Journaway: todo el dominio `journaway.com`, no solo operations@ y de@.
  - `INBOX.Promociones` no se lee: el owner confirma que en Ferozo nunca entra nada ahí.

**Número de reserva de Journaway (owner, 2026-10-13, con capturas de Outlook).** Pisa lo que
diga cada ficha.
- **Dónde está:** siempre en el **asunto**, nunca en el cuerpo. Formatos:
  - "Program Booking / Client <Apellido> / ID 65643802533"
  - "de-DE Activity Booking / Client <Apellido> / ID 65676257628"
  - "de-DE Transfer + Activity Booking / Client …"
- **Qué es:** el `ID` (11 dígitos) es único por pasajero o cliente, y es el booking_id de
  Journaway.
- **Trip Number:** los "Program Booking" traen además, en el cuerpo, "Trip Number: 62992" y un
  "Trip Link". Es una referencia secundaria.
- **Remitentes:** escriben desde `operations@` (programas) y `de@` (actividades).
- Las respuestas ("RE: …") no se leen, como el resto de las agencias.

**Productos y códigos (owner, 2026-10-14, tras la corrida de M2-03).** Pisa lo que diga cada
ficha. Queda como un ajuste chico pendiente de M2-03, a hacer antes de M2-06.
- **Kilroy:** en la mayoría de los casos, nuestro código está entre `HI_ARGENTINA_` (o
  `HI_TRAVEL_`) y `-677`. Así lo lee M2-03.
- **ARCH33EXP:** `HI_TRAVEL_ARCH_EXP-677` ("Patagonia Trekking Paradise Express") es nuestro
  ARCH33EXP. Es ARCH33 con una W Express (CH11) en vez de la W estándar. No está entre los 17
  tours cargados: mientras no se cargue, el motivo es "producto no cargado".
- **TourRadar trae número de tour.** Ejemplos:
  - 150146, "Patagonia Adventure Tour From Buenos Aires to Ushuaia" = **AR09**;
  - 150104, "Buenos Aires to Rio de Janeiro 12 days" = **ARBR23**, que no está cargado.

  Con esto, el paso 1 (código exacto) también sirve para TourRadar, sin depender de la IA.
- **Cargo extra de TourRadar (owner, 2026-10-14):** un statement de cargo que se une a una reserva
  **la manda a "para revisión"**, con el monto en el motivo. Corrige lo que hizo M2-04: un cargo
  implica un servicio nuevo (un tour extra, un upgrade a SGL, un hotel mejor) que cambia la
  reserva.
- **Códigos de TourRadar:** borrador `Insumos/Borrador codigos TourRadar.xlsx` (106 IDs con el
  código propuesto, a validar por el owner). Lo validado se pasa a `Codigos Productos
  Tourradar.xlsx`, que el importador existente ya carga a `codigo_externo`.
- **Productos conocidos que todavía no están cargados:** ARCH33EXP, ARBR23 y ARUY01. Una reserva
  de esos productos va a "para revisión" con el motivo "producto no cargado", sin preguntarle a la
  IA.

**Qué mails lee la IA (owner, 2026-10-13, tras ver sales@ del 12 y 13 de octubre).** Pisa lo que
diga cada ficha.
- **Contexto:** en esos dos días hubo 44 mails de agencias (23 Kilroy, 21 Jysk). Unos 7 eran
  reservas nuevas, y el resto conversaciones (respuestas, cotizaciones, cambios).
- **Solo los mails originales:** la IA lee únicamente los mails que no son una respuesta ni un
  reenvío. Se descartan los que tienen un asunto que empieza con `Re:`, `RE:`, `SV:`, `Sv:`,
  `AW:`, `VS:`, `Fwd:`, `FW:`, `RV:` (también repetidos, como "Sv: Sv: RV:"). Las respuestas no
  pasan por la IA ni crean reservas.
  - Afecta a M2-04 y a M2-07.
  - Los mails nuevos sobre una reserva existente (por ejemplo, "NEW FLIGHT: DK1562336 …", sin
    `Re:`) sí se leen, y M2-04 los une a la reserva.
  - ~~Un vuelo que llega solo como respuesta no actualiza la reserva sola~~ — **cambiado (owner,
    2026-10-14):** en los mails reales, los vuelos llegan como respuesta ("Re: NEW FLIGHT:
    DK1562336…"). Una respuesta **sí** se lee con IA cuando se cumplen las dos condiciones:
    1. el asunto trae el número de una reserva que ya existe (el cruce lo hace el código, sin IA);
    2. esa reserva está "para revisión" esperando un vuelo.

    Si la IA encuentra el vuelo que faltaba, la reserva pasa a "recibida" (M2-04). Las demás
    respuestas se descartan sin gastar. El filtro lo arma M2-07; la regla de unir la arma M2-04.
- **Jysk no se lee:** el 95% son viajes a medida, y sus 3 o 4 tours propios no están en el
  catálogo de HI Travel. `jr.dk` queda en `data/agencias.csv` para reconocer al remitente, pero
  M2-07 no procesa sus mails. Si algún día Jysk reserva un paquete del catálogo, se carga a mano.
  - **Para después de M2 (anotado 2026-10-14): el BPA de Jysk.** Jysk vende el "Backpacker
    Adventure Tour" (BPA): grupos privados de 10 a 18 pax, 8 a 10 salidas por año (octubre a
    mayo/junio). Es un CHB31 con variantes: sin geysers del Tatio, sin bus Uyuni–La Paz, y de San
    Pedro a Uyuni en privado con hostels (no en regular). Para automatizarlo hace falta: cargarlo
    como producto propio (variante de CHB31), ver con mails reales cómo lo identifica Jysk (¿dice
    "BPA" en el asunto?) y leer solo esos mails de Jysk. No entra en M2. Hoy esas reservas llegan
    solo a ccalomarde@; el owner le pide a Jysk que las mande a sales@ con copia a él, y guarda
    4 o 5 ejemplos en `Insumos/Mails/BPA/`.
- **Costo:** con esto, la IA lee del orden de 3 a 5 mails por día, muy por debajo del techo.
- **Iguazú sin dato de llegada (owner, 2026-10-14):** Kilroy suele reservar Iguazú (OD010A–D)
  sin vuelo de llegada; a veces llegan en bus. La reserva no va a revisión por eso: sigue como
  "recibida" (el alojamiento es crítico) con un aviso visible "sin dato de llegada", que se le
  pasa a Cuenca del Plata cuando llegue. Códigos confirmados el mismo día:
  `HI_ARGENTINA_IGUAZU_BR_4DAYS-677` = OD010B, `HI_ARGENTINA_SAN_PEDRO_ATACAMA_4DAYS-677` = OD030,
  y "Patagonia Adventure Tour 16 Days" de TourRadar = AR09.
- **Kilroy: reserva nueva solo con "NEW BOOKING" o "KILROY booking request" en el asunto
  (owner, 2026-10-14).** Los pedidos de cotización (tailor made) vienen en cualquier formato y
  pueden traer un número DK/NL adelante, pero nunca dicen esas frases. Por ahora las cotizaciones
  se ignoran: se registra el mail, no se gasta IA y no se crea reserva. Un original que nombra
  una reserva ya conocida (cambio, cancelación, vuelo) sigue entrando por la lógica de M2-04.
  Ejemplo: 00736078 "New request 6-days Buenos Aires + Uruguay" era una cotización.
- **"Falta el vuelo" deja de mandar a revisión (owner, 2026-10-16; se construye DESPUÉS de su
  listado de la revisión del modo prueba):** se generaliza la regla de Iguazú. La reserva queda
  "recibida" con un aviso concreto ("Falta el vuelo de llegada a Calama (CJC) para el traslado de
  OD030"). Lo que no depende del vuelo (alojamiento, excursiones, bus) se puede pedir ya; solo el
  traslado espera el dato, y el aviso se va cuando llega la respuesta con el vuelo. "Para
  revisión" queda para lo que pide una decisión: producto no reconocido o no cargado, dudas de la
  IA en fechas o pax, cancelación y cargo extra de TourRadar. El owner marca el modo prueba
  mirando los datos (agencia, número, producto, fechas, pax, vuelos, pedidos y si el motivo es
  cierto), no el estado.
- **TourRadar: se lee solo el statement (owner, 2026-10-16; va con el listado del owner):** el
  PDF de finanzas (`system@sent-via.netsuite.com`) llega siempre y casi al mismo tiempo que el
  mail "BOOKING CONFIRMED". El statement trae tipo de habitación, precio neto, cancelaciones
  (vendorcredit) y cargos extra; el mail de confirmación no, y su formato está cambiando. El mail
  "BOOKING CONFIRMED" se registra sin IA y sin reserva. Ejemplos: `Insumos/Mails/BOOKING
  CONFIRMED nuevo formato TR*.docx` (1378369 y 1383503).
- **TourRadar: los vuelos van a mano (owner, 2026-10-16):** se le piden al pasajero por el
  dashboard de TourRadar y la respuesta llega mezclada entre muchos mensajes. De TourRadar se lee
  solo el statement, también en las respuestas: no se leen "Re:" de TourRadar buscando vuelos. El
  aviso "falta el vuelo" queda hasta que alguien cargue el vuelo a mano (M4). Regla para M3/M4:
  una reserva no pasa a confirmada mientras le falte el vuelo (o el bus en Iguazú).
- **Lista de reservas: pasajero principal y buscador (owner, 2026-10-16; va con el listado del
  owner):** columna con el pasajero principal y la cantidad ("Juan Perez x 3") y una caja de
  búsqueda por nombre de pasajero o número de reserva de la agencia. Los filtros completos
  (estado, agencia, fechas) siguen siendo de M4.
- **Para M3 (owner, 2026-10-16): Geysers del Tatio en el día 3** en todos los San Pedro de
  Atacama Explorer (OD030 y los tours que lo incluyen): llegada y día 1 son de adaptación a la
  altura. Importa al fechar los pedidos a proveedores.
- **Revisión del modo prueba (owner, 2026-10-16):** 23 reservas marcadas, 20 bien y 3 mal
  (13%, bajo el 20%). Las 3 mal: el mail "varias" de Kilroy (duda de pax) y la cancelación
  1363612 de TourRadar, partida en dos y sin decir que era cancelación. Detalle en
  `docs/sdd/diagnosticos/M2-06-revision-owner.md`.
- **Orden de la lista de reservas (owner, 2026-10-14):** primero las "para revisión"; dentro de
  cada grupo, por fecha de inicio del viaje, la más próxima arriba.
- **Base de pruebas separada antes de M2-07 (2026-10-14):** las pruebas automáticas y el
  desarrollo pasan a un segundo proyecto de Supabase; la base actual queda para producción.
  Va como paso previo de M2-07 (ver `DECISIONS.md` 2026-10-14).

**Tareas del owner (no bloquean el plan; sí la pieza que las usa):**
- **Crear la clave de Claude** (`ANTHROPIC_API_KEY`) y cargarla. Hace falta desde M2-02.
- **Pasar la clave de `sales@`** para cargarla como variable de entorno. Hace falta desde M2-07.
- **Pedirle a Journaway** que mande a `sales@` (con copia a quien quiera) y que ponga el código
  HI Travel. Mientras tanto, se puede agregar en Ferozo un reenvío automático de operaciones3@ a
  sales@.
- **Copiar el Excel de proveedores actualizado** (con Patagonia Profunda) a `Insumos/`.

**Abiertas, no bloquean:**
- ~~Cada cuánto se lee la casilla~~ — **resuelto (owner, 2026-10-11): una vez por día, a las 12 del
  mediodía (hora Argentina).** Las reservas llegan mayormente desde Europa y con mucha
  anticipación, así que no hace falta leer cada 5 minutos. Alcanza con el cron diario del plan
  Hobby de Vercel. Si hiciera falta más seguido, se revisa.
- **El modelo de IA** (Sonnet vs. Opus): se decide con la precisión medida en el modo prueba.
- **El techo de gasto y las reservas (owner, 2026-10-17):** si entran muchas reservas y se llega
  al techo, es mejor subir el techo que dejar de procesar reservas. En la práctica: (1) llegar al
  techo nunca pierde una reserva, los mails quedan en espera y se leen apenas haya margen; (2) al
  80% del techo y al tocarlo, la línea de la última lectura lo dice claro y pide subirlo; (3) subir
  el techo es cambiar un número. Hoy la ventana de lectura es de 7 días: un mail cortado por el
  techo que no se lee en esa semana quedaría afuera. **Ajuste pendiente (chico):** guardar esos
  mails como "en espera" para que se lean aunque pasen los 7 días. Las pruebas automáticas gastan
  en la base de pruebas, no en el techo real (owner OK, 2026-10-17).
- **TourRadar sin statements en sales@ (owner, 2026-10-17):** es normal, las reservas de
  TourRadar son esporádicas; en esa semana no hubo nuevas. No hay que cambiar nada.

**Riesgos y su límite aceptado:**
- **La IA lee mal (PRD riesgo #1).** El modo prueba mide cuánto hay que corregir. Si más del 20%
  necesita corrección manual, se frena y se ajusta antes de activar la lectura automática.
- **Hay productos que no están cargados:** la reserva queda "para revisión" con el motivo
  "producto no está en el catálogo". Nunca se adivina.
- **La casilla de Ferozo está casi llena:** si se llena, los mails rebotan antes de llegar. La
  app no lo puede evitar; el owner libera espacio o amplía el plan.
- **Leer `sales@` incluye mucho mail que no es reserva:** se filtra por remitente o agencia
  conocida antes de gastar IA (#3). Lo que no es de una agencia piloto no se procesa.

## 4. Reglas del proyecto que toca este milestone

- **#1** — tablas nuevas (`reserva`, `evento_reserva`, `mail_recibido`…) con RLS activa y autoría
  en el historial.
- **#2** — la clave de `sales@` y la de Anthropic van en variables de entorno, nunca en el código.
- **#3** — cada lectura de mail con IA pasa por el techo de gasto de `uso_ia`, con tope por mail.
- **#4** — no aplica a leer, pero M2 no puede tener ningún camino que mande mails ni que
  modifique la casilla (no se marca, mueve ni borra nada).
- **#5** — las 3 verificaciones en cada pieza.

## 5. Las piezas de trabajo (ESTA TABLA ES EL ESTADO)

| ID | Pieza | Estado | Depende de | Ficha |
|---|---|---|---|---|
| M2-01 | **Reservas en la base.** Tablas `reserva`, `reserva_componente`, `evento_reserva` y `mail_recibido` (migración con RLS). Agencias y remitentes conocidos en `data/agencias.csv`: Kilroy/Jysk, TourRadar y Journaway, con operations@ y de@journaway.com | ✅ terminada | — | `docs/sdd/specs/M2-01-reservas-en-la-base.md` |
| M2-02 | **Leer un mail con IA.** Un mail (cuerpo, o el PDF adjunto si hay) pasa a datos ordenados: agencia, booking_id, producto o tours nombrados, fechas, pax, pasajeros, vuelos y pedidos especiales, con confianza por campo. Funciona con mails en alemán. Bajo el techo de gasto | ✅ terminada | M2-01 | `docs/sdd/specs/M2-02-leer-mail-con-ia.md` |
| M2-03 | **Reconocer el producto (Kilroy y TourRadar).** Código exacto → nombre de la agencia (`codigo_externo`) → propuesta de la IA con confianza. Tour compuesto con sus componentes. Va a "para revisión" si: no hay confianza, el producto no está cargado, o falta el vuelo y el producto tiene traslado | ✅ terminada | M2-02 | `docs/sdd/specs/M2-03-reconocer-el-producto.md` |
| M2-04 | **Mismo intercambio, no reserva nueva.** Mismo booking_id + mismo producto → se agrega al historial de la reserva existente (por ejemplo, cuando mandan los vuelos). Producto distinto → reserva nueva. Ambiguo → "para revisión". Además, la marca de "posible duplicada" | ✅ terminada | M2-03 | `docs/sdd/specs/M2-04-mismo-intercambio.md` |
| M2-05 | **Ver las reservas que entraron.** Lista y detalle de solo lectura: agencia, producto, fechas, pax, vuelos, estado y motivo de revisión, más el mail original. Es la base de la bandeja de M4 | ✅ terminada | M2-03 | `docs/sdd/specs/M2-05-ver-las-reservas.md` |
| M2-06 | **Modo prueba con mails reales.** Procesa los mails de `Insumos/Mails` (.docx, .pdf y .eml) por el circuito completo, con las reservas marcadas "de prueba". Entrega un reporte por mail para el owner (qué entendió y qué no) y mide el % que necesita corrección | ✅ terminada | M2-04, M2-05 | `docs/sdd/specs/M2-06-modo-prueba.md` |
| M2-07 | **Lectura automática de sales@.** Por IMAP en Ferozo, Inbox y Spam, **una vez por día a las 12 (hora Argentina)**. Solo los remitentes de las agencias. No marca, mueve ni borra nada, y no reprocesa. Se activa con el OK del owner sobre el modo prueba | ✅ | M2-06 | `docs/sdd/specs/M2-07-lectura-automatica.md` |
| M2-08 | **Catálogo de Journaway.** Carga la planilla completada por el owner: productos simples, paquetes SPAP como combinaciones de excursiones, SPAP05 y SPAP06 con el Overland de Imperio Inca, y los nombres de Journaway como `codigo_externo`. Recarga el directorio (Patagonia Profunda) | ⬜ pendiente | M2-01 | `docs/sdd/specs/M2-08-catalogo-journaway.md` |
| M2-09 | **Reservas de Journaway.** Reconoce el paquete a partir de la lista de tours sueltos con fecha, los hoteles Tayka o el título. Lee los vuelos en alemán. Separa los hoteles que reserva Journaway ("booked by us") de lo que pide a HI Travel. Pasa por el modo prueba con los mails de ejemplo | ⬜ pendiente | M2-06, M2-08 | `docs/sdd/specs/M2-09-reservas-journaway.md` |

**Cobertura de las condiciones de M2 en el PRD:**
- Un mail entra y queda como reserva: M2-01, M2-02, M2-07.
- No duplicar el mismo intercambio: M2-04.
- PDF de TourRadar: M2-02.
- Datos clave y vuelos: M2-02.
- Emparejar contra el catálogo, o "para revisión": M2-03 y M2-09.
- Traslado sin vuelo → "para revisión": M2-03.
- Componentes del tour compuesto: M2-03 y M2-09.
- Estado inicial visible: M2-05.

## 6. Cuándo está terminado el milestone
- [ ] Todas las filas de la tabla en ✅ (cada una con sus 3 verificaciones en verde, regla #5).
- [ ] Las condiciones del milestone en `docs/prd.md` se cumplen y se pueden demostrar.
- [ ] **El owner lo probó con sus ojos:** entra una reserva real de cada agencia a `sales@` y la
      ve en la app con su producto, o en "para revisión" con un motivo que entiende.
- [ ] Este plan movido a `docs/sdd/roadmaps/archive/`.
