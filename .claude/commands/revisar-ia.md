---
description: La revisión de cómo vas a implementar la IA — invoca la skill ia-reviewer, que audita el diseño de IA ya definido (paradigma, modelos/stack, salida estructurada, techo de gasto, guardrails, clave, evals, observabilidad, fallos), escribe docs/arquitectura/revision-ia.md y propone correcciones al doc dueño tras tu OK. No implementa código ni decide alcance.
argument-hint: "[indicaciones sobre qué mirar, o vacío = derivar de los docs]"
---

# /revisar-ia

Invocá la skill **`ia-reviewer`** (Skill tool) y seguí su doctrina con esta entrada:

**$ARGUMENTS**

- Si la entrada viene vacía, derivá qué revisar de `docs/prd.md` y `docs/arquitectura/`. Si no
  hay ni PRD ni arquitectura, no hay diseño de IA que revisar: primero `/prd` y `/arquitectura`.
- Corrés en el **loop principal** (sin subagentes). Las correcciones a los docs las aplicás
  **solo después del OK** del owner.
- Al terminar, mostrá el veredicto en lenguaje llano y ofrecé el próximo paso **según el
  momento**: si todavía no hay plan, **`/roadmap`**; si ya hay specs de IA, **`/implementar
  <ID de la spec de IA>`** — y si una corrección obliga a rehacer una spec ya escrita, **`/specs`**.
