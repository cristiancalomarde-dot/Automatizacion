# M1-04d · Carga de los 17 paquetes de un destino de los 7 tours

**Depende de:** M1-04c (diagnóstico) y de las respuestas del owner, ya volcadas en `data/`.

## 1. Qué queremos lograr

Cargar en la base los 17 paquetes de un destino que forman los 7 tours piloto, con sus servicios,
niveles, prioridades y **a quién se le pide cada reserva**, usando lo que el owner confirmó en el
diagnóstico. Al terminar, cada servicio de esos paquetes sabe a qué proveedor escribirle (o
queda marcado, a la vista, si todavía falta el dato).

## 2. Qué hay hoy

- **El diagnóstico (M1-04c)** lee los 17 paquetes en modo "solo leer"
  (`npm run diagnosticar:paquetes`) y deja el reporte en `docs/sdd/diagnosticos/`.
- **Las respuestas del owner ya están en datos** (2026-10-05):
  - `data/equivalencias-proveedores.csv` tiene **formato nuevo**: `destino, nombre_en_excel,
    proveedor_en_directorio, modo, estado, nota`. Son 73 filas (las 15 de Iguazú con destino
    `IGR` y las nuevas por destino). `modo` puede ser:
    - `alias`: el nombre del Excel corresponde a ese proveedor del directorio.
    - `por_service_provider`: el Booking Supplier es un grupo sin central (Tremun, Dazzler). El
      proveedor se busca por el **nombre del hotel** (Service Provider), con las filas `alias`
      del mismo destino.
    - `manual`: no es un proveedor al que se le escribe (Kupos.cl, sistema online de pasajes).
      El servicio queda marcado "manual", sin proveedor y sin revisión pendiente.
  - `data/niveles-confirmados.csv` tiene 18 renglones nuevos con la categoría que confirmó el
    owner.
  - `data/paquetes-piloto.csv` tiene los destinos confirmados.
- **El Excel de proveedores fue actualizado por el owner** (`Insumos/Proveedores Hi Travel 2026
  para IA.xlsx`, 2026-10-05). Hay que **volver a importarlo antes** de cargar las equivalencias,
  porque muchos proveedores nuevos (Anum, Del Glaciar, Tremun por hotel, Dazzler San Martín,
  etc.) todavía no están en la base.
