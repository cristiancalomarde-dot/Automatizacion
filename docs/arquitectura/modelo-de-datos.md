# Modelo de datos — qué información existe y dónde vive

> **Dueño de:** qué datos guarda la app, cómo se relacionan, y la **regla #1** (aislamiento entre
> usuarios). **No cubre:** de dónde salen los datos del catálogo (→ [`integraciones.md`](integraciones.md),
> el importador) ni las claves (→ [`secretos.md`](secretos.md)).

## Regla #1 — aislamiento entre usuarios: no aplica en el sentido habitual

Esta es una herramienta **interna y compartida**. Los ~12 usuarios son todos del equipo de HI
Travel y **todos ven y editan las mismas reservas, el mismo catálogo y los mismos proveedores**.
No hay datos privados de un usuario que otro no pueda ver.

Lo que sí se guarda es **quién hizo cada cosa**: cada cambio de estado, cada edición de un campo y
cada envío a un proveedor queda registrado con autor y fecha (es el "registro central" que promete
el PRD §1). Eso es trazabilidad, no aislamiento.

Igual se deja la seguridad a nivel base de datos (RLS de Supabase) activada, con una regla simple:
"solo usuarios autenticados del equipo pueden leer y escribir". Es defensa en profundidad, no
separación por usuario.

## Las tablas (qué es cada cosa)

- **producto** — un producto de catálogo. Código(s), nombre, ciudad(es), destino. Origen: el
  importador que lee tus Excel.
- **proveedor** — una empresa que presta o factura un servicio. Nombre (normalizado), mail(s) de
  contacto, teléfono, país/ciudad, aclaraciones, y **canal de contacto** (`mail` | `whatsapp` —
  algunos transferistas solo se manejan por WhatsApp). El MVP solo automatiza el canal `mail`; un
  proveedor `whatsapp` nunca recibe un pedido automático, siempre queda como tarea manual (ver
  [`integraciones.md`](integraciones.md)). Origen: el importador (hoja de contactos) + correcciones
  a mano.
- **producto_servicio** — un servicio dentro de un producto (alojamiento, excursión, traslado,
  bus, crucero…), con su **Service Provider** y su **Booking Supplier**, y la prioridad si hay
  varias opciones separadas por "/". Es lo que decide a qué proveedores se les escribe.
- **codigo_externo** — mapea un código de una agencia/partner (Kilroy, TourRadar, etc.) al código
  interno de HI Travel. El mail de reserva trae uno de estos; acá se traduce.
- **producto_componente** — solo para **tours compuestos** (ej. Patagonia Highlights, Overland San
  Pedro–Uyuni): la secuencia ordenada de lo que arma el tour. Cada fila es, en orden, o bien otro
  **producto** de catálogo (un paquete, con sus propios `producto_servicio` y proveedores), o bien
  un **tramo de bus público externo** (una ruta + fecha que HI Travel emite en su propio sistema
  de emisión, fuera de esta app). Ver la distinción con el bus de `producto_servicio` más abajo.
- **reserva** — una reserva recibida por mail. Agencia, remitente, mail original, **booking_id de
  la agencia** (el identificador que trae en el asunto, ej. `DK1531608` — es la clave que evita
  duplicar por los ida y vuelta del mail, ver más abajo), producto emparejado, fechas, pax,
  ciudades, habitación/categoría, **datos de vuelo** (número, aerolínea, horario de
  llegada/salida — obligatorios si el producto incluye un traslado; si faltan, la reserva va a
  `para_revision`), pedidos especiales, estado, flags (posible duplicada, pedido incompleto).
- **reserva_pedido** — un pedido a un proveedor para una reserva. Proveedor, mail enviado (asunto
  + cuerpo), cuándo se envió, quién lo aprobó, resultado.
- **evento_reserva** — el historial: cada cambio de estado, edición de campo y envío, con autor y
  fecha.
- **importacion** — cada corrida del importador: qué archivo, cuándo, qué se cargó, qué quedó
  "para revisar".
- **usuario** — se apoya en Supabase Auth (identidad Google). Rol único en el MVP: "operador".

## Cómo se relacionan (resumen)

- un **producto** tiene muchos **producto_servicio**; cada uno apunta a uno o dos **proveedor**
  (service + booking).
- un **producto** tiene muchos **codigo_externo**.
- un **producto** (cuando es un tour compuesto) tiene muchos **producto_componente**, en orden;
  cada componente o bien apunta a **otro producto** (un paquete), o bien describe un tramo de bus
  externo (ruta, sin proveedor).
