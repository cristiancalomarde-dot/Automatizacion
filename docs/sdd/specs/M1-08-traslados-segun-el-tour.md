# M1-08 · Los traslados de cada paquete según cómo se llega en el tour

**Depende de:** M1-07

## 1. Qué queremos lograr
Que dentro de un tour cada paquete muestre **solo los traslados que de verdad se piden**: si el
pax llega o se va en bus, no se pide el traslado de aeropuerto de ese lado. Algunos traslados
cambian de origen o de sentido. El owner abre cualquiera de los 7 tours y ve lo que hay que
reservar, sin Greeters, Remis ni CL Mundo de más. Con esto se cierra el "probalo vos" de M1.

## 2. Qué hay hoy
- `producto_componente.transfer_in/transfer_out` son solo marcas (chips en la pantalla). Dentro
  del tour, la pantalla muestra **todos** los servicios del paquete tal como se vende solo
  (`FilasServiciosDelPaquete` en `src/components/catalogo/detalle-producto-pantalla.tsx`).
- Los traslados de los paquetes no dicen su sentido. Solo el texto lo indica: "SCL - accommodation"
  es de llegada, "El Calafate Accommodation - FTE Airport" es de salida y "Round Trip" o
  "EZE o AEP - Hotel - EZE o AEP" son de ida y vuelta.
- `data/transfers-tour.csv` (M1-07) solo pisa las marcas por componente. `data/noches-servicio.csv`
  (M1-07) ya separa un paquete por noches (CH10).
- El directorio: el owner armó Patagonian Group y Cuenca del Plata **una fila por hotel**
  ("Vertical Lodge, proveedor Patagonian Group", "El Pueblito, proveedor Cuenca del Plata", etc.),
  todas con el mail del grupo. El Excel de paquetes dice "Booking Supplier: Patagonian Group" o
  "Cuenca del Plata". Hoy esos nombres son un alias que apunta a una sola fila (Hosteria Fitz roy,
  El Pueblito). Existe el modo `por_service_provider` (Tremun, Dazzler), que elige la fila por el
  hotel concreto.
- El Excel de proveedores se actualizó el 2026-10-10: mail de NH Cordillera, mail nuevo del
  Copacabana Mar y las filas de Patagonian Group.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Cada traslado de paquete tiene **sentido**: llegada, salida o ida y vuelta. Sale del texto del Excel, y si no se deduce queda "sin sentido" y se reporta (no se inventa) | Test unitario con los textos reales: "SCL - accommodation" → llegada; "El Calafate Accommodation - FTE Airport" → salida; "Round Trip: Rumbo Sur", "Round Trip", "EZE o AEP - Hotel - EZE o AEP" → ida y vuelta; "in CJC - Accommodation in San Pedro de Atacama" → llegada |
