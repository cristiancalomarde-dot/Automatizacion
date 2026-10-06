# M1-06 · Pantallas de Catálogo y Directorio

> **Actualizada el 2026-10-06** (decisión del owner, `DECISIONS.md`): **las pantallas son de solo lectura.** Los datos se corrigen en los Excel del owner y se re-importan, así nada de lo que se cargue en la app se pisa. Los requisitos de edición (#5 y #9) quedan **fuera** de esta spec. La app tiene que mostrar con claridad qué falta completar y en qué Excel. Además, la spec se escribió antes de M1-04b…M1-05: ahora los datos tienen más estructura (ver #14 a #18).

**Depende de:** M1-04, M1-05 (necesita datos reales: los productos simples de Iguazú y los 7 tours
compuestos ya cargados).

## 1. Qué queremos lograr

Que cualquiera del equipo entre a la app, busque un producto de catálogo (ej. el Overland
`CHB31`) y vea, sin salir de la pantalla, a qué proveedor —con qué mail— se le pediría cada parte;
y que pueda entrar al Directorio de proveedores, ver quién falta de mail y corregirlo ahí mismo.
Es la demostración en pantalla de la condición de `docs/prd.md` M1: "dado un producto, el sistema
devuelve sus proveedores con sus mails".

## 2. Qué hay hoy

M1-01 dejó la app con login funcionando. M1-02 dejó el esquema (`producto`, `proveedor`,
`producto_servicio`, `producto_componente`, `codigo_externo`) vacío. M1-03 cargó el directorio de
proveedores completo. M1-04 y M1-05 cargaron los productos simples de Iguazú y los 7 tours
compuestos top-seller. Esta spec agrega las dos pantallas que leen y editan esos datos; no toca el
esquema ni los importadores.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | La pantalla **Catálogo de productos** lista una fila por `producto`: código(s), nombre, ciudad(es), cantidad de proveedores asociados (contando los de todos sus `producto_servicio`, sin duplicar por proveedor repetido), última edición (`updated_at`). | Con los productos de M1-04/M1-05 cargados, la tabla muestra una fila por producto con esas seis columnas pobladas; el conteo de proveedores de un producto simple con 2 `producto_servicio` al mismo proveedor muestra 1, no 2. |
| 2 | Buscador de texto libre por código o nombre, sobre esa misma tabla. | Buscar `CHB31` deja una sola fila: el Overland San Pedro de Atacama→Uyuni→La Paz. Buscar una porción del nombre (ej. "overland") da el mismo resultado. |
| 3 | Detalle de un producto **simple**: sus `producto_servicio` (tipo de servicio, prioridad si hay alternativas) y, por cada uno, el proveedor **Service Provider** y el **Booking Supplier** (nombre + mail). | Abrir un producto simple de Iguazú muestra cada servicio con su(s) proveedor(es) y el mail de cada uno visible sin un clic adicional. |
| 4 | Detalle de un producto **tour compuesto**: sus `producto_componente` listados **en el orden** (`orden`) del tour. Cada fila marca si es un **paquete** (nombre del producto componente, enlace a su propio detalle, sus proveedores con mail) o un **tramo de bus** (ruta/descripción, etiqueta "tramo externo pendiente de emitir", sin proveedor). | Buscar `CHB31` y abrir el detalle: se ven sus paquetes componentes en orden, cada uno con el proveedor (Service Provider/Booking Supplier) y su mail a quien se le pediría ese tramo. Un tour con tramo de bus (ej. Patagonia Highlights, `ARCH31`) muestra ese tramo con la etiqueta "tramo externo pendiente de emitir" y ningún proveedor asociado. |
| 5 | ~~Edición de producto~~ **Fuera de esta spec (2026-10-06):** solo lectura. En su lugar, cada producto muestra de qué Excel y de qué fila sale (`fila_excel`), para que el owner sepa dónde corregirlo. | Abrir un producto muestra "Excel de paquetes, fila N" en cada servicio. |
| 6 | Si un producto no tiene ningún proveedor asociado en ninguno de sus servicios, el detalle muestra el aviso "No se le podrán armar pedidos" (texto de `user-flow.md` §5.5). | Un producto de prueba sin `producto_servicio` con proveedor muestra ese aviso ámbar en vez de una lista vacía sin explicación. |
| 7 | La pantalla **Directorio de proveedores** lista una fila por `proveedor`: nombre, mail de contacto, canal (mail/whatsapp), teléfono/otros datos, cantidad de productos en los que aparece (vía sus `producto_servicio`). Fila sin mail resaltada. | Con el directorio de M1-03 cargado, la tabla muestra las ~200 filas con esas columnas; las filas sin mail reconocible se distinguen visualmente (no solo por la ausencia del dato). |
| 8 | Filtro rápido **"Proveedores sin mail"** sobre esa tabla. | Activar el filtro deja solo los proveedores que M1-03 dejó sin mail reconocible; desactivarlo vuelve a mostrar el listado completo. |
| 9 | Detalle de un proveedor, **solo lectura**: nombre, mails, canal, teléfono, aclaraciones, ciudad y los productos donde aparece. Si le falta el contacto, un aviso dice que se completa en el Excel de proveedores. | Abrir un proveedor sin mail muestra el aviso con dónde completarlo. |
| 10 | **Qué NO debe pasar (catálogo vacío):** antes de que existan productos (estado previo a M1-04/M1-05, o una base de prueba vacía), la pantalla Catálogo muestra el mensaje de vacío de `user-flow.md` §7 ("El catálogo está vacío. Sin productos cargados, las reservas no se pueden emparejar.") con la acción "Cargar productos" — nunca una tabla en blanco ni un mensaje de error. | Con la tabla `producto` vacía, cargar la pantalla Catálogo muestra ese texto exacto; no aparece un `<table>` vacío ni el texto de error de carga. |
| 11 | **Qué NO debe pasar (directorio vacío):** con la tabla `proveedor` vacía, el Directorio muestra el mensaje de vacío de `user-flow.md` §7 ("No hay proveedores cargados. Se necesitan para poder mandarles los pedidos.") con la acción "Agregar proveedor" — nunca una tabla en blanco ni un error. | Con la tabla `proveedor` vacía, cargar la pantalla Directorio muestra ese texto exacto. |
| 12 | **Qué NO debe pasar (falla de carga):** si la consulta a Supabase falla (ej. error de red simulado), cada pantalla muestra su mensaje de error de `user-flow.md` §7 con "Reintentar" — nunca queda colgada ni muestra datos parciales sin avisar. | Simular una falla de la consulta: Catálogo muestra "No pudimos cargar el catálogo. Reintentar."; Directorio muestra "No pudimos cargar el directorio. Reintentar."; tocar "Reintentar" repite la consulta. |
| 13 | **Marca real (agregado 2026-09-27):** aplica la paleta actualizada de `docs/arquitectura/marca.md` (primario `#3B659B`, derivado del azul del logo) en los tokens de `src/app/globals.css`, y pone el **logo real** de HI Travel en el header y en la pantalla de login, recortado del PNG de `Insumos/` a `public/marca/`, más un favicon con el triángulo "hi". El naranja del logo no se usa fuera del logo. | En el header y el login se ve el logo real, nítido y sin márgenes vacíos. Ningún botón usa el azul claro del logo ni el naranja. El test de contraste de los tokens (texto blanco sobre primario ≥ 4.5:1) pasa. |
| 14 | **Niveles y prioridades.** El detalle de un producto simple agrupa los alojamientos por nivel (Hostel / Budget Hotel / Hotel 3* / Hotel 4* / otros) y, dentro de cada nivel, las opciones en orden de prioridad (1ª, 2ª…). Los niveles "no ofrecidos" se muestran como tales. | OD010A muestra Hostel (Beer), Budget (no ofrecido), Hotel 3* (El Pueblito → Botánica) y Hotel 4* (La Aldea). |
| 15 | **Estado de cada servicio, con su propio chip y etiqueta escrita:** con mail · por WhatsApp (pedido a mano) · manual en sistema propio (Kupos, Buquebus, Transvip) · sin resolver (con el motivo) · opcional. | OD030 muestra el Transvip como "manual"; Aji Verde como "WhatsApp"; ningún estado se comunica solo con color. |
| 16 | **Tours, día por día:** el detalle de un tour muestra cada componente con su día de inicio, sus noches, los transfers de entrada y salida, los buses entre destinos (diurno o nocturno; "pasaje que emite HI Travel") y los servicios propios del tour con su proveedor (ej. el bus Uyuni–La Paz de Imperio Inca). Un componente que es otro tour (CHB31 dentro de 5C01) es un enlace a ese tour. | 5C01 se lee del día 1 al 30, con CHB31 en el día 22 como enlace; ARCH31 muestra OD033 → OD016 → bus El Calafate–Puerto Natales → OD017, con transfers solo en las puntas. |
| 17 | **Códigos de agencia:** el detalle muestra los códigos externos (HI Travel, Kilroy, TourRadar con su nombre). | OD010A muestra 160955 "Iguazu Falls on a Shoestring (3N)" de TourRadar. |
| 18 | **Pantalla "Pendientes"** (o filtro equivalente): una lista única de lo que falta completar en los Excel (servicios sin resolver, proveedores sin contacto), con el producto, el Excel y la fila. | Muestra NH Cordillera (OD019), Antarctica Hostel (OD022) y O Hostel GRU (COMPBR10). |

## 4. Qué ve el usuario

- **Pantallas que agrega:**
  - **Catálogo de productos** (`/catalogo`): tabla + buscador (requisitos #1, #2, #10, #12).
  - **Detalle de producto** (`/catalogo/[id]`): datos del producto, sus servicios/proveedores (si
    es simple) o sus componentes en orden (si es tour compuesto), edición en línea (#3, #4, #5,
    #6).
  - **Directorio de proveedores** (`/proveedores`): tabla + filtro "sin mail" (#7, #8, #11, #12).
  - **Detalle de proveedor** (`/proveedores/[id]`): edición de nombre, mail, canal (#9).
- **Navegación:** ambas pantallas cuelgan de la barra lateral (**Catálogo**, **Proveedores**) según
  el mapa de `user-flow.md` §2. Desde el detalle de un producto, cada proveedor listado es un
  enlace al Directorio filtrado en ese proveedor (para ir directo a corregirle el mail); desde el
  detalle de un producto tour compuesto, cada paquete componente es un enlace a su propio detalle
  de producto. Desde el Directorio, cada proveedor puede volver al/los producto(s) donde aparece.
- **El recorrido que demuestra la condición del PRD:** el operador entra a **Catálogo**, escribe
  `CHB31` en el buscador, abre el Overland, ve la lista ordenada de sus componentes con, para cada
  uno, el proveedor y el mail al que se le pediría ese tramo — sin necesitar abrir el Directorio
  por separado.
- **El recorrido de edición del Directorio:** el operador entra a **Proveedores**, activa
  "Proveedores sin mail", abre uno de la lista, completa el mail, guarda, y al volver a la tabla
  ese proveedor ya no aparece en el filtro "sin mail".
- **Los tres estados** (redacción exacta de `user-flow.md` §7, tono de `marca.md` §5):

  | Pantalla | Carga | Error | Vacío |
  |---|---|---|---|
  | Catálogo de productos | Esqueleto de tabla (filas grises), no spinner a pantalla completa | "No pudimos cargar el catálogo. Reintentar." | "El catálogo está vacío. Sin productos cargados, las reservas no se pueden emparejar." + botón "Cargar productos" |
  | Detalle de producto | Esqueleto de las zonas (datos + servicios/componentes) | "No pudimos abrir este producto. Reintentar / Volver al catálogo." | No aplica (el producto existe si se llegó al detalle) |
  | Directorio de proveedores | Esqueleto de tabla | "No pudimos cargar el directorio. Reintentar." | "No hay proveedores cargados. Se necesitan para poder mandarles los pedidos." + botón "Agregar proveedor" |
  | Detalle de proveedor | Esqueleto de las zonas | "No pudimos abrir este proveedor. Reintentar / Volver al directorio." | No aplica |
  | Buscador de catálogo sin resultados | — | — | "Ninguna reserva coincide con estos filtros." adaptado a este contexto: "Ningún producto coincide con la búsqueda." (mismo patrón de `user-flow.md` §7, sin texto ya fijado para este caso puntual) |
  | Guardar una edición (nombre, mail, canal, agregar/quitar proveedor) | Botón deshabilitado mientras guarda | "No se pudo guardar. Probá de nuevo." — el formulario conserva lo escrito (mismo patrón que "Registrar respuesta del proveedor" en §7) | — |

  Principio de `user-flow.md` §7 aplicado acá tal cual: nunca una pantalla en blanco durante la
  espera; los errores dicen qué pasó y qué hacer; una edición a medio hacer no se pierde si falla
  el guardado.

## 5. Qué queda afuera

- **Crear un producto nuevo desde cero a mano.** Por ahora el catálogo se carga solo por
  importador (M1-03/04/05); esta spec permite editar lo ya importado (nombre, ciudad, proveedores
  asociados por servicio) pero no un formulario de alta manual de producto. Si un producto falta,
  se agrega en una corrida del importador o en un milestone posterior.
- **Crear un proveedor nuevo desde cero a mano.** El botón "Agregar proveedor" del estado vacío
  del Directorio (texto de `user-flow.md` §7) queda deshabilitado/con aviso "todavía no
  implementado" si se llega a mostrar — en la práctica no debería mostrarse porque M1-03 carga el
  directorio antes de esta pieza. El alta manual completa de un proveedor queda para cuando haga
  falta (no es condición de M1).
- **Editar `producto_componente` (agregar/quitar/reordenar componentes de un tour, cambiar
  `transfer_in`/`transfer_out`).** Esta spec solo lista los componentes que dejó M1-05; cambiar la
  composición de un tour es una pieza aparte si hace falta.
- **Cualquier pantalla de reservas** (Bandeja, Detalle de reserva, Revisión y envío de pedidos):
  es M2-M4.
- **Cola formal "para revisar" del importador como pantalla separada.** Lo que el importador dejó
  sin resolver se corrige editando el producto/proveedor directamente en estas pantallas (#5, #9);
  no hay una bandeja aparte de pendientes de importación en esta spec.
- **Vista tablero, exportar, imprimir, o cualquier otra pantalla que `user-flow.md` no pide para
  M1.**

## 6. Reglas del proyecto que toca

- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — estas pantallas leen y escriben tablas de datos compartidos por todo el equipo (sin
  aislamiento por usuario, ver `modelo-de-datos.md`); se apoyan en el `authenticated`-only de RLS
  que dejó M1-02, no agregan reglas de acceso nuevas.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. Unitarias + linter: componentes de tabla, buscador, filtro "sin mail" y formularios de
     edición con datos de prueba (mock), incluidos los tres estados (carga/error/vacío) de cada
     pantalla.
  2. Integración: contra el proyecto Supabase real (o el emulador local) con los datos que dejaron
     M1-03/04/05 cargados — incluye la prueba de "qué NO debe pasar" de la tabla §3 (#10, #11,
     #12: catálogo vacío, directorio vacío, falla de consulta).
  3. Recorrido completo de punta a punta: buscar `CHB31`, ver sus componentes con proveedor y
     mail; activar "Proveedores sin mail" en el Directorio, editar el mail de uno, confirmar que
     el filtro lo saca de la lista al volver a entrar.
  No se avanza a una capa con la anterior en rojo; si una falla: causa raíz → arreglo mínimo →
  re-correr.
- **Test primero:** escribir los tests de los requisitos de §3 (en particular #10, #11, #12, las
  pruebas de "qué NO debe pasar") antes de construir las pantallas, verlos fallar por la razón
  correcta, y recién ahí implementar.
- **Entregables:** las rutas/páginas `/catalogo`, `/catalogo/[id]`, `/proveedores`,
  `/proveedores/[id]` (o el ruteo equivalente del framework que dejó M1-01), sus componentes de
  tabla/buscador/filtro/formulario, y las consultas a Supabase que arman: (a) producto → sus
  `producto_servicio` → sus `proveedor` (Service Provider/Booking Supplier); (b) producto tour
  compuesto → sus `producto_componente` en orden → si `tipo = paquete`, el producto componente y
  su cadena (a); (c) proveedor → cantidad de productos donde aparece (join contra
  `producto_servicio`).
- **Paleta, tipografía, densidad de tabla y voz de los textos:** los de `docs/arquitectura/marca.md`
  tal cual (sin inventar variantes); los textos de carga/error/vacío son los de
  `docs/arquitectura/user-flow.md` §7 literales, salvo el único caso sin texto fijado ya señalado
  en §4 de esta spec (buscador de catálogo sin resultados), que sigue el mismo patrón de voz.
  Chip de "tramo externo pendiente de emitir" en tono ámbar (aviso), coherente con la paleta de
  estados semánticos de `marca.md` §1.
- **Diseño y alcance no se deciden acá:** el recorrido y los estados ya están fijados en
  `user-flow.md` §5.5/§5.6/§7 y `marca.md`; esta spec los traduce a pantallas, no los rediseña.
