# Modelo de datos — qué información existe y dónde vive

> **Dueño de:** qué datos guarda la app, cómo se relacionan, y la **regla #1** (aislamiento entre
> usuarios). **No cubre:** de dónde salen los datos del catálogo (→ [`integraciones.md`](integraciones.md),
> el importador) ni las claves (→ [`secretos.md`](secretos.md)).

## Regla #1 — aislamiento entre usuarios: no aplica en el sentido habitual

Esta es una herramienta **interna y compartida**. Los ~12 usuarios son todos del equipo de HI
Travel y **todos ven y editan las mismas reservas, el mismo catálogo y los mismos proveedores**.
No hay datos privados de un usuario que otro no pueda ver.

Lo que sí se guarda es **quién hizo cada cosa**: cada cambio de estado, cada edición de un campo y
cada envío a un proveedor queda registrado con autor y fecha (es el "registro central" que promete
el PRD §1). Eso es trazabilidad, no aislamiento.

Igual se deja la seguridad a nivel base de datos (RLS de Supabase) activada, con una regla simple:
"solo usuarios autenticados del equipo pueden leer y escribir". Es defensa en profundidad, no
separación por usuario.

## Las tablas (qué es cada cosa)

- **producto** — un producto de catálogo. Código(s), nombre, ciudad(es), destino. Origen: el
  importador que lee tus Excel.
- **proveedor** — una empresa que presta o factura un servicio. Nombre (normalizado), mail(s) de
  contacto, teléfono, país/ciudad, aclaraciones, y **canal de contacto** (`mail` | `whatsapp` —
  algunos transferistas solo se manejan por WhatsApp). El MVP solo automatiza el canal `mail`; un
  proveedor `whatsapp` nunca recibe un pedido automático, siempre queda como tarea manual (ver
  [`integraciones.md`](integraciones.md)). Origen: el importador (hoja de contactos) + correcciones
  a mano.
- **producto_servicio** — un servicio dentro de un producto (alojamiento, excursión, traslado,
  bus, crucero…), con su **Service Provider** y su **Booking Supplier**, y la prioridad si hay
  varias opciones separadas por "/". Es lo que decide a qué proveedores se les escribe. Desde
  M1-08: los traslados guardan su **sentido** (`llegada` | `salida` | `ida_y_vuelta` |
  `sin_sentido`), que sale del texto del Excel ("SCL - accommodation" → llegada; "El Calafate
  Accommodation - FTE Airport" → salida; "Round Trip" → ida y vuelta; si no se deduce, queda
  `sin_sentido` y se reporta). Y un servicio que en el paquete vendido solo no se pide siempre
  lleva la marca `a_pedido` (lo pide el pax o el vendedor: la salida de OD016) o `segun_reserva`
  (depende de la variante: el Remis de OD019 solo si es CON traslados), con su nota. No se borra:
  se muestra con la marca. Origen: `data/servicios-a-pedido.csv` (migración 0009).
