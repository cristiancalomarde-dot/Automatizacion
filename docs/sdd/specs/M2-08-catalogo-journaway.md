# M2-08 · El catálogo de Journaway

**Depende de:** M2-01, solo por el nombre de la agencia ("Journaway", el mismo de
`data/agencias.csv`). En la práctica usa el modelo de catálogo de M1 tal como está.

## 1. Qué queremos lograr
Que los productos que Journaway le compra a HI Travel estén en el catálogo, cada uno con **a quién
se le pide** y con **los nombres con que Journaway lo escribe**. Los paquetes de San Pedro tienen
que quedar armados con sus excursiones y traslados. Así, cuando entre una reserva de Journaway
(M2-09), la app reconoce cada tour suelto, arma el paquete y sabe a qué proveedor va cada cosa. El
owner abre el catálogo, filtra "Journaway" y ve sus productos, con lo que falta completar a la
vista.

## 2. Qué hay hoy
- **La planilla completada por el owner (2026-10-11):** `Insumos/Borrador productos
  Journaway.xlsx`, hoja "Productos Journaway", 52 filas. Columnas: código sugerido, tipo, destino,
  nombre en el tarifario, nombre como llega en los mails, qué incluye, proveedor sugerido, de
  dónde sale, **PROVEEDOR CONFIRMADO** (las 52 dicen "ok", o sea el sugerido) y comentario del
  owner.
  - **En celeste** (relleno `DCE6F2` en la columna A), lo que Journaway pide de verdad: 44 filas.
  - **Sin color**, 8 filas: SPAT01, SPAE01 a SPAE04, SPAE06, SPAE07 y SPAT02. Solo llegan dentro
    de un paquete y su código es interno.
  - Los códigos van sin guion (SPAE05, IGRE01…).
- **El tarifario** (`Insumos/San Pedro de Atacama, Iguazu, Patagonia and Easter Island Prices for
  Journaway 2027.docx`) trae el itinerario día por día de los Trip A a E.
- **Los 4 mails de ejemplo** de Journaway (`Insumos/Mails`). Un paquete llega como una lista de
  tours sueltos con fecha ("San Pedro de Atacama: Tour through the Moon Valley"). El Overland
  llega como **3 tours de día**:
  - "From San Pedro: Sol de Mañana Geysers, Licancabur Volcano & Laguna Colorada";
  - "Siloli: Full-day tour to the Siloli Desert & the Black Lagoon";
  - "Salar de Uyuni: Full-day tour to Uyuni".
- **El modelo de M1** ya tiene lo que hace falta:
  - productos (`producto`) con sus servicios y proveedores (`producto_servicio`);
  - armados por partes en orden (`producto_componente`);
  - ajustes de traslados dentro de un armado (`tour_servicio_ajuste`);
  - códigos y nombres de agencia (`codigo_externo`, con `nombre_externo`);
  - servicios "manuales" que no se le piden a nadie por mail (`reserva_manual`, como Kupos).

  Los importadores de M1 cargan por código, no duplican y dejan un reporte en
  `docs/sdd/diagnosticos/`.
- **El directorio de proveedores del clon está viejo.** El Excel actualizado está en el `Insumos/`
  del Drive y trae dos filas nuevas:
  - fila 155, "Nativo Experience, proveedor: Patagonia Profunda";
  - fila 331, "Vai Moana, proveedor CL Mundo".

  Plataforma10 no está, y no tiene por qué estar: no se le escribe a nadie.
- **Cuenca del Plata se resuelve fila por fila** (M1-08). Tiene fila propia para "Lado Argentino
  Premium", "Lado Brasilero Premium" y "Paquete 105 Premium desde Foz". **No tiene fila** para el
  Paquete 101 Premium, los traslados IGU – Puerto Iguazú ni Ruinas de San Ignacio y Minas de Wanda.
