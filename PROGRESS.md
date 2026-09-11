<!-- PROGRESS.md — la nota corta de "dónde retomar". Actualizar antes de cerrar cada sesión.
El estado pieza por pieza NO va acá: vive en la tabla del plan (docs/sdd/roadmaps/active/). -->

# Dónde retomar

- **Último commit:** (ver `git log` — sumado alcance de tours compuestos) — local, falta `git push`
- **Verificación completa:** no aplica todavía (sin código)
- **Plan activo:** ninguno todavía
- **Próximo paso:** correr `/roadmap M1` para armar el plan del primer milestone
  (catálogo + proveedores como datos del sistema, vía el importador que lee los Excel).
- **Ojo con:**
  - **Push a GitHub:** requiere que el owner corra `git push` desde una terminal real (login de
    GitHub). El commit local queda hecho.
  - **Decisiones abiertas de arquitectura** (no bloquean el roadmap, sí antes de M2):
    - casilla de mail: cuenta Gmail común nueva vs. dirección `@hitravel.com.ar` (Google Workspace ~US$7/mes).
    - cuentas Vercel/Supabase/Anthropic: personales vs. de la empresa (recomendado: empresa).
  - **Riesgo grande:** leer el Excel de paquetes (2218 filas, bloques por columna) es lo más
    difícil del proyecto; va a necesitar vueltas de preguntas owner↔agente. Anotado en DECISIONS.md.
  - Make y el Google Sheet MVP quedan **dados de baja** (se apagan al terminar M2); no son parte
    de la solución. El aprendizaje (campos a extraer, filtro "NEW BOOKING", 36 reservas de prueba)
    se reusa.
  - **Alcance sumado (2026-09-11):** los **tours compuestos** (paquetes encadenados + a veces
    tramos de bus externo, ej. Patagonia Highlights, Overland San Pedro–Uyuni) entran al MVP desde
    M1. **Journaway** queda pospuesto a un milestone posterior (formato en alemán/inglés, catálogo
    propio chico). Detalle en `DECISIONS.md` (2026-09-11) y `docs/prd.md` §2-§6.

## Estado del método (los 8 comandos)

- ✅ `/prd` — `docs/prd.md` escrito.
- ✅ `/arquitectura` — 8 documentos en `docs/arquitectura/` (stack, modelo de datos, secretos,
  user-flow, marca, integraciones-ia, integraciones, auth-y-permisos); constitución con dueños
  #1-#4; PRD §7 enlazado; decisiones en DECISIONS.md.
- ⬜ `/roadmap M1` — siguiente.
