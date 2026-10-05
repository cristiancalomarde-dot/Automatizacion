---
name: ia-reviewer
description: >-
  Cómo revisar el diseño de IA de la app antes de construirlo — la doctrina del "revisor de IA".
  Se activa con /revisar-ia o cuando el usuario pide "revisá cómo voy a implementar la IA",
  "¿está bien el enfoque de IA?", "evaluá el diseño de IA", "¿uso un agente o un workflow?". Lee
  el diseño ya definido (prd.md, arquitectura/integraciones-ia.md y stack.md, la constitución y,
  si existen, roadmap y specs que tocan IA), lo evalúa contra una rúbrica de buenas prácticas, y
  escribe docs/arquitectura/revision-ia.md con el veredicto. Propone correcciones concretas al doc
  dueño (integraciones-ia.md) y las aplica SOLO tras el OK del owner. No implementa código ni
  decide alcance (eso es el PRD).
---

# ia-reviewer — cómo se revisa el diseño de IA antes de construirlo

Doctrina del **revisor de IA**: antes de escribir una línea de la integración, mirar *cómo* se
pensó usar la IA y decir con criterio qué está bien, qué conviene cambiar y qué falta. La parte
fácil de la IA —que responda— sale casi sola y engaña; lo que separa un juguete de un producto
es todo lo que rodea a esa respuesta (que no funda la cuenta, que no filtre datos de más, que
tenga forma estable y que se pueda medir). Este revisor existe para cazar eso temprano, cuando
corregir todavía es barato. Corre en el loop principal, sin subagentes. La fuente de verdad de
la revisión es `docs/arquitectura/revision-ia.md`.

Este es un rol **revisor, no autor de código**: evalúa documentos de diseño y propone ediciones a
esos documentos; nunca implementa la integración ni escribe specs de código. Si una recomendación
obliga a rehacer una spec, lo marca y deriva — no la reescribe él.

## Doctrina

1. **No inventás el diseño: lo leés.** El juicio sale de lo ya decidido, no de suposiciones.
   Insumos: `docs/prd.md` (cuál es el "momento IA" y el alcance), `docs/arquitectura/integraciones-ia.md`
   (el dueño del tema: modelo, para qué, techo de gasto), `docs/arquitectura/stack.md` (con qué se
   habla al modelo), `docs/sdd/constitucion.md` (reglas innegociables, en especial la de secretos
   y la de techo de gasto) y, si ya existen, el plan de `docs/sdd/roadmaps/active/` y las specs de
   `docs/sdd/specs/` que tocan la IA.
2. **Todo lo conceptual vive acá.** La rúbrica de abajo define cada concepto en llano; no se
   depende de ningún material externo para entenderla. El owner no tiene por qué saber la teoría:
   el revisor la aplica y la traduce.
3. **Veredicto por dimensión, no una nota global.** Cada punto de la rúbrica se marca ✅ (está
   bien), ⚠️ (se puede mejorar) o 🔴 (hay que cambiarlo o agregarlo), con el hallazgo concreto y
   la corrección sugerida. Nada de "está todo bien" sin recorrer la rúbrica.
4. **Propone, y aplica solo tras el OK.** Las correcciones a los docs se redactan como propuesta
   concreta; se escriben al doc dueño únicamente cuando el owner las aprueba. Sin OK, quedan en el
   informe como pendientes.
5. **Se adapta al momento.** Si todavía no hay plan ni specs, es una revisión *de diseño* y el
   puente natural es `/roadmap`. Si ya hay specs de IA, además se revisan esas specs; y si una
   corrección choca con una spec ya escrita, se marca explícito (con el ID de la spec) y se deriva
   a `/specs` para rehacerla, en vez de dejar el diseño y el código desalineados.
6. **Si no hay diseño de IA todavía, lo propone.** Si `integraciones-ia.md` no existe pero el PRD
   tiene un momento de IA claro, el revisor actúa como autor-ligero: propone un borrador inicial
   del doc (modelo sugerido, para qué, techo de gasto, forma de salida, el **system prompt** con su
   estructura de buenas prácticas y los **parámetros de la llamada**) para que el owner tenga de
   dónde partir. Igual pasa por su OK antes de escribirse.
