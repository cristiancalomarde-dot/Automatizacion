# M2-03 · Reconocer el producto (Kilroy y TourRadar)

**Depende de:** M2-02

## 1. Qué queremos lograr
Que cada reserva que leyó la IA quede **atada a un producto del catálogo de M1**, o en "para
revisión" con un motivo que se entienda. Si el producto es un tour, también quedan sus partes: qué
paquete va qué día y qué bus hay que emitir a mano. El sistema **nunca adivina**: si no está seguro,
lo dice. Con esto M3 sabe qué pedirle a cada proveedor y M2-05 puede mostrar la reserva.

## 2. Qué hay hoy
- **M2-02** entrega la ficha de un mail: tipo de mail (reserva nueva, cancelación, cambio…),
  agencia, booking_id, lo que piden (cada producto con su nombre y su código si lo trae, fechas y
  habitación), pax, pasajeros, vuelos y pedidos especiales, con confianza por dato y la lista de
  **datos dudosos**. Un mail puede nombrar más de un producto (el Kilroy de ARCH33 trae "TOUR 1" y
  "TOUR 2"). M2-02 no decide el estado: eso es acá.
- **M2-01** deja las tablas `reserva` (con `motivos_revision`: "para revisión" siempre lleva
  motivo), `reserva_componente` y `evento_reserva` (la entrada "creada" se agrega sola), y las
  agencias con sus remitentes en `data/agencias.csv`.
- **La tabla `codigo_externo`** (M1-04 y M1-05) tiene, por producto:
  - el código **HI Travel** (los 17 paquetes, los 7 tours y los de Iguazú);
  - el código **Kilroy**, que es el mismo nuestro (`OD010D`, `ARCH31`…), sin nombre;
  - el código y el **nombre de TourRadar**, solo para los 5 de Iguazú: `Iguazu Falls on a Shoestring
    (3N)` → OD010A, `Iguazu Falls on a Shoestring Brazil (4 days)` → OD010B, los dos `Iguazu Falls
    Combined…` → OD010C y OD010D, y `Iguazu Glamping (4 days)` → OD011.
- **Cómo escriben el producto las agencias** (mails de ejemplo en `Insumos/Mails`):
  - **Kilroy, formato "Tour code":** `HI_ARGENTINA_OD010D-677`, `HI_ARGENTINA_ARCH31-677`,
    `HI_TRAVEL_5C01-677`. A veces el código del medio **no es el nuestro**:
    `HI_ARGENTINA_OVERLAND_7DAYS-677` es CHB31 (lo confirmó el owner al nombrar el archivo),
    `HI_ARGENTINA_W_TREK_ARCH_33-677` es ARCH33 y `HI_TRAVEL_ARCH_EXP-677` es el ARCH33 Express,
    que no está cargado.
  - **Kilroy, formato "Hotel name"** (Aarhus): no trae código, solo `HI - Rio de Janeiro Starter
    Package (Cabanacopa Hostel)` (es OD032).
  - **TourRadar (PDF):** no trae código, solo el nombre del tour: `Overland San Pedro de Atacama to
    Uyuni end in La Paz (7 Days)`, `Patagonia Adventure Tour 16 Days`, `Buenos Aires to Rio de
    Janeiro 12 Days`, `Iguazu Falls on a Shoestring (3N)`.
- **El catálogo ya sabe qué traslados se piden** en cada paquete y en cada tour (M1-08: sentido del
  traslado, servicios "a pedido" y ajustes dentro del tour) y la secuencia de cada tour, con día de
  inicio y buses.
