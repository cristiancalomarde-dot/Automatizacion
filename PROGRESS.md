<!-- PROGRESS.md — la nota corta de "dónde retomar". Actualizar antes de cerrar cada sesión.
El estado pieza por pieza NO va acá: vive en la tabla del plan (docs/sdd/roadmaps/active/). -->

# Dónde retomar

- **2026-10-22 (cierre): Buenos Aires City Tour/Bike Tour por defecto el día 2** de OD018 y OD020 (`data/dias-servicio.csv`; también dentro de los tours); OD020 suma el punto de encuentro y la opción bike como OD018. Todo publicado. El owner viaja a Santiago; **al volver trae el feedback de las chicas de operaciones** → empezar por ahí (ordenarlo y armar las correcciones). Siguen abiertos: casilla nueva de Alejandra, mail de Merit MVD, número HI Travel por reserva (M4), M3-04.

- **Alejandra (operaciones3@) no puede crear cuenta Google con ese mail:** tiene "sesión de visitante" con archivos de Drive compartidos; NO eliminarla. Propuesto: casilla nueva alejandra@hitravel.com.ar en Ferozo y cuenta Google con ese mail (o, si le pasa a varios, login con código por mail = pieza nueva). Fecha del Bike Tour sigue "a coordinar"; nombre de catálogo "… Alta Montaña. Booking" con basura (ya no se ve en pedidos de OD019).

- **2026-10-22 (noche): M3-14 publicada:** en los tours la categoría vendida elige el hotel de cada parte (Budget →
  Budget donde hay, si no Hotel 3*; `data/categorias-tour.csv` manda). BRARCH26/ARBR23/5C01/ARCH33 sin "Elegir el hotel".
  Nota: `nivelDeLaHabitacion` no reconoce "Hotel in SPA" (CHB31 funciona igual porque OD030 tiene un solo nivel).
  - **M3-15 publicada (2026-10-22):** Bike Tour con punto de encuentro (Pasaje Giuffra 370, San Telmo, sin pick up); Mendoza
    Bodegas día 1 (tarde ~14:30) y Alta Montaña/Rafting/Cabalgata día 2.
  - **Adventure360 sin número de reserva (owner):** ellos esperan NUESTRO número; los mails siguientes solo se pueden
    unir por agencia + nombre del lead pax o por un número que asignemos. Propuesto: número HI Travel visible por
    reserva (decidir con el owner; probablemente M4).

- **2026-10-22 (noche): M3-13 publicada (Adventure360).** Agencia conocida (`adventure360.com`), "Rio de Janeiro to
  Santiago" = BRARCH26 (`data/codigos-agencias.csv`, importador `importar:codigos-agencias`), lectura v4 (TBC → para
  revisión "preguntársela a la agencia"), opciones del pasajero en `data/opciones-pasajero.csv` (bike → Bike Tour en
  lugar del City Tour; rafting → Huentata solo Bodegas + Kahuak). `next.config.ts` ahora sube `data/*.csv` y la
  plantilla con las rutas de reservas/pedidos.
  - **Pendiente del owner:** correr la carga del código en la real (`! bash cargar-m3-13.sh` del scratchpad).
  - **Abiertos:** qué día va el rafting/Bodegas (sin regla → "a coordinar"); el mail de Adventure360 no trae número de
    reserva (los mails siguientes no se unen solos); eval real de la lectura v4 sin correr (cuesta plata).
  - **M3-14 (categoría del tour elige el hotel) en curso.**

- **Para cuando arranque M4 (owner 2026-10-22, de acuerdo):** la respuesta del proveedor se registra **por pedido**
  (confirmado / con cambios / rechazado) y la reserva pasa sola a confirmada cuando todos sus pedidos lo están.
  El owner aprobó también el estado de cada pedido/componente visible en la reserva (ej. Puma ✓ · Cuenca del Plata ✓ · Huentata pendiente).
  El owner ya hizo "Confirmar producto" en DK1594177 y revisó los pedidos rearmados ("quedó muy bien"); el equipo
  (operativos) está probando la app en modo prueba: juntar sus errores (código de reserva + qué esperaban + captura).

- **2026-10-22 (noche): M3-12 publicada (Iguazú: hotel en cada renglón del pedido a Cuenca del Plata, "Premium" en
  título y excursiones) y el cierre de los pedidos pasó de "Un abrazo," a "¡Saludos!" (owner, `data/plantillas/pedido-proveedor.md`).**
  - **Huecos que vio el builder (piezas aparte si el owner quiere):** BRARCH26 con "Budget Hotel" no elige el hotel de
    Iguazú (la categoría del tour no se aplica al armar; mismo abierto que ARCH33/ARBR23) → sale "alojamiento a
    confirmar"; OD010C sin tramos de noches (el día del cruce saldría el mismo hotel); TRF IN/OUT siguen "regular".
  - **Adventure360:** ya escribe a sales@. Faltan del owner: bike tour BUE (¿reemplaza al City Tour?), rafting Mendoza
    (¿reemplaza qué y con qué proveedor?), fecha "TBC" → para revisión.

- **2026-10-22 (tarde): M3-11 publicada: en Puerto Natales el hostel sale según la habitación** (Dorm → Puma, Last Hope;
  privada → Factoria, Last Hope, Puma; regla en `data/hostel-segun-habitacion.csv`, se lee al armar, sin recarga).
  Los borradores ya armados se corrigen con "Volver a armar". El Excel de proveedores "para IA" estaba solo en el clon:
  se copió a `Insumos/` del Drive; el owner agregó el mail del Hotel Oxford MVD, Merit MVD espera confirmación →
  después copiar el Excel al clon y reimportar proveedores en la real (lo corre el owner con `!`).
  - **Adventure360** (agencia nueva, reserva BRARCH26, ya en catálogo): no está en `data/agencias.csv`, sus mails quedan
    "desconocida". Falta que el owner pase remitente/dominio y cómo nombran el producto; después, sumarla.
  - **Próximas tandas de catálogo:** el owner sugiere lo que piden las agencias (BRARCH26 ya está; 5C01 también).

- **2026-10-22: M3-10 (6 productos nuevos) cargada en la real y publicada; Perito Moreno día 2 en OD013/OD016.**
  La carga la corrió el owner con `! bash cargar-m3-10.sh` (equivalencias → paquetes sin ANTHROPIC_API_KEY → tours →
  códigos Kilroy → códigos TourRadar, desde el clon con `.env.local`): 5 paquetes + 3 tours creados, nada actualizado
  ni borrado; sin resolver: Oxford y Merit Montevideo (sin mail) y O Hostel GRU (de antes).
  Reportes: `docs/sdd/diagnosticos/M3-10-diagnostico.md` y `M3-10-carga.md`. Días fijos en `data/dias-servicio.csv`
  (se leen al armar, sin recarga): OD013/OD014/OD016 Perito Moreno día 2, AR34 día 5. OD015 no está cargado.
  - **Abiertos de M3-10 (piezas aparte si el owner quiere):** la categoría del tour no elige el hotel de cada paquete
    (ARCH33/ARCH33EXP/BRARCH26/ARBR23 dejan "Elegir el hotel de…"); el bus ida y vuelta de AR34 sale "día 1 a día 6"
    y la vuelta es el día 4.
  - **Pendientes del owner:** "Confirmar producto" en DK1594177; revisar el Perito Moreno de DK1592913; mails de Hotel Oxford y Merit Montevideo en el Excel de
    proveedores; Fitz Camp, si lo agrega al bloque AR34, al final del bloque.

- **2026-10-21: M3-09 (pedido a mano) publicada; migración 0023 aplicada a la real con OK** (la corrió el owner con
  `! bash <script>`: el clasificador de permisos bloquea `db push` a la real desde el agente; el push a GitHub sí pasó).
  Se trabaja en el clon `C:\Users\gs\dev\hi-travel-automatizacion` (en Drive `npm ci` deja los archivos vacíos) y el
  repo de Drive hace `git pull --ff-only` del clon y `git push`. Base real por el pooler
  `aws-0-ca-central-1.pooler.supabase.com:5432` (la URL directa de `.env.local` no resuelve). M3-08 online.
  Admin = **operations@** (es el owner): `ADMINS_EMAILS` cargada en Vercel por el owner + Redeploy. Suite completa:
  fallas intermitentes por lentitud de la base de pruebas (timeouts), que pasan corridas solas.
  - **Siguiente:** (1) el owner prueba el pedido a mano con ARCH31 en modo prueba y "Viajes terminados" con operations@.
    (2) Reenvíos a sales@: descartado por ahora (2026-10-21), Journaway prometió cargar sales@ esta semana.
    (3) M3-04 cuando entren reservas reales. (4) Lista de productos pedidos que faltan en el catálogo (para el Excel).

- **2026-10-20: M3-06 y M3-07 publicadas; migraciones 0021 y 0022 aplicadas a la real con OK.** Firma por operativo
  (/mi-firma), responsable de la reserva (tomar/pasar, por defecto quien envía) y filtro por operativo; "Corregir vuelos"
  y datos dudosos desde el detalle; al corregir fechas de un tour con partes se corren si la duración no cambia (si
  cambia, aviso); la pantalla de pedidos muestra lo que pidió la agencia. Reglas nuevas en pedidos: drop off en excursiones
  de un día, "Pasaporte: pendiente", cierre "¡Muchas gracias!", ficha completa para Horizonte, entradas solo Journaway +
  San Pedro (lista confirmada por el owner). Usuarios reales: solo operations@ ("Damian"); el owner les pasa a los
  operativos cómo crear su cuenta de Google con su mail @hitravel.com.ar.
  - **Pendientes del owner:** Journaway sigue mandando a operaciones3@ (insiste para que copien a sales@; alternativa:
    reenvío automático en Ferozo, que conserva el remitente). DK1592913 ARCH31: pide noche extra en PUQ y pasar el día
    libre de Calafate a Chaltén (pedidos a editar a mano; la noche de PUQ va por fuera).
  - **Siguiente (superado el 2026-10-21):** orden y filtros = M3-08 ✅; pedido a mano = M3-09 ✅.

