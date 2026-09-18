<!-- PROGRESS.md — la nota corta de "dónde retomar". Actualizar antes de cerrar cada sesión.
El estado pieza por pieza NO va acá: vive en la tabla del plan (docs/sdd/roadmaps/active/). -->

# Dónde retomar

- **Último commit:** 650ed78 (M1-01: base de la app) — local, falta `git push`
- **Verificación completa:** M1-01 tiene V1 (tests+linter) y V2 (integración con mocks) en
  **verde**. V3 (recorrido real de punta a punta) **no corrida** — depende de 3 cuentas externas
  que todavía no existen (ver abajo). Sin eso no hay build para levantar y "probar vos".
- **Plan activo:** `docs/sdd/roadmaps/active/m1-catalogo-y-proveedores.md` — M1-01 🔵 en curso
  (bloqueada en V3), M1-02 a M1-06 ⬜ pendientes.
- **Próximo paso — 3 cuentas externas, avance real al 2026-09-18** (retomado en bus Bilbao→Madrid,
  cortado por batería de la notebook, sin riesgo — todo lo hecho vive en la nube de
  Google/Supabase, no en la máquina):
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
  3. 🔵 **Google Cloud — en curso, cortado acá:** proyecto `HI Travel Automatizacion` ya creado en
     console.cloud.google.com con `ccalomarde@hitravel.com.ar`. **Falta desde cero:**
     a. Configurar la **pantalla de consentimiento OAuth** (APIs & Services → OAuth consent
        screen): tipo **External**, nombre de la app "HI Travel - Reservas de Catálogo", mail de
        soporte y de contacto `ccalomarde@hitravel.com.ar`. Scopes por defecto (no tocar nada).
        Publicar la app (no dejarla en modo "Testing" — evita tener que agregar a cada persona del
        equipo como "test user" a mano).
     b. Crear la **credencial OAuth** (APIs & Services → Credentials → Create Credentials → OAuth
        client ID → tipo **Web application**, nombre "HI Travel Supabase Auth"). **Redirect URI
        autorizado** (copiar tal cual):
        `https://uhwkifqmexdktaseaxxo.supabase.co/auth/v1/callback`
     c. Copiar el **Client ID** y el **Client Secret** que Google muestra al crear la credencial
        (a la misma nota personal, nunca acá).
     d. Volver a Supabase → Authentication → Providers → Google → activar → pegar Client ID y
        Client Secret → guardar. (Cierra el punto 2 de arriba.)
  4. ⬜ **Proyecto en Vercel conectado al repo de GitHub** — depende de que el `git push` esté al
     día (ver "Ojo con" abajo — probablemente hay commits nuevos sin subir desde la última vez).
     Variables a cargar en Vercel (Project Settings → Environment Variables), usando los nombres
     de `.env.example`, con los valores de la nota del owner:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (es el valor que Supabase llama "publishable key")
     - `SUPABASE_SERVICE_ROLE_KEY` (es el valor que Supabase llama "secret key")
     - `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` = `hitravel.com.ar` (confirmar el literal exacto)
     - (Google Client ID/Secret NO van en Vercel — viven solo en la config de Google del panel de
       Supabase, paso 3.d de arriba.)

  **Retomar exactamente desde:** paso 3.a (la pantalla de consentimiento de Google Cloud). Nada
  se rompe ni se pierde por la pausa — el proyecto de Google Cloud ya creado sigue ahí esperando.
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
- 🔵 `/implementar M1-01` — código y tests listos; **bloqueada en V3** por las 3 cuentas externas
  de arriba. Siguiente pieza cuando se resuelva: `/implementar M1-02`.
