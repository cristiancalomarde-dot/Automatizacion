# M1-04 · Importador: productos simples piloto (Iguazú)

**Depende de:** M1-03 (el directorio de proveedores tiene que estar cargado para poder matchear
Service Provider / Booking Supplier).

## 1. Qué queremos lograr

Correr un importador que lee el bloque de columnas de Iguazú del Excel maestro de paquetes y deja
cargados los productos simples de esa familia (`OD010A`, `OD010B`, `OD010C`, `OD010D` y demás
variantes de "Iguazu Falls on a Shoestring" / "Iguazu Falls Combined" del lado Argentina, Brasil o
combinado) con sus servicios y proveedores, listos para que M2 los use para emparejar reservas
entrantes.

## 2. Qué hay hoy

El esquema de catálogo (`producto`, `producto_servicio`, `codigo_externo`, `importacion` — M1-02)
y el directorio de proveedores cargado con `nombre_normalizado` (M1-03) ya existen. Todavía no hay
ningún producto cargado. La fuente es
`Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas para IA.xlsm`, hoja
**"Analisis a Mayo 2026"** (~2218 filas — planilla maestra, hecha para humanos, con destinos
organizados de izquierda a derecha y productos como bloques de columnas nuevos agregados a la
derecha), más la hoja **"Readme AI"** del mismo archivo con las reglas de lectura del owner
(reproducidas abajo — son la autoridad sobre cómo interpretar el archivo).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Ubica, dentro de la hoja "Analisis a Mayo 2026", el o los bloques de columnas del destino Iguazú, y dentro de ellos, solo los bloques de producto cuyo código matchea el patrón de la familia piloto (`OD010A/B/C/D` y variantes de "Iguazu Falls...") — el resto de la hoja (2218 filas) no se toca. | Correr el importador sobre el archivo real: solo se crean productos de esa familia, ninguno de otro destino. |
| 2 | De cada bloque de producto, lee **solo la sección 1 (Construcción del producto)**: código(s), alojamiento(s) con su prioridad si hay "/", excursiones, traslados, buses, cruceros, otros servicios incluidos, Service Provider y Booking Supplier de cada uno. Ignora la sección 2 (cálculo de costos) y la sección 3 (resumen para catálogo/Wetu). | Inspeccionar los `producto_servicio` creados: ningún campo de costo/markup quedó guardado (`modelo-de-datos.md` "Qué NO se guarda"). |
| 3 | Crea un `producto` por cada código de la familia (ej. `OD010A`), con nombre y ciudad(es)/destino. | Después de correr, existen 4 (o más, según variantes reales de la familia en el archivo) filas en `producto` para Iguazú, una por código. |
| 4 | Por cada servicio del bloque (alojamiento, traslado, excursión, bus, crucero, otro), crea su `producto_servicio` asociado al producto, con su Service Provider y Booking Supplier. | Un producto de la familia (ej. `OD010A`) tiene tantos `producto_servicio` como filas de servicio trae su bloque en el Excel. |
| 5 | Cuando un servicio trae varias opciones separadas por "/" (ej. alojamiento "Beer Hostel / Hostel Inn / Mango Hostel"), guarda las N opciones bajo el mismo `producto_servicio`, preservando el orden como prioridad de reserva (pedir primero la 1, si no hay disponibilidad seguir con la 2, etc.). | Un producto con alojamiento "X / Y / Z" en el Excel queda con las 3 opciones cargadas y su orden 1-2-3 preservado (prueba explícita del plan). |
| 6 | Matchea Service Provider y Booking Supplier contra `proveedor.nombre_normalizado` (cargado en M1-03). Reconoce que Service Provider y Booking Supplier pueden ser la misma empresa o distintas (ej. alojamiento "Hotel El Pueblito" con Booking Supplier "Cuenca del Plata") y guarda cada uno en su campo. | Un `producto_servicio` de alojamiento con Booking Supplier distinto del Service Provider queda con ambos proveedores correctamente distinguidos, no fusionados. |
| 7 | Si un Service Provider o Booking Supplier del Excel **no matchea** ningún `proveedor` ya cargado, el `producto_servicio` queda marcado "proveedor sin resolver" para revisión manual — **no se crea un proveedor nuevo, ni se inventa un mail**. | **Prueba de qué NO debe pasar:** correr el importador con un Service Provider inexistente en la tabla `proveedor` no agrega ninguna fila nueva a `proveedor`; el `producto_servicio` correspondiente queda con su proveedor en null/"sin resolver" y un flag para revisión. |
| 8 | Guarda cada código de producto del bloque (propio de HI Travel o de partner: Kilroy, TourRadar, Journaway) en `codigo_externo`, apuntando al `producto` interno. | Un producto con más de un código (propio + Kilroy, por ejemplo) tiene igual cantidad de filas en `codigo_externo`, todas apuntando al mismo `producto`. |
| 9 | Trata las filas en blanco dentro de un bloque como intencionales (legibilidad) — no las interpreta como error ni intenta "compactar" el bloque. | Un bloque con filas en blanco entre servicios importa la misma cantidad de `producto_servicio` que servicios reales tiene, sin filas vacías generadas ni servicios salteados. |
| 10 | Usa reglas simples primero (posición fija de columna dentro del bloque, patrones de texto conocidos). Cuando la estructura de un bloque no calza con esas reglas (columnas corridas, texto libre en vez de un patrón fijo), le pide a la IA que interprete ese bloque puntual, bajo el techo de gasto de `integraciones-ia.md` (regla #3). Lo que ni las reglas ni la IA resuelven con confianza queda "para revisar" — nunca se inventa un dato. | Forzar un bloque con una columna corrida (ej. insertar una columna de más en una copia de prueba del archivo): el importador igual extrae el producto (vía IA) o lo deja explícitamente "para revisar", nunca lo omite en silencio ni lo carga con datos incorrectos. |
| 11 | Registra cada corrida en `importacion`: archivo, fecha, qué se cargó (productos/servicios/códigos creados), qué quedó "para revisar" (proveedores sin resolver, bloques no interpretados). | Después de correr, existe una fila en `importacion` con esos conteos, consultable. |
| 12 | Volver a correr el importador con el mismo archivo no duplica productos, servicios ni códigos externos (idempotencia por código de producto). | Correr el importador dos veces seguidas sobre el mismo archivo: la segunda corrida deja la misma cantidad de filas en `producto`, `producto_servicio` y `codigo_externo` que la primera (0 filas nuevas), y la fila de `importacion` de la segunda corrida lo refleja. |

## 5. Qué queda afuera

- **El resto del catálogo** (las ~2218 filas del Excel, otros destinos) — se carga en un milestone
  posterior, cuando se sumen más agencias/productos (`prd.md` §5, plan M1 §2).
- **Tours compuestos** (secuencias de paquetes + tramos de bus) — es M1-05, spec aparte.
- **Pantalla de Catálogo o de "para revisar"** — es M1-06; esta spec solo deja los datos y los
  flags cargados en base.
- **Pantalla de subir el Excel** — para esta carga inicial el importador corre directo con el
  archivo de `Insumos/` (plan M1 §2); una pantalla de resubida queda para después.
- **Resolución automática de "proveedor sin resolver"** — es trabajo manual posterior (vía M1-06),
  esta spec solo detecta y marca, no decide.
- **Costos, márgenes o precios del bloque** — no se guardan (`modelo-de-datos.md`).

## 6. Reglas del proyecto que toca

- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#3** — la IA (Claude, vía `integraciones-ia.md`) entra solo como respaldo cuando las reglas
  simples no alcanzan para leer un bloque; corre bajo el mismo techo de gasto mensual (US$ 20) que
  el resto del proyecto, chequeado antes de cada llamada.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):** 1) tests unitarios + linter sobre el parser del
  bloque (incluye el caso de prioridad "/", el caso de proveedor sin resolver, y el caso de
  columnas corridas que fuerza el respaldo de IA) → 2) integración: correr el importador contra
  una copia del Excel real (o un extracto con solo el bloque de Iguazú) y verificar en base los
  productos, servicios, códigos y la fila de `importacion` → 3) recorrido completo: correr el
  importador dos veces seguidas sobre el mismo archivo y confirmar que la segunda no duplica nada.
  No se avanza a una capa con la anterior en rojo.