- **M3-05 terminada y publicada (2026-10-19).** Botón "Confirmar producto" en reservas "para revisión" (sugerencia de la IA o
  buscador), la app aprende la equivalencia (codigo_externo.origen = aprendido; los importadores no la borran). Migración 0020
  aplicada a la real con OK. Reglas nuevas del owner: Tiwanaco día 2 del OD031; Combined de Iguazú: OD010D primero lado
  brasileño, aviso del cruce (drop off en el otro hotel, equipaje a los lockers). Siguiente: M3-04 (el owner prueba los
  pedidos de UK1595157 en modo prueba) y el tono de la plantilla.

- **M3-03 terminada y publicada (2026-10-19).** Migración 0019 aplicada a la real con OK. Variables PEDIDOS_SMTP_*, PEDIDOS_CC
  y PEDIDOS_DESTINO_PRUEBA en Vercel y .env.local; login SMTP e IMAP de operations@ probado OK (enviados = INBOX.Sent Items).
  PEDIDOS_ENVIO_REAL sigue apagado (modo prueba). Primera reserva real de Kilroy (UK1595157: CHB31 + OD031, La Paz confirmada
  por el owner y cargada en codigos-kilroy). Journaway ya manda a sales@. Siguiente: M3-04 (primer envío de prueba real a la
  casilla del owner y revisión de 8-10 pedidos reales). Pieza chica propuesta: botón para resolver "para revisión" en el detalle.

- **M3-01 y M3-02 terminadas (2026-10-19).** Migración 0018 (reserva_pedido, reserva_tarea) aplicada a la real con OK
  del owner. M3-01: borradores por casilla con plantilla editable `data/plantillas/pedido-proveedor.md` (el owner revisa
  el tono con `docs/sdd/diagnosticos/M3-01-ejemplos-pedidos.md` y 7 preguntas). M3-02: pantalla `/reservas/<id>/pedidos`
  (tarjetas editables, incluir, tareas, avisos, "Volver a armar", diálogo de envío que todavía NO manda nada).
  Siguiente: M3-03 (envío por operations@), necesita que el owner cargue la clave de operations@ en el archivo de variables.

- **M2-09 publicada, esperando la revisión del owner (2026-10-18).** Reservas de Journaway: migraciones 0016 y 0017
  aplicadas a la real con OK. Journaway entra a la lectura diaria de sales@ (asunto con book/booking/cancel/Stornierung o
  cuerpo "please book"). Un mail = una reserva (SPAP01 + SPAP03 en `otros_productos`); mismo ID de 11 dígitos = misma
  reserva (suma tours). Modo prueba en la real: 4 reservas de Journaway de prueba, 4/4 coinciden. Gasto del mes US$ 3,04.
  Al recibir la revisión: marcar M2-09 ✅, "probalo vos" de M2 y archivar el plan con OK del owner. Pendientes chicos:
  techo con mails "en espera" más allá de 7 días; tests que fallan por carga en la corrida completa (pasan aislados).
  Para el owner: Journaway hoy manda a operaciones3@ (pedir sales@ o reenvío en Ferozo).

- **M2-08 terminada y cargada en la real (2026-10-17).** Catálogo de Journaway: 53 productos (44 celestes, 8 solo
  dentro de paquete, Overland interno UYUO01), 6 paquetes SPAP; `npm run importar:journaway`. El owner agregó una fila por
  producto de Cuenca del Plata (IGRP01/02, IGRE01/02/03, IGRT01, reservas8@): ninguno sin proveedor. Recarga del directorio:
  renombre reconocido si el nombre viejo está dentro del nuevo (ids conservados). Real: productos 29→82, proveedores 262→269,
  nada borrado (respaldo previo en el scratchpad de la sesión). Siguiente: M2-09 (reservas de Journaway). Nota: SPAT02 no
  pide vuelo; 42 productos sin nombre de mail (se reconocen por código o nombre del tarifario).

- **M2-07 terminada y ACTIVA (2026-10-17).** Lectura diaria de sales@ (Inbox + Spam) a las 12 hora Argentina
  (cron `0 15 * * *` en Vercel), solo lectura. Migración 0015 aplicada a la real con OK del owner. Base de pruebas
  separada (`.env.pruebas.local`): tests y scripts de prueba gastan ahí, no en el techo real. Variables en Vercel:
  `SALES_IMAP_*`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `LECTURA_SALES_ACTIVA=si`, `LECTURA_SALES_DESDE=2026-10-17T03:40:14Z`
  (lo anterior ya estaba en gestión, no entra). Primera corrida manual: anduvo bien, 0 mails. Todos los días, domingo incluido.
  - **Pendientes:** (1) ajuste chico del techo: mails cortados por el techo quedan "en espera" aunque pasen los 7
    días de ventana (regla del owner en plan §3). (2) `tests/lectura-sales-m2-07.integration.test.ts` falló una vez
    en la corrida completa y pasa solo (posible timeout por carga): vigilar. (3) Revisar el registro de las corridas
    del fin de semana. Siguiente pieza: M2-08.

- **Ajustes tras la revisión del owner (2026-10-16).** Revisión: 23 marcadas, 20 bien / 3 mal (13%),
  guardada en `docs/sdd/diagnosticos/M2-06-revision-owner.md`. Hecho: falta de vuelo = aviso (`avisos-vuelo.ts`),
  TourRadar solo statement, una reserva por número en TourRadar (extras como pedido especial), marca CANCELACIÓN,
  columna "Juan Perez x 3" + buscador, `lectura-mail.v3` (eval 100%), OD014 no cargado. Corrida de nuevo con OK
  del owner: 22 reservas de prueba, 17 recibidas y 5 para revisión, US$ 0,42; mes en US$ 2,79 de 20.
  - **Pendiente:** `tests/importador-productos.integration.test.ts` espera 15 códigos / 3 para OD010B y ahora hay
    uno más (el Kilroy IGUAZU_BR_4DAYS cargado en M2-06): actualizar la expectativa. Preguntar al owner si algún
    mail original de tourradar.com distinto del statement (ej. vuelos sin "Re:") debería leerse.
- **M2-06 terminada (2026-10-15).** Modo prueba: `npm run probar:mails` (72 archivos, 22 leídos con IA,
  24 reservas de prueba, US$ 0,46). Migración 0014 aplicada con OK del owner (marca `de_prueba` en partes
  e historial, tabla `revision_prueba`). Lista oculta las de prueba salvo `?prueba=1`; botones "Está bien" /
  "Hay que corregir" y medición. Ajustes del owner: Iguazú sin dato de llegada = aviso (no revisión),
  códigos OD010B/OD030/AR09 cargados, Kilroy nueva reserva solo con "NEW BOOKING" / "KILROY booking
  request" (lo demás = cotización, se ignora), orden de la lista. Filtro reutilizable para M2-07:
  `src/lib/reservas/filtro-entrada.ts`. Sonnet 5.5 100% vs Opus 64% en `eval:lectura`.
  - **Pendiente:** decidir con el owner cómo refrescar las 24 reservas de prueba (re-emparejado sin IA,
    o `--borrar` + corrida de nuevo ~US$ 0,46): 4 cambiarían por los códigos y 2 son cotizaciones.
    Después, el owner marca cada una (gate de M2-07). Fijar Sonnet 5.5 en DECISIONS. Demo al profesor
    el lunes 2026-10-19.
