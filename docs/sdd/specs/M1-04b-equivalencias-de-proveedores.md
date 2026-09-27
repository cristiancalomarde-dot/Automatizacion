# M1-04b · Equivalencias de proveedores + niveles confirmados (Iguazú)

**Depende de:** M1-04 (los 5 productos de Iguazú ya están cargados, pero sus 29 filas de servicio
quedaron con el proveedor sin resolver).

## 1. Qué queremos lograr

Que cada servicio de los 5 productos de Iguazú sepa **a quién se le pide la reserva** (Booking
Supplier), y por lo tanto a qué mail escribir. Para eso, una lista de equivalencias entre los
nombres del Excel de paquetes y el directorio de proveedores, que el owner ya revisó. La misma
lista se reusa en M1-05. De paso, se cargan los niveles de alojamiento que el owner confirmó para
las líneas del Excel que no los escriben.

## 2. Qué hay hoy

- **M1-04:** en `producto_servicio`, `service_provider_nombre` y `booking_supplier_nombre` guardan
  el texto del Excel tal cual, con el flag `proveedor_sin_resolver`. Solo empareja cuando el
  nombre coincide exacto con `proveedor.nombre_normalizado`, así que las 29 filas quedaron sin
  resolver.
- **Lista de equivalencias:** `data/equivalencias-proveedores.csv`, revisada con el owner el
  2026-09-27. Columnas: `nombre_en_excel`, `proveedor_en_directorio` (el `proveedor.nombre` tal
  cual está en la base), `estado` (`confirmado` | `para_revisar`) y `nota`.
- **Niveles confirmados** (`DECISIONS.md`, 2026-09-27):
  - OD010B: "Taroba Hotel 3* sup/4" es Hotel 4*.
  - OD010C y OD010D: Hostel = Beer + Bambu; Hotel 3* = El Pueblito + Nacional Inn; Hotel 4* =
    La Aldea + Taroba.
  - OD010B "Dann Inn Foz" sigue sin nivel confirmado (¿Hotel 3* o Budget Hotel?) y queda para
    revisar.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Guarda las equivalencias en la base: tabla `proveedor_alias`, con alias normalizado, `proveedor_id` (null si no hay proveedor), estado y nota. Se cargan desde el CSV, con RLS activa (#1). Cargarlas dos veces no duplica filas. | Después de cargar: 15 alias. Todos los que tienen `proveedor_en_directorio` apuntan a un `proveedor` existente. Una segunda carga deja 15. |
| 2 | Si una fila del CSV nombra un proveedor que no existe en el directorio, la carga falla con un mensaje claro. No crea el proveedor ni lo ignora en silencio. | Test con un CSV de prueba que nombra un proveedor inexistente: error explícito y 0 filas nuevas en `proveedor`. |
| 3 | Al emparejar el Service Provider o el Booking Supplier, el importador de productos busca primero el nombre exacto (como hoy) y después en `proveedor_alias`. | Con el CSV real cargado, "Cuenca del Plana" (typo) queda emparejado con Cuenca Del Plata (Natalia ). |
| 4 | Un alias `confirmado` resuelve el proveedor. Un alias `para_revisar` también lo asigna si trae proveedor, pero el servicio queda con el flag de revisión y la nota visible. Un alias sin proveedor deja el servicio sin resolver. | Beer queda asignado a Tangoinn **y** marcado para revisar. Tetris queda sin resolver, con su nota. |
| 5 | Aplica los niveles confirmados a las líneas sin etiqueta de OD010B, OD010C y OD010D (ver §2). Dann Inn Foz queda para revisar. | OD010C y OD010D tienen los 3 niveles (Hostel, Hotel 3*, Hotel 4*), cada uno con sus 2 alojamientos. En OD010B, Taroba queda en Hotel 4*. |
| 6 | Vuelve a correr el importador de productos sobre la base real. | Todos los Booking Suppliers de las 29 filas quedan resueltos, salvo Tetris (y Beer, resuelto pero marcado). La fila de `importacion` lo refleja. |
| 7 | Re-correr no duplica nada ni pisa un proveedor resuelto a mano (se mantiene lo de M1-04). | Dos corridas seguidas dejan los mismos conteos. |

## 5. Qué queda afuera

- **Emparejar por parecido (fuzzy) o con IA:** las equivalencias las decide el owner, no el
  sistema.
- **Pantalla para editar alias:** va con M1-06, si hace falta.
- **Emparejar Service Providers que se reservan por otro** (El Pueblito, Botánica, La Aldea,
  Glamping y Paquete 105, todos por Cuenca del Plata): no hacen falta para escribir el pedido,
  porque el mail va al Booking Supplier. Si el Service Provider no tiene alias, se queda con su
  nombre de texto; eso no bloquea ni marca revisión cuando el Booking Supplier está resuelto.
- Confirmar Beer, Tetris y el nivel de Dann Inn: lo hace el owner con operaciones. Cuando lo
  confirme, se actualiza el CSV y se re-corre.

## 6. Reglas del proyecto que toca

- **#1:** la tabla nueva lleva RLS.
- **#5:** terminada = las 3 verificaciones en verde.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (#5):**
  1. Unitarios + linter: normalización del alias, prioridad exacto → alias, los 3 estados, nivel
     confirmado.
  2. Integración contra la base real: carga del CSV (idempotente, y el error si el proveedor no
     existe) y re-corrida del importador.
  3. Recorrido completo: para cada uno de los 5 productos, listar servicio → nivel → opción →
     Booking Supplier → mail, y comprobar que solo Tetris queda sin mail.
- **Test primero:** "typo 'Cuenca del Plana' se resuelve por alias" y "alias para_revisar asigna
  el proveedor pero deja el flag".
- **Niveles confirmados:** representarlos como datos, no como condiciones en el código (p. ej.
  `data/niveles-confirmados.csv` con producto + texto de la línea + nivel), para que M1-05 pueda
  sumar los suyos.
- Migración nueva con el pooler, igual que 0003/0004.
