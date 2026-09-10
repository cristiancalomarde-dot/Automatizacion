# Recorrido del usuario — Reservas de Catálogo HI Travel

> **Dueño de:** el recorrido del operador por la app, pantalla por pantalla, con sus estados de
> carga/error/vacío y los casos de borde. **No decide** el cómo técnico (auth, ingesta de mail,
> motor de emparejado, envío): eso vive en los otros docs de `docs/arquitectura/` y está resuelto
> en **§10**. Traza a `docs/prd.md` §2 (el recorrido), §3 (milestones) y §4 (riesgos).

## 1. Usuarios y contexto de uso

- **Único tipo de usuario:** empleado de operaciones de HI Travel. ~12 personas, en oficinas de
  Brasil, Argentina, Uruguay, Chile y Bolivia. Herramienta **interna**: no hay usuarios finales,
  público, ni pantallas de cara a la agencia o al pasajero.
- **Todos hacen lo mismo:** cualquiera del equipo puede ver todas las reservas, corregir datos,
  aprobar el envío a proveedores y actualizar estados. Un solo rol, "operador" (ver
  [`auth-y-permisos.md`](auth-y-permisos.md)).
- **Cómo se usa:** sesiones cortas durante el día laboral, desde escritorio. Se entra varias veces
  por día a "ver qué llegó" y "mover lo que está trabado". Volumen: ~10-12 reservas nuevas por
  semana. La app nunca está saturada; el diseño prioriza claridad y velocidad de lectura.
- **Idioma de la interfaz:** español.

## 2. Mapa de pantallas

```
[Login]
   │
   ▼
[Bandeja de reservas]  ← pantalla de inicio; lista + filtros + vista tablero
   │
   ├─▶ [Detalle de reserva]
   │        ├─ datos extraídos + edición manual
   │        ├─ producto emparejado (o selector de catálogo si no matcheó)
   │        ├─ historial de la reserva (quién tocó qué y cuándo)
   │        └─▶ [Revisión y envío de pedidos a proveedores]   (aprobación, regla #4)
   │
   ├─▶ [Catálogo de productos]        (M1 — datos del sistema)
   │        └─▶ [Detalle de producto] → proveedores asociados
   │
   └─▶ [Directorio de proveedores]    (M1 — datos del sistema)
            └─▶ [Detalle de proveedor] → nombre, mail, datos de contacto
```

Navegación: barra lateral fija con **Reservas**, **Catálogo**, **Proveedores**. Encabezado con el
wordmark "HI Travel · Reservas de Catálogo", el nombre del usuario y salir. Una sola acción
principal por pantalla (ver [`marca.md`](marca.md) §5).

## 3. Estados de una reserva

Nombres fijos, usados igual en la UI, en [`marca.md`](marca.md) y en el modelo de datos. (Los
estados exactos del ciclo de vida quedan por afinar en M4 — `prd.md` §6.5.)

| Estado | Qué significa | Quién lo pone |
|---|---|---|
| **recibida** | El mail entró, se extrajeron los datos y el producto emparejó con confianza. Lista para armar los pedidos. | El sistema |
| **para revisión** | Algo necesita una persona: no se pudo leer el mail, el producto no emparejó, o hay sospecha de duplicada. | El sistema |
| **pedido a proveedor** | Los mails a los proveedores fueron aprobados y enviados. Esperando respuesta (que llega por fuera de la app). | Persona (al aprobar el envío) |
| **confirmada** | El/los proveedor(es) confirmaron todo lo pedido. | Persona |
| **con cambios** | El/los proveedor(es) confirmaron con diferencias (fechas, servicios, categoría). | Persona |
| **rechazada** | El/los proveedor(es) no pueden prestar el servicio. | Persona |
| **cerrada** | La gestión terminó; la reserva se archiva del trabajo diario. | Persona |
| **descartada** | El mail no era una reserva de catálogo (spam, consulta, paquete combinado). Archivada aparte. | Persona |

**Marcas (flags) que se apilan sobre el estado, no lo reemplazan:**
- `posible duplicada` — enlaza a la reserva original; se resuelve confirmando "es duplicada" (→
  descartada) o "es nueva" (se quita la marca).
- `pedido incompleto` — se enviaron los mails a los proveedores que tenían contacto, pero al menos
  uno quedó sin enviar por falta de mail. Visible hasta que se complete.

### Transiciones

