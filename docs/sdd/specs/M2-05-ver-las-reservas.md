# M2-05 · Ver las reservas que entraron

**Depende de:** M2-03 (necesita reservas con su producto reconocido o en "para revisión" con su
motivo). Si M2-04 ya está construida, también muestra lo que ella agrega: varios mails en una
misma reserva y la marca "posible duplicada".

## 1. Qué queremos lograr
Que cualquiera del equipo entre a la app y vea las reservas que llegaron por mail: de qué agencia
son, qué producto se reconoció, fechas, pasajeros y vuelos, y si quedaron "recibidas" o "para
revisión" y por qué. Al lado de cada reserva tiene el mail tal como llegó, para comparar con sus
propios ojos. Es **solo para mirar**: no se edita ni se cambia nada. Es la base de la bandeja de
M4, que después le suma filtros, tablero, edición y cambio de estado.

## 2. Qué hay hoy
- La app tiene login con Google y una barra lateral con **Catálogo**, **Proveedores** y
  **Pendientes**. El inicio (`/`) lleva al Catálogo "hasta que exista la Bandeja de reservas".
- M1-06 y M1-10 dejaron armados los ladrillos que se reusan acá: tablas ordenables, chips de
  estado con la etiqueta escrita, avisos, esqueletos de carga, mensajes de error con "Reintentar"
  y vacíos (`src/components/ui/`), y los textos centralizados en `src/lib/textos/index.ts`.
- M2-01 a M2-03 dejan las reservas en la base: la reserva con su agencia, número de la agencia,
  producto (o ninguno), fechas, pasajeros, vuelos, pedidos especiales, estado y motivos de
  revisión; los componentes si es un tour; y el mail recibido (cuerpo y, si vino, el PDF). Todavía
  no hay ninguna pantalla que los muestre.
- La lección de la auditoría de M1 (M1-10): en pantalla no aparecen notas internas, rutas de
  archivos, códigos técnicos ni jerga ("Owner", "M2"). Todo se dice en voz de la app.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **"Reservas" pasa a ser la pantalla de inicio** y la primera opción de la barra lateral (Reservas · Catálogo · Proveedores · Pendientes). Entrar a la app, o a `/`, lleva a la lista de reservas. Ver la justificación en §4 | Test de la barra: "Reservas" es el primer enlace y queda marcado como activo en `/reservas` y en `/reservas/<id>`. Test de `/`: redirige a `/reservas`. Recorrido: después de "Ingresar con Google" se cae en la lista de reservas |
