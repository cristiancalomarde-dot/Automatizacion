# M3-40 · Los motivos de Journaway se leen en pantalla

**Depende de:** M3-30, M3-39. Visto el 2026-10-29 al cerrar M3-39: la reserva Petzold muestra su motivo como
"Esta reserva necesita que alguien la revise." (frase `generico`), y el texto real ("Journaway pide 'Night Bus
Peru' (31.05–01.06), que no es parte de SPAP05: consultarlo con Journaway") solo aparece en el historial al
resolverlo. Quien revisa no sabe qué revisar.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Los motivos de Journaway que ya se guardan en llano** (los que arma `src/lib/reservas/journaway/` y sus textos de motivos, ej. el de M3-30 "Journaway pide '…' …, que no es parte de …: consultarlo con Journaway") se muestran tal cual en el detalle y en el listado, no con la frase genérica. Reconocerlos por su forma (una categoría nueva en `PATRONES` de `src/lib/reservas/reglas.ts`), no mostrando cualquier texto desconocido: los motivos internos sin frase siguen con la genérica (regla de reglas.ts: nunca mostrar texto interno) | Unitario de `frasesDeMotivos`: el motivo de Petzold sale con su texto; un texto interno desconocido sigue saliendo genérico |
| 2 | **Revisar los demás motivos de Journaway** (los de M2-09: tour no reconocido, Pax distinto, etc.) y que todos los que están en llano salgan con su texto | Unitario con cada texto de motivo de Journaway |
| 3 | **"Marcar como resuelto" (M3-39) sigue funcionando** con esos motivos y el historial igual | Tests de M3-39 en verde |
| 4 | **Nada más cambia** | Recorridos M2/M3 en verde |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.
