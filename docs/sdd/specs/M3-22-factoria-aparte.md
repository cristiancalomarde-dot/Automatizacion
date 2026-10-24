# M3-22 · El pedido de Factoria va a Factoria (no a Vértice)

**Depende de:** M3-11 (hostel según la habitación en Puerto Natales). Pedida por el owner el 2026-10-23 (feedback de
operaciones, "Vértice": `docs/sdd/diagnosticos/feedback-operaciones-2026-10-23.md`, respuesta 4).

## 1. Qué queremos lograr
Hoy el alojamiento en **Factoria** (Puerto Natales; ARCH31, CH10, CH11, ARCH33…) sale en un pedido con encabezado
**"W trek VERTICE"**, para `ventas@vertice.travel`. Ej. DK1592913 (ARCH31, sin W Trek): "Cubre OD017 · 16/03/2027".
Confunde: el pedido es de alojamiento en Factoria, no del W Trek.

El origen: en el Excel de paquetes Factoria dice "se le pide a: Vertice", y la equivalencia `PNT,Vertice → W trek
VERTICE` (`data/equivalencias-proveedores.csv`) lo manda al proveedor de Vértice.

Decisión del owner (2026-10-23): **el pedido de Factoria va al email propio de Factoria** del directorio:
"Factoria (hostel de Vertice)" — `reservas@factoriapatagonia.com` (Excel de proveedores, fila 290). El nombre de Vértice
en el Excel **no se cambia**. El W Trek que se pide a Vértice sigue yendo a Vértice.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | El alojamiento en Factoria arma su **propio pedido**, al proveedor "Factoria (hostel de Vertice)", con su email | Unitario/integración: ARCH31 como DK1592913 → un pedido a Factoria con su alojamiento; ninguno "W trek VERTICE" |
| 2 | Si el mismo paquete tiene un W Trek que va a Vértice, ese sigue yendo a Vértice, en su pedido aparte | Integración: un paquete con W Trek a Vértice + Factoria → dos pedidos |
| 3 | Vale también cuando Factoria sale elegida por M3-11 (habitación privada en Puerto Natales) | Unitario |
| 4 | La regla vive en `data/` con nota del owner, **sin recargar el catálogo en la base real** si se puede (como M3-11, que se lee al armar). Si no se puede sin recarga, frená y reportá qué haría falta correr en la real | Revisión del diff |
| 5 | Si "Factoria (hostel de Vertice)" no está en el directorio de la base, el pedido no se inventa un mail: queda como hoy con un aviso | Unitario |
| 6 | Nada más cambia | Suite existente en verde |

## 3. Qué ve el usuario
Sin pantallas nuevas: aparece un pedido "Factoria (hostel de Vertice)" en lugar de "W trek VERTICE" cuando lo que se
pide es Factoria. "Volver a armar" actualiza los borradores sin editar.

## 4. Reglas del proyecto que toca
- **#5:** terminada = las 3 verificaciones en verde. **#4:** no envía nada. **#2:** ningún mail nuevo en el código.

---

## Anexo técnico (para los agentes)
- Cómo se resuelve hoy el proveedor del pedido: `booking_supplier_id` del servicio del producto (cargado desde el
  Excel de paquetes + equivalencias). Mirá cómo M3-11 (`data/hostel-segun-habitacion.csv`) cambia el hotel al armar y
  qué proveedor le queda al elegido; probablemente el lugar más simple sea ahí o en la agrupación de pedidos por
  proveedor en `src/lib/pedidos/armar.ts`.
- Comprobá en la base de pruebas que "Factoria (hostel de Vertice)" existe en el directorio (importado del Excel de
  proveedores) y con qué nombre exacto.
- Los tests y `.env.pruebas.local` están en el clon `C:\Users\gs\dev\hi-travel-automatizacion` (hacé `git pull`
  primero; el origin es la carpeta de Drive). Después copiá los archivos tocados al árbol de Drive. Nunca la base real.
