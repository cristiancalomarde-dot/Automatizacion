# M2-04 · Mismo intercambio, no reserva nueva

**Depende de:** M2-03

## 1. Qué queremos lograr
Que cada reserva aparezca **una sola vez**, aunque la agencia mande varios mails sobre ella. Por
ejemplo: el pedido original, después los vuelos, después los pasaportes, o una respuesta que
copia todo el pedido de nuevo. Esos mails se suman al historial de la reserva que ya existe y
completan lo que le faltaba. Una compra nueva bajo la misma referencia sí crea una reserva nueva.
Lo que el sistema no puede decidir con seguridad queda "para revisión" o con la marca "posible
duplicada". Nunca se descarta ni se junta nada por su cuenta.

## 2. Qué hay hoy
- **M2-01** crea las tablas `reserva`, `evento_reserva` y `mail_recibido`, y las agencias con sus
  remitentes en `data/agencias.csv`.
- **M2-02** lee cada mail con IA: agencia, booking_id, productos o tours nombrados, fechas, pax,
  pasajeros y vuelos.
- **M2-03** reconoce el producto en el catálogo y decide "recibida" o "para revisión", con su
  motivo (por ejemplo, "falta el vuelo").
- Hoy cada mail procesado crearía una reserva nueva. Esta pieza agrega el paso que decide **antes
  de crear**: si la reserva es nueva, si se suma a una que ya existe o si la tiene que mirar una
  persona.
- La regla de negocio ya está en `docs/arquitectura/modelo-de-datos.md`, anexo "Detección de
  duplicados". Esta ficha la baja a casos concretos con los mails de ejemplo.

**Lo que muestran los mails de ejemplo (`Insumos/Mails`)** y cómo ajusta las reglas:

| Agencia | Qué hace de booking_id | Lo que hay que tener en cuenta |
|---|---|---|
| **Kilroy** (y Jysk) | La "KILROY Reference" o el "Our order number" del cuerpo, que también aparece en el asunto: `DK1594100/maga`, `NO1569851/saha`, `UK1586142/fagu`, `DK1576836-26196085`. **Se compara solo la parte de país + número** (`DK1594100`). Lo que va después de la `/` son las iniciales de quien la cargó, y lo que va después del `-` es un número de orden. Las dos cosas pueden cambiar entre un mail y otro de la misma reserva | **Un mail puede traer varias reservas.** "2 NEW BOOKINGS - DK1576932/emhe" trae TOUR 1 (ARCH33) y TOUR 2 (Overland) bajo la misma referencia. El documento "varias" junta tres (Iguazú OD010D, El Calafate OD014 y el Overland) con `DK1594100/maga`, y además copia el mail anterior que traía solo el Overland. Las respuestas ("RE: NEW BOOKING …") repiten el pedido entero |
| **TourRadar** | El **"TOURRADAR REFERENCE ID"** del PDF. Es el primer número del nombre: en "Booking Statement **1377598** - 25372219 - vendorbill", el booking_id es `1377598`. **El segundo número no sirve**, porque cambia en cada estado de cuenta: 1377598 tiene dos, el 25372219 y el 25388222. El campo "HI TRAVEL SOUTH AMERICA BOOKING ID" trae un nombre ("Blanca Roman x1"), no un identificador | La misma reserva vuelve con un **estado de cuenta nuevo**: el de 1377598 del 25-sep solo agrega "Other 102 USD". También llega la **cancelación** como "BOOKING CANCELLATION STATEMENT" (vendorcredit, 1363612) |
| **Journaway** | El **"Trip Number"** cuando viene (`62992`, también en el "Trip Link"). Si no viene, **no hay booking_id** | Varios mails no lo traen: los dos de Iguazú y el de SPAP05. El "Client reference" a veces es el pax y a veces una casilla nuestra, así que no sirve como clave. Los dos de Iguazú son **la misma familia (Gallien), en días seguidos (13 y 14/06/2027) y con productos distintos**: son dos reservas legítimas. Escriben desde dos casillas: `de@` y `operations@journaway.com` |

Dos ajustes que salen de esta tabla:
- El booking_id se compara **dentro de la misma agencia**. Un número de TourRadar y un Trip
  Number de Journaway podrían coincidir de casualidad.
- Para la marca blanda, el "remitente" es **la agencia**, no la casilla exacta. Kilroy escribe
  desde `copenhagen@`, `aarhus@`, `emhe@`… y Journaway desde `de@` u `operations@`.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

Cada mail se parte en **pedidos**: uno por cada producto que nombra. Un mail de Kilroy con TOUR 1
y TOUR 2 da dos pedidos, y el documento "varias" da tres. Cada pedido pasa por las reglas por
separado.

