<!-- PROGRESS.md — la nota corta de "dónde retomar". Actualizar antes de cerrar cada sesión.
El estado pieza por pieza NO va acá: vive en la tabla del plan (docs/sdd/roadmaps/active/). -->

# Dónde retomar

- **Último commit:** 650ed78 (M1-01: base de la app) — local, falta `git push`
- **Verificación completa:** M1-01 tiene V1 (tests+linter) y V2 (integración con mocks) en
  **verde**. V3 (recorrido real de punta a punta) **no corrida** — depende de 3 cuentas externas
  que todavía no existen (ver abajo). Sin eso no hay build para levantar y "probar vos".
- **Plan activo:** `docs/sdd/roadmaps/active/m1-catalogo-y-proveedores.md` — M1-01 🔵 en curso
  (bloqueada en V3), M1-02 a M1-06 ⬜ pendientes.
- **Próximo paso — 3 cuentas que solo el owner puede crear** (no soy yo quien puede darlas de
  alta):
  1. **Proyecto en [supabase.com](https://supabase.com)** (recomendado: cuenta de la empresa).
     De ahí salen `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
     `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API). Después: pegar el contenido de
     `supabase/migrations/0001_usuario.sql` en el SQL Editor del panel, y habilitar el proveedor
     **Google** en Authentication → Providers.
  2. **Cliente OAuth en [console.cloud.google.com](https://console.cloud.google.com)** (tipo "Web
     application") → da `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`. Estos se pegan en
     el panel de Supabase (Authentication → Providers → Google), no en la app. El "redirect URI"
     autorizado es el que muestra esa pantalla de Supabase.
  3. **Proyecto en [vercel.com](https://vercel.com)** conectado al repo de GitHub — **ojo, antes
     hace falta el `git push`** que sigue pendiente (ver abajo). Ahí se cargan las 5 variables de
     arriba + `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` (el dominio a restringir, confirmar el literal
     exacto — se asumió `hitravel.com.ar`).

  Cuando estén las 3, avisame y cerramos M1-01 (V3) juntos.
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
