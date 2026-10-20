# M3-07 · Corregir vuelos y datos dudosos desde el detalle de la reserva

**Depende de:** M3-05 (patrón de "resolver para revisión" desde el detalle). Pedido por el owner el
2026-10-20: en DK1595221 (BOCHI04R) la IA tomó "Departure flight: H2253 ETA 18MAR27 08.44 from CJC" como
llegada, y la reserva quedó "para revisión" ("La IA no está segura de: vuelos") sin forma de corregirla en
la app. Lo mismo pasó hoy con DK1592913 (ARCH31).

## 1. Qué queremos lograr
Una persona del equipo corrige desde el detalle los **vuelos** de una reserva (agregar, cambiar o sacar una
llegada o una salida) y los **datos dudosos** que marcó la IA (fechas, pax, pasajeros), y marca que lo
revisó. Si no queda otro motivo, la reserva pasa a **recibida** y se pueden armar los pedidos.

## 2. Qué hay hoy
- **`reserva.vuelos`** (jsonb): lista de `{ numero, origen, destino, aerolinea, fecha_salida, hora_salida,
  fecha_llegada, hora_llegada, confianza }`. **`reserva.notas`** es `text[]`.
- **Los motivos:** `MOTIVOS_EMPAREJADO.dudosos(datos)` ("La IA no está segura de: vuelos, pax…") y
  `faltaVuelo(...)` en `src/lib/reservas/emparejar/motivos.ts`; `vuelos-requeridos.ts` calcula qué
  vuelos hacen falta; M3-05 dejó `esMotivoDeProducto` y el patrón de resolver con una función de la base en
  una transacción (`confirmar_producto_reserva`, 0020).
- **El detalle** (`src/components/reservas/detalle-reserva-pantalla.tsx`) muestra los vuelos y los
  motivos, pero no los edita.
- **Los pedidos** (M3-01) usan los vuelos para los traslados ("Vuelo pendiente" si falta).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **"Corregir vuelos"** en el detalle (en cualquier estado salvo cancelada/cerrada): un formulario con cada vuelo como **Llegada** o **Salida**, número, aeropuerto (código de 3 letras), fecha y hora. Se puede agregar, editar y sacar. Muestra al lado el texto que mandó la agencia sobre vuelos, si está en lo extraído, para copiar de ahí | Test de pantalla: editar un vuelo, agregar otro, sacar uno |
| 2 | **Validación en llano:** aeropuerto de 3 letras, fecha válida, hora HH:MM. Mensajes como "La hora tiene que ser como 08:44" | Test de los errores |
| 3 | **Notas del operativo:** un campo para dejar una nota corta en la reserva (por ejemplo "Llegan a La Paz por tierra"), que se agrega a `notas` | Test: la nota aparece en el detalle |
| 4 | **Al guardar:** quedan los vuelos corregidos con confianza 1. Se saca "vuelos" de los datos dudosos y se recalculan los motivos de vuelo faltante con `vuelos-requeridos.ts`. Si no queda ningún motivo, la reserva pasa a **recibida**; si queda alguno, sigue en revisión solo con ese | Integración: (a) solo dudoso de vuelos → recibida; (b) dudoso de vuelos y de pax, corrijo vuelos → sigue con "pax"; (c) corrijo y todavía falta un vuelo que el producto necesita → aviso (no motivo, regla del 2026-10-16), queda recibida |
| 5 | **Datos dudosos que no son vuelos** (fechas, pax, pasajeros): botón "Está bien así" por cada dato dudoso, o corregirlo (fechas de inicio/fin y cantidad de pax editables; los pasajeros se dejan para otra pieza) | Test: "Está bien así" en "pax" lo saca de los dudosos |
| 6 | **Los pedidos se enteran:** si ya había borradores sin editar, al volver a la pantalla de pedidos salen con el vuelo nuevo (ya se rearman al entrar). Si algún pedido ya **se envió** y el vuelo de un traslado cambió, aviso en el detalle: "El vuelo cambió después de enviar el pedido a <proveedor>: avisale" | Test: con un pedido enviado y el vuelo cambiado, aparece el aviso |
| 7 | **Historial:** "<persona> corrigió los vuelos: …" (sin datos de pasajeros) y "<persona> marcó como revisado: pax" | Test: eventos con autor |
| 8 | **Solo el equipo,** con sesión @hitravel.com.ar; si la reserva cambió desde que la pantalla la leyó, no pisa ("Alguien la cambió: volvé a cargar") | Test: sin sesión rechaza; conflicto |

## 4. Qué ve el usuario
- **En el detalle,** en el recuadro de vuelos: "Corregir vuelos". En una reserva para revisión por datos
  dudosos, el recuadro "La IA no está segura de: vuelos" con el botón "Corregir vuelos" y, para los otros
  datos, "Está bien así" o "Corregir".
- **Estados:** "Guardando…", "Listo: la reserva quedó recibida" (o "sigue para revisión por: …") y "No se
  pudo guardar: <motivo en llano>" con "Reintentar".

## 5. Qué queda afuera
- Editar pasajeros (nombres, pasaportes) desde la app.
- Mandar el aviso de cambio de vuelo al proveedor (M4; acá solo se avisa en pantalla).

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde (ver anexo).
- **#1:** solo con sesión del equipo; el historial no lleva datos de pasajeros.
- **#3:** no llama a la IA.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (regla #5):** 1) unitarios + pantalla + lint + tipos + build → 2) integración
  contra la **base de pruebas** (`.env.pruebas.local`; guard `src/lib/entorno/base-de-pruebas.ts`) → 3)
  recorrido con pantallas y server actions reales y sesión de prueba, como M3-05/M3-06. **Nunca** se
  escribe en la base real.
- **Test primero.** Textos en `src/lib/textos/`. Lógica pura en `src/lib/reservas/` (decidir motivos
  después de corregir) y guardado en una función de la base con control de concurrencia, como
  `confirmar_producto_reserva`.
- **Migración** `0022_…sql` si hace falta (función, tipos de evento), aplicada **solo** a la base de
  pruebas con `--db-url` (`supabase/.temp/project-ref` apunta a la real). La real la aplica el loop
  principal con el OK del owner.
- Reusar `vuelos-requeridos.ts`, `separarAvisosDeVuelo`, los motivos de `motivos.ts` y los componentes de
  M3-05 (recuadro, diálogo, estados).
