---
description: Deja PostHog instalado y midiendo producto. Invoca la skill posthog-installer, que evalúa la complejidad, despacha al builder (mini-spec o roadmap+specs) y escribe docs/arquitectura/posthog.md. La API key va a variable de entorno (#2).
argument-hint: "[indicaciones, o vacío = derivar del stack]"
---

# /instalar-posthog

Invocá la skill **`posthog-installer`** (Skill tool) y seguí su doctrina con esta entrada:

**$ARGUMENTS**

- Si no hay `docs/arquitectura/stack.md`, primero `/arquitectura` (la instalación depende del stack).
- Corrés en el loop principal; el trabajo lo hace el **`builder`** (Agent tool), con las 3 verificaciones.
- Al terminar, mostrá en llano que llegan eventos (evento de prueba visible en PostHog) y ofrecé **`/deploy`**.