- **producto_servicio_noches** — en qué noches del paquete va un servicio (M1-07): noche de
  inicio, cantidad de noches y lugar ("Puerto Natales", "refugios"). Se engancha al servicio por
  (producto, `orden`). Un servicio puede ir en más de un tramo: en CH10 el alojamiento va en la
  noche 1 y en la 6 (se pide dos veces, con fechas distintas y las mismas opciones de hotel) y el
  W Trek de la 2 a la 5. Un paquete sin filas acá se muestra y se reserva como un bloque. Origen:
  `data/noches-servicio.csv`. RLS como el resto del catálogo (migración 0008). Un alojamiento
  también se puede nombrar por su hotel cuando la línea del Excel junta dos ("2 Nights Nacional
  inn Foz + 1 Night El Pueblito" ya son dos servicios del mismo nivel): OD010D va noches 1-2 en
  Foz (lado brasileño) y 3 en Puerto Iguazú (lado argentino); los hoteles de un nivel suman juntos.
- **tour_servicio_ajuste** — cómo queda un servicio de un paquete **dentro de un tour** (M1-08):
  `anular` (no se pide en ese tour), `solo_llegada` / `solo_salida` (de un ida y vuelta, solo ese
  lado), `reemplazar` (se pide con otro texto) o `invertir` (cambia de sentido), con su motivo y
  su origen (`regla` o `excepcion`). Lo que no figura se pide tal cual. Se identifica por (tour,
  paquete, `orden` del servicio) y no por el componente: un paquete puede estar dentro de un tour
  anidado (OD030 en CHB31 dentro de 5C01) y ahí vale el ajuste del tour de afuera. La pantalla y
  M3 lo leen igual. Lo calcula `npm run importar:tours` (ver la regla más abajo). RLS como el
  resto del catálogo (migración 0009).
- **codigo_externo** — mapea un código de una agencia/partner (Kilroy, TourRadar, etc.) al código
  interno de HI Travel. El mail de reserva trae uno de estos; acá se traduce.
  **Journaway (M2-08):** además de su código (solo los productos que Journaway pide de verdad, los
  celestes de la planilla del owner), cada producto lleva los nombres con que Journaway lo escribe:
  `codigo` = el nombre **limpio** para buscarlo (`limpiarNombreJournaway`: sin la numeración del
  mail, sin prefijos de lugar o tipo como "San Pedro de Atacama:" o "From Foz do Iguaçu:", sin
  acentos ni mayúsculas) y `nombre_externo` = el nombre tal cual, para mostrarlo. Un mismo nombre
  limpio no puede apuntar a dos productos. **Un producto es de Journaway si tiene algún
  `codigo_externo` de esa agencia** (sin columna nueva): así el importador sabe que no pisa un
  producto de otro catálogo y el catálogo le pone el chip "Journaway".
- **producto_componente** — solo para **tours compuestos** (ej. Patagonia Highlights, Overland San
  Pedro–Uyuni): la secuencia ordenada de lo que arma el tour. Cada fila es, en orden, o bien otro
  **producto** de catálogo (un paquete, con sus propios `producto_servicio` y proveedores), o bien
  un **tramo de bus público externo** (una ruta + fecha que HI Travel emite en su propio sistema
  de emisión, fuera de esta app). Ver la distinción con el bus de `producto_servicio` más abajo.
- **reserva** — una reserva recibida por mail. Agencia, remitente, mail original, **booking_id de
  la agencia** (el identificador que trae en el asunto, ej. `DK1531608` — es la clave que evita
  duplicar por los ida y vuelta del mail, ver más abajo), producto emparejado, fechas, pax,
  ciudades, habitación/categoría, **datos de vuelo** (número, aerolínea, horario de
  llegada/salida — obligatorios si el producto incluye un traslado; si faltan, la reserva va a
  `para_revision`), pedidos especiales, estado, flags (posible duplicada, pedido incompleto).
- **mail_recibido** — el mail original de una reserva, tal cual llegó (M2-01, migración 0010):
  remitente (dirección en minúscula y nombre), destinatarios, asunto, fecha, de dónde salió
  (`imap` con su carpeta Inbox o Spam y su UID, o `archivo` de `Insumos/` en el modo prueba), el
  Message-ID, el cuerpo y los adjuntos. Se guarda **una sola vez por huella**: el Message-ID
  normalizado o, si no tiene, un `sha256:` del remitente, la fecha, el asunto y el cuerpo
  (`src/lib/reservas/huella.ts`). El mismo mail visto en Inbox y en Spam queda una vez, y así la
  lectura automática sabe qué ya procesó sin marcar nada en la casilla. De los PDF se guarda el
  archivo en el bucket privado `mail-adjuntos` (ruta `<id del mail>/<nombre>`, lo lee el equipo,
  lo escribe solo el servidor); de los demás adjuntos, solo nombre, tipo y tamaño. `agencia` sale
  del remitente con `data/agencias.csv` (`src/lib/reservas/agencias.ts`); null si no se reconoció.
- **reserva_componente** — las partes de una reserva, en orden (M2-01): los componentes de un tour
  compuesto, o la lista de tours sueltos que manda Journaway. Cada una es un paquete (con su
  producto si se reconoció, y el `producto_componente` del tour) o un tramo de bus, con sus fechas
  y el texto tal como lo mandó la agencia. El estado de cada parte (pedido, confirmado, bus
  emitido) lo agrega M3.
- **ia_llamada** — cada llamada a la IA (M2-01, la llena M2-02): tarea, modelo, versión de las
  instrucciones, tokens, costo y resultado (`ok`, `cortada`, `invalida`, `error`,
  `sin_presupuesto`), con el mail y la reserva asociados. **No guarda el contenido del mail.** Ver
  [`integraciones-ia.md`](integraciones-ia.md).
- **reserva_pedido** — un pedido a un proveedor para una reserva. Proveedor, mail enviado (asunto
  + cuerpo), cuándo se envió, quién lo aprobó, resultado.
- **evento_reserva** — el historial: cada cambio de estado, edición de campo y envío, con autor y
  fecha.
- **importacion** — cada corrida del importador: qué archivo, cuándo, qué se cargó, qué quedó
  "para revisar".
- **usuario** — se apoya en Supabase Auth (identidad Google). Rol único en el MVP: "operador".

## Cómo se relacionan (resumen)

- un **producto** tiene muchos **producto_servicio**; cada uno apunta a uno o dos **proveedor**
  (service + booking).
- un **producto** tiene muchos **codigo_externo**.
- un **producto** (cuando es un tour compuesto) tiene muchos **producto_componente**, en orden;
  cada componente o bien apunta a **otro producto** (un paquete), o bien describe un tramo de bus
  externo (ruta, sin proveedor).
- una **reserva** apunta a un **producto** (cuando emparejó) y tiene muchos **reserva_pedido** y
  muchos **evento_reserva**. Si el producto es un tour compuesto, la reserva también tiene un
  **estado por componente** (qué paquete está en qué estado, qué tramo de bus está emitido o
  pendiente).
- un **reserva_pedido** apunta a un **proveedor**.

### Una regla de negocio que hay que aplicar al armar cada componente

Un paquete vendido **solo** suele llevar transfer de entrada y de salida (aeropuerto). Pero en un
**tour compuesto** eso no se hereda tal cual — solo llevan transfer las dos puntas del tour
completo:

- el **transfer IN del primer destino** del tour (donde sea que arranque: RIO, BUE, LPB, CJC…), y
- el **transfer OUT del último destino** del tour (simétrico al de entrada).

**Todo lo que queda en el medio** — cualquier conexión entre componentes resuelta con un bus
intermedio — **no lleva transfer**: no tiene sentido un traslado a una terminal de bus.

**Excepción:** en **IGR** (Puerto Iguazú) e **IGU** (Foz do Iguaçu) el transfer a la terminal de
bus **sí se mantiene**, aunque ese destino esté en el medio del tour.

Por eso `producto_componente` no reusa ciegamente los servicios de transfer del paquete: cada
componente marca si su transfer de entrada y/o de salida aplican en ese tour puntual (por defecto
solo la primera entrada y la última salida del tour completo, con la excepción de IGR/IGU).

**Excepciones por tour (M1-07):** `data/transfers-tour.csv` (tour, código, transfer_in,
transfer_out, nota) pisa la regla en un tour y componente puntual, con `si`/`no` (vacío = la
regla). Ej.: BRARCH26 termina en Santiago (OD029) **sin** transfer de salida. Si una fila nombra un
componente que el tour no tiene, el importador falla antes de escribir.

**Los traslados de cada paquete dentro del tour (M1-08, regla confirmada por el owner el
2026-10-10).** Las marcas de arriba son el resumen por componente; lo que se pide de verdad se
decide servicio por servicio y queda en `tour_servicio_ajuste`. Entre un paquete y el siguiente
de un tour siempre se viaja por tierra (bus), así que:

- al paquete al que se llega en bus no se le pide el traslado de **llegada**;
- al paquete del que se sale en bus no se le pide el de **salida**;
- uno de **ida y vuelta** queda solo del lado que corresponde (o se anula si no queda ninguno);
- uno **sin sentido** deducido (Remis Mendoza) se anula solo si no hace falta ningún lado; en una
  punta del tour se deja entero;
- el primer paquete conserva la llegada y el último la salida; Iguazú conserva los suyos (vienen
  dentro del 105 Premium). Solo se miran los servicios de tipo traslado: los buses del paquete son
  la conexión.

Las **excepciones** van en `data/traslados-tour.csv` (tour, paquete, servicio, acción `anular` /
`solo_llegada` / `solo_salida` / `reemplazar` / `invertir`, texto nuevo, nota) y le ganan a la
regla en ese tour y ese servicio (ej. el 105 Premium de OD010D en 5C01 con transfer desde la
Rodoviaria de Foz; el Transvip de OD030 en BOCHI04R de salida). Si una fila nombra un tour, un
paquete del tour o un servicio que no existe, el importador falla antes de escribir. El paquete
abierto solo sigue mostrando todos sus servicios.

**Las etiquetas "Transfer de llegada / de salida" en la pantalla (M1-09).** No se guardan: la
consulta del detalle (`etiquetasTransferEnTour`, `src/lib/catalogo/reglas.ts`) las calcula a partir
de las marcas de `producto_componente` y de `tour_servicio_ajuste`. Un lado se muestra si el
paquete conserva un traslado de ese lado después de los ajustes, o si la marca lo pide, ningún
ajuste lo anula y no se llega (o sale) con un bus del tour. El primer paquete llega en bus si el
tour tiene un bus propio ese día o antes; el último sale en bus si el tour tiene un bus propio
después (la salida de Puerto Natales de ARCH31 y ARCH33). Iguazú conserva sus marcas.

**Los paquetes de Journaway (M2-08) son armados sin la regla de buses.** Los paquetes de San
Pedro (SPAP01 a SPAP06) son `producto_componente` en orden, con su día (`dia_desde`), de
excursiones y traslados que también son productos (y el Overland privado UYUO01, con sus servicios
a Imperio Inca: la excursión, las dos noches en los Tayka con `producto_servicio_noches` y el bus
nocturno a La Paz). No llevan servicios propios ni alojamiento, y las marcas `transfer_in` /
`transfer_out` van en falso. La regla de M1-08 no se aplica: supone que entre las partes se viaja en
bus, y acá todo es el mismo destino (o el Overland arranca desde el hotel). El lado de un traslado
sale **solo** de `data/journaway-composicion.csv` y se guarda en `tour_servicio_ajuste` con origen
`excepcion` (el shuttle de Calama "solo salida" en SPAP03 y "solo llegada" en SPAP05 y SPAP06).
`npm run importar:tours` no los toca: solo escribe los ajustes de sus 7 tours. Los productos
simples de Journaway guardan en `fila_excel` la fila de la planilla de Journaway, y la pantalla lo
dice así (no "Excel de paquetes").

### Dos cosas que parecen lo mismo y no lo son

- **Un servicio "Bus" dentro de `producto_servicio`** (ej. el traslado Uyuni→La Paz que da el
  mismo proveedor boliviano del Overland) **sí** genera un pedido a proveedor por mail, como
  cualquier otro servicio — es parte de un paquete normal.
- **Un tramo de bus público en `producto_componente`** (ej. los buses entre El Chaltén, El
  Calafate y Puerto Natales de Patagonia Highlights) **nunca** genera un mail a nadie — lo emite
  una persona en el sistema de emisión de pasajes de HI Travel, por fuera de esta app. La app solo
  lo lista como tarea pendiente. Ver [`integraciones.md`](integraciones.md).

## Qué NO se guarda en el MVP

- **Precios, costos, márgenes** (módulo de costos — fuera de alcance, PRD §5). El importador los
  ignora.
- Las **respuestas de los proveedores** como dato estructurado (las vuelca una persona como nota +
  cambio de estado).
- Datos del pasajero más allá de lo que trae el mail (nombre del lead, cantidad).
- Nada de agencias/clientes más allá de identificar de qué agencia vino la reserva.

## Anexo técnico

- Postgres (Supabase). Claves primarias `uuid`. `created_at`/`updated_at` en todas. Timestamps en
  UTC (`timestamptz`).
- `reserva.estado` como enum: `recibida | para_revision | pedido_a_proveedor | confirmada |
  con_cambios | rechazada | cerrada | descartada`.
- `evento_reserva` es **append-only** (no se edita ni se borra): es el registro de auditoría.
  Lo hace cumplir la base (0010): un trigger rechaza cualquier edición o borrado, también desde el
  servidor. Las entradas `creada` (con el estado y los motivos iniciales) y `estado_cambiado`
  (anterior y nuevo) las escriben triggers de `reserva`; el autor es siempre `auth.uid()` (null =
  el sistema). `mail_agregado` y `posible_duplicada` las agrega el código (M2-04).
- Una reserva **nace solo en `recibida` o `para_revision`** (trigger), y `para_revision` lleva
  siempre uno o más `motivos_revision` escritos para el operativo (check: `para_revision` ⇔ hay
  motivos). Una reserva real no se borra (trigger): se cierra o se descarta.
- **Datos de prueba:** `reserva`, `mail_recibido` e `ia_llamada` llevan `de_prueba` (por defecto
  no). `public.borrar_datos_de_prueba()` (solo service role) borra todo lo marcado — llamadas a la
  IA, componentes, historial, reservas y mails — y devuelve las rutas de sus PDF, que borra el
  servidor (`borrarDatosDePrueba` en `src/lib/reservas/guardar.ts`). Es la única forma de borrar
  historial, y solo de reservas de prueba. Es el `--borrar` del modo prueba (M2-06).
  - **Los tests borran solo lo suyo** (migración 0013): `public.borrar_datos_de_prueba_de(mails,
    llamadas)` borra lo marcado de prueba que cuelga de esos mails (reservas, componentes, historial,
    llamadas) y esas llamadas sueltas (`borrarDatosDePruebaDe`; en los tests,
    `tests/helpers/registro-de-prueba.ts`). Así no tocan las reservas de prueba que revisa el owner.
    `tests/limpieza-acotada.test.ts` falla si un test o un script vuelve a borrar todo.
  - **Modo prueba (M2-06, migración 0014):** `reserva_componente` y `evento_reserva` también llevan
    `de_prueba`; la copia la base desde su reserva al insertar (trigger), así nunca disiente. Los
    archivos de `Insumos/` entran con Message-ID = huella del contenido
    (`<archivo-<sha256>@modo-prueba.hitravel.local>`), nunca el Message-ID real: la lectura real de
    M2-07 no los da por procesados. Los tests usan números de reserva propios (DK1594100 →
    DK9594100, `src/lib/reservas/numeros-de-test.ts`) y `procesarMail({ alcance })` acota el mismo
    intercambio a sus mails.
  - **`revision_prueba`** (0014): la marca del owner sobre una reserva de prueba — `resultado`
    (`bien | mal`), `que_mal` (lista: `producto | fechas | pasajeros | vuelos | estado_motivo |
    otro`; "mal" lleva al menos una, "bien" ninguna), `nota`, `autor_id`, fechas. Una por reserva
    (se puede cambiar). Un trigger rechaza marcar una reserva real y pone el autor (`auth.uid()`,
    nadie firma por otro). RLS del equipo (select/insert/update, sin delete). La guarda la server
    action `src/app/(app)/reservas/[id]/acciones.ts` con la sesión (`revision-prueba.ts`); es la
    única escritura de las pantallas de reservas. Los dos borrados de prueba borran también las
    revisiones.
- `proveedor.nombre_normalizado` para el emparejado (el README de los Excel pide "escribir el
  nombre del proveedor siempre igual"; se normaliza al importar).
- Emparejado de producto: primero por `codigo_externo` exacto → `producto`. Si no hay código o no
  matchea, la IA propone y, con confianza baja, la reserva va a `para_revision`. Umbral y lógica
  en [`integraciones-ia.md`](integraciones-ia.md).
- Detección de duplicados, en tres capas (la clave de identidad es **booking_id + producto**, no
  el booking_id solo — un mismo booking_id de Kilroy/Jysk puede cubrir más de un producto si el
  pax compra algo distinto más tarde):
  1. **Mismo booking_id + mismo producto (dura, se aplica primero):** el mail es una respuesta
     dentro del mismo intercambio (piden/mandan datos de vuelo, pasaporte, etc.) — **no se crea
     una reserva nueva**. Es el mecanismo que ya usaba el Make anterior (buscar el Booking ID antes
     de agregar la fila).
  2. **Mismo booking_id + producto distinto:** es una compra distinta y legítima bajo la misma
     referencia — **sí se crea** una reserva nueva.
  3. **Mismo booking_id + el mail no identifica un producto con confianza:** si hay una sola
     reserva existente con ese booking_id, se asocia a ella. Si hay más de una (ya pasó el caso 2
     antes), **no se adivina a cuál pertenece** — la reserva entrante queda `para_revision` para
     que una persona la vincule a mano.
  4. **Por similitud (blanda, red de seguridad):** si no hay booking_id o no matchea ninguno
     existente, match por remitente + código de producto + fechas + pax sobre reservas de los
     últimos ~60 días → flag `posible_duplicada`, **nunca** descarte automático (una persona
     confirma).
- **Cómo quedó en M2-04 (migración 0012, `src/lib/reservas/intercambio.ts` y `procesar-mail.ts`):**
  - El booking_id se compara **normalizado y dentro de la misma agencia** (`booking-id.ts`):
    Kilroy/Jysk país + número (`DK1594100`, sin `/iniciales` ni `-orden`); TourRadar el TOURRADAR
    REFERENCE ID (primer número del Booking Statement); Journaway el "ID" de 11 dígitos del asunto
    (sin ID no hay booking_id; el Trip Number no se usa). `reserva.booking_id` es el normalizado y
    `booking_id_original` el que vino.
  - "Mismo producto": el mismo producto del catálogo si los dos emparejaron; si alguno no, el mismo
    código o nombre de la agencia normalizado (`producto_clave_agencia`). Índice único parcial
    `(agencia, booking_id, clave_producto, de_prueba)`: dos corridas a la vez no crean la misma
    reserva (si choca, se vuelve a decidir y se suma).
  - Cada producto del mail es un pedido. Al sumarse, el mail queda en el historial
    (`mail_agregado`) y **solo completa lo vacío** (`datos_completados`); un dato distinto (fecha,
    pax, vuelo) no pisa: se anota (`datos_distintos`) y la reserva pasa a `para_revision` con
    "La agencia mandó datos distintos". Producto distinto → reserva nueva con `misma_referencia`.
  - Marca blanda: el "remitente" es **la agencia** (no la casilla), mismo producto + misma fecha de
    inicio + mismo pax, reservas que entraron en los últimos 60 días.
  - **Cancelación** (TourRadar "vendorcredit" / "BOOKING CANCELLATION STATEMENT", o la IA): se suma a
    la reserva de ese booking_id + producto, que pasa a `para_revision` ("la agencia mandó una
    cancelación"); sin reserva, nace una en `para_revision` ("cancelación de una reserva que no está
    en el sistema"). La app nunca cancela ni descarta.
  - **Vuelos que llegan después** (owner, plan M2 §3): pasa sola a `recibida` solo si el único
    motivo abierto era la falta de vuelo, el control de M2-03 ya no encuentra faltantes, los
    vuelos vinieron con confianza alta y el mail no trajo datos distintos. Si no, queda con
    "Llegaron vuelos en un mail nuevo: revisar". Las respuestas ("Re:", "SV:"…) solo se leen si el
    asunto trae el número de una reserva que espera un vuelo (`respuestas.ts`, owner 2026-10-14).
  - El estado solo se toca en `recibida` o `para_revision`; más adelante solo se suma al historial.
  - Un mail ya guardado (Message-ID, id IMAP o huella) no se vuelve a procesar ni gasta IA. Las
    reservas de prueba solo se comparan con las de prueba.
- RLS: policy única — `authenticated` puede `select/insert/update`; `delete` deshabilitado salvo
  mantenimiento (los estados `cerrada`/`descartada` reemplazan el borrado).

### Emparejado de producto (M2-03, migración 0011)

- **Tres pasos, en orden** (`src/lib/reservas/emparejar/emparejar.ts`): 1) código exacto en
  `codigo_externo` de esa agencia, leído con el lector de la agencia (`emparejar/agencias.ts`:
  Kilroy saca `HI_ARGENTINA_`/`HI_TRAVEL_` y `-677` y prueba también el código completo; TourRadar
  no usa código); 2) sin código, el `nombre_externo` de esa agencia, igual tras ignorar mayúsculas,
  espacios dobles y acentos; 3) sin código, la propuesta de la IA (ver `integraciones-ia.md`). Un
  código que no está cargado = "no está en el catálogo", sin IA. Nunca escribe en el catálogo.
