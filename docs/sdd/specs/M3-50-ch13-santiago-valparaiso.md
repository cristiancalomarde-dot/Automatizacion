# M3-50 · CH13 en el catálogo (Santiago y Valparaíso)

**Depende de:** M3-48. Pedida por el owner el 2026-11-06. Reserva real de Kilroy en "para revisión":
`DK1599008` (id `f294f1eb-846c-468e-8e79-5fffe7bf2a82`), `HI_TRAVEL_CH13-677`, "Santiago and Valparaiso (4 nights)",
27 al 31/01/2027, 1 pax, Dormitory - Hostel.

## 1. Las fuentes
- `RutasenBus`, hoja "Tours 2027", fila 526: OD029 ("SCL 2n") y COMPCH01 ("VLP 2 n"); la columna D dice "bus esta en pkt".
  Categorías Hostel y Hotel 3\*.
- Word "Two Destination Tours": día 1 llegada y traslado privado; día 2 Bike Tour; día 3 bus a Valparaíso; día 5 bus a
  Santiago, fin del viaje (sin traslado de salida).
- OD029 y COMPCH01 **ya están en la real**: OD029 con Hostal Providencia, Bike Tour (Bicicleta Verde) y el traslado
  SCL - alojamiento (CL Mundo); COMPCH01 con La Joya Hostel y el bus Santiago - Valparaíso - Santiago (Kupos.cl).
- En seco contra la real (2026-11-06): CH13 sale "armado" sin tocar nada más.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **CH13 en `TOURS_PILOTO`** y `HI_TRAVEL_CH13-677` → CH13 en `data/codigos-kilroy.csv` | Unitario: el lector del CSV lo toma y la lista lo tiene |
| 2 | **Se arma con los archivos reales:** 4 noches, OD029 día 1 (2 n, con traslado de llegada) y COMPCH01 día 3 (2 n), sin traslado de salida | Unitario con `armarTour` y los insumos reales |
| 3 | **En seco contra la real:** `importar:tours --codigos CH13 --en-seco` | Crea CH13 y su código; ninguna fila de lo ya cargado cambia |
| 4 | **Lo que ya estaba no cambia** | Suite completa con `--maxWorkers=2` |

## 3. La carga en la real (no la hace el builder)
Con OK del owner: `importar:tours --codigos CH13` → `importar:codigos-kilroy`. No hacen falta proveedores, equivalencias
ni paquetes.

## 4. Qué queda afuera
Cambiar los paquetes OD029 o COMPCH01. BR20 va en M3-51.
