# M1-07 · Correcciones del "probalo vos" de M1 (tours largos)

**Depende de:** M1-06

## 1. Qué queremos lograr
Que lo que el owner vio mal al revisar los tours largos (2026-10-09) quede bien en la base y en la
pantalla, con el Excel de proveedores corregido recargado. Al terminar, el owner vuelve a abrir
5C01, ARCH33, CH10 y BRARCH26 y ve el viaje como realmente se reserva. Con eso se puede cerrar M1.

## 2. Qué hay hoy
- **Excel de proveedores corregido por el owner** (`Insumos/Proveedores Hi Travel 2026 para IA.xlsx`,
  2026-10-09): Tetris pasó a la sección FOZ DO IGUAZU (fila 388, WhatsApp) y ya no está en BRASIL.
  "Cuenca Del Plata (Natalia )" ahora es "Cuenca Del Plata (Analia )" (fila 55). El WhatsApp de
  Antarctica Hostel está en la columna de contacto (fila 159).
- `data/equivalencias-proveedores.csv` usa "Cuenca Del Plata (Natalia )" como llave (filas 2 y 3).
  Si no se ajusta, al recargar el Excel esas equivalencias quedan sin emparejar.
- `data/tramos-con-proveedor.csv`: 5C01 "Bus Calama – San Pedro de Atacama" se le asigna a
  `Transvipp`, y eso **está mal**.
- `src/lib/importador-tours/armado.ts`: la regla de transfers es fija (primer componente con
  llegada y último con salida, salvo Iguazú). No hay forma de declarar una excepción por tour.
  Los traslados que van después de la última estadía se descartan ("lo cubre el paquete de la
  punta").
- CH10 es un paquete simple: sus servicios (alojamiento Hostel/3* y W Trek Standard de Las Torres)
  no dicen en qué noche del paquete van. La pantalla muestra "6 noches en Puerto Natales" sin
  separar.
- Pantalla de detalle (`src/components/catalogo/detalle-producto-pantalla.tsx`): cuando un tour
  incluye a otro tour (CHB31 dentro de 5C01), solo muestra un link al tour de adentro y no lo
  despliega. El dato (OD030, COMPBO20, bus Uyuni–La Paz) sí está en la base.
- Orden de recarga conocido: `importar:proveedores` → `importar:equivalencias` →
  `importar:productos` → `importar:paquetes` → `importar:tours`.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Recarga el directorio desde el Excel corregido. Tetris queda **una sola vez**, en Foz/Iguazú y por WhatsApp. Cuenca del Plata queda con "Analia". Antarctica Hostel queda con su WhatsApp como contacto | Consulta a la base real: 1 solo proveedor cuyo nombre contiene "Tetris", con canal WhatsApp; ninguno contiene "Natalia"; Antarctica Hostel tiene contacto. "Selina La Paz" (borrado con el OK del owner) no vuelve; si está en el Excel, el reporte lo avisa |
| 2 | Las llaves de `equivalencias-proveedores.csv` pasan de "Natalia" a "Analia". Después de recargar, los servicios que antes iban a Cuenca del Plata siguen yendo ahí | Test: el CSV no contiene "Natalia". Integración: los servicios de OD010C/OD010D que nombran "Cuenca del Plata/Plana" tienen el Booking Supplier de Cuenca del Plata (Analia) |
| 3 | 5C01: el tramo Calama – San Pedro de Atacama es un **bus de Kupos de terminal a terminal** (manual, no se le escribe). Transvip queda solo como traslado desde el aeropuerto de Calama (CJC). Se corrige la nota que dice "Transvipp" | `tramos-con-proveedor.csv`: Calama – San Pedro → `Kupos.cl`. En la base, ese tramo de 5C01 queda manual, sin proveedor y sin revisión. En la pantalla dice "se reserva a mano en Kupos.cl". En 5C01 no aparece Transvip en ningún tramo |
| 4 | Se pueden declarar **excepciones de transfer por tour y componente** en un archivo de `data/` (ej. `data/transfers-tour.csv`: tour, código, transfer_in, transfer_out, nota). Cada fila pisa la regla general solo en ese tour | Test de `armado`: con una excepción, ese componente cambia y los demás siguen con la regla. Si la excepción nombra un componente que el tour no tiene, el importador falla con un mensaje claro y no escribe nada |
| 5 | BRARCH26: OD029 (Santiago) **sin transfer de salida** (owner, 2026-10-09) | En la base, el componente OD029 de BRARCH26 tiene `transfer_out = false`. Sigue `transfer_in = false`. OD032 conserva el transfer de llegada |
| 6 | ARCH33: después de CH10 va la **salida de Puerto Natales**: bus Puerto Natales – Punta Arenas por Kupos (manual) **o** traslado al aeropuerto de Puerto Natales con Patagonia Planet. Se carga como tramo final del tour (la columna "PNT - PUQ" de RutasenBus). La opción concreta se elige con la reserva, en M3 | En la base, ARCH33 tiene un tramo después de CH10 que nombra las dos alternativas, manual por Kupos. La pantalla lo muestra como último paso. El reporte de M1-05 ya no dice que "PNT - PUQ" está incluida en CH10 |
| 7 | **CH10 solo no tiene bus de salida.** Lo de la fila 6 se agrega solo a ARCH33, no al paquete CH10 | CH10 abierto solo en la pantalla no muestra bus ni traslado de salida. Ningún servicio de CH10 es bus o transfer |
| 8 | CH10 guarda **en qué noches va cada servicio**: noche 1, alojamiento en Puerto Natales. Noches 2 a 5, W Trek Standard en refugios (4 noches, Las Torres). Noche 6, alojamiento en Puerto Natales. Los dos alojamientos se piden por separado (fechas distintas) y usan las mismas opciones de hotel que ya trae el Excel | Integración: los servicios de CH10 tienen noche de inicio y cantidad de noches: alojamiento (1, 1) y (6, 1), W Trek (2, 4). La suma da 6 = noches del paquete. Un paquete sin este dato sigue mostrándose como hoy (no se rompe nada) |
| 9 | La pantalla de detalle muestra CH10 **día por día** con esas tres partes. Dentro de ARCH33, las mismas tres partes aparecen con los días del tour (empieza el día 6) | Test de pantalla + recorrido en el navegador: CH10 muestra "Día 1 · 1 noche en Puerto Natales", "Día 2 · W Trek Standard, 4 noches en refugios (Las Torres)", "Día 6 · 1 noche en Puerto Natales". En ARCH33 se ven los días 6, 7 y 11 |
| 10 | La pantalla **despliega el tour de adentro**: en 5C01, el paso CHB31 muestra OD030, COMPBO20 y el bus Uyuni – La Paz con los días de 5C01 (OD030 desde el día 22), no solo un link. El link al tour CHB31 se mantiene | Test de pantalla con un tour anidado: aparecen los 3 pasos internos con su día. Recorrido en el navegador: en 5C01 se ve OD030. Un tour sin tours adentro se ve igual que antes |
| 11 | Reporte de la recarga para el owner: qué cambió en el directorio (altas, bajas, cambios de contacto) y lo que no cierra (sin contacto, duplicados como "CHALTEN"/"EL CHALTEN", proveedores en otra ciudad) | Archivo en `docs/sdd/diagnosticos/M1-07-recarga.md`, en llano. Los reportes de M1-04d y M1-05 se regeneran con los cambios |

## 4. Qué ve el usuario
- **Pantalla que cambia:** detalle de producto (`/catalogo/[id]`), en la secuencia día por día.
- **Recorrido:** el owner abre 5C01 y ve CHB31 desplegado con OD030. Abre ARCH33 y ve CH10 en tres
  partes y, al final, la salida de Puerto Natales (bus Kupos o traslado con Patagonia Planet).
  Abre CH10 solo y no ve bus de salida. En BRARCH26, Santiago figura sin transfer de salida.
- **Estados:** sin cambios respecto de M1-06 (carga, error y vacío ya existen). Si un tour de
  adentro no tiene secuencia cargada, el paso muestra el link como hoy, sin romper la pantalla.

## 5. Qué queda afuera
- **Cargar CH11 (W Trek Express) y ARCH33EXP.** Están en el Excel, pero no son de los 7 tours de
  M1. Se suman cuando el owner lo pida.
- **Reglas de M3** (CL Mundo "3* SUP", prioridades de Puerto Natales por tipo de habitación,
  elegir entre bus Kupos o traslado PNT): ya están anotadas en `PROGRESS.md`, no se construyen acá.
- Ordenar el Excel de proveedores o limpiar duplicados: solo se reportan (fila 11).
- Cualquier cambio en los tours que el owner no marcó (ARCH31, AR09, etc.).

## 6. Reglas del proyecto que toca
- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — si se agrega una columna o tabla, va en una migración nueva con RLS activa, como las
  demás del catálogo.
- **#3** — si la recarga usa el respaldo de IA, corre bajo el techo de gasto de `uso_ia`.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):** 1) tests unitarios + linter → 2) integración
  contra el Supabase real (recarga completa en el orden de §2 y consultas de las filas 1-8) →
  3) recorrido en el navegador de 5C01, ARCH33, CH10 y BRARCH26 (fila 9-10), más `npm run build`.
