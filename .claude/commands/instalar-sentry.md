---
description: Deja Sentry instalado y capturando errores. Invoca la skill sentry-installer, que evalúa la complejidad, despacha al builder (mini-spec o roadmap+specs) y escribe docs/arquitectura/sentry.md. El DSN va a variable de entorno (#2).
argument-hint: "[indicaciones, o vacío = derivar del stack]"
---

# /instalar-sentry

Invocá la skill **`sentry-installer`** (Skill tool) y seguí su doctrina con esta entrada:

**$ARGUMENTS**

- Si no hay `docs/arquitectura/stack.md`, primero `/arquitectura` (la instalación depende del stack).
- Corrés en el loop principal; el trabajo lo hace el **`builder`** (Agent tool), con las 3 verificaciones.
- Al terminar, mostrá en llano que captura (error de prueba visible en Sentry) y ofrecé **`/instalar-posthog`** o **`/deploy`**.
