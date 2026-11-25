# M3-63 · ARCH27 (Glaciers and Torres del Paine, 4 noches) al catálogo

**Depende de:** M3-62. Pedida por el owner el 2026-11-25. Reserva real Kilroy `DK1603956` (mail uid 17601), que entró
con un código Kilroy que no estaba cargado.

## 1. Qué pasa
ARCH27 está en el Word de Two Destination y en la hoja "Tours 2027", pero no estaba en `TOURS_PILOTO`. Es como ARCH31
sin El Chaltén: El Calafate (OD016, 2 noches) → bus a Puerto Natales el día 3 → Puerto Natales (OD017, 2 noches) →
bus a Punta Arenas el día 5.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **ARCH27 en `TOURS_PILOTO`**, armado con OD016 + bus El Calafate – Puerto Natales + OD017 | Carga `--codigos ARCH27`: "armado", 3 componentes |
| 2 | **Las reglas de ARCH31:** sin el bus Punta Arenas → Puerto Natales en OD017 (`traslados-tour.csv`); salida en bus Kupos.cl a Punta Arenas, a mano, o a pedido traslado al aeropuerto de Puerto Natales (`tramos-con-proveedor.csv`); invierno cerrado del 1/5 al 31/8 (`blackouts.csv`) | Unitarios `datos.test.ts` y `traslados.test.ts` con la fila de ARCH27 |
| 3 | **El traslado de OD016 queda:** es solo de llegada (FTE Airport → alojamiento), que es lo que dice el Word ("Airport Pick up") | Ajustes de ARCH27 en la real: solo los 2 de OD017 |
| 4 | **Kilroy lo reconoce:** HI_ARGENTINA_GLACIERS_TORRES_DEL_PAINE_5DAYS-677 = ARCH27 | Al releer DK1603956 entra ARCH27 · recibida, sin motivos |
| 5 | **Lo que ya estaba no cambia** | Suite de `src` por tandas; integraciones de tours y catálogo, de a una |

## 3. Qué queda afuera
- Los suplementos del Word (Torres Base Trek, bus de vuelta a El Calafate): se ven con la reserva si la agencia los pide.
