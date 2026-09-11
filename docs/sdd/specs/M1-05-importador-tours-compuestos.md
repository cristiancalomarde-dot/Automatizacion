# M1-05 · Importador: tours compuestos + regla de transfers (7 top-sellers)

**Depende de:** M1-04 (los tours compuestos se arman combinando productos/paquetes simples ya
cargados, más los tramos de bus).

## 1. Qué queremos lograr

Correr un importador que carga los 7 tours compuestos top-seller del riesgo #6 del PRD como
`producto` tipo "compuesto", cada uno con su secuencia ordenada de `producto_componente`
(paquetes ya cargados y/o tramos de bus), aplicando la regla de transfer de puntas y distinguiendo
un tramo de bus que es servicio de un proveedor (genera pedido) de un tramo de bus público externo
(no genera pedido, queda como tarea pendiente). Al terminar, buscar el Overland (`CHB31`) muestra
su estructura completa: qué paquetes lo componen, en qué orden, y cuáles conexiones llevan
transfer.

## 2. Qué hay hoy

El esquema de catálogo (`producto`, `producto_componente`, `codigo_externo`, `importacion` —
M1-02) existe, con RLS activa. M1-04 dejó cargados los productos simples piloto (familia Iguazú:
`OD010A/B/C/D` y variantes) como `producto` con sus `producto_servicio`. Todavía no hay ningún
`producto_componente` cargado ni ningún `producto` de tipo "compuesto". La fuente es el Excel de
rutas de bus (`Insumos/RutasenBus2020 para IA.xlsm`) más los bloques de tours del Excel maestro de
paquetes — ambos son planillas para humanos, no estructuradas para lectura por máquina.