| 2 | **Regla general (confirmada por el owner 2026-10-10):** en un tour, si a un paquete se llega en bus (el paso anterior es un bus, o un paquete de otro destino conectado por bus), su traslado de llegada no se pide. Si se sale en bus, no se pide el de salida. Uno de ida y vuelta queda solo del lado que corresponde. El primer paquete del tour conserva la llegada y el último la salida, salvo excepción | Test de `armado`/reglas: OD020 en 5C01 sin Greeters; OD019 en 5C01 y BRARCH26 sin Remis Mendoza; OD025 y OD013 en AR09 sin traslados; OD016 en ARCH31 y ARCH33 sin traslados; OD018 en AR09 con Greeters **solo de llegada**; OD022 en AR09 **solo de salida** (Rumbo Sur) |
| 3 | **Excepciones declaradas en `data/`** (ej. `data/traslados-tour.csv`: tour, paquete, servicio, acción `anular` / `reemplazar` / `invertir`, texto nuevo, nota). Pisan la regla general en ese tour | Test: una excepción cambia solo ese servicio en ese tour. Si nombra un tour, paquete o servicio que no existe, el importador falla con un mensaje claro y no escribe nada |
| 4 | Excepciones del owner: **(a)** OD029 sin traslado SCL de CL Mundo en 5C01 y BRARCH26 (también al final del tour). **(b)** OD010D en 5C01 y OD010A en BRARCH26: el 105 Premium se pide **con transfer in desde la Rodoviaria de Foz y transfer out a la terminal de buses de Puerto Iguazú**. **(c)** OD031 en 5C01 (llega en bus desde Uyuni): traslado **desde la terminal de buses**, no desde el aeropuerto de La Paz. **(d)** OD030 en BOCHI04R: el Transvip CJC → San Pedro pasa a ser **de salida, San Pedro → CJC**. **(e)** COMPCH01 en 5C01: el bus Kupos queda **solo de ida** Santiago → Valparaíso (después va a Calama). **(f)** ARCH31: OD017 sin el bus Punta Arenas → Puerto Natales de llegada, y termina con la **salida de Puerto Natales** como ARCH33 (bus Kupos a Punta Arenas, aeropuerto o ciudad, o, a pedido, traslado al aeropuerto PNT con Patagonia Planet) | Integración contra la base real, un caso por letra: el servicio queda anulado, con el texto nuevo o con el sentido invertido, según corresponda. En ARCH31 el último paso es la salida de Puerto Natales, con las dos alternativas |
| 5 | **Iguazú combined (OD010D):** noches 1 y 2 del lado brasileño y noche 3 del lado argentino (Beer, El Pueblito o el hotel del nivel), el día de la excursión al lado argentino. Se separa por noches, como CH10 | Integración: OD010D tiene sus alojamientos con noche de inicio y noches (BRA 1-2, ARG 3). La pantalla de OD010D, sola y dentro de 5C01, lo muestra día por día |
| 6 | **Servicios a pedido u opcionales en el paquete vendido solo:** OD016, el traslado de llegada (aeropuerto FTE → alojamiento) se pide siempre y el de salida es **opcional**. OD017, traslado de llegada aeropuerto PNT → alojamiento, **a pedido del pax o del vendedor**. OD019, Remis Mendoza **solo si el paquete es CON traslados** (llega en avión). Se muestran con una marca "a pedido" o "según la reserva", sin borrarlos | Test de pantalla: OD016, OD017 y OD019 solos muestran la marca en esos servicios. Integración: los servicios tienen el dato guardado |
| 7 | **Patagonian Group y Cuenca del Plata, por hotel:** "Booking Supplier: Patagonian Group" (El Chaltén y El Calafate) y "Cuenca del Plata/Plana" (Iguazú) se resuelven a la fila del hotel concreto (modo `por_service_provider`). Ej.: Vertical Lodge → "Vertical Lodge, proveedor Patagonian Group"; El Pueblito → "El Pueblito, proveedor Cuenca del Plata"; La Aldea → la fila de La Aldea. Si el hotel no tiene fila propia, queda "sin resolver" y se reporta | Integración: OD033, OD013 y OD016 piden Fitz Roy, Vertical Lodge, El Paraíso y Puerto San Julián a su fila "…, proveedor Patagonian Group"; OD010C y OD010D piden cada hotel a su fila de Cuenca del Plata. Ningún servicio apunta a un nombre de hotel equivocado |
| 8 | Recarga del Excel de proveedores del 2026-10-10 (NH Cordillera con mail, mail nuevo del Copacabana Mar, filas de Patagonian Group) y de toda la cadena | Integración: NH Cordillera tiene mail y OD019 ya no lo tiene pendiente; el Copacabana Mar tiene el mail nuevo. El reporte de recarga lista altas, bajas y renombres; si una fila vieja quedó duplicada (ej. "Hosteria Fitz roy" sola), lo avisa sin borrarla |
| 9 | La pantalla, **dentro de un tour**, muestra cada paquete con sus servicios ajustados: los anulados no aparecen (o aparecen tachados con el motivo "llega en bus"), los reemplazados con su texto nuevo y los de un solo lado con "solo llegada" o "solo salida" | Test de pantalla + recorrido en el navegador de 5C01, AR09, ARCH31, BOCHI04R y BRARCH26. El paquete abierto solo (fuera del tour) sigue mostrando todos sus servicios |
| 10 | Reporte para el owner: por tour, qué se anuló, qué se reemplazó y qué quedó de un solo lado, y los traslados sin sentido deducido | `docs/sdd/diagnosticos/M1-08-traslados.md`, en llano. El reporte de M1-05 refleja lo mismo |

