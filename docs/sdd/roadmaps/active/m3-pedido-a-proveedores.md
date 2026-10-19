# M3 — Pedido a los proveedores — plan

## 1. Qué logramos con este milestone
Con una reserva ya cargada (M2) y su producto reconocido, la app arma **los mails de pedido a cada
proveedor** con las fechas y los servicios exactos. Una persona del equipo los revisa, los corrige
si hace falta y aprieta "Enviar". Salen desde `operations@hitravel.com.ar` y la reserva pasa a
**pedido a proveedor**, con registro de a quién se le escribió, cuándo y quién lo aprobó. Lo que no
va por mail (buses que emite HI Travel, proveedores que solo atienden por WhatsApp) queda como
tarea pendiente dentro de la reserva. Es el milestone M3 de [`docs/prd.md`](../../../prd.md).

## 2. Qué queda afuera
- **Leer las respuestas de los proveedores.** Llegan a operations@ como siempre y el equipo las
  registra a mano. Registrar la respuesta (confirmada / con cambios / rechazada) es M4.
- **Emitir boletos de bus o mandar WhatsApp.** La app solo deja la tarea anotada; la hace una
  persona en su sistema de siempre (PRD §5).
- **Mandar algo sin aprobación humana.** Nunca: cada envío lo aprueba una persona (#4).
- **IA para redactar los pedidos.** El texto se arma con una plantilla fija a partir de los datos
  de la reserva y del catálogo; no hace falta IA (#3).
- **Jysk BPA, códigos de TourRadar y el importe del cargo extra de TourRadar:** siguen en la lista
  de "después".

## 3. Preguntas y riesgos

**Respondidas por el owner (2026-10-19), antes de planear:**
- **Por dónde salen:** con la casilla **operations@ de Ferozo** (SMTP, como ya se lee sales@ por
  IMAP). Para el proveedor es igual a un mail escrito a mano y las respuestas llegan a operations@,
  que la ven todos los operativos. La clave va solo en variables de entorno (#2). No se toca el DNS.
  Esto cierra la abierta #7 del PRD y reemplaza la opción "Enviar como" desde Gmail de
  `integraciones.md` (desde M2 la app ya no pasa por el Gmail).
- **Quién aprueba:** **cualquier persona del equipo** que entra con su cuenta @hitravel.com.ar.
  Queda registrado quién mandó cada pedido y cuándo.
- **Copias:** al principio, **CC a ccalomarde@** "para ver cómo anda". Más adelante el owner va a
  pedir sacarla (le satura la casilla), así que la lista de copias se cambia sin tocar código.
- **Pruebas sin riesgo:** **primero todo sale solo a la casilla del owner** (como el modo prueba de
  M2): el mail lleva arriba a qué proveedor iba dirigido. El envío a los proveedores de verdad se
  habilita recién con el OK del owner, después de revisar pedidos reales.

**Reglas que ya estaban y aplican acá:**
- **Un mail por casilla de proveedor y por reserva.** Si varias partes de la reserva van al mismo
  mail (por ejemplo, las filas de Cuenca del Plata, una por producto, todas a reservas8@; o el hotel
  y el Paquete 105 al mismo proveedor), van juntas en un solo pedido, como hoy se hace a mano.
- **Tour compuesto:** un pedido por cada paquete-componente a sus propios proveedores (PRD M3).
- **A mano, sin mail:** Plataforma10, Kupos y Transvip, y todo tramo de bus que emite HI Travel →
  tarea "emitir boleto: ruta, fecha". Proveedor que solo atiende por WhatsApp → tarea "contactar
  por WhatsApp: proveedor, fechas, servicios".
- **Sin vuelo igual se pide.** Como en los pedidos de hoy ("vuelo pendiente aún"): el pedido sale
  con "vuelo pendiente" y se completa después. Lo que no se hace sin vuelo (o bus, si es Iguazú) es
  **confirmar** la reserva (M4).
- **San Pedro Explorer:** los geysers del Tatio van el día 3.
- **Lo que reserva la agencia** (los hoteles "booked by us" de Journaway) **no se pide**.

**Formato del pedido (de los ejemplos en `Insumos/Mails/Pedido Proveedor - *.docx`):** en español;
asunto "Reserva <pasajero principal> x<pax>"; saludo; "Quisiera solicitar la siguiente reserva:";
cada servicio con su fecha (alojamiento con IN/OUT, tipo de habitación y régimen; excursiones con
idioma y regular/privado; traslados con vuelo o "vuelo pendiente"); cantidad de pax; datos de los
pasajeros si la agencia los mandó; "Quedo atenta, saludos" y la firma de HI Travel.

**Respondidas por el owner (2026-10-19), después del plan:**
- **Copia en "Enviados" de operations@: sí.** Cada pedido enviado se guarda también en la carpeta de
  enviados de operations@ (solo agrega, nunca borra ni mueve nada), así el equipo lo ve donde siempre.
- **Firma con el nombre de quien envía: obligatoria.** El proveedor tiene que saber qué operativo le
  escribe. La firma lleva el nombre de la persona que aprobó el envío y después la firma de HI Travel.
- **Tono "buena onda pero profesional".** Los pedidos de hoy son un poco secos; el owner quiere uno
  más amistoso y cercano, sin perder lo profesional. M3-01 propone el texto con ejemplos armados
  desde reservas reales y el owner lo revisa antes de seguir. El texto vive en un solo archivo
  editable, para poder ajustarlo sin tocar código.

**Abiertas, no bloquean:**
- **Datos de la casilla operations@:** servidor y puerto SMTP de Ferozo (probablemente el mismo
  servidor que el IMAP de sales@). Tarea del owner: cargar la clave en el archivo de variables, nunca
  en el chat.

**Riesgos y su límite aceptado:**
- **Un pedido sale a un proveedor por error.** Límite: mientras dura la prueba, la app no puede
  mandarle nada a un proveedor real (todo va a la casilla del owner). Después, cada envío pasa por la
  aprobación de una persona con un diálogo que lista los destinatarios.
- **Se manda dos veces el mismo pedido** (doble clic, reintento). Límite: cada pedido enviado queda
  registrado y no se reenvía sin una acción explícita "Reenviar".
- **Ferozo marca los mails como spam o limita la cantidad de envíos.** Límite: se mide en la prueba
  con la casilla del owner y con los primeros envíos reales. Si pasa, se evalúa Resend (exige tocar
  el DNS con Hostmar, con OK del owner).
- **El proveedor no tiene mail en el directorio.** Ese pedido queda pendiente con aviso "Completar en
  el directorio"; los demás salen y la reserva lleva la marca "pedido incompleto".

## 4. Reglas del proyecto que toca este milestone
- **#1** — los pedidos llevan datos de los pasajeros (nombres, a veces pasaporte y nacimiento): solo
  viajan al proveedor que los necesita; la app solo es accesible para el equipo.
- **#2** — la clave SMTP de operations@ vive solo en variables de entorno, nunca en el código ni en
  el chat.
- **#4** — mandar un mail a un proveedor es una acción hacia afuera: siempre con aprobación explícita
  de una persona, y primero en modo prueba hacia la casilla del owner.
- **#5** — cada pieza con sus 3 verificaciones en verde.

## 5. Las piezas de trabajo (ESTA TABLA ES EL ESTADO)

| ID | Pieza | Estado | Depende de | Ficha |
|---|---|---|---|---|
| M3-01 | **Armar los borradores de pedido.** Para una reserva recibida, agrupa sus partes por casilla de proveedor y arma un borrador por casilla (asunto, cuerpo en español con fechas, servicios, pax, vuelos o "vuelo pendiente"), con un pedido por paquete-componente en los tours compuestos. Lo que va a mano (buses que emite HI Travel, Plataforma10/Kupos/Transvip, WhatsApp) queda como tarea en la reserva; el proveedor sin mail, como pendiente. Sin IA. Los borradores se guardan en la reserva | ✅ | M2 | `docs/sdd/specs/M3-01-borradores-de-pedido.md` |
| M3-02 | **Pantalla de revisión y envío.** Desde el detalle de una reserva recibida, "Armar pedidos a proveedores": una tarjeta por pedido con destinatario, asunto y texto editables, "Incluir este pedido", tareas manuales a la vista y aviso de proveedor sin mail. Lo editado queda guardado. El botón "Enviar N pedidos" abre el diálogo que lista a quién se le escribe | ✅ |  M3-01 | `docs/sdd/specs/M3-02-revision-y-envio.md` |
| M3-03 | **Envío por operations@ con modo prueba.** Manda los pedidos aprobados por el SMTP de Ferozo, con CC configurable (hoy ccalomarde@). Mientras el envío real está apagado, todo va solo a la casilla del owner con el proveedor real escrito arriba. Registra a quién, cuándo y quién aprobó; nunca manda dos veces sin "Reenviar"; muestra enviado / falló con "Reintentar". La reserva pasa a "pedido a proveedor" (con "pedido incompleto" si faltó alguno) | ⬜ pendiente | M3-02 | `docs/sdd/specs/M3-03-envio-operations.md` |
| M3-04 | **Prueba con reservas reales y OK del owner.** Se arman y "envían" (a la casilla del owner) los pedidos de reservas reales de las tres agencias. El owner marca cada uno "está bien" o "hay que corregir", se ajusta lo que falle y, con su OK, se habilita el envío a los proveedores de verdad | ⬜ pendiente | M3-03 | `docs/sdd/specs/M3-04-prueba-y-activacion.md` |

**Tareas del owner (no bloquean el plan; sí la pieza que las usa):**
- **Cargar la clave de operations@** en el archivo de variables (como hizo con la base de pruebas),
  nunca en el chat. La busca (2026-10-20). Hace falta desde M3-03.
- **Revisar el tono** de los ejemplos de pedido que deja M3-01.

## 6. Cuándo está terminado el milestone
- [ ] Todas las filas de la tabla en ✅ (cada una con sus 3 verificaciones en verde, regla #5).
- [ ] Las condiciones del milestone en `docs/prd.md` se cumplen y se pueden demostrar.
- [ ] **El owner lo probó con sus ojos:** revisó pedidos armados desde reservas reales (uno de un
      producto simple y uno de un tour compuesto), le llegaron a su casilla como los mandaría a un
      proveedor, y dio el OK para habilitar el envío real.
- [ ] Este plan movido a `docs/sdd/roadmaps/archive/`.
