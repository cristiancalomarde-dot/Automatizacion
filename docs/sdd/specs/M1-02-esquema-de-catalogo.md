# M1-02 · Esquema de datos del catálogo

**Depende de:** M1-01 (necesita el proyecto Supabase ya creado y conectado a la app).

## 1. Qué queremos lograr

Que la base de datos de Supabase tenga las tablas del catálogo —productos, sus servicios, sus
proveedores, sus códigos externos, los tours compuestos y el registro de importaciones— con las
relaciones y tipos que define `modelo-de-datos.md`, con RLS activada y las migraciones versionadas
en el repo. Al terminar, se puede insertar a mano (o por script) un producto con sus servicios y
proveedores, y un tour compuesto que encadena productos + un tramo de bus externo, y leerlos de
vuelta en orden.

## 2. Qué hay hoy

M1-01 dejó un proyecto Supabase vacío conectado a la app, con auth (login Google) funcionando y
sin tablas propias del negocio. Esta spec agrega el esquema del catálogo sobre esa base.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Migración versionada crea `proveedor`: nombre, `nombre_normalizado`, mail(s), teléfono, país/ciudad, aclaraciones, `canal` (enum `mail` \| `whatsapp`), `created_at`/`updated_at`. | La migración corre limpia sobre una base vacía (`supabase db reset` o equivalente); `\d proveedor` muestra las columnas y el enum `canal` con sus dos valores. |
| 2 | Migración crea `producto`: código(s), nombre, ciudad(es), destino, `created_at`/`updated_at`. Sin columnas de precio/costo/margen (ver `modelo-de-datos.md` "Qué NO se guarda"). | `\d producto` no tiene ninguna columna de precio/costo/margen; insertar un producto de prueba funciona. |
| 3 | Migración crea `producto_servicio`: `producto_id` (FK → producto), tipo de servicio (alojamiento/excursión/traslado/bus/crucero…), `service_provider_id` (FK → proveedor), `booking_supplier_id` (FK → proveedor, nullable), `prioridad` (para alternativas separadas por "/"). | Insertar dos `producto_servicio` para el mismo producto con `prioridad` 1 y 2 (dos proveedores alternativos) y leerlos ordenados por prioridad. |
| 4 | Migración crea `codigo_externo`: `producto_id` (FK → producto), agencia/partner (ej. Kilroy, TourRadar), código externo. Un mismo producto puede tener varios códigos (de distintas agencias). | Insertar dos `codigo_externo` para el mismo producto con distinta agencia; una consulta por (agencia, código) devuelve el producto correcto. |
| 5 | Migración crea `producto_componente`: `producto_id` (el tour compuesto, FK → producto), `orden`, `tipo` (`paquete` \| `tramo_bus`), `componente_producto_id` (FK → producto, obligatorio si `tipo = paquete`, `null` si `tramo_bus`), descripción de ruta (obligatoria si `tipo = tramo_bus`, `null` si `paquete`), `transfer_in` y `transfer_out` (booleanos, marcan si ese componente puntual lleva el transfer de entrada/salida en este tour — ver la regla de negocio de `modelo-de-datos.md`). Un `check` de base impide que un componente `paquete` deje `componente_producto_id` vacío, o que un `tramo_bus` deje la descripción vacía. | Insertar un componente `tipo = paquete` sin `componente_producto_id` falla (constraint); insertar uno `tipo = tramo_bus` con `componente_producto_id` no nulo falla. |
| 6 | Migración crea `importacion`: archivo, fecha, tipo de corrida, filas cargadas, filas "para revisar", detalle. | Insertar una fila de importación y leerla de vuelta con todos sus campos. |
| 7 | RLS activada en las 6 tablas, policy única: `authenticated` puede `select`/`insert`/`update`; no existe policy de `delete` (los borrados no existen en el modelo). | Con la service role o el panel de Supabase, confirmar que las 6 tablas tienen RLS `enabled` y que no hay ninguna policy con `cmd = DELETE`. |
| 8 | Un test de integración inserta un `producto`, sus `producto_servicio` (con `service_provider_id`/`booking_supplier_id` apuntando a `proveedor`) y lee la cadena completa producto → servicios → proveedores en una sola consulta. | El test pasa: la fila devuelta trae el nombre del producto, sus servicios y el nombre/canal de cada proveedor asociado. |
| 9 | Un test de integración arma un tour: un `producto` "tour compuesto" con `producto_componente` que encadena dos productos existentes (paquetes) + un tramo de bus externo, y lo lee ordenado por `orden`. | El test pasa: la lista devuelta respeta el `orden` y distingue los componentes `paquete` (con su producto) del `tramo_bus` (con su descripción, sin proveedor). |
| 10 | **Qué NO debe pasar:** un cliente autenticado con la clave anónima pero sin sesión (no autenticado) no puede leer ni insertar en ninguna de las 6 tablas. | Un test hace `select` e `insert` contra cada tabla con el cliente Supabase sin sesión (rol `anon`); las 6 lecturas y las 6 escrituras son rechazadas por RLS (error o 0 filas, nunca datos ni éxito). |

