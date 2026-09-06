---
name: planner
description: >-
  Cómo convertir un milestone del PRD en un plan con specs listas para construir — la doctrina del
  Planificador (etapa de plan). Se activa con /roadmap (el plan y su tabla) y /specs (la ficha de
  cada pieza), o cuando el usuario pide "armá el plan", "partime esto en specs", "descomponé el
  milestone". Hace UNA ronda de preguntas bloqueantes en un solo bloque, escribe el plan
  (docs/sdd/roadmaps/active/) con su tabla de specs — la ÚNICA fuente del estado — y el detalle de
  cada spec (docs/sdd/specs/). Con 3 specs o menos las escribe directo; con más, delega en
  paralelo. No implementa código.
---

# planner — cómo se arma el plan y sus specs

Doctrina de la etapa de planificación: de un milestone del PRD a un **plan** (el índice, lo
ejecuta `/roadmap`) y sus **specs** (la ficha de cada pieza, las ejecuta `/specs`). Una sola
doctrina, dos comandos que la orquestan por fases.

## Doctrina

1. **La entrada es el milestone del PRD.** Leer `docs/prd.md` y tomar objetivo, condiciones de
   terminado y riesgos de ese milestone. Lo que el PRD ya declara no se re-pregunta: se ejecuta.
   Si el plan descubre trabajo que ningún milestone pide, eso es un agujero del PRD — se avisa y
   se arregla allá.
2. **Una ronda de preguntas, en un solo bloque.** Recorrer todo el milestone, juntar las preguntas
   que de verdad bloquean y hacerlas juntas con la herramienta de preguntas, ANTES de escribir.
   Lo no bloqueante se anota como pregunta abierta en el plan y no frena nada. **Toda pregunta
   técnica se sirve digerida:** qué significa en llano, pros y contras de cada opción, y una
   opción sugerida según el contexto — nunca una pregunta cruda que el owner no pueda responder.
3. **Specs chicas y comprobables.** Cada spec: un resultado que se puede ver funcionar, con IDs
   `M#-##` y sus dependencias anotadas (`Depende de`). Cada condición de terminado del milestone
   tiene que estar cubierta por al menos una spec — un ítem sin spec es un agujero del plan.
   **Si la pieza tiene interfaz, la spec declara qué ve el usuario** (pantallas, recorrido y los
   estados de carga/error/vacío, como pide la plantilla) — se define acá, no se descubre al
   construir.
4. **La tabla del plan es la ÚNICA fuente del estado.** Las specs no llevan estado propio; qué
   está pendiente, en curso o terminada se lee y se actualiza SOLO en la tabla del plan.
5. **Las reglas innegociables se citan por número.** El plan lista qué reglas de
   `docs/sdd/constitucion.md` toca el milestone (`#<n>` + una línea de por qué); cada spec detalla
   cómo cumple las suyas. Nunca se copia el enunciado.
6. **Plantillas al mínimo.** Plan: `docs/sdd/roadmaps/TEMPLATE.md`. Spec: `docs/sdd/specs/TEMPLATE.md`.
   Las secciones que no aplican **se borran** — no se rellenan con justificaciones.
7. **Escala según el tamaño.** Con **3 specs o menos**, escribirlas directo en esta misma pasada.
   Con más, delegar la autoría en subagentes **todos a la vez, sin esperas entre tandas** (las
   dependencias se anotan en cada spec; no ordenan la escritura). Cada subagente recibe esta
   doctrina + la fila de su spec + las respuestas de la ronda de preguntas.
8. **No se implementa acá.** El plan y las specs son papel; el código es la etapa siguiente,
   una spec a la vez.

## El flujo

1. **Leer** el milestone en `docs/prd.md` y los docs de `docs/arquitectura/`. Reflejar en 2-3
   frases qué se va a planear.
2. **Preguntar (un bloque)** solo lo que el PRD y la arquitectura dejan ambiguo.
3. **Escribir el plan** (`docs/sdd/roadmaps/active/m<n>-<tema>.md` con la plantilla): objetivo,
   fuera de alcance, riesgos, reglas tocadas y la tabla de specs.
4. **Escribir las specs** (`docs/sdd/specs/<ID>-<tema>.md` con la plantilla), directo o delegado
   según el punto 7.
5. **Entregar** el plan con su tabla y ofrecer el puente: **`/implementar <ID>`** (el Programador).

**Cierre:** cada condición del milestone tiene su spec; cada spec tiene criterios comprobables y
dependencias; la tabla del plan refleja todo; no quedan preguntas bloqueantes.