- Los códigos Kilroy que no siguen la regla (y los de los tours, que el importador de M1-05 no cargó
  para Kilroy) viven en `data/codigos-kilroy.csv` y se cargan con `npm run importar:codigos-kilroy`
  (todo o nada).
- `reserva.origen_emparejado` (`codigo | nombre | ia`, solo con producto), `confianza_emparejado` y
  `sugerencia_producto_id` (lo que propuso la IA y no se aceptó; nunca es el producto).
- Una reserva por producto del mail, con el mismo `booking_id`. Solo "reserva nueva" se empareja del
  todo; cancelaciones, cambios y respuestas quedan "para revisión".
- `reserva_componente`: `tipo` pasa a texto (`paquete | tramo_bus | servicio`). Los paquetes del tour
  (un tour anidado se abre) con fecha = inicio + día − 1; los tramos de bus público y los buses del
  tour con `reserva_manual` (Kupos, Plataforma10) son `es_tarea`, sin proveedor; el bus que reserva
  un proveedor (Imperio Inca) es `servicio` con `proveedor_id` y `producto_servicio_id`. Final de
  ARCH31/ARCH33: si hay un vuelo desde PNT o el mail dice que vuelan desde Puerto Natales, el bus a
  Punta Arenas se cambia por el `servicio` "Transfer al aeropuerto de Puerto Natales (PNT)" con
  Patagonia Planet.
