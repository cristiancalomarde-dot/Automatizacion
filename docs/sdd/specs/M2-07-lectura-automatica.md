# M2-07 · Lectura automática de sales@

**Depende de:** M2-06

## 1. Qué queremos lograr
Que la app lea sola la casilla `sales@hitravel.com.ar` una vez por día, a las 12 del mediodía,
y que las reservas de Kilroy, TourRadar y Journaway entren al sistema sin que nadie cargue nada.
Esto incluye las que el antispam de Ferozo mandó a Spam. La app solo mira: no marca, no mueve y
no borra ningún mail. El owner ve en la lista de reservas si la última lectura anduvo.

## 2. Qué hay hoy
- **M2-01:** las tablas `reserva`, `evento_reserva` y `mail_recibido`, y la lista de agencias y
  remitentes conocidos en `data/agencias.csv`.
- **M2-02 a M2-04:** el circuito que convierte un mail en una reserva: lo lee con IA bajo el
  techo de gasto, reconoce el producto y detecta si es el mismo intercambio.
- **M2-05:** la lista y el detalle de reservas, de solo lectura.
- **M2-06:** el modo prueba. Procesa mails de archivo (`.eml`, `.docx`, `.pdf`) por el circuito
  completo y marca las reservas "de prueba". Esta pieza reusa ese mismo circuito. La única
  diferencia es de dónde viene el mail: de la casilla y no de un archivo.
- **Decisiones del 2026-10-11** (`DECISIONS.md`): IMAP directo a `sales@` en Ferozo, Inbox y
  Spam; una lectura por día a las 12:00 hora Argentina (15:00 UTC); Journaway entra en M2.
- **No hay** ninguna ruta `src/app/api/`, ni `vercel.json`, ni ningún cron configurado.
- **La clave de `sales@` todavía no está:** se la consigue Leticia al owner.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