- **Test primero:** el test se escribe antes de la implementación y se lo ve fallar por la razón
  correcta.
- **Dónde va cada cosa (orientativo):**
  - Datos: `data/equivalencias-proveedores.csv`, `data/tramos-con-proveedor.csv`, nuevo
    `data/transfers-tour.csv`, y un archivo nuevo para las noches de cada servicio de un paquete
    (ej. `data/noches-servicio.csv`: paquete, servicio, noche_desde, noches, nota), si no hay un
    lugar mejor en el Excel.
  - Modelo: noche de inicio y cantidad de noches por servicio de paquete (columnas nulas en
    `producto_servicio` o tabla aparte). Migración `0008_...`. Documentar en
    `docs/arquitectura/modelo-de-datos.md`.
  - Importador de tours: `src/lib/importador-tours/armado.ts` (excepciones de transfer, tramo
    final de ARCH33) y `reporte.ts`.
  - Pantalla: `src/components/catalogo/detalle-producto-pantalla.tsx`, `src/lib/catalogo/consultas.ts`
    y `reglas.ts` (desplegar tour anidado, noches por servicio).
- **Proveedores corregidos a mano:** no hay correcciones manuales en la base salvo el borrado de
  "Selina La Paz". La recarga no debe traerlo de vuelta sin avisar.
- **Cuidado:** `next dev` agrega un bloque "nextjs-agent-rules" a `CLAUDE.md`; no commitearlo.
