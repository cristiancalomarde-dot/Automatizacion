---
name: cost-estimator
description: >-
  Cómo estimar el costo mensual del proyecto — la doctrina de "la foto del costo". Se activa con
  /costo o cuando el usuario pide "cuánto sale por mes", "estimá el costo", "cuánto gasto de infra".
  Lee la infra ya decidida (stack, deploy, integraciones IA), pregunta UNA vez el volumen de uso
  estimado y escribe docs/arquitectura/costos.md con un costo mensual (piso/techo) y sus supuestos
  explícitos. Actualiza el mapa de docs/arquitectura/README.md. No cambia el stack ni despliega.
---

# cost-estimator — cómo se saca la foto del costo

Doctrina de la estimación de costo: convertir las decisiones técnicas ya tomadas (el *cómo*) en un
**número mensual con supuestos**, para que el owner sepa qué va a pagar antes de publicar. Corre en
el loop principal, sin subagentes. La fuente de verdad del costo es `docs/arquitectura/costos.md`.

## Doctrina

1. **No inventás la infra: la leés.** El costo sale de decisiones ya tomadas, no de suposiciones.
   Insumos: `docs/arquitectura/stack.md` (hosting/deploy), `integraciones-ia.md` (modelo IA y su
   techo de gasto, regla #3), `integraciones.md` (otros servicios pagos), `package.json` y el
   target de deploy real. Si falta el stack, no hay qué costear — se manda a `/arquitectura`.
2. **Una sola ronda de preguntas.** Lo único que no está en el repo es el **volumen esperado**:
   usuarios/mes, requests o sesiones, y —si hay IA— tokens o llamadas por acción. Se pregunta en
   **un solo bloque**, con un valor por defecto razonable por si el owner no sabe.
3. **Todo supuesto es explícito.** Cada línea de costo dice de qué depende (plan, tier, tokens).
   Nada de un número pelado: siempre **rango piso/techo** y qué lo mueve.
4. **Se separa gratis de pago y fijo de variable.** Tier gratuito primero (qué cubre y hasta
   cuándo), después lo pago. Costo fijo (hosting) aparte del variable (IA, uso).
5. **Ata el techo de gasto (regla #3).** Si hay IA o servicios pagos, la foto nombra el techo por
   llamada/mes que ya fija `integraciones-ia.md`; si no existe todavía, lo marca como pendiente.
6. **Salida en llano.** El doc lo entiende el owner; el detalle fino (fórmulas, tiers) va a un
   "Anexo técnico" al final.

## El flujo

1. **Leer la infra** (los docs de `docs/arquitectura/` + `package.json` + target de deploy) y
   listar las piezas que cuestan: hosting, base de datos, IA, mails, dominios, otros servicios.
2. **Preguntar el volumen** en un bloque (usuarios/mes, requests, tokens IA), con defaults.
3. **Estimar** cada pieza como rango piso/techo con su supuesto, sumar el total mensual, y cruzar
   con el techo de gasto (#3).
4. **Escribir `docs/arquitectura/costos.md`**: tabla pieza → costo (rango) → supuesto, total
   mensual piso/techo, tier gratuito vigente, y qué dispararía un salto de costo. Actualizar el
   mapa de `docs/arquitectura/README.md` (fila "Costo mensual estimado → costos.md").
5. **Registrar** en `DECISIONS.md` si la foto cambia una decisión (ej. bajar de tier). Mostrar el
   costo en llano y ofrecer **`/deploy`**.

**Cierre:** existe `docs/arquitectura/costos.md` con total mensual piso/techo y supuestos
explícitos; el README lo linkea; el techo de gasto (#3) está nombrado o marcado como pendiente.
