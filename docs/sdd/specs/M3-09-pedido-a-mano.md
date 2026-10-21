# M3-09 · Agregar un pedido a mano

**Depende de:** M3-03 (envío por operations@ con modo prueba). Elegida por el owner el 2026-10-20: en
DK1592913 (ARCH31) la agencia pidió una noche extra en PUQ, y no hay forma de escribirle desde la app a un
proveedor que el armado no propuso.

## 1. Qué queremos lograr
Desde la pantalla de pedidos de una reserva, una persona del equipo agrega **un pedido escrito por ella** a
un proveedor del directorio (o a un mail que escribe), lo revisa como los demás y lo manda por el mismo camino:
operations@, modo prueba, diálogo de confirmación, registro y "Reenviar". Sirve para lo que el armado no
cubre: una noche extra, un servicio que pidió la agencia aparte o una consulta a un proveedor.

## 2. Qué hay hoy
- **`reserva_pedido`** (0018/0019): un borrador por `(reserva, casilla)`, con destinatarios, proveedores,
  asunto, cuerpo, firma (con `{{nombre_de_quien_envia}}`), `editado` y los estados del envío
  (`borrador → enviando → enviado | fallo`). `guardar_pedidos_armados` borra los borradores **no editados**
  y no agrega otro en una casilla que ya existe.
- **La pantalla de pedidos** (`src/components/pedidos/pedidos-pantalla.tsx`, página
  `src/app/(app)/reservas/[id]/pedidos/`): una tarjeta por pedido con destinatario, asunto y texto
  editables, "Incluir este pedido", "Enviar N pedidos" con su diálogo, y el estado de cada envío.
- **El directorio de proveedores** (`proveedor`: nombre, `mails[]`, canal) y la plantilla
  `data/plantillas/pedido-proveedor.md` (saludo, cierre "¡Muchas gracias!" y firma).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **"Agregar un pedido a mano"** al final de la lista de pedidos, en una reserva **recibida** o **pedido a proveedor** (no en para revisión, cancelada ni cerrada) | Test de pantalla: el botón aparece en recibida y en pedido a proveedor; no aparece en para revisión ni cancelada |
| 2 | **Elegir a quién:** buscar un proveedor del directorio por nombre (completa sus mails, que se pueden editar) **o** escribir uno o más mails a mano. Mail inválido → "Revisá el mail: tiene que ser como nombre@dominio.com" | Test: buscar "Hostal" completa los mails; mail mal escrito muestra el error y no guarda |
| 3 | **El borrador sale ya empezado:** asunto "Reserva <pasajero principal> x<pax>" + la referencia como en la plantilla; cuerpo con el saludo y el "pedirles la siguiente reserva:" de la plantilla, un espacio en blanco para escribir lo que se pide, los pasajeros (cantidad) y el cierre; la firma de siempre | Unitario: el texto inicial sale de `pedido-proveedor.md` con los datos de la reserva |
| 4 | **Se guarda como un pedido más:** queda en la reserva marcado **"A mano"**, con su propia casilla (dos pedidos a mano al mismo proveedor, o uno a mano y uno armado al mismo mail, conviven) | Integración: se guardan dos pedidos a mano al mismo mail más el armado, sin choque |
| 5 | **El rearmado no lo toca:** volver a entrar a la pantalla (que rearma los borradores) no lo borra ni lo cambia | Integración: guardar un pedido a mano, correr `guardar_pedidos_armados`, el pedido sigue igual |
| 6 | **Se manda como los demás:** entra en "Enviar N pedidos" y en el diálogo de destinatarios; en modo prueba va solo a la casilla del owner con el proveedor real arriba; queda registrado quién lo mandó y cuándo; "Reintentar" y "Reenviar" igual que los armados | Integración/recorrido: en modo prueba el pedido a mano llega a la casilla de prueba y no al proveedor |
| 7 | **No cuenta como "pedido incompleto"** ni cambia qué partes de la reserva se consideran pedidas | Unitario: con un pedido a mano sin enviar, el estado de la reserva se calcula igual que sin él |
| 8 | **Sacarlo:** mientras no se envió, "Sacar este pedido" (con confirmación) lo borra. Un pedido a mano ya enviado no se puede sacar | Integración: sacar uno en borrador lo borra; con uno enviado, la base lo rechaza |
| 9 | **Historial:** "<persona> agregó un pedido a mano a <proveedor o mail>" y "<persona> sacó el pedido a mano a …" (sin datos de pasajeros) | Test: eventos con autor |
| 10 | **Solo el equipo,** con sesión @hitravel.com.ar; sin sesión, no agrega ni saca nada. Asunto o texto vacíos no se guardan ("Escribí qué le pedís al proveedor") | Test: sin sesión rechaza; texto vacío muestra el error |

