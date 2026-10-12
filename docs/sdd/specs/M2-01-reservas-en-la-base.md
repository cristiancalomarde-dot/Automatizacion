# M2-01 · Reservas en la base

**Depende de:** nada

## 1. Qué queremos lograr
Que la app tenga dónde guardar una reserva que entra por mail. Se guarda el mail tal cual llegó,
la reserva con su estado inicial ("recibida", o "para revisión" con el motivo) y un historial que
nunca se borra ni se edita. Además, la app sabe qué remitentes son de Kilroy, TourRadar y
Journaway. Es la base sobre la que las piezas siguientes leen el mail con IA (M2-02), reconocen
el producto (M2-03) y lo muestran (M2-05). Esta pieza no lee mails ni tiene pantalla.

## 2. Qué hay hoy
- La base tiene el catálogo de M1 (`producto`, `producto_servicio`, `codigo_externo`,
  `producto_componente`, `tour_servicio_ajuste`…), el gasto de IA (`uso_ia`) y los usuarios
  (`usuario`). Migraciones `0001` a `0009` en `supabase/migrations/`.
- `codigo_externo.agencia` ya usa los nombres "Kilroy", "TourRadar" y "HI Travel" (constantes en
  `src/lib/importador-productos/importar.ts:40-43`). Journaway todavía no tiene códigos (lo carga
  M2-08).
- `docs/arquitectura/modelo-de-datos.md` describe `reserva` y `evento_reserva` (estados,
  historial append-only, duplicados por booking_id + producto). No describe todavía el mail
  guardado ni los componentes de una reserva.
- Ejemplos de mails en `Insumos/Mails`: 9 de Kilroy (.docx), 4 de Journaway (.docx) y 6 PDF de
  TourRadar. De ahí salen los remitentes de la fila 8.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Guarda el mail original:** remitente (dirección y nombre), destinatarios, asunto, fecha, carpeta de donde salió (Inbox o Spam, o "archivo" si viene de `Insumos/` en el modo prueba), el identificador del mensaje (Message-ID y, si vino por IMAP, su número en la casilla), el cuerpo y los adjuntos. De los PDF se guarda el archivo (es lo que la IA lee en M2-02). De los demás adjuntos (imágenes, firmas) solo el nombre, el tipo y el tamaño | Integración: se guarda un mail de Kilroy con su cuerpo y uno de TourRadar con su PDF. Al leerlos de vuelta están todos los datos, y el PDF se puede descargar idéntico (mismo tamaño y contenido) |
