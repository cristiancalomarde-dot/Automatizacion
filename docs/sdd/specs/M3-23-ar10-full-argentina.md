# M3-23 · AR10 Full Argentina Adventure – Route 40 en el catálogo

**Depende de:** M3-10 (cómo se amplía el catálogo: diagnóstico → preguntas → carga en pruebas → carga en
la real con OK). Pedida por el owner el 2026-10-26: llegó la reserva TourRadar **#1389186** ("Full
Argentina Adventure – 21 Days", Bridget Robinson, 2 pax, 19 dic 2026 Salta → 8 ene 2027 Ushuaia). El
statement en PDF le llegó al owner (no a sales@); se va a pasar a mano **después** de cargar el producto,
para que la reserva entre reconocida y con sus pedidos.

## 1. Qué queremos lograr
Que **AR10** esté en el catálogo, con sus partes, noches, días, servicios y proveedores, y que la app lo
reconozca cuando TourRadar (u otra agencia) lo reserva.

Fuente principal: `Insumos/Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx`, bloque
"AR10- Full Argentina Adventure – Route 40 (20 nights)". Resumen del Word (21 días / 20 noches):

| Parte | Noches | Días | Qué trae |
|---|---|---|---|
| Salta (+ Purmamarca) | 3 Salta + 1 Purmamarca | 1-5 | TRF IN aeropuerto, Salinas/Purmamarca (día 2, noche en Purmamarca), Humahuaca full day (día 3), día 4 libre |
| Bus nocturno Salta → Mendoza (cama) | — | 5 → 6 | |
| Mendoza | 2 | 6-8 | Bodegas half day (día 6, 14:30), Alta Montaña (día 7) |
| Bus nocturno Mendoza → Bariloche (cama) | — | 8 → 9 | |
| Bariloche | 3 | 9-12 | Campanario + Circuito Chico (día 10, 14:30), Isla Victoria y Arrayanes (día 11, ~9:00) |
| Bus Bariloche → El Chaltén (noche en el bus) | — | 12 → 13 | |
| El Chaltén | 2, sin desayuno | 13-15 | trekking por su cuenta |
| Bus El Chaltén → El Calafate | — | 15 | |
| El Calafate | 3 | 15-18 | Torres del Paine full day (día 16, ~5:30), Perito Moreno full day (día 17) |
| Bus El Calafate → Río Gallegos → Ushuaia | — | 18 | sale 3:00 am |
| Ushuaia | 3 | 18-21 | PN Tierra del Fuego half day (día 19), Lobos marinos half day (día 20), TRF OUT aeropuerto (día 21) |

Niveles del Word: Dorm Hostel, DBL/SGL Hostel, DBL/SGL Hotel 3*, DBL/SGL Hotel 4*. Opcionales: PN Tierra
del Fuego con trekking y canoa (+167 USD) y vuelo Ushuaia → El Calafate en vez de bus (+250 USD).

## 2. Qué hay hoy
- **Ya cargados (quizás con otras noches o servicios):** Mendoza (OD019), El Chaltén (OD033), El Calafate
  (OD013/OD016), Ushuaia (OD022). Ver `data/paquetes-piloto.csv`.
- **Sin cargar:** Salta / Purmamarca y Bariloche.
- Importadores, CSVs de reglas y forma de trabajo: los mismos de M3-10 (`docs/sdd/specs/M3-10-ampliar-catalogo.md`).
- Reglas de días ya existentes que pueden aplicar: `data/dias-servicio.csv` (Perito Moreno, Bodegas, Alta
  Montaña, Ushuaia), `data/buses-el-chalten.csv` (M3-20).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Diagnóstico primero (sin escribir en ninguna base):** qué sale de las fuentes para cada parte de AR10 (paquete de destino existente que sirve tal cual, que sirve con otras noches, o que hay que crear; servicios; niveles; proveedores con mail o WhatsApp; buses), el **código TourRadar** del producto (`Insumos/Codigos Productos Tourradar.xlsx`, `Listado Ids de TourRadar…xlsx`, `data/productos-no-cargados.csv`) y la fila de AR10 en `Insumos/RutasenBus2020.xls` (hoja "Tours 2027"). Reporte `docs/sdd/diagnosticos/M3-23-diagnostico.md` con **una sola lista de preguntas para el owner**, cada una con opción sugerida y de dónde sale | El reporte existe, cubre todas las partes y cada pregunta trae opción sugerida |
