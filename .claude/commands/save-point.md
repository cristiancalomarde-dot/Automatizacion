---
description: Red de seguridad con Git — deja un punto de retorno antes de un cambio grande. No borra historia, no hace force-push, no toca ramas remotas.
argument-hint: "<etiqueta corta, ej: antes-de-conectar-llm>"
---

# /save-point

Dejá un **punto de retorno** en Git con la etiqueta **$ARGUMENTS** (si viene vacía, pedila).

1. `git status` + `git log --oneline -5`. Si el árbol está limpio, el punto es el `HEAD` actual:
   confirmá su hash y saltá al paso 3.
2. Si hay cambios sin guardar, ofrecé: **commit** (recomendado:
   `git add -A && git commit -m "save point: <etiqueta>"`), o stash / rama de respaldo si el owner
   prefiere no commitear. Que elija él.
3. Mostrá el **hash** que queda como punto de retorno, junto con la etiqueta.
4. Explicá cómo volver: mirar sin mover la rama (`git checkout <hash>`) o volver del todo
   (`git reset --hard <hash>`, que descarta lo posterior).

> Límites: no borra historia, no hace `push --force`, no toca ramas remotas.