- **El techo de gasto de IA** ya existe (`src/lib/ia/techo-gasto.ts`, tabla `uso_ia`).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Paso 1 — código exacto.** Busca el código del mail en `codigo_externo` de **esa agencia**. Para Kilroy, primero se le saca el envoltorio fijo (`HI_ARGENTINA_` o `HI_TRAVEL_` adelante y `-677` atrás) y lo que queda tiene que ser **igual** a un código cargado. Sin "parecidos", sin "contiene" | Test con códigos reales: `HI_ARGENTINA_OD010D-677` → OD010D; `HI_ARGENTINA_ARCH31-677` → ARCH31; `HI_TRAVEL_5C01-677` → 5C01. **No debe pasar:** `HI_ARGENTINA_W_TREK_ARCH_33-677` no se acepta como ARCH33 por parecido (`ARCH_33` ≠ `ARCH33`); `HI_TRAVEL_ARCH_EXP-677` nunca se empareja con ARCH33 ni con ARCH31 |
| 2 | **Los códigos Kilroy que no siguen la regla** se declaran en `data/codigos-kilroy.csv` (código Kilroy completo, nuestro código, nombre Kilroy, nota) y se cargan a `codigo_externo` con agencia Kilroy. Arranca con lo que ya sabemos por los mails: `HI_ARGENTINA_OVERLAND_7DAYS-677` → CHB31 y `HI_ARGENTINA_W_TREK_ARCH_33-677` → ARCH33. Si una fila apunta a un código que no existe, la carga falla y no escribe nada | Test: con el archivo cargado, el mail Kilroy de CHB31 (DK1547743) y el TOUR 1 del de ARCH33 (DK1576932) se emparejan en el paso 1. Test: una fila con `ARCH33EXP` (no cargado) hace fallar la carga con un mensaje claro |
| 3 | **Paso 2 — nombre de la agencia.** Si no hubo código, compara el nombre del mail con el nombre guardado de **esa agencia** en `codigo_externo`. Igual después de ignorar mayúsculas, espacios dobles y acentos; nada más | Test: el PDF TourRadar `Iguazu Falls on a Shoestring (3N)` → OD010A. **No debe pasar:** `Iguazu Falls on a Shoestring Brazil (4 days)` no cae en OD010A (es OD010B), y un nombre de TourRadar no se compara contra nombres de Kilroy |
| 4 | **Paso 3 — propuesta de la IA.** Solo si los pasos 1 y 2 no alcanzaron **y el mail no trae código**. La IA recibe la lista cerrada de productos cargados (código, nombre, ciudades, noches) y lo que dijo el mail, y contesta un código de la lista o "ninguno", con su confianza. Se acepta solo si la confianza llega al umbral (arranca alto: 0,9) y, en un tour, si las noches del tour coinciden con las fechas del mail (cuando el mail trae inicio y fin) | Test con la IA simulada: el PDF TourRadar del Overland (`…end in La Paz (7 Days)`, 11 Oct 2026) con CHB31 y confianza 0,95 → CHB31, origen "IA". **No debe pasar:** la misma propuesta con confianza 0,7 queda "para revisión" con la sugerencia a la vista, no aceptada; una respuesta con un código que no está en la lista se descarta; una propuesta de AR09 (15 noches) para un mail de 9 noches no se acepta |
| 5 | **Código desconocido = no cargado.** Si el mail trae un código de la agencia que no está en la tabla, no se llama a la IA: queda "para revisión" con el motivo "el producto no está en el catálogo" | Test: `HI_TRAVEL_ARCH_EXP-677` y `HI_ARGENTINA_OD014-677` → "para revisión", motivo "El producto HI_TRAVEL_ARCH_EXP-677 (Patagonia, Trekking Paradise with W-Trek EXPRESS) no está en el catálogo", y sin gasto de IA |
| 6 | **IA: "ninguno" también es respuesta.** Si la IA dice con confianza que no está en la lista, el motivo es "no está en el catálogo"; si dice algo con poca confianza, el motivo es "no se pudo reconocer con seguridad" | Test con la IA simulada: `Buenos Aires to Rio de Janeiro 12 Days` → "ninguno" → "para revisión", motivo "no está en el catálogo". **No debe pasar:** que quede como BRARCH26 (Rio de Janeiro to Santiago) |
| 7 | **La IA bajo el techo de gasto (#3).** El paso 3 pasa por `llamarConTecho`. Si el techo está agotado o la IA no responde, la reserva queda "para revisión" con ese motivo; nunca se cae ni se pierde | Test: techo agotado → no hay llamada, motivo "No se usó la IA: se llegó al techo de gasto del mes". Error de la API → motivo "La IA no respondió" |
| 8 | **Un mail con varios productos** deja una reserva por producto, con el mismo booking_id, cada una con su estado | Test: el Kilroy DK1576932 deja dos reservas: ARCH33 y CHB31 |
| 9 | **Tour compuesto: sus partes en `reserva_componente`**, en orden y con fecha real (fecha de inicio + día del tour). Cada paquete queda como pedido a proveedores; cada bus que emite HI Travel (Kupos, Plataforma10) queda como **tarea "emitir boleto"**, sin proveedor; el bus que reserva un proveedor (Uyuni – La Paz con Imperio Inca) va como parte del servicio. Un tour dentro de otro (CHB31 en 5C01) se abre en sus partes | Integración contra el catálogo real, uno por tour: CHB31, BOCHI04R, ARCH31, ARCH33, AR09, BRARCH26 y 5C01. Ej.: CHB31 desde el 13 Sep 2026 → OD030 el 13/9, COMPBO20 el 16/9, bus Uyuni – La Paz el 18/9 con Imperio Inca. 5C01 → 10 paquetes (CHB31 abierto en OD030 y COMPBO20). **No debe pasar:** un bus de Kupos o Plataforma10 como pedido a un proveedor |
| 10 | **Final de ARCH31 y ARCH33 (`DECISIONS.md` 2026-10-06).** Si el vuelo de salida es desde Puerto Natales (PNT), o el mail lo dice, el último paso es el **transfer al aeropuerto PNT** (Patagonia Planet) en vez del bus Kupos. Si no, queda el bus como tarea | Test: el TOUR 1 de DK1576932 ("clients flight after tour ends are from Puerto Natales") queda con el transfer a PNT. Un ARCH31 sin esa mención, con el bus Kupos como tarea |
| 11 | **Traslado sin vuelo → "para revisión".** Se miran los traslados que se van a pedir en esa reserva (en un tour, después de los ajustes de M1-08). Una llegada pide el vuelo de llegada y una salida pide el de salida (número y horario). Los "a pedido" cuentan solo si el mail los pide | Test: Kilroy CHB31 DK1547743 (traslado de llegada a Calama, sin vuelo) → motivo "Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030". DK1576932 TOUR 1 → faltan el de llegada a El Calafate y el de salida de Puerto Natales. **No debe pasar:** pedir vuelo para el traslado de llegada de OD016 dentro de ARCH31 (se llega en bus) |
| 12 | **OD019 vendido solo:** su traslado depende de la variante (CON o SIN traslados). Si el mail no lo deja claro, "para revisión" con el motivo "Elegir la variante de OD019" | Test con los datos simulados de un mail sin la variante |
| 13 | **Datos dudosos de M2-02.** Si la ficha marca como dudoso un dato clave (producto, fechas, pasajeros, vuelos), se suma el motivo "La IA no está segura de: fechas" (o el que sea). Solo se procesan las fichas de tipo "reserva nueva"; las demás quedan "para revisión" con el motivo "El mail es una cancelación / un cambio" | Test: ficha con fechas en 0,5 → "para revisión" con ese motivo, aunque el producto sea seguro. El PDF `vendorcredit` de Iguazú (cancelación) → "para revisión", nunca "recibida" |
| 14 | **Estado final.** Con producto reconocido y sin ningún motivo, la reserva queda **"recibida"**. Si hay uno o más motivos, queda **"para revisión"** con todos, en castellano llano. Se guarda cómo se reconoció (código, nombre o IA, y la confianza). El historial anota la entrada "creada" (M2-01) con autor "el sistema" | Test: el Kilroy de OD010D con vuelos completos → "recibida", origen "código". El PDF del Overland → producto CHB31 por IA, pero "para revisión" porque falta el vuelo. El historial tiene una entrada "creada" por reserva |
| 15 | **Sumar una agencia no cambia el núcleo.** Cada agencia declara cómo se lee su código (Kilroy: envoltorio; TourRadar: sin código) y sus filas de `codigo_externo`. Los tres pasos y los motivos son los mismos para todas | Test: una agencia de prueba con su propia regla se empareja sin tocar el código de los tres pasos. Journaway entra así en M2-09 |
| 16 | **No escribe en el catálogo** (`DECISIONS.md` 2026-10-06): lo que aprende la IA no se guarda como código nuevo | Test: después de emparejar por IA, `codigo_externo` no cambió |

## 4. Qué queda afuera
- **La pantalla:** es M2-05. Acá no hay interfaz.
- **No duplicar el mismo intercambio** (mismo booking_id y producto): es M2-04. Esta pieza crea la
  reserva sin buscar si ya existía.
- **Journaway:** M2-08 y M2-09.
- **Elegir el nivel de alojamiento** ("Double Room - Hostel", "Dormitory") ni armar los pedidos a
  proveedores: es M3. El dato queda como lo leyó M2-02.
- **Qué hacer con una cancelación o un cambio** sobre una reserva que ya existe: acá solo quedan
  "para revisión" (fila 13). Asociarlas a la reserva original es M2-04.
- **Ajustar el umbral de confianza:** se mide en el modo prueba (M2-06).
- Cargar los productos que faltan (ARCH33EXP, OD014, el Buenos Aires to Rio…).

## 5. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — si hacen falta columnas en `reserva` o `reserva_componente`, van en una migración nueva
  con RLS. El historial guarda el autor ("sistema").
- **#3** — el paso 3 llama a la IA solo a través del techo de gasto, con tope por mail. Los pasos 1
  y 2 son gratis y van primero.
- **#4** — no manda nada ni toca la casilla.

## Preguntas abiertas para el owner (no bloquean)
- ¿`HI_ARGENTINA_OVERLAND_7DAYS-677` es siempre CHB31? ¿Kilroy vende BOCHI04R (desde La Paz) con
  otro código?
- `Argentina and Uruguay, heart of the River Plate (7 days)` (TourRadar), ¿es OD020 (Buenos Aires +
  Uruguay)? Mientras no se confirme, lo decide la IA con el umbral alto.
- Una **cancelación** (el PDF `vendorcredit` de Iguazú), ¿alcanza con dejarla "para revisión", o
  hace falta un estado propio en M4?
- ¿Conviene cargar los nombres Kilroy y TourRadar del resto de los productos ya cargados? Ahorra IA
  y sube la precisión.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. Tests unitarios + linter + tipos, con los datos de M2-02 de los mails reales como fixtures
     (JSON) y la IA simulada.
  2. Integración contra el Supabase real: carga de `data/codigos-kilroy.csv`, emparejado contra el
     catálogo cargado, `reserva_componente` de los 7 tours (fila 9) y reservas de prueba que se
     limpian al terminar.
  3. Recorrido: un script (`npm run probar:emparejado`) que pasa por M2-02 y M2-03, con IA real y
     bajo el techo, estos mails de `Insumos/Mails`: Kilroy CHB31, Kilroy ARCH33 (dos tours), Kilroy
     OD010D, Kilroy OD032 (Aarhus), Kilroy Patagonia Trekking Paradise Express y los PDF TourRadar
     del Overland, de Patagonia Adventure y de Buenos Aires to Rio. Imprime, por reserva, el
     producto, el origen, el estado y los motivos. Las reservas quedan marcadas "de prueba". Más
     `npm run build`.
- **Test primero:** el test se escribe antes y se lo ve fallar por la razón correcta.
- **Dónde va cada cosa (orientativo):**
  - Núcleo: `src/lib/reservas/emparejar/` (`emparejar.ts` con los 3 pasos; `motivos.ts` con los
    textos; `propuesta-ia.ts` con salida estructurada y lista cerrada, vía `src/lib/ia/techo-gasto.ts`).
  - Lectura del código por agencia: `src/lib/reservas/emparejar/agencias.ts` (un lector por agencia,
    registrado por nombre). Kilroy: `^HI_(ARGENTINA|TRAVEL)_(.+)-677$` → `$2`, más el código completo
    tal cual, para que matcheen las filas de `data/codigos-kilroy.csv`.
  - Carga de `data/codigos-kilroy.csv`: reusar `guardarCodigoExterno` del importador
    (`src/lib/importador-productos/importar.ts`); script `npm run importar:codigos-kilroy`.
  - Vuelos que hacen falta: `src/lib/reservas/emparejar/vuelos-requeridos.ts`, a partir de
    `producto_servicio.sentido`/`a_pedido` y de `tour_servicio_ajuste`, con la misma lectura del
    tour que usa la pantalla (`src/lib/catalogo/consultas.ts`, `reglas.ts`). No duplicar la regla
    de M1-08.
  - Partes del tour: `src/lib/reservas/emparejar/componentes.ts` → `reserva_componente`. Los buses
    "manual" de `data/equivalencias-proveedores.csv` (Kupos y similares) son tarea.
  - Umbral: una constante (`UMBRAL_CONFIANZA_PRODUCTO = 0.9`), documentada en
    `docs/arquitectura/integraciones-ia.md`.
  - Documentar el emparejado en `docs/arquitectura/modelo-de-datos.md` (anexo "Emparejado de
    producto").
- **Migraciones:** M2-01 ya deja `reserva.motivos_revision` (con el `check` de "para revisión" ⇔
  motivos), `producto_texto_agencia`, `datos_extraidos` y `reserva_componente` (`tipo`,
  `producto_id`, `producto_componente_id`, `descripcion_ruta`, fechas). Lo que falte
  (`reserva.origen_emparejado` `codigo|nombre|ia`, `confianza_emparejado`, `sugerencia_producto_id`,
  `reserva_componente.es_tarea`, la variante del final de ARCH31/ARCH33) va en una migración nueva
  con RLS.
- `next dev` agrega un bloque a `CLAUDE.md`: **no commitearlo**.
