# Los 7 tours compuestos (M1-05)

Armé los tours top-seller con los códigos de RutasenBus y el itinerario día por día de los Word de catálogo (2026-10-06). Leí: RutasenBus2020.xls, Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx, Two Destination Tours 1 Jun 2026 - 31 Dec 2027.docx, One Destination Tours 1 Jun 2026 - 31 Dec 2027.docx, Unique Tours 1 Jun 2026 - 31 Dec 2027.docx, Construccion de Paquetes 2019 con 3 y 4 estrellas.xls.

- Armados: **7 de 7**. Para revisar: **0**.
- Cada tour guarda su secuencia: cada paquete con sus noches en el tour y el día en que empieza, y cada bus con el día en que sale y si es nocturno. Las fechas reales se calculan cuando llegue la reserva con su fecha de inicio.
- Transfer: solo la llegada del primer destino y la salida del último. Iguazú conserva los suyos aunque esté en el medio.

## Resumen

| Tour | Nombre | Noches | Estado | Paquetes | Buses que emite HI Travel | Buses con proveedor |
|---|---|---|---|---|---|---|
| CHB31 | Overland San Pedro de Atacama to Uyuni, end in La Paz | 6 | armado | OD030 → COMPBO20 | 0 | 1 |
| BOCHI04R | OVERLAND UYUNI TO SAN PEDRO DE ATACAMA BEGINNING IN LA PAZ | 6 | armado | COMPBO20 → OD030 | 0 | 1 |
| ARCH31 | Patagonia Highlights | 8 | armado | OD033 → OD016 → OD017 | 1 | 1 |
| ARCH33 | Patagonia, Trekking Paradise with W-Trek | 11 | armado | OD033 → OD016 → CH10 | 1 | 1 |
| AR09 | Patagonia Adventure Tour | 15 | armado | OD018 → OD025 → OD013 → OD022 | 5 | 0 |
| BRARCH26 | From Rio de Janeiro to Santiago de Chile | 16 | armado | OD032 → OD010A → OD018 → OD019 → OD029 | 4 | 0 |
| 5C01 | 5 Countries: Rio de Janeiro to la Paz | 29 | armado | OD032 → COMPBR10 → OD010D → OD020 → OD019 → OD029 → COMPCH01 → CHB31 → OD031 | 6 | 2 |

## Secuencia de cada tour

### CHB31 · Overland San Pedro de Atacama to Uyuni, end in La Paz (6 noches, 7 días)

Empieza en San Pedro de Atacama y termina en La Paz. Itinerario: Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx; códigos: RutasenBus, fila 814.

| Día | Qué | Noches | Transfer / quién lo reserva |
|---|---|---|---|
| 1 | **OD030** San Pedro de Atacama Explorer (San Pedro de Atacama) | 3 noches | transfer de llegada |
| 4 | **COMPBO20** Overland Tour San Pedro - Uyuni 3 dias / 2 noches en Villamar y en Salt Hostel (Uyuni) | 2 noches | transfer de salida |
| 6 | Bus Uyuni – La Paz (nocturno, llega el día 7) | — | lo reserva Imperio Inca (servicio del tour) |

### BOCHI04R · OVERLAND UYUNI TO SAN PEDRO DE ATACAMA BEGINNING IN LA PAZ (6 noches, 7 días)

Empieza en La Paz y termina en San Pedro de Atacama. Itinerario: Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx; códigos: RutasenBus, fila 841.

| Día | Qué | Noches | Transfer / quién lo reserva |
|---|---|---|---|
| 1 | Bus La Paz – Uyuni (nocturno, llega el día 2) | — | lo reserva Imperio Inca (servicio del tour) |
| 2 | **COMPBO20** Overland Tour San Pedro - Uyuni 3 dias / 2 noches en Villamar y en Salt Hostel (Uyuni) | 2 noches | transfer de llegada |
| 4 | **OD030** San Pedro de Atacama Explorer (San Pedro de Atacama) | 3 noches | transfer de salida |

