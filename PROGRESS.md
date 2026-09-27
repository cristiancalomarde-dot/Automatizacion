<!-- PROGRESS.md — la nota corta de "dónde retomar". Actualizar antes de cerrar cada sesión.
El estado pieza por pieza NO va acá: vive en la tabla del plan (docs/sdd/roadmaps/active/). -->

# Dónde retomar

- **Último push a GitHub:** `711cded` (M1-02). Los commits de M1-03 están solo en local:
  **falta `git push`**.
- **Verificación completa:** M1-01, M1-02 y **M1-03 terminadas**, las 3 verificaciones en verde,
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
      Primero rotar la clave que quedó expuesta en un log, después cargarla en `.env.local` y
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
    - **A confirmar con operaciones (owner):** Tetris (¿WhatsApp?). Para cambiarlos: editar el CSV y correr
      `npm run importar:equivalencias` y después `npm run importar:productos`.
    - "Extra glamping x pax" (OD011) queda para revisar hasta tener la IA.
    - Conviene borrar del Excel las líneas obsoletas "Green + Dann Inn" y "Dann Inn + Green".
    - Ahora "proveedor sin resolver" mira solo el Booking Supplier, que es a quien va el mail.
    - El traslado incluido solo figura como texto ("Includes: Transfer in + Out") en la
      descripción del paquete de excursiones: decidir cómo representarlo al planear M2.
- **Plan activo:** `docs/sdd/roadmaps/active/m1-catalogo-y-proveedores.md` — M1-01 a M1-04b
  ✅ **terminadas**, M1-05 y M1-06 ⬜ pendientes. **Próximo paso: `/implementar M1-05`**
  (tours compuestos; reusa las equivalencias y los niveles confirmados como datos).
  - `marca.md` actualizado con los colores del logo real. El logo entra en M1-06 (requisito
    #13 de su ficha).
  - El clon `C:\Users\gs\dev\hi-travel-automatizacion` tiene los commits de M1-04 pero no los
    de docs del repo real: resincronizarlo antes de construir.
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