## 4. Qué ve el usuario
- **Pantalla que cambia:** detalle de producto (`/catalogo/[id]`), en la secuencia del tour y en
  el paquete vendido solo (marca "a pedido").
- **Recorrido:** el owner abre 5C01 y ve OD020 sin Greeters, OD019 sin Remis, OD029 sin CL Mundo,
  Iguazú con el 105 Premium desde la Rodoviaria de Foz, COMPCH01 con bus solo de ida y OD031 con
  traslado desde la terminal. En ARCH31 ve el cierre con la salida de Puerto Natales.
- **Estados:** sin cambios (carga, error y vacío ya existen).

## 5. Qué queda afuera
- **Publicar en Vercel:** se hace con `/deploy` al cerrar M1, con el OK del owner.
- **Reglas de fechas y de M3:** las bodegas que no salen los domingos (OD019), el cambio de
  terminal en São Paulo (llega a Tietê, sale de Barra Funda), los nombres de los W Trek que cambia
  el proveedor, CL Mundo "3* SUP" y las prioridades de Puerto Natales. Están anotadas en
  `PROGRESS.md`.
- **Reactivar el traslado de CL Mundo en OD029:** el owner lo decide con el cambio de precios de
  marzo-abril.
- **Elegir la variante de OD019 (CON o SIN traslados) según la reserva:** eso es M2. Acá solo se
  marca.
- Cargar CH11 y ARCH33EXP.

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — si se agrega una columna o tabla, va en una migración nueva con RLS activa.
- **#3** — si la recarga usa el respaldo de IA, corre bajo el techo de gasto de `uso_ia`.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):** 1) tests unitarios + linter + tipos → 2)
  integración contra el Supabase real (recarga completa: proveedores → equivalencias → productos
  → paquetes → tours, y consultas de las filas 1-8) → 3) recorrido de la pantalla real de los 5
  tours de la fila 9, más `npm run build`.
- **Test primero.**
- **Dónde va cada cosa (orientativo):**
  - Sentido del traslado: al importar los paquetes (`src/lib/importador-productos/`), guardado en
    `producto_servicio` (columna nueva, migración `0009_...`). Marca "a pedido / según la
    reserva": columna nueva o archivo de `data/`, lo más simple.
  - Ajustes por tour: calculados al armar el tour (`src/lib/importador-tours/armado.ts`) y
    guardados (ej. tabla `componente_servicio_ajuste`: componente, servicio, acción, texto, motivo)
    para que M3 los lea igual que la pantalla. Excepciones en `data/traslados-tour.csv`.
  - Noches de OD010D: `data/noches-servicio.csv` (mismo mecanismo que CH10). Si la línea de
    alojamiento del Excel junta los dos hoteles en un solo servicio ("2 Nights Nacional Inn Foz +
    1 night El Pueblito"), separarla en dos servicios con su noche, sin perder el nivel ni la
    prioridad.
  - Patagonian Group y Cuenca del Plata: `data/equivalencias-proveedores.csv`, modo
    `por_service_provider` en IGR, CHA y FTE. Reemplaza los alias que apuntan a una sola fila.
  - Pantalla: `src/components/catalogo/detalle-producto-pantalla.tsx`, `src/lib/catalogo/`.
  - Documentar el modelo en `docs/arquitectura/modelo-de-datos.md`.
- **Insumos:** el Excel de proveedores del 2026-10-10 ya está en `Insumos/` del clon.
- **No hay correcciones manuales en la base** salvo los borrados de `data/proveedores-borrados.csv`.
- `next dev` agrega un bloque a `CLAUDE.md`: no commitearlo. Ya hay un `next dev` corriendo en
  :3000 sobre el clon. No hace falta matarlo, porque recarga solo.
