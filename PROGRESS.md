<!-- PROGRESS.md — la nota corta de "dónde retomar". Actualizar antes de cerrar cada sesión.
El estado pieza por pieza NO va acá: vive en la tabla del plan (docs/sdd/roadmaps/active/). -->

# Dónde retomar

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
    - **Faltan:** el código de la columna "SAO 2 n" (São Paulo) en 5C01, y BOCHI04R, que
      sigue sin aparecer en "Tours 2027". **Acordado con el owner (2026-10-01):**
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
