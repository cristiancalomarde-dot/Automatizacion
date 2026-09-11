<!-- PROGRESS.md — la nota corta de "dónde retomar". Actualizar antes de cerrar cada sesión.
El estado pieza por pieza NO va acá: vive en la tabla del plan (docs/sdd/roadmaps/active/). -->

# Dónde retomar

- **Último commit:** (ver `git log` — plan de M1 recién escrito) — local, falta `git push`
- **Verificación completa:** no aplica todavía (sin código)
- **Plan activo:** `docs/sdd/roadmaps/active/m1-catalogo-y-proveedores.md` — 6 piezas, todas ⬜ pendientes
- **Próximo paso:** correr `/implementar M1-01` para arrancar a construir (las 6 fichas de M1 ya
  están escritas en `docs/sdd/specs/`).
- **Ojo con:**
  - **Push a GitHub:** requiere que el owner corra `git push` desde una terminal real (login de
    GitHub). Los commits locales quedan hechos, se van acumulando.
  - **Antes de construir M1-01** (no bloquea el plan, sí la primera spec): definir si las cuentas
    de Vercel/Supabase/Google Cloud son personales o de la empresa (recomendado: empresa).
  - **Antes de M1-04:** confirmar el alcance exacto de productos simples de Iguazú a cargar (se
    asumió lo que aparece en la muestra de reservas de Kilroy — OD010A/B/C/D).
  - **Riesgo grande:** leer el Excel de paquetes (2218 filas, bloques por columna) es lo más
    difícil del proyecto — es su propia spec (M1-05) después de probar con productos simples.
  - **Casilla de mail** (no bloquea M1, sí M2): cuenta Gmail común nueva vs. dirección
    `@hitravel.com.ar` (Google Workspace ~US$7/mes).
  - Make y el Google Sheet MVP quedan **dados de baja** (se apagan al terminar M2); no son parte
    de la solución. El aprendizaje (campos a extraer, filtro "NEW BOOKING", 36 reservas de prueba)
    se reusa.
  - **Alcance del MVP (sumado 2026-09-11):** tours compuestos (Patagonia Highlights, Overland
    San Pedro–Uyuni y otros 5 top-seller) entran desde M1. Journaway queda pospuesto. Datos de
    vuelo son obligatorios cuando el producto lleva traslado. Proveedores por WhatsApp y tramos de
    bus externo quedan como tarea manual, nunca automatizados. Asana anotado como candidato
    post-MVP. Detalle en `DECISIONS.md` y `docs/prd.md`.

## Estado del método (los 8 comandos)

- ✅ `/prd` — `docs/prd.md` escrito, con el alcance de tours compuestos ya incorporado.
- ✅ `/arquitectura` — 8 documentos en `docs/arquitectura/` (stack, modelo de datos, secretos,
  user-flow, marca, integraciones-ia, integraciones, auth-y-permisos); constitución con dueños
  #1-#4; PRD §7 enlazado; decisiones en DECISIONS.md.
- ✅ `/roadmap M1` — plan con 6 piezas en `docs/sdd/roadmaps/active/`.
- ✅ `/specs` — las 6 fichas escritas en `docs/sdd/specs/` (M1-01 a M1-06).
- ⬜ `/implementar M1-01` — siguiente: construir la primera pieza.
