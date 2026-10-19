# M3-05 · Confirmar el producto de una reserva "para revisión"

**Depende de:** M2 (emparejado y detalle de la reserva). Pedido por el owner el 2026-10-19, con la primera
reserva real de Kilroy (UK1595157): la IA sugirió OD031 con 85% y no había dónde confirmarlo en la app.

## 1. Qué queremos lograr
Cuando la app no reconoce con seguridad el producto de una reserva, una persona del equipo lo resuelve
desde el detalle: **confirma la sugerencia de la IA** con un botón o **elige otro producto** del
catálogo. La reserva queda con ese producto, pasa a **recibida** si no le queda otro motivo de revisión y
la app **aprende** ese nombre o código de la agencia para reconocerlo sola la próxima vez.

## 2. Qué hay hoy
- **Detalle de la reserva:** `src/components/reservas/detalle-reserva-pantalla.tsx` y
  `src/app/(app)/reservas/[id]/` (acciones de M2-05/M2-06). Muestra los motivos de revisión, pero no
  tiene cómo resolverlos.
- **Columnas de `reserva`:** `producto_id`, `sugerencia_producto_id`, `producto_texto_agencia`,
  `producto_clave_agencia`, `clave_producto`, `origen_emparejado` (`codigo` | `nombre` | `ia`),
  `confianza_emparejado` y `motivos_revision` (textos de `src/lib/reservas/emparejar/motivos.ts`).
- **El emparejado (M2-03):** `src/lib/reservas/emparejar/`. Paso 1: código de la agencia en
  `codigo_externo`. Paso 2: nombre igual a `codigo_externo.nombre_externo` de esa agencia, normalizado.
  Paso 3: la IA. Las partes de un tour compuesto salen de `componentesDeLaReserva`, y los vuelos que
  hacen falta de `vuelos-requeridos.ts`.
- **Lo que se carga a mano hoy:** `data/codigos-kilroy.csv` y `npm run importar:codigos-kilroy`. Así
  se cargó OD031 = "HI - La Paz Starter Package (Adventure Brew Hostal)".
- **El historial:** `evento_reserva`. Al cambiar el estado, la base agrega `estado_cambiado` con el autor.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **El botón "Confirmar: es <código> <nombre>":** en el detalle de una reserva "para revisión" con motivo de producto y con sugerencia de la IA. Aparece junto al texto que mandó la agencia ("Kilroy mandó: HI - La Paz Starter Package…") y la seguridad de la IA ("85%") | Test de pantalla: con sugerencia aparece el botón; sin sugerencia no aparece, pero sí "Elegir el producto" |
| 2 | **"Elegir otro producto":** un buscador del catálogo por código o nombre (escribir "OD03" o "La Paz" filtra), para cuando la sugerencia está mal o no hay | Test: buscar, elegir y confirmar deja ese producto en la reserva |
| 3 | **Confirmar pide un OK corto:** "¿Confirmás que «HI - La Paz Starter Package…» es OD031 La Paz Bolivia Starter package? La próxima vez Kilroy lo va a reconocer solo." | Test: sin confirmar el diálogo no cambia nada |
| 4 | **Al confirmar:** queda el producto (`origen_emparejado` = `ia` si se aceptó la sugerencia, `nombre` si se eligió otro) y se quitan los motivos de producto. Se recalcula lo que depende del producto con las funciones que ya existen: las partes del tour compuesto y los vuelos que hacen falta. Si no queda ningún motivo, la reserva pasa a **recibida**. Si queda alguno (por ejemplo, "Falta el vuelo de llegada…"), sigue "para revisión" con ese motivo | Integración: (a) solo con motivo de producto → recibida con producto; (b) producto más vuelo faltante → sigue en revisión solo con el del vuelo; (c) tour compuesto confirmado → se crean sus partes |
| 5 | **La app aprende:** guarda en `codigo_externo` la equivalencia de esa agencia (el código de la agencia si vino, o si no el nombre que mandó en `nombre_externo`), así el próximo mail igual se reconoce sin IA por código o nombre. Si ya existe una equivalencia igual, no duplica. **No debe pasar:** que se pise una equivalencia que apunta a otro producto sin avisar. En ese caso pregunta "Kilroy ya tenía «…» como <otro>. ¿Lo cambiamos?" | Test: confirmar y después emparejar un mail con el mismo nombre da `origen_emparejado` = `nombre` (o `codigo`) sin llamar a la IA. Test del conflicto |
| 6 | **Que no se pierda lo aprendido:** volver a correr `npm run importar:codigos-kilroy` (y el de TourRadar) no borra lo que se aprendió desde la app | Test del importador con una fila aprendida que no está en el CSV: sigue estando |
| 7 | **El historial:** "<persona> confirmó el producto OD031 (sugerido por la IA)" o "eligió OD031". Además, el cambio de estado que ya agrega la base | Test: aparece el evento con el autor |
| 8 | **Solo el equipo,** con sesión @hitravel.com.ar, igual que el resto de la app. Las reservas de prueba también se pueden confirmar (para probar), pero lo que aprenden desde una reserva de prueba **no** se guarda como equivalencia | Test: sin sesión rechaza. Test: confirmar una de prueba no escribe en `codigo_externo` |
| 9 | **Después de confirmar,** el detalle muestra la reserva actualizada y, si quedó "recibida", el botón "Armar pedidos a proveedores" de M3-02 | Test de recorrido |