- **El catálogo** (`/catalogo`) tiene un buscador por código y nombre, también por los de las
  agencias, y el chip "Tour". Debajo del código muestra los códigos de agencia.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Lee la planilla del owner** con sus colores. Por fila, guarda el código, el tipo, el destino, los nombres, el proveedor confirmado y el comentario, y si está en celeste. Si falta la hoja o alguna de esas columnas, falla con un mensaje claro y no escribe nada | Test con el archivo real: 52 filas, 44 en celeste y 8 sin color (las 8 de §2). SPAE05 está en celeste y SPAE01 no. Test con una copia sin la columna "PROVEEDOR CONFIRMADO": falla antes de escribir |
| 2 | **Productos simples:** cada fila que no es un paquete armado queda como un producto con su código y **un servicio** del tipo que corresponde: traslado, excursión, bus, alojamiento o trekking (como el W Trek de CH10). Lleva el proveedor y el destino. Se agrega el Overland (fila 6). Los paquetes de un solo proveedor (IGRP01, IGRP02, IPCP01 e IPCP02) también son simples: un servicio pedido entero a ese proveedor | Integración: hay 46 productos simples de Journaway, más el Overland (53 en total con los 6 paquetes SPAP). FTEE01 tiene una excursión pedida a Chalten Travel. IPCH01 tiene un alojamiento pedido a "Vai Moana, proveedor CL Mundo". IGRP01 se pide a la fila "Paquete 105 Premium desde Foz" de Cuenca del Plata |
| 3 | **El proveedor sale de la planilla y se busca en el directorio, sin inventar.** El texto libre de la planilla, como "Lado Argentino Premium (Cuenca del Plata)" o "Plataforma10 (si no hay lugar…)", se traduce al nombre del directorio en `data/journaway-proveedores.csv`: código, proveedor, prioridad, modo (`alias` o `manual`) y nota. Después se busca con el mismo camino de M1: equivalencias y desempate por destino ("Rumbo sur" de Ushuaia). **Un proveedor que no está en el directorio queda "sin resolver" y se reporta. Nunca se crea un proveedor.** Si el owner cambia la planilla (CONFIRMADO distinto de "ok" y de lo que dice el archivo), el servicio queda "sin resolver" con el motivo "cambió en la planilla" | Integración: IGRP02, IGRT01 e IGRE03 quedan "sin resolver" con el motivo "Cuenca del Plata no tiene fila para este servicio". Test con un proveedor inventado ("Proveedor Fantasma"): queda "sin resolver" y la cantidad de proveedores en la base no cambia. Test con una copia de la planilla que dice "Rumbo sur" en el CONFIRMADO de FTEE04: queda "sin resolver" por "cambió en la planilla" y no se pide a Chalten Travel |
| 4 | **Los datos del owner**, cada uno con su nota en `data/journaway-proveedores.csv`: **(a)** todo Isla de Pascua (IPC) se pide a **Reservas Mahinatur**, menos el hotel. **(b)** El **Hotel Vai Moana** (IPCH01) se pide a **CL Mundo** (fila "Vai Moana, proveedor CL Mundo"). **(c)** **BUS04** se pide a **Chalten Travel**: el comentario "exacto, cuenca" es un error de copiado y no se usa. **(d)** **BUS02 y BUS03** son con **Plataforma10**, el sistema donde HI Travel emite los pasajes a mano. Son **tareas manuales, no pedidos por mail**: modo `manual`, como Kupos. Si no hay lugar, la segunda opción es **Patagonia Planet**. **(e)** **FTEE03** se pide a **Patagonia Profunda**, después de recargar el directorio (fila 9). **(f)** **Don Raul** (la opción de hotel de SPAP03) **no se carga**: HI Travel no lo reserva para Journaway. **(g)** **Los Tayka** van dentro del Overland y los reserva **Imperio Inca** (fila 6). **(h)** SPAT01 es Transvip y queda `manual`, como en M1 | Integración, un caso por letra: (a) IPCT01 e IPCE01 a IPCE08 se piden a Reservas Mahinatur. (b) IPCH01 no está "sin resolver". (c) BUS04 → Chalten Travel. (d) BUS02 y BUS03 tienen Plataforma10 como opción 1, marcada manual y sin proveedor, y Patagonia Planet como opción 2. **No debe pasar:** que Plataforma10 aparezca en el directorio o en la lista de pendientes por "sin mail". (e) FTEE03 → "Nativo Experience, proveedor: Patagonia Profunda". (f) Ningún servicio de Journaway menciona Don Raul. (g) Ver fila 6. (h) SPAT01 queda manual, no "sin resolver" |
| 5 | **Los paquetes de San Pedro son combinaciones de excursiones y traslados.** Cada uno queda armado en orden con su día, en `data/journaway-composicion.csv` (paquete, orden, día, componente, lado del traslado, nota). Salen del tarifario: **SPAP01** (Trip A): día 1 SPAT01 + SPAE01, día 2 SPAE02 + SPAE03, día 3 SPAE04, día 4 salida. **SPAP02** (Trip B): día 1 SPAT01 + SPAE01, día 2 SPAE02 + SPAE03, día 3 SPAE05, día 4 SPAE04, día 5 salida. **SPAP03** (Trip C, extensión de A): día 4 SPAE07, día 5 SPAE06, día 6 SPAE05, día 7 SPAT01 **solo de salida**. **SPAP04** (Trip E): día 1 SPAT01, día 2 SPAE01, día 3 SPAE03, día 4 SPAE05, día 5 SPAE04, día 6 salida. Ninguno lleva alojamiento. Si el archivo nombra un componente que no existe, el importador falla y no escribe nada | Integración: SPAP01 tiene 5 partes en orden (SPAT01, SPAE01, SPAE02, SPAE03, SPAE04) con sus días. SPAP03 tiene SPAE07, SPAE06, SPAE05 y SPAT01. Test con una fila que nombra "SPAE99": falla antes de escribir |
| 6 | **SPAP05 y SPAP06, con el Overland privado de Imperio Inca.** Se agrega un producto **UYUO01** · "Overland privado San Pedro – Uyuni en hoteles Tayka". No está en la planilla porque es interno. Lleva cuatro servicios, todos pedidos a **Imperio Inca**: la excursión del Overland (jeep 4x4 desde Hito Cajón, 3 días); una noche en Tayka del Desierto (noche 1); una noche en Tayka de Sal (noche 2); y el bus nocturno Uyuni – La Paz, que es un servicio del proveedor, como en CHB31, y sí se pide por mail. El hotel va escrito en la descripción del alojamiento: no hace falta una fila "Tayka" en el directorio. **SPAP05** (7N/8D, 4 noches en San Pedro): día 1 SPAT01 **solo de llegada** + SPAE01, día 2 SPAE03, día 3 SPAE05, día 4 SPAE04, día 5 SPAT02 + UYUO01 (días 5 a 7, bus la noche del 7). **SPAP06** (8N/9D, 5 noches): igual, pero los tours van en los días 2 a 5 y SPAT02 + UYUO01 en el día 6 | Integración: SPAP05 y SPAP06 tienen 7 partes en orden y terminan en SPAT02 → UYUO01. UYUO01 tiene sus 4 servicios a Imperio Inca, y ninguno "sin resolver". SPAT02 se pide a Imperio Inca. **No debe pasar:** que SPAP05 o SPAP06 usen el Overland compartido COMPBO20 (Villamar / Salt Hostel), ni que su shuttle de Calama tenga la salida |
| 7 | **La regla de traslados de M1-08 no se aplica sola a los paquetes de Journaway.** Esa regla supone que entre las partes de un tour se viaja en bus. En estos paquetes no pasa: todo es el mismo destino, o el Overland arranca desde el hotel. El lado del traslado sale **solo** de la columna "lado" de `data/journaway-composicion.csv`. Se guarda como ajuste del armado (`tour_servicio_ajuste`, origen `excepcion`), como en M1-08 | Integración: SPAT01 dentro de SPAP01, SPAP02 y SPAP04 **no tiene ningún ajuste** (ida y vuelta). Dentro de SPAP03 queda "solo salida" y dentro de SPAP05 y SPAP06 "solo llegada". Correr `npm run importar:tours` después no cambia ni borra estos ajustes |
| 8 | **Los nombres de Journaway, cargados como `codigo_externo`** (agencia "Journaway"). Están en `data/journaway-nombres.csv`: código, nombre tal cual, origen (tarifario, mail de ejemplo o planilla). Por cada producto va el nombre del tarifario y los nombres de los mails, sin las notas de la planilla ("(parte de un PKT)", "Dentro de un paquete"). UYUO01 lleva los 3 nombres de día del Overland. Cada nombre se guarda **limpio** para buscarlo: sin prefijos ("San Pedro de Atacama:", "From Foz do Iguaçu:", "Tour:"), sin mayúsculas ni acentos. También se guarda tal cual, para mostrarlo. **Los productos en celeste llevan además su propio código** como código de Journaway, porque el owner les pidió que lo pongan en cada reserva. Los 8 sin color no lo llevan. Si un mismo nombre limpio apunta a dos productos, el importador falla y no escribe nada | Integración: "Tour through the Moon Valley" → SPAE03; "Tour to the Quepiaco River, Monjes de la Pacana, and the Salt Flats" → SPAE05; "Half-day tour to the Argentinean side of Iguazú Falls" → IGRE01; "Siloli: Full-day tour to the Siloli Desert & the Black Lagoon" → UYUO01. SPAE05 tiene el código "SPAE05" de Journaway y SPAE03 no. Test con dos productos con el mismo nombre: falla antes de escribir |
| 9 | **Se recarga el directorio** con el Excel de proveedores actualizado, copiado del Drive al `Insumos/` del clon, y después toda la cadena de M1 (proveedores → equivalencias → productos → paquetes → tours) | Integración: existen "Nativo Experience, proveedor: Patagonia Profunda" (reservas@ y producto@patagoniaprofunda.com) y "Vai Moana, proveedor CL Mundo". El reporte de recarga lista esas altas. Los 7 tours de M1 quedan igual que antes: mismas partes y mismos ajustes |
| 10 | **Se puede correr de nuevo sin romper nada.** `npm run importar:journaway` carga todo. Una segunda corrida no duplica productos, servicios, partes ni nombres: actualiza. **No pisa productos de M1:** si un código de la planilla ya existe en la base y no es de Journaway, falla y no escribe nada. Los importadores de M1 tampoco tocan los productos de Journaway. Cada corrida queda en `importacion` | Integración: dos corridas seguidas dejan las mismas cantidades. Test con un código de la planilla cambiado a "OD030": falla con "OD030 ya es un producto de otro catálogo" y no escribe nada. Correr `importar:productos` e `importar:tours` después deja los productos de Journaway igual |
| 11 | **El catálogo los muestra** (ver §4). Los productos con nombres de Journaway llevan el chip **"Journaway"**. Al buscar "journaway" se ven solo esos. Debajo del código ya no se listan los nombres largos de la agencia. El detalle muestra la tabla de nombres de la agencia que ya existe y, en los paquetes, sus partes en orden, como un tour de M1 | Test de pantalla: una fila con nombres de Journaway muestra el chip. Buscar "journaway" deja los 53 productos de Journaway. Debajo del código **no** aparece un nombre de Journaway, y sí siguen apareciendo los códigos de TourRadar. Recorrido en el navegador: SPAP05 muestra sus 7 partes y UYUO01 sus 4 servicios a Imperio Inca |
| 12 | **Reporte para el owner**, en llano: cuántos productos se cargaron por destino; los que no se venden sueltos a Journaway (los 8 sin color); a quién se le pide cada uno; los "sin resolver" con el motivo y qué fila agregar al Excel de proveedores; los manuales (Plataforma10, Transvip); y los nombres cargados por producto, con los que no tienen ningún nombre de mail | `docs/sdd/diagnosticos/M2-08-catalogo-journaway.md`. Incluye IGRP02, IGRT01 e IGRE03 como "sin resolver" con el pedido concreto ("agregar una fila de Cuenca del Plata para …"). No incluye jerga ni rutas de archivos en el texto para el owner |

