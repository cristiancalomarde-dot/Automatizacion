---
description: Las instrucciones detalladas — escribe la ficha (spec) de cada fila del plan en docs/sdd/specs/, siguiendo la skill planner. Con 3 o menos las escribe directo; con más, delega en paralelo. No implementa código.
argument-hint: "[ruta del plan, o vacío = el plan activo]"
---

# /specs

Invocá la skill **`planner`** (Skill tool) y ejecutá su fase de SPECS sobre este plan:

**$ARGUMENTS** (vacío = el plan de `docs/sdd/roadmaps/active/`; si no hay ninguno, primero `/roadmap`)

- Escribí la ficha de cada fila de la tabla (`docs/sdd/specs/<ID>-<tema>.md` con la
  plantilla), heredando las respuestas de la ronda de preguntas del plan — no re-preguntes.
- Con **3 piezas o menos**, escribilas directo en el loop principal; con más, delegá en
  subagentes **todos a la vez** (Agent tool, sin esperas entre tandas).
- Al terminar, mostrá el índice en lenguaje llano y ofrecé **`/implementar <primer ID>`**.
