# Arquitectura — el *cómo* del proyecto

> **Dueño de:** las decisiones técnicas del proyecto — **un documento por tema**, escritos por
> `/arquitectura`. **No cubre:** el alcance (→ [`../prd.md`](../prd.md)) · el proceso de trabajo
> (→ [`../sdd/README.md`](../sdd/README.md)).

## Mapa tema → documento

| Tema | Documento | Reglas que numera | Estado |
|---|---|---|---|
| Stack y deploy | [`stack.md`](stack.md) | — | ✅ escrito |
| Modelo de datos (y aislamiento entre usuarios) | [`modelo-de-datos.md`](modelo-de-datos.md) | #1 | ✅ escrito |
| Secretos y claves | [`secretos.md`](secretos.md) | #2 | ✅ escrito |
| Recorrido del usuario | [`user-flow.md`](user-flow.md) | — | ✅ escrito |
| Marca: identidad visual y tono | [`marca.md`](marca.md) | — | ✅ escrito |
| Integraciones con IA + techo de gasto | [`integraciones-ia.md`](integraciones-ia.md) | #3 | ✅ aplica — Claude lee los mails de reserva y ayuda al importador |
| Integraciones con otros sistemas | [`integraciones.md`](integraciones.md) | #4 | ✅ aplica — Gmail (lectura de la casilla + envío a proveedores) |
| Autenticación y permisos | [`auth-y-permisos.md`](auth-y-permisos.md) | — | ✅ aplica — login con Google restringido al dominio, rol único |
| Costo mensual estimado *(lo escribe `/costo`)* | `costos.md` | — | ⬜ pendiente — estimación gruesa en `stack.md` |
| Monitoreo de errores — Sentry *(si se instala, `/instalar-sentry`)* | `sentry.md` | — | ⬜ no instalado |
| Analítica de producto — PostHog *(si se instala, `/instalar-posthog`)* | `posthog.md` | — | ⬜ no instalado |

Reglas de esta carpeta:
- **Un hecho, un dueño:** si algo ya está explicado en un doc, se linkea, no se copia.
- Las reglas innegociables se numeran en [`../sdd/constitucion.md`](../sdd/constitucion.md) y se
  citan por `#<n>`.
- El porqué de cada decisión durable va a [`DECISIONS.md`](../../DECISIONS.md); lo que queda sin
  resolver, a la sección `## Abierto` del doc dueño.
