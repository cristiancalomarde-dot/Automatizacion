---
description: El orden de construcción — del milestone al plan con su tabla de piezas. Invoca la skill planner (fases de plan), que pregunta una vez (un bloque) y escribe docs/sdd/roadmaps/active/. El detalle de cada spec lo escribe /specs.
argument-hint: "<M# o braindump de la feature>"
---

# /roadmap

Invocá la skill **`planner`** (Skill tool) y ejecutá sus fases de PLAN con esta entrada:

**$ARGUMENTS**

- Si la entrada viene vacía, preguntá qué milestone del PRD planear.
- Ejecutá: leer el milestone → la ronda de preguntas (un solo bloque) → escribir el plan
  (`docs/sdd/roadmaps/active/m<n>-<tema>.md`) con su tabla de piezas. **No** escribas el detalle
  de las specs acá — eso es `/specs`.
- Corrés en el loop principal (sin subagentes).
- Al terminar, mostrá la tabla en lenguaje llano y ofrecé **`/specs`**.