- **Test primero:** escribir el test de "alojamiento con prioridad `/`" y el de "proveedor sin
  resolver no crea proveedor fantasma" antes de implementar el parser, y verlos fallar por la
  razón correcta.
- **Entregables:** el importador y sus tests (ubicación sugerida, a confirmar contra la estructura
  real del proyecto de M1-01: algo como `src/lib/importadores/productos-simples-iguazu.ts` +
  `src/lib/importadores/productos-simples-iguazu.test.ts`, más el script/route handler que lo
  dispara). Sin interfaz — no hay pantalla en esta spec (es M1-06).
- **Reglas de lectura del Excel (autoridad: hoja "Readme AI" del archivo fuente), resumidas:**
  - Cada bloque de producto tiene 3 secciones: (1) Construcción del producto — la única que esta
    spec lee; (2) cálculo de costos — ignorar; (3) resumen para catálogo — ignorar.
  - **Service Provider** = quien presta el servicio. **Booking Supplier** = a quién se le pide la
    reserva y quien factura (a veces igual al Service Provider, a veces distinto).
  - Varios proveedores separados por "/" = orden de prioridad de reserva, no alternativas
    equivalentes.
  - Cada producto puede tener más de un código (propio o de partner) → todos van a
    `codigo_externo`.
  - Filas en blanco son intencionales, no se compactan.
  - Traslados de aeropuerto usan códigos IATA (EZE, AEP, SCL, BRC, FTE, REL, IGR, IGU, etc.) — no
    hace falta interpretarlos en esta spec más allá de guardarlos como parte del servicio de
    traslado.
- **Emparejado de proveedor:** contra `proveedor.nombre_normalizado` (normalización ya aplicada en
  M1-03); si el nombre del Excel no normaliza a un match exacto, se marca "sin resolver" — no se
  intenta fuzzy-matching en esta spec salvo que la normalización estándar ya lo resuelva.
- **Diseño y alcance no se deciden acá:** el modelo de datos exacto (`producto_servicio`,
  `codigo_externo`) es de `docs/arquitectura/modelo-de-datos.md`; el alcance de qué familia de
  productos entra es de `docs/prd.md` y el plan de M1.