## 4. Qué queda afuera

- **Las tablas de reserva** (`reserva`, `reserva_pedido`, `evento_reserva`) — no se crean en esta
  spec. Son de M2/M3/M4 y se agregan cuando se planifiquen esos milestones.
- **La tabla `usuario`** — se apoya enteramente en Supabase Auth (ya resuelto en M1-01); esta spec
  no agrega una tabla de perfiles propia.
- **Cargar datos reales** — esta spec solo crea el esquema vacío. Los importadores que leen los
  Excel y cargan proveedores/productos/tours son M1-03, M1-04 y M1-05.
- **Aplicar la lógica completa de la regla de transfer** (qué componente lleva `transfer_in`/
  `transfer_out` según sea IGR/IGU o punta del tour) — esta spec solo deja las columnas para
  registrar el resultado; quién decide esos valores al armar cada tour es el importador de
  M1-05.
- **Pantallas** — esta pieza no tiene interfaz, es solo el esquema de datos.

## 5. Reglas del proyecto que toca

- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — se crean las tablas del catálogo con RLS activada; no aplica en sentido estricto
  (datos compartidos por todo el equipo, sin aislamiento por usuario) pero la policy
  `authenticated`-only se deja activa igual, como defensa en profundidad (ver
  `modelo-de-datos.md`).
- **#2** — la migración no contiene ninguna credencial; la conexión a Supabase para correrla usa
  las variables de entorno ya cargadas en M1-01 (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), ver
  `secretos.md`.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. Unitarias + linter: la migración SQL corre sin errores sobre una base vacía; lint del código
     de test.
  2. Integración: los tests de la tabla §3 (#8, #9, #10) contra un proyecto Supabase real (o el
     emulador local `supabase start`) — incluye la prueba de "qué NO debe pasar" (#10).
  3. Recorrido completo: como la pieza no tiene UI, el recorrido de punta a punta es el mismo
     script/test que encadena creación de producto → servicios → proveedores → tour compuesto →
     lectura completa, corrido una vez de punta a punta contra la base real del proyecto.
  No se avanza a una capa con la anterior en rojo; si algo falla: causa raíz → arreglo mínimo →
  re-correr.
- **Test primero:** escribir los tests de integración (#8, #9, #10) antes de escribir la
  migración, verlos fallar (tablas inexistentes) por la razón correcta, y recién ahí escribir el
  SQL.
- **Migraciones:** usar el mecanismo estándar de Supabase (`supabase/migrations/*.sql`, CLI de
  Supabase). Nada se crea o cambia a mano desde el panel de Supabase — todo cambio de esquema es
  un archivo de migración commiteado.
- **Tipos:** Postgres nativo. Claves primarias `uuid` (`gen_random_uuid()`). `created_at`/
  `updated_at` en todas las tablas, `timestamptz`, UTC. `proveedor.canal` y `producto_componente.tipo`
  como `enum` de Postgres (no texto libre).
- **Entregables:** los archivos de migración en `supabase/migrations/`, los tests de integración
  (ubicación según el setup de test que dejó M1-01), y confirmación de que corrieron contra el
  proyecto Supabase real del equipo (no solo local).
- **Diseño y alcance no se deciden acá:** el modelo completo ya está fijado en
  `docs/arquitectura/modelo-de-datos.md`; esta spec lo traduce a migraciones, no lo rediseña.