## 4. Qué ve el usuario
- **En el detalle de una reserva "para revisión":** un recuadro "Producto sin confirmar" con lo que mandó
  la agencia, la sugerencia de la IA y su seguridad, el botón **"Confirmar: es OD031 La Paz Bolivia
  Starter package"** y el enlace **"Elegir otro producto"**.
- **Carga:** "Confirmando…". **Error:** "No se pudo confirmar: <motivo en llano>", con "Reintentar".
  **Listo:** "Listo: la reserva quedó recibida con OD031. La próxima vez Kilroy lo reconoce solo."
- **Los otros motivos** (vuelo faltante, cancelación, posible duplicada) se siguen mostrando como hoy.
  Esta pieza solo resuelve el del producto.

## 5. Qué queda afuera
- Resolver los otros motivos desde la app (completar vuelos, unir duplicadas, cancelaciones).
- Editar el catálogo o cargar un producto nuevo: si el producto no está en el catálogo, se avisa
  "Ese producto no está en el catálogo: hay que cargarlo primero".

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde (ver anexo).
- **#1:** la pantalla y la acción solo con sesión del equipo; el historial no lleva datos de pasajeros.
- **#3:** confirmar no llama a la IA. Lo aprendido hace que la próxima vez tampoco haga falta.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (regla #5):** 1) unitarios + pantalla + lint + tipos + build → 2) integración
  contra la **base de pruebas** (`.env.pruebas.local`; el guard de `src/lib/entorno/base-de-pruebas.ts`)
  → 3) recorrido con las pantallas y server actions reales y una sesión de prueba, como M3-02 y M3-03.
  **Nunca** se escribe en la base real.
- **Test primero.** Los textos de pantalla van en `src/lib/textos/`.
- **Reusar, no duplicar:** `componentesDeLaReserva`, el cálculo de vuelos requeridos, la normalización de
  nombres del emparejado y las consultas del catálogo. La lógica va en `src/lib/reservas/` (función pura
  que decide el resultado más el guardado aparte) y la server action en `src/app/(app)/reservas/[id]/`.
- **Qué motivos son "de producto":** los de `MOTIVOS_EMPAREJADO` que hablan del producto (`noSeguro`,
  `codigoFueraDeLista`, `nochesNoCoinciden`, `iaInvalida`, `iaNoDisponible`, `noEstaEnCatalogo`,
  `codigoNoCargado`, `sinProducto`, `techo`, `iaNoRespondio`). Hacé que se reconozcan sin depender de
  comparar textos frágiles (por ejemplo, con un prefijo o una función `esMotivoDeProducto`), con test.
- Si hace falta una migración (por ejemplo, una función en la base para confirmar todo en una sola
  transacción, o una columna de origen en `codigo_externo` para distinguir lo aprendido), creala como
  `0020_…sql`, aplicala **solo** a la base de pruebas y avisá. La real la aplica el loop principal con el
  OK del owner.
