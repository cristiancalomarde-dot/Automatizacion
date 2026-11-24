# M3-62 · OD037 (Rio + Angra and Ilha Grande Day Tour) al catálogo

**Depende de:** M3-61. Pedida por el owner el 2026-11-24. Reserva real Kilroy `DK1596603` (mail uid 17532), que entró
sin producto.

## 1. Qué pasa
OD037 no estaba cargado. Su bloque está en el Excel de paquetes (fila 867, al lado de OD032): 4 noches en Río,
traslado GIG → alojamiento, Cristo e City Tour y Angra dos Reis + Ilha Grande (Rio Carioca).

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | **OD037 en `data/paquetes-piloto.csv`** con sus 2 niveles: Hostel (Cabanacopa por Local 55; Ipanema Beach, Bamboo y El Misti directos) y Hotel 3\* (Nacional Inn / Copacabana Mar, como en OD032; `niveles-confirmados.csv`) | Carga con `--codigos OD037`: 5 servicios, niveles Hostel y Hotel 3\*, todos con proveedor salvo Buzios (a mano, M3-60) |
| 2 | **"Rio Carioca" = "Rio carioca tour"** del directorio (owner) | `equivalencias-proveedores.csv`; la carga no deja proveedores sin resolver |
| 3 | **Días fijos:** Cristo e City Tour el día 2, Angra + Ilha Grande el día 3 (owner, 2026-10-23) | `dias-servicio.csv` |
| 4 | **Kilroy lo reconoce por el nombre** "Rio + Angra and Ilha Grande Day Tour (4 nights)" | `codigos-kilroy.csv`; al releer DK1596603 entra OD037 · recibida |
| 5 | **Lo que ya estaba no cambia** | Suite de `src` por tandas; integraciones de catálogo de a una (conteos de carga-paquetes: 131 equivalencias, 34 paquetes) |

## 3. Qué queda afuera
- Con "hostel OR hotel option" se pide Hostel (owner: primero hostel; si no hay lugar, se pasa a hotel a mano).
