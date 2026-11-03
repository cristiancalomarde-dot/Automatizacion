# M3-46 · Preparar el catálogo para BR18 (destinos, Plataforma10, carga por lista y en seco)

**Depende de:** M3-10 y M3-23 (cómo se amplía el catálogo). Pedida por el owner el 2026-11-02: la reserva
real de Kilroy **DK1587388** (BR18, 2 pax, Dormitory - Hostel, 28 ene → 4 feb 2027) está frenada en "para
revisión" porque `HI_TRAVEL_BR18-677` no está en el catálogo. Va antes que BR03 y BR04.

Esta pieza deja listo lo que **no depende** de los bloques que el owner está agregando en el Excel. La carga de
BR18 es **M3-47** y arranca cuando el owner avise que están.

## 1. El recorrido que se busca (se completa en M3-47)

| Día | Fecha en DK1587388 | Qué | Proveedor |
|---|---|---|---|
| 1 | 28/01 | Traslado aeropuerto SSA → alojamiento | Bahia Transfers |
| 1-4 | 28/01 al 31/01 | Salvador, 3 noches (ODBR15) | Hostel Laranjeiras (Hotel 3*: Pousada do Pilar / Bahiacafe) |
| 3 | 30/01 | Praia do Forte full day | Cassi Turismo |
| 4 | 31/01 | Bus Salvador → Lençóis | Plataforma10: tarea "Emitir pasaje" |
| 4-7 | 31/01 al 03/02 | Lençóis, 3 noches (COMPBR04) | HI Hostel Chapada (Hotel 3*: Hotel Terra dos Diamantes / Portal Lencois) |
| 5 | 01/02 | Full Day Chapada 4 Ps | Agencia Chapada Backpackers |
| 7 | 03/02 | Bus Lençóis → Salvador | Plataforma10: tarea "Emitir pasaje" |
| 7-8 | 03/02 al 04/02 | Salvador, noche extra (bloque nuevo del owner) | El mismo hotel de la primera estadía |
| 8 | 04/02 | Traslado alojamiento → aeropuerto SSA (línea del bloque nuevo) | Bahia Transfers |

## 2. Decisiones del owner (2026-11-02)
- Los buses Salvador ↔ Lençóis los compra HI Travel en **Plataforma10** (plataforma10.com.br), como los de
  Argentina (.com.ar). No se le escribe a nadie: es tarea de emitir pasaje.
- La noche extra repite el hotel de la primera estadía.
- La noche extra de Salvador y las noches de Ilha Grande son **componentes en el Excel, como COMPBR10**: los
  agrega el owner, con su código en las columnas de `RutasenBus`. Nada de paquetes escondidos en `data/`, y el
  Excel y el Word no los edita la IA.
- El owner carga en el Excel de proveedores los operadores con mail o WhatsApp, también los de Hotel 3*.

## 3. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **Destinos:** Salvador (SSA) y Lençóis / Chapada Diamantina (CHAP) en `ciudades.ts`, con nombres para mostrar | Unitario: "Lençóis", "Lencois", "Salvador de Bahia" y "Chapada Diamantina" dan su destino; los tours cargados arman igual |
| 2 | **Paquetes con código ya conocido:** ODBR15 y COMPBR04 en `data/paquetes-piloto.csv`, y sus alojamientos de Hotel 3* en `data/niveles-confirmados.csv` | Unitario: el diagnóstico en memoria los encuentra con nivel en todas sus líneas de alojamiento |
| 3 | **Buses con Plataforma10:** BR18 y su ruta en `data/tramos-con-proveedor.csv`; equivalencias `manual` de SSA y CHAP (nota del owner) | Unitario: sale como `reservaManual`, en los dos sentidos, y da tareas "Emitir pasaje" sin pedido a proveedor |
| 4 | **Abrir el Word de un tour:** una excepción en `data/` (solo BR18) que reemplaza lo que incluye el Word cuando no cuenta la secuencia real: 3 n Salvador, bus, 3 n Lençóis, bus, 1 n Salvador. Un mismo destino en dos componentes se ordena por esa excepción, no se adivina. Sin fila, todo sigue igual, también el motivo "ambiguo" | Unitario con fixture (un bloque de noche extra de prueba): `armarTour` da "armado", 7 noches y días 1, 4, 4, 7, 7; sin la fila, sigue en revisión |
| 5 | **Código Kilroy:** `HI_TRAVEL_BR18-677` → BR18 en `data/codigos-kilroy.csv` | Unitario: el lector del CSV lo toma |
| 6 | **Carga por lista:** `importar:paquetes` e `importar:tours` aceptan códigos (`--codigos BR18`; hoy recorren todos). Sin opciones, igual que hoy | Integración en la base de pruebas: solo toca esos códigos |
| 7 | **Modo en seco:** `--en-seco` en los dos, con `fetchSoloLectura`, sin IA y sin escribir reportes en `docs/`. Muestra qué haría | Integración: en seco no cambia ninguna fila y el resumen dice qué crearía |
| 8 | **Lo que ya estaba no cambia** | Suite completa en verde; los tours cargados arman igual |

Ojo: BR18 sumado a un `data/*.csv` todavía sin su bloque en el Excel no tiene que romper la corrida completa
del importador (hoy el piloto es explícito: BR18 entra a `TOURS_PILOTO` recién en M3-47).

## 4. Qué ve el usuario
Nada todavía: es preparación. No se escribe en la base real.

## 5. Qué queda afuera
- **M3-47:** leer los bloques del owner, armar BR18 de verdad, reserva de ejemplo con dos pedidos separados al
  mismo hotel, en seco contra la real, y carga en la real con OK del owner.
- BR03 y BR04 (spec aparte; antes hay que copiar al clon el Word de Multi Destination del Drive, más nuevo).
- Reglas de días o avisos para Brasil que no estén en las fuentes.
