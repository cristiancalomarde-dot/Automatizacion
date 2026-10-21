# M3-10 · Ampliar el catálogo: los 6 productos que ya pidieron las agencias

**Depende de:** M1-04d y M1-05 (cómo se cargan los paquetes de un destino y los tours compuestos), M2-03
(códigos de agencia). Elegida por el owner el 2026-10-21: el catálogo arrancó con los 17 más vendidos a
propósito; ahora se suma el siguiente grupo, empezando por lo que las agencias ya reservaron.

## 1. Qué queremos lograr
Que estos productos estén en el catálogo, con sus servicios, noches, días y proveedores, y que la app los
reconozca cuando una agencia los reserva:

| Código | Nombre (Word 2026-2027) | Tipo | Por qué ahora |
|---|---|---|---|
| **CH11** | W-Trek Express + Puerto Natales (5 nights) Self Guided | paquete de un destino (como CH10) | Kilroy DK1594177, `HI_ARGENTINA_W_TREK_CH_11-677` |
| **AR34** | El Chalten + El Calafate, Glaciers and Trekking (5 nights) | dos destinos | Kilroy DK1594177, `HI_ARGENTINA_AR34-677` |
| **OD014** | El Calafate & El Chalten full day (4 nights) | un destino | Kilroy DK1594100 (`HI_ARGENTINA_OD014-677`) |
| **ARCH33EXP** | Patagonia, Trekking Paradise with W-Trek EXPRESS | tour compuesto: ARCH33 con CH11 en lugar de CH10 (reconfirmado por el owner 2026-10-21) | Kilroy `HI_TRAVEL_ARCH_EXP-677`, TourRadar 275366 |
| **ARBR23** | From Buenos Aires to Rio (11 nights) | tour compuesto | TourRadar 150104 |
| **ARUY01** | Argentina and Uruguay, heart of the River Plate (6 nights) | tour compuesto | TourRadar 317766 |

Las fuentes ya están completas (owner): `Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls` (la vigente, 2026-10-10; la `.xlsm` "para IA" es vieja)
(servicios, niveles, precios, proveedores), los Word de itinerarios día por día (`Insumos/One|Two|Multi
Destination … Tours 1 Jun 2026 - 31 Dec 2027.docx`), `Insumos/RutasenBus2020.xls` (hoja "Tours 2027": la
fila de códigos de cada tour) y `data/productos-no-cargados.csv` (los códigos de agencia ya anotados). **Al
owner solo se le pregunta lo que esas fuentes no resuelven.**

## 2. Qué hay hoy
- **Cargados:** Iguazú (OD010A-D, OD011), los 17 paquetes de M1-04d (`data/paquetes-piloto.csv`, incluye
  CH10, OD013, OD016, OD033) y los 7 tours compuestos de M1-05 (incluye ARCH33), más Journaway (M2-08).
- **Importadores re-ejecutables:** `importar:paquetes` (lee `data/paquetes-piloto.csv`, `noches-servicio.csv`,
  `niveles-confirmados.csv`, `servicios-a-pedido.csv`), `importar:tours` (`categorias-tour.csv`,
  `tramos-con-proveedor.csv`, RutasenBus), `importar:codigos-kilroy` (`data/codigos-kilroy.csv`) e
  `importar:codigos-tourradar` (`data/codigos-tourradar.csv`). Las reglas por producto viven en `data/*.csv`
  con su nota y fecha del owner.
