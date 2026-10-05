# M1-05 · Los 7 tours compuestos: armado, noches y fechas relativas

> **Reescrita el 2026-10-05.** La versión anterior suponía inferir cada paquete por el texto de
> las columnas. Ahora hay códigos explícitos en RutasenBus e itinerarios día por día en los Word
> de catálogo, y aparecieron casos que la ficha vieja no contemplaba.

**Depende de:** M1-04d (los 17 paquetes de un destino de los tours están cargados) y M1-04
(Iguazú).

## 1. Qué queremos lograr

Cargar los 7 tours top-seller como productos **compuestos**: la secuencia ordenada de los
paquetes que los forman y de los buses entre ellos, **con las noches de cada paquete dentro del
tour y en qué día del tour empieza cada uno**. Así, cuando llegue una reserva de un tour con su
fecha de inicio (M2), el sistema sabe qué paquete pedir, a qué proveedor y para qué fechas (M3).

Los 7 tours son: CHB31 (Overland San Pedro → Uyuni → La Paz), BOCHI04R (el mismo al revés, desde
La Paz), ARCH31 (Patagonia Highlights), ARCH33 (Patagonia Trekking Paradise con W Trek), AR09
(Patagonia Adventure), BRARCH26 (Río → Santiago) y 5C01 (5 Countries, Río → La Paz).

## 2. Qué hay hoy

- **Productos simples:** Iguazú (OD010A-D, OD011) y los 17 de M1-04d, con servicios, niveles,
  prioridades y proveedores.
- **Códigos de cada tour:** `Insumos/RutasenBus2020.xls`, hoja "Tours 2027". Cada tour tiene una
  fila de códigos **justo arriba** de su fila "Net Prices:", con el código encima de la columna
  de cada paquete. Las columnas de bus no tienen código. El código puede traer una anotación:
  - "OD019 (menos 1 noche)" / "OD016 (mas 1 noche)": el paquete con una noche menos o más que
    su versión base.
  - "(esta incluido en CH10)": esa columna (el W Trek de ARCH33) no es un componente propio, va
    dentro de CH10.
  - Un código de **otro tour**: 5C01 usa "CHB31" entero como uno de sus componentes.
- **BOCHI04R** tiene su bloque al final de RutasenBus (fila ~840), con las columnas en el orden
  del CHB31. **El orden real del viaje es al revés** (La Paz → Uyuni → San Pedro) y sale del Word.
- **Itinerarios:** `Insumos/Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx`
  (y, si hace falta, los otros 3 Word de catálogo). Cada tour tiene:
  - Un título con código ("ARCH31- Patagonia Highlights (8 nights)").
  - Un itinerario "DAY N: lugar".
  - Un "What's Included" con "N nights Accommodation in X" y "Night Bus from A to B".
- **Overland en el Excel de paquetes:** el bloque del CHB31 (filas ~847-862) dice CHB31 = OD030
  + COMPBO20 + "Public Bus Uyuni - La Paz. **Booking Supplier: Imperio Inca**". Ese bus **lo
  reserva un proveedor**, no es un pasaje que emite HI Travel.
- **Categorías entre tour y paquete:** el owner aclaró que en los tours largos las categorías no
  son homogéneas. En Río, Nacional Inn Copacabana y Copacabana Mar son "Hotel 3\*" en el paquete
  y el tour los llama "Budget Hotel" (`DECISIONS.md` 2026-10-05).
- **Modelo:** `producto_componente` (M1-02) tiene `orden`, `tipo` (paquete | tramo_bus),
  `componente_producto_id`, `descripcion_ruta`, `transfer_in` y `transfer_out`. No tiene noches,
  día de inicio ni si el bus es nocturno.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Crea un `producto` compuesto por cada uno de los 7 tours, con su nombre y su código en `codigo_externo` (HI Travel). | Existen los 7 compuestos. Una segunda corrida deja 0 filas nuevas. |