- **Vuelos que pide la reserva** (`emparejar/vuelos-requeridos.ts`): los traslados que se van a
  pedir, con la regla de M1-08 (`pasosDelTour` y `ladosDeUnTraslado` en `src/lib/catalogo/reglas.ts`,
  la misma lectura que la pantalla). Una llegada pide un vuelo con número y hora de llegada a ese
  aeropuerto; una salida, uno con número y hora de salida. A pedido u opcional: solo si el mail pide
  un traslado. `segun_reserva` (OD019 solo): "Elegir la variante" si el mail no dice con o sin
  traslados.
- **Iguazú sin dato de llegada** (owner, 2026-10-14; `src/lib/reservas/llegada-iguazu.ts`): una
  reserva de OD010A–D sin vuelo de llegada a IGR/IGU ni "bus" en los pedidos sigue "recibida" y
  muestra el aviso "Falta el vuelo o bus de llegada a Iguazú: pasárselo a Cuenca del Plata cuando
  llegue", bajo la misma marca que los vuelos que faltan: "falta dato de llegada" (owner, 2026-10-16).
  No se guarda: se calcula con producto, vuelos y pedidos. Una respuesta con el asunto de esa reserva
  se lee como la de una reserva que espera el vuelo; al sumar el vuelo, el aviso se va solo.

## Abierto

- ¿Un producto puede tener servicios en más de un destino? El README de los Excel dice que sí
  ("algunos productos combinan servicios de más de un destino"). El modelo lo soporta;
  confirmar al construir el importador.
- Nombres exactos de los estados intermedios — se afinan en M4 (PRD §6.5).
