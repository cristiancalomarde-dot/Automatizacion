# M1-04c · Diagnóstico de los 17 paquetes de un destino de los 7 tours

**Depende de:** M1-04b. Reusa el importador de productos (M1-04), las equivalencias y los
niveles confirmados (M1-04b).

## 1. Qué queremos lograr

Antes de cargar los paquetes que forman los 7 tours piloto, **leerlos sin escribir nada en la
base** y entregarle al owner **una sola lista** con todo lo que el importador no puede resolver
solo. El owner la responde de una vez y M1-04d carga con los datos ya confirmados. Así se evitan
las varias rondas de preguntas que hubo con Iguazú.

## 2. Qué hay hoy

- **El importador de productos (M1-04)** solo sabe leer los 5 códigos de Iguazú, que están
  escritos como lista fija, y lee el archivo viejo
  `Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas para IA.xlsm`.
- **El owner actualizó los Excel** (2026-10-02). Los vigentes son:
  - `Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls` (formato `.xls`, hoja
    "Analisis a Mayo 2026"). Cada paquete tiene su código en el título del bloque (ej. "BUENOS
    AIRES, TANGO CITY OD018").
  - `Insumos/RutasenBus2020.xls` (hoja "Tours 2027"). Cada tour tiene una fila de códigos justo
    arriba de su fila "Net Prices:", con el código encima de la columna de cada paquete. No se
    usa en esta pieza (es de M1-05), salvo para confirmar que los 17 códigos salen de ahí.
  - Los archivos "… para IA" son versiones viejas y **no se usan más**.
- **Los 17 paquetes a diagnosticar:** OD013, OD016, OD017, OD018, OD019, OD020, OD022, OD025,
  OD029, OD030, OD031, OD032, OD033, CH10, COMPCH01, COMPBO20 y COMPBR10.
- **Las reglas de lectura** son las mismas de M1-04 (hoja "Readme AI" y `DECISIONS.md`
  2026-09-27):
  - Niveles de alojamiento: Hostel / Budget Hotel / Hotel 3* / Hotel 4* / otros.
  - Dentro de cada nivel, las opciones "/" en orden de prioridad.
  - Un nivel que aparece solo en la tabla de precios, sin línea "Accommodation … Booking
    Supplier", no se ofrece.
  - El mail va al Booking Supplier.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | El importador de productos toma **la lista de códigos desde un archivo de datos** (`data/paquetes-piloto.csv`, con código y destino) y no desde el código fuente. La lista arranca con los 5 de Iguazú más los 17 nuevos. | Test: con un CSV de prueba de 2 códigos, el importador procesa exactamente esos 2. |
| 2 | Lee el archivo nuevo `.xls` del Excel de paquetes (ruta configurable, como hoy). | Test de integración contra el archivo real: encuentra el bloque de cada uno de los 17 códigos, o lo reporta como "bloque no encontrado". |
| 3 | **Modo diagnóstico ("solo leer"):** corre todo el análisis (bloques, servicios, niveles, prioridades, emparejado de proveedores contra el directorio y `proveedor_alias`) **sin escribir nada en ninguna tabla**, ni siquiera en `importacion`. | **Prueba de qué NO debe pasar:** se cuentan las filas de `producto`, `producto_servicio`, `codigo_externo`, `proveedor`, `proveedor_alias` e `importacion` antes y después de correr el diagnóstico real. Tienen que ser idénticas. |
| 4 | Genera **un reporte legible para el owner** en `docs/sdd/diagnosticos/M1-04c-paquetes-de-los-tours.md`, una sección por paquete. Cada sección trae: código, nombre, celda donde está el bloque, y servicios agrupados por nivel con sus opciones en orden, el Service Provider y el Booking Supplier tal como vienen en el Excel, y cómo emparejó cada Booking Supplier (exacto / por equivalencia / **sin emparejar**). | Leer el reporte: tiene 17 secciones, y cada servicio muestra su Booking Supplier y su estado. |
| 5 | Al principio del reporte, **"Lo que necesito que confirmes"**: una lista única y deduplicada de: Booking Suppliers sin emparejar (con en qué paquetes aparecen), alojamientos sin etiqueta de nivel, niveles que aparecen solo en la tabla de precios, líneas que las reglas no entienden y bloques no encontrados. Para cada proveedor sin emparejar, el reporte puede sugerir hasta 3 candidatos del directorio por parecido de nombre, **marcados como sugerencia y sin aplicar nunca**. | La lista existe, no repite un mismo nombre dos veces, y ninguna sugerencia quedó guardada en la base ni en `data/equivalencias-proveedores.csv`. |
| 6 | Además genera la misma información en `docs/sdd/diagnosticos/M1-04c-paquetes-de-los-tours.json`, para que el loop principal arme la propuesta de equivalencias. | El JSON es válido y tiene una entrada por paquete. |
| 7 | **Iguazú no cambia:** los 5 productos ya cargados siguen igual. | La suite de M1-04 y M1-04b sigue en verde y el diagnóstico de los 5 de Iguazú no reporta nada nuevo para confirmar (salvo lo ya conocido: Tetris y "Extra glamping x pax"). |
| 8 | Sin `ANTHROPIC_API_KEY` no llama a la IA. Lista en el reporte los bloques o líneas que la habrían necesitado. | El reporte tiene la sección "Habría necesitado IA" (puede estar vacía) y no hubo ninguna llamada. |

## 5. Qué queda afuera

- **Cargar los paquetes en la base:** es M1-04d, con las respuestas del owner.
- **Escribir equivalencias o niveles confirmados:** los propone el loop principal a partir del
  reporte y los confirma el owner. Esta pieza no toca `data/equivalencias-proveedores.csv` ni
  `data/niveles-confirmados.csv`.
- **Los tours compuestos y las fechas:** es M1-05.
- **Emparejar por parecido:** solo se sugiere en el reporte, nunca se aplica (regla de M1-04b).

## 6. Reglas del proyecto que toca

- **#2:** sin secretos en el código.
- **#3:** sin clave no hay llamadas a la IA; el techo de gasto sigue igual.
- **#5:** terminada = las 3 verificaciones en verde.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (#5):**
  1. Unitarias + linter: lectura de la lista de códigos y la guarda del modo "solo leer" (que
     falle si alguien intenta escribir), más el armado del reporte.
  2. Integración: el diagnóstico real contra el `.xls` real y la base real, con el conteo de
     filas antes y después.
  3. Recorrido completo: correr el script real (`npm run diagnosticar:paquetes` o similar) y
     revisar que el `.md` y el `.json` existan con las 17 secciones. La suite completa en verde.
- **Test primero:** "el modo diagnóstico no escribe nada" y "la lista de códigos sale del CSV".
- **Formato `.xls`:** SheetJS lo lee igual que `.xlsm`. Si los bloques nuevos tienen el código
  en el título con otra forma (ej. "OD019 (menos 1 noche)" es una anotación de RutasenBus, no
  del Excel de paquetes), reportarlo, no adivinar.
- **Un paquete puede tener el código repetido en varias celdas del mismo bloque** (título y
  subtítulo). Es un solo bloque. Si el mismo código aparece en **dos bloques distintos**,
  reportarlo como duplicado.
- **Sin datos de pasajeros:** el Excel de paquetes no tiene. El reporte puede ir al repo.
- Reusar todo lo de `src/lib/importador-productos/`. Sin refactor colateral.
