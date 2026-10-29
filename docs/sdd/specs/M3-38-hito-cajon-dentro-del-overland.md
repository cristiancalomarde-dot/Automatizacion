# M3-38 · El traslado San Pedro → Hito Cajón va dentro del Overland

**Depende de:** M3-30. Pedida por el owner el 2026-10-28 (Journaway Petzold, ID 66688059968, SPAP05).

Hoy, en SPAP05/SPAP06, el pedido a Imperio Inca trae el traslado en un renglón suelto ("1) Traslado: Transfer
San Pedro - Hito Cajon regular") y el Overland en otro; la reserva también lo muestra suelto. El owner: el
traslado es parte del Overland (UYUO01) y se pide a Imperio Inca todo junto. **El traslado San Pedro → Hito
Cajón es SIEMPRE regular** (aunque el Overland de SPAP05/06 sea privado con Tayka y el de CHB31 regular a
compartir): **nunca escribir "privado" para el traslado**.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **En el pedido a Imperio Inca, el traslado va dentro del renglón del Overland**, no suelto: "Overland privado San Pedro – Uyuni … (incluye traslado regular San Pedro → Hito Cajón el <fecha>, noches en los Tayka y bus Uyuni → La Paz)". Se conserva lo que hoy dice el renglón del Overland (jeep, chofer, idioma, etc.) | Unitario con SPAP05 (Petzold: 26/05/2027) y SPAP06: un solo renglón; contiene "traslado regular San Pedro → Hito Cajón el 26 may 2027" (formato de fecha de los pedidos); no hay renglón "Traslado:" suelto |
| 2 | **Nunca "privado" para el traslado:** la palabra "privado" solo califica al Overland | Unitario: en el texto, "privado" no aparece junto al traslado |
| 3 | **En la reserva también figura como parte del Overland** (itinerario / componentes del detalle): el traslado aparece dentro del Overland, no como una línea propia "SPAT02 … regular" | Pantalla/consulta del detalle de la reserva SPAP05: sin línea suelta de SPAT02 |
| 4 | **CHB31 (Kilroy):** si su Overland también incluye el traslado San Pedro → Hito Cajón, va igual dentro del renglón ("Overland regular a compartir … (incluye traslado regular San Pedro → Hito Cajón …)"). Si en CHB31 el traslado lo hace otro proveedor, no se toca y se deja anotado en el reporte | Unitario con CHB31 según lo que diga el catálogo |
| 5 | **Nada más cambia** (Horizonte Atacama y las excursiones de San Pedro igual) | Recorridos M2-09/M3 en verde |

## Reglas del proyecto
- **#5** las 3 verificaciones. **#3** sin IA. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Composición: `data/journaway-composicion.csv` (SPAP05 fila 6/7, SPAP06 fila 6/7); proveedores en
  `data/journaway-proveedores.csv` (SPAT02 y UYUO01 → Imperio Inca). Armado en `src/lib/pedidos/armar.ts`.
- Ejemplo actual del pedido: `docs/sdd/diagnosticos/M3-01-ejemplos-pedidos.md` §5 (Pedido 2 de 2: Imperio Inca).