## 4. Qué ve el usuario
- **Pantallas que cambian:**
  - **Catálogo** (`/catalogo`): el chip "Journaway" en la fila. El buscador también encuentra
    por el nombre de la agencia. Debajo del código ya no aparecen los nombres de Journaway, que
    son largos; siguen apareciendo los códigos cortos de otras agencias.
  - **Detalle** (`/catalogo/[id]`): sin cambios de diseño. Muestra lo nuevo con lo que ya
    existe: la tabla de nombres de la agencia, los servicios con su proveedor y, en los paquetes,
    las partes en orden. Los paquetes de San Pedro llevan el chip "Tour", como los armados de M1.
- **Recorrido:**
  1. El owner escribe "journaway" en el buscador y ve sus 53 productos.
  2. Abre SPAP05: ve el shuttle de llegada, los 4 tours de San Pedro, el traslado a Hito Cajón y
     el Overland con los Tayka y el bus a La Paz, todo a Imperio Inca.
  3. Abre IGRP02 y lo ve marcado como pendiente: "falta el proveedor".
- **Estados:** sin cambios. Carga, error y vacío ya existen. Si la búsqueda no encuentra nada,
  se ve el vacío que ya existe.

## 5. Qué queda afuera
- **Reconocer una reserva de Journaway** (tours sueltos, Tayka, título, vuelos en alemán): es
  M2-09. Lo mismo para el combo SPAP01 + SPAP03 de un mail ("All San Pedro 8 Days") y cuál de
  los dos shuttles se pide en ese caso.
