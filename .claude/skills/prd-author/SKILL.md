---
name: prd-author
description: >-
  Cómo bajar una idea difusa a un PRD chico y accionable — la doctrina del Analista de Producto
  (etapa 1). Se activa con /prd o cuando el usuario pide "armá el PRD", "bajá esto a un MVP",
  "definí qué construimos". Hace UNA ronda de preguntas (3-5, en un solo bloque) y converge en un
  MVP que es UN recorrido de valor completo, con milestones que dicen cómo se demuestra que están
  terminados y una lista explícita de lo que queda afuera. Escribe docs/prd.md. El cómo técnico no
  se decide acá (eso es la etapa 2).
---

# prd-author — cómo se escribe el PRD

Doctrina de la **etapa 1**: convertir una idea cruda en el documento que manda **qué se construye
y en qué orden**. El PRD es dueño del *qué*; el *cómo* técnico es de `architecture-author`
(etapa 2) y no se decide acá.

## Doctrina

1. **El MVP es UN recorrido de valor completo, no una lista de features.** El camino más corto que
   entrega un resultado visible de principio a fin. Si es una pila de features sueltas, no es un MVP.
2. **Cada milestone dice cómo se demuestra que está terminado.** Condiciones que pasan o no pasan
   — alguien lo puede ver funcionar, no alguien que dice que está hecho.
3. **Lo que queda afuera se escribe.** "Una cosa a la vez" y "base primero": el alcance se achica
   quitando features, nunca bajando la vara de terminado (regla de gestión del PRD §8).
4. **Una sola ronda de preguntas, en un solo bloque.** Antes de escribir, juntá TODAS las preguntas
   que de verdad bloquean (3-5 máximo) y hacelas juntas con la herramienta de preguntas. Lo que la
   idea ya responde, no se re-pregunta. Lo no bloqueante se anota en §6 (preguntas abiertas) y no
   frena el documento.
5. **Toda pregunta técnica se sirve digerida.** El owner no es técnico: si la decisión es técnica,
   la pregunta explica en llano qué significa, da los pros y contras de cada opción, y **sugiere
   una** según el contexto del proyecto. Nunca una pregunta técnica cruda que no pueda responder.
6. **Riesgos con su límite aceptado.** Cada riesgo dice hasta dónde se tolera y qué se hace al
   cruzar ese punto. Un riesgo sin límite es una preocupación, no una decisión.

## El flujo

1. **Ingerir.** Leer la idea y devolverla en 2-3 frases para confirmar la lectura.
2. **Preguntar (un bloque).** Cubrir solo lo que falte: qué hace y para quién · qué problema
   resuelve · cuál es el resultado observable de éxito · qué NO entra.
3. **Escribir.** Completar la plantilla `docs/prd.md` reemplazando los `<...>` — completar, no
   reescribir su estructura. Foco: §2 (MVP), §3 (milestones) y §5 (fuera de alcance).
4. **Entregar.** Mostrar el PRD en lenguaje llano y ofrecer el puente: **`/arquitectura`**.

**Cierre:** el MVP es un recorrido completo; cada milestone es demostrable; el fuera de alcance es
explícito; no quedan preguntas bloqueantes sin responder.
