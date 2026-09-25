<!-- PROGRESS.md — la nota corta de "dónde retomar". Actualizar antes de cerrar cada sesión.
El estado pieza por pieza NO va acá: vive en la tabla del plan (docs/sdd/roadmaps/active/). -->

# Dónde retomar

- **Último commit en GitHub:** `5b98fa9` (push hecho el 2026-09-23). Los cambios de hoy
  (`PROGRESS.md`, tabla del plan) todavía no están commiteados — hacerlo antes de arrancar M1-02.
- **Verificación completa:** M1-01 **terminada** — V1 (tests+linter), V2 (integración con mocks) y
  V3 (recorrido real de punta a punta) las 3 en **verde**. V3 se confirmó el 2026-09-25 en
  `https://automatizacion-dun.vercel.app`, entrando con `operations@hitravel.com.ar` (se ve
  "Damian" en el header + botón Salir). También se confirmó el caso de rechazo: una cuenta fuera
  del dominio (`hitravelargentina@gmail.com`) es rechazada correctamente.
- **Plan activo:** `docs/sdd/roadmaps/active/m1-catalogo-y-proveedores.md` — M1-01 ✅ **terminada**,
  M1-02 a M1-06 ⬜ pendientes. **Próximo paso: `/implementar M1-02`** (esquema de datos del
  catálogo).
- **App en vivo:** `https://automatizacion-dun.vercel.app` (proyecto Vercel bajo la cuenta
  `ccalomarde@hitravel.com.ar`, conectado al repo de GitHub).

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
  - **Antes de M1-04:** confirmar el alcance exacto de productos simples de Iguazú a cargar (se
    asumió lo que aparece en la muestra de reservas de Kilroy — OD010A/B/C/D).
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
  probada en `https://automatizacion-dun.vercel.app`. Siguiente pieza: `/implementar M1-02`.
