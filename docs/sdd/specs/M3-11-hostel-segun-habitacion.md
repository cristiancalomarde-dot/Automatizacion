# M3-11 · Puerto Natales: el hostel se elige según la habitación (Dorm o privada)

**Depende de:** M3-01 (armado de pedidos). Pedida por el owner el 2026-10-22 ("es solo para Puerto Natales";
la regla la había dado el 2026-10-09 al revisar los tours largos, anotada en PROGRESS).

## 1. Qué queremos lograr
En Puerto Natales, el pedido de hostel va al hostel que corresponde al tipo de habitación:

| Habitación de la reserva | Orden de los hostels |
|---|---|
| **Dorm** | 1) Puma Hostel · 2) Last Hope (Factoria no tiene dorms: no se ofrece) |
| **Privada** (doble, twin, single, triple) | 1) Factoria · 2) Last Hope · 3) Puma Hostel |
| No dice | el orden del Excel de paquetes, como hoy (Puma, Last Hope, Factoria) |

Vale para todo paquete o tour que pase por Puerto Natales con nivel Hostel (OD017, CH10, CH11 y los tours que
los traen: ARCH31, ARCH33, ARCH33EXP).

## 2. Qué hay hoy
`armar.ts` toma siempre la primera opción del catálogo (prioridad del Excel: Puma, Last Hope, Factoria) y avisa
"se tomó la primera opción del catálogo (otras: …)". Con DBL el pedido sale a Puma en vez de Factoria.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | La regla vive en un archivo de datos nuevo `data/hostel-segun-habitacion.csv` (`destino,habitacion,orden,nota`; `habitacion` = `dorm` o `privada`; `orden` = nombres separados por `\|`), con nota "Owner 2026-10-09/22". Sin casos especiales en código | Unitario: el archivo se lee y trae las 2 filas de PNT |
| 2 | Al armar, para un alojamiento de destino PNT, si la habitación es Dorm o privada, las opciones del servicio se reordenan según la regla; las que no están en la lista no se ofrecen (Factoria con Dorm) | Unitario (`armarPedidos`): Dorm → pedido a Puma, aviso "otras: Last Hope"; DBL → pedido a Factoria, "otras: Last Hope, Puma Hostel"; sin habitación → Puma como hoy |
| 3 | El hotel que se le informa a los demás proveedores (estadías "a confirmar") es el mismo que el elegido | Unitario: con DBL, la estadía de Puerto Natales dice Factoria |
| 4 | Otros destinos no cambian | Unitario: un hostel de otro destino con DBL sigue con la primera opción del Excel |
| 5 | Si un nombre de la regla no aparece entre las opciones del catálogo, se usa lo que sí está, en el orden de la regla, y si ninguno está, el orden del Excel | Unitario |

## 4. Qué ve el usuario
Sin pantallas nuevas: en "Armar pedidos" el pedido de Puerto Natales ya aparece a nombre del hostel correcto.
Los borradores sin editar se rearman con "Volver a armar".

## 5. Qué queda afuera
- Otros destinos (el owner confirmó que es solo Puerto Natales).
- Cambiar el proveedor de un borrador desde la pantalla.

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde.
- **#4:** no envía nada; solo cambia a quién va el borrador.

---

## Anexo técnico (para los agentes)
- El archivo se lee en runtime como `data/dias-servicio.csv` (`cargar.ts`: `ARCHIVO_DIAS`, `leerDiasServicio`);
  seguir esa forma. No hace falta recargar el catálogo ni migración.
- Comparar nombres con `normalizarTexto` contra `serviceProviderNombre` (y si falta, `queEs(s)`): "Puma Hostel",
  "Last Hope", "Factoria" (así figuran en `docs/sdd/diagnosticos/M1-04d-carga.md`, filas 731/1149/1305).
- Dorm = `tipoDeHabitacion` empieza con "dorm"; privada = doble, twin, single o triple. Otro texto o vacío → sin regla.
- Las 3 verificaciones: 1) unitarios + lint + tipos + build; 2) integración en la base de pruebas: `armarPedidos`
  de una reserva de ejemplo OD017 con "Double Room - Hostel" y otra con "Dormitory - Hostel"; 3) recorrido en
  modo prueba con esas reservas.