| Desde | Evento | Hacia |
|---|---|---|
| (nueva) | Ingesta OK + extracción OK + producto emparejado con confianza | recibida |
| (nueva) | Falla de lectura / producto sin emparejar / sospecha de duplicada | para revisión |
| para revisión | La persona corrige datos, elige el producto a mano o descarta la sospecha de duplicada | recibida |
| para revisión | La persona marca "no es una reserva de catálogo" | descartada |
| para revisión | La persona confirma "es duplicada de #NNN" | descartada |
| recibida | La persona aprueba y envía los pedidos a proveedores | pedido a proveedor |
| pedido a proveedor | La persona registra: todo confirmado | confirmada |
| pedido a proveedor | La persona registra: confirmado con diferencias | con cambios |
| pedido a proveedor | La persona registra: no disponible | rechazada |
| confirmada / con cambios / rechazada | La persona da por terminada la gestión | cerrada |
| cerrada / descartada | La persona reabre con un motivo obligatorio | recibida o para revisión (la persona elige) |
| pedido a proveedor | La persona necesita reenviar o corregir un pedido | vuelve a la pantalla de revisión y envío; el estado no cambia hasta reenviar |

## 4. Recorrido principal (camino feliz — `prd.md` §2)

1. **Llega un mail** de una agencia piloto a la casilla dedicada. Sin que nadie haga nada, aparece
   una fila nueva en la **Bandeja** con estado `recibida` (o `procesando…` mientras la extracción
   corre — ver §7).
2. El operador abre el **Detalle de la reserva**. Ve los datos extraídos —agencia, producto,
   código de producto, fechas, pax, ciudades, habitación/categoría, pedidos especiales— y el
   **producto de catálogo emparejado** con sus proveedores.
3. Revisa de un vistazo contra el mail original (visible en un panel lateral). Corrige a mano lo
   que haga falta (cada campo es editable). Guarda.
4. Toca **"Armar pedidos a proveedores"**. Pasa a la pantalla de **Revisión y envío**: un borrador
   de mail por cada proveedor del producto (1 a 4), con las fechas y los servicios ya volcados.
   Edita el texto si quiere.