**Conexión y carpetas**

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Se conecta por IMAP con SSL a `c1391889.ferozo.com:993` con la clave de `sales@`. Lee el servidor, el usuario y la contraseña de `SALES_IMAP_HOST`, `SALES_IMAP_USER` y `SALES_IMAP_PASSWORD` (#2). Si falta alguna, no intenta conectarse y la corrida queda registrada con el motivo "falta la clave de sales@" | Unitario: sin las variables no hay intento de conexión y se registra ese motivo. Grep: en `src/` y `scripts/` no aparece `ferozo.com` ni ninguna contraseña. El servidor solo sale de la variable |
| 2 | Lee **dos carpetas: Inbox y Spam**. El nombre real de Spam se descubre en el servidor. Primero busca la carpeta marcada como "correo no deseado" (`\Junk`). Si no hay ninguna marcada, busca un nombre que contenga "spam" o "junk", como `INBOX.Spam`, `Junk` o `INBOX.Junk`. El nombre encontrado queda en el registro de la corrida | Integración con el servidor IMAP falso, en tres casos: Spam marcada `\Junk` con otro nombre, `INBOX.Spam` sin marca y `Junk` sin marca. En los tres, la corrida lee la carpeta correcta y registra su nombre |
| 3 | Si no encuentra la carpeta Spam, igual lee el Inbox. La corrida queda como **"con aviso: no encontré la carpeta Spam"**. Nunca sale como "anduvo bien" mientras haya una carpeta sin leer | Integración: servidor falso sin carpeta Spam. Se leyó el Inbox y el estado es "con aviso" con ese motivo |

**Cuándo corre**

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 4 | Corre **una vez por día a las 12:00 hora Argentina** (`0 15 * * *` en UTC) con Vercel Cron. En el plan Hobby, Vercel puede dispararla en cualquier momento dentro de esa hora | `vercel.json` tiene exactamente un cron hacia `/api/cron/leer-sales` con `0 15 * * *`. Después del deploy, aparece en Vercel → Settings → Cron Jobs |
| 5 | La ruta **rechaza cualquier llamada sin `CRON_SECRET`**: sin el encabezado, con un valor equivocado o si la variable no está cargada en el servidor. En esos casos no se conecta a la casilla, no gasta IA y no registra ninguna corrida | Unitario de la ruta: sin el encabezado, con un secreto equivocado y con `CRON_SECRET` vacío en el servidor, la respuesta es 401. En los tres casos el doble de la casilla no recibió ninguna conexión. Con el secreto correcto la respuesta es 200 |
| 6 | **Modo manual por script:** `npm run leer:sales` hace la misma corrida desde la máquina, con `.env.local`. Admite dos opciones: `--solo-listar` muestra qué mails procesaría y de qué agencia, sin gastar IA ni crear reservas; `--dias N` cambia la ventana | Integración: `--solo-listar` contra el servidor falso lista los mails de agencias y no llama a la IA (el contador de `uso_ia` no cambia). Tampoco crea filas en `reserva` |
| 7 | **Modo manual sin código:** en Vercel → proyecto → Settings → Cron Jobs, el botón **"Run"** del cron dispara la misma corrida con el secreto. Es el "Leer ahora" del owner | Recorrido: con la lectura activa, el owner aprieta "Run" y la corrida aparece en la lista de reservas (§4) |
| 8 | Si se disparan dos corridas a la vez (el cron y el script), la segunda no lee nada y queda registrada como "salteada: ya había una lectura en curso". Una corrida que quedó colgada más de 15 minutos no bloquea a la siguiente | Integración: con una corrida marcada "en curso", otra termina como "salteada". Con una "en curso" de hace 20 minutos, la nueva corre |

**Qué mails procesa**

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 9 | Mira los mails de los **últimos 7 días** en las dos carpetas. Así cubre los que llegaron durante corridas que fallaron | Integración: un mail de agencia de hace 6 días, nunca procesado, se procesa. Uno de hace 10 días no se mira |
| 10 | **Solo procesa los mails de remitentes de agencias conocidas** (`data/agencias.csv`). Primero baja solo el sobre (remitente, fecha, asunto). El cuerpo y los adjuntos se bajan únicamente si el remitente es conocido. **Un mail de un remitente desconocido no gasta IA (#3)** y no deja rastro en la base | Integración: con 1 mail de Kilroy, 1 de TourRadar en Spam y 3 de remitentes desconocidos, la IA se llama exactamente 2 veces. `uso_ia` sube solo por esos 2 y no hay filas de los otros 3 en `mail_recibido`. Al servidor falso nunca se le pidió el cuerpo de los desconocidos |
| 11 | Cada mail de agencia pasa por **el mismo circuito de M2-06** (IA → producto → mismo intercambio). La reserva queda **sin** la marca "de prueba" | Integración: un `.eml` de ejemplo de Kilroy servido por el falso termina en una reserva igual a la que da M2-06 con ese archivo, pero sin la marca "de prueba" |
| 12 | **No reprocesa.** Recuerda cada mail procesado por su `Message-ID`, y además por carpeta + UID. Si alguien mueve un mail de Spam al Inbox, su UID cambia pero el `Message-ID` es el mismo, y no se procesa de nuevo. A un mail sin `Message-ID` se le arma una huella con remitente, fecha y asunto | Integración: dos corridas seguidas sobre la misma casilla. La segunda no llama a la IA ni crea reservas. Mover el mail de Spam a Inbox en el falso y volver a correr tampoco lo procesa. Lo mismo con un mail sin `Message-ID` |
| 13 | Si un mail de agencia falla al procesarse (la IA no responde o el adjunto viene roto), **no se marca como procesado** y se reintenta en la corrida siguiente. Después de 3 intentos fallidos queda registrado como "no se pudo leer" y ya no se reintenta solo, así no gasta IA todos los días. Los demás mails de la corrida siguen | Integración: la IA falla para 1 de 3 mails. Se procesan 2 y el tercero queda pendiente. En la cuarta corrida con el mismo fallo, el mail figura "no se pudo leer" y la IA no se llama más para él |
| 14 | Si se alcanza el **techo de gasto** (#3) en medio de una corrida, se cortan las llamadas a la IA. Los mails que faltan quedan pendientes para la corrida siguiente, y la corrida queda "con aviso: techo de gasto alcanzado" | Integración con el techo en 1 llamada y 3 mails: se procesa 1, quedan 2 pendientes y el registro tiene ese aviso |

**Qué NO hace**

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 15 | **Nunca modifica la casilla:** no marca como leído, no mueve, no copia, no borra y no guarda borradores. Abre las carpetas en modo solo lectura y baja el contenido sin marcarlo como leído | Integración: el servidor falso registra cada comando que recibe. En todas las corridas de la suite **no aparece nunca** `STORE`, `MOVE`, `COPY`, `UID STORE`, `UID MOVE`, `UID COPY`, `EXPUNGE`, `UID EXPUNGE`, `APPEND`, `DELETE`, `RENAME`, `CREATE` ni `SELECT` (solo `EXAMINE`). Al final, todos los mails del falso conservan sus marcas originales; uno que estaba "no leído" sigue "no leído" |
| 16 | No manda ningún mail ni tiene camino para mandarlo (#4) | Grep: el código de esta pieza no importa ninguna librería de envío (SMTP, `nodemailer`, Gmail `send`) |

**Fallas y registro**

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 17 | Si la casilla no responde (servidor caído, clave equivocada o tiempo agotado), la corrida queda **"falló"** con el motivo en llano. Nada se marca como procesado y la corrida del día siguiente lo recupera gracias a la ventana de 7 días | Integración: el falso apagado da "falló: la casilla no respondió". La clave equivocada da "falló: la clave de sales@ no es válida". Al prender el falso, la corrida siguiente procesa los mails de esos días |
| 18 | **Cada corrida queda registrada** con inicio, fin, origen (cron o manual), estado (anduvo bien, con aviso, falló o salteada), carpetas leídas, cuántos mails miró, cuántos eran de agencias, cuántos procesó, cuántas reservas creó o actualizó, y los errores en llano. Los errores no incluyen claves ni el cuerpo de los mails | Integración: después de una corrida con 5 mails (2 de agencias), el registro tiene `miró 5 · de agencias 2 · procesó 2` y las reservas creadas. Grep de los logs del test: no aparece la contraseña ni el cuerpo de los mails |
| 19 | El registro de corridas está en la base con RLS activa (#1). El equipo logueado lo puede leer; solo el servidor lo escribe | Integración: un usuario logueado lee el registro y no puede insertar ni modificar filas. Un visitante sin login no lo lee |
| 20 | La lista de reservas muestra el estado de la última lectura (ver §4) | Test de pantalla de los estados de §4 |

**Activación**

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 21 | **La lectura automática arranca apagada.** Solo corre si la variable `LECTURA_SALES_ACTIVA` vale `si`, y esa variable se carga **recién con el OK del owner sobre el reporte del modo prueba** (M2-06, con menos de 20% de corrección manual). Apagada, el cron responde sin conectarse y la pantalla dice que está apagada. El script `--solo-listar` funciona igual, para probar la conexión antes del OK | Unitario: sin `LECTURA_SALES_ACTIVA=si`, la ruta no se conecta a la casilla y registra "apagada". Con `si`, corre |
| 22 | `.env.example` tiene los nombres `SALES_IMAP_HOST`, `SALES_IMAP_USER`, `SALES_IMAP_PASSWORD`, `CRON_SECRET` y `LECTURA_SALES_ACTIVA`, sin valores y con una línea que dice de dónde sale cada uno | Lectura del archivo. Grep: no hay ningún valor real |

## 4. Qué ve el usuario
- **Dónde:** la lista de reservas de M2-05, una línea arriba de la lista. No hay pantalla nueva.
- **Recorrido:** el owner abre Reservas y, sin hacer nada, sabe si la lectura de hoy anduvo y
  cuántas reservas trajo. Si falló, entiende qué pasó y que se reintenta sola.
- **Estados** (las horas van en hora Argentina; los textos van en el módulo central de textos):
  - **Anduvo bien:** "Última lectura de sales@: hoy 12:14 · 3 reservas nuevas, 1 actualizada (de
    41 mails, 4 de agencias)."
  - **Con aviso:** el mismo resumen y, debajo, el aviso en llano. Por ejemplo: "No encontré la
    carpeta Spam: solo se leyó la bandeja de entrada." o "Se alcanzó el techo de gasto de IA: 2
    mails quedan para mañana."
  - **Falló:** "La última lectura falló (hoy 12:03): la casilla no respondió. Se reintenta
    mañana a las 12 y no se pierde nada." Si hay mails "no se pudo leer", se dice cuántos.
  - **Atrasada:** si la última lectura que anduvo es de hace más de 26 horas, aparece "No hubo
    lectura de sales@ desde el lunes 12:10." Esto avisa si el cron dejó de dispararse.
  - **Apagada:** "La lectura automática de sales@ está apagada hasta tu OK del modo prueba."
  - **Vacío:** "Todavía no corrió ninguna lectura de sales@."
  - **Error al consultar:** "No pude consultar el registro de lecturas." La lista de reservas
    se muestra igual.
  - **Carga:** la línea llega con la página, que se arma del lado del servidor. Mientras tanto
    vale el estado de carga de la lista de M2-05.
- Se ven solo los números y el texto. Nunca remitentes, asuntos ni contenido de los mails.

## 5. Qué queda afuera
- **Un botón "Leer ahora" dentro de la app.** Queda afuera porque el owner no necesita
  velocidad (decisión del 2026-10-11). Para una lectura a pedido alcanza con el botón "Run" de
  Vercel (#7) o con el script (#6). Un botón propio sumaría permisos, una corrida larga esperando
  en el navegador y más cosas para probar, sin una necesidad real. Se revisa si el equipo lo pide
  al usarlo.
- **Leer más de una vez por día:** exige Vercel Pro o un disparador externo. Se revisa solo si
  hace falta.
- **Journaway mientras mande a `operaciones3@`.** Esta pieza lee solo `sales@`. Los mails de
  Journaway entran recién cuando lleguen a `sales@`, por uno de dos caminos:
  - **Journaway manda a `sales@`:** es lo que el owner les va a pedir.
  - **El owner configura en Ferozo un reenvío automático de `operaciones3@` a `sales@`:** si el
    reenvío conserva el remitente original (`de@journaway.com`), esos mails pasan el filtro sin
    tocar nada. **Ojo, tiene el mismo problema del Spam:** si el antispam de Ferozo manda un mail
    de Journaway a la carpeta Spam de `operaciones3@`, ese mail **no se reenvía** y la app nunca
    lo ve. Mientras se use el reenvío, alguien tiene que mirar el Spam de `operaciones3@`.
  - Si el reenvío cambia el remitente por `operaciones3@`, hay que agregar esa dirección a
    `data/agencias.csv` como remitente de Journaway. Lo hace la pieza que la necesite, no esta.
- **Avisos por mail o Slack cuando entra una reserva o falla una lectura:** fuera de M2.
- **Mails anteriores a la ventana de 7 días:** se cargan con el modo prueba de M2-06 si hace
  falta.
- **Liberar espacio en la casilla de Ferozo:** si se llena, los mails rebotan antes de llegar y
  la app no lo puede evitar.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — el registro de corridas y los cambios a `mail_recibido` tienen RLS. Solo el servidor
  escribe; el equipo lee.
- **#2** — `SALES_IMAP_*` y `CRON_SECRET` salen de variables de entorno, en `.env.local` y en
  Vercel. Nunca van en el código, en el repo, en los logs ni en los mensajes de error.
- **#3** — el filtro por remitente va antes de bajar el mail y antes de la IA. Cada llamada pasa
  por el techo de `uso_ia` y, si se alcanza, la corrida corta.
- **#4** — leer no es un efecto hacia afuera. Igual, esta pieza no tiene ningún camino para
  mandar mails ni para modificar la casilla (#15, #16).

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. Unitarios + linter (`npm test && npm run lint`): la ruta y `CRON_SECRET`, el interruptor
     `LECTURA_SALES_ACTIVA`, el descubrimiento de la carpeta Spam, el filtro por remitente, la
     huella de un mail sin `Message-ID`, el cálculo de la ventana y los textos de los estados.
  2. Integración contra un **servidor IMAP falso** con la base de tests: los criterios #2-3,
     #6, #8-15 y #17-19. Incluye la prueba de RLS del registro (#19). El registro de comandos
     del falso es la prueba de #15.
  3. Recorrido completo: `npm run leer:sales -- --solo-listar` contra el falso y después la
     corrida real contra el falso, con la reserva visible en la lista y la línea de §4.
     **Cuando el owner pase la clave:** `--solo-listar` contra Ferozo real. Confirma la
     conexión, el nombre de la carpeta Spam y qué mails tomaría, sin gastar IA. El resultado
     se anota en `PROGRESS.md`.
- **Test primero:** empezar por #15 (ningún comando de escritura) y #5 (sin secreto, 401).
  Verlos fallar por la razón correcta antes de implementar.
- **Librería IMAP:** `imapflow`.
  - Abrir cada carpeta en solo lectura: `getMailboxLock(path, { readOnly: true })`, que manda
    `EXAMINE`.
  - Buscar con `search({ since })` y pedir `fetch(..., { envelope: true, uid: true })` para el
    filtro.
  - El cuerpo se baja con `source` solo para los remitentes conocidos. imapflow usa
    `BODY.PEEK[]`, que no marca como leído; verificarlo en el registro de comandos del falso.
  - Descubrir Spam con `list()` y el atributo `specialUse === '\\Junk'`; si no hay ninguna,
    buscar por nombre.
  - Guardar `uidValidity` de cada carpeta junto al UID. Si cambia, manda el `Message-ID`.
  - El parseo del `.eml` (`mailparser` o el que haya elegido M2-06) es el mismo de M2-06.
- **Servidor IMAP falso:** hay dos opciones; el builder elige la más simple que registre los
  comandos.
  - Uno chico, propio, en `tests/helpers/imap-falso.ts`, sobre `net`/`tls` de Node. Atiende el
    subconjunto que usa imapflow: `CAPABILITY`, `LOGIN`, `LIST`, `EXAMINE`, `UID SEARCH`,
    `UID FETCH` y `LOGOUT`. Rechaza el resto y lo deja registrado.
  - Una librería de servidor de pruebas (por ejemplo `hoodiecrow-imap`).
  - Carga los `.eml` de ejemplo de `Insumos/Mails` y casos sintéticos.
- **Diseño:** un módulo `src/lib/lectura-sales/` con:
  - `casilla.ts`: el adaptador imapflow, detrás de una interfaz chica que el test puede
    reemplazar;
  - `corrida.ts`: la orquestación (candado, ventana, filtro, circuito de M2-06, registro).
    Recibe dependencias inyectadas;
  - `remitentes.ts`: lee `data/agencias.csv` de M2-01.
  - La ruta y el script solo llaman a `corrida.ts`.
- **Entregables:**
  - `src/app/api/cron/leer-sales/route.ts`: `GET`, valida `Authorization: Bearer
    ${CRON_SECRET}` con comparación de tiempo constante, `runtime = 'nodejs'`, `maxDuration`
    explícito. Si la corrida se acerca al límite, deja el resto para mañana: la ventana lo
    cubre.
  - `vercel.json`: `{ "crons": [{ "path": "/api/cron/leer-sales", "schedule": "0 15 * * *" }] }`.
  - `scripts/leer-sales.ts` y el script `"leer:sales"` en `package.json`. Dependencias:
    `imapflow` y lo que haga falta para el falso.
  - `src/lib/lectura-sales/*` con sus tests, más los tests de integración y el falso.
  - Migración de Supabase con:
    - la tabla `lectura_casilla` (una fila por corrida, con los campos de #18 y RLS de #19);
    - las columnas que falten en `mail_recibido` de M2-01: carpeta, `uid`, `uid_validity`,
      `message_id` único, `intentos`, `estado_lectura`.
    - No duplicar lo que M2-01 ya tenga.
  - La línea de estado en la lista de reservas de M2-05, con los textos en
    `src/lib/textos/index.ts`.
  - `.env.example` actualizado (#22).
- **Pasos para cargar las claves en Vercel (los hace el owner, o el agente con su OK):**
  1. Vercel → el proyecto → **Settings → Environment Variables**.
  2. Agregar `SALES_IMAP_HOST` = `c1391889.ferozo.com`, `SALES_IMAP_USER` =
     `sales@hitravel.com.ar` y `SALES_IMAP_PASSWORD` = la clave que pasa Leticia, marcada
     **Sensitive**. Entorno: **Production**.
  3. Agregar `CRON_SECRET`: un texto al azar de 32 caracteres o más (por ejemplo, la salida de
     `openssl rand -hex 32`), marcado Sensitive, en Production.
  4. **Recién con el OK del owner sobre el modo prueba:** agregar `LECTURA_SALES_ACTIVA` = `si`.
  5. **Redeploy:** las variables nuevas valen recién en el próximo deploy (Deployments → el
     último → Redeploy).
  6. Las mismas variables van en `.env.local` para el script. La clave se pega directo en el
     archivo y nunca en el chat. Si se filtra, se cambia en Ferozo (`secretos.md`).
- **Docs que quedan desactualizados:** `stack.md` e `integraciones.md` (anexo) todavía dicen
  "Gmail API, cron cada 5 minutos". Esta pieza no los toca: el loop principal los corrige al
  cerrarla.
- **Diseño y alcance no se deciden acá:** el cómo va a `docs/arquitectura/`; el si entra o no,
  a `docs/prd.md`.
- **No commitear `CLAUDE.md`.**
