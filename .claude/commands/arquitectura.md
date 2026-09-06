---
description: El CÓMO técnico — del PRD a las decisiones. Invoca la skill architecture-author, que escribe un documento por tema en docs/arquitectura/ (despachando al Diseñador en paralelo para user-flow y marca) y numera las reglas en la constitución. No decide alcance ni implementa.
argument-hint: "[indicaciones técnicas, o vacío = derivar del PRD]"
---

# /arquitectura

Invocá la skill **`architecture-author`** (Skill tool) y seguí su doctrina con esta entrada:

**$ARGUMENTS**

- Si la entrada viene vacía, derivá los temas de `docs/prd.md`. Si no hay PRD, primero `/prd`.
- Corrés en el loop principal; el único despacho es el Diseñador (`ux-reviewer`, modo autor)
  en paralelo, como manda la skill.
- Al terminar, mostrá las decisiones en lenguaje llano y ofrecé **`/roadmap`**.
