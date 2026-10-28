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
- **Para M4 (pedido del owner, 2026-10-19): cambios que afectan a otros pedidos.** Cuando se registre que
  un alojamiento confirmó otra opción (ej. San Pedro Backpackers sin lugar → Aji Verde), la app actualiza
  el pick up de los pedidos que todavía no salieron y, para los que ya salieron con el dato viejo, deja
  una tarea con el mail "Cambio de pick up" ya armado para cada proveedor afectado (Horizonte, Imperio
  Inca), para aprobar y enviar. La tarea no se cierra hasta que se manda: así no se olvida avisar.
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
- **Días fijos de excursiones (owner, reconfirmado 2026-10-19), siempre salvo cambio manual:** los
  geysers del Tatio van el día 3 del OD030 (San Pedro Explorer) y Tiwanaco el día 2 del OD031 (La
  Paz Starter). Viven en `data/dias-servicio.csv`; ahí se agregan las que vengan.
- **Habitación (owner, 2026-10-19):** se pide la que manda la agencia. En el Overland de Imperio Inca
  (tour regular) se aclara: dorm compartido, DBL o SGL con baño compartido. En los hostels de otros
  paquetes no se aclara el baño (depende del hostel): "doble" o "single" a secas; el dorm, "dorm compartido".
- **Pick up y entradas (owner, 2026-10-19):** cada excursión dice dónde se aloja el pax para el pick up.
  Solo en Journaway, y solo en San Pedro de Atacama con Horizonte, las excursiones se piden con entradas
  (lista editable en `data/excursiones-con-entrada.csv`).
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
| M3-03 | **Envío por operations@ con modo prueba.** Manda los pedidos aprobados por el SMTP de Ferozo, con CC configurable (hoy ccalomarde@). Mientras el envío real está apagado, todo va solo a la casilla del owner con el proveedor real escrito arriba. Registra a quién, cuándo y quién aprobó; nunca manda dos veces sin "Reenviar"; muestra enviado / falló con "Reintentar". La reserva pasa a "pedido a proveedor" (con "pedido incompleto" si faltó alguno) | ✅ | M3-02 | `docs/sdd/specs/M3-03-envio-operations.md` |
| M3-05 | **Confirmar el producto de una reserva "para revisión".** Desde el detalle, "Confirmar: es OD031…" (la sugerencia de la IA) o "Elegir otro producto"; la reserva pasa a recibida si no le queda otro motivo y la app aprende el nombre o código de la agencia. Pedido por el owner el 2026-10-19 (primera reserva real de Kilroy) | ✅ | M2 | `docs/sdd/specs/M3-05-confirmar-producto.md` |
| M3-06 | **Nombre para la firma, responsable y filtro "mis reservas".** Cada operativo elige cómo firma; cada reserva muestra quién la lleva ("Tomar esta reserva", "Pasarla a otro", y por defecto quien mandó los primeros pedidos); la lista filtra por operativo. Pedido por el owner el 2026-10-20 | ✅ | M3-03 | `docs/sdd/specs/M3-06-firma-y-responsable.md` |
| M3-07 | **Corregir vuelos y datos dudosos desde el detalle.** "Corregir vuelos" (llegada/salida, número, aeropuerto, fecha, hora), nota del operativo y "Está bien así" para los otros datos dudosos; la reserva pasa a recibida si no queda motivo. Pedido por el owner el 2026-10-20 (DK1595221) | ✅ | M3-05 | `docs/sdd/specs/M3-07-corregir-vuelos.md` |
| M3-08 | **Orden y filtros de la lista.** Por defecto inicio del viaje (próximas primero) con todas las vigentes; "Ordenar por", agencia y fechas del viaje; los viajes terminados solo los ve el owner ("Viajes terminados", para liquidaciones). Pedido por el owner el 2026-10-20 | ✅ | M3-06 | `docs/sdd/specs/M3-08-orden-y-filtros-lista.md` |
| M3-09 | **Agregar un pedido a mano.** En la pantalla de pedidos, "Agregar un pedido a mano" a un proveedor del directorio o a un mail: sale con el texto ya empezado, queda marcado "A mano", el rearmado no lo toca y se manda por el mismo envío (modo prueba, diálogo, registro). Elegida por el owner el 2026-10-20 (DK1592913 ARCH31, noche extra en PUQ) | ✅ | M3-03 | `docs/sdd/specs/M3-09-pedido-a-mano.md` |
| M3-10 | **Ampliar el catálogo: los 6 que ya pidieron las agencias.** CH11, AR34, OD014, ARCH33EXP (ARCH33 con CH11), ARBR23 y ARUY01, desde el Excel de paquetes, los Word y RutasenBus; primero un diagnóstico con una sola lista de dudas para el owner, después la carga en pruebas y, con su OK, en la real. Elegida por el owner el 2026-10-21 (DK1594177) | ✅ | M1-05 | `docs/sdd/specs/M3-10-ampliar-catalogo.md` |
| M3-11 | **Puerto Natales: el hostel según la habitación.** Dorm → Puma, Last Hope; privada → Factoria, Last Hope, Puma; la regla en `data/hostel-segun-habitacion.csv`. Pedida por el owner el 2026-10-22 | ✅ | M3-01 | `docs/sdd/specs/M3-11-hostel-segun-habitacion.md` |
| M3-12 | **Iguazú: el pedido a Cuenca del Plata lleva el hotel de cada día.** TRF IN, cada excursión (con el cruce en los combinados) y TRF OUT con el alojamiento de esa noche, como las excursiones de los otros destinos. Pedida por el owner el 2026-10-22 | ✅ | M3-01 | `docs/sdd/specs/M3-12-hotel-en-pedido-iguazu.md` |
| M3-13 | **Agencia Adventure360 (BRARCH26) y las opciones del pasajero.** Adventure360 conocida, "Rio de Janeiro to Santiago" = BRARCH26, bike tour en BUE en lugar del City Tour, rafting en Mendoza (Kahuak) en lugar de Alta Montaña, sin fecha → para revisión. Pedida por el owner el 2026-10-22 | ✅ | M3-01 | `docs/sdd/specs/M3-13-agencia-adventure360.md` |
| M3-14 | **En los tours, la categoría vendida elige el hotel de cada parte.** "Budget Hotel": Budget donde hay, si no Hotel 3* (Iguazú → El Pueblito/Botánica); `data/categorias-tour.csv` manda cuando dice otra cosa. Pedida por el owner el 2026-10-22 | ✅ | M3-13 | `docs/sdd/specs/M3-14-categoria-del-tour-elige-hotel.md` |
| M3-15 | **Mendoza: Bodegas el día 1 (tarde) y la excursión de día entero el día 2; Bike Tour con punto de encuentro (Pasaje Giuffra 370, San Telmo).** Pedida por el owner el 2026-10-22 | ✅ | M3-13 | `docs/sdd/specs/M3-15-mendoza-dias-y-punto-de-encuentro.md` |
| M3-16 | **El asunto del pedido sin códigos internos.** "Solicitud de reserva – <pasajero> – <fechas>": sin el booking code de Kilroy/Jysk/Journaway ni el código del tour (siguen en la app). Pedida por el owner el 2026-10-23 (feedback de operaciones G1) | ✅ | M3-09 | `docs/sdd/specs/M3-16-asunto-sin-codigos.md` |
| M3-17 | **Excursiones con día fijo en todos los destinos cargados.** TdP Natales, Big Dude, Península Valdés día 2; TdP desde El Calafate, Tango (noche), Colonia día 3; Ushuaia Beagle 2 y PN 3; Bike Tour SCL 2; Iguazú lado AR 2 y BR 3. Pedida y validada por el owner el 2026-10-23 (feedback G3) | ✅ | M3-15 | `docs/sdd/specs/M3-17-dias-de-excursion.md` |
| M3-18 | **Alojamiento: habitación Standard con desayuno.** "Habitación: DBL/SGL/TWIN/TPL Standard con desayuno"; dorm "dorm compartido, con desayuno"; para que no den upgrades no pedidos. Pedida por el owner el 2026-10-23 (feedback G2) | ✅ | M3-01 | `docs/sdd/specs/M3-18-standard-con-desayuno.md` |
| M3-19 | **W Trek: el pedido dice el tipo de alojamiento.** Refugio Dorm a compartir / Tent DBL / Tent SGL según la habitación de la reserva (CH10, CH11 y dentro de los tours). Pedida por el owner el 2026-10-23 (DK1594177) | ✅ | M3-18 | `docs/sdd/specs/M3-19-w-trek-tipo-de-alojamiento.md` |
| M3-20 | **Buses de El Chaltén.** Aeropuerto FTE → El Chaltén como bus regular (horario según el vuelo), el round trip de AR34 en dos renglones, vuelta El Chaltén → El Calafate 8:00 am por defecto, aviso interno si el vuelo llega después de las 17 hs. Pedida por el owner el 2026-10-23 (DK1594177, DK1592913) | ✅ | M3-10 | `docs/sdd/specs/M3-20-buses-el-chalten.md` |
| M3-21 | **La habitación según los pax.** Hotel sin tipo: 2 pax DBL, 1 pax SGL (+ aviso de revisar con el vendedor); hostel sin tipo a confirmar; W Trek: carpa sin cantidad con 2 pax Tent DBL, con 1 pax a confirmar (no se asume Tent SGL). Pedida por el owner el 2026-10-23 | ✅ | M3-19 | `docs/sdd/specs/M3-21-habitacion-segun-pax.md` |
| M3-22 | **El pedido de Factoria va a Factoria.** El alojamiento en Factoria se pide a "Factoria (hostel de Vertice)" (reservas@factoriapatagonia.com), no a "W trek VERTICE"; el W Trek sigue yendo a Vértice. Pedida por el owner el 2026-10-23 (DK1592913); Factoria lo reconfirmó el 2026-10-26 | 🔵 en curso | M3-11 | `docs/sdd/specs/M3-22-factoria-aparte.md` |
| M3-23 | **AR10 Full Argentina Adventure – Route 40 en el catálogo.** Salta+Purmamarca, Mendoza, Bariloche, El Chaltén, El Calafate, Ushuaia con buses nocturnos (20 noches). Diagnóstico → preguntas → carga. Pedida por el owner el 2026-10-26: reserva TourRadar #1389186 (su statement se pasa a mano después de cargar) | ✅ |  M3-10 | `docs/sdd/specs/M3-23-ar10-full-argentina.md` |
| M3-24 | **Avisos del itinerario.** Arriba de la reserva, en amarillo, "Revisar antes de pedir": salida en blackout del Word, servicio en Navidad/Año Nuevo/Carnaval/Semana Santa (rangos de Brasil), bus en un día que no sale ("Buses para Tours"). Diagnóstico → preguntas → construcción. Pedida por el owner el 2026-10-26 (#1389186) | 🔵 en curso | M3-23 | `docs/sdd/specs/M3-24-avisos-del-itinerario.md` |
| M3-25 | **Correcciones de la revisión de AR10 y Greeters por sistema.** OD027 solo traslado in, OD022 solo out, Beagle sin transfer sin pick up, buses BRC/FTE ↔ CHA en el mail a Chalten Travel, Greeters como tarea manual. Pedida por el owner el 2026-10-27 (revisión M3-04) | ✅ | M3-23, M3-24 | `docs/sdd/specs/M3-25-correcciones-ar10-greeters.md` |
| M3-26 | **Datos del vuelo completos y bien leídos.** Mostrar salida y llegada completas cuando hay vuelo; y si la agencia pasó los vuelos, que el pedido no diga "vuelo a confirmar" (DK1597924, DK1593775). Pedida por el owner el 2026-10-27/28 (revisión M3-04) | ✅ terminada | M3-25 | [ficha](../../specs/M3-26-datos-del-vuelo.md) |
| M3-27 | **Calendario del bus Bariloche ↔ El Chaltén.** Días que sale por rango de fechas ("cada 3 días desde el 1/11", "todos los días desde el 1/12") en `data/dias-bus.csv`, para el aviso de M3-24. Primer dato del owner 2026-10-27 (CHA 1/11, BRC 3/11; cada 3 días, después cada 2, diario desde 1-2/12); el detalle llega el 2026-10-28 | ⬜ pendiente | M3-24 | (ficha a escribir) |
| M3-28 | **Textos de los pedidos (2da revisión).** Asunto con "x N" pax en todos; sin códigos en el asunto (DK1595221, Beer Hotel y Cuenca); sin "regular" en los transfers del paquete Premium de Cuenca; Transvip con una p. Pedida por el owner el 2026-10-28 | ✅ | M3-25 | `docs/sdd/specs/M3-28-textos-de-los-pedidos.md` |
| M3-29 | **BOCHI04R al revés.** Overland Uyuni → San Pedro sin pick up "a confirmar"; si la agencia pide sin traslado a Calama, avisar que el Transvip no se reserva. Pedida por el owner el 2026-10-28 | ⬜ pendiente | M3-28 | (ficha a escribir) |
| M3-30 | **Leer las imágenes del mail.** Las imágenes pegadas en el cuerpo (cid) se guardan y la IA las lee: hoteles y actividades de Journaway (en alemán), pax de Kilroy. Petzold (Trip 65037) sale SPAP05; el "Night Bus Peru" que no es del paquete va a revisión. Pedida por el owner el 2026-10-28 | 🔵 en curso | M2-09, M3-28 | `docs/sdd/specs/M3-30-imagenes-del-mail.md` |
| M3-33 | **W Trek: los refugios de cada variante** (Express Las Torres, Standard Las Torres, Clásica con Grey Vértice). Pedida por el owner el 2026-10-28 | ⬜ pendiente | M3-28 | (ficha a escribir) |
| M3-31 | **Cancelación: nota roja "Cancelar la reserva manualmente".** Pedida por el owner el 2026-10-28 (DK1585500) | ⬜ pendiente | — | (ficha a escribir) |
| M3-32 | **Pedidos en portugués a los proveedores de Brasil.** Pedida por el owner el 2026-10-28 | ⬜ pendiente | M3-28 | (ficha a escribir) |
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
