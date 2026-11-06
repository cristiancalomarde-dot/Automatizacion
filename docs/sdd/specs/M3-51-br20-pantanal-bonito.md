# M3-51 · BR20 en el catálogo (Iguazú, Dourados, Bonito, Pantanal, São Paulo, Paraty, Ilha Grande, Río)

**Depende de:** M3-50. Pedida por el owner el 2026-11-06. Reserva real de Kilroy en "para revisión":
`DK1598967` (id `e0791f38-4d80-4b4c-85aa-35cd4bdf77f6`), `HI_TRAVEL_BR20-677`, "Pantanal and Beaches - Iguazu Falls to Rio
Adventure - 19 nights", 19/02 al 10/03/2027, 2 pax, "Double Room at Hostel and Jungle Lodge".

## 1. Las fuentes
- `RutasenBus`, hoja "Tours 2027", fila 788 (copiada del Drive el 2026-11-06 16:19). Componentes: E OD010B (Foz 3 n),
  K COMPBR14 (Dourados 1 n), F COMPBR06 (Bonito 2 n con 1 actividad), G ODBR50 (Pantanal con traslados), L COMPBR13
  (São Paulo 1 n), C COMPBR02 (Paraty 2 n), D COMPBR11 (Ilha Grande 3 n), N OD032 (Río 3 n). Sin código: H "Campo grande -
  Sao 1n", I "Bus Foz - Cascavel - Dourados", J "Bus Dourdaos - Bonito", M "SAO - Paraty". Categoría: Hostel.
