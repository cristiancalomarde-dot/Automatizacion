<!--
Plantilla de PLAN — el índice y el estado de un milestone. Copiala a
docs/sdd/roadmaps/active/m<n>-<tema>.md y completala. Un plan descompone UN milestone del PRD
en specs; el detalle de cada spec vive en docs/sdd/specs/.
LA TABLA DE ABAJO ES EL ÚNICO LUGAR DONDE VIVE EL ESTADO de las specs.
-->

# <Milestone M#> — plan

## 1. Qué logramos con este milestone
<1-3 frases en llano, atadas al milestone de `docs/prd.md`.>

## 2. Qué queda afuera
<Lo que NO entra en esta tanda. Si ya está en el "fuera de alcance" del PRD, linkealo.>

## 3. Preguntas y riesgos
<Las preguntas que se respondieron antes de planear (con su respuesta) y las que siguen abiertas
(con quién las responde y si bloquean). Riesgos con su límite aceptado.>

## 4. Reglas del proyecto que toca este milestone
<Números de [la constitución](../constitucion.md) + una línea de por qué. El detalle por spec va
en cada spec.>

- **#<n>** — <por qué la toca>

## 5. Las piezas de trabajo (ESTA TABLA ES EL ESTADO)

<Una fila por spec. El orden de construcción lo dan las dependencias. Estados:
⬜ pendiente · 🔵 en curso · ✅ terminada. Cada condición de terminado del milestone en el PRD
tiene que estar cubierta por al menos una fila.>

| ID | Pieza | Estado | Depende de | Ficha |
|---|---|---|---|---|
| M#-01 | <título corto> | ⬜ pendiente | — | `docs/sdd/specs/M#-01-<tema>.md` |

## 6. Cuándo está terminado el milestone
- [ ] Todas las filas de la tabla en ✅ (cada una con sus 3 verificaciones en verde, regla #5).
- [ ] Las condiciones del milestone en `docs/prd.md` se cumplen y se pueden demostrar.
- [ ] **El owner lo probó con sus ojos:** el agente le dejó la app levantada y el link servido,
      y él confirmó que lo que ve está bien.
- [ ] Este plan movido a `docs/sdd/roadmaps/archive/`.