5. Toca **"Enviar N pedidos"** y **confirma en un diálogo** (aprobación humana explícita, regla
   #4). Los mails salen. La reserva pasa a `pedido a proveedor`, con registro de a qué proveedores
   se escribió y cuándo.
6. La reserva queda visible para todo el equipo en la Bandeja / tablero.
7. Días después, un proveedor responde **por fuera de la app** (a la casilla o al mail de quien
   escribió). El operador abre el Detalle y toca **"Registrar respuesta del proveedor"**: elige
   `confirmada` / `con cambios` / `rechazada`, escribe una nota corta y, si aplica, ajusta
   fechas/servicios.
8. Cuando no queda nada por hacer, toca **"Cerrar reserva"** → `cerrada`.

## 5. Pantalla por pantalla

### 5.1 Login

- **Qué hace:** una sola pantalla, "Ingresar con Google". Sin registro abierto, sin "olvidé mi
  contraseña".
- **Estados:** normal · ingresando (botón deshabilitado) · error ("No pudimos ingresar. Probá de
  nuevo." / "Esta cuenta no pertenece a HI Travel.").
- **Después de entrar:** siempre a la Bandeja.

### 5.2 Bandeja de reservas (pantalla de inicio)

- **Qué muestra:** tabla densa, una fila por reserva, ordenada por llegada más reciente arriba.
  Columnas: estado (chip de color, ver `marca.md` §3) · agencia · producto (o "— sin emparejar
  —") · código · fechas (rango DD/MM/AAAA) · pax · proveedores contactados (ej. "2/3") · última
  actualización · quién la tocó último. Fila con marca `para revisión` o `posible duplicada` lleva
  un indicador a la izquierda (franja + ícono), no solo color.
- **Filtros:** por estado (multi-selección con contadores) · por agencia · por rango de fechas del
  viaje · buscador de texto libre (código, producto, agencia). Los filtros se reflejan en la URL
  para poder compartir una vista.
- **Vista tablero:** conmutador **Lista / Tablero** en la barra superior. El tablero muestra
  columnas por estado con tarjetas compactas. Es solo lectura + navegación: el estado se cambia
  desde el Detalle (evita cambios accidentales). Si en construcción resulta caro, el tablero puede
  quedar para después de M4 sin romper el recorrido del PRD.
- **Acción principal:** ninguna de creación (las reservas entran solas). Un botón secundario
  **"Cargar reserva a mano"** cubre el caso de una reserva que hay que ingresar manualmente (§6.a).
- **Estados de la pantalla:** ver §7.

### 5.3 Detalle de una reserva

Tres zonas:

1. **Encabezado:** estado (chip grande) + flags · agencia · código de producto · acción principal
   contextual según el estado:
   - `para revisión` → **"Resolver revisión"** (ancla al motivo).
   - `recibida` → **"Armar pedidos a proveedores"**.
   - `pedido a proveedor` → **"Registrar respuesta del proveedor"**.
   - `confirmada` / `con cambios` / `rechazada` → **"Cerrar reserva"**.
   - Acciones secundarias en un menú: reprocesar el mail, marcar como duplicada, descartar,
     reabrir.
2. **Datos de la reserva (editable):** producto y código · fechas de entrada/salida · pax ·
   ciudades · habitación/categoría · pedidos especiales · observaciones. Cada campo editable en
   línea; un campo corregido a mano queda marcado "editado" y se ve en el historial.
   - **Producto emparejado:** si emparejó, muestra nombre del catálogo, código y proveedores
     asociados. Botón "Cambiar producto" abre el buscador de catálogo. Si **no** emparejó, un
     aviso ámbar + buscador de catálogo obligatorio + opción "No es una reserva de catálogo".
3. **Mail original + historial (panel lateral):**
   - Pestaña **Mail**: remitente, asunto, fecha, cuerpo tal cual llegó. Texto seleccionable.
     Botón "Reprocesar extracción".
   - Pestaña **Historial**: línea de tiempo con cada cambio de estado, cada edición de campo y
     cada envío a proveedor, con autor y hora local. Es el "registro central" del `prd.md` §1.

- **Concurrencia:** si otra persona editó la reserva mientras esta la tenía abierta, al guardar
  aparece "Otra persona actualizó esta reserva. Mirá los cambios antes de guardar."

### 5.4 Revisión y envío de pedidos a proveedores

- **Cómo se llega:** desde el Detalle de una reserva `recibida` con producto emparejado.
- **Qué muestra:** una tarjeta por proveedor del producto (1 a 4). Cada tarjeta: nombre del
  proveedor · mail destino · asunto propuesto · cuerpo propuesto con fechas, pax y servicios ya
  volcados · editor de texto · conmutador "Incluir este pedido" (por defecto sí).
- **Aprobación (regla #4):** el botón dice **"Enviar N pedidos"** y abre un diálogo de
  confirmación que lista a quién se le va a escribir. Nada sale sin ese OK explícito.
- **Falta el mail de un proveedor:** esa tarjeta aparece deshabilitada, con aviso ámbar y enlace
  "Completar en el directorio". El botón pasa a **"Enviar N pedidos (1 queda pendiente)"**; al
  enviar, la reserva pasa a `pedido a proveedor` con flag `pedido incompleto`.
- **Después de enviar:** resultado por proveedor (enviado ✓ / falló ✗ con "Reintentar"). Vuelve al
  Detalle con el estado actualizado.
- **Volver atrás no pierde nada:** los textos editados quedan guardados como borrador en la
  reserva.

### 5.5 Catálogo de productos (M1)

- **Qué muestra:** tabla de productos: código · nombre · ciudad(es) · cantidad de proveedores
  asociados · última edición. Buscador por código y nombre.
- **Detalle de producto:** datos + lista de proveedores asociados con "Agregar proveedor" /
  "Quitar". Sin proveedores → aviso ámbar "no se le podrán armar pedidos".
- **Carga inicial:** la hace el **importador** que lee tus Excel (ver [`integraciones.md`](integraciones.md)).
  Esta pantalla permite además el ABM manual y resolver lo que el importador dejó "para revisar".
- **Vacío total:** ver §7 — bloquea el emparejado de M2, el mensaje lo dice explícito.

### 5.6 Directorio de proveedores (M1)

- **Qué muestra:** tabla de proveedores: nombre · mail de contacto · teléfono/otros datos ·
  productos en los que aparece · "sin mail" resaltado.
- **Detalle de proveedor:** edición de nombre, mail y datos de contacto. El mail es el dato
  crítico: sin él, los pedidos de M3 a ese proveedor no salen (`prd.md` §4 riesgo 3).
- **Filtro rápido:** "Proveedores sin mail" — es la lista de trabajo para dejar M1 cerrado.

## 6. Casos de borde

### a. El mail no se puede leer / la extracción falla

- La reserva entra igual y queda en **`para revisión`** con motivo **"No se pudo leer el mail"**
  (nunca se descarta silenciosamente).
- El Detalle muestra el mail crudo completo y **todos los campos vacíos y editables** para carga
  manual. Botón "Reprocesar extracción" por si fue un fallo transitorio.
- El operador completa a mano, elige el producto y guarda → `recibida` y sigue el recorrido
  normal.
- **"Cargar reserva a mano"** desde la Bandeja usa la misma pantalla vacía, para cuando el mail ni
  llegó al sistema.

### b. El producto no matchea contra el catálogo

- Reserva en **`para revisión`**, motivo **"Producto sin emparejar"** (`prd.md` §3 M2: "en vez de
  adivinar").
- El Detalle obliga a elegir un producto del catálogo, o a marcar **"No es una reserva de
  catálogo"** → `descartada` con motivo.
- Al elegir el producto a mano, se registra en el historial (alimenta la métrica del riesgo 1 de
  `prd.md` §4). El sistema **no** aprende solo del cambio en el MVP.
- Si el producto **falta en el catálogo**: enlace "Agregar al catálogo"; la reserva queda en `para
  revisión` hasta que exista.

### c. Falta el mail de un proveedor

- Cubierto en §5.4: tarjeta deshabilitada, envío parcial permitido, flag `pedido incompleto`,
  recordatorio persistente en el Detalle y en la Bandeja (columna "proveedores contactados" ej.
  "2/3").
- Resolución: completar el mail en el Directorio (5.6) → volver a la reserva → "Enviar pedido
  pendiente" → se quita el flag.

### d. Reserva duplicada

- Al ingresar, el sistema compara contra reservas de los últimos ~60 días por remitente + código
  de producto + fechas + pax.
- Coincidencia fuerte: la nueva entra en **`para revisión`** con flag **`posible duplicada`** y un
  enlace "Posible duplicada de #NNN" que abre las dos en paralelo.
- El operador decide: **"Es duplicada"** → `descartada`, enlazada a la original; o **"Es una
  reserva nueva"** → se quita el flag.
- Aunque la coincidencia sea total, **nunca** se descarta sola: siempre pasa por una persona.

### e. Un mail que no es una reserva

- Consulta, respuesta de proveedor mal dirigida, spam. Entra como `para revisión`; el operador la
  marca **"No es una reserva de catálogo"** → `descartada`. Consultables con un filtro.

### f. La agencia cambió su formato de mail

- Se ve como un pico de reservas en `para revisión` de una misma agencia. Se trata como bug de la
  lectura de esa agencia (`prd.md` §4 riesgo 5). La UI solo lo hace **visible** (filtro por
  agencia + por motivo).

### g. Reserva que en realidad es un paquete / tour combinado

- Fuera de alcance del MVP (`prd.md` §5 y §6.4). Si aparece: el operador la marca `descartada` con
  motivo "Paquete combinado — fuera de MVP".

## 7. Estados de carga / error / vacío de los momentos críticos

| Momento | Cargando | Error | Vacío |
|---|---|---|---|
| **Bandeja al abrir** | Esqueleto de tabla (filas grises), no spinner a pantalla completa | "No pudimos cargar las reservas. Reintentar." | **Primera vez:** "Todavía no entró ninguna reserva. Cuando llegue un mail a la casilla, va a aparecer acá." · **Por filtro:** "Ninguna reserva coincide con estos filtros." + "Limpiar filtros" |
| **Reserva recién ingresada, extracción en curso** | Fila visible con estado `procesando…` y los campos que ya se tienen; nunca una fila en blanco | Si la extracción falla, la fila pasa sola a `para revisión` con el motivo | — |
| **Detalle de una reserva** | Esqueleto de las tres zonas | "No pudimos abrir esta reserva. Reintentar / Volver a la bandeja" | No aplica |
| **Reprocesar extracción** | "Procesando el mail…" con los valores actuales atenuados | "No se pudo reprocesar. Los datos anteriores siguen como estaban." | — |
| **Armar pedidos a proveedores** | "Preparando los borradores…" | "No se pudieron armar los borradores. Reintentar." — no cambia el estado | Si el producto no tiene proveedores: "Este producto no tiene proveedores asociados. Agregalos en el catálogo." |
| **Enviar N pedidos** | Botón "Enviando…" deshabilitado; progreso por tarjeta | Resultado por proveedor: enviado ✓ / falló ✗ + "Reintentar". Si fallan todos, la reserva no pasa a `pedido a proveedor` | — |
| **Registrar respuesta del proveedor** | Guardado inmediato con confirmación breve | "No se pudo guardar. Probá de nuevo." — el formulario conserva lo escrito | — |
| **Catálogo de productos** | Esqueleto de tabla | "No pudimos cargar el catálogo. Reintentar." | "El catálogo está vacío. Sin productos cargados, las reservas no se pueden emparejar (M1)." + "Cargar productos" |
| **Directorio de proveedores** | Esqueleto de tabla | "No pudimos cargar el directorio. Reintentar." | "No hay proveedores cargados. Se necesitan para poder mandarles los pedidos." + "Agregar proveedor" |
| **Sesión vencida** | — | "Tu sesión venció. Volvé a ingresar. Lo que estabas cargando se conserva." | — |

Principios: nunca una pantalla en blanco durante la espera; los errores dicen **qué pasó y qué
hacer**; salir de un formulario a medio llenar y volver **no pierde lo cargado**.

## 8. Puntos de decisión (resumen)

| # | Pregunta | Quién / cómo | Resultado |
|---|---|---|---|
| 1 | ¿La extracción del mail salió bien? | Sistema | OK → (2) · Falla → `para revisión` |
| 2 | ¿El producto emparejó con confianza? | Sistema (umbral en `integraciones-ia.md`) | Sí → `recibida` · No → `para revisión` |
| 3 | ¿Parece duplicada de una existente? | Sistema + persona | Sí+persona confirma → `descartada` · No → sigue |
| 4 | ¿Los datos extraídos están bien? | Persona (Detalle) | Corrige y guarda |
| 5 | ¿Todos los proveedores tienen mail? | Sistema (pantalla de envío) | Sí → envío completo · No → parcial + flag |
| 6 | ¿Aprobar el envío de los pedidos? | Persona (diálogo, regla #4) | Sí → mails salen, `pedido a proveedor` · No → borrador |
| 7 | ¿Qué respondió el proveedor? | Persona | `confirmada` / `con cambios` / `rechazada` |
| 8 | ¿Terminó la gestión? | Persona | Sí → `cerrada` |

## 9. Supuestos a validar

1. **Un solo rol.** Los 12 ven y editan todo (ver `auth-y-permisos.md`).
2. **Interfaz solo en español.** La oficina de Brasil trabaja igual en español para el MVP.
3. **El operador trabaja desde escritorio.** No se diseña para móvil en el MVP.
4. **Las respuestas de los proveedores llegan por fuera** y una persona las vuelca a mano
   (confirmado por `prd.md` §5).
5. **La confirmación/rechazo a la agencia cliente la sigue mandando una persona por fuera**
   (`prd.md` §5).
6. **Un mail = una reserva = un producto de catálogo.** Los combinados se descartan en el MVP.
7. **El mail original se puede mostrar dentro de la app.**
8. **El tablero por estado (§5.2) es deseable pero no obligatorio** para cumplir M4.

## 10. Decisiones técnicas (ya tomadas — detalle en su doc)

- **Ingesta del mail:** casilla de Gmail dedicada, leída por la app cada ~5 min vía Gmail API.
  Los mails a proveedores salen de esa misma casilla, con aprobación por reserva. →
  [`integraciones.md`](integraciones.md).
- **Motor de emparejado producto↔catálogo:** primero por el código del mail contra la tabla de
  códigos; la IA solo entra si el código falta o no matchea; confianza baja → `para revisión`.
  Umbral conservador ajustable con las piloto. → [`integraciones-ia.md`](integraciones-ia.md).
- **Envío a proveedores:** **con aprobación humana explícita** por reserva (regla #4). La
  automatización queda para evaluación futura. → [`integraciones.md`](integraciones.md).
- **Autenticación:** "Ingresar con Google" restringido al dominio de la empresa, rol único
  "operador". → [`auth-y-permisos.md`](auth-y-permisos.md).
- **Detección de duplicados:** remitente + código de producto + fechas + pax, ventana ~60 días,
  siempre resuelta por una persona. Umbral fino se ajusta al construir.
- **Concurrencia:** aviso de conflicto al guardar ("mirá los cambios antes de guardar"); no se
  pisan cambios en silencio.
- **Persistencia de borradores** (textos de pedidos a medio editar): en la propia reserva, sin
  expiración en el MVP.
- **Zona horaria:** el backend guarda en UTC; la interfaz muestra hora local del usuario.
- **Idioma de los mails a proveedores:** español; portugués para proveedores de Brasil. Plantillas
  en M3.

## Abierto

- **Notificaciones** (avisar al equipo cuando entra una reserva o algo cae en `para revisión`):
  posiblemente fuera de alcance del MVP; se decide en el roadmap.
- Nombres exactos de los estados intermedios — se afinan en M4 (`prd.md` §6.5).