| 2 | Arma la **secuencia en el orden real del viaje**, tomado del itinerario del Word. Cada paquete es un componente `paquete` que apunta al producto cargado (por el código de RutasenBus). Cada bus entre destinos es un componente `tramo_bus` con su ruta. | ARCH31 = OD033 (El Chaltén) → bus → OD016 (El Calafate, +1 noche) → bus → OD017 (Puerto Natales). BOCHI04R arranca en La Paz y termina en San Pedro. |
| 3 | Guarda por componente **cuántas noches tiene en este tour** y **en qué día del tour empieza**. Para los buses guarda si es **nocturno**. Las noches y los buses nocturnos salen del Word ("N nights in X", "Night Bus from A to B", "overnight bus"). Las anotaciones "(menos/mas N noche)" del Excel tienen que coincidir. | 5C01: Río 3 noches desde el día 1 → bus diurno a São Paulo (día 4) → São Paulo 2 noches → bus nocturno a Foz (sale el día 6, llega el 7) → Iguazú 3 noches desde el día 7… → La Paz. La suma cierra con la duración del título (29 noches / 30 días). |
| 4 | **Tour dentro de otro tour:** en 5C01 el componente "CHB31" apunta al compuesto CHB31 (no se copian sus partes). | 5C01 tiene un componente `paquete` que apunta al producto CHB31, y CHB31 tiene sus propios componentes. Máximo un nivel de anidado; si hay más, va a revisión. |
| 5 | **Servicio incluido en otro paquete:** la columna "(esta incluido en CH10)" no genera componente. | ARCH33 no tiene un componente propio para el W Trek; CH10 sí está. |
| 6 | **Buses con proveedor vs. buses que emite HI Travel:** por defecto, un bus entre destinos es un `tramo_bus` sin proveedor (pasaje que emite HI Travel, tarea manual). Si el bus lo reserva un proveedor (lista en `data/tramos-con-proveedor.csv`, que arranca con CHB31/BOCHI04R "Bus Uyuni – La Paz" → Imperio Inca), se carga como **servicio propio del tour** (`producto_servicio` del compuesto, con su Booking Supplier) y no como `tramo_bus`. | CHB31 no tiene ningún `tramo_bus`. Tiene un servicio propio "Bus Uyuni – La Paz" con Booking Supplier Imperio Inca. ARCH31 tiene 2 `tramo_bus` sin proveedor. |
| 7 | **Regla de transfer** (sin cambios respecto de `modelo-de-datos.md`): solo el primer componente lleva `transfer_in` y solo el último `transfer_out`. Las puntas intermedias van en falso, salvo IGR/IGU. | ARCH31: `transfer_in` solo en OD033 y `transfer_out` solo en OD017. 5C01: Iguazú (en el medio) conserva su transfer. |
| 8 | **Categorías tour ↔ paquete:** un archivo de datos `data/categorias-tour.csv` (tour, categoría del tour, código del componente, categoría del paquete) dice qué categoría del paquete corresponde a cada categoría del tour. Por defecto es la misma. Arranca con lo que confirmó el owner: en los tours, "Budget Hotel" de Río (OD032) = "Hotel 3\*" del paquete. Las categorías del tour salen de su tabla de precios en RutasenBus (Dorm Hostel, DBL Hostel, DBL Hotel 3\*, DBL Budget Hotel…). | Para cada tour y cada categoría que ofrece, todos sus componentes tienen una categoría equivalente que existe en el paquete. Si falta, el reporte lo lista (ver #10) y el tour igual se carga. |
| 9 | **Lo que no cierra va a revisión, nunca se inventa:** si falta un paquete, si el Word y el Excel no coinciden en las noches de un destino, si la suma no da la duración del tour o si el orden es ambiguo, **ese tour no se arma** (0 componentes) y queda "para revisar" con el motivo. | Test: con un Word de prueba que dice 3 noches donde el Excel dice "menos 1 noche" de un paquete de 3, el tour queda para revisar con ese motivo. |
| 10 | **Reporte para el owner** en `docs/sdd/diagnosticos/M1-05-tours.md`: cada tour con su secuencia legible (día por día: paquete, noches, bus diurno o nocturno, quién lo reserva), los que quedaron para revisar con su motivo, y **"Lo que necesito que confirmes"** (categorías tour ↔ paquete sin equivalencia, buses que quizás reserva un proveedor, diferencias Word/Excel). | El reporte existe con los 7 tours. |
| 11 | Idempotente y con registro en `importacion`, como M1-04. No toca los productos simples ya cargados. | La segunda corrida deja 0 filas nuevas. La suite de M1-04/M1-04d sigue en verde. |

## 5. Qué queda afuera

- **Calcular fechas reales de una reserva:** acá se guarda el día relativo; las fechas
  calendario se calculan en M2/M3 con la fecha de inicio que manda la agencia.
- **Hacer un tour al revés** cuando el Word dice "Tour can be done vice versa": solo se carga
  BOCHI04R, que es explícito. El resto se ve cuando aparezca una reserva así (M2).
- **Suplementos y opcionales de los tours** (ej. "vuelo El Calafate–Ushuaia en vez del bus" en
  AR09): es M2/M3, cuando la reserva los pida.
- **Códigos de Kilroy de los tours** (`HI_ARGENTINA_ARCH31-677`, etc.): es M2 (`DECISIONS.md`
  2026-10-02).
- **El resto de los tours del catálogo:** después del MVP.
- **Pantalla:** es M1-06.

## 6. Reglas del proyecto que toca

- **#1:** columnas o tablas nuevas, con RLS.
- **#3:** sin clave no hay llamadas a la IA; lo que las reglas no leen va a revisión.
- **#5:** terminada = las 3 verificaciones en verde.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (#5):**
  1. Unitarias + linter:
     - Lectura de la fila de códigos de RutasenBus y sus anotaciones.
     - Lectura del itinerario del Word (DAY N, nights, Night Bus / overnight).
     - Armado de la secuencia con días y noches.
     - Regla de transfer, tour anidado, "incluido en", bus con proveedor y cruce Word/Excel →
       revisión.
  2. Integración contra la base real: carga de los 7 tours y segunda corrida idempotente.
  3. Recorrido completo: el script real y el reporte, más la lectura de punta a punta de CHB31
     (2 paquetes y el bus de Imperio Inca, sin `tramo_bus`), ARCH31 (paquete / bus / paquete /
     bus / paquete con transfers solo en las puntas) y 5C01 (anidado y días).
- **Test primero:** "las noches del Word y del Excel no coinciden → revisión", "CHB31 no tiene
  tramo_bus" y "5C01 apunta a CHB31".
- **Migración (con el pooler, como 0003-0006):** agregar a `producto_componente` las columnas
  `noches` (int, null en tramo_bus), `dia_desde` (int, día del tour en que empieza, 1 = primer
  día) y `nocturno` (bool, solo tramo_bus). Si hace falta, permitir que un `producto_servicio`
  pertenezca a un compuesto, para los buses con proveedor.
- **Lectura del Word:** con SheetJS-CFB, como en el loop (los `.docx` son zip). Cada tour empieza
  en un párrafo "<CÓDIGO>- <nombre> (N nights)". Normalizar ciudades del Word ("Puerto Iguazu",
  "Foz do Iguazu", "El Chalten") contra el destino de cada paquete (`data/paquetes-piloto.csv`).
  Un "DAY N: A – B" es un día de traslado.
- **Datos, no código:** `tramos-con-proveedor.csv` y `categorias-tour.csv` son archivos de
  `data/`, para que el owner los complete sin tocar código.
- **Corridas largas:** usá `timeout` y corré por archivo. El watchdog corta a los 10 minutos sin
  salida (pasó 3 veces en M1-04c).
- Sin datos de pasajeros en el reporte (los Word no tienen). Sin refactor colateral.