- Excel de paquetes (copiado del Drive el 2026-11-06 16:19): ODBR50 fila 1913 ("Pantanal Discovery"), COMPBR06 fila 2352
  ("Bonito Sample solo 2 nights"), COMPBR13 fila 2719 ("Sao Paulo 1 Extra Night"), COMPBR14 fila 2736 ("Dourados 1 Extra
  Night"). OD010B, COMPBR02, COMPBR11 y OD032 ya están en la real.
- Word de Multi Destination, BR20. **El Word tiene un error** en lo incluido: "Night bus from Foz do Iguazu to Sao Paulo
  Barra Funda Station" es desde **Campo Grande** (owner). El Word no se edita: se corrige con los CSV de `data/`.
- Proveedores ya cargados en la real (2026-11-06): Bonito HI Hostel, Pira Miuna, Ygarape (Bonito, ygarape@), Agmar
  (WhatsApp), Ceu do Mato Eco Hostel (WhatsApp), Hotel Bahamas Dourados; ya estaban Pantanal Jungle Lodge y Sooz.

## 2. Decisiones del owner (2026-11-06)
- **Buses, todos con Plataforma10** (plataforma10.com.br): Foz → Cascavel → Dourados, Dourados → Bonito, el nocturno
  **Campo Grande** → São Paulo Barra Funda, y São Paulo Tietê → Paraty.
- **Horarios de los buses:** Foz → Cascavel tiene que ser **el primero de la mañana (suele ser 6 hs)**, para conectar
  sin llegar tarde a Dourados. Dourados → Bonito, **el primero (suele ser 7 hs)**, para llegar temprano. La tarea lo dice.
- **Agmar, por WhatsApp:** traslado privado Bonito → Pantanal Jungle Lodge, Lodge → Rodoviaria de Campo Grande, y los
  traslados internos de Bonito (excursiones).
- **Salida de Foz: sin traslado.** Van por su cuenta a la Rodoviaria; no está en el presupuesto. (A diferencia de BR04.)
- **São Paulo:** COMPBR13, como COMPBR10 pero 1 noche. **Ilha Grande:** como BR04 (Holandes; si no hay lugar, Che
  Lagarto). **Categorías:** solo Hostel (y Lodge); Budget Hotel queda afuera hasta que entre una venta así.
- **Desayuno:** los hostels de Dourados y Bonito **no** dan desayuno (Ceu do Mato, Bonito HI Hostel); los hoteles sí.
  Foz, según el Word, sin desayuno (ver lo que ya hace OD010B; no cambiarlo para otros tours).
- **Ygarape:** vale `ygarape@ygarape.com.br` (la fila de Bonito). La fila vieja (`atendimento@`, ciudad BRASIL) no se usa.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Paquetes:** ODBR50, COMPBR06, COMPBR13 y COMPBR14 en `data/paquetes-piloto.csv` con su destino (Dourados, Bonito y Pantanal en `ciudades.ts` si faltan), con niveles en sus líneas de alojamiento (`data/niveles-confirmados.csv` si hace falta) | Unitario: el diagnóstico los encuentra, sin `bloqueNoCalza`, con nivel en todas sus líneas de alojamiento |
| 2 | **Sin IA:** los cuatro bloques se leen sin notas ambiguas | La carga en seco de los cuatro da 0 llamadas a IA |
| 3 | **Proveedores:** todos los nombres de los bloques y tramos llegan a su proveedor del directorio (equivalencias si hace falta). Ygarape resuelve a la de Bonito | Unitario o integración: `proveedoresSinResolver` vacío; Ygarape → `ygarape@ygarape.com.br` |
| 4 | **Tramos:** los 4 buses de §2 con Plataforma10 en `data/tramos-con-proveedor.csv`, con las terminales y la indicación del primer bus de la mañana donde corresponde (`en_la_tarea`). Los traslados de Agmar salen de ODBR50/COMPBR06 o de los tramos, **sin duplicarse** | `armarTour` con los archivos reales da "armado": 19 noches, con los días del Word |
| 5 | **Foz sin traslado de salida** en BR20 (`data/transfers-tour.csv` o `traslados-tour.csv`); OD010B no cambia para otros tours | Unitario |
| 6 | **Desayuno:** Bonito HI Hostel y Ceu do Mato Eco Hostel en `data/alojamientos-sin-desayuno.csv`, nota "Owner 2026-11-06 (M3-51)" | Unitario |
| 7 | **Portugués:** DOURADOS, BONITO, CAMPO GRANDE y Pantanal (la ciudad del directorio) en `data/ciudades-portugues.csv` si faltan | Unitario: el mail a Bonito HI Hostel y a Pantanal Jungle Lodge sale en portugués |
| 8 | **Código Kilroy y tour:** BR20 en `TOURS_PILOTO` y `HI_TRAVEL_BR20-677` en `data/codigos-kilroy.csv` | Unitario |
| 9 | **Pedidos de BR20:** reserva de ejemplo con las fechas de la real (19/02/2027, 2 pax, DBL Hostel), en la base de pruebas | Integración con `armarPedidos`: el reporte muestra pedidos y tareas, con fechas y noches correctas en cada destino |
| 10 | **En seco contra la real:** `importar:paquetes --codigos ODBR50,COMPBR06,COMPBR13,COMPBR14 --en-seco` e `importar:tours --codigos BR20 --en-seco`, y comparación de solo lectura de equivalencias. **`importar:codigos-kilroy`, `importar:proveedores` e `importar:equivalencias` no tienen modo en seco: no se corren contra la real** | Reporte en `docs/sdd/diagnosticos/M3-51-carga.md`. Ninguna fila cambia |
| 11 | **Lo que ya estaba no cambia** | Suite completa con `--maxWorkers=2`, e `importar:tours --en-seco` (sin códigos) contra la real no cambia ningún tour cargado |

## 4. Qué ve el usuario
Nada hasta la carga. Después, BR20 se asigna a DK1598967 y arma sus pedidos.

## 5. La carga en la real (no la hace el builder)
Con OK del owner y copiando antes los Excel del Drive: `importar:equivalencias` (si hay nuevas) →
`importar:paquetes --codigos ODBR50,COMPBR06,COMPBR13,COMPBR14` → `importar:tours --codigos BR20` → `importar:codigos-kilroy`.

## 6. Qué queda afuera
Budget Hotel. Corregir el Word. Borrar la fila vieja de Ygarape del directorio (lo decide el owner en su Excel).