| 2 | **Lista de reservas:** una fila por reserva, la que llegó más recientemente arriba. Columnas: estado (chip) · agencia · número de la agencia (ej. `DK1531608`) · producto (código + nombre, o "Sin producto reconocido") · fechas del viaje (`12/03/2026 → 15/03/2026`) · pax · llegó (fecha y hora del primer mail). Cada columna se puede ordenar y la fila entera abre el detalle | Test de pantalla con datos de prueba: aparecen las 7 columnas pobladas, el orden inicial es por llegada descendente y tocar una fila navega a `/reservas/<id>`. Las fechas salen en DD/MM/AAAA y los pax como número entero |
| 3 | Una reserva **"para revisión"** se distingue en la lista por más que el color: franja a la izquierda + ícono de triángulo + la etiqueta escrita "para revisión". Si tiene la marca "posible duplicada", lleva además ese chip | Test de pantalla: la fila de una reserva en revisión tiene el chip con el texto "para revisión" y el indicador de la fila; una reserva "recibida" no lo tiene |
| 4 | **Reservas de prueba, imposibles de confundir con las reales.** En la lista llevan el chip "De prueba" y la fila atenuada. En el detalle, arriba de todo, un aviso: "Reserva de prueba. Se cargó para revisar cómo se leen los mails. No es una reserva real." Arriba de la lista, el total separa las dos: "12 reservas · 4 de prueba" | Test de pantalla: una reserva marcada de prueba muestra el chip y el aviso; una real no muestra ninguno de los dos. **No debe pasar:** que una reserva de prueba aparezca en la lista o en el detalle sin su marca (test que recorre todas las filas de prueba del fixture) |
| 5 | **Detalle, encabezado:** estado (chip grande) + marcas · agencia · número de la agencia · fecha y hora en que llegó. Un enlace "Volver a las reservas" | Test de pantalla: el encabezado de una reserva de Kilroy muestra esos datos y el enlace lleva a `/reservas` |
| 6 | **Motivo de la revisión, en voz de la app.** Si la reserva está "para revisión", debajo del encabezado va un aviso ámbar con cada motivo en una frase (ver la tabla de motivos abajo). Si la marca es "posible duplicada", el aviso enlaza a la otra reserva ("Ver la reserva parecida") | Test de pantalla: cada motivo muestra su frase exacta. **No debe pasar:** que se vea el código interno del motivo (`falta_vuelo`, etc.), "Owner", "M2", "M3", "data/", "IA", un número de confianza ni una ruta. Test: el texto visible del detalle no contiene ninguno de esos. Un motivo sin texto definido muestra "Esta reserva necesita que alguien la revise." y un test unitario falla si algún motivo posible no tiene su frase |
| 7 | **Detalle, el producto:** código y nombre del catálogo como **enlace a su ficha** (`/catalogo/<id>`). Si no se reconoció, "Sin producto reconocido" y, si la agencia nombró algo, lo que dijo el mail: "En el mail: «Iguazu Falls on a Shoestring (3N)»" | Test de pantalla: el enlace apunta a `/catalogo/<id del producto>`. Una reserva sin producto muestra el texto y lo que dijo el mail, sin enlace |
| 8 | **Detalle, los componentes de un tour:** si el producto es un tour compuesto, sus componentes en orden. Cada paquete con su código, nombre y enlace a su ficha (y su fecha si la reserva la tiene); cada tramo de bus con su ruta y la etiqueta "Tramo externo pendiente de emitir" (el mismo texto que ya usa el catálogo) | Test de pantalla con una reserva de un tour (ej. CHB31): se ven los componentes en el orden del tour y cada paquete enlaza a su ficha. Una reserva de un producto simple no muestra la sección |
| 9 | **Detalle, los datos de la reserva:** fechas de entrada y salida · pax · pasajeros (los nombres, si el mail los trae) · habitación / categoría · pedidos especiales. Un dato que falta se muestra como "—", nunca como un hueco ni como "null" | Test de pantalla: con todos los datos, se ven todos; con una reserva que no se pudo leer, cada campo muestra "—" y la pantalla no se rompe |
| 10 | **Detalle, los vuelos:** una fila por vuelo con llegada o salida, número de vuelo, aerolínea, fecha y hora. **La hora se muestra tal como la dice el mail** (es la hora del aeropuerto), no se convierte a la hora del que mira. Sin vuelos: "El mail no trae datos de vuelo." | Test de pantalla: un vuelo "LA8020 · 14:35" se ve "14:35" con el navegador en cualquier zona horaria. Una reserva sin vuelos muestra el texto |
| 11 | **Detalle, el mail original (panel lateral):** remitente, asunto, fecha y hora de llegada y, si llegó a Spam, la nota "Llegó a la carpeta de spam". Debajo, el cuerpo tal cual llegó, en texto seleccionable. Si la reserva vino en un PDF, el botón "Abrir el PDF" lo abre en otra pestaña | Test de pantalla: se ven los datos y el cuerpo completo. Con un PDF, el botón abre el archivo. Integración: el PDF se abre con la sesión del usuario y el enlace caduca a los pocos minutos |
| 12 | **Varios mails en una reserva** (cuando M2-04 suma un mail al mismo intercambio, por ejemplo el que trae los vuelos): el panel los lista por orden de llegada. El primero está abierto y los demás se abren con "Ver mail". El primero dice "Mail que creó la reserva" | Test de pantalla con una reserva de 2 mails: se ven los dos en orden, el primero abierto. Con un solo mail no aparece la lista |
| 13 | **No debe pasar (mail peligroso):** el cuerpo del mail se muestra **como texto**, nunca se interpreta como página. No se cargan imágenes remotas, no corren scripts y los enlaces del mail no se vuelven clicables | Test de pantalla con un cuerpo que trae `<script>`, `<img src="http://…">` y `<a href>`: se ven como texto, no hay ningún `<script>`, `<img>` ni `<a>` creado a partir del mail |
| 14 | **No debe pasar (editar):** en la lista y en el detalle **no hay nada que edite, cambie de estado ni mande algo**: ni campos de texto, ni botones "Editar", "Guardar", "Resolver revisión", "Armar pedidos", "Descartar" o "Reprocesar". Lo único que se toca son enlaces, el orden de las columnas, "Ver mail", "Abrir el PDF" y "Reintentar". Además, el código de estas pantallas no tiene ninguna escritura a la base | Test de pantalla: en el detalle no hay `input`, `textarea` ni `select`, y los únicos botones tienen los textos permitidos. Test unitario (estilo `solo-lectura.test.ts`): `src/lib/reservas/` y `src/components/reservas/` no contienen `.insert(`, `.update(`, `.upsert(` ni `.delete(` |
| 15 | **No debe pasar (sin sesión):** alguien sin sesión no ve reservas. Entrar a `/reservas` o `/reservas/<id>` sin sesión lleva al login con "Tu sesión venció. Volvé a ingresar."; y pedirle las reservas a la base sin sesión no devuelve ninguna fila, ni el mail ni el PDF | Unitario de la protección de rutas con `/reservas` y `/reservas/<id>`. Integración: con el cliente sin sesión, la consulta de reservas y de mails devuelve 0 filas (o error de permiso) y el PDF no se puede descargar |
| 16 | **Estados de la lista** (textos de `user-flow.md` §7): cargando → esqueleto de tabla, nunca un spinner a pantalla completa; error → "No pudimos cargar las reservas." + "Reintentar"; vacía → "Todavía no entró ninguna reserva. Cuando llegue un mail a la casilla, va a aparecer acá." | Test de pantalla para los tres. Con la consulta simulada en error, "Reintentar" la repite y, si responde bien, aparece la tabla. **No debe pasar:** con la base sin reservas, una tabla vacía o el mensaje de error |
| 17 | **Estados del detalle:** cargando → esqueleto de las zonas (datos y mail); error → "No pudimos abrir esta reserva." + "Reintentar" + "Volver a las reservas"; reserva que no existe (enlace viejo o mal copiado) → "Esta reserva no existe." + "Volver a las reservas". El PDF que no abre → "No se pudo abrir el PDF. Probá de nuevo." | Test de pantalla para cada uno. **No debe pasar:** una pantalla en blanco o un error técnico con un id inexistente o con un id que no tiene formato válido |