**"Mismo producto"** quiere decir:
- el mismo producto del catálogo, si los dos emparejaron;
- si alguno no emparejó, el mismo código o nombre de la agencia, normalizado. Por ejemplo,
  `HI_ARGENTINA_OVERLAND_7DAYS-677`, o el título del tour de TourRadar.

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Un mail ya procesado no se procesa dos veces.** Se reconoce por su Message-ID. Si no lo tiene, se usa el id IMAP (carpeta + UIDVALIDITY + UID), y en el modo prueba, la huella del archivo. El control va **antes** de llamar a la IA, así que un mail repetido no gasta nada (#3) | Test: el mismo mail entra dos veces → 1 fila en `mail_recibido`, 1 reserva, 1 sola llamada a la IA y ningún evento nuevo la segunda vez. Si el mismo mail aparece en el Inbox y en Spam, cuenta como uno. **No debe pasar:** que la segunda pasada cree una reserva, sume un evento al historial o registre gasto en `uso_ia` |
| 2 | **booking_id normalizado por agencia**, según la tabla de §2. Se guardan los dos: el original (para mostrarlo) y el normalizado (para comparar) | Test unitario con los textos reales: `DK1594100/maga` y `DK1594100/olha` → `DK1594100`. `DK1576836-26196085` → `DK1576836`. "Booking Statement 1377598 - 25388222" → `1377598`. "Trip Number: 62992" → `62992`. Los mails de Journaway de Iguazú → sin booking_id. "Blanca Roman x1" **no** se toma como booking_id |
| 3 | **Mismo booking_id + mismo producto → no se crea una reserva.** El mail se suma al historial de la que ya existe (evento "llegó otro mail de la agencia", con enlace al mail) y **completa solo los datos vacíos**: vuelos, pasaportes, pasajeros, pedidos especiales | Integración: primero entra el mail del Overland `DK1594100/maga` (9-oct) y después el documento "varias" → el Overland sigue siendo **1 sola reserva**, con 2 mails en su historial. Los 2 estados de cuenta de TourRadar 1377598 → 1 reserva de "Patagonia Adventure Tour 16 Days", con los dos en el historial. **No debe pasar:** que aparezca una segunda reserva del Overland o de 1377598 |
| 4 | **Un dato distinto no pisa al que ya está.** Si el mail nuevo trae otra fecha, otra cantidad de pax u otro vuelo, se anota en el historial ("la agencia mandó salida 12/03, la reserva dice 06/03"). Si la reserva está en "recibida", pasa a "para revisión" con el motivo "la agencia mandó datos distintos" | Test: una reserva con 2 pax recibe un mail del mismo intercambio con 3 pax → sigue con 2, queda el evento con los dos valores y pasa a "para revisión". **No debe pasar:** que el valor guardado cambie solo |
| 5 | **Si los datos nuevos resuelven el "falta el vuelo", la reserva pasa sola a "recibida".** Pasa solo si se cumplen tres condiciones: (a) el único motivo abierto era la falta de vuelo; (b) después de completar, el mismo control de M2-03 ya no encuentra que falte nada, y los vuelos vinieron con confianza alta; (c) el mail no trajo datos distintos (fila 4). Queda anotado en el historial: "pasó a recibida porque llegaron los vuelos (mail del DD/MM)". Si falta alguna condición, sigue en "para revisión", con la nota "llegaron vuelos, revisar". **Por qué alcanza con esto:** "recibida" no le escribe a nadie. Antes de mandar cualquier pedido a un proveedor, una persona lo revisa y lo aprueba (#4, en M3) | Tests: (a) reserva en revisión solo por vuelo + mail con los vuelos de llegada y salida en confianza alta → "recibida", con el evento. (b) Llega solo el de llegada y el producto también tiene traslado de salida → sigue en revisión. (c) Había otro motivo más (producto con baja confianza) → sigue en revisión, con la nota. (d) Vuelos con confianza baja → sigue en revisión. **No debe pasar:** que una reserva con otro motivo abierto pase a "recibida" |
| 6 | **Mismo booking_id + producto distinto → reserva nueva**, enlazada en el historial a las otras de la misma referencia ("misma referencia de la agencia que #NNN") | Integración con el documento "varias": ya existe el Overland `DK1594100` → se crean Iguazú OD010D y El Calafate OD014 (2 nuevas) y el Overland se suma al historial. Resultado: 3 reservas con `DK1594100`. Con "2 NEW BOOKINGS - DK1576932/emhe" → 2 reservas (ARCH33 y Overland) desde un solo mail |
| 7 | **Mismo booking_id, pero el mail no deja claro el producto.** Si hay **una sola** reserva con ese booking_id, se suma a ella (como en la fila 3). Si hay **varias**, no se adivina: el mail queda en una reserva "para revisión" con el motivo "no se sabe a cuál de las N reservas con la referencia X corresponde", con enlace a cada una | Tests: un mail "aquí van los pasaportes" con `DK1586168` y una sola reserva con esa referencia → se suma a ella. El mismo mail con `DK1576932` (que tiene ARCH33 y el Overland) → "para revisión" con las 2 enlazadas. **No debe pasar:** que los datos se copien a una de las dos, ni a las dos |
| 8 | **Sin booking_id que coincida → marca blanda "posible duplicada".** Busca reservas de los **últimos 60 días** (según cuándo entraron) con la **misma agencia + mismo producto + misma fecha de inicio + misma cantidad de pax**. Si hay alguna, la reserva se crea igual, queda "para revisión" con la marca `posible duplicada` y el enlace a la otra. **Nunca se descarta ni se junta sola**: lo resuelve una persona (en M4) | Tests: un mail de Journaway reenviado (con otro Message-ID) del mismo tour, fecha y pax → 2 reservas, la segunda marcada y enlazada. Los dos mails de Iguazú de los Gallien (Brazilian Side 13/06 y Argentina Side 14/06) → 2 reservas **sin** marca. Mismo producto y pax, pero la otra reserva entró hace 61 días → sin marca. **No debe pasar:** que una reserva marcada desaparezca, quede "descartada" o se mezcle con la otra |
| 9 | **Cancelación de la agencia.** Por ejemplo, el "BOOKING CANCELLATION STATEMENT" de TourRadar. Se suma al historial de la reserva de ese booking_id + producto, que pasa a "para revisión" con el motivo "la agencia mandó una cancelación". **La app no cancela nada sola.** Si no hay reserva con ese booking_id, se crea una en "para revisión" con el motivo "cancelación de una reserva que no está en el sistema" | Test con el PDF 1363612: con la reserva ya cargada → sigue siendo 1, ahora en revisión con el evento. Sin la reserva → 1 reserva en revisión con ese motivo. **No debe pasar:** que quede "recibida", que cambie a "descartada" o "cerrada", ni que se borre |
| 10 | **Las reservas de prueba y las reales no se cruzan.** Las del modo prueba (M2-06) solo se comparan con otras de prueba | Test: una reserva real `DK1594100` y un mail de prueba con la misma referencia → se crea la de prueba, y la real no recibe ningún evento |
| 11 | **Dos mails del mismo intercambio en la misma lectura** (por ejemplo, uno en el Inbox y otro en Spam) se procesan en el orden en que llegaron. El segundo ya encuentra la reserva del primero. Dos corridas al mismo tiempo tampoco pueden crear dos reservas con el mismo booking_id + producto | Integración: 2 mails `DK1594100` del Overland en la misma corrida → 1 reserva. Test de concurrencia (dos procesos a la vez) → 1 reserva |
| 12 | **Solo se toca el estado de reservas en "recibida" o "para revisión".** Si la reserva ya avanzó (desde M3: "pedido a proveedor", "confirmada"…), el mail se suma al historial y completa los datos vacíos, pero el estado no cambia | Test: reserva en "pedido a proveedor" + mail con datos distintos → el evento queda y el estado sigue igual |

## 5. Qué queda afuera
- **Resolver a mano** una "posible duplicada" o una revisión ("es duplicada", "es nueva",
  "vincular a #NNN"): es la bandeja de M4. M2-05 solo muestra la marca y el motivo.
- **Que una persona reprocese un mail:** es M4.
- **Juntar dos reservas que ya existen** o separar una.
- **Avisar a los proveedores de un cambio o una cancelación:** es M3, y siempre con aprobación
  (#4).
- **Reconocer los paquetes de Journaway:** es M2-09. Acá solo se usa el producto que ya viene
  reconocido.
- **Leer la casilla:** es M2-07. Esta pieza recibe los mails ya leídos.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — si se agrega una columna o una tabla, va en una migración nueva con RLS activa. Cada
  mail asociado, dato completado o cambio de estado queda en `evento_reserva` con su autor
  (`sistema`) y su fecha.
- **#3** — el control de "mail ya procesado" va antes de la IA: un mail repetido no gasta nada.
  Las reglas de esta pieza no llaman a la IA.
- **#4** — nada sale hacia afuera. La pieza no escribe a nadie, no modifica la casilla y no
  cancela ni descarta reservas por su cuenta.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. Tests unitarios + linter + tipos: normalizar el booking_id (fila 2), "mismo producto", la
     decisión por pedido (filas 3-9 con datos en memoria) y completar sin pisar (filas 4-5).
  2. Integración contra el Supabase real, con los mails de `Insumos/Mails` del clon. La IA va
     con respuestas grabadas de M2-02, así que no gasta. Cubre las filas 1, 3, 6-11, la prueba de
     concurrencia y que RLS sigue activa en las tablas tocadas.
  3. Recorrido completo: correr la secuencia "Overland 9-oct → varias → 2 NEW BOOKINGS → los dos
     de TourRadar 1377598 → la cancelación de 1363612 → los dos de Iguazú de Journaway" de punta a
     punta por el circuito de M2-02 → M2-03 → M2-04. El resultado tiene que ser exactamente:
     - 3 reservas con `DK1594100`;
     - 2 con `DK1576932`;
     - 1 con `1377598` y 2 mails en su historial;
     - 1 con `1363612` en "para revisión";
     - 2 de Journaway sin marca.

     Correr la secuencia dos veces no cambia nada (fila 1). Más `npm run build`.
- **Test primero:** escribir los tests de las filas 2, 3, 6 y 8 con los textos reales, y verlos
  fallar porque "no hay deduplicación" antes de implementar.
- **Dónde va cada cosa (orientativo):**
  - `src/lib/reservas/booking-id.ts` (+ `.test.ts`): normalizar por agencia. Kilroy/Jysk:
    `^([A-Z]{2}\d+)` sobre "KILROY Reference" / "Our order number" / el asunto. TourRadar: el
    "TOURRADAR REFERENCE ID", o el primer número de "Booking Statement N - M". Journaway: "Trip
    Number" o `/goto/N`. Si M2-02 ya extrae el booking_id crudo, esto solo normaliza.
  - `src/lib/reservas/intercambio.ts` (+ `.test.ts`): la decisión pura por pedido →
    `nueva | sumar_a(id) | revision_ambigua(ids) | nueva_posible_duplicada(id)`, y el armado de los
    cambios (completar vacíos, conflictos, recheck del vuelo con la función de M2-03).
  - `src/lib/reservas/procesar-mail.ts` (o el orquestador que dejen M2-02/M2-03): primero el
    chequeo de `mail_recibido`, después la IA, el emparejado y M2-04. Va todo en una transacción
    por mail.
  - Migración nueva (el número que siga a las de M2-01…M2-03):
    - `reserva.booking_id_normalizado`, `reserva.es_prueba` y `reserva.posible_duplicada_de`, si
      M2-01 no los creó;
    - índice único parcial `(agencia_id, booking_id_normalizado, clave_producto, es_prueba)`
      donde el booking_id no es nulo. Es la red contra la carrera de la fila 11;
    - índice único en `mail_recibido(message_id)` y en `(carpeta, uidvalidity, uid)`;
    - enlace mail ↔ reserva de muchos a muchos (un mail de "varias" toca 3 reservas). Puede ser
      `evento_reserva.mail_recibido_id` o una tabla `reserva_mail`, lo más simple. Con RLS como
      el resto (#1).
  - `clave_producto` = id del producto del catálogo si emparejó. Si no, el código o nombre de la
    agencia normalizado (minúsculas, sin espacios dobles ni sufijo `-677`).
  - Tests: `tests/intercambio-m2-04.integration.test.ts` y
    `tests/recorrido-m2-04.integration.test.ts`.
- **Lo que esta pieza le pide a M2-02:**
  - que devuelva **una lista de pedidos por mail** (no uno solo);
  - que marque si el mail es una **cancelación**. En TourRadar se reconoce sin IA, por el
    encabezado "BOOKING CANCELLATION STATEMENT" o por "vendorcredit".

  Si M2-02 no lo trae, se agrega acá, con su test.
- **Documentar** en `docs/arquitectura/modelo-de-datos.md`, anexo "Detección de duplicados", lo
  que cambia:
  - el booking_id se compara normalizado y dentro de la misma agencia;
  - el "remitente" de la marca blanda es la agencia;
  - el caso de la cancelación y la regla de la fila 5.
- `next dev` agrega un bloque a `CLAUDE.md`: no commitearlo.

## Preguntas abiertas (no bloquean)
- **Fila 5 (vuelos que llegan después):** se propone que la reserva pase sola a "recibida" con las
  tres condiciones. Si el owner prefiere que lo decida siempre una persona, la nota "llegaron
  vuelos, revisar" ya está y alcanza con sacar el paso automático.
- **Journaway sin Trip Number:** un mail de seguimiento (vuelos, pasaportes) que no lo trae no se
  puede enganchar solo. Queda como reserva nueva con la marca "posible duplicada" si coincide en
  producto, fecha y pax, y si no, sin marca. Se resuelve de raíz si Journaway pone siempre el Trip
  Number o el código HI Travel, que es el pedido que el owner ya les va a hacer.
- **Fecha exacta en la marca blanda:** se usa la misma fecha de inicio. Si en el modo prueba
  aparecen duplicadas con un día de diferencia (cambio de vuelo), se amplía a ±1-2 días.
