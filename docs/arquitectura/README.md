# Arquitectura — el *cómo* del proyecto

> **Dueño de:** las decisiones técnicas del proyecto — **un documento por tema**, escritos por
> `/arquitectura`. **No cubre:** el alcance (→ [`../prd.md`](../prd.md)) · el proceso de trabajo
> (→ [`../sdd/README.md`](../sdd/README.md)).

## Mapa tema → documento

| Tema | Documento | Reglas que numera |
|---|---|---|
| Stack y deploy | `stack.md` | — |
| Modelo de datos (y aislamiento entre usuarios) | `modelo-de-datos.md` | #1 |
| Secretos y claves | `secretos.md` | #2 |
| Recorrido del usuario | `user-flow.md` | — |
| Marca: identidad visual y tono | `marca.md` | — |
| Integraciones con IA + techo de gasto *(si aplica)* | `integraciones-ia.md` | #3 |
| Integraciones con otros sistemas *(si aplica)* | `integraciones.md` | #4 |
| Autenticación y permisos *(si aplica)* | `auth-y-permisos.md` | — |
| Costo mensual estimado *(lo escribe `/costo`)* | `costos.md` | — |
| Monitoreo de errores — Sentry *(si se instala, `/instalar-sentry`)* | `sentry.md` | — |
| Analítica de producto — PostHog *(si se instala, `/instalar-posthog`)* | `posthog.md` | — |

*(`/arquitectura` actualiza esta tabla al escribir: los condicionales que no aplican quedan
marcados acá con una línea de por qué, sin crear el archivo.)*

Reglas de esta carpeta:
- **Un hecho, un dueño:** si algo ya está explicado en un doc, se linkea, no se copia.
- Las reglas innegociables se numeran en [`../sdd/constitucion.md`](../sdd/constitucion.md) y se
  citan por `#<n>`.
- El porqué de cada decisión durable va a [`DECISIONS.md`](../../DECISIONS.md); lo que queda sin
  resolver, a la sección `## Abierto` del doc dueño.