- **El Excel de paquetes vigente** es `Insumos/Construccion de Paquetes 2019 con 3 y 4
  estrellas.xls`. El owner le agregó un **bloque propio a COMPBO20** (fila ~847: "Overland Tour
  San Pedro - Uyuni …", Booking Supplier Imperio Inca) y dejó explícito CHB31 = OD030 + COMPBO20
  + "Public Bus Uyuni - La Paz" (Imperio Inca).

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Re-importa el directorio desde el Excel de proveedores actualizado (importador de M1-03, sin cambios de lógica). | El directorio contiene, entre otros, "Anum Hostel", "Del Glaciar / Juan Pablo", "Rincon del calafate", "Dazzler San Martin", "Bamboo Hostel Rio" y "Rodrigo Perez" con mail o canal. |
| 2 | **Equivalencias por destino.** La carga de alias lee el formato nuevo. Un alias con destino solo aplica a los paquetes de ese destino (según `data/paquetes-piloto.csv`). Si un nombre del directorio está **repetido** (ej. dos "Rumbo sur"), elige el de la ciudad del destino; si igual hay más de uno, la carga falla con un mensaje claro. | Test: "Nacional Inn" en un paquete de RIO resuelve a "Nacional inn Copacabana" y en uno de IGR a "nacional inn foz". "Rumbo Sur" en USH resuelve al Rumbo sur de Ushuaia. |
| 3 | **Modo `por_service_provider`.** Para Tremun (FTE, USH) y Dazzler (BUE), cada opción "/" se resuelve con el nombre de su hotel. | Test: en OD013/OD016, las opciones Rincón del Calafate, Sent, Mirador del Lago y Calafate Parque quedan cada una con su propio proveedor y mail. En OD018, "Dazzler Maipu" y "San Martin" quedan con proveedores distintos. Si un hotel no tiene alias, esa opción queda "sin resolver" (no se inventa). |
| 4 | **Modo `manual`.** Servicios de Kupos.cl quedan marcados "manual", sin proveedor y sin bandera de revisión. | Test sobre COMPCH01 / CH10: el tramo de Kupos queda manual. |
| 5 | **Tolerancia a typos de "Booking Supplier"**: "Bookind Supplier", "Bookinkg Supplier", "Booking Booking Supplier", "Booking Suplier" y separadores raros ("… / Booking Supplier: X") se leen como "Booking Supplier". | Las 8 líneas de M1-04c con typo (OD019 filas 89-90, OD022 151 y 153, OD025 672, OD030 801, OD033 1038) quedan leídas como servicios con su proveedor. |
| 6 | **Excursiones opcionales.** "Optional Excursion: …" y "Optional: …" se cargan como servicio **opcional**, que solo se pide si la reserva lo incluye (M2/M3). | OD022 (Tierra del Fuego con canoa), OD025 (Whale Watching, Pingüinera), OD017 (Base Torres) y OD033 (2ª noche en Fitz Camp) tienen su servicio opcional con proveedor. |
| 7 | **Títulos y notas que no son servicios.** "Excursions en …" / "Excursions in …" / "Excursions Aventura" son títulos de sección y se ignoran. Las notas de precios de OD013/OD016 (filas 222, 227, 232) y las etiquetas de tarifa del W Trek ("Tarifas W Trek", "Self Guided Tent DBL", "Self Guided Refugio") se ignoran. | No generan servicios ni ítems para revisar. |
| 8 | **COMPBO20** se lee desde su bloque nuevo. **COMPBR10** (São Paulo, bloque sin la forma habitual) se lee con una regla puntual: alojamiento "Soos Hotel Collection / Nacionalinn Jaragua Sao Paulo", Booking Supplier "Sooz Hotel / Nacionalinn". | Ambos productos existen con su servicio de alojamiento. Los Booking Suppliers de COMPBR10 quedan "sin resolver" con su nota (faltan en el directorio). |
| 9 | Carga los 17 productos con sus servicios, niveles y prioridades sobre la base real, con los mismos criterios de M1-04/M1-04b (idempotente, no pisa lo resuelto a mano, registra la corrida en `importacion`). | Existen los 17 productos. Una segunda corrida deja 0 filas nuevas. |
| 10 | **Reporte de cierre** para el owner: cuántos servicios quedaron con proveedor y mail, cuántos por WhatsApp (manuales), cuántos manuales (Kupos) y la **lista de los que siguen sin resolver**, con su motivo. Va en `docs/sdd/diagnosticos/M1-04d-carga.md`. | Lo esperado es que solo queden sin resolver los pendientes conocidos: Patagonia Hostel, NH Cordillera, Sooz Hotel, Nacionalinn São Paulo y Tetris (Iguazú). Si aparece otro, se reporta. |
| 11 | **Iguazú no cambia** con el formato nuevo del CSV. | La suite de M1-04/M1-04b sigue en verde y los 29 servicios de Iguazú mantienen su proveedor. |

## 5. Qué queda afuera

- **Los tours compuestos y las fechas:** es M1-05, con su ficha reescrita.
- **Equivalencias de categorías entre tour y paquete** (ej. el "Budget" del tour que es el 3* del
  paquete en Río): es M1-05.
- **Completar los proveedores pendientes:** lo hace el owner en el Excel de proveedores. Cuando
  lo actualice, alcanza con re-correr la importación (no hay que construir nada).

## 6. Reglas del proyecto que toca

- **#1:** si hay columnas o tablas nuevas, con RLS.
- **#3:** sin clave no hay llamadas a la IA.
- **#5:** terminada = las 3 verificaciones en verde.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones (#5):**
  1. Unitarias + linter: alias por destino (incluido el desempate por ciudad), modos
     `por_service_provider` y `manual`, typos de "Booking Supplier", opcionales y títulos
     ignorados.
  2. Integración contra la base real: re-importar proveedores, cargar equivalencias, cargar los
     17 paquetes, segunda corrida idempotente.
  3. Recorrido completo: para cada uno de los 17, listar servicio → nivel → opción → Booking
     Supplier → mail o canal, y generar el reporte de cierre.
- **Test primero:** "Nacional Inn depende del destino" y "Tremun se resuelve por hotel".
- **Migración** si `proveedor_alias` necesita destino o modo (con el pooler, como 0003-0005). La
  unicidad pasa a ser (destino, alias normalizado).
- **Corridas largas:** la suite completa tarda varios minutos. Usá `timeout` y corré por archivo
  cuando puedas, para no quedar colgado sin salida (en M1-04c el agente se cortó 3 veces por
  esperar la suite).
- Sin datos de pasajeros. Sin refactor colateral.
