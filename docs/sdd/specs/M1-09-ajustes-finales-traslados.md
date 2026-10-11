# M1-09 · Ajustes finales de traslados (respuestas del owner a M1-08)

**Depende de:** M1-08

## 1. Qué queremos lograr
Cerrar los pendientes que quedaron de M1-08 con las respuestas del owner (2026-10-10). Dos cosas:
- cargar los traslados que el owner corrigió en el Excel de paquetes;
- que las etiquetas de traslado de un paquete dentro de un tour no contradigan lo que se pide de
  verdad.

Con esto, el owner revisa los tours y se cierra M1.

## 2. Qué hay hoy
- **OD016:** el Excel de paquetes tenía el traslado al revés (solo la salida "El Calafate
  Accommodation - FTE Airport", marcada "a pedido" en `data/servicios-a-pedido.csv`). El owner lo
  corrigió. Ahora la columna de OD016 dice "Transfer FTE Airport - El Calafate Accommodation.
  Booking Supplier: Chalten Travel": es de llegada y se pide siempre.
- **OD017:** el owner agregó "Optiona Transfer PNT Airport - PNT accommodation if requested.Booking
  Supplier: Patagonia Planet" (hoja "Analisis a Mayo 2026", fila ~746). Es de llegada y a pedido.
- **Excel de paquetes nuevo:** `Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls`,
  del 2026-10-10 23:40, ya está copiado en el clon.
- **Excel de proveedores:** ya no tiene la fila 119 duplicada ("Hosteria Fitz roy" suelta). El
  registro huérfano ya se borró de la base con OK del owner.
- **Etiquetas de traslado:** dentro de un tour, las etiquetas "Transfer de llegada / de salida" de
  cada paquete salen de `producto_componente.transfer_in/out`, sin mirar los ajustes de M1-08.
  - En ARCH31, OD017 muestra "Transfer de salida" aunque la salida es el bus del tour (Kupos a
    Punta Arenas).
  - En ARCH33 pasa lo mismo con CH10.
  - El owner pidió corregirlo para no confundir a los operativos.
- **Confirmado por el owner, no hay que cambiar nada:**
  - 5C01 sin el Transvip del aeropuerto de Calama en OD030 (se llega en bus).
  - ARCH31 termina en Punta Arenas, salvo que el pax o el vendedor pidan el traslado al aeropuerto
    de Puerto Natales.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Se recarga la cadena completa con los Excel nuevos: proveedores → equivalencias → productos → paquetes → tours | Integración: la recarga corre sin errores. El reporte de proveedores no avisa de ninguna fila duplicada de Fitz Roy. No queda ningún proveedor "Hosteria Fitz roy" suelto |
| 2 | **OD016:** su traslado es de llegada (aeropuerto FTE → alojamiento) y se pide siempre en el paquete vendido solo. Se saca de `data/servicios-a-pedido.csv` la fila de la salida vieja. Dentro de los tours, la regla de M1-08 decide como con cualquier traslado | Unitario de sentido con el texto nuevo → llegada. Integración: OD016 tiene ese servicio de llegada sin marca "a pedido". El reporte `M1-08-traslados.md` dice qué pasa con él en ARCH31 y ARCH33 |
| 3 | **OD017:** el traslado aeropuerto PNT → alojamiento es de llegada y lleva la marca "a pedido" (fila en `data/servicios-a-pedido.csv`) | Integración: OD017 tiene el servicio con proveedor Patagonia Planet, sentido llegada y a pedido. La pantalla de OD017 solo lo muestra con la marca |
| 4 | **Etiquetas coherentes:** dentro de un tour, un paquete muestra "Transfer de llegada" o "Transfer de salida" solo si después de los ajustes de M1-08 conserva un traslado de ese lado (o la marca del componente lo pide y no hay ajuste que lo anule). Si se llega o se sale con el bus del tour, esa etiqueta no aparece | Test de pantalla + recorrido: OD017 en ARCH31 y CH10 en ARCH33 sin "Transfer de salida". Los 5 tours de M1-08 siguen mostrando lo que ya mostraban en lo demás |
| 5 | Reportes al día | `M1-08-traslados.md` y los de recarga regenerados, en llano |

## 4. Qué ve el usuario
- **Pantalla que cambia:** detalle de producto (`/catalogo/[id]`).
  - OD016 solo, con su traslado de llegada.
  - OD017 solo, con el traslado de llegada a pedido.
  - En ARCH31 y ARCH33, sin etiquetas de salida que no corresponden.
- **Estados:** sin cambios.

## 5. Qué queda afuera
- **El bus Santiago – Valparaíso que aparece dos veces en 5C01:** en COMPCH01, ida y vuelta, y
  como tramo propio del tour. El owner lo deja para más adelante, por costos (M3).
  - Hoy RutasenBus suma las dos cosas: la columna "SCL - VLP" (12,5 USD neto) más "VLP 2 n", que
    usa el total de COMPCH01 e incluye el bus ida y vuelta de 26 USD neto.
- Publicar en Vercel.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde.
- **#1** — si hace falta una columna o tabla, va en una migración nueva con RLS (no debería hacer
  falta).

---

## Anexo técnico (para los agentes)
- **Las 3 verificaciones, en orden (regla #5):**
  1. Unitarios + lint + tipos.
  2. Integración contra el Supabase real, con la recarga completa.
  3. Recorrido de ARCH31, ARCH33, OD016, OD017 y 5C01, más `npm run build`.
- **Test primero.**
- **Dónde va cada cosa:**
  - Etiquetas: `src/components/catalogo/detalle-producto-pantalla.tsx` (zona de
    `componente.transferIn/transferOut`, ~l. 391) y/o `src/lib/catalogo/consultas.ts`. Lo más
    simple es calcular el booleano efectivo en la consulta, a partir de `tour_servicio_ajuste` y de
    la posición en la secuencia.
  - Si `data/servicios-a-pedido.csv` nombra un servicio que ya no existe, el importador falla con
    un mensaje claro (es lo esperado). Por eso hay que actualizar el CSV.
- **No borrar registros de la base.** Si aparece algo huérfano, se reporta.
- `next dev` agrega un bloque a `CLAUDE.md`: no commitearlo. Ya hay un `next dev` en :3000.
- Usar timeouts en los comandos largos y commitear de a pasos. Sin push. No tocar la tabla del
  plan ni `PROGRESS.md`.
