# M3-03 · Envío por operations@ con modo prueba

**Depende de:** M3-02

## 1. Qué queremos lograr
Al confirmar "Enviar N pedidos", los mails salen desde **operations@hitravel.com.ar** por el correo
de Ferozo, firmados con **el nombre de quien envía**, con copia a ccalomarde@ y guardados también en
"Enviados" de operations@. Mientras el envío real está apagado (**modo prueba**), todo llega solo a
la casilla del owner, con el proveedor real escrito arriba. La reserva pasa a **pedido a proveedor**
y queda registrado a quién se le escribió, cuándo y quién lo aprobó.

## 2. Qué hay hoy
- Los borradores y la pantalla de M3-01 y M3-02. La acción de envío de M3-02 responde "falta conectar".
- La casilla de Ferozo ya se usa por IMAP para leer sales@ (`src/lib/lectura-sales/casilla.ts`,
  `imapflow`), con la clave en variables de entorno.
- El historial de la reserva (`evento_reserva`) y el estado `pedido_a_proveedor`.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **La configuración sale de variables de entorno:** `PEDIDOS_SMTP_HOST`, `PEDIDOS_SMTP_PORT`, `PEDIDOS_SMTP_USER` (operations@), `PEDIDOS_SMTP_PASSWORD`, `PEDIDOS_CC` (lista, hoy ccalomarde@), `PEDIDOS_DESTINO_PRUEBA` (la casilla del owner) y `PEDIDOS_ENVIO_REAL` (`si` solo con OK del owner). Si falta algo, no se intenta enviar y la pantalla dice qué falta en llano | Test de configuración: sin clave, el envío responde "Falta configurar la casilla operations@" y no abre conexión |
| 2 | **Modo prueba por defecto:** sin `PEDIDOS_ENVIO_REAL=si`, el mail va **solo** a `PEDIDOS_DESTINO_PRUEBA`, sin CC, con el asunto "[PRUEBA] …" y arriba del texto "Este pedido iba para: <proveedor> <mail>". **No debe pasar:** que en modo prueba salga un mail a un proveedor | Test con un servidor SMTP falso: en modo prueba el único destinatario es la casilla de prueba, en todos los casos, incluido un borrador con varios destinatarios |
| 3 | **Envío real:** con `PEDIDOS_ENVIO_REAL=si`, sale a los mails del proveedor, con CC de `PEDIDOS_CC`, desde operations@, con el nombre de quien envía en la firma | Test con el SMTP falso: destinatarios, CC, remitente y firma correctos |
| 4 | **La firma lleva el nombre de quien aprobó**, tomado de su sesión (nombre de la cuenta de Google). Si no hay nombre, usa la parte de su mail antes de la @ | Test con y sin nombre en la sesión |
| 5 | **Copia en "Enviados" de operations@:** después de enviar, guarda el mismo mail en la carpeta de enviados por IMAP (solo agrega; nunca borra, mueve ni marca nada). En modo prueba no la guarda. Si guardar la copia falla, el pedido igual cuenta como enviado y queda un aviso | Test con el IMAP falso: aparece el mensaje en "Enviados" (o la carpeta equivalente: `INBOX.Sent`, `Sent`, `Enviados`). Solo se usa `APPEND` |
| 6 | **Nunca dos veces:** cada pedido enviado queda con estado `enviado`, fecha, quién y el Message-ID. Un segundo "Enviar" (doble clic o dos personas a la vez) no lo vuelve a mandar. Mandarlo de nuevo exige "Reenviar" explícito, que queda registrado | Integración: dos envíos simultáneos del mismo pedido dan un solo mail en el SMTP falso |
| 7 | **Resultado por pedido:** enviado ✓, o falló ✗ con el motivo en llano y "Reintentar". Un fallo no frena a los demás | Test: con un destinatario que el SMTP rechaza, los otros salen y ese queda "falló" |
| 8 | **Estado de la reserva:** si salió al menos uno, pasa a **pedido a proveedor**, con el historial "<persona> envió N pedidos a: …". Si quedó alguno sin enviar (sin mail o falló), lleva la marca **pedido incompleto** hasta que se complete. En modo prueba **no** cambia el estado: queda registrado como "envío de prueba" | Integración en la base de pruebas: los dos casos y el modo prueba |
| 9 | **La lista y el detalle lo muestran:** a qué proveedores se les escribió, cuándo y quién | Test de pantalla del detalle después de enviar |
| 10 | **Solo el equipo puede enviar** y cada envío exige la confirmación del diálogo (#4) | Test: sin sesión la acción rechaza; sin la confirmación, no envía |

## 4. Qué ve el usuario
- **En la pantalla de pedidos:** al confirmar, cada tarjeta muestra "Enviando…" → "Enviado ✓ 14:32"
  o "No se pudo enviar ✗: <motivo>" con "Reintentar". Después vuelve al detalle con el estado nuevo.
- **En modo prueba:** una franja fija "Modo prueba: los pedidos llegan solo a ccalomarde@".
- **Error de configuración:** "Falta configurar la casilla operations@: avisale a Cristian".

## 5. Qué queda afuera
- Leer las respuestas de los proveedores y registrar confirmada / con cambios / rechazada (M4).
- Prender el envío real: lo hace el loop principal en M3-04 con el OK del owner.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#2** — la clave de operations@ solo en variables de entorno (Vercel y `.env.local`); nunca se
  imprime ni se commitea.
- **#4** — acción hacia afuera: aprobación explícita por envío y modo prueba por defecto; prender el
  envío real requiere el OK del owner.
- **#1** — los datos de pasajeros viajan solo al proveedor de ese pedido.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (regla #5):** 1) unitarios + linter + tipos → 2) integración en la base de
  pruebas con un **servidor SMTP falso** y el IMAP falso de M2-07 (nunca la casilla real en tests)
  → 3) recorrido: pantalla real, enviar en modo prueba a un SMTP falso local. El envío real contra
  Ferozo lo hace el loop principal en M3-04.
- **Librería:** `nodemailer` para SMTP (o la que ya esté en el proyecto); el `APPEND` con `imapflow`.
- **Dónde:** `src/lib/pedidos/envio/` (config, modo prueba, enviar, copia en enviados, registro),
  la acción de la pantalla de M3-02 y `.env.example` con las variables nuevas (sin valores).
- Si hace falta una migración (estado y Message-ID del pedido, si M3-01 no los dejó), aplicarla solo
  a la base de pruebas y avisar.
