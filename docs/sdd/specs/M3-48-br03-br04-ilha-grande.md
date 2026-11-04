# M3-48 · BR03 y BR04 en el catálogo (Río, Paraty e Ilha Grande)

**Depende de:** M3-47. Pedida por el owner el 2026-11-02 y 03. Dos reservas reales de Kilroy están en "para revisión":
- **BR03** `HI_TRAVEL_BR03-677` (id `ea043c00-f295-4973-bf7b-3c56100b7f18`, 3/11 al 11/11/2026, 1 pax, Single Room - Hostel):
  **ya se pidió a mano** (owner, 2026-11-03). No se le arman pedidos.
- **BR04** `HI_TRAVEL_BR04-677` (id `a6db2703-e4ae-40a5-bb1e-3826c814abf7`, 26/05 al 9/06/2027, 2 pax, Dormitory - Hostel):
  **todavía no se pidió** (owner, 2026-11-03). Es la que va a salir por el sistema.

## 1. Las fuentes
- `RutasenBus`, hoja "Tours 2027". BR03: COMPBR02, COMPBR11, OD032 (8 noches). BR04: COMPBR02, COMPBR11, OD010B, COMPBR10,
  OD032 (14 noches). Con sus columnas de tramos: "Ilha Rio" en BR03; "Foz - Sao 1n" y "SAO Paraty" en BR04.
- Excel de paquetes: COMPBR02 en las filas 1720-1743 (Paraty) y COMPBR11 en las 2686-2701 (Ilha Grande).
- Word de Multi Destination: el del Drive, ya copiado al clon. **El recorrido, los días y las noches salen de ahí y de
  RutasenBus**, no de esta ficha: el reporte los lista para que el owner los vea.
- COMPBR10, OD010B y OD032 ya están en la real.

## 2. Decisiones del owner (2026-11-03)
- **Paraty, orden de pedido:** Che Lagarto → Casa do Rio → Casa Viva → Agatha. El Excel los nombra en otro orden (Agatha
  antes que Casa Viva), y el Excel no lo edita la IA.
- **Che Lagarto no tiene contacto:** se reserva en su sistema online. Sale como tarea para la persona, no como pedido.
- **Ilha Grande, orden:** Holandes Hostel → Che Lagarto Ilha Grande (solo si Holandes no tiene lugar).
- **Desayuno:** Che Lagarto (Paraty e Ilha Grande) y Holandes **sí**. Casa do Rio, Casa Viva y Hostel Agatha **no**.
- **Precios:** el precio nuevo de BR03, BR04 y BR20 es el correcto; el catálogo público cambia recién en mayo-junio de 2027.