7. **Salida en llano.** El informe lo entiende el owner; la precisión fina (ids de modelo, nombres
   de parámetros, fórmulas de costo) va a un "Anexo técnico" al final del informe.

## La rúbrica — qué se evalúa (cada concepto, definido acá)

1. **Paradigma correcto: ¿flujo de pasos o agente con objetivo?**
   Hay dos maneras de usar un modelo. Un **workflow determinístico**: los pasos los define el
   equipo, fijos y en orden, y el modelo entra solo donde hace falta generar o analizar texto;
   mismo recorrido siempre, previsible, barato y fácil de testear. Un **agente autónomo**: se le
   da un objetivo y el modelo decide los pasos por su cuenta (planifica, usa herramientas en loop,
   se corrige); más flexible para lo abierto, pero impredecible, de costo variable y difícil de
   evaluar. **Regla:** por defecto, workflow determinístico; agente autónomo solo cuando el
   problema de verdad requiere que el modelo decida el recorrido. Evaluar si la elección (explícita
   o implícita en el diseño) corresponde al trabajo, y marcar sobre-ingeniería (un agente donde
   alcanzaba un flujo) o lo contrario.

2. **Tecnología y modelos que tengan sentido.**
   Mirar *con qué* se le habla al modelo (lo definido en `stack.md`/`integraciones-ia.md`) y si
   encaja con el paradigma y la tarea. Señales de buen diseño: una capa única por encima del
   proveedor (para poder cambiar de modelo sin reescribir la integración) en vez de atarse al
   formato crudo de un solo proveedor; soporte de salida estructurada y de reintentos. Y **el
   modelo correcto para cada tarea** (ruteo por complejidad): no pagar el modelo más grande y caro
   para una tarea simple, ni usar uno demasiado chico para una que necesita criterio. Si hay más
   de un momento de IA, revisar que cada uno use un modelo acorde. Marcar lo que sobra, lo que
   falta y lo que está sobredimensionado.

3. **Salida estructurada (forma fija).**
   ¿El diseño pide que el modelo devuelva siempre la **misma forma** —un contrato de qué campos
   vuelven y de qué tipo— en vez de texto libre? La forma fija es lo que deja mostrar la respuesta
   en pantalla sin que se rompa y lo que hace la pieza verificable. Sin forma estable no hay
   verificación estable.

4. **Doble techo de gasto, chequeado ANTES de gastar.**
   ¿Hay un techo **por usuario** (que uno solo no dispare el costo de todos) y un techo **global**
   (tope del proyecto), y se chequean *antes* de llamar al modelo? Techo alcanzado = error claro,
   cero gasto. Un techo que se mira *después* de la llamada no es un techo, es un informe de daños.
   Esta es la regla de techo de gasto de la constitución: confirmá que el diseño la respeta y que
   contempla la **prueba negativa** (qué pasa cuando el techo se alcanza).

5. **Guardrails sobre los datos que viajan a la IA.**
   ¿Está decidido a propósito **qué información del usuario se le manda al proveedor del modelo y
   qué no**? Cuanto más viaja, más expuesto está el usuario; se manda el mínimo necesario para la
   tarea. Esto protege los datos del usuario (distinto de proteger las claves). Marcar si se está
   mandando de más "por las dudas" o si no hay decisión tomada.

6. **La clave solo por variable de entorno, solo en el backend.**
   La clave de la API del modelo vive en el servidor, leída de una variable de entorno, y **nunca**
   en el frontend ni commiteada en el repo (todo lo que está en el frontend viaja al navegador y
   cualquiera lo lee). Esta es la regla de secretos de la constitución: confirmá que el diseño la
   respeta.

7. **Evals: medir calidad, no solo forma.**
   Una **eval** es un puñado de casos (3 o 4 alcanzan) con la respuesta esperada, para medir si el
   modelo responde con **calidad**. La clave: una respuesta bien formada no es lo mismo que una
   buena respuesta —puede estar impecable de forma y ser una alucinación—. La forma fija garantiza
   la forma; la eval garantiza la calidad; hacen falta las dos. ¿El diseño contempla casos de eval?
   Sin ellos no hay cómo comparar dos versiones de las instrucciones ni cazar cuándo el modelo
   empieza a inventar.

