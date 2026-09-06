---
description: El QUÉ de tu app — de la idea al PRD. Invoca la skill prd-author, que pregunta una vez (un bloque) y escribe docs/prd.md. No hace arquitectura, specs ni código.
argument-hint: "<idea del producto en lenguaje natural>"
---

# /prd

Invocá la skill **`prd-author`** (Skill tool) y seguí su doctrina con esta entrada:

**$ARGUMENTS**

- Si la entrada viene vacía, pedí la idea antes de arrancar. Si existen `docs/icp.md` y/o
  `docs/solucion.md`, usalos como insumos (no re-preguntes lo que ya responden).
- Corrés en el loop principal (sin subagentes).
- Al terminar, mostrá el resultado en lenguaje llano y ofrecé **`/arquitectura`**.
