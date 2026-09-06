---
description: Tu app, online — corre el control "listo para publicar" (deploy-engineer + ux-reviewer en paralelo) y, con GO y la confirmación del owner, ejecuta el deploy real y muestra la URL pública.
argument-hint: "[entorno, ej: prod]"
---

# /deploy

Publicá la app. Entorno: **$ARGUMENTS** (vacío = `prod`, decilo explícito).

1. **Control previo — despachá dos subagentes en paralelo** (Agent tool, en el mismo mensaje):
   - **`deploy-engineer`** — el checklist "listo para publicar" completo, incluidos API key
     segura y techo de gasto. Pasale el entorno.
   - **`ux-reviewer`** — que la app se pueda publicar sin vergüenza. Saltealo si ya corrió
     sobre este mismo código en esta sesión.
2. **Consolidá un solo veredicto** en lenguaje llano: **GO** solo si todo está ✅; **NO-GO**
   si hay al menos un ❌, listando qué falta — y ahí termina, sin publicar.
3. **Con GO, publicá de verdad** — publicar es un efecto hacia afuera (regla #4): pedí la
   confirmación explícita del owner y recién ahí ejecutá el deploy real del proyecto
   (`vercel --prod`, o `git push` si el repo auto-deploya). Cerrá mostrando la **URL
   pública** y confirmando que responde.