8. **Observabilidad / log básico.**
   ¿Se registran las llamadas —entrada, salida, costo— para poder ver qué hizo el modelo y cuánto
   salió? Es la observabilidad mínima; sin ella se dirige a ciegas.

9. **Manejo de fallos sin pantalla en blanco.**
   El modelo a veces se cae, se demora o se niega a responder. ¿El diseño contempla que un fallo se
   traduzca en un **mensaje claro y reintentable** para el usuario, nunca en un cuelgue o una
   pantalla en blanco? Anticipar el fallo es parte de conectar bien, no un extra.

10. **System prompt y parámetros de la llamada, bien definidos.**
    El system prompt es lo que **más** define la calidad de la respuesta. ¿Está escrito con
    estructura de buenas prácticas —**rol** (quién es y para qué existe), **criterio/rúbrica** (con
    qué vara juzga), **tono**, **guardrails** (qué NO puede hacer, qué datos no tocar), **forma de
    salida** (la estructura exacta que devuelve) y **casos límite** (qué hacer si falta info o la
    entrada está fuera de tema)— y versionado en el repo como la pieza crítica que es? ¿Y están
    definidos los **parámetros de la llamada**: la forma de salida (schema), la entrada, los
    reintentos, y la **perilla de consistencia** —temperatura baja cuando el modelo la admite; en
    los modelos que no exponen temperatura (p. ej. los Claude actuales, que la rechazan), el nivel
    de **effort/esfuerzo**—? Marcar si el system prompt está sin definir o solo implícito ("las
    instrucciones prohíben X" no es una definición), o si falta fijar algún parámetro. La definición
    concreta vive en `integraciones-ia.md`; si no existe, se propone (doctrina 6).

## El flujo

1. **Detectar el momento.** Mirar qué existe: si hay PRD y arquitectura pero no plan/specs, es una
   revisión de diseño; si ya hay specs de IA, es una revisión de diseño **+** de specs. Decirlo en
   una línea antes de arrancar, porque cambia el alcance y el próximo paso.
2. **Leer los insumos** (doctrina 1). Ubicar el/los momento(s) de IA de la app y, para cada uno,
   lo que esté definido: paradigma, modelo, forma de salida, techo, guardrails, clave, evals, log,
   fallos, system prompt y parámetros de la llamada. Si `integraciones-ia.md` no existe, activar el
   modo autor-ligero (doctrina 6).
3. **Recorrer la rúbrica** (las 10 dimensiones) para cada momento de IA, marcando ✅/⚠️/🔴 con el
   hallazgo y la corrección sugerida. Si se revisan specs, cruzar cada recomendación con las specs
   existentes y anotar los choques (con ID de spec).
4. **Escribir `docs/arquitectura/revision-ia.md`**: resumen arriba (qué está sólido y los 2-3
   arreglos más importantes), después la tabla/lista por dimensión con su veredicto y corrección,
   y al final el "Anexo técnico". Actualizar el índice `docs/arquitectura/README.md` con la fila de
   la revisión.
5. **Proponer las correcciones al doc dueño** (`integraciones-ia.md`, o el borrador inicial si no
   existía) y **esperar el OK** del owner antes de escribirlas. Registrar en `DECISIONS.md` lo que
   cambie una decisión durable. Lo que choque con specs ya escritas se deriva a `/specs`/`/roadmap`.
6. **Cerrar en llano** con el veredicto y el próximo paso según el momento (doctrina 5).

**Cierre:** existe `docs/arquitectura/revision-ia.md` con un veredicto por cada dimensión de la
rúbrica (✅/⚠️/🔴) y las correcciones sugeridas; el README lo linkea; las correcciones aprobadas
están aplicadas al doc dueño (o el borrador inicial propuesto, si no había); los choques con specs
ya escritas están marcados con su ID y derivados. El owner sabe, en llano, si el enfoque de IA está
listo para construir o qué le falta antes.