| 2 | **No guarda dos veces el mismo mail.** Cada mail tiene una huella: su Message-ID, o, si no tiene, una huella armada con el remitente, la fecha, el asunto y el cuerpo. Si se intenta guardar un mail con una huella que ya existe, la app devuelve el que ya estaba y no crea otro. Así M2-07 sabe qué ya procesó sin marcar nada en la casilla | Integración: guardar dos veces el mismo mail deja **una sola** fila y la segunda llamada devuelve la misma. El mismo Message-ID visto en Inbox y en Spam también queda una sola vez. Dos mails distintos sin Message-ID quedan como dos filas |
| 3 | **Guarda una reserva con su estado inicial**, que solo puede ser `recibida` o `para_revision`. Lleva la agencia, el mail que la originó, el booking_id de la agencia (puede faltar), el producto (puede faltar), lo que la agencia dijo del producto, las fechas, la cantidad de pasajeros, los pasajeros, los vuelos, la habitación, los pedidos especiales y lo que extrajo la IA con su confianza | Integración: se crea una reserva `recibida` con todos los datos y se lee igual. **No debe pasar:** crear una reserva directo en `confirmada` o en `pedido_a_proveedor`: la base la rechaza |
| 4 | **"Para revisión" siempre tiene motivo.** Una reserva en `para_revision` lleva uno o más motivos escritos como los ve el operativo (por ejemplo, "El producto no está en el catálogo."). Una en `recibida` no lleva motivos | Integración. **No debe pasar:** guardar una reserva `para_revision` sin motivos. La base la rechaza. Se acepta con dos motivos y se leen los dos |
| 5 | **Marca "de prueba".** La reserva y el mail llevan una marca "de prueba" (por defecto, no). Las reservas del modo prueba (M2-06) se distinguen de las reales y se pueden borrar enteras con un comando: la reserva, sus componentes, su historial y su mail. Las reales no se pueden borrar | Integración: se crean una reserva de prueba y una real. El borrado de prueba elimina la de prueba con todo lo suyo y **no toca** la real. **No debe pasar:** que el borrado de prueba elimine una reserva sin la marca |
| 6 | **Componentes de la reserva.** Si el producto es un tour compuesto, o si Journaway manda una lista de tours sueltos, la reserva tiene sus partes en orden: cada una es un paquete del catálogo (si se reconoció) o un tramo de bus, con sus fechas y el texto tal como lo mandó la agencia | Integración: una reserva de 5C01 con 3 componentes en orden y una de Journaway con un tour suelto sin producto reconocido (solo el texto y la fecha). Se leen en el orden guardado |
| 7 | **Historial que no se toca.** Cada reserva tiene su historial con cada hecho: creada (con el estado y los motivos iniciales), cambio de estado, mail nuevo del mismo intercambio, marca de posible duplicada. Cada entrada lleva fecha y autor (una persona del equipo o "el sistema"). Al crear la reserva se agrega sola la entrada "creada", y al cambiar el estado, la entrada del cambio | Integración: al crear una reserva aparece una entrada "creada"; al pasarla de `para_revision` a `recibida` aparece el cambio con el estado anterior y el nuevo. **No debe pasar:** editar o borrar una entrada del historial de una reserva real. La base lo rechaza, incluso desde el servidor |
| 8 | **Remitentes conocidos de cada agencia en `data/agencias.csv`.** Cada fila es una dirección exacta o un dominio, con su agencia y si está confirmado. Filas iniciales: **Kilroy** con los dominios `kilroy.dk` (aarhus@, copenhagen@, y personas como emhe@ "en nombre de KILROY Copenhagen"), `kilroy.no` (oslo@) y `kilroy.co.uk` (travels@), confirmados por los ejemplos. **Journaway** con `operations@journaway.com` y `de@journaway.com`, confirmados. **TourRadar** con el dominio `tourradar.com`, **a confirmar** (ver preguntas abiertas). Jysk no lleva fila hasta saber su dirección | Unitario: el archivo real se lee sin errores. Ninguna dirección o dominio aparece dos veces ni en dos agencias. Ninguna fila es de `hitravel.com.ar` |
| 9 | **Reconocer la agencia de un remitente.** Dada la dirección del remitente, la app devuelve la agencia o "desconocida". Primero busca la dirección exacta y después el dominio, sin importar mayúsculas | Unitario: `aarhus@kilroy.dk`, `Copenhagen@Kilroy.DK`, `oslo@kilroy.no` y `travels@kilroy.co.uk` → Kilroy; `de@journaway.com` → Journaway. **No debe pasar:** que `info@journaway.com` (no está en la lista), `alguien@kilroy.dk.ejemplo.com`, `x@notkilroy.dk`, `sales@hitravel.com.ar` o un mail con "journaway" solo en el nombre visible devuelvan una agencia |
| 10 | **Solo el equipo ve las reservas.** Las cuatro tablas y los PDF guardados se leen solo con sesión del equipo | Integración: un usuario del equipo lee la reserva y su mail. **No debe pasar:** que alguien sin sesión lea una reserva, un mail, un historial o un PDF |
| 11 | **Registro de cada llamada a la IA** (revisión de IA, owner 2026-10-12). Tabla `ia_llamada`: fecha, tarea, modelo, versión de las instrucciones, tokens de entrada y de salida, costo, resultado (`ok`, `cortada`, `invalida`, `error`, `sin_presupuesto`), y el mail y la reserva asociados (pueden faltar). **No tiene columna para el contenido del mail.** Lleva la marca "de prueba" y el borrado de prueba la limpia. La llena M2-02 | Integración: se guarda una llamada y se lee igual; el borrado de prueba la elimina. **No debe pasar:** que alguien sin sesión la lea, ni guardar un resultado fuera de la lista |

## 5. Qué queda afuera
- **Leer la casilla `sales@`:** es M2-07. Lo que llega de remitentes que no son de una agencia no
  se guarda. Ese filtro lo aplica M2-07 con la función de la fila 9.
- **Leer el mail con IA y reconocer el producto:** M2-02 y M2-03. Esta pieza solo guarda lo que
  le pasan.
- **Unir un mail a una reserva existente y marcar posibles duplicadas:** la lógica es M2-04. Acá
  solo están los lugares donde se guarda.
- **El estado de cada componente** (pedido, confirmado, bus emitido): lo agrega M3.
- **Separar los hoteles que reserva Journaway ("booked by us"):** M2-09. Si necesita un dato
  nuevo, lo agrega en su propia migración.
- **Pantallas:** la lista y el detalle son M2-05.
- **Quién de la agencia originó la reserva** (sucursal o vendedor, para el "recibido"): sigue
  pendiente de decidir (`PROGRESS.md`). El remitente queda guardado en el mail, así que no se
  pierde.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — las cuatro tablas tienen RLS activa con la policy del equipo, y cada entrada del
  historial guarda su autor.