### ARCH31 · Patagonia Highlights (8 noches, 9 días)

Empieza en El Chaltén y termina en Puerto Natales. Itinerario: Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx; códigos: RutasenBus, fila 344.

| Día | Qué | Noches | Transfer / quién lo reserva |
|---|---|---|---|
| 1 | **OD033** El Chalten Starter Package (El Chaltén) | 3 noches | transfer de llegada |
| 4 | Bus El Chaltén – El Calafate (diurno) | — | lo reserva Chalten Travel (servicio del tour) |
| 4 | **OD016** El Calafate Starter Package (El Calafate) | 3 noches (1 noche más que el paquete solo) | sin transfer |
| 7 | Bus El Calafate – Puerto Natales (diurno) | — | lo emite HI Travel (tarea manual) |
| 7 | **OD017** Puerto Natales & Torres del Paine Adventure (Puerto Natales) | 2 noches | transfer de salida |

- “El Calafate airport shuttle or bus to El Chalten or bus from El Calafate to El Chalten” va antes de la primera estadía y OD033 ya trae su traslado: no se carga (aunque esté en tramos-con-proveedor.csv).
- “Punta Arenas Airport Drop Off or Bus from Puerto Natales to El Calafate” va después de la última estadía: lo cubre el paquete de la punta, no se carga como tramo.

### ARCH33 · Patagonia, Trekking Paradise with W-Trek (11 noches, 12 días)

Empieza en El Chaltén y termina en Puerto Natales. Itinerario: Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx; códigos: RutasenBus, fila 317.

| Día | Qué | Noches | Transfer / quién lo reserva |
|---|---|---|---|
| 1 | **OD033** El Chalten Starter Package (El Chaltén) | 3 noches | transfer de llegada |
| 4 | Bus El Chaltén – El Calafate (diurno) | — | lo reserva Chalten Travel (servicio del tour) |
| 4 | **OD016** El Calafate Starter Package (El Calafate) | 2 noches | sin transfer |
| 6 | Bus El Calafate – Puerto Natales (diurno) | — | lo emite HI Travel (tarea manual) |
| 6 | **CH10** W Trek Standard Self Guided + Puerto Natales (6 nights) (Puerto Natales) | 6 noches | transfer de salida |

- La columna F (“PNT - PUQ”) está incluida en CH10: no es un componente propio.
- “Shuttle or bus from El Calafate Airport to El Chalten” va antes de la primera estadía y OD033 ya trae su traslado: no se carga (aunque esté en tramos-con-proveedor.csv).
- “Bus from Port of Lake Pehoe to Puerto Natales” va después de la última estadía: lo cubre el paquete de la punta, no se carga como tramo.
- “Regular Bus Puerto Natales to Punta Arenas Airport (or to Punta Arenas city) or transfer to Puerto Natales airport” va después de la última estadía: lo cubre el paquete de la punta, no se carga como tramo.

### AR09 · Patagonia Adventure Tour (15 noches, 16 días)

Empieza en Buenos Aires y termina en Ushuaia. Itinerario: Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx; códigos: RutasenBus, fila 82.

| Día | Qué | Noches | Transfer / quién lo reserva |
|---|---|---|---|
| 1 | **OD018** Buenos Aires, Tango City (Buenos Aires) | 3 noches | transfer de llegada |
| 4 | Bus Buenos Aires – Puerto Madryn (nocturno, llega el día 5) | — | lo emite HI Travel (tarea manual) |
| 5 | **OD025** Puerto Madryn, Penguins and Whales (Puerto Madryn) | 3 noches | sin transfer |
| 8 | Bus Puerto Madryn – Río Gallegos (nocturno, llega el día 9) | — | lo emite HI Travel (tarea manual) |
| 9 | Bus Río Gallegos – El Calafate (diurno) | — | lo emite HI Travel (tarea manual) |
| 9 | **OD013** El Calafate & Torres del Paine. Glaciers in Patagonia (El Calafate) | 4 noches | sin transfer |
| 13 | Bus El Calafate – Río Gallegos (diurno) | — | lo emite HI Travel (tarea manual) |
| 13 | Bus Río Gallegos – Ushuaia (diurno) | — | lo emite HI Travel (tarea manual) |
| 13 | **OD022** Ushuaia, end of the World (Ushuaia) | 3 noches | transfer de salida |