- una **reserva** apunta a un **producto** (cuando emparejó) y tiene muchos **reserva_pedido** y
  muchos **evento_reserva**. Si el producto es un tour compuesto, la reserva también tiene un
  **estado por componente** (qué paquete está en qué estado, qué tramo de bus está emitido o
  pendiente).
- un **reserva_pedido** apunta a un **proveedor**.

### Una regla de negocio que hay que aplicar al armar cada componente

Un paquete vendido **solo** suele llevar transfer de entrada y de salida (aeropuerto). Pero en un
**tour compuesto** eso no se hereda tal cual — solo llevan transfer las dos puntas del tour
completo:

- el **transfer IN del primer destino** del tour (donde sea que arranque: RIO, BUE, LPB, CJC…), y
- el **transfer OUT del último destino** del tour (simétrico al de entrada).

**Todo lo que queda en el medio** — cualquier conexión entre componentes resuelta con un bus
intermedio — **no lleva transfer**: no tiene sentido un traslado a una terminal de bus.

**Excepción:** en **IGR** (Puerto Iguazú) e **IGU** (Foz do Iguaçu) el transfer a la terminal de
bus **sí se mantiene**, aunque ese destino esté en el medio del tour.

Por eso `producto_componente` no reusa ciegamente los servicios de transfer del paquete: cada
componente marca si su transfer de entrada y/o de salida aplican en ese tour puntual (por defecto
solo la primera entrada y la última salida del tour completo, con la excepción de IGR/IGU).

### Dos cosas que parecen lo mismo y no lo son

- **Un servicio "Bus" dentro de `producto_servicio`** (ej. el traslado Uyuni→La Paz que da el
  mismo proveedor boliviano del Overland) **sí** genera un pedido a proveedor por mail, como
  cualquier otro servicio — es parte de un paquete normal.
- **Un tramo de bus público en `producto_componente`** (ej. los buses entre El Chaltén, El
  Calafate y Puerto Natales de Patagonia Highlights) **nunca** genera un mail a nadie — lo emite
  una persona en el sistema de emisión de pasajes de HI Travel, por fuera de esta app. La app solo
  lo lista como tarea pendiente. Ver [`integraciones.md`](integraciones.md).

## Qué NO se guarda en el MVP

- **Precios, costos, márgenes** (módulo de costos — fuera de alcance, PRD §5). El importador los
  ignora.
- Las **respuestas de los proveedores** como dato estructurado (las vuelca una persona como nota +
  cambio de estado).
- Datos del pasajero más allá de lo que trae el mail (nombre del lead, cantidad).
- Nada de agencias/clientes más allá de identificar de qué agencia vino la reserva.

## Anexo técnico

- Postgres (Supabase). Claves primarias `uuid`. `created_at`/`updated_at` en todas. Timestamps en
  UTC (`timestamptz`).
- `reserva.estado` como enum: `recibida | para_revision | pedido_a_proveedor | confirmada |
  con_cambios | rechazada | cerrada | descartada`.
- `evento_reserva` es **append-only** (no se edita ni se borra): es el registro de auditoría.
- `proveedor.nombre_normalizado` para el emparejado (el README de los Excel pide "escribir el
  nombre del proveedor siempre igual"; se normaliza al importar).
- Emparejado de producto: primero por `codigo_externo` exacto → `producto`. Si no hay código o no
  matchea, la IA propone y, con confianza baja, la reserva va a `para_revision`. Umbral y lógica
  en [`integraciones-ia.md`](integraciones-ia.md).
- Detección de duplicados, en dos capas:
  1. **Por `booking_id` (dura, se aplica primero):** si el mail entrante trae el mismo booking_id
     que una reserva ya existente de esa agencia, **no se crea una reserva nueva** — es una
     respuesta dentro del mismo intercambio (pedido de datos de vuelo, pasaporte, etc.), no una
     reserva distinta. Es el mecanismo que ya usaba el Make anterior (buscar el Booking ID antes
     de agregar la fila).
  2. **Por similitud (blanda, red de seguridad):** si no hay booking_id o no matchea ninguno
     existente, match por remitente + código de producto + fechas + pax sobre reservas de los
     últimos ~60 días → flag `posible_duplicada`, **nunca** descarte automático (una persona
     confirma).
- RLS: policy única — `authenticated` puede `select/insert/update`; `delete` deshabilitado salvo
  mantenimiento (los estados `cerrada`/`descartada` reemplazan el borrado).

## Abierto

- ¿Un producto puede tener servicios en más de un destino? El README de los Excel dice que sí
  ("algunos productos combinan servicios de más de un destino"). El modelo lo soporta;
  confirmar al construir el importador.
- Nombres exactos de los estados intermedios — se afinan en M4 (PRD §6.5).