- **Para revisión hoy:** DK1594177 (CH11 + AR34). Se resuelve después con "Confirmar producto" (M3-05).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Diagnóstico primero (sin escribir en ninguna base):** para cada uno de los 6, qué sale de las fuentes (paquetes componentes con noches y día de inicio, servicios, niveles, proveedores con mail o WhatsApp, buses/traslados) y **qué no se puede resolver solo**. Reporte `docs/sdd/diagnosticos/M3-10-diagnostico.md` con **una sola lista de preguntas para el owner**, cada una con la opción sugerida y de dónde sale | El reporte existe, cubre los 6 y cada pregunta trae opción sugerida |
| 2 | **Paquetes de un destino nuevos** (CH11, OD014 y los que necesiten AR34/ARBR23/ARUY01 y no estén: p. ej. Uruguay, Río, Buenos Aires con otras noches): se suman a `data/paquetes-piloto.csv` y sus reglas a los `data/*.csv`, con nota "Owner 2026-10-…" cuando vengan de una respuesta | Integración (base de pruebas): cada paquete queda con sus servicios y proveedores; ningún proveedor sin mail ni WhatsApp sin aviso en el reporte |
| 3 | **Tours compuestos** (AR34, ARBR23, ARUY01, ARCH33EXP): la secuencia de paquetes y buses con noches y día de inicio, como M1-05. ARCH33EXP = ARCH33 con CH11 en lugar de CH10 (y lo que eso corra en los días) | Integración: noches del tour = suma de sus partes = las del Word; las fechas de cada parte para una salida de ejemplo coinciden con el día a día del Word |
| 4 | **Códigos de agencia:** Kilroy (`HI_ARGENTINA_W_TREK_CH_11-677` → CH11, `HI_ARGENTINA_AR34-677` → AR34, `HI_ARGENTINA_OD014-677` → OD014, `HI_TRAVEL_ARCH_EXP-677` → ARCH33EXP) y TourRadar (275366, 150104, 317766). Salen de `data/productos-no-cargados.csv` (se borran de ahí al cargarse) | Unitario/integración: el emparejado reconoce cada código y nombre de agencia |
| 5 | **Lo que ya estaba no cambia:** la recarga no toca los productos, proveedores ni reservas existentes (mismo resultado de catálogo antes/después para los 17 + 7 + Iguazú + Journaway) | Integración: comparación del catálogo existente antes y después en la base de pruebas |
| 6 | **Pedidos:** una reserva de ejemplo de cada uno de los 6 arma sus borradores (M3-01) sin "revisar a mano" inesperados | Integración: `armarPedidos` con reservas de ejemplo; reporte con un pedido de muestra por producto |
| 7 | **Reporte de carga** `docs/sdd/diagnosticos/M3-10-carga.md` para el owner: qué entró, con qué proveedores y qué quedó con aviso | El reporte existe |

## 4. Qué ve el usuario
Sin pantallas nuevas: los 6 aparecen en **Catálogo** (`/catalogo`) con su detalle, y las reservas que los
traen entran como **recibidas** en vez de "para revisión".

## 5. Qué queda afuera
- El resto del Excel y los Word (siguientes tandas, cuando el owner las pida).
- Precios: el catálogo no maneja tarifas.
- Re-emparejar sola DK1594177: se confirma desde el detalle con "Confirmar producto".

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde (ver anexo).
- **#4:** nada se carga en la base **real** sin el OK del owner sobre el reporte; lo corre el loop principal
  (o el owner con `!`).
- **#3:** no llama a la IA (el emparejado por código/nombre es determinístico).

---

## Anexo técnico (para los agentes)

- **Dos tiempos.** (A) Diagnóstico (fila 1): leer fuentes, NO escribir en ninguna base, entregar el
  reporte con las preguntas y parar. (B) Con las respuestas del owner: filas 2-7, cargado y verificado
  **solo en la base de pruebas** (`.env.pruebas.local`; guard `src/lib/entorno/base-de-pruebas.ts`).
- **Las 3 verificaciones (regla #5):** 1) unitarios + lint + tipos + build → 2) integración contra la base
  de pruebas (importadores reales) → 3) recorrido: una reserva de ejemplo de cada producto llega por el
  flujo de M2 (modo prueba) y queda recibida con sus pedidos armados.
- **Ojo (PROGRESS, trampa conocida):** ningún test ni script de esta pieza puede re-importar sobre la base
  real. La carga en la real la hace el loop principal con el OK del owner.
- Reusar los importadores y su forma de declarar reglas en `data/*.csv`; si hace falta una regla nueva,
  se agrega como columna/archivo con nota, no como caso especial en código.
