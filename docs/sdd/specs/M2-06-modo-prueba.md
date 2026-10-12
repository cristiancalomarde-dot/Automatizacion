# M2-06 · Modo prueba con mails reales

**Depende de:** M2-04, M2-05

## 1. Qué queremos lograr
Pasar los mails de reserva de ejemplo por **todo el circuito** (leer con IA → reconocer el
producto → mismo intercambio → guardar), pero con las reservas marcadas **"de prueba"**. El owner
ve cada una en la pantalla de reservas, marca si quedó bien o mal, y con eso medimos cuánto hay que
corregir. Si más del 20% necesita corrección, se frena (PRD, riesgo #1). Recién con el OK del owner
se activa la lectura automática de `sales@` (M2-07).

## 2. Qué hay hoy
- **El circuito de M2-02 a M2-04:** convierte un mail en una o más reservas. Recibe el cuerpo del
  mail y, si hay, el PDF adjunto.
- **La pantalla de M2-05:** lista y detalle de reservas, de solo lectura.
- **El techo de gasto (#3):** `src/lib/ia/techo-gasto.ts` y la tabla `uso_ia`. Techo mensual de
  US$ 20.
- **Los mails de ejemplo:** el owner los guarda en `Insumos/Mails` (Drive). Hay tres formatos:
  - **.docx:** copias de mails de Kilroy y Journaway, y pedidos de HI Travel a proveedores.
  - **.pdf:** los Booking Statement de TourRadar.
  - **.eml:** mails bajados de Gmail tal cual. Hoy no hay ninguno, pero el owner puede sumarlos.
- **Mails de Journaway:** quedan para M2-09. Acá solo entran Kilroy y TourRadar.

### Los mails de ejemplo y qué se espera de cada uno
Las reglas de "para revisión" son las de M2-03: falta el vuelo y el producto tiene traslado, o el
producto no está cargado.

**Kilroy (9 archivos .docx → 12 reservas)**

| Archivo (abreviado) | Booking | Reservas esperadas | Producto | Estado esperado |
|---|---|---|---|---|
| Aarhus - Rio Starter Package OD032 | DK1576836-26196085 | 1 | OD032 | para revisión: falta el vuelo (incluye traslado de llegada) |
| Aarhus - Iguazu Falls Combined OD010D | DK1564627/cafj | 1 | OD010D (código exacto) | para revisión: falta el vuelo |
| Copenhague - Overland … CHB31 | DK1547743/pela | 1 | CHB31 | para revisión: falta el vuelo |
| Copenhague Overland San Pedro to Uyuni | DK1594392/olha | 1 | CHB31 | para revisión: falta el vuelo |
| Olso - Patagonia Highlights ARCH31 | NO1569851/saha | 1 | ARCH31 (código exacto) | para revisión: falta el vuelo |
| UK - 5 Countries 5C01 | UK1586142/fagu | 1 | 5C01, con sus 9 componentes | para revisión: falta el vuelo |
| Copenhaguen - Trekking Paradise ARCH33 ("2 NEW BOOKINGS") | DK1576932/emhe | **2** | ARCH33 y CHB31 | para revisión: falta el vuelo. Además se anota el pedido "el vuelo de salida es desde Puerto Natales" |
| Copenahue - Trekking Paradise (EXPRESS) | DK1586168/pela | 1 | ARCH33EXP, que **no está cargado** | para revisión: el producto no está en el catálogo |
| Copenagiue **varias** | DK1594100/maga | **3** | OD010D, OD014 y CHB31 | OD014 queda para revisión porque no está en el catálogo. OD010D y CHB31, para revisión por falta de vuelo |

Notas:
- El archivo "varias" es una respuesta de HI Travel que copia las 3 reservas y abajo trae el mail
  original de Kilroy, que repite el Overland. Tienen que salir **3 reservas, no 4**: el Overland
  repetido es el mismo intercambio (M2-04).
- El de Trekking Paradise EXPRESS también es una respuesta de HI Travel con el mail original
  abajo. Se lee igual.

**TourRadar (6 archivos .pdf → 4 reservas + 1 cancelación)**

| Archivo (abreviado) | Booking | Reservas esperadas | Producto | Estado esperado |
|---|---|---|---|---|
| 1376833 Overland San Pedro … La Paz | 1376833 | 1 | CHB31 | para revisión: falta el vuelo (2 pax) |
| 1377598 Patagonia Adventure (Original, 23 Sep) | 1377598 | 1 | AR09 | para revisión: falta el vuelo. Los opcionales (avistaje de ballenas, Punta Tombo y el vuelo Calafate–Ushuaia en vez del bus) quedan como pedidos especiales |
| 1377598 Patagonia Adventure (25 Sep, "Other") | 1377598 | **0** | AR09 | Mismo booking y mismo producto: se suma al historial de la reserva anterior, no crea otra (M2-04) |
| 1377583 Buenos Aires to Rio 12 Days | 1377583 | 1 | no está cargado | para revisión: el producto no está en el catálogo |
| 1383503 Argentina and Uruguay, heart of the River Plate | 1383503 | 1 | no está cargado | para revisión: el producto no está en el catálogo |
| 1363612 Iguazu Falls on a Shoestring (**cancelación**) | 1363612 | 1 | OD010A (según `Codigos Productos Tourradar.xlsx`) | para revisión, con el motivo "la agencia cancela". **Nunca queda como "recibida"** |

**No se procesan (sin gastar IA):**
- Los 8 "Pedido Proveedor - …": son mails de HI Travel a proveedores, no de una agencia.
- Los 4 "Reserva de Cliente Journaway - …": entran con M2-09.

En total: **15 archivos con IA y unas 17 reservas de prueba**.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Un comando:** `npm run probar:mails` procesa la carpeta `Insumos/Mails`. Si se le pasa un archivo o una carpeta (`npm run probar:mails -- "<ruta>"`), procesa eso | Test: con un archivo procesa uno. Con una carpeta procesa todos los .docx, .pdf y .eml que tenga, y nada más. Si la ruta no existe, termina con un mensaje claro y no escribe nada |
| 2 | **Los tres formatos entran igual que un mail real:** el .eml se lee con su remitente, asunto, cuerpo y PDF adjunto. El .docx se lee como cuerpo de mail, solo el texto (sin imágenes). El .pdf suelto entra como un mail de TourRadar con ese PDF adjunto. Después todos siguen por el mismo circuito de M2-02 a M2-04 | Test con fixtures **inventados** (sin datos reales): un .eml estilo Kilroy, un .eml con un PDF adjunto, un .docx y un .pdf terminan en la misma forma de "mail de entrada". El .docx de ARCH33 (9 MB, casi todo imágenes) se procesa sin mandar las imágenes a la IA |
| 3 | **Antes de gastar IA, se filtra:** solo se procesa lo que es de Kilroy o TourRadar según `data/agencias.csv`. Para eso se usa el remitente o, en las copias .docx, la dirección de la agencia que aparece en el texto. Lo demás se salta y se anota por qué | Test: los 8 "Pedido Proveedor" salen como "no es un mail de agencia" y los 4 de Journaway como "Journaway entra con M2-09". **Ninguno llama a la IA:** el contador de llamadas da 0 |
| 4 | **Cada reserva creada queda marcada "de prueba",** y también sus componentes, sus eventos y el mail recibido | Integración contra Supabase: después de una corrida, todas las filas nuevas tienen la marca de prueba. **La cantidad de reservas reales es la misma antes y después** |
| 5 | **Las reservas de prueba y las reales no se mezclan:** el "mismo intercambio" de M2-04 solo junta prueba con prueba. Un mail real con el mismo booking que una de prueba crea su reserva real | Integración: con una reserva de prueba DK1594100/maga, un mail real con ese booking y ese producto crea una reserva real nueva, y la de prueba no cambia. Al revés, lo mismo |
| 6 | **Los resultados de la tabla de §2 se cumplen:** cantidad de reservas por archivo, producto y estado esperado | Recorrido real (3ra verificación): el reporte de la corrida coincide con la tabla de §2. "Varias" da 3 reservas, ARCH33 da 2, el segundo PDF de 1377598 no crea reserva y la cancelación no queda "recibida". Si algo no coincide, se reporta como hallazgo; **no se fuerza el resultado** |
| 7 | **Correr dos veces no duplica:** un archivo ya procesado (mismo contenido) se saltea y no gasta IA | Integración: dos corridas seguidas sobre la carpeta dejan la misma cantidad de reservas de prueba, y la segunda no llama a la IA |
| 8 | **Borrar las pruebas sin tocar las reales:** `npm run probar:mails -- --borrar` borra todas las reservas de prueba, con sus componentes, eventos, mails recibidos y marcas del owner. Después se puede volver a correr desde cero. El gasto en `uso_ia` no se borra, porque fue real | Integración: con reservas reales y de prueba cargadas, `--borrar` deja 0 de prueba y **las reales intactas**: misma cantidad y mismos datos. `uso_ia` no cambia |
| 9 | **Lo que NO hace una corrida de prueba:** no crea reservas reales, no manda ningún mail y no se conecta a la casilla `sales@` (no lee, no marca, no mueve, no borra) | Test: la corrida funciona **sin la clave de `sales@` cargada**, y el script no importa nada de IMAP ni de envío de mails. Integración: reservas reales antes = después (fila 4) |
| 10 | **Tope de gasto por corrida (#3): US$ 2.** Se chequea antes de cada llamada, además del techo mensual de US$ 20. Si la próxima llamada pasaría el tope, esa llamada no se hace. Ese archivo y los que siguen quedan como "no procesado: tope de la corrida", sin inventar datos | Test con IA falsa: con un tope chico, la corrida corta antes de pasarse, y los archivos restantes figuran como no procesados. Con el techo mensual agotado pasa lo mismo, con su motivo. El reporte muestra el gasto de la corrida |
| 11 | **Un reporte por mail para el owner,** en llano, en `docs/sdd/diagnosticos/M2-06-mails/<archivo>.md`. Dice qué entendió (agencia, booking, producto nombrado, fechas, cantidad de pasajeros, vuelos, pedidos especiales), con qué producto lo emparejó y por qué (código exacto, nombre de la agencia o propuesta de la IA con su confianza), en qué estado quedó y por qué quedó en revisión. Si se salteó, el reporte dice por qué | Test del armado del reporte con un resultado fijo. Recorrido: hay un reporte por cada archivo de la carpeta, y "varias" muestra sus 3 reservas |
| 12 | **El reporte no expone datos personales:** no lleva mails, teléfonos, fechas de nacimiento ni pasaportes de los pasajeros. De los pasajeros, solo la cantidad y el apellido | Test: con un mail inventado que trae esos datos, el reporte no contiene el mail, el teléfono ni la fecha de nacimiento |
| 13 | **El owner marca cada reserva de prueba como bien o mal** en el detalle de la pantalla de M2-05. Si está mal, marca qué: producto, fechas, pasajeros, vuelos, estado o motivo, u otro; y puede dejar una nota. Se guarda quién marcó y cuándo, y se puede cambiar la marca | Test de pantalla: los botones aparecen **solo en las reservas de prueba**, nunca en una real. Integración: la marca queda guardada con su autor (#1) |
| 14 | **La medición:** % de reservas marcadas "mal" sobre las revisadas, y aparte el % con el **producto** mal (el número del PRD, riesgo #1). Una reserva que quedó "para revisión" con un motivo correcto cuenta como **bien**. Si más del 20% está mal, la medición dice **"se frena: no activar M2-07"**. Mientras falten reservas por marcar, dice cuántas faltan y no da veredicto | Test de la cuenta: 3 mal de 17 = 18%, "se puede seguir". 4 mal de 17 = 24%, "se frena". 2 sin marcar: "faltan 2 por revisar", sin veredicto |
| 15 | **El resumen:** `npm run probar:mails -- --resumen` escribe `docs/sdd/diagnosticos/M2-06-resumen.md` con la medición, el gasto, el modelo de IA usado y la lista de reservas con su marca. La pantalla muestra el mismo número | Recorrido: después de que el owner marca todas, el resumen y la pantalla dan el mismo %. El resumen dice qué modelo se usó, para decidir Sonnet vs. Opus |

## 4. Qué ve el usuario
- **Pantallas que cambian:** la lista y el detalle de reservas de M2-05.
- **Recorrido:**
  1. Se corre `npm run probar:mails`. Lo corre el agente, no el owner.
  2. El owner abre Reservas, activa "Ver las de prueba" y ve las ~17 con la marca **PRUEBA**.
  3. Entra a cada una, la compara con su reporte y el mail original, y toca "Está bien" o "Hay que
     corregir" (qué y una nota).
  4. Arriba de la lista ve "Revisadas 17 de 17 · 2 mal (12%) · se puede seguir".
- **Los tres estados:**
  - **Carga:** el de M2-05.
  - **Error:** si no se pudo guardar la marca, se avisa y la marca anterior queda como estaba.
  - **Vacío:** sin reservas reales pero con reservas de prueba, la lista dice "Todavía no entraron
    reservas reales. Hay N de prueba" con el link para verlas. Sin ninguna, el vacío de M2-05.

## 5. Qué queda afuera
- **Leer `sales@`:** es M2-07. Acá no se toca la casilla.
- **Journaway:** sus mails pasan por el modo prueba en M2-09, con este mismo comando.
- **Corregir la reserva desde la pantalla:** el owner solo marca bien o mal. Corregir es M4.
- **Ajustar la lectura o el emparejado si la medición da roja:** se planifica aparte con lo que
  muestren los reportes.
- **Cargar los productos que faltan** (OD014, ARCH33EXP, Buenos Aires to Rio y River Plate). Van
  por tandas, en paralelo.
- **Los "Pedido Proveedor":** sirven de referencia para M3, no para esta pieza.

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde (ver anexo).
- **#1:** la marca de prueba y la revisión del owner van en una migración con RLS activa. La marca
  guarda quién la puso.
- **#2:** la clave `ANTHROPIC_API_KEY` sale de `.env.local`. La corrida no necesita la clave de
  `sales@` y no la lee.
- **#3:** cada llamada pasa por el techo mensual (US$ 20) y además por el tope de la corrida
  (US$ 2), chequeados **antes** de gastar. Estimación de una corrida completa:
  - **Con Sonnet:** unos US$ 0,30 a 0,50 (15 archivos, ~US$ 0,01–0,03 cada uno).
  - **Con Opus:** hasta ~US$ 1,25.
- **#4:** no aplica a leer, pero la corrida no tiene ningún camino que mande mails (fila 9).

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. **Unitarias, linter y tipos.** Lectores de .docx, .pdf y .eml con fixtures inventados, filtro
     de agencia, tope por corrida con IA falsa, armado del reporte sin datos personales, cuenta de
     la medición y botones solo en reservas de prueba.
  2. **Integración contra el Supabase real, con IA falsa.** Marca de prueba en todas las filas,
     reales antes = después, prueba y real no se juntan, idempotencia, `--borrar` sin tocar reales
     ni `uso_ia`, y la marca del owner con su autor.
  3. **Recorrido real:**
     - `npm run probar:mails` sobre `Insumos/Mails` con la IA real.
     - Comparar los reportes con la tabla de §2.
     - Recorrer la pantalla: ver las de prueba, marcar una bien y una mal, y ver el %.
     - `npm run build`.
- **Bloqueo de la 3ra verificación:** necesita `ANTHROPIC_API_KEY` en `.env.local`, que la está
  consiguiendo el owner. Las capas 1 y 2 no la necesitan.
- **Test primero.**
- **Dónde va cada cosa (orientativo):**
  - **Script:** `scripts/probar-mails.ts`, con `"probar:mails": "tsx scripts/probar-mails.ts"` en
    `package.json`. Flags: ruta (archivo o carpeta; por defecto `Insumos/Mails`), `--borrar`,
    `--resumen` y `--modelo opus|sonnet` (por defecto el de `integraciones-ia.md`).
  - **Lectores:** `src/lib/modo-prueba/leer-archivo.ts`. Devuelven el mismo tipo de "mail de
    entrada" que va a producir el lector IMAP de M2-07, para que el circuito sea uno solo:
    - **.eml:** con `mailparser` (es probable que M2-07 lo use igual).
    - **.docx:** solo el texto, por ejemplo con `mammoth` (`extractRawText`), que ya descarta las
      imágenes.
    - **.pdf:** se manda como adjunto, sin convertirlo (integraciones-ia.md).
  - **Orden de la carpeta:** alfabético. Por M2-04, el resultado de 1377598 tiene que ser el mismo
    en cualquier orden.
  - **Tope por corrida:** un acumulador local de la corrida, envuelto alrededor de
    `llamarConTecho` (`src/lib/ia/techo-gasto.ts`). El gasto igual se suma a `uso_ia`.
  - **Idempotencia:** hash del contenido del archivo en `mail_recibido` (el mismo mecanismo de "no
    reprocesar" de M2-07).
  - **Migración:** `supabase/migrations/00NN_modo_prueba.sql`, con el siguiente número libre.
    - Columna `de_prueba boolean not null default false` en `reserva`, `reserva_componente`,
      `evento_reserva` y `mail_recibido`, salvo que M2-01 ya la haya traído.
    - Tabla `revision_prueba`: reserva, resultado bien/mal, qué estaba mal (lista), nota, autor y
      fecha. Con RLS activa.
  - **M2-04:** la búsqueda del "mismo intercambio" filtra por `de_prueba` igual al del mail
    entrante.
  - **Pantalla:** los componentes de M2-05. La marca se guarda con una server action que rechaza
    reservas con `de_prueba = false`. Se documenta en `docs/arquitectura/modelo-de-datos.md`.
  - **Reportes:** `docs/sdd/diagnosticos/M2-06-mails/` (uno por archivo) y
    `docs/sdd/diagnosticos/M2-06-resumen.md`. Seguir el estilo de `M1-08-traslados.md`: en llano,
    agrupado y con el porqué de cada cosa.
- **Insumos:** copiar la carpeta `Insumos/Mails` del Drive del owner a `Insumos/Mails` del clon.
  `Insumos/` está en `.gitignore`, así que los mails reales no se commitean. Los fixtures de los
  tests son inventados.
- `next dev` agrega un bloque a `CLAUDE.md`: no commitearlo.
