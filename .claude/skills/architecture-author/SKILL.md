---
name: architecture-author
description: >-
  Cómo fijar las decisiones técnicas del proyecto — la doctrina del Arquitecto (etapa 2). Se activa
  con /arquitectura o cuando el usuario pide "definí la arquitectura", "dónde se guardan los
  datos", "modelo de datos". Escribe UN documento por tema en docs/arquitectura/ (stack, modelo de
  datos, secretos, user flow, marca — y si aplican: integraciones IA, otras integraciones, auth y
  permisos), numera las reglas innegociables en docs/sdd/constitucion.md y al terminar actualiza
  docs/prd.md con los links. Despacha en paralelo al Diseñador (ux-reviewer, modo autor) para los
  borradores de user-flow.md y marca.md. No decide alcance (eso es docs/prd.md) ni implementa.
---

# architecture-author — cómo se fijan las decisiones técnicas

Doctrina de la **etapa 2**: bajar el PRD (el *qué*) a las **decisiones técnicas** (el *cómo*),
para que no se re-discutan en cada spec. **Un documento por tema** en `docs/arquitectura/`,
todos escritos en la misma pasada (sin subagentes).

## Doctrina

1. **Un documento por tema.** Los que se escriben **siempre**:
   - `stack.md` — con qué se construye, dónde corre y se publica, y el **costo mensual estimado**.
   - `modelo-de-datos.md` — qué datos existen, dónde viven y, si hay datos de más de un usuario,
     cómo se aíslan entre sí (regla #1). Si no hay base de datos, el doc lo dice en pocas líneas
     y por qué.
   - `secretos.md` — qué claves necesita el proyecto, de dónde salen (variables de entorno) y
     cómo NUNCA tocan el código (regla #2).
   - `user-flow.md` — el recorrido del usuario por la app, de la entrada al resultado.
   - `marca.md` — identidad visual y tono: colores, tipografía, voz de los textos. Lo que hace
     que la app no parezca un prototipo genérico.

   `user-flow.md` y `marca.md` son de diseño de producto, no de arquitectura: **sus borradores
   los propone el Diseñador (`ux-reviewer`, modo autor)** — ver el despacho en el flujo, punto 2.

   Y los **condicionales** — solo si el proyecto los necesita (si no, NO se crea el archivo y el
   índice lo marca):
   - `integraciones-ia.md` — modelo, para qué se usa, y el **techo de gasto** por llamada (regla #3).
   - `integraciones.md` — otros sistemas externos (pagos, mails, APIs); todo efecto hacia afuera
     cita la regla #4.
   - `auth-y-permisos.md` — cómo entra el usuario (autenticación) y qué puede hacer cada rol.
2. **Un hecho, un dueño.** Si un doc necesita algo que ya vive en otro, linkea — no copia.
   El índice `docs/arquitectura/README.md` se actualiza con el mapa tema→archivo (y qué
   condicionales quedaron afuera y por qué).
3. **Las reglas innegociables se numeran.** Cada MUST/MUST NOT se enuncia en su doc dueño y se
   registra en `docs/sdd/constitucion.md` con su `#<n>` (completar los dueños "pendiente" de
   #1–#4 apuntando al doc real). Desde cualquier otro documento se cita por número, no se copia.
4. **El porqué durable va a `DECISIONS.md`.** Una entrada por decisión que se sostiene (qué se
   eligió, qué se descartó, por qué). Lo sin resolver va a la sección `## Abierto` del doc dueño.
5. **No decide alcance.** Si aparece un "¿esto entra o no?", es del PRD.
   Si una decisión técnica es genuinamente del owner, se le sirve digerida: qué significa en
   llano, pros y contras, y una opción sugerida según el contexto.
6. **Salida en llano.** Los docs se escriben para que el owner los entienda; la precisión fina
   para los agentes va en un "Anexo técnico" al final de cada doc que lo necesite.

## El flujo

1. **Leer el PRD** (`docs/prd.md`): MVP, milestones, fuera de alcance. Las decisiones sirven a
   ese *qué*, no lo amplían.
2. **Despachar al Diseñador y escribir en paralelo.** Primero despachá al **`ux-reviewer` en
   modo autor** (Agent tool — corre en background) para que proponga los borradores de
   `user-flow.md` y `marca.md` a partir del ICP, la solución y el PRD. Mientras trabaja,
   escribí vos los documentos técnicos (stack, modelo de datos, secretos, integraciones, auth).
   Cuando vuelva, consolidá sus borradores: escribí los dos archivos, resolvé lo que cruce a lo
   técnico (eso es tuyo) y validá con el owner. Actualizá el `README.md` de la carpeta
   (índice tema→archivo).
3. **Reconciliar la constitución**: completar los dueños de #1–#4 y numerar reglas nuevas.
4. **Actualizar el PRD**: completar la sección "El cómo técnico" de `docs/prd.md` con el link a
   cada documento escrito (y los condicionales que no aplican, en una línea). El PRD queda como
   mapa de entrada a la arquitectura.
5. **Registrar** las decisiones durables en `DECISIONS.md` y ofrecer el puente: **`/roadmap`**.

**Cierre:** cada regla innegociable tiene número y dueño; los docs obligatorios existen y los
condicionales están decididos (creados o descartados con por qué); el PRD linkea la arquitectura;
las decisiones durables están en DECISIONS.md.
