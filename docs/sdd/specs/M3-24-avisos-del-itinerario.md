# M3-24 · Avisos del itinerario: blackouts, fechas especiales y buses que no salen ese día

**Depende de:** M3-23 (AR10) y el armado de pedidos (M3-01). Pedida por el owner el 2026-10-26 a partir de
la reserva TourRadar #1389186 (AR10): el bus Río Gallegos → Ushuaia caía un martes (sale lun/mié/vie) y
dos excursiones de Mendoza caían el 24 y el 25 de diciembre. Lo vio el loop a mano; el owner quiere que
**el sistema lo detecte solo en cualquier reserva** y que el operativo lo vea **apenas entra a la reserva**.

## 1. Qué queremos lograr
Arriba de todo en el detalle de la reserva, en amarillo, un bloque **"Revisar antes de pedir"** con los
problemas de fechas del itinerario, calculados al armar (sin IA):

1. **Blackout del producto:** la salida cae en un blackout del Word del tour (temporada, feriados, días
   de la semana en que no puede empezar). Ej.: AR10 "1 abr – 1 oct", Río "no puede empezar 27 dic – 3 ene",
   "Can't begin Tuesdays", "Arrival to Salta NOT on Tuesdays".
2. **Fecha especial en el itinerario:** una excursión, traslado o bus cae en **Navidad (24-25 dic), Año
   Nuevo (31 dic – 1 ene), Carnaval o Semana Santa**. Carnaval y Semana Santa se calculan por año (dependen
   de la Pascua); **en Río (y Brasil) los rangos son más largos** que en Argentina (Reveillon, Carnaval).
3. **Bus en un día que no sale:** un tramo de bus del tour cae en un día de la semana en que ese tramo no
   opera según la hoja "Buses para Tours" (`Insumos/RutasenBus2020.xls`).

Los blackouts los escribe el owner en los Word, "pero nos podemos equivocar": el sistema avisa, no frena.
Los avisos también salen como aviso interno en los borradores de pedido afectados.

## 2. Qué hay hoy
- Notas de la reserva (`reserva.notas`): se ven abajo de todo, en azul. En #1389186 el loop cargó los dos
  avisos a mano como notas (2026-10-26).
- Avisos de llegada de vuelo arriba de la reserva (`avisosDeLlegada`) y avisos internos en pedidos (M3-20:
  vuelo después de las 17 hs): el patrón a seguir.
- Los Word (`Insumos/* Tours 1 Jun 2026 - 31 Dec 2027.docx`) tienen ~50 líneas "Blackout…" en formatos
  libres; los días de los buses están en RutasenBus (hoja "Buses para Tours").

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Diagnóstico (sin escribir en ninguna base):** extraer de los Word los blackouts de cada producto cargado y de RutasenBus los días de cada tramo de bus; proponer `data/blackouts.csv` (producto, tipo: rango de fechas / día de semana de inicio / feriado nombrado, desde, hasta, nota con la línea del Word) y `data/fechas-especiales.csv` (feriado, destino/país, regla: fija o relativa a la Pascua, días antes/después). Reporte `docs/sdd/diagnosticos/M3-24-diagnostico.md` con lo que no se pudo interpretar y **una sola lista de preguntas** para el owner (cada una con opción sugerida) | El reporte existe; cada línea "Blackout" de los Word cargados está interpretada o en la lista de preguntas |
| 2 | **Blackouts:** con los CSV validados, el armado avisa si la salida (o el inicio de una parte) cae en un blackout | Unitario: AR10 en junio avisa; AR10 el 19 dic no; un "Can't begin Tuesdays" en martes avisa |
| 3 | **Fechas especiales:** avisa si un servicio con día (excursión, traslado, bus) cae en Navidad, Año Nuevo, Carnaval o Semana Santa del año que corresponda, con los rangos de Brasil donde aplique | Unitario: Bodegas 24/12 y Alta Montaña 25/12 de AR10 avisan; Carnaval 2027 calculado bien |
| 4 | **Buses:** avisa si un tramo de bus del tour cae en un día que no opera | Unitario: Río Gallegos → Ushuaia el martes 5 ene 2027 avisa |
| 5 | **Pantalla:** bloque amarillo "Revisar antes de pedir" arriba de todo en el detalle de la reserva, y aviso interno en el borrador afectado | Integración/recorrido: #1389186-like muestra los tres tipos |
| 6 | **Nada cambia donde no hay problema** | Los recorridos M3 existentes siguen en verde sin avisos nuevos inesperados |

## 4. Qué ve el usuario
El bloque amarillo arriba de todo; cada aviso en una línea en llano ("El bus Río Gallegos → Ushuaia cae
martes 5 ene; según la planilla sale lun/mié/vie").

## 5. Qué queda afuera
- Frenar el armado o el envío (solo se avisa).
- Corregir el itinerario solo (mover días): lo decide el operativo con el vendedor.
- Feriados distintos de los cuatro nombrados (se agregan como filas del CSV cuando el owner los pida).

## 6. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde. **#3:** sin IA. **#4:** no manda nada.

---

## Anexo técnico (para los agentes)
- Dos tiempos, como M3-10/M3-23: (A) diagnóstico y preguntas, parar; (B) con las respuestas, construir.
- Reglas en `data/*.csv` con nota del owner, leídas al armar (sin recargar el catálogo en la real si se puede).
- Pascua: algoritmo de computus (sin dependencias nuevas). Carnaval = lunes y martes 48/47 días antes
  de Pascua; los rangos ampliados de Río salen de los Word / respuestas del owner.
- Clon `C:\Users\gs\dev\hi-travel-automatizacion`; suite de integración por tandas (`--no-file-parallelism`).