- **Precios** del tarifario: no se guardan (modelo de datos, "Qué NO se guarda").
- **Completar en el directorio** las filas que faltan de Cuenca del Plata: lo hace el owner en el
  Excel. La app solo las reporta.
- **El texto "Pasaje que emite HI Travel" de los buses de los tours de M1** (que diga
  Plataforma10): es el detalle menor anotado en `PROGRESS.md`. Acá Plataforma10 entra solo como
  opción manual de BUS02 y BUS03.
- **Las reglas de fechas** (por ejemplo, SPAE05 no sale el 25 y el 31 de diciembre ni el 1 de
  enero; BUS02 sale día por medio): son de M3.
- **Elegir entre opciones** (Plataforma10 o Patagonia Planet; Vértice o Las Torres): se hace
  con la reserva, en M3.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — no hace falta una tabla ni una columna nueva. Si el builder necesita una, va en una
  migración nueva con RLS activa, como el resto del catálogo.
- **#3** — no usa IA. Todo sale de la planilla y de `data/`. Si la recarga del directorio usa el
  respaldo de IA de M1, corre bajo el techo de `uso_ia`.
- **#4** — no manda nada a nadie. Plataforma10 queda como tarea manual.

## Preguntas abiertas (no bloquean)
1. **Cuenca del Plata sin fila** para el Paquete 101 Premium (IGRP02), los traslados IGU – Puerto
   Iguazú (IGRT01) y Ruinas de San Ignacio y Minas de Wanda (IGRE03). Mientras el owner no las
   agregue al Excel de proveedores, quedan "sin resolver". Una alternativa es que vayan todas a la
   fila genérica de Cuenca del Plata: lo decide el owner.
