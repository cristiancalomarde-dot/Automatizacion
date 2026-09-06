---
name: posthog-installer
description: >-
  Cómo dejar PostHog instalado y midiendo producto — la doctrina de la integración de analítica de
  producto. Se activa con /instalar-posthog o cuando el usuario pide "instalá PostHog", "quiero medir
  qué hacen los usuarios", "analítica de producto", "eventos". Evalúa si la integración es sencilla o
  compleja y la construye siempre vía el builder (con las 3 verificaciones): sencilla = una mini-spec;
  compleja = roadmap + specs. La API key va a variable de entorno (#2). Escribe docs/arquitectura/posthog.md.
---

# posthog-installer — cómo se deja PostHog midiendo producto

Doctrina de la integración de **analítica de producto**: que los eventos clave del usuario queden
registrados y visibles, sin saltarse el proceso del harness. Corre en el loop principal; **el código
lo escribe siempre el `builder`** (test-primero + 3 verificaciones), nunca esta skill a mano. La
fuente de verdad de la integración es `docs/arquitectura/posthog.md`.

## Doctrina

1. **Primero evaluar, después construir.** Mirá el stack (`docs/arquitectura/stack.md`), el
   framework y el tamaño de la app. Con eso decidís la ruta:
   - **Sencilla** (framework estándar, pocos eventos, SDK oficial): armá **una mini-spec**
     (con `docs/sdd/specs/TEMPLATE.md`) y despachá al **`builder`** (Agent tool).
   - **Compleja** (muchas pantallas, front+back, identificación de usuarios, eventos por toda la
     app): primero armá el plan con el flujo **`planner`** (como `/roadmap` → `/specs`) partiéndolo
     en piezas, y después delegás cada una al `builder`.
   Ante la duda, es compleja.
2. **Una cosa a la vez.** Una spec por vez, sin refactor colateral. El estado vive en la tabla del plan.
3. **Qué se mide se decide, no se mide todo.** La spec nombra los **eventos clave** del producto
   (los que responden "¿el usuario llegó al valor?"), no un tracking indiscriminado. Si hay
   `docs/arquitectura/user-flow.md`, los eventos salen de ahí.
4. **La API key es un secreto (regla #2).** La project API key de PostHog sale de variable de
   entorno; NUNCA va en el código ni en el repo. La spec la registra en `secretos.md`.
5. **Privacidad y efecto hacia afuera.** Enviar datos de uso a un tercero es un efecto hacia afuera:
   respetá la regla #1 (nada de datos de un usuario visibles por otro) y no mandes PII sin decisión
   explícita del owner. Si el proyecto tiene aviso de privacidad, se contempla.
6. **Terminado = midiendo de verdad (regla #5).** La verificación de la spec incluye **disparar un
   evento de prueba y confirmar que aparece en PostHog**.
7. **Documentar cómo quedó.** Al cerrar, `docs/arquitectura/posthog.md` explica en llano qué es,
   por qué, qué eventos se miden **en este proyecto** y cómo verificarlo.

## El flujo

1. **Leer** `stack.md`, `secretos.md`, `user-flow.md` (si existe) y el layout del código; evaluar
   sencilla vs compleja y listar los eventos clave.
2. **Preparar el trabajo:** mini-spec (sencilla) o roadmap+specs (compleja), con la env var de la
   API key, el init del SDK, los eventos a capturar y la verificación del evento de prueba.
3. **Despachar al `builder`** (Agent tool) pieza por pieza; con su reporte, actualizar la tabla del
   plan (✅/❌) igual que `/implementar`.
4. **Verificar la medición:** confirmar que el evento de prueba llegó a PostHog.
5. **Escribir `docs/arquitectura/posthog.md`** (qué/por qué/qué eventos/dónde está la API key/cómo
   se verifica) y actualizar el mapa de `docs/arquitectura/README.md`. Registrar la decisión durable
   en `DECISIONS.md`.

**Cierre:** un evento de prueba aparece en PostHog; la API key está en env (no en el repo); existe
`docs/arquitectura/posthog.md` y el README lo linkea; las 3 verificaciones quedaron en verde.
