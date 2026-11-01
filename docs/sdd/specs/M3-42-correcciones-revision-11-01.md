# M3-42 · Correcciones de la revisión del 2026-11-01 (textos y traslados)

**Depende de:** M3-25, M3-28, M3-41. Pedida por el owner el 2026-11-01 (tercera ronda de M3-04,
`docs/sdd/diagnosticos/M3-04-revision-owner.md`), antes del primer envío real del 2026-11-02.

## Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Pasaje, no boleto.** La tarea dice "Emitir pasaje: …" (y el aviso "queda como pasaje para emitir"). El tipo interno `emitir_boleto` puede quedar igual (no se ve) | Unitario y los tests que hoy esperan "Emitir boleto" pasan a "Emitir pasaje" |
| 2 | **El traslado de un solo lado nombra el alojamiento.** Donde hoy sale "Transfer in Aeropuerto Salta - Alojamiento" / "Transfer out Alojamiento en Ushuaia - Aeropuerto Ushuaia" (M3-25/M3-28), va el nombre del alojamiento de la reserva en esa ciudad: el que entra la fecha de llegada (in) o el que sale la fecha del traslado de salida (out). Ej.: "Transfer in Aeropuerto Salta - Trotamundos Salta", "Transfer out Anum Hostel (Ushuaia) - Aeropuerto Ushuaia". Si no hay alojamiento que coincida, queda el texto de hoy | Unitario con AR10 (1389186): La Ciénaga y Rumbo Sur con el hotel; sin alojamiento, el texto de hoy |
| 3 | **Pick up del Overland sin nombrar a la agencia** (cambia M3-41): "hotel en San Pedro de Atacama a confirmar". Con el hotel conocido, igual que hoy | Unitario de `hotelEnSanPedroAConfirmar`; recorrido M3-30/M3-41 actualizado |
| 4 | **El Overland con pensión completa.** El renglón del Overland a Imperio Inca (UYUO01, SPAP05/06) suma "con pensión completa (incluye cena y desayuno en los Tayka)" — dato en `data/journaway-internos.csv`, no en el código | Recorrido SPAP05 (Petzold): el renglón lo dice |
| 5 | **Los Tayka sin "con desayuno"** (Tayka del Desierto, Tayka de Sal: a `data/alojamientos-sin-desayuno.csv` con la nota del owner) | Recorrido SPAP05: "Habitación: DBL Standard", sin "con desayuno" |
| 6 | **Nada más cambia** | Suite completa en verde |

## Reglas
- **#5** las 3 verificaciones. **#3** sin IA en los textos. **#4** nada a la base real ni a proveedores.

## Anexo técnico
- Traslado de un lado: `nombreDeUnLado` en `src/lib/pedidos/armar.ts`. Pick up: `src/lib/reservas/pick-up-overland.ts`.
- Tareas: `armar.ts` (líneas con "Emitir boleto").
