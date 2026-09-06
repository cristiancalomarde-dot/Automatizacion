---
description: La puerta de entrada — te dice dónde está el proyecto y cuál es el único paso siguiente. Si el proyecto está virgen, te pide la idea y te lleva a /prd. Sin subagentes.
argument-hint: ""
---

# /empezar

Orientá al owner en lenguaje llano, sin jerga. Corrés en el loop principal.

1. **Mirá el estado:** ¿`docs/prd.md` sigue siendo la plantilla (placeholders `<...>`)?
   - **Sí (proyecto virgen):** saludá y pedile la idea en sus palabras — qué quiere construir y
     para quién. Con eso, ofrecé arrancar con `/prd <su idea>`.
   - **No (proyecto en marcha):** leé `PROGRESS.md` y la tabla del plan activo
     (`docs/sdd/roadmaps/active/`), y resumí en 2-3 frases dónde está el proyecto.
2. **Decí EL paso siguiente** — uno solo, respetando "una cosa a la vez": el comando exacto o la
   frase exacta a tipear (ej. *"construí M1-02"*), y qué va a obtener al correrlo.
3. Si la verificación completa de `CLAUDE.md` está definida y hay código, corrélá y contá el
   resultado en una línea (está todo sano / hay algo roto).

> No arranques trabajo nuevo sin que el owner lo confirme.