**Los motivos de revisión, en pantalla** (texto exacto; los códigos los fijan M2-01 a M2-04):

| Cuándo | Qué dice la app |
|---|---|
| No se pudo leer el mail | No se pudo leer el mail de la agencia. Los datos de la reserva quedaron sin completar. |
| El producto no está cargado en el catálogo | El producto que pide la agencia no está en el catálogo. |
| El producto no se reconoció con seguridad | No se pudo reconocer el producto con seguridad. Revisá el mail para confirmar cuál es. |
| Falta el vuelo y el producto incluye traslados | Faltan los datos de vuelo, y el producto incluye traslados. |
| Hay más de una reserva con el mismo número de la agencia | Hay más de una reserva con este número de la agencia y no se sabe a cuál corresponde este mail. |
| Posible duplicada | Esta reserva se parece a otra (misma agencia, producto y fechas). Revisala antes de seguir. |
| Cualquier otro motivo sin frase propia | Esta reserva necesita que alguien la revise. |

## 4. Qué ve el usuario
- **Pantallas que agrega:**
  - **Reservas** (`/reservas`): la lista (#1 a #4, #16).
  - **Detalle de reserva** (`/reservas/<id>`): encabezado, motivos, producto, componentes, datos,
    vuelos y el panel del mail (#5 a #13, #17).
- **Pantallas que cambian:** la barra lateral suma "Reservas" primero, y el inicio (`/`) pasa del
  Catálogo a Reservas.
- **Decisión de navegación: Reservas es el inicio desde M2.** Es lo que el equipo entra a mirar
  todos los días ("ver qué llegó"), y M4 le suma cosas a esta misma pantalla sin moverla de lugar.
  Mientras no lleguen reservas, el mensaje de vacío explica qué va a aparecer.
- **El recorrido:**
  1. El operador entra con Google y cae en **Reservas**. Ve la lista, con las más nuevas arriba.
     Las de prueba llevan el chip "De prueba".
  2. Ve una fila "para revisión" con la franja ámbar y la abre.
  3. En el detalle lee el motivo arriba ("Faltan los datos de vuelo, y el producto incluye
     traslados."), y abajo el producto con su enlace, las fechas, los pax y la sección de vuelos
     vacía.
  4. En el panel de la derecha lee el mail original de la agencia y confirma que, efectivamente,
     no trae el vuelo.
  5. Toca el producto y llega a su ficha del catálogo, donde ve los traslados. Vuelve con
     "Volver a las reservas".
- **Disposición:** el detalle va en dos columnas: datos a la izquierda y mail a la derecha, como
  pide `user-flow.md` §5.3. Paleta, chips, densidad de tabla y voz, los de `marca.md` sin
  variantes. El chip "recibida" va en gris neutro y "para revisión" en ámbar con el ícono de
  triángulo (`marca.md` §1).
- **Los tres estados:**

  | Pantalla | Cargando | Error | Vacío |
  |---|---|---|---|
  | Reservas | Esqueleto de tabla | "No pudimos cargar las reservas." + Reintentar | "Todavía no entró ninguna reserva. Cuando llegue un mail a la casilla, va a aparecer acá." |
  | Detalle de reserva | Esqueleto de las zonas | "No pudimos abrir esta reserva." + Reintentar + Volver a las reservas | No aplica. Si la reserva no existe: "Esta reserva no existe." + Volver a las reservas |
  | Vuelos de la reserva | — | — | "El mail no trae datos de vuelo." |
  | Abrir el PDF | Botón deshabilitado mientras se prepara | "No se pudo abrir el PDF. Probá de nuevo." | — |

## 5. Qué queda afuera
- **Todo lo que cambia algo:** editar datos, elegir el producto a mano, resolver la revisión,
  marcar o desmarcar duplicadas, descartar, reprocesar el mail o cambiar el estado. Todo eso es
  M4.
- **Filtros, buscador, vista tablero y "Cargar reserva a mano":** M4. Por eso las reservas de
  prueba van en la misma lista, bien marcadas, y no en una pestaña aparte.
- **Historial de la reserva** (quién tocó qué y cuándo): M4. Acá solo se ven los mails recibidos.
- **Proveedores contactados y pedidos:** M3.
- **El estado "procesando…":** la casilla se lee una vez por día, a las 12, y la reserva aparece
  ya procesada.
- **Marcar los datos dudosos campo por campo:** si hace falta, es M4. En M2 la duda se explica
  con el motivo de revisión.
- **Avisos cuando entra una reserva** (mail, Slack): se evalúa después de usarlo.
- **Estados de M3 y M4** (pedido a proveedor, confirmada, etc.): no existen todavía. Los chips de
  esos estados se suman cuando aparezcan.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — solo lee las tablas de reservas con la sesión del operador y la RLS de
  `authenticated` que deja M2-01. Sin sesión, nada (#15). Si hiciera falta una vista o una
  función nueva, va en una migración con RLS.
- **#2** — el PDF se abre con un enlace que caduca, generado con la sesión del usuario. La clave
  de servicio de Supabase no se usa en el navegador.
- **#4** — la pantalla no tiene ningún camino hacia afuera: no responde mails ni escribe a nadie,
  y los enlaces del mail no son clicables (#13).

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. Unitarias + linter + tipos: pantallas con datos simulados (los tres estados de cada una,
     #2 a #17), las frases de motivos (todo valor posible del motivo tiene su frase), el formato
     de fechas y rango (DD/MM/AAAA, `→`), la hora de vuelo sin conversión, el render del mail como
     texto (#13), la protección de rutas para `/reservas` y el chequeo de solo lectura (#14).
  2. Integración contra el Supabase real: el test inserta con la clave de servicio un juego de
     reservas **de prueba** (una recibida de producto simple, una de un tour con componentes, una
     para revisión por falta de vuelo, una sin producto reconocido, una con 2 mails y PDF) y las
     borra al terminar. Con una sesión del equipo, las consultas devuelven lo esperado; **sin
     sesión, 0 filas y el PDF no se descarga** (#15). Patrón: `tests/catalogo-pantallas.integration.test.tsx`
     y `tests/helpers/usuario-de-prueba.ts`.
  3. Recorrido en la pantalla real: con `next dev` y esas reservas cargadas, se hace el recorrido
     de §4 en el navegador: login → lista → reserva para revisión → motivo → mail → enlace al
     producto → volver. También se abre la de tour, la de PDF y una de prueba, y se revisa que no
     haya ningún control de edición. Más `npm run build`.
  No se avanza a una capa con la anterior en rojo. Si una falla: causa raíz → arreglo mínimo →
  re-correr.
- **Test primero:** los tests de §3, y en especial los de "no debe pasar" (#4, #6, #13, #14,
  #15, #16, #17), se escriben antes que las pantallas y se los ve fallar por la razón correcta.
- **Dónde va cada cosa (orientativo; los nombres de columnas los manda M2-01):**
  - Rutas: `src/app/(app)/reservas/page.tsx` y `src/app/(app)/reservas/[id]/page.tsx`, igual que
    `catalogo/`. `src/app/(app)/page.tsx` redirige a `/reservas`.
  - Pantallas: `src/components/reservas/lista-reservas-pantalla.tsx`,
    `detalle-reserva-pantalla.tsx` y `mail-original.tsx`, con tests en
    `src/components/reservas/pantallas.test.tsx`. Reusan `EsqueletoTabla`, `EsqueletoDetalle`,
    `EstadoError`, `EstadoVacio`, `Chip` y `Aviso` (`src/components/ui/estados.tsx`),
    `useOrden`/`EncabezadoOrdenable` (`ui/orden.tsx`) y `useConsulta` (`src/lib/catalogo/use-consulta.ts`).
    Si sirve, el bloque de componentes del tour reusa lo de `src/components/catalogo/`.
  - Datos: `src/lib/reservas/consultas.ts` (solo `select`, con el cliente de la sesión),
    `tipos.ts` y `reglas.ts` (frase de cada motivo, orden por llegada, conteo real/prueba).
    Formatos de fecha y rango en `src/lib/formato.ts`.
  - Barra lateral: `src/components/navegacion-lateral.tsx` (+ su test), con "Reservas" primero.
  - Textos: una sección `reservas` en `src/lib/textos/index.ts` con todo lo visible, incluidos
    los motivos (mapa código → frase). Ningún texto suelto en los componentes.
- **Lo que esta pieza le pide a M2-01 a M2-04** (si falta, se avisa y no se inventa): una marca
  de reserva de prueba en `reserva` (la usa M2-06); los motivos de revisión guardados como
  códigos de una lista cerrada, no como texto libre; el texto del producto tal como lo nombró el
  mail; los vuelos con la hora local del aeropuerto como texto o fecha sin zona; `mail_recibido`
  enlazado a la reserva, con remitente, asunto, fecha, carpeta (Inbox/Spam), cuerpo en texto y
  la ubicación del PDF en un bucket **privado** de Storage con política para `authenticated`.
  El PDF se abre con `createSignedUrl` de corta duración (~5 min).
- **Cuerpo del mail:** se muestra como texto plano (`white-space: pre-wrap`). Si solo hay HTML, se
  le sacan las etiquetas y queda texto. Nunca `dangerouslySetInnerHTML` (#13).
- **Id inválido:** si `/reservas/<id>` no tiene formato uuid, se muestra "Esta reserva no existe."
  sin consultar la base.
- **Diseño y alcance no se deciden acá:** el recorrido y los estados salen de `user-flow.md` §5.2,
  §5.3 y §7 (solo la parte de lectura) y de `marca.md`. Si al construir aparece algo que no
  cierra, va a esos docs.
- `next dev` agrega un bloque a `CLAUDE.md`: **no commitearlo**.