- **#4** — esta pieza no manda nada ni toca la casilla: solo guarda.

## Preguntas abiertas (no bloquean la pieza)
1. **¿Desde qué dirección llegan los mails de TourRadar?** Los ejemplos son solo los PDF. Adentro
   dicen "Contact: finance@tourradar.com", pero eso no confirma quién manda el mail. Mientras
   tanto se usa el dominio `tourradar.com`, marcado "a confirmar". Se confirma con el primer
   `.eml` real (modo prueba o M2-07).
2. **Jysk: ¿cuál es su dirección o dominio?** No hay ningún ejemplo. Según la decisión del
   2026-10-02, Jysk casi no reserva productos de catálogo. Sin fila, un mail de Jysk no se
   reconoce y M2-07 no lo levanta. Si el owner pasa la dirección, se suma una fila; M2-03 decide
   si va directo a "para revisión".
3. **¿Kilroy escribe desde otros países?** En los ejemplos hay `kilroy.dk`, `kilroy.no` y
   `kilroy.co.uk`. Si existen `kilroy.se`, `kilroy.fi`, `kilroy.nl` u otros, hay que sumarlos;
   si no, esas reservas no se levantan.
4. **Journaway mientras reenvía desde operaciones3@:** si el reenvío de Ferozo cambia el
   remitente por `operaciones3@hitravel.com.ar`, el mail no se reconoce como de Journaway. Se
   comprueba con un mail de prueba antes de M2-07.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. Unitarios (`agencias.ts`, lectura del CSV, huella del mail) + `npm run lint` + tipos.
  2. Integración contra el **Supabase real compartido**, con la migración aplicada: filas 1-7 y
     10, incluidas las pruebas de lo que no debe pasar. El acceso sin sesión usa el cliente
     anónimo y el del equipo, el usuario de prueba (`tests/helpers/usuario-de-prueba.ts`). Todo lo
     que crean los tests lleva `de_prueba = true` y un asunto con el prefijo `[test M2-01]`, y se
     limpia al final con el borrado de prueba. No se deja basura en la base compartida.
  3. Recorrido de punta a punta (`tests/recorrido-m2-01.integration.test.ts`): se toma el texto
     real del mail de Kilroy OD010D (`Insumos/Mails/Reserva de Cliente Kilroy Aarhus -Iguazu
     Falls Combined  OD010D.docx`) y un PDF de TourRadar. Se reconoce la agencia por el
     remitente, se guarda el mail, se crea una reserva de prueba `para_revision` con un motivo,
     se cambia a `recibida`, se lee el historial (2 entradas), se vuelve a guardar el mismo mail
     (no duplica) y se borra todo lo de prueba. Además, `npm run build`.
- **Test primero:** se escribe cada test y se lo ve fallar por la razón correcta antes de
  implementar.