2. **BUS02 y BUS03:** se carga Patagonia Planet como segunda opción, porque así dice la planilla
   ("si no hay lugar le pedimos a Patagonia Planet"). Si el owner prefiere que quede solo
   Plataforma10, se borra la segunda línea de `data/journaway-proveedores.csv`.
3. **Código del Overland privado (UYUO01):** es interno y lo propone esta spec. Si el owner usa
   otro, se cambia en `data/` antes de cargar.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):**
  1. Tests unitarios + linter + tipos:
     - lectura de la planilla con colores;
     - traducción del proveedor;
     - limpieza de nombres;
     - validación de `data/` (componentes que no existen, nombres repetidos, códigos de otro
       catálogo);
     - armado con lados;
     - la pantalla (chip, buscador, línea debajo del código).
  2. Integración contra el **Supabase real**:
     - recarga completa: proveedores → equivalencias → productos → paquetes → tours →
       `importar:journaway`;
     - las consultas de las filas 2 a 10;
     - una segunda corrida sin cambios.
  3. Recorrido en el navegador de la fila 11 y §4, y `npm run build`.
- **Test primero:** cada test se escribe antes del código y se lo ve fallar por la razón
  correcta.
- **Insumos:** copiar al `Insumos/` del clon, desde el Drive (`G:\Mi unidad\HI Travel\Sistemas\
  Proyecto Automatizacion de Operaciones\Curso IA\Automatizacion\Insumos\`):
  - `Borrador productos Journaway.xlsx`;
  - `Proveedores Hi Travel 2026 para IA.xlsx`, con Patagonia Profunda en la fila 155 y Vai Moana
    en la 331.
- **Leer los colores:** con la librería `xlsx` del repo:
  `XLSX.readFile(ruta, { cellStyles: true })`. La celda de la columna A trae `s.fgColor.rgb ===
  "DCE6F2"`.
- **Dónde va cada cosa (orientativo):**
  - `src/lib/importador-journaway/`:
    - `planilla.ts`: lee la hoja y los colores;
    - `composicion.ts`, `nombres.ts`, `proveedores.ts` (+ `.test.ts`): leen y validan los 3
      archivos de `data/`;
    - `importar.ts`: escribe en la base;
    - `reporte.ts`: arma el reporte.

    Reusar de `src/lib/importador-productos/`: `proveedores.ts`, `equivalencias.ts`,
    `destinos.ts` (sumar `IPC` y `PUQ`), `csv.ts` y el patrón de reporte de `reporte-carga.ts`.
    De `src/lib/importador-tours/importar.ts`: cómo se escriben `producto_componente` (con
    `dia_desde`) y `tour_servicio_ajuste`, y cómo se borran los sobrantes **solo de los productos
    propios**.
  - **Limpieza de nombres:** exportar una sola función (por ejemplo `limpiarNombreJournaway`),
    que M2-09 reusa para buscar.
  - `codigo_externo` (agencia `"Journaway"`):
    - por nombre: `codigo` = nombre limpio, `nombre_externo` = nombre tal cual;
    - los celestes llevan además una fila con `codigo` = su código HI Travel.

    La restricción única (agencia, codigo) ya impide repetidos. Validarlo antes de escribir, para
    fallar con un mensaje claro.
  - **Cómo se distingue un producto de Journaway** (fila 10): por tener una fila
    `codigo_externo` de Journaway, o por el registro de su corrida en `importacion`. Lo más
    simple, sin columna nueva.
  - `data/journaway-proveedores.csv`, `data/journaway-composicion.csv` y
    `data/journaway-nombres.csv`: los arma el builder a partir de la planilla, el tarifario y los
    4 mails, con una nota por fila que dice de dónde sale. Las equivalencias nuevas que hagan falta
    (`SPA,Transvip,,manual`, `PNT/PUQ,Plataforma10,,manual`) van en
    `data/equivalencias-proveedores.csv`.
  - Script: `scripts/importar-journaway.ts` y `"importar:journaway": "tsx
    scripts/importar-journaway.ts"` en `package.json`.
  - Pantalla:
    - `src/components/catalogo/catalogo-pantalla.tsx`: el chip, y filtrar Journaway de la línea
      debajo del código;
    - `src/lib/catalogo/reglas.ts` (`filtrarCatalogo`): buscar también por agencia;
    - el texto del chip en `src/lib/textos/index.ts`.
  - Documentar en `docs/arquitectura/modelo-de-datos.md`: los paquetes de Journaway como armados
    sin la regla de buses, y los nombres limpios en `codigo_externo`.
- **No hay correcciones a mano en la base:** todo sale de los Excel y de `data/`.
- **`CLAUDE.md` no se commitea:** `next dev` le agrega un bloque.