## 4. Qué ve el usuario
- **En la pantalla de pedidos,** debajo de las tarjetas: botón **"Agregar un pedido a mano"**. Abre una
  tarjeta nueva arriba del botón con "Para:" (buscador del directorio o mail), asunto y texto ya
  empezados, y **"Guardar pedido"** / "Cancelar". Guardada, es una tarjeta más con la etiqueta **"A mano"**,
  "Incluir este pedido" y "Sacar este pedido".
- **El recorrido (ARCH31):** abrir la reserva → "Armar pedidos a proveedores" → "Agregar un pedido a mano"
  → buscar el hotel de PUQ → escribir "1 noche extra, IN <fecha> OUT <fecha>, habitación doble" → "Guardar
  pedido" → "Enviar 1 pedido" → confirmar en el diálogo → la tarjeta pasa a "Enviado 18:42 por <firma>".
- **Estados:** "Guardando…" / "Buscando…"; sin coincidencias en el directorio: "No está en el directorio:
  escribí el mail"; error: "No se pudo guardar: <motivo en llano>" con "Reintentar".

## 5. Qué queda afuera
- Agregar el servicio a las partes de la reserva (la noche extra no pasa a ser una parte ni cambia fechas).
- Cargar un proveedor nuevo al directorio desde acá (se escribe el mail a mano).
- Adjuntos.
- Plantillas de pedidos a mano por tipo de servicio.

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde (ver anexo).
- **#1:** solo con sesión del equipo; el historial no lleva datos de pasajeros.
- **#4:** el pedido a mano sale solo con la aprobación del diálogo de envío y respeta el modo prueba
  (`PEDIDOS_ENVIO_REAL`), igual que los armados.
- **#3:** no llama a la IA.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (regla #5):** 1) unitarios + pantalla + lint + tipos + build → 2) integración
  contra la **base de pruebas** (`.env.pruebas.local`; guard `src/lib/entorno/base-de-pruebas.ts`) → 3)
  recorrido con pantallas y server actions reales y sesión de prueba, como M3-06/M3-07 (envío en modo
  prueba con el SMTP falso de los tests de M3-03). **Nunca** se escribe en la base real.
- **Test primero.** Textos en `src/lib/textos/`. El borrador inicial, en una función pura en
  `src/lib/pedidos/` que usa `cargarPlantilla`.
- **Migración `0023_pedido_a_mano.sql`:** columna `a_mano boolean not null default false` en
  `reserva_pedido`; casilla `"a-mano:<uuid>"` para que no choque con el índice `(reserva, casilla)`; los
  pedidos a mano se guardan con `a_mano = true` y `guardar_pedidos_armados` no los borra (excluirlos de su
  `delete` además de `editado`). Funciones `agregar_pedido_a_mano` y `sacar_pedido_a_mano` (solo en
  `borrador`/`fallo`, con evento en el historial), como `confirmar_producto_reserva`. Aplicada **solo** a
  la base de pruebas con `--db-url` (`supabase/.temp/project-ref` apunta a la real); la real la aplica el
  loop principal con el OK del owner.
- **Reusar** el envío de M3-03 (`src/lib/pedidos/envio/`) sin cambios de comportamiento: el pedido a mano
  tiene destinatarios, asunto, cuerpo y firma como cualquier otro. El cálculo de "pedido incompleto" ignora
  los `a_mano`.