Los 7 tours a cargar: `CHB31` (Overland San Pedro de Atacama→Uyuni→La Paz), `BOCHI04R` (el mismo
en reversa, La Paz→San Pedro con transfer final a CJC), `ARCH31` (Patagonia Highlights: El
Chaltén + bus + El Calafate + bus + Puerto Natales), `ARCH33` (Patagonia Trekking Paradise, W
Trek), `5C01` (5 Countries Rio de Janeiro→La Paz), `BRARCH26` (Rio de Janeiro→Santiago), `AR09`
(Patagonia Adventure Tour).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Crea un `producto` tipo "compuesto" para cada uno de los 7 tours (`CHB31`, `BOCHI04R`, `ARCH31`, `ARCH33`, `5C01`, `BRARCH26`, `AR09`), con su código guardado en `codigo_externo` apuntando a ese producto. | Después de correr, existen (como máximo) 7 filas en `producto` marcadas "compuesto", una por código listado — las que no se logran armar limpiamente quedan "para revisar" en vez de crearse a medias (ver #7). |
| 2 | Por cada tour, arma su secuencia de `producto_componente` en orden (`orden` 1, 2, 3…): cada fila es o bien otro `producto` ya cargado (un paquete), identificado por su código/nombre contra el catálogo existente, o bien un tramo de bus con su ruta (origen, destino). | El tour armado, leído por `orden`, reproduce la secuencia real del tour (ej. `ARCH31`: paquete El Chaltén → tramo de bus → paquete El Calafate → tramo de bus → paquete Puerto Natales). |
| 3 | Para cada tramo de bus del tour, decide si es (a) un **servicio dentro de un paquete** (tiene su propio Booking Supplier que factura ese tramo — ej. el bus Uyuni→La Paz que da el mismo proveedor boliviano de "Overland Bolivia") o (b) un **tramo de bus público externo** entre dos paquetes distintos, sin proveedor propio. El caso (a) no genera fila en `producto_componente` como tramo — ya vive dentro del `producto_servicio` del paquete que lo incluye; el caso (b) sí genera una fila `tipo = tramo_bus`. | El Overland (`CHB31`) no tiene ninguna fila `tipo = tramo_bus` en su `producto_componente` — el traslado Uyuni→La Paz queda dentro de los `producto_servicio` de "Overland Bolivia", no como componente aparte. |
| 4 | Aplica la regla de transfer al armar cada componente: por defecto, solo el `transfer_in` del primer componente del tour y el `transfer_out` del último quedan en verdadero; toda conexión intermedia resuelta con un tramo de bus queda con `transfer_in`/`transfer_out` en falso en esa punta, salvo que el destino de esa punta sea **IGR** o **IGU**, en cuyo caso el transfer se mantiene en verdadero aunque esté en el medio del tour. | `ARCH31` (Patagonia Highlights) queda con `transfer_in = true` solo en su primer componente y `transfer_out = true` solo en el último; las puntas de los tramos de bus intermedios quedan en `false`. Un tour de prueba que pasa por IGR o IGU en el medio conserva `transfer_in`/`transfer_out = true` en esa punta puntual (prueba de la excepción). |
| 5 | Cuando un tour no puede armarse limpiamente — falta un `producto` componente que todavía no está cargado, o la regla de transfer es ambigua para ese caso puntual (ej. no se puede determinar con confianza cuál es la primera o última punta) — el tour completo queda "para revisar": no se crea el `producto_componente` con un componente inventado, vacío o a medias. | **Prueba de qué NO debe pasar:** correr el importador cuando falta cargar uno de los paquetes que componen un tour (ej. "Overland Bolivia" no está en `producto` todavía) deja ese tour sin ningún `producto_componente` creado y marcado "para revisar" — no se crea con un componente `null` ni con un placeholder. |
| 6 | Usa reglas simples primero (código de paquete conocido, patrón de ruta de bus) y, cuando la hoja de tours o de rutas de bus no calza con esas reglas (texto libre, bloques no estandarizados), le pide a la IA que interprete ese tour puntual, bajo el techo de gasto de `integraciones-ia.md` (regla #3). Lo que ni las reglas ni la IA resuelven con confianza cae en el caso #5 ("para revisar"). | Forzar un tour con una descripción de ruta ambigua (texto libre en vez de un origen/destino claro): el importador lo arma vía IA o lo deja "para revisar", nunca lo omite en silencio ni inventa la ruta. |
| 7 | Registra cada corrida en `importacion`: qué tours se armaron completos, cuáles quedaron "para revisar" y por qué (paquete faltante / transfer ambiguo / no interpretado). | Después de correr sobre los 7 tours, existe una fila en `importacion` con esos conteos y el detalle de qué tour cayó en cada cola, consultable. |
| 8 | Volver a correr el importador con los mismos datos no duplica productos compuestos ni componentes (idempotencia por código de tour). | Correr el importador dos veces seguidas: la segunda corrida deja la misma cantidad de filas en `producto` (compuestos) y `producto_componente` que la primera (0 filas nuevas), y la fila de `importacion` de la segunda corrida lo refleja. |
| 9 | El Overland (`CHB31`) queda armado como [San Pedro de Atacama Explorer] + [Overland Bolivia], sin ningún tramo de bus externo. | Leer `producto_componente` de `CHB31` ordenado: 2 filas, ambas `tipo = paquete`, apuntando a los productos "San Pedro de Atacama Explorer" y "Overland Bolivia"; ninguna fila `tipo = tramo_bus`. Es el caso de prueba principal, ya confirmado con el owner. |
| 10 | Patagonia Highlights (`ARCH31`) queda armado con sus paquetes intermedios y sus tramos de bus externos, sin transfer en las conexiones intermedias. | Leer `producto_componente` de `ARCH31` ordenado: alterna `paquete`/`tramo_bus`/`paquete`/`tramo_bus`/`paquete` (El Chaltén, bus, El Calafate, bus, Puerto Natales); los `transfer_in`/`transfer_out` de los componentes intermedios están en `false`. |

## 4. Qué queda afuera

- **Pantalla de Catálogo que muestra el tour armado** — es M1-06, esta spec solo deja los datos y
  los flags cargados en base.
- **El resto del catálogo de tours compuestos** (más allá de los 7 top-seller) — se carga en un
  milestone posterior, cuando la demanda real lo pida (plan M1 §2, `prd.md` §5).
- **Emisión o gestión de los tramos de bus externos** — la app solo los marca como tarea
  pendiente; emitirlos sigue siendo el sistema de emisión de pasajes de siempre (`prd.md` §5,
  `integraciones.md`).
- **Generar el pedido a proveedor de cada tramo de bus-servicio-de-paquete** — esa es la lógica de
  M3 (pedido automático); esta spec solo distingue qué tipo de tramo es cada uno y lo deja
  correctamente clasificado.
- **Resolución automática de tours "para revisar"** — es trabajo manual posterior (vía M1-06),
  esta spec solo detecta y marca, no decide.
- **Costos, márgenes o precios de los tours** — no se guardan (`modelo-de-datos.md`).

## 5. Reglas del proyecto que toca

- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#3** — la IA (Claude, vía `integraciones-ia.md`) entra solo como respaldo cuando las reglas
  simples no alcanzan para interpretar un tour o una ruta de bus; corre bajo el mismo techo de
  gasto mensual (US$ 20) que el resto del proyecto, chequeado antes de cada llamada.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):** 1) tests unitarios + linter sobre la lógica de
  armado de componentes (incluye el caso de la regla de transfer con y sin excepción IGR/IGU, el
  caso de distinguir tramo-de-paquete vs. tramo-externo, y el caso de "paquete faltante → para
  revisar") → 2) integración: correr el importador contra los datos reales de los 7 tours y
  verificar en base los `producto`, `producto_componente` y la fila de `importacion` → 3)
  recorrido completo: correr el importador dos veces seguidas y confirmar que la segunda no
  duplica nada, más una lectura de punta a punta de `CHB31` y `ARCH31` reproduciendo los casos de
  prueba #9 y #10. No se avanza a una capa con la anterior en rojo; si una falla: causa raíz →
  arreglo mínimo → re-correr.
