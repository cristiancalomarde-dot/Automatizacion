# M3-47 · BR18 en el catálogo y en la real

**Depende de:** M3-46. Pedida por el owner el 2026-11-02: la reserva real de Kilroy **DK1587388** (BR18, 2 pax,
Dormitory - Hostel, 28 ene → 4 feb 2027) está frenada en "para revisión". El owner ya agregó los bloques en el Excel:
en `RutasenBus`, BR18 tiene C:ODBR15, E:COMPBR12, F:COMPBR04; en el Excel de paquetes, COMPBR12 está en la fila 2702
(SSA) y COMPBR11 en la 2686 (ILH).

BR03 y BR04 quedan afuera, salvo que COMPBR11 entra a la lista de bloques por tener la misma forma.

## 1. El recorrido que se busca

| Fecha en DK1587388 | Qué | Proveedor |
|---|---|---|
| 28/01 | Traslado aeropuerto SSA → alojamiento | Bahia Transfers |
| 28/01 al 31/01 | Salvador, 3 noches (ODBR15) | Hostel Laranjeiras |
| 30/01 | Praia do Forte full day | Cassi Turismo |
| 31/01 | Bus Salvador → Lençóis | Plataforma10: tarea "Emitir pasaje" |
| 31/01 al 03/02 | Lençóis, 3 noches (COMPBR04) | HI Hostel Chapada |
| 01/02 | Full Day Chapada 4 Ps | Agencia Chapada Backpackers |
| 03/02 | Bus Lençóis → Salvador | Plataforma10: tarea "Emitir pasaje" |
| 03/02 al 04/02 | Salvador, noche extra (COMPBR12) | El mismo hotel de la primera estadía |
| 04/02 | Traslado alojamiento → aeropuerto SSA | Bahia Transfers |

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Excel nuevos:** los tests y el catálogo cargado siguen igual con los dos Excel copiados del Drive | Diferencia celda a celda con las copias anteriores: el reporte dice qué cambió, y fuera de BR18, BR03, BR04, COMPBR11 y COMPBR12 no cambia nada sin explicar |
| 2 | **Bloques sin sección 2:** COMPBR11 y COMPBR12 en `BLOQUES_SIN_SECCION_2`, como COMPBR10 | Unitario: los dos se leen sin `noCalza` |
| 3 | **Traslado de salida:** el renglón de Bahia Transfers de COMPBR12 por `data/renglones-agregados.csv`. Nota del owner: el precio ya está en el paquete de 3 noches | Unitario o integración: COMPBR12 trae el renglón y el recorrido termina con ese traslado. Si el mecanismo no sirve para esto, se avisa en el reporte, no se inventa otro |
| 4 | **Hotel 3*:** las líneas de alojamiento de COMPBR12 y COMPBR11 en `data/niveles-confirmados.csv`, con lo que dice el Excel | Unitario: el diagnóstico las encuentra con nivel. Si el Excel no alcanza para saber el nivel, queda como pregunta al owner |
| 5 | **Equivalencias:** "Laranjeiras Hostel" ↔ Hostel Laranjeiras y "Chapada Backpackers" ↔ Agencia Chapada Backpackers en `data/equivalencias-proveedores.csv`. La nota de la fila 472 de HI Hostel ("solo si no hay lugar en HI Hostel Chapada") no se convierte en regla | Unitario: los nombres llegan al proveedor con contacto |
| 6 | **COMPBR04 fila 2239** (`(Gruta da Lapa Doce, ...)`) se resuelve sin IA, con el mecanismo que ya usen filas parecidas | La carga en seco no pide ninguna llamada a IA para ODBR15, COMPBR12 ni COMPBR04 |
| 7 | **BR18 en `TOURS_PILOTO`**; `HI_TRAVEL_BR18-677` sin `pendiente_de_carga`. La columna queda si otro código la usa; si no, se quita con su código solo cuando sea simple | `armarTour` con el Excel y el Word reales da "armado", 7 noches y días 1, 4, 4, 7, 7 |
| 8 | **Un solo mail al mismo hotel, con las dos estadías** (owner, 2026-11-03): una reserva de ejemplo con las fechas de DK1587388 | Integración en la base de pruebas con `armarPedidos`: Hostel Laranjeiras recibe un mail con las dos estadías separadas (28/01 al 31/01 y 03/02 al 04/02), y los buses dan tareas "Emitir pasaje" sin pedido |
| 9 | **En seco contra la real:** `--en-seco` con `--codigos ODBR15,COMPBR12,COMPBR04` y `--codigos BR18`, solo lectura | Reporte en `docs/sdd/diagnosticos/M3-47-carga.md` con lo que crearía cada comando. Ninguna fila de la real cambia |
| 10 | **Lo que ya estaba no cambia** | Suite completa en verde con `--maxWorkers=2`; los tours cargados arman igual |

## 3. Qué ve el usuario
Nada hasta la carga en la real. Después, DK1587388 se puede confirmar y arma sus pedidos.

## 4. La carga en la real (no la hace el builder)
Se corre con OK del owner, en este orden: `importar:proveedores` → `importar:equivalencias` →
`importar:paquetes --codigos ODBR15,COMPBR12,COMPBR04` → `importar:tours --codigos BR18` → `importar:codigos-kilroy`
→ confirmar la reserva.

**Ojo con `importar:proveedores`:** en el Excel, Merit Montevideo dice "a confirmar" hasta que el owner vuelva a
poner `reservas@amerian.com`. Antes de correrlo hay que ver qué cambia en la real, y usar la copia más nueva del Drive.

## 5. Qué queda afuera
- BR03 y BR04 (spec aparte: COMPBR02, Word de Multi Destination del Drive, Casa do Rio, Agatha y Casa Viva).
- La marca "pedido incompleto".
