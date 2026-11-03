# M3-47 · En seco contra la base real (2026-11-03)

> **Carga hecha el 2026-11-03 con OK del owner:** proveedores 12 altas y 276 actualizados (0 bajas, 9 llamadas a IA, 0
> resueltas); equivalencias 6 nuevas; paquetes 3 productos y 13 servicios; BR18 "armado" con 3 componentes y 2 buses;
> Kilroy 1 alta (`HI_TRAVEL_BR18-677`) y 1 actualización (nombre de OD031). `importar:codigos-kilroy` se corrió con
> `--en-seco` por error: no tiene esa opción y escribió. Después, en seco, paquetes y BR18 dan 0 cambios.
> Lo que sigue abajo es el estado **antes** de la carga.

Corrido con `--en-seco` (`clienteEnSeco` + `fetchSoloLectura`, sin IA) contra la base real
(`uhwkifqmexdktaseaxxo`), con los Excel definitivos del Drive y los CSV del clon. **Ninguna fila cambió.**

## `npm run importar:paquetes -- --codigos ODBR15,COMPBR12,COMPBR04 --en-seco`

| Tabla | Crearía | Actualizaría | Borraría |
|---|---|---|---|
| `producto` | 3 (ODBR15, COMPBR04, COMPBR12) | 0 | 0 |
| `producto_servicio` | 13 | 0 | 0 |
| `codigo_externo` | 6 (HI Travel y Kilroy de cada uno) | 0 | 0 |
| `importacion` | 1 | 0 | 0 |

- ODBR15: 4 servicios. COMPBR04: 3 servicios. COMPBR12: 3 servicios. Los tres con niveles Hostel y Hotel 3\*.
- IA: 0 llamadas. Otros puntos para revisar: ninguno. Códigos no encontrados: ninguno.
- **Sin resolver hoy en la real (9 nombres):** Agencia Chapada Backpackers, Bahia Transfers, Bahiacafe, Cassi Turismo,
  HI Hostel Chapada, Hostel Laranjeiras, Hotel Terra dos Diamantes, Portal Lencois, Pousada do Pilar. Es lo esperado
  antes de la ficha §4: estos proveedores y sus equivalencias todavía no están en la real. Hay que correr
  `importar:proveedores` e `importar:equivalencias` antes; en la base de pruebas, con ese orden, no queda ninguno.

## `npm run importar:tours -- --codigos BR18 --en-seco`

| Tabla | Crearía | Actualizaría | Borraría |
|---|---|---|---|
| `producto` | 1 (BR18) | 0 | 0 |
| `codigo_externo` | 1 | 0 | 0 |
| `importacion` | 1 | 0 | 0 |

- **BR18: para revisar**, con 0 componentes y 0 servicios. Este comando lee la base tal como está, y sus tres paquetes
  todavía no están en la real: "falta el paquete ODBR15, COMPBR12 y COMPBR04". En seco no puede mostrar más hasta
  cargar los paquetes.
- Con los paquetes cargados, en la base de pruebas y con estos mismos Excel, BR18 queda armado: 7 noches, días 1, 4, 4, 7, 7.

## Lo que harían `importar:proveedores` e `importar:equivalencias`

Estos dos comandos no tienen modo en seco. Es una comparación de solo lectura contra la real, sin IA.

**`importar:proveedores`:** 276 proveedores en la real, 288 en el Excel. No se pierde ningún mail y no borra ninguna fila.

- **12 nuevos:** Che Lagarto Paraty, Che Lagarto Ilha Grande, Laranjeiras Hostel, Pousada do Pilar, Bahiacafe,
  Bahia Transfers, Cassi Turismo, HI Hostel Chapada, Chapada Backpackers, Hotel Terra dos Diamantes, Portal Lencois y
  Chapada Backpackers (Tour 4Ps e Vale do Pati Trek). Los dos Che Lagarto dicen "n/a" en el Excel y esa celda la decide
  la IA, así que su resultado se ve recién en la carga.
- **12 cambiados.** Cuatro en contacto, ciudad o nombre:
  - Merit Montevideo: sin mail → `reservas@amerian.com`.
  - Holandes Hostel (Ilha Grande): sin mail → `reservas@holandeshostel.com.br`.
  - Asalem: ciudad ANGRA DOS REIS → ILHA GRANDE, y estrellas 3\* → 3\* sup.
  - PARATY TOURS: el nombre se alarga con la descripción de sus traslados.
- **Los otros 8 cambian solo aclaraciones:** Darwin, Pristine Patagonia, Casa de la Patagonia, Rio by bike,
  Rio carioca tour, Pousada Naturalia, Pousada rubi y Pousada Aquarela do Mar.
- **264 quedan iguales** en sus datos. Bajas: 0.
- Merit, Holandes, Asalem y PARATY TOURS no tienen hoy servicios ni equivalencias en la real.

**`importar:equivalencias`:** 120 filas en el CSV, 114 en la real. **6 nuevas, 0 cambiadas, 0 que sobren.** Con el
directorio ya actualizado, resuelve todas.

- Plataforma10 en SSA y en CHAP (a mano).
- Hostel Laranjeiras → Laranjeiras Hostel.
- Bahia Transfers y Cassi Turismo → sus filas del directorio.
- Agencia Chapada Backpackers → Chapada Backpackers (Tour 4Ps e Vale do Pati Trek).

## Orden de la carga

Ficha §4, con el OK del owner. Si `importar:proveedores` no corre primero, `importar:equivalencias` corta sin cargar nada.
