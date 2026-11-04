# M3-48 · En seco contra la base real (2026-11-03)

Corrido con `--en-seco` (`clienteEnSeco` + `fetchSoloLectura`, sin IA) contra la base real (`uhwkifqmexdktaseaxxo`), con los
Excel y el Word copiados del Drive y los CSV del clon. **Ninguna fila cambió.** Es el estado **antes** de la carga.

## `npm run importar:paquetes -- --codigos COMPBR02,COMPBR11 --en-seco`

| Tabla | Crearía | Actualizaría | Borraría |
|---|---|---|---|
| `producto` | 2 (COMPBR02, COMPBR11) | 0 | 0 |
| `producto_servicio` | 11 | 0 | 0 |
| `codigo_externo` | 4 (HI Travel y Kilroy de cada uno) | 0 | 0 |
| `importacion` | 1 | 0 | 0 |

- COMPBR02: 4 servicios. COMPBR11: 2 servicios. Los dos con niveles Hostel y Hotel 3\*.
- IA: 0 llamadas. Otros puntos para revisar: ninguno. Códigos no encontrados: ninguno.
- **Sin resolver hoy en la real (6 nombres):** Agatha, Casa do Rio, Casa Viva, Che Lagarto, Paraty Tours, Pousada do Corsario
  Paraty. Es lo esperado antes de la ficha §5: faltan los proveedores y las equivalencias. Con ese orden, en la base de
  pruebas no queda ninguno.

## `npm run importar:tours -- --codigos BR03,BR04 --en-seco`

| Tabla | Crearía | Actualizaría | Borraría |
|---|---|---|---|
| `producto` | 2 (BR03, BR04) | 0 | 0 |
| `codigo_externo` | 2 | 0 | 0 |
| `importacion` | 1 | 0 | 0 |

- **BR03 y BR04: para revisar**, con 0 componentes y 0 servicios: este comando lee la base como está, y COMPBR02 y COMPBR11
  todavía no están en la real. Con los paquetes cargados, en la base de pruebas y con estos archivos, quedan armados: BR03 8
  noches (días 1, 4, 6, con traslados los días 4, 6 y 9) y BR04 14 noches (días 1, 5, 7, 9, 12, con buses los días 4 y 7 y
  traslados los días 9 y 12).

## Lo que ya estaba: `npm run importar:tours -- --en-seco`, sin códigos

Los 12 tours cargados salen "armado", con **0 actualizaciones y 0 borrados** en productos, componentes, servicios y ajustes,
también con el Word nuevo. Lo único que crearía son los mismos 2 productos y 2 códigos de BR03 y BR04.

## Lo que harían `importar:proveedores` e `importar:equivalencias`

Estos dos comandos no tienen modo en seco. Es una comparación de solo lectura contra la real, sin IA.

**`importar:proveedores`:** 288 proveedores en la real, 291 en el Excel. 288 quedan iguales, 0 cambiados, 0 movidos, 0
renombrados, 0 bajas, no se pierde ningún mail.

- **3 nuevos:** Casa do Rio (`casadoriohostel@gmail.com`), Hostel Agatha (WhatsApp) y Casa Viva (WhatsApp), los tres de Paraty.

**`importar:equivalencias`:** 126 filas en el CSV, 120 en la real. **6 nuevas, 0 cambiadas, 0 que sobren.** Con el directorio
ya actualizado, resuelve todas.

- Che Lagarto en Paraty y en Ilha Grande (a mano).
- Pousada do Corsario Paraty → Pousada Corsario.
- Agatha → Hostel Agatha.
- Paraty Tours en Paraty y en Ilha Grande → la fila larga de PARATY TOURS.

## Orden de la carga

Ficha §5, con el OK del owner y copiando antes los Excel del Drive. Si `importar:proveedores` no corre primero,
`importar:equivalencias` corta sin cargar nada.