| 2 | **Paquetes de un destino nuevos** (Salta + Purmamarca, Bariloche, y los que AR10 necesite con otras noches): a `data/paquetes-piloto.csv` y sus reglas a los `data/*.csv`, con nota "Owner 2026-10-…" cuando vengan de una respuesta | Integración (base de pruebas): cada paquete con sus servicios y proveedores; ningún proveedor sin mail ni WhatsApp sin aviso en el reporte |
| 3 | **El tour AR10:** la secuencia de partes y buses con noches y día de inicio, como M1-05/M3-10; días fijos de excursión según el Word | Integración: noches del tour = suma de sus partes = 20; las fechas de cada parte para la salida del 19 dic 2026 coinciden con el día a día del Word |
| 4 | **Código de agencia:** el ID de TourRadar de "Full Argentina Adventure – 21 Days" → AR10 (y el de Kilroy si figura) | Unitario/integración: el emparejado reconoce el código y el nombre de TourRadar |
| 5 | **Lo que ya estaba no cambia** (mismo resultado de catálogo antes/después para lo cargado) | Integración: comparación antes/después en la base de pruebas |
| 6 | **Pedidos:** una reserva de ejemplo de AR10 (2 pax, DBL Hotel 3*, salida 19 dic 2026) arma sus borradores sin "revisar a mano" inesperados | Integración: `armarPedidos`; pedido de muestra en el reporte |
| 7 | **Reporte de carga** `docs/sdd/diagnosticos/M3-23-carga.md` + script de carga en la real para que lo corra el owner con `!` | El reporte y el script existen |

## 4. Qué ve el usuario
Sin pantallas nuevas: AR10 aparece en **Catálogo** y la reserva #1389186, cuando se pase su statement,
entra como **recibida** con sus pedidos armados.

## 5. Qué queda afuera
- Leer el statement de #1389186 (se hace aparte, con el PDF que pasa el owner, una vez cargado AR10).
- Que un reenvío a sales@ se lea solo (el owner pide a TourRadar que mande los statements a sales@).
- Los opcionales (+PN con canoa, vuelo en vez de bus): se anotan en el diagnóstico, no se cargan salvo que
  el owner lo pida.
- Precios: el catálogo no maneja tarifas.

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde.
- **#4:** nada se carga en la base **real** sin el OK del owner; lo corre el owner con `!` o el loop
  principal con su OK.
- **#3:** no llama a la IA.

---

## Anexo técnico (para los agentes)

- **Dos tiempos, igual que M3-10.** (A) Diagnóstico (fila 1): leer fuentes, NO escribir en ninguna base,
  entregar el reporte con las preguntas y parar. (B) Con las respuestas del owner: filas 2-7, cargado y
  verificado **solo en la base de pruebas** (`.env.pruebas.local`; guard `src/lib/entorno/base-de-pruebas.ts`).
- **Las 3 verificaciones:** 1) unitarios + lint + tipos + build → 2) integración contra la base de pruebas
  → 3) recorrido: una reserva de ejemplo de AR10 llega por el flujo de M2 (modo prueba) y queda recibida
  con sus pedidos armados.
- Ningún test ni script de esta pieza puede re-importar sobre la base real.
- Excel vigente de paquetes: `Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls` (la `.xlsm`
  "para IA" es vieja). Se trabaja en el clon `C:\Users\gs\dev\hi-travel-automatizacion`.
- Reusar importadores y reglas en `data/*.csv`; regla nueva = columna/archivo con nota, no caso especial.