- **Test primero:** escribir el test de la regla de transfer (puntas del tour vs. intermedio vs.
  excepción IGR/IGU), el de "tramo de bus dentro de un paquete no genera componente aparte" y el
  de "paquete faltante no inventa el componente" antes de implementar el armador, y verlos fallar
  por la razón correcta.
- **La regla de transfer, en detalle:** por defecto, solo el `transfer_in` del primer componente
  del tour completo y el `transfer_out` del último quedan en verdadero. Cualquier conexión
  intermedia resuelta con un tramo de bus lleva `transfer_in`/`transfer_out` en falso en esa
  punta — no tiene sentido un traslado a una terminal de bus. **Excepción:** si el destino de esa
  punta intermedia es **IGR** (Puerto Iguazú) o **IGU** (Foz do Iguaçu), el transfer se mantiene en
  verdadero igual, aunque el destino esté en el medio del tour (`modelo-de-datos.md`).
- **La distinción clave (tramo-de-paquete vs. tramo-externo):** un tramo de bus puede ser (a) un
  servicio dentro de un `producto_servicio` de un paquete ya cargado, con su propio Booking
  Supplier — ese SÍ genera pedido a proveedor por mail más adelante (M3), y en esta spec **no**
  se modela como `producto_componente` aparte, ya viaja dentro del paquete que lo contiene; o (b)
  un tramo de bus público externo entre dos paquetes distintos, que HI Travel emite en su propio
  sistema de emisión — ese **nunca** genera un mail a nadie, se modela como
  `producto_componente` `tipo = tramo_bus` sin proveedor, y en la reserva (M2/M3) queda como
  tarea pendiente ("emitir boleto: ruta, fecha"). Ver `modelo-de-datos.md` "Dos cosas que parecen
  lo mismo y no lo son" e `integraciones.md` "Tours compuestos: los tramos de bus público nunca
  son un efecto hacia afuera de la app".
- **Cuándo cae en "para revisar":** falta un `producto` componente que el tour necesita y todavía
  no está cargado en catálogo; la ruta de un tramo de bus no se puede determinar con confianza
  (ni por regla simple ni por IA); o no se puede establecer con confianza cuál es la primera y
  cuál la última punta del tour (regla de transfer ambigua). En cualquiera de estos casos, el tour
  completo (no solo el componente problemático) queda marcado "para revisar" en `importacion` y
  no se crea su `producto_componente` — nunca se arma con un componente inventado, vacío o a
  medias.
- **Entregables:** el importador y sus tests (ubicación sugerida, a confirmar contra la estructura
  real del proyecto: algo como `src/lib/importadores/tours-compuestos.ts` +
  `src/lib/importadores/tours-compuestos.test.ts`, más el script/route handler que lo dispara).
  Sin interfaz — no hay pantalla en esta spec (es M1-06).
- **Diseño y alcance no se deciden acá:** el modelo completo de `producto_componente` y la regla
  de transfer ya están fijados en `docs/arquitectura/modelo-de-datos.md`; el alcance de qué 7
  tours entran es del riesgo #6 de `docs/prd.md` y el plan de M1. Esta spec los traduce a datos
  cargados, no los rediseña.