### BRARCH26 · From Rio de Janeiro to Santiago de Chile (16 noches, 17 días)

Empieza en Río de Janeiro y termina en Santiago de Chile. Itinerario: Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx; códigos: RutasenBus, fila 248.

| Día | Qué | Noches | Transfer / quién lo reserva |
|---|---|---|---|
| 1 | **OD032** Rio Starter Package (Río de Janeiro) | 3 noches | transfer de llegada |
| 4 | Bus Río de Janeiro – Iguazú (nocturno, llega el día 5) | — | lo emite HI Travel (tarea manual) |
| 5 | **OD010A** Iguazu Falls on a Shoestring Argentina (Iguazú) | 3 noches | transfer de llegada y de salida |
| 8 | Bus Iguazú – Buenos Aires (nocturno, llega el día 9) | — | lo emite HI Travel (tarea manual) |
| 9 | **OD018** Buenos Aires, Tango City (Buenos Aires) | 3 noches | sin transfer |
| 12 | Bus Buenos Aires – Mendoza (nocturno, llega el día 13) | — | lo emite HI Travel (tarea manual) |
| 13 | **OD019** Mendoza Mountains and Wineries (Mendoza) | 2 noches (1 noche menos que el paquete solo) | sin transfer |
| 15 | Bus Mendoza – Santiago de Chile (diurno) | — | lo emite HI Travel (tarea manual) |
| 15 | **OD029** Santiago de Chile Starter Package (Santiago de Chile) | 2 noches | transfer de salida |

### 5C01 · 5 Countries: Rio de Janeiro to la Paz (29 noches, 30 días)

Empieza en Río de Janeiro y termina en La Paz. Itinerario: Multi Destination Independent Tours 1 Jun 2026 - 31 Dec 2027.docx; códigos: RutasenBus, fila 621.

| Día | Qué | Noches | Transfer / quién lo reserva |
|---|---|---|---|
| 1 | **OD032** Rio Starter Package (Río de Janeiro) | 3 noches | transfer de llegada |
| 4 | Bus Río de Janeiro – São Paulo (diurno) | — | lo emite HI Travel (tarea manual) |
| 4 | **COMPBR10** Sao Paulo 2 nights Sample (São Paulo) | 2 noches | sin transfer |
| 6 | Bus São Paulo – Iguazú (nocturno, llega el día 7) | — | lo emite HI Travel (tarea manual) |
| 7 | **OD010D** Iguazu Falls Combined (2 Nts BRA + 1 Nt ARG) (Iguazú) | 3 noches | transfer de llegada y de salida |
| 10 | Bus Iguazú – Buenos Aires (nocturno, llega el día 11) | — | lo emite HI Travel (tarea manual) |
| 11 | **OD020** Buenos Aires + Uruguay (Buenos Aires) | 3 noches | sin transfer |
| 14 | Bus Buenos Aires – Mendoza (nocturno, llega el día 15) | — | lo emite HI Travel (tarea manual) |
| 15 | **OD019** Mendoza Mountains and Wineries (Mendoza) | 2 noches (1 noche menos que el paquete solo) | sin transfer |
| 17 | Bus Mendoza – Santiago de Chile (diurno) | — | lo emite HI Travel (tarea manual) |
| 17 | **OD029** Santiago de Chile Starter Package (Santiago de Chile) | 2 noches | sin transfer |
| 19 | Bus Santiago de Chile – Valparaíso (diurno) | — | se reserva a mano en Kupos.cl (sistema propio, no se le escribe) |
| 19 | **COMPCH01** Valparaiso Escapade (Valparaíso) | 2 noches | sin transfer |
| 21 | Bus Valparaíso – Calama (nocturno, llega el día 22) | — | lo emite HI Travel (tarea manual) |
| 22 | Bus Calama – San Pedro de Atacama (diurno) | — | se reserva a mano en Transvipp (sistema propio, no se le escribe) |
| 22 | **CHB31** (tour completo: Overland San Pedro de Atacama to Uyuni, end in La Paz) | 6 noches | sin transfer |
| 28 | **OD031** La Paz Bolivia Starter package (La Paz) | 2 noches | transfer de salida |