### Respuestas del owner (2026-11-03)
- **Che Lagarto a mano:** la tarea nombra las alternativas, en el orden de Paraty: Casa do Rio, Casa Viva, Agatha.
- **Paraty Tours:** hace los traslados Río - Ilha Grande, Río - Paraty, Paraty - Ilha Grande y viceversa. En BR04, el de Ilha Grande - Río está incluido en COMPBR02.
- **Buses de BR04:** se emiten con Plataforma10 (plataforma10.com.br): Foz - São Paulo Barra Funda y Paraty - São Paulo Tietê, y viceversa. La tarea nombra Plataforma10 y esas terminales.
- **Budget en Foz (BR04):** Nacional Inn Foz 3\* (306). El owner prefiere dar algo mejor: los Budget de IGR e IGU son muy básicos.
- **Traslado de salida de Río:** "Transfer <alojamiento> - Aeropuerto GIG".
- **Scuna Netuno:** sin pick up ni drop off. El punto de encuentro es en el puerto para todos los clientes; no se pregunta el horario.
- **Salida de Foz en BR04:** solo un transfer a la Rodoviaria de Foz, desde donde sale el bus a São Paulo Barra Funda. No dice "Bus o vuelo pendiente".
- **Portugués:** los mails dicen "Rio de Janeiro".

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Paquetes:** COMPBR02 y COMPBR11 en `data/paquetes-piloto.csv` con su destino (Paraty e Ilha Grande en `ciudades.ts` si faltan), y sus Hotel 3\* en `data/niveles-confirmados.csv` con lo que dice el Excel | Unitario: el diagnóstico los encuentra con nivel en todas sus líneas de alojamiento. COMPBR02 filas 1722 y 1728 hoy no tienen nivel |
| 2 | **Bloque COMPBR02 sin IA:** sus filas se leen sin notas ambiguas | La carga en seco de COMPBR02 y COMPBR11 da 0 llamadas a IA |
| 3 | **Orden de los hostels:** lo más simple que respete §2 con el mecanismo que ya usa el sistema para "A / B". Si el mecanismo toma el orden del Excel y no se puede indicar otro sin código nuevo, se pregunta al owner en el reporte | Unitario: en Paraty y en Ilha Grande, el primero de la lista es el de §2 y los demás quedan como alternativa |
| 4 | **Che Lagarto como tarea:** el alojamiento se resuelve como tarea de reservar online, sin pedido. Si hoy el sistema no tiene esa forma, se reporta qué texto saldría y no se fuerza | Integración: BR04 con Che Lagarto primero no da un pedido a una casilla vacía, y queda una tarea clara con su fecha |
| 5 | **Equivalencias:** "Holandes Hostel / Che Lagarto" contra el directorio, "Pousada Corsario" ↔ Pousada do Corsario Paraty, "Agatha" ↔ Hostel Agatha y "Paraty Tours" ↔ su fila de nombre largo (fila 400) | Unitario o integración: todos llegan a su proveedor; `proveedoresSinResolver` vacío |
| 6 | **Desayuno:** Casa do Rio, Casa Viva y Hostel Agatha en `data/alojamientos-sin-desayuno.csv`, nota "Owner 2026-11-03 (M3-48)". Nada más | Unitario: esos tres no dicen "con desayuno"; Che Lagarto y Holandes sí |
| 7 | **Tramos:** los traslados y buses de "Ilha Rio", "Foz - Sao" y "SAO Paraty", con el proveedor que dicen las fuentes. El transfer Río - Paraty - Ilha Grande de COMPBR02 (Paraty Tours) no se duplica con "Ilha Rio". Ver en el reporte quién los pide; si las fuentes no alcanzan, es pregunta al owner | `armarTour` con los archivos reales da "armado" para los dos: BR03 8 noches, BR04 14 noches, con los días del Word |
| 8 | **Portugués:** PARATY e ILHA GRANDE en `data/ciudades-portugues.csv` si no están | Unitario: el mail a Casa do Rio y a Holandes sale en portugués |
| 9 | **Códigos Kilroy y tours:** BR03 y BR04 en `TOURS_PILOTO` y `data/codigos-kilroy.csv` | Unitario: el lector del CSV los toma |
| 10 | **Pedidos de BR04:** reserva de ejemplo con las fechas de la real, en la base de pruebas | Integración con `armarPedidos`: el reporte muestra pedidos y tareas, con fechas y noches correctas en cada destino |
| 11 | **En seco contra la real:** `importar:paquetes --codigos COMPBR02,COMPBR11 --en-seco` e `importar:tours --codigos BR03,BR04 --en-seco`, más la comparación de proveedores y equivalencias de solo lectura. **`importar:codigos-kilroy`, `importar:proveedores` e `importar:equivalencias` no tienen modo en seco: no se corren contra la real** | Reporte en `docs/sdd/diagnosticos/M3-48-carga.md`. Ninguna fila cambia |
| 12 | **Lo que ya estaba no cambia**, también con el Word nuevo. No hay copia del Word anterior para comparar: se compara lo que arma contra lo cargado | Suite completa con `--maxWorkers=2`, y `importar:tours --en-seco` (sin códigos) contra la real no cambia ningún tour ya cargado |

## 4. Qué ve el usuario
Nada hasta la carga. Después, BR04 se asigna y arma sus pedidos. BR03 entra al catálogo, sin armarle pedidos a su reserva
(la persona la resuelve sabiendo que ya se pidió a mano).

## 5. La carga en la real (no la hace el builder)
Con OK del owner y copiando antes los Excel del Drive: `importar:proveedores` → `importar:equivalencias` →
`importar:paquetes --codigos COMPBR02,COMPBR11` → `importar:tours --codigos BR03,BR04` → `importar:codigos-kilroy`.

## 6. Qué queda afuera
- BR20, aunque hereda precios de BR04.
- Una pasada automática de "si Holandes no contesta, pedir a Che Lagarto": la decide la persona. Holandes tarda en responder (owner).
- La marca "pedido incompleto".
- Los traslados en privado (owner, 2026-11-03): si se piden en privado, se le piden a Alex. Queda a mano.