- **Migración nueva** `supabase/migrations/0010_reservas.sql`. Se aplica con `supabase db push`
  por el pooler, igual que 0003-0009. Nada se crea a mano desde el panel. Orientativo:
  - `create type public.estado_reserva as enum ('recibida', 'para_revision',
    'pedido_a_proveedor', 'confirmada', 'con_cambios', 'rechazada', 'cerrada', 'descartada')`,
    la lista de `modelo-de-datos.md`.
  - **`mail_recibido`:** `origen` (`imap` | `archivo`), `carpeta` (`inbox` | `spam`, null si es
    archivo), `archivo_origen`, `imap_uidvalidity`, `imap_uid`, `message_id`, `huella` (unique,
    not null), `remitente` (dirección en minúscula), `remitente_nombre`, `destinatarios text[]`,
    `asunto`, `fecha_mail timestamptz`, `cuerpo_texto`, `cuerpo_html`, `adjuntos jsonb` (nombre,
    tipo, tamaño y ruta en Storage si se guardó), `agencia` (null si no se reconoció),
    `de_prueba`, `procesado_en`, `error_proceso`.
  - **`reserva`:** `agencia`, `mail_recibido_id` (no unique: un mail de Kilroy puede traer 3
    reservas, ver "Kilroy Copenagiue varias"), `booking_id`, `producto_id` (null),
    `producto_texto_agencia`, `fecha_inicio`/`fecha_fin date`, `pax`, `pasajeros jsonb`,
    `vuelos jsonb`, `habitacion`, `pedidos_especiales`, `estado`, `motivos_revision text[]`,
    `posible_duplicada`, `duplicada_de_id`, `de_prueba`, `datos_extraidos jsonb` (salida de la IA
    con confianza por campo, la llena M2-02). Índice por `(agencia, booking_id)` para M2-04.
    `check`: `para_revision` ⇔ `cardinality(motivos_revision) > 0`. Trigger `before insert` que
    solo deja `recibida` o `para_revision`.
  - **`reserva_componente`:** `reserva_id`, `orden` (unique por reserva), `tipo`
    (`tipo_componente_producto` de 0002), `producto_id` (null), `producto_componente_id` (null),
    `descripcion_ruta`, `texto_agencia`, `fecha_inicio`/`fecha_fin`.
  - **`evento_reserva`:** `reserva_id`, `tipo` (`creada` | `estado_cambiado` | `mail_agregado` |
    `posible_duplicada`; M4 suma los suyos con otra migración), `estado_anterior`,
    `estado_nuevo`, `mail_recibido_id`, `detalle jsonb`, `autor_id` (→ `usuario`; null = el
    sistema; se toma de `auth.uid()`), `created_at`. Triggers en `reserva`: `after insert` →
    `creada` y `after update of estado` → `estado_cambiado`. Trigger `before update or delete`
    en `evento_reserva` que lanza un error, salvo dentro del borrado de prueba y solo para
    reservas `de_prueba`.
  - **`ia_llamada`** (fila 11): `id`, `created_at`, `tarea text`, `modelo text`,
    `version_instrucciones text`, `tokens_in int`, `tokens_out int`, `costo_usd numeric`,
    `resultado` (check en la lista de la fila 11), `mail_recibido_id` (null), `reserva_id` (null),
    `de_prueba`. Solo select/insert para `authenticated`; escribe el servidor (service role).
    `borrar_datos_de_prueba()` también la limpia. Ver `docs/arquitectura/integraciones-ia.md`.
  - **RLS** en las cinco tablas, con el criterio de 0002: `authenticated` select/insert/update y
    sin delete. `evento_reserva` solo select/insert.
  - **Borrado de prueba:** función `public.borrar_datos_de_prueba()`, solo para `service_role`
    (revoke a public/anon/authenticated, como `sumar_uso_ia` en 0003). Borra componentes,
    eventos, reservas y mails con `de_prueba`, y devuelve las rutas de Storage que hay que
    borrar.
  - **PDF adjuntos:** bucket privado de Supabase Storage `mail-adjuntos`, creado en la migración,
    con ruta `<mail_recibido_id>/<nombre>`. Lectura para `authenticated`; escritura solo desde el
    servidor (service role). Los demás adjuntos no se suben.
- **Código** (solo servidor, `import "server-only"`, cliente `src/lib/supabase/admin.ts`):
  - `src/lib/reservas/agencias.ts` (+ `.test.ts`): lee `data/agencias.csv` y expone
    `agenciaDelRemitente(direccion)`. Reusar el parser de `src/lib/importador-productos/csv.ts`.
  - `src/lib/reservas/huella.ts` (+ test): Message-ID normalizado (sin `<>`, minúscula) o
    `sha256:` del remitente, la fecha, el asunto y el cuerpo.
  - `src/lib/reservas/guardar.ts`: `guardarMailRecibido` (idempotente por huella, sube los PDF),
    `crearReserva` (con componentes), `cambiarEstado`, `agregarEvento` y `borrarDatosDePrueba`
    (llama a la función y borra los objetos de Storage).
  - `src/lib/reservas/tipos.ts`.
- **`data/agencias.csv`:** columnas `agencia,tipo,valor,estado,nota`, con `tipo` = `direccion` |
  `dominio` y `estado` = `confirmado` | `a_confirmar`. Los nombres de agencia son los de
  `codigo_externo.agencia`: "Kilroy", "TourRadar", "Journaway". En la nota va de qué ejemplo
  salió cada fila. Para M2-07: el CSV tiene que viajar con la función de Vercel (incluirlo en el
  bundle o leerlo en build). Lo resuelve esa pieza; acá basta con que la lectura sea una función
  pura sobre el texto del archivo.
- **Privacidad (`secretos.md`):** ningún `console.log` imprime el cuerpo del mail ni los datos de
  los pasajeros.
- **Documentar** `mail_recibido`, `reserva_componente`, el bucket y el borrado de prueba en
  `docs/arquitectura/modelo-de-datos.md`.
- **Build:** no correr `npm run build` sobre el `.next` del clon si hay un `next dev` en :3000.
  Hacerlo en un `git worktree` aparte con su `npm ci` y borrarlo al terminar.
- No commitear `CLAUDE.md`. Nunca `git commit -a`. Sin push. No tocar la tabla del plan ni
  `PROGRESS.md`. Usar timeouts en los comandos largos.
