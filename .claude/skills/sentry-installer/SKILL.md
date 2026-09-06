---
name: sentry-installer
description: >-
  Cómo dejar Sentry instalado y capturando errores — la doctrina de la integración de monitoreo de
  errores. Se activa con /instalar-sentry o cuando el usuario pide "instalá Sentry", "quiero ver los
  errores en producción", "monitoreo de errores". Evalúa si la integración es sencilla o compleja y
  la construye siempre vía el builder (con las 3 verificaciones): sencilla = una mini-spec; compleja
  = roadmap + specs. El DSN va a variable de entorno (#2). Escribe docs/arquitectura/sentry.md.
---

# sentry-installer — cómo se deja Sentry capturando errores

Doctrina de la integración de **monitoreo de errores**: que un error en producción quede
registrado y visible, sin que la instalación se salte el proceso del harness. Corre en el loop
principal; **el código lo escribe siempre el `builder`** (test-primero + 3 verificaciones), nunca
esta skill a mano. La fuente de verdad de la integración es `docs/arquitectura/sentry.md`.

## Doctrina

1. **Primero evaluar, después construir.** Mirá el stack (`docs/arquitectura/stack.md`), el
   framework y el tamaño de la app (pantallas, front+back, si hay SSR). Con eso decidís la ruta:
   - **Sencilla** (un framework estándar, pocas pantallas, SDK oficial): armá **una mini-spec**
     (con `docs/sdd/specs/TEMPLATE.md`) y despachá al **`builder`** (Agent tool).
   - **Compleja** (varias superficies, monorepo, front+back+workers, mapeo de source maps no
     trivial): NO metas todo en una spec. Primero armá el plan con el flujo **`planner`**
     (como `/roadmap` → `/specs`) partiéndolo en piezas, y después delegás cada una al `builder`.
   Ante la duda, es compleja: es peor una spec gigante que dos chicas.
2. **Una cosa a la vez.** Respetás la regla del proyecto: una spec por vez, sin refactor colateral.
   El estado de las piezas vive en la tabla del plan, no acá.
3. **El DSN es un secreto (regla #2).** El DSN de Sentry sale de variable de entorno; NUNCA va en
   el código ni en el repo. La spec incluye la env var y su registro en `secretos.md`.
4. **Techo de gasto si aplica (regla #3).** Sentry tiene tier gratuito con cuota de eventos; si el
   plan puede volverse pago, se nombra el límite y se cruza con `costos.md` (`/costo`).
5. **Terminado = capturando de verdad (regla #5).** No alcanza "el paquete está instalado": la
   verificación de la spec incluye **disparar un error de prueba y confirmar que aparece en Sentry**.
6. **Documentar cómo quedó.** Al cerrar, `docs/arquitectura/sentry.md` explica en llano qué es,
   por qué, cómo quedó implementado **en este proyecto** y cómo verificarlo.

## El flujo

1. **Leer** `stack.md`, `secretos.md` y el layout del código; evaluar sencilla vs compleja.
2. **Preparar el trabajo:** mini-spec (sencilla) o roadmap+specs (compleja), con la env var del
   DSN, el punto de init del SDK, y la verificación del error de prueba.
3. **Despachar al `builder`** (Agent tool) pieza por pieza; con su reporte, actualizar la tabla del
   plan (✅/❌) igual que `/implementar`.
4. **Verificar la captura:** confirmar que el error de prueba llegó a Sentry.
5. **Escribir `docs/arquitectura/sentry.md`** (qué/por qué/cómo quedó acá/dónde está el DSN/cómo se
   verifica) y actualizar el mapa de `docs/arquitectura/README.md`. Registrar la decisión durable
   en `DECISIONS.md`.

**Cierre:** un error de prueba aparece en Sentry; el DSN está en env (no en el repo); existe
`docs/arquitectura/sentry.md` y el README lo linkea; las 3 verificaciones quedaron en verde.