- **M2 planificado (2026-10-11):**
  - Plan en `docs/sdd/roadmaps/active/m2-entrada-de-reservas.md`, con 9 piezas.
  - Decisiones del owner:
    - Lectura por IMAP de `sales@` en Ferozo, incluida la carpeta Spam.
    - Journaway entra en M2.
    - Primero modo prueba; la lectura automática se activa recién con su OK.
  - **Las 9 fichas están escritas** (`docs/sdd/specs/M2-0*.md`, commit `a2c96cd`).
  - **Revisión de IA hecha y aplicada (2026-10-12, OK del owner):** `revision-ia.md`,
    `integraciones-ia.md` reescrito (modelo por tarea en `modelos.ts` con Sonnet 5.5,
    instrucciones versionadas, `eval:lectura`, `ia_llamada`, controles de fechas y pax). Ajustes
    sumados a las fichas M2-01 (fila 11), M2-02 (filas 25-29), M2-03 y M2-06 (anexos).
  - **M2-01 terminada (2026-10-12):** migración 0010 aplicada (5 tablas + bucket
    `mail-adjuntos`), `data/agencias.csv`, `src/lib/reservas/{agencias,huella,guardar,tipos}.ts`.
    703/703 tests (flaky al correr todo junto: "6 tablas iguales" y `correcciones-m1-07` "#1 un
    solo Tetris"; pasan solos). Commits `35a1e77`, `2a2bf1a`, `5f1298c`.
    - **Antes de M2-06:** los tests limpian con `borrar_datos_de_prueba()`, que borra TODO lo de
      prueba. Con el modo prueba en uso borrarían las reservas que revisa el owner. Hacer que los
      tests limpien solo lo suyo (prefijo `[test …]`).
    - `de_prueba` todavía se puede cambiar en una fila existente; `crearReserva` no es
      transaccional (reserva y componentes en dos llamadas).
  - **M2-02 terminada (2026-10-13).** El owner validó las 6 fichas. TourRadar: CUSTOMER = pasajero
    principal y pax = cantidad (control de pax ajustado, `49de5a3`). Eval final: 97,6%. El único
    error real es pax vacío en la cancelación 1363612: se puede corregir con
    `lectura-mail.v2` al ajustar en M2-06. Journaway no trae número de reserva; el owner se lo
    pide a JW junto con nuestro código.
  - Detalle de la construcción de M2-02:
    eval real con Sonnet 5.5 = 97,6% (pax 83,3%, por la cancelación), US$ 0,14 por corrida.
    Verificaciones 1 y 2 en verde, y el build OK. Commits `4f66c34`…`2b11a84`. Set de evaluación
    y `LEEME-para-validar.md` en `Insumos/evals/lectura/` del clon. Al validar: poner
    `validado_por_owner: true`, ajustar lo que diga el owner y volver a correr `npm run eval:lectura`.
    - Precios oficiales (2026-10-13): Sonnet 5.5 a US$ 2 / 10; Opus 5.5 a US$ 4 / 20.
    - Hay 44 mails reales de sales@ del 12 y 13 de octubre en `Insumos/Mails-reales-2026-10/`
      (clon), para M2-06. Se leyeron por IMAP en modo solo lectura.
  - **M2-02 ajuste (2026-10-13, `52f37cc`):** instrucciones `lectura-mail.v2`. El número de
    Journaway es el "ID" de 11 dígitos del asunto, y el Trip Number queda como referencia. Pax de
    TourRadar = cantidad, también en cancelaciones. Eval con v2: **100%**, US$ 0,14.
  - **M2-03 terminada (2026-10-14):** commits `46187ef`, `3967c86`, `531c480`.
    - Migración 0011 aplicada; `data/codigos-kilroy.csv` cargado en `codigo_externo` (9 filas).
    - Corrida real: 9 reservas por US$ 0,19. OD010D quedó "recibida"; el resto, "para revisión"
      por falta de vuelos o porque el producto no se reconoce.
    - Preguntas para el owner:
      - confirmar los códigos Kilroy de los 7 tours (`HI_ARGENTINA_<código>-677`);
      - ¿Patagonia Trekking Paradise **Express** (`HI_TRAVEL_ARCH_EXP-677`) es un producto
        nuestro?
      - ¿"Patagonia Adventure" de TourRadar es AR09? La IA lo sugirió con 0,80.
    - Para M2-06: el umbral de 0,9 y la detección de "con/sin traslados" por palabras.
    - El cambio de la limpieza de los tests (que no borren todo lo de prueba) sigue pendiente
      antes de M2-06.
  - **M2-04 terminada (2026-10-14):** commits `64f1709`…`7f74b05`, migración 0012 aplicada.
    - Hecho: `procesar-mail.ts` (el circuito de un mail), `intercambio.ts`, `booking-id.ts` y
      `respuestas.ts` (qué respuestas se leen, decisión del owner).
    - Corrida real: US$ 0,19; la segunda pasada no gastó nada y no duplicó.
    - Para confirmar con el owner: un statement de cargo de TourRadar que se une a una reserva
      queda solo en el historial y no la manda a revisión.
    - Sin transacción por mail: si algo falla a la mitad, queda en `error_proceso`.
  - **Pendiente ofrecido al owner:** un borrador TourRadar ID → nuestro código. Partiría de
    `Insumos/Listado Ids de TourRadar en relacion a Tours HI Travel links de wetu.xlsx` (111
    tours) y alimentaría el cargador existente de `Codigos Productos Tourradar.xlsx` (hoy tiene 5
    filas: OD010A-D y OD011).
  - **Ajuste M2-03/M2-04 (2026-10-14):** commits `db69350`, `6e7702a`, `f039a05`, `bff3381`.
    - Un cargo extra de TourRadar manda la reserva a revisión. El monto todavía no se extrae:
      haría falta una v3 de las instrucciones.
    - `data/productos-no-cargados.csv` (ARCH33EXP, ARBR23, ARUY01): va directo a "no cargado",
      sin IA.
    - `data/codigos-tourradar.csv` + `npm run importar:codigos-tourradar`: cargó 150146 → AR09.
    - **Hallazgo:** los PDF de TourRadar NO traen el ID del tour, solo el nombre y la referencia.
      El borrador de códigos sirve igual por el NOMBRE: hay que cargar el nombre de TourRadar como
      `codigo_externo.nombre_externo`, que es el paso 2 del emparejado.
  - **M2-05 terminada (2026-10-14):** commits `92d3370`…`1a4b001`.
    - `/` redirige a `/reservas` (lista); detalle en `/reservas/[id]` con el mail original y el PDF.
      Hay 0 reservas en la base.
    - Pendiente chico: las frases de motivos de `textos.reserva.motivos` reemplazan el detalle.
      "Falta el vuelo de llegada a Calama (CJC) para OD030" pasa a ser el genérico "Faltan los
      datos de vuelo…", y "existe pero no cargado" pasa a ser "no está en el catálogo". Hay que
      mostrar el detalle. Las 12 frases nuevas esperan el OK del owner.
    - El owner no puede entrar por localhost (el login redirige a Vercel). Para que lo vea:
      publicar en Vercel con su OK, después de M2-06, cuando haya datos.
  - **Siguiente:** M2-06 (modo prueba). Antes: que los tests limpien solo sus datos de prueba.
  - Respuestas del owner a las preguntas de las fichas: en §3 del plan (2026-10-12). Quedan
    abiertos: el dominio de Jysk, el listado de países de Kilroy (el owner lo ofrece; mientras
    tanto, cualquier `kilroy.*`) y si se lee `INBOX.Promociones`.
  - En M2-02 el owner valida las 6 fichas correctas del set de evaluación (las arma el builder).
  - Antes de la verificación 3 de M2-02: copiar `Insumos/Mails` del Drive al clon.
  - **Claves cargadas y verificadas (2026-10-12)** en `.env.local` del clon:
    - `ANTHROPIC_API_KEY`: la API responde 200. Modelos disponibles: `claude-sonnet-5-5`,
      `claude-opus-5-5`, `claude-haiku-5-5`. Resuelto en la revisión de IA: Sonnet 5.5.
    - `SALES_IMAP_*`: el login IMAP da OK. Solo se probó LOGIN + LIST + LOGOUT, sin tocar mails.
  - **Carpetas reales de sales@:** `INBOX`, `INBOX.spam` (sin la marca `\Junk`; M2-07 la
    encuentra por el nombre), **`INBOX.Promociones`**, Trash, Sent Items y Drafts.
    - Preguntarle al owner si `INBOX.Promociones` también se lee: puede ser un filtro que
      desvía mails.
    - Todavía faltan cargar en Vercel.
  - Tareas del owner:
    - `ANTHROPIC_API_KEY` (hace falta para M2-02).
    - Clave de `sales@` (para M2-07).
    - Pedirle a Journaway que mande a `sales@` con el código HI Travel.
    - Copiar a `Insumos/` el Excel de proveedores con Patagonia Profunda.
- **Retomar acá (2026-10-11): M1 CERRADO.**
  - El owner revisó la versión publicada en Vercel (push `b5fb19a`) y dio el OK.
  - El plan está archivado en `docs/sdd/roadmaps/archive/m1-catalogo-y-proveedores.md`.
  - Se publica con `git push origin main` desde el repo de Drive.
  - **Siguiente:**
    1. **Planilla borrador de Journaway: hecha.**
       - Está en `Insumos/Borrador productos Journaway.xlsx`: 52 filas. 9 proveedores salen del
         Excel de paquetes, 21 son deducidos y 22 no tienen dato.
       - **El owner la completó (2026-10-11).** Todos los proveedores quedaron con "ok".
       - Los códigos van sin guion (SPAE05, IGRE01…). En celeste, lo que JW pide de verdad. Los
         tours sueltos de San Pedro (salvo SPAE05) solo vienen dentro de paquetes: el código queda
         como interno.
       - Tayka va dentro del Overland y lo reserva Imperio Inca. El Hotel Vai Moana se pide a CL
         Mundo. Don Raul no lo reservamos para JW.
       - Faltan en el directorio: **Patagonia Profunda** (FTEE03) y **Plataforma10** (BUS02 y
         BUS03, que son pasajes que emite HI Travel). Plataforma10 es tarea manual, no mail.
       - BUS04 dice el comentario "exacto, cuenca", pero el proveedor es Chalten Travel:
         probablemente sea un error de copiado.
       - El owner puso los códigos en el Word de precios de JW. Faltan algunos (SPAP01, SPAP02,
         SPAP04, SPAP06, SPAE05, BUS, FTE, PNTW, IGRT01 y la mayoría de IPC).
     - **Formato de los mails de JW (para M2):**
       - El nombre del tour cambia de una reserva a otra y a veces llega en alemán ("nach",
         "Abflug", "Reisender").
       - Un paquete llega como una lista de tours sueltos con fecha. El mail de SPAP05 trae 7 tours:
         4 de San Pedro + los 3 días del Overland.
       - Los hoteles los reserva JW y los vuelos vienen en el cuerpo del mail.
       - Hoy las mandan a operaciones3@ con copia al owner, no a sales@.
       - Propuesta del owner: pedirles que pongan nuestro código en cada reserva.
       - El owner puso a los clientes en la whitelist del antispam de Ferozo (2026-10-11):
         verificar que funcione.
    2. Arrancar M2 con `/roadmap M2`.
  - **Detalles menores que marcó el owner, para la próxima publicación:**
    - Los tramos de bus que emite HI Travel dicen "Pasaje que emite HI Travel. Sin proveedor."
      (`TEXTOS.tramoEmite`). El proveedor es **Plataforma10**: mostrarlo así.
    - "Transvipp" con doble p (viene del Excel de paquetes y de `data/equivalencias-proveedores.csv`).
      Corregir a "Transvip".
    - "Optiona" en vez de "Optional" en el traslado PNT de OD017. Viene del Excel de paquetes: que
      lo corrija el owner en el Excel, o normalizarlo al importar.
    - "También cosas menores" sin detallar: preguntarle cuáles.
  - Hallazgos menores de la auditoría UX, para después:
    - chips "Transfer de llegada/salida" con el mismo fondo que la fila del paquete;
    - ámbar usado en ajustes ya resueltos;
    - chip de proveedor en filas anuladas;
    - "Solo ida" en vez de "Solo llegada" para buses;
    - columna Origen repetitiva.
  - Supabase Auth: `uri_allow_list` vacía. El owner tiene que agregar `http://localhost:3000/**` y
    `https://automatizacion-dun.vercel.app/**`; si no, el login local lo devuelve a Vercel.
  - Costo: hoy US$ 0 (Vercel Hobby + Supabase Free). Para uso comercial corresponde Vercel Pro
    (US$ 20/mes), a decidir.
  - **Para M2 (owner, 2026-10-11):**
    - Confirmado el riesgo de la pregunta abierta 8 del PRD: los mails que el antispam de Ferozo
      manda a Spam en `sales@` NO se reenvían al Gmail de automation (pasó con TourRadar). Moverlos
      al Inbox después tampoco los reenvía.
    - Opciones: lista blanca en el antispam de Ferozo (tourradar, kilroy, journaway), o que M2 lea
      `sales@` por IMAP incluida la carpeta Spam (c1391889.ferozo.com:993). Se decide en
      `/roadmap M2`.
    - SMTP para M3: c1391889.ferozo.com:465 SSL, usuario operations@hitravel.com.ar.
    - El panel avisa que el hosting está cerca de la capacidad máxima.
    - Mails de ejemplo en `Insumos/Mails`: Kilroy, Journaway, PDFs de TourRadar y pedidos a
      proveedores.
  - **Journaway (3ª agencia en volumen; piloto de M2):**
    - Tarifario en `Insumos/San Pedro de Atacama, Iguazu, Patagonia and Easter Island Prices for
      Journaway 2027.docx`: ~45 productos simples (SPA, IGR, Patagonia, Ushuaia, Pascua, W Trek) y
      el Trip D, SPA + Overland privado con Tayka.
    - Reservan por nombre de tour, sin código. Van código HI Travel propio + nombre JW en
      `codigo_externo`.
    - **Pendiente acordado con el owner:** después de cerrar M1, armarle una planilla borrador
      (código sugerido, nombre JW, destino y proveedor deducido del directorio, en blanco si no se
      sabe). Él completa los proveedores.
  - Estimación dada al owner: primera prueba de M2 (un mail real entra como reserva) en unas 2
    semanas; recorrido completo en 4 a 6 semanas.

- **M1-08 y M1-09 terminadas (2026-10-11):** 635/635 tests + lint en verde (verificado por el loop
  principal). Migración 0009 aplicada. Reportes: `docs/sdd/diagnosticos/M1-08-traslados.md` y
  `M1-09-recarga.md`.
  **Siguiente:** el owner recorre en localhost 5C01, AR09, ARCH31, ARCH33, BOCHI04R, BRARCH26,
  OD016 y OD017. Con su OK se archiva M1 y se ofrece `/deploy`.
  - Para que confirme el owner (M1-09):
    - Las etiquetas siguen la regla "si se llega o se sale con un bus del tour, no aparece". Por
      eso también cambian COMPBO20 (en 5C01, BOCHI04R y CHB31) y OD030 en 5C01.
    - Si Imperio Inca recoge en la terminal de Uyuni, hace falta una excepción.
    - OD017 muestra "Opcional" y "A pedido". ¿Sobra una?
    - El Excel corrigió "Avi Verde" → "Aji Verde" en OD030.
- **Respuestas del owner a M1-08 (2026-10-10), resueltas en M1-09:**
  - OK: 5C01 sin el Transvip de Calama en OD030.
  - OK: ARCH31 termina en Punta Arenas, salvo pedido de traslado al aeropuerto PNT.
  - Corrigió el Excel de paquetes: OD016 ahora tiene la llegada; OD017 tiene la llegada PNT a pedido.
  - Borró la fila 119 del Excel de proveedores. El huérfano "Hosteria Fitz roy" ya se borró de la
    base con su OK.
  - Pidió corregir las etiquetas "Transfer de salida" dentro de ARCH31 y ARCH33.
  - **Para M3 (costos):** el bus SCL–VLP de 5C01 se cuenta dos veces en RutasenBus.
    - Una vez en la columna "SCL - VLP" (12,5 neto) y otra en "VLP 2 n", que es el total de
      COMPCH01 e incluye el bus ida y vuelta de 26 neto.
    - Recomendado: en los tours, COMPCH01 sin bus y el tramo en su columna, como los demás buses.
    - El owner lo deja para más adelante.
- **Ojo:** el test de M1-03 ahora usa `data/proveedores-borrados.csv`; antes reinsertaba filas
  borradas en la base real.

- **Último push a GitHub:** 2026-09-27, todo lo de la sesión (M1-03, M1-04, M1-04b, marca).
- **Verificación completa:** **M1-01 a M1-04b terminadas**, 243/243 tests + lint en verde (2026-09-27),
  corridas contra el proyecto Supabase real (no mocks).
  - M1-01: V3 confirmada el 2026-09-25 en `https://automatizacion-dun.vercel.app`, entrando con
    `operations@hitravel.com.ar` (se ve "Damian" en el header + botón Salir). También se confirmó
    el caso de rechazo: una cuenta fuera del dominio (`hitravelargentina@gmail.com`) es rechazada.
  - M1-02 (2026-09-26): las 6 tablas del catálogo (`proveedor`, `producto`, `producto_servicio`,
    `codigo_externo`, `producto_componente`, `importacion`) aplicadas con RLS activa; 52/52 tests
    en verde, incluido el recorrido completo (producto → servicios → proveedores → tour compuesto
    → código externo → importación, leído de punta a punta).
  - M1-03 (2026-09-27): importador del directorio de proveedores. En la base real quedaron 214
    proveedores (182 con mail, 8 por WhatsApp, 24 sin mail) y 4 celdas ambiguas, que quedaron
    sin mail. 132/132 tests en verde. Se corre con `npm run importar:proveedores`. Creó la tabla
    `uso_ia` (migración 0003, ya aplicada) para el techo de gasto (#3). El destino del proveedor
    se guarda en `proveedor.ciudad`.
    - **Pendiente:** el respaldo de IA nunca se llamó de verdad porque falta `ANTHROPIC_API_KEY`.
      Crear una clave de Claude, cargarla en `.env.local` y
      volver a correr el importador.
    - **Ojo para M1-06:** re-correr el importador pisa los mails, el canal y las aclaraciones
      corregidos a mano.
  - M1-04 (2026-09-27): 5 productos de Iguazú cargados (commit `a42aac3`, migración 0004
    aplicada). En total quedaron 29 filas de servicio, con niveles (Hostel/3*/4*/Glamping) y
    prioridades "/", y 15 códigos externos (HI Travel + Kilroy + TourRadar con su nombre).
    205/205 tests. Se corre con `npm run importar:productos`.
  - M1-04b (2026-09-27, commit `7e8dea3`, migración 0005): equivalencias de proveedores
    (`data/equivalencias-proveedores.csv` → tabla `proveedor_alias`) y niveles confirmados
    (`data/niveles-confirmados.csv`). Los 29 servicios quedaron con Booking Supplier y mail,
    salvo 2 casos. 243/243 tests.
    - **Beer = Tangoinn, confirmado por el owner:** los pedidos van a 2 mails,
      `beerhotel@tangoinn.com` y `beerhotel@cervezaholy.com`. El segundo mail se cargó
      **directo en la base**, y ya se perdió una vez: **los tests de integración de M1-03
      re-importan el Excel de proveedores sobre la base real** y lo pisaron. Se volvió a cargar.
      **Al retomar:** confirmar que el owner lo agregó al Excel de proveedores (celda Mail/web de
      Tangoinn: `beerhotel@tangoinn.com // beerhotel@cervezaholy.com`), copiar ese Excel al
      `Insumos/` del clon y correr `npm run importar:proveedores`. Recién ahí queda fijo.
    - **Ojo, trampa:** correr `npm test` re-importa los Excel sobre la base de producción. Todo
      dato cargado a mano que no esté en los Excel se pierde. Lo mismo va a pasar con las
      correcciones que permita M1-06 → decidirlo al planear M1-06 (base de test separada, o que
      el importador no pise ediciones manuales).
    - **Tetris se reserva por WhatsApp** (confirmado 2026-09-27). Falta que el owner lo sume al
      Excel de proveedores (nombre + WhatsApp); al retomar: re-importar proveedores, en el CSV
      poner `Tetris,Tetris,confirmado` y correr
      `npm run importar:equivalencias` y después `npm run importar:productos`.
    - "Extra glamping x pax" (OD011) queda para revisar hasta tener la IA.
    - Conviene borrar del Excel las líneas obsoletas "Green + Dann Inn" y "Dann Inn + Green".
    - Ahora "proveedor sin resolver" mira solo el Booking Supplier, que es a quien va el mail.
    - El traslado incluido solo figura como texto ("Includes: Transfer in + Out") en la
      descripción del paquete de excursiones: decidir cómo representarlo al planear M2.
- **M1-06 terminada (2026-10-06):** pantallas de solo lectura `/catalogo`, `/catalogo/[id]`, `/proveedores`, `/proveedores/[id]` y `/pendientes`, con el logo y los colores reales. Suite 485/485, build OK (commit `587495a`).
  - **Todas las piezas de M1 están en ✅. Falta el "probalo vos":** la app se levantó con `npm run dev` en el clon (`http://localhost:3000`). El owner la prueba y después la comparte con Leticia (ventas), Valentina y Alejandra (operaciones). Para eso hay que publicarla con `/deploy` y su OK, y cada una entra con una cuenta de Google de su mail @hitravel.com.ar (crearla si no la tienen, como se hizo con operations@). Con su feedback se ajusta el diseño. M1 se archiva recién con la confirmación del owner.
  - **Feedback del "probalo vos" (2026-10-09, revisó los tours largos).** Se resuelve en una pieza chica de correcciones antes de archivar M1:
    - **5C01:** la pantalla no despliega el tour anidado CHB31 (OD030 no se ve; el dato sí está). Calama–San Pedro en 5C01 = **bus Kupos terminal a terminal** (manual), no Transvip; Transvip (con una p) es solo el traslado desde el aeropuerto CJC.
    - **CH10** (W Trek Standard, 6 n) = 1 noche PNT antes (alojamiento como OD017) + 4 noches de refugios (Las Torres) + 1 noche PNT después. **CH10 solo no tiene bus de salida**; el bus PNT–PUQ (Kupos, manual) o el traslado al aeropuerto PNT (Patagonia Planet) aparece solo en ARCH33 y en la versión express. Express: **CH11** (5 n) y **ARCH33EXP**.
    - **BRARCH26:** OD029 sin transfer de salida.
    - **Excel de proveedores (el owner avisa cuando esté):** Tetris = 2ª opción de Bambu (WhatsApp), Cuenca del Plata: Natalia → Analia (ajustar la llave en `equivalencias-proveedores.csv`), WhatsApp de Antarctica (AR09). Después, reimportar.
    - **Para M3:** CL Mundo no usa estrellas: NH Santiago y Diego de Velázquez se piden como "3* SUP" (el nivel interno sigue siendo 3*). Puerto Natales (OD017, ARCH31, ARCH33): dorm → Puma, Last Hope; privada → Factoria, Last Hope, Puma.
    - **Para cuando se carguen los productos de JW:** el overland de COMPBO20 tiene una versión privada en hoteles Tayka, con bus a La Paz.
    - **Pregunta general del owner:** dónde se ven y aprueban los mails → M3 (pantalla "Revisar y enviar pedidos") y M4 (lista de reservas).
    - **Falta revisar:** productos cortos y el directorio.
    - **Idea post-MVP:** resumir con Claude los itinerarios largos de Wetu para el pax (subir el PDF → resumen de 2 a 4 páginas, revisado antes de mandarlo).
  - **M1-07 terminada (2026-10-09):** correcciones del probalo vos (ficha `docs/sdd/specs/M1-07-correcciones-probalo-vos.md`). Suite 533/533, lint y build OK; migración 0008 (`producto_servicio_noches`) aplicada. Reporte de la recarga: `docs/sdd/diagnosticos/M1-07-recarga.md`. Sigue el probalo vos del owner sobre 5C01, ARCH33, CH10 y BRARCH26.
    - **Para que decida el owner:** (1) 24 proveedores ya no están en el Excel y no se borraron: 20 de la sección "CHALTEN"; Chalten Travel (CHALTEN) y Hosteria Fitz roy (CHALTEN) siguen en uso en OD033/OD013/OD016 y hay que pasarlos a los de "EL CHALTEN" antes de borrar. (2) ARCH33 ahora figura terminando en Punta Arenas. (3) Imperio Inca pasó de WhatsApp a mail (afecta OD031, COMPBO20, CHB31, BOCHI04R). (4) Altas sin contacto: "Cuenca del Plata," y Madidi Amazon Lodge.
    - Fuera de alcance, a pedido: cargar CH11 y ARCH33EXP. El clon y Drive quedaron sincronizados (rama de respaldo `respaldo-m1-06-clon` en el clon).
    - **Respuestas del owner (2026-10-09):** (1) la sección correcta es "EL CHALTEN": en la próxima recarga se pasan los servicios de OD033/OD013/OD016 a Chalten Travel y Hostería Fitz Roy de EL CHALTEN y se borran los 24 viejos que ya no están en el Excel (los 4 que no son de Chaltén, solo si no están en uso). (2) Imperio Inca por mail: correcto. (3) ARCH33 terminando en Punta Arenas: correcto; el traslado a Puerto Natales con Patagonia Planet es solo a pedido del pax/agente (regla para M3). (4) Madidi ya tiene contacto. El owner sigue mejorando Iguazú en el Excel de proveedores: la recarga y la limpieza se hacen cuando avise.
    - **Recarga 2 (2026-10-10):** el owner separó Cuenca del Plata por hotel (el registro de antes es "El Pueblito, proveedor Cuenca del Plata") y sumó Madidi e Iguazú. Con su OK se borraron los 25 proveedores que ya no estaban en el Excel (20 eran copias de CHALTEN; siguen en EL CHALTEN). Equivalencias de Chalten Travel y Patagonian Group cargadas (Poincenot → Chalten Travel, confirmado). Reporte: `docs/sdd/diagnosticos/M1-07-recarga-2.md`. Suite 533/533. **Falta:** el probalo vos del owner para cerrar M1.
  - **Feedback 2 del "probalo vos" (2026-10-10), lista completa del owner.** Tema central: dentro de un tour, los traslados de cada paquete dependen de cómo llega y se va el pax (bus o avión). Hoy la pantalla muestra todos los servicios del paquete como si se vendiera solo. Pieza propuesta: M1-08.
    - **Se anulan en el tour (llega o sale en bus):** Greeters de OD020 (5C01) y OD018 (BRARCH26); Remis Mendoza de OD019 (el precio del tour ya va sin traslados); traslado SCL de CL Mundo en OD029 (5C01, BRARCH26; el owner evalúa reactivarlo con el cambio de precios de marzo-abril); traslados de OD025 y OD013 (AR09); traslados de OD016 (ARCH31, ARCH33: el bus CHA-FTE es de Chalten Travel y el FTE-PNT se emite por Plataforma 10). OD018 en AR09: solo el de llegada. OD022 en AR09: solo el de salida.
    - **Se transforman:** OD010D (5C01) y OD010A (BRARCH26): el 105 Premium se pide con transfer in desde la Rodoviaria de Foz y transfer out a la terminal de buses de Puerto Iguazú. OD031 (después de Uyuni): traslado de la terminal de buses a la llegada, no el del aeropuerto. OD030 en BOCHI04R: el Transvip CJC→SPA pasa a ser de salida, SPA→CJC. COMPCH01 en 5C01: sin bus de vuelta Valparaíso-Santiago (sigue a Calama). OD017 en ARCH31: no lleva el bus PUQ-PNT de llegada; termina con PNT-PUQ (aeropuerto o ciudad) o, a pedido, traslado al aeropuerto PNT, igual que ARCH33.
    - **Iguazú combined (OD010D):** noches 1-2 del lado BRA, noche 3 del lado ARG (Beer o El Pueblito), el día de la excursión argentina. Separar por noches, como CH10.
    - **Paquetes solos:** OD016: el traslado es el in, aeropuerto FTE → alojamiento; el out es opcional. OD017: traslado in opcional, aeropuerto PNT → alojamiento, a pedido del pax o del vendedor. OD019 tiene versión CON y SIN traslados (Remis Mendoza solo en la CON; depende de si llega en avión o en bus).
    - **5C01: el owner no ve CHB31 desplegado.** Revisar en el navegador (el test de recorrido pasaba).
    - **OD033:** el proveedor de Fitz Roy, Vertical Lodge y El Paraíso es **Patagonian Group** (también tiene hoteles en FTE); hoy figura como "Hosteria Fitz roy".
    - **Excel de proveedores actualizado por el owner:** mail de NH Cordillera y nuevo mail de reservas del Copacabana Mar (OD032). Hay que recargar.
    - **Conocimiento para M2/M3:** el bus Río→São Paulo llega a la Rodoviária Tietê, pero el São Paulo→Foz sale de Barra Funda (no de Tietê). El tour de bodegas half day (OD019) no sale los domingos: si cae domingo, mover el inicio del tour o buscar un tour que salga ese día (no es blackout). Los W Trek: el proveedor les cambia el nombre (hoy "Circuito W 5d/4n" = Standard y "Circuito W 4d/3n" = Express); nosotros los llamamos siempre igual, porque también se reservan con Vertice.
    - **OK del owner sin cambios:** CH10, CHB31 solo, ARCH33 día 12 (expresar igual en ARCH31).
  - `next dev` agrega solo un bloque "nextjs-agent-rules" a `CLAUDE.md`: no commitearlo. Se apaga con `agentRules: false` en `next.config`, si el owner quiere.
- **M1-05 terminada (2026-10-05):** los 7 tours compuestos (`npm run importar:tours`, reporte en `docs/sdd/diagnosticos/M1-05-tours.md`), en el orden del viaje según los Word, con noches, día de inicio, buses nocturnos, 5C01 → CHB31 anidado y el bus Uyuni–La Paz como servicio de Imperio Inca. Migración 0007. Suite 401/401.
  - **Respuestas del owner cargadas (2026-10-06):** el Budget del tour = el Hotel 3* del paquete (regla general), Hotel in SPA = 3*, ARCH33 3* en El Chaltén = Budget. Buses: Imperio Inca hace LPB↔UYU (y UYU↔CJC); Chalten Travel hace El Chaltén↔El Calafate (ya viene dentro de OD033, no se duplica en el tour); Santiago–Valparaíso por Kupos.cl y Calama–San Pedro por Transvip (manuales). Suite 414/414.
  - **Para M3:** Kupos Santiago–Valparaíso en 5C01 se solapa con el ida y vuelta de COMPCH01. Además, en una corrida completa falló una vez el test de RLS de M1-02 (`anon`), y solo pasa 7/7 y en otra corrida completa: vigilar si es inestable por la conexión.
  - **Abierto para M3:** la equivalencia de categorías hoy se controla en el reporte, pero no se guarda en la base; el día y si es nocturno de los buses con proveedor quedan solo en la descripción.
  - **Próximo paso:** M1-06 (pantallas de Catálogo y Directorio, con el logo). Antes, decidir cómo proteger las correcciones manuales de las re-importaciones y de los tests.
- **M1-04d terminada (2026-10-05):** los 17 paquetes de un destino de los 7 tours, cargados en la base real (`npm run importar:paquetes`, reporte en `docs/sdd/diagnosticos/M1-04d-carga.md`). Son 146 servicios: 126 con mail, 13 por WhatsApp y 4 manuales (Kupos.cl, Buquebus, TRANSVIP). Migración 0006 (alias por destino). Suite 352/352, lint y tsc limpios.
  - **Pendientes del owner** (el dato va en el Excel de proveedores; después se re-corre `importar:proveedores` → `importar:equivalencias` → `importar:paquetes`): NH Cordillera (mail), Antarctica Hostel (el WhatsApp está en la columna de aclaraciones; pasarlo a la de contacto), O Hostel GRU (São Paulo, falta cargarlo). Además conviene limpiar unos 20 proveedores duplicados como "CHALTEN" / "EL CHALTEN".
  - Con OK del owner se borró de la base "Selina La Paz" (cerró).
  - `niveles-confirmados.csv` tiene una columna opcional `forzar` para pisar un nivel mal detectado (OD032 fila 875).
  - **Próximo paso: reescribir la ficha de M1-05** (`/specs M1-05`) con los códigos de RutasenBus, los itinerarios de los Word, el tour dentro de otro tour, las noches de más o de menos, los servicios incluidos en otro paquete, los tours al revés y la tabla de categorías tour ↔ paquete. Después, `/implementar M1-05`.
  - **Harness del curso (2026-10-05):** se instaló `/revisar-ia` (skill `ia-reviewer`) y los retoques de `/arquitectura`, `/specs` y `architecture-author`, que el owner había copiado por error dentro de `.claude/.claude/`. Se conservó el link del tablero en `dashboard.md`. La copia duplicada quedó fuera del repo (en el scratchpad).
- **M1-04c terminada (2026-10-03):** diagnóstico de los 17 paquetes de los 7 tours, sin escribir en la base. El reporte está en `docs/sdd/diagnosticos/M1-04c-paquetes-de-los-tours.md` (+ `.json`) y se corre con `npm run diagnosticar:paquetes`. La lista de códigos vive en `data/paquetes-piloto.csv`. Suite 302/302 (el test de M1-03 ahora admite más de 220 proveedores, porque el directorio ya tiene 227).
  - **Esperando al owner:** `Insumos/Borrador respuestas diagnostico paquetes.xlsx`, con 44 proveedores (18 de confianza alta), 4 renglones sin proveedor, 18 alojamientos sin categoría y 9 casos sueltos. Con eso se escribe la ficha de M1-04d.
  - **Respuestas del owner al borrador (2026-10-03), leídas y cruzadas con el directorio (227):**
    - **Equivalencias a cargar en M1-04d:** las 18 marcadas "ok" más estas, que están con otro
      nombre: Alvarez Arguelles → Hotel Grand Brizo Buenos Aires; Loi Suites → Loi flats buenos
      aires; Up Hoteles → Patios San Telmo; Las Torres (antes "Fantástico Sur") → W trek LAS
      TORRES; Vertice → W trek VERTICE (en CH10 depende del programa); Dazzler (Maipú) →
      Reservas Dazzler Maipu'; Buzios Transfers → buzios transfer; Transporte Las Lengas → Las
      Lengas; Copacabana Mar → Copacabana Mar hotel; Nacional Inn en Río → Nacional inn
      Copacabana.
    - **Respuestas del owner (2026-10-03):** Local 55 = "Rodrigo Perez" (confirmado). "Alex" es un
      taxi privado de Río, plan B (va al directorio con su contacto). "Amonite" es un hostel de
      Puerto Madryn (el owner averigua el mail). **Pendientes de que el owner los verifique:** All
      Peninsula Valdés = "Peninsula valdes"?; Always Glaciers = "calten tour / ALWAYS"? (no sabe
      qué es "calten tour": ¿Chalten Travel?).
    - **Faltan en el directorio** (el owner los agrega al Excel de proveedores): Antarctica Hostel
      y Anum Hostel (Ushuaia); Aji Verde (San Pedro; el Excel dice "Avi Verde" por typo); Bamboo
      Rio Hostel, El Misti Ipanema e Ipanema Beach Hostel (Río); Dazzler San Martín (BA; Dazzler
      se reserva hotel por hotel); Dazzler Puerto Madryn; El Gualicho Hostel (Madryn); Del
      Glaciar (Pioneros / Libertador, Calafate); Tremun (Calafate y Ushuaia); Patagonian Group y
      Patagonia Hostel (Chaltén); Rochester Concept (BA, central distinta de Calafate); NH
      central (para NH Santiago) y NH Cordillera (Mendoza, el owner averigua el mail); Receptivo
      Chalten (Fitz Camp opcional); The Adventure Brew Hostel (La Paz, WhatsApp).
    - **Excel de proveedores actualizado por el owner (2026-10-05, en `Insumos/`):** se agregaron casi
      todos los faltantes. All Peninsula = "Peninsula valdes" (agencia@allpeninsulavaldes.com) y
      "calten tour / ALWAYS" pasó a "ALWAYS Glaciers" (calafatehostel@alwaysglaciers.com). NH
      Santiago se reserva por CL Mundo. **Siguen faltando:** Tetris, Patagonian Group, Patagonia
      Hostel (Chaltén), NH Cordillera y Amonite. **Imperio Inca quedó solo con WhatsApp**
      (Overland, bus Uyuni–La Paz y Sagarnaga serían manuales; falta que el owner confirme).
      **Tremun** no tiene central, va hotel por hotel (Las Hayas en Ushuaia, Yene Hue en Madryn):
      falta saber cuál es el de Calafate (OD013/OD016). Dazzler San Martín está duplicado (filas 8
      y 16, mismo mail).
    - **Falta el mail de Imperio Inca:** está en el directorio pero sin mail, y es crítico
      (Overland COMPBO20, bus Uyuni–La Paz y Hotel Sagarnaga en La Paz).
    - **Kupos.cl** es un sistema online de pasajes de bus en Chile, con claves de HI Travel: no
      es un proveedor al que se le escribe; ese tramo queda manual.
    - **Categorías confirmadas:** OD018/OD020 → Milhouse = Hostel, Merit/Loi/Rochester =
      Budget, Dazzler/Patios = 3*, Brizo/NH City = 4*; OD025 = Hostel; OD029 → Providencia =
      Hostel, Diego de Velázquez/NH = 3*; OD030 = Hostel; OD031 = Budget; OD033 → Rancho
      Grande/Pioneros/Patagonia = Hostel, Kau Si Aike/Poincenot/… = Budget ("funcionan también
      como 3*"); OD017, CH10 y COMPCH01 = 3*.
    - **Para M1-05:** en los tours largos las categorías no son homogéneas y "Budget Hotel" del
      tour puede corresponder al 3* del paquete (ej. Río: Nacional Inn y Copacabana Mar son 3* y
      el tour los llama Budget). Hace falta una tabla de equivalencia de categorías tour ↔
      paquete.
    - Los 4 "Excursions en …" son títulos de sección; las notas de precios de OD013/OD016 se
      ignoran; destinos: OD033 = CHA, CH10 = PNT + Torres del Paine, COMPBR10 = SAO.
  - **Hallazgo para M1-04d:** las equivalencias tienen que depender del destino. "Nacional Inn" en Río (OD032) quedó emparejado con Nacional Inn Foz y debería ser Nacional inn Copacabana. Además, el lector tiene que tolerar los typos de "Booking Supplier" (Bookind, Suplier, Booking Booking) y las "Optional Excursion".
  - El builder se colgó 3 veces por el watchdog (esperando la suite completa sin salida). El cierre lo hizo el loop principal.
- **Plan activo:** `docs/sdd/roadmaps/active/m1-catalogo-y-proveedores.md` — M1-01 a M1-04b
  ✅ **terminadas**, M1-05 y M1-06 ⬜ pendientes.
  - **Hueco detectado (2026-09-28): M1-05 no puede correr así como está.** Los 7 tours
    compuestos se arman con paquetes de un destino que no están cargados (solo está Iguazú).
    **Decisión del owner:** antes de M1-05 va una pieza nueva que carga **solo los paquetes
    de un destino que forman los 7 tours** (~15 destinos, reusando el importador de M1-04). No
    se suman otros destinos (Salta, Bariloche, etc.): el resto del catálogo va después del MVP.
    Conviene partirla por región.
  - **Antes de escribir esa pieza, el owner completa los códigos** (propuesta suya del
    2026-09-14, PRD §6 punto 9). Casi ningún paquete de un destino tiene código en el Excel
    de paquetes: solo Iguazú, Mendoza (OD019), Ushuaia (OD022/023) y El Calafate
    (OD013-016, AR34). Borrador para completar: `Insumos/Borrador codigos tours featured.xlsx`,
    con cada columna de cada tour de la hoja "Tours 2027". Pasos:
    1. Poner el código en el título de cada paquete, en el Excel de paquetes.
    2. Agregar una fila "Códigos:" en cada tour del Excel de rutas.
    Faltan aclarar: dónde está armado BOCHI04R (no aparece en "Tours 2027"); si
    "SPA+UYU end LPB" en 5C01 es el CHB31 entero; y si São Paulo, Valparaíso, W Trek y
    Colonia tienen un bloque de paquete propio.
  - **Criterio del owner (2026-09-28):** los paquetes que solo existen como componentes de
    un tour (no se venden solos) **también llevan código**, para que todo quede normalizado.
    Cada componente en `RutasenBus` apunta a un código del Excel de paquetes o del "resumen
    NewTours", que es `Insumos/New 2019 Rates para IA.xlsx` (hoja "New Rates"; confirmado
    por el owner 2026-09-28).
  - **En paralelo, no bloquea M1 (acordado 2026-09-28):** el owner va a dejar en `Insumos/` 2 o 3
    mails reales que el equipo manda hoy a proveedores (ej. Cuenca del Plata, Nacional Inn Foz
    en portugués, un hostel), como PDF. Con eso se arma un **boceto visual** de la pantalla
    "Revisar y enviar pedidos" (user-flow §5.4) con un caso real de Iguazú, para validar el
    formato del mail antes de M3.
  - **Pedido nuevo del owner (2026-10-01), cambio de alcance pendiente de decidir:** al
    recibir una reserva (Kilroy, Jysk, TR), saber **quién la originó** (sucursal / vendedor,
    ej. DK tiene muchas) para mandarle un "recibido". Hoy el modelo guarda agencia +
    remitente + booking_id, no sucursal ni vendedor, y el PRD §5 deja **fuera** cualquier
    respuesta a la agencia. Propuesta: extraer el originador en M2 y dejar el "recibido" como
    borrador con aprobación (#4), en M3 o al final de M2. Falta que el owner deje en
    `Insumos/` 2-3 mails de Kilroy/Jysk de sucursales distintas y aclare quién manda hoy ese
    "recibido" y a qué dirección. Cuando se decida: actualizar `prd.md` y `DECISIONS.md`.
  - **Ejemplos de pedidos a proveedores (2026-10-01):** 8 `.docx` en `Insumos/` ("Pedido
    Proveedor - <proveedor> <código>"): Cuenca del Plata OD010A y OD010B, Beer Hostel OD010A,
    Milhouse, Grupo Summa y La Bicicleta Naranja OD018, Rancho Grande + Chalten Travel OD033 y
    Chalten Travel OD016. Todavía **sin revisar**. El owner va a sumar más, además de los
    mails de reserva de Kilroy/Jysk.
  - **TourRadar no lleva "recibido" por mail:** se maneja desde el dashboard de TR.
  - **Boceto "Revisar y enviar pedidos" publicado (2026-10-02):**
    https://claude.ai/artifact/AKMKXxY6wRxAFY4qhEwp48 (fuente:
    `docs/arquitectura/bocetos/revisar-y-enviar-pedidos.html`, con pasajeros inventados).
    Caso: Kilroy OD010D, nivel Hostel, con 4 mails: el recibido a Kilroy, Bambu en portugués,
    Beer a sus 2 mails y Cuenca Paquete 105. Espera las 5 respuestas del owner que lista el
    propio boceto.
  - **Encadenado de fechas en tours largos (M1-05) — resuelto con los Word de catálogo
    (2026-10-02).** El owner subió 4 Word ("One / Two / Multi Destination / Unique Tours 1 Jun
    2026 - 31 Dec 2027.docx", fuente de Wetu) con todos los tours, menos Easter Island.
    - Cada tour trae el código en el título ("ARCH31- Patagonia Highlights (8 nights)"), un
      itinerario "DAY N: lugar" y un "What's Included" con "N nights Accommodation in X" y
      "Night Bus from A to B".
    - Ejemplo, 5C01: "overnight bus" de São Paulo a Foz (17 h), de Iguazú a Buenos Aires, de
      Buenos Aires a Mendoza y de Valparaíso a Calama (20 h).
    - **Están los 7 del piloto**, incluido **BOCHI04R** ("OVERLAND UYUNI TO SAN PEDRO DE
      ATACAMA BEGINNING IN LA PAZ (7 DAYS)").
    - Ya **no hace falta** la columna "Nocturno sí/no" en la hoja de buses.
    - **Cómo se usa:** el Word da la secuencia de días, las noches y los buses nocturnos; el
      Excel da los códigos y los proveedores. Si los dos no coinciden, el tour va a revisión.
      El resultado se controla contra las fechas de inicio y fin que manda la agencia.
    - Ojo: algunos tours dicen "Tour can be done vice versa".
  - **Revisión de los ejemplos (2026-10-02):** 8 pedidos a proveedores y 6 reservas de Kilroy
    (Aarhus, Copenhague, Oslo, UK). Todavía no hay ninguno de **Jysk**.
    - **CORRECCIÓN a M1-04:** Kilroy **no siempre usa nuestros códigos**. Su "Tour code" es,
      por ejemplo:
      - `HI_ARGENTINA_OD010D-677` (contiene el nuestro)
      - `HI_ARGENTINA_ARCH31-677`
      - `HI_TRAVEL_5C01-677`
      - `HI_ARGENTINA_W_TREK_ARCH_33-677` (con guion bajo en el medio)
      - `HI_ARGENTINA_OVERLAND_7DAYS-677` para CHB31 (no contiene nuestro código)
      - el formato viejo, tipo hotel, que no trae código: "HI - Rio de Janeiro Starter
        Package (Cabanacopa Hostel)"

      Las filas "Kilroy = OD0xx" de `codigo_externo` son una suposición. Hace falta un listado
      de códigos Kilroy, como el de TR, o una regla más el listado para las excepciones.
    - **Kilroy, quién originó la reserva:** el remitente es la casilla de la sucursal
      (`aarhus@kilroy.dk`, `copenhagen@kilroy.dk`, `oslo@kilroy.no`,
      `travels@kilroy.co.uk`) o un vendedor "en nombre de" la sucursal. El vendedor firma al
      final. El cuerpo dice explícitamente "Please reply with your confirmation … on
      <dirección>" y "Your reply mail should include this message". El "recibido" es un
      reply a esa dirección citando el mail.
    - **Kilroy, formato:** "Tour name / Type / Tour code / Start–End city y date / KILROY
      Reference" y una lista de pasajeros (nombre, nacionalidad, género, fecha de nacimiento,
      email; pasaporte casi nunca).
      - "Type" da el nivel y la habitación ("Dormitory - Hostel", "Double Room - Hostel",
        "Dormitory - Hostel and W-Trek Tent").
      - Un mail puede traer **2 reservas** (TOUR 1 + TOUR 2) con los mismos pasajeros y la
        misma referencia.
      - "Flight info" casi siempre viene vacío.
    - **Pedidos a proveedores, patrón actual:**
      - **Remitente:** sale de `operaciones1@` (el operativo) o de `operations@`. CC a
        `operations@` y `ccalomarde@`.
      - **Asunto:** "Reserva <titular> x<pax>".
      - **Cuerpo:** "Buen dia! como estas? Quisiera solicitar la siguiente reserva:"; los
        servicios numerados si son varios; después los pasajeros y la firma ("Quedo atenta,
        Saludos!" + Instagram + teléfono de guardia).
      - **Bloques tipo:**
        - Alojamiento: nombre, IN, OUT, N PAX, "Hab doble/single/triple con desayuno".
        - Excursión: servicio con fecha, N PAX, idioma y "Alojamiento: <hotel>" para el
          pickup.
        - Paquete de Cuenca: "PKT 105 en Premium regular x IGR/Foz", con TRF IN (bus o vuelo
          + hora), lado arg, lado bra, TRF OUT y "Tiene alojamiento en: X (reservado aparte)".
      - Los datos que se piden de cada pasajero varían según el proveedor (pasaporte, fecha de
        nacimiento, nacionalidad, teléfono; género para el seguro del bike tour). Lo que falta
        se escribe "pendiente" ("Vuelo pendiente aun", "cuando me pasen pasaportes…").
      - Los agregados posteriores van como reply en el mismo hilo.
      - El proveedor contesta con un número de confirmación (ej. IP5048) y una liquidación o
        voucher adjunto.
      - Todavía no hay ningún ejemplo en portugués.
  - **Aclaración del owner sobre el "recibido":** es un **reply al mail original**. El
    remitente suele ser el vendedor y a veces la casilla de operaciones de la agencia. No hace
    falta un registro de sucursales ni vendedores: alcanza con responder en el mismo hilo.
  - **Excel con códigos, ya en `Insumos/` (2026-10-01), revisados:**
    `Construccion de Paquetes 2019 con 3 y 4 estrellas.xls`, `New 2019 Rates.xlsx` y
    `RutasenBus2020.xls`. Son los nuevos; los "para IA" quedan como versiones viejas.
    - En RutasenBus, cada tour tiene una **fila de códigos justo arriba de "Net Prices:"**, con
      el código sobre la columna de cada paquete. Las columnas de bus quedan vacías.
    - Los **19 códigos usados existen** en el Excel de paquetes (y la mayoría también en
      New Rates): OD010A/D, OD013, OD016, OD017, OD018, OD019, OD020, OD022, OD025, OD029,
      OD030, OD031, OD032, OD033, CH10, COMPCH01, COMPBO20 y CHB31.
    - **São Paulo y BOCHI04R, resueltos (2026-10-02):** la columna "SAO 2 n" del 5C01 tiene
      **COMPBR10** ("Sao Paulo 2 nights": Soos Hotel / Nacional Inn Jaraguá, BS Sooz Hotel /
      Nacionalinn; va a necesitar su propia equivalencia y su mail, distinto del de Foz).
      BOCHI04R tiene su bloque al final de RutasenBus (fila ~840) con OD030 + COMPBO20, en el
      orden de columnas del CHB31. El orden real del viaje sale del Word, no del Excel.
      Historial de lo acordado: **Acordado con el owner (2026-10-01):**
      - **São Paulo** (son 2 noches sueltas): el owner crea un paquete componente con código
        (estilo COMPCH01), con su línea "Accommodation … Booking Supplier", y lo pone en la
        columna "SAO 2 n".
      - **BOCHI04R** tiene los mismos proveedores que CHB31, en orden inverso. El owner agrega un
        bloque mínimo en RutasenBus con la fila de códigos en el orden del viaje (COMPBO20 →
        OD030) y anota al lado cualquier diferencia (ej. el transfer final a Calama).
      - **"(menos/mas N noche/s)":** el sistema usa la anotación de texto, no la fórmula de
        precio, para ajustar las noches que se le piden al proveedor. El owner las escribe
        siempre con ese formato.
    - **Para el diseño de las piezas nuevas:**
      - Hay anotaciones de variante: "OD019 (menos 1 noche)" y "OD016 (mas 1 noche)".
      - Hay paquetes que incluyen otro servicio: "(esta incluido en CH10)" para el W Trek.
      - Hay un **tour dentro de otro tour**: el 5C01 usa CHB31 entero como componente.
      - Los paquetes de un destino a cargar son unos 16 códigos: OD013, OD016, OD017, OD018,
        OD019, OD020, OD022, OD025, OD029, OD030, OD031, OD032, OD033, CH10, COMPCH01 y
        COMPBO20 (OD010A/D ya están cargados). El Excel de proveedores ya está actualizado en
    `Insumos/`: tiene los 2 mails de Beer separados con "/", que el importador lee bien. Falta
    la fila de Tetris.
  - **Próximo paso:** con los códigos completos, `/roadmap` para sumar la pieza (o piezas)
    nuevas al plan de M1 y escribir sus fichas. Después, M1-05.
  - `marca.md` actualizado con los colores del logo real. El logo entra en M1-06 (requisito
    #13 de su ficha).
  - El clon `C:\Users\gs\dev\hi-travel-automatizacion` quedó sincronizado al cierre del
    2026-09-27; igual hacer `git pull` antes de construir.
- **App en vivo:** `https://automatizacion-dun.vercel.app` (proyecto Vercel bajo la cuenta
  `ccalomarde@hitravel.com.ar`, conectado al repo de GitHub).

## Cómo se resolvió M1-02 — dos trampas técnicas de infraestructura (para no repetirlas)

- **La conexión "directa" a Postgres (`db.<ref>.supabase.co:5432`) solo resuelve IPv6, y esta red
  bloquea ese tráfico saliente** (probable firewall). El CLI de Supabase (`db push`/`migration
  repair`) fallaba con timeouts de conexión que parecían un problema de contraseña, pero no lo
  eran. Solución: usar el **connection pooler** de Supabase en su lugar —
  `aws-0-ca-central-1.pooler.supabase.com:5432`, con usuario `postgres.<project-ref>` (no
  `postgres` a secas) — que sí resuelve por IPv4 y conecta bien. Si en el futuro el CLI de
  Supabase falla con "Connection terminated unexpectedly" al conectar a la base real, probar
  primero con el pooler antes de sospechar de la contraseña.
- **La migración `0001_usuario.sql` (aplicada a mano en el SQL Editor durante M1-01) nunca quedó
  registrada en el historial de migraciones del CLI.** Al correr `supabase db push` por primera
  vez, el CLI intentaba reaplicar `0001` (fallaría por policy duplicada) antes de llegar a `0002`.
  Se reparó con `supabase migration repair 0001 --status applied` (comando estándar del CLI, solo
  actualiza la tabla de tracking, no toca el esquema) antes de aplicar migraciones nuevas.

## Cómo quedaron armadas las 3 cuentas externas (para referencia futura)
  1. ✅ **Cuenta creada en [vercel.com](https://vercel.com)** — plan Hobby, con
     `ccalomarde@hitravel.com.ar`. Falta: crear el proyecto conectado al repo + cargar variables
     (paso 3 de más abajo).
  2. ✅ **Proyecto Supabase creado y funcionando** — nombre "Automatizacion Hi Travel", región
     Canada (Central), status Healthy, project ref `uhwkifqmexdktaseaxxo`.
     - ✅ Las 3 claves ya copiadas por el owner a una nota personal (no viven en este repo, están
       en su nota de celular): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
       `SUPABASE_SECRET_KEY` (Supabase renombró `service_role` → `secret key` / `anon` →
       `publishable key` en su UI nueva — mismos valores, usar el nombre de variable que pide
       `.env.example`, no el que muestra Supabase).
     - ✅ Migración `0001_usuario.sql` corrida a mano en el SQL Editor de Supabase — la tabla
       `usuario` con RLS ya existe en la base real.
     - ⬜ **Falta: habilitar el proveedor Google en Authentication → Providers** — depende del
       paso 2 de abajo (necesita el Client ID/Secret de Google Cloud).
  3. ✅ **Google Cloud — resuelto el 2026-09-23, con otra cuenta:** `ccalomarde@hitravel.com.ar`
     quedó bloqueada por una sesión de Google forzada a nivel equipo/navegador (se abría
     `hitravelargentina@gmail.com` incluso en incógnito). Se decidió seguir con
     **`hitravelargentina@gmail.com`** en su lugar — en `ccalomarde` solo existía el proyecto
     vacío, nada configurado, así que no se perdió ni se duplicó trabajo. Proyecto de Google Cloud:
     "Automatizacion HI Travel" (bajo `hitravelargentina@gmail.com`).
     - ✅ Pantalla de consentimiento OAuth configurada y publicada (tipo External).
     - ✅ Credencial OAuth creada ("HI Travel Supabase Auth", Web application) con el redirect URI
       `https://uhwkifqmexdktaseaxxo.supabase.co/auth/v1/callback` cargado en **"URIs de
       redireccionamiento autorizados"** (ojo: NO en "Orígenes autorizados de JavaScript" — ese
       campo no acepta rutas con `/` y tira error si se pega ahí).
     - ✅ Client ID y Client Secret copiados a la nota personal del owner.
     - ✅ Activado en Supabase → Authentication → Providers → Google, con esas claves. (Cierra el
       punto 2 de arriba.)
  4. ✅ **Proyecto en Vercel conectado al repo de GitHub**, con las 4 variables cargadas
     (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
     `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=hitravel.com.ar`). Deploy funcionando en
     `https://automatizacion-dun.vercel.app`.
  5. ✅ **Cuenta de Google creada para `operations@hitravel.com.ar`** (usada para probar el login,
     2026-09-25) — como los mails de `hitravel.com.ar` viven en Ferozo (no son Google Workspace),
     hubo que crearle una cuenta de Google de cero vía "Crear cuenta → Usar mi dirección de correo
     actual". Sirve como cuenta real del dominio para futuras pruebas de login. La contraseña la
     tiene el owner.

  **Dos trampas que costaron tiempo, documentadas para no repetirlas:**
  - **Cuenta de Google `ccalomarde@hitravel.com.ar` inutilizable en este equipo:** el navegador (y
    hasta el celular) fuerza siempre la sesión de `hitravelargentina@gmail.com` al intentar
    loguearse con `ccalomarde`, incluso en incógnito, con la contraseña cambiada y sin mail de
    recuperación. Causa exacta sin confirmar (algo a nivel cuenta de Google, no del dispositivo).
    Se resolvió evitando esa cuenta: Google Cloud quedó bajo `hitravelargentina@gmail.com`, y para
    probar el login de la app se usó `operations@hitravel.com.ar` (cuenta nueva, sin ese lío).
  - **Client Secret de Google mal transcrito → login fallaba con "Unable to exchange external
    code":** el secreto se había copiado a mano desde una captura de pantalla (un carácter
    ambiguo, `O` vs `0`). Se resolvió generando un secreto nuevo en Google Cloud (Credentials →
    el cliente OAuth → botón **"Add secret"**, no hay botón "Reset" en la UI nueva) y copiándolo
    con el ícono de copiar, nunca a mano. Lección: cualquier secreto de Google siempre copiar con
    el botón, jamás transcribir desde una imagen.
- **Ojo con:**
  - **Push a GitHub:** sigue pendiente — correr `git push` desde una terminal real. Vercel necesita
    esto para conectar el repo.
  - **Entorno de desarrollo:** el repo vive en una carpeta sincronizada por Google Drive
    (`G:\Mi unidad\...`), y `npm install` ahí es lento/inestable (no admite symlinks). El builder
    lo resolvió instalando y verificando en un clon fuera de Drive
    (`C:\Users\gs\dev\hi-travel-automatizacion`) y volcando el código verificado al repo real —
    quien siga construyendo debería hacer lo mismo, o mejor, considerar mover el proyecto fuera de
    una carpeta sincronizada por Drive más adelante (Git/GitHub ya es el respaldo real).
  - **PDF de TourRadar (4 ejemplos en `Insumos/`, revisados 2026-09-27) — insumo para M2:**
    - Traen: nombre del tour, fecha de salida, TourRadar Reference ID (= booking id), nombre del
      cliente, a veces "HI Travel booking ID" tipo "Nombre x2", y líneas de detalle con cantidad
      (ej. "2 × tour", "DOUBLE Hostel", "Dorm Hostel", "Hotel La Aldea 4* SGL", "Other").
    - **NO traen el código TR del producto** (160955, etc.): el emparejado tiene que ser por
      **nombre del tour**, que coincide exacto con la columna "Nombre en Tourradar" del Excel
      de códigos TR. Por eso ese nombre hay que guardarlo, no solo el código.
    - **NO traen datos de vuelo** ni los demás pasajeros: están en el dashboard de TR y el equipo
      se los pide al pax por la conversación interna. **Decisión del owner:** el pedido al
      proveedor sale igual con "Vuelos: por confirmar" (o queda preparado para que el operativo
      complete el dato antes de aprobar). Esto matiza la regla "vuelo obligatorio con traslado"
      de `DECISIONS.md` para TR — registrarlo al planear M2.
    - Un mismo Reference ID recibe **varios statements**: la reserva original, **agregados
      posteriores** (ej. un statement con solo "Other") y **cancelaciones** ("BOOKING
      CANCELLATION STATEMENT", montos negativos). M2 agrupa por Reference ID y trata los
      siguientes como cambios a la reserva, no como reservas nuevas.
    - Las líneas extra cambian el pedido al proveedor:
      - **Nivel de alojamiento** elegido por el pax (hasta 4: Hostel / Budget Hotel / Hotel 3* / Hotel 4*;
        en Iguazú 3* = El Pueblito, 4* = La Aldea); más el tipo de habitación (Dorm/Double/Single). Cada nivel tiene
        su propio proveedor → M1-04 los carga como niveles separados.
      - **Opcionales** (ej. "Optional Whales Watching Sailing", "Optional Punta Tombo Penguin
        Colony") → servicios extra a pedir.
      - **Reemplazos** (ej. "Supplement Flight El Calafate to Ushuaia instead of the bus") → se
        saca el bus del pedido; el vuelo se gestiona aparte.
      - "Other" solo, sin descripción → para revisar.
  - **Alcance de M1-04 confirmado (2026-09-27):** 5 productos de Iguazú — OD010A/B/C/D + OD011
    (Iguazu Glamping) — vendidos por Kilroy y TourRadar. Ficha actualizada.
  - **Riesgo grande:** leer el Excel de paquetes (2218 filas, bloques por columna) es lo más
    difícil del proyecto — es su propia spec (M1-05, ya escrita) después de probar con productos
    simples (M1-04).
  - **Casilla de mail** (no bloquea M1, sí M2): confirmado — Gmail al que Ferozo reenvía
    `sales@hitravel.com.ar`, regla de servidor, US$0.
  - **Remitente de pedidos a proveedores** (no bloquea M1, sí M3): tiene que salir como
    `operations@hitravel.com.ar`, no desde el Gmail de lectura. Mecanismo exacto (SMTP de Ferozo
    vs. Resend) pendiente — el owner lo va a confirmar con quien administra el dominio.
  - Make y el Google Sheet MVP quedan **dados de baja** (se apagan al terminar M2); no son parte
    de la solución. El aprendizaje (campos a extraer, filtro "NEW BOOKING", 36 reservas de prueba)
    se reusa.
  - **Alcance del MVP:** tours compuestos (7 top-seller) entran desde M1. Journaway pospuesto.
    Datos de vuelo obligatorios cuando hay traslado. Proveedores por WhatsApp y tramos de bus
    externo quedan manuales. Dedupe de reservas por booking_id+producto. Asana anotado como
    candidato post-MVP. Detalle completo en `DECISIONS.md`.

## Estado del método (los 8 comandos)

- ✅ `/prd` — `docs/prd.md` escrito, con el alcance de tours compuestos ya incorporado.
- ✅ `/arquitectura` — 8 documentos en `docs/arquitectura/`; constitución con dueños #1-#4.
- ✅ `/roadmap M1` — plan con 6 piezas en `docs/sdd/roadmaps/active/`.
- ✅ `/specs` — las 6 fichas escritas en `docs/sdd/specs/` (M1-01 a M1-06).
- ✅ `/implementar M1-01` — terminada, las 3 verificaciones en verde, app real desplegada y
  probada en `https://automatizacion-dun.vercel.app`.
- ✅ `/implementar M1-02` — terminada, esquema del catálogo aplicado al proyecto real, 52/52 tests
  en verde.
- ✅ `/implementar M1-03` — terminada, 214 proveedores cargados, 132/132 tests en verde.
  Siguiente pieza: `/implementar M1-04`.
