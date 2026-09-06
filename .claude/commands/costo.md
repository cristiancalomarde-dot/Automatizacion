---
description: La foto del costo — analiza la infra, pregunta el volumen de uso estimado y estima el costo mensual. Invoca la skill cost-estimator, que escribe docs/arquitectura/costos.md. No cambia el stack ni despliega.
argument-hint: "[supuestos de volumen, o vacío = preguntar]"
---

# /costo

Invocá la skill **`cost-estimator`** (Skill tool) y seguí su doctrina con esta entrada:

**$ARGUMENTS**

- Si no hay `docs/arquitectura/stack.md`, primero `/arquitectura` (sin stack no hay qué costear).
- Corrés en el loop principal (sin subagentes). Preguntás el volumen **una sola vez, en un bloque**.
- Al terminar, mostrá el costo mensual en lenguaje llano (piso/techo + supuestos) y ofrecé **`/deploy`**.