## Lo que necesito que confirmes

**Buses.** Los buses entre destinos los cargué como pasajes que emite HI Travel (no se le escribe a nadie). Si alguno lo reserva un proveedor, sumalo a `data/tramos-con-proveedor.csv`, como el Uyuni – La Paz de Imperio Inca:

- [ ] **CHB31**: ningún bus de HI Travel. En RutasenBus, las columnas sin código son: “Bus”.
- [ ] **BOCHI04R**: ningún bus de HI Travel. En RutasenBus, las columnas sin código son: “Bus”.
- [ ] **ARCH31**: El Calafate – Puerto Natales. En RutasenBus, las columnas sin código son: “FTE - PNT”.
- [ ] **ARCH33**: El Calafate – Puerto Natales. En RutasenBus, las columnas sin código son: “W Trek Refugio”, “FTE - PNT”.
- [ ] **AR09**: Buenos Aires – Puerto Madryn (nocturno); Puerto Madryn – Río Gallegos (nocturno); Río Gallegos – El Calafate; El Calafate – Río Gallegos; Río Gallegos – Ushuaia. En RutasenBus, las columnas sin código son: “Bus BUE PMY”, “Bus PMY RGL”, “BUS FTE RGL USH”, “BUS RGL FTE”.
- [ ] **BRARCH26**: Río de Janeiro – Iguazú (nocturno); Iguazú – Buenos Aires (nocturno); Buenos Aires – Mendoza (nocturno); Mendoza – Santiago de Chile. En RutasenBus, las columnas sin código son: “IGR - BUE”, “BUE MDZ”, “MDZ SCL”, “RIO IGR”.
- [ ] **5C01**: Río de Janeiro – São Paulo; São Paulo – Iguazú (nocturno); Iguazú – Buenos Aires (nocturno); Buenos Aires – Mendoza (nocturno); Mendoza – Santiago de Chile; Valparaíso – Calama (nocturno). En RutasenBus, las columnas sin código son: “IGR - BUE”, “BUE MDZ”, “MDZ SCL”, “SCL - VLP”, “VLP - CAL”, “CAL-SPA”, “RIO SAO IGR”.

**El Word.** Le faltan encabezados “DAY N:” (el texto está, pero pegado al día anterior). No cambia el armado porque las noches salen del “Included”, pero conviene corregirlo:

- [ ] **AR09**: días 3, 7.
- [ ] **BRARCH26**: día 11.
- [ ] **5C01**: día 13.

## Anexo: noches de cada paquete vendido solo

Las saqué del Excel de paquetes para controlar las anotaciones “(menos/mas N noche)” de RutasenBus.

| Paquete | Noches |
|---|---|
| OD010A | 3 |
| OD010B | 3 |
| OD010C | 3 |
| OD010D | 3 |
| OD011 | 3 |
| OD013 | 4 |
| OD016 | 2 |
| OD017 | 2 |
| OD018 | 3 |
| OD019 | 3 |
| OD020 | 3 |
| OD022 | 3 |
| OD025 | 3 |
| OD029 | 2 |
| OD030 | 3 |
| OD031 | 2 |
| OD032 | 3 |
| OD033 | 3 |
| CH10 | 6 |
| COMPCH01 | 2 |
| COMPBO20 | 2 |
| COMPBR10 | 2 |
