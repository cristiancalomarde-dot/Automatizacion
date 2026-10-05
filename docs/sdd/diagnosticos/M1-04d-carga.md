# Carga de los paquetes de los 7 tours (M1-04d)

Cargué en el sistema los paquetes de un destino de los 7 tours desde **Construccion de Paquetes 2019 con 3 y 4 estrellas.xls** (2026-10-05). Cada servicio de cada paquete ya sabe a qué proveedor pedírselo, salvo los de la lista de abajo.

- Paquetes: 17. Servicios (cada opción de hotel o excursión cuenta una vez): 146.
- Con proveedor y mail: **126**.
- Por WhatsApp (el pedido lo hace una persona): **13**.
- Manuales, no se le escribe a nadie (pasajes en Kupos.cl): **2**.
- Sin resolver: **2**; y 3 con proveedor pero sin mail ni WhatsApp.

## Por paquete

| Paquete | Destino | Servicios | Con mail | WhatsApp | Manual | Sin resolver | Sin contacto |
|---|---|---|---|---|---|---|---|
| OD013 | FTE | 12 | 12 | 0 | 0 | 0 | 0 |
| OD016 | FTE | 11 | 11 | 0 | 0 | 0 | 0 |
| OD017 | PNT | 11 | 10 | 0 | 1 | 0 | 0 |
| OD018 | BUE | 14 | 14 | 0 | 0 | 0 | 0 |
| OD019 | MDZ | 6 | 4 | 1 | 0 | 1 | 0 |
| OD020 | BUE | 14 | 13 | 0 | 0 | 0 | 1 |
| OD022 | USH | 11 | 10 | 0 | 0 | 0 | 1 |
| OD025 | PMY | 10 | 8 | 2 | 0 | 0 | 0 |
| OD029 | SCL | 7 | 7 | 0 | 0 | 0 | 0 |
| OD030 | SPA | 6 | 3 | 2 | 0 | 0 | 1 |
| OD031 | LPB | 4 | 0 | 4 | 0 | 0 | 0 |
| OD032 | RIO | 9 | 7 | 2 | 0 | 0 | 0 |
| OD033 | CHA | 12 | 12 | 0 | 0 | 0 | 0 |
| CH10 | PNT | 9 | 9 | 0 | 0 | 0 | 0 |
| COMPCH01 | VLP | 5 | 4 | 0 | 1 | 0 | 0 |
| COMPBO20 | UYU | 1 | 0 | 1 | 0 | 0 | 0 |
| COMPBR10 | SAO | 4 | 2 | 1 | 0 | 1 | 0 |

## Lo que sigue sin resolver

Estos servicios todavía no saben a quién escribirle. Cuando completes el dato en el Excel de proveedores, alcanza con volver a correr la importación.

- [ ] **OD019** (fila 83): 4* NH Cordillera → «NH Cordillera». Falta el mail: el owner lo está averiguando.
- [ ] **OD020** (fila 500): Colonia Day Trip Circuito Historico → «Buquebus». "Buquebus" está en el directorio sin mail ni WhatsApp.
- [ ] **OD022** (fila 136): Antarctica Hostel → «Antarctica Hostel». "Antarctica Hostel" está en el directorio sin mail ni WhatsApp.
- [ ] **OD030** (fila 808): in CJC - Accommodation in San Pedro de Atacama → «Transvipp». "TRANSVIP" está en el directorio sin mail ni WhatsApp.
- [ ] **COMPBR10** (fila 2671): O Hostel GRU → «O Hostel GRU». "O Hostel GRU" no está en el directorio ni en las equivalencias de SAO.

## Otros puntos para revisar

- [ ] OD030 (fila 801): el alojamiento “Accommodation: Hotel Don Raul / La Casa de Don Tomas. Booking Suplier: Hotel Don Raul / La Casa de Don Tomas” no dice su categoría (Hostel, Budget, 3*, 4*).
- [ ] COMPBR10 (fila 2676): el alojamiento “Accommodation: Soos Hotel Collection / Nacionalinn Jaragua Sao Paulo. Booking Supplier: Sooz Hotel / Nacionalinn” no dice su categoría (Hostel, Budget, 3*, 4*).
- [ ] COMPBR10: la tabla de precios nombra “Hotel 3*”, que podría ser uno de los alojamientos sin categoría.

## Detalle: servicio → nivel → opción → a quién se le pide → contacto

### OD013 · El Calafate & Torres del Paine. Glaciers in Patagonia

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 216 | alojamiento | Hostel | 1 | Hostel del Glaciar Pioneros | Del Glaciar | Del Glaciar / Juan Pablo | reservas@glaciar.com |
| 216 | alojamiento | Hostel | 2 | Calafate Hostel | Always Glaciers | ALWAYS Glaciers | calafatehostel@alwaysglaciers.com |
| 221 | alojamiento | Budget Hotel | 1 | Budget Hotel Del Glaciar Libertador | Del Glaciar | Del Glaciar / Juan Pablo | reservas@glaciar.com |
| 221 | alojamiento | Budget Hotel | 2 | Hosteria HI | Always Glaciers | ALWAYS Glaciers | calafatehostel@alwaysglaciers.com |
| 221 | alojamiento | Budget Hotel | 3 | Puerto San Julian | Patagonian Group | Hosteria Fitz roy | info@patagoniangroup.com.ar |
| 226 | alojamiento | Hotel 3* | 1 | Holtel 3* Rincon del Calafate | Tremun | Rincon del calafate | reservas@rincondelcalafate.com.ar |
| 226 | alojamiento | Hotel 3* | 2 | Hotel * Sent Calafate | Tremun | Sent | reservas@sentcalafate.com.ar |
| 231 | alojamiento | Hotel 4* | 1 | Hotel 4* Mirador del Lago | Tremun | Mirador del Lago | reservas@miradordellago.com.ar |
| 231 | alojamiento | Hotel 4* | 2 | Hotel 4* Calafate Parque | Tremun | Calafate Parque | reservas@calafateparquehotel.com.ar |
| 238 | traslado | — | 1 | Round Trip | Chalten Travel | Chalten Travel | agencias@chaltentravel.com |
| 239 | excursion | — | 1 | Perito Moreno Glaciar Excursion | Chalten Travel | Chalten Travel | agencias@chaltentravel.com |
| 240 | excursion | — | 1 | Torres del Paine Full Day from El Calafate | South Road | South Road | contacto@southroad.com.ar, bue@southroad.com.ar |

### OD016 · El Calafate Starter Package

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 216 | alojamiento | Hostel | 1 | Hostel del Glaciar Pioneros | Del Glaciar | Del Glaciar / Juan Pablo | reservas@glaciar.com |
| 216 | alojamiento | Hostel | 2 | Calafate Hostel | Always Glaciers | ALWAYS Glaciers | calafatehostel@alwaysglaciers.com |
| 221 | alojamiento | Budget Hotel | 1 | Budget Hotel Del Glaciar Libertador | Del Glaciar | Del Glaciar / Juan Pablo | reservas@glaciar.com |
| 221 | alojamiento | Budget Hotel | 2 | Hosteria HI | Always Glaciers | ALWAYS Glaciers | calafatehostel@alwaysglaciers.com |
| 221 | alojamiento | Budget Hotel | 3 | Puerto San Julian | Patagonian Group | Hosteria Fitz roy | info@patagoniangroup.com.ar |
| 226 | alojamiento | Hotel 3* | 1 | Holtel 3* Rincon del Calafate | Tremun | Rincon del calafate | reservas@rincondelcalafate.com.ar |
| 226 | alojamiento | Hotel 3* | 2 | Hotel * Sent Calafate | Tremun | Sent | reservas@sentcalafate.com.ar |
| 231 | alojamiento | Hotel 4* | 1 | Hotel 4* Mirador del Lago | Tremun | Mirador del Lago | reservas@miradordellago.com.ar |
| 231 | alojamiento | Hotel 4* | 2 | Hotel 4* Calafate Parque | Tremun | Calafate Parque | reservas@calafateparquehotel.com.ar |
| 238 | traslado | — | 1 | El Calafate Accommodation - FTE Airport | Chalten Travel | Chalten Travel | agencias@chaltentravel.com |
| 239 | excursion | — | 1 | Perito Moreno Glaciar Excursion | Chalten Travel | Chalten Travel | agencias@chaltentravel.com |

### OD017 · Puerto Natales & Torres del Paine Adventure

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 731 | alojamiento | Hostel | 1 | Puma Hostel | Puma Hostel | Puma House | info@pumahouse.com |
| 731 | alojamiento | Hostel | 2 | Last Hope | Last Hope | Last Hope | hostel.last.hope@gmail.com |
| 731 | alojamiento | Hostel | 3 | Factoria | Vertice | W trek VERTICE | ventas@vertice.travel |
| 737 | alojamiento | Hotel 3* | 1 | Big Sur | Big Sur | Hotel big sur | reservas@hotelbigsur.cl |
| 737 | alojamiento | Hotel 3* | 2 | Loreto Belen | Loreto Belen | LORETO BELEN | reservas@loretobelen.cl |
| 737 | alojamiento | Hotel 3* | 3 | Darwin | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |
| 737 | alojamiento | Hotel 3* | 4 | Pristine Patagonia | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |
| 737 | alojamiento | Hotel 3* | 5 | Vendaval | Vendaval | Hotel Vendaval | oalarcon@hotelvendaval.com |
| 743 | bus | — | 1 | Punta Arenas - Puerto Natales | Kupos | — | manual (no se le escribe) |
| 744 | excursion | — | 1 | Torres del Paine Full Day from Puerto Natales | Patagonia Planet | Patagonia planet | excursiones@patagoniaplanet.com |
| 745 | excursion (opcional) | — | 1 | Base Torres Trek no food | Patagonia Planet | Patagonia planet | excursiones@patagoniaplanet.com |

### OD018 · Buenos Aires, Tango City

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 482 | alojamiento | Hostel | 1 | Milhouse Avenue | Milhouse | Milhouse Avenue Hostel | melina@milhousehostel.com |
| 486 | alojamiento | Budget Hotel | 1 | Merit San Telmo | Merit | Merit San Telmo | reservas@amerian.com, recepcionmba@merithoteles.com.ar |
| 486 | alojamiento | Budget Hotel | 2 | Loi Flats | Loi Suites | Loi flats buenos aires | reservas@loisuites.com.ar, reservasbue@loiflats.com.ar |
| 486 | alojamiento | Budget Hotel | 3 | Rochester Concept | Rochester | Rochester Concept | reservas.concept@rochester-hotel.com |
| 489 | alojamiento | Hotel 3* | 1 | Dazzler Maipu | Dazzler | Reservas Dazzler Maipu' | reservas@dazzlermaipu.com |
| 489 | alojamiento | Hotel 3* | 2 | San Martin | Dazzler | Dazzler San Martin | reservas@dazzlersanmartin.com |
| 489 | alojamiento | Hotel 3* | 3 | Patios de San Telmo | Up Hoteles | Patios San Telmo | ventas@uphoteles.com, info@patiosdesantelmo.com.ar |
| 492 | alojamiento | Hotel 4* | 1 | Hotel Grand Brizo | Alvarez Arguelles | Hotel Grand Brizo Buenos Aires | reservas.ba@grandbrizohoteles.com |
| 492 | alojamiento | Hotel 4* | 2 | Gran Brizo Bel Air | Alvarez Arguelles | Hotel Grand Brizo Buenos Aires | reservas.ba@grandbrizohoteles.com |
| 492 | alojamiento | Hotel 4* | 3 | NH Buenos Aires City | NH City | Hotel Nh City | rsv.nhcity@nh-hotels.com, reservas@minor-hotels.com |
| 498 | excursion | — | 1 | City Tour | Grupo Summa | Grupo Summa | reservas@gruposumma.tur.ar |
| 498 | excursion | — | 2 | Bike Tour | La Bicicleta Naranja | La Bicicleta Naranja | info@labicicletanaranja.com.ar |
| 499 | traslado | — | 1 | EZE o AEP - Hotel - EZE o AEP | Greeters | GREETERS | info@greetersba.com |
| 500 | excursion | — | 1 | Tango Show with dinner, drinks and transfers | Madero Tango | Madero tango | reservas@maderotango.com.ar |

### OD019 · Mendoza Mountains and Wineries

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 75 | alojamiento | Hostel | 1 | Lagares Hostel | Lagares Hostel | Hostel Lagares Mendoza | WhatsApp |
| 79 | alojamiento | Hotel 3* | 1 | 3* Hotel Argentino | Hotel Argentino Mendoza | Argentino Hotel | info@argentino-hotel.com.ar |
| 83 | alojamiento | Hotel 4* | 1 | 4* NH Cordillera | NH Cordillera | — | **sin resolver** |
| 83 | alojamiento | Hotel 4* | 2 | Hotel MOD | Hotel MOD | Mod Hotel | reservas@the-mod.com |
| 89 | traslado | — | 1 | Remis Mendoza | Remis Mendoza | Remis Mendoza | info@mendozaremis.com |
| 90 | excursion | — | 1 | Bodegas half Day and Alta Montaña | Huentata | Huentata | ventas2@huentata.tur.ar, ventas@huentata.tur.ar |

### OD020 · Buenos Aires + Uruguay

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 482 | alojamiento | Hostel | 1 | Milhouse Avenue | Milhouse | Milhouse Avenue Hostel | melina@milhousehostel.com |
| 486 | alojamiento | Budget Hotel | 1 | Merit San Telmo | Merit | Merit San Telmo | reservas@amerian.com, recepcionmba@merithoteles.com.ar |
| 486 | alojamiento | Budget Hotel | 2 | Loi Flats | Loi Suites | Loi flats buenos aires | reservas@loisuites.com.ar, reservasbue@loiflats.com.ar |
| 486 | alojamiento | Budget Hotel | 3 | Rochester Concept | Rochester | Rochester Concept | reservas.concept@rochester-hotel.com |
| 489 | alojamiento | Hotel 3* | 1 | Dazzler Maipu | Dazzler | Reservas Dazzler Maipu' | reservas@dazzlermaipu.com |
| 489 | alojamiento | Hotel 3* | 2 | San Martin | Dazzler | Dazzler San Martin | reservas@dazzlersanmartin.com |
| 489 | alojamiento | Hotel 3* | 3 | Patios de San Telmo | Up Hoteles | Patios San Telmo | ventas@uphoteles.com, info@patiosdesantelmo.com.ar |
| 492 | alojamiento | Hotel 4* | 1 | Hotel Grand Brizo | Alvarez Arguelles | Hotel Grand Brizo Buenos Aires | reservas.ba@grandbrizohoteles.com |
| 492 | alojamiento | Hotel 4* | 2 | Gran Brizo Bel Air | Alvarez Arguelles | Hotel Grand Brizo Buenos Aires | reservas.ba@grandbrizohoteles.com |
| 492 | alojamiento | Hotel 4* | 3 | NH Buenos Aires City | NH City | Hotel Nh City | rsv.nhcity@nh-hotels.com, reservas@minor-hotels.com |
| 498 | excursion | — | 1 | City Tour | Grupo Summa | Grupo Summa | reservas@gruposumma.tur.ar |
| 498 | excursion | — | 2 | Bike Tour | La Bicicleta Naranja | La Bicicleta Naranja | info@labicicletanaranja.com.ar |
| 499 | traslado | — | 1 | EZE o AEP - Hotel - EZE o AEP | Greeters | GREETERS | info@greetersba.com |
| 500 | excursion | — | 1 | Colonia Day Trip Circuito Historico | Buquebus | Buquebus | **sin mail ni WhatsApp** |

### OD022 · Ushuaia, end of the World

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 136 | alojamiento | Hostel | 1 | Anum Hostel | Anum Hostel | Anum Hostel | reservas@anum-travel.com |
| 136 | alojamiento | Hostel | 2 | Antarctica Hostel | Antarctica Hostel | Antarctica Hostel | **sin mail ni WhatsApp** |
| 141 | alojamiento | Hotel 3* | 1 | Hotel 3* Los Naranjos | Los Naranjos | Los naranjos | reservas@losnaranjosushuaia.com |
| 141 | alojamiento | Hotel 3* | 2 | Hotel 3* Altos de Ushuaia | Altos de Ushuaia | Altos Ushuaia | altosushuaiahotel@gmail.com |
| 144 | alojamiento | Hotel 4* | 1 | Hotel 4*Albatros | Albatros | albatros hotel ushuaia | reservas1@albatroshotel.com.ar |
| 144 | alojamiento | Hotel 4* | 2 | Hotel 4* Los Acebos | Tremun | Las Hayas y los Acebos | reservas.ushuaia@tremunhoteles.com.ar |
| 144 | alojamiento | Hotel 4* | 3 | Hotel 4* Las Hayas | Tremun | Las Hayas y los Acebos | reservas.ushuaia@tremunhoteles.com.ar |
| 150 | traslado | — | 1 | Round Trip: Rumbo Sur | Rumbo Sur | Rumbo sur | emiliao@rumbosur.com.ar |
| 151 | excursion | — | 1 | Beagle Channel Boat Trip, 3 hours, no transfer to port | Rumbo Sur | Rumbo sur | emiliao@rumbosur.com.ar |
| 153 | excursion | — | 1 | Tierra del Fuego National Park half Day | Rumbo Sur | Rumbo sur | emiliao@rumbosur.com.ar |
| 154 | excursion (opcional) | — | 1 | Parque Nacional Tierra del Fuego c/ trekking y canoa | Canal Fun | Canal Fun | mail@canalfun.com |

### OD025 · Puerto Madryn, Penguins and Whales

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 658 | alojamiento | Hostel | 1 | La Tosca | La Tosca | La Tosca | WhatsApp |
| 658 | alojamiento | Hostel | 2 | El Gualicho | El Gualicho | El Gualicho | info@elgualicho.com.ar |
| 658 | alojamiento | Hostel | 3 | Amonite | Amonite | Amonite | WhatsApp |
| 662 | alojamiento | Hotel 3* | 1 | Hotel 3* Tolosa | Hotel 3* Tolosa | Hotel Tolosa | tolosa@hoteltolosa.com.ar |
| 666 | alojamiento | Hotel 4* | 1 | Hotel 4* Dazzler Puerto Madryn | Hotel 4* Dazzler Puerto Madryn | Dazzler Puerto Madryn | reservas@dazzlerpuertomadryn.com |
| 666 | alojamiento | Hotel 4* | 2 | Piren | Piren | Hotel Pirén | reservas@hotelpiren.com.ar |
| 672 | traslado | — | 1 | REL - accommodation | All Peninsula | Peninsula valdes | agencia@allpeninsulavaldes.com |
| 673 | excursion | — | 1 | Peninsula Valdes Full Day | All Peninsula | Peninsula valdes | agencia@allpeninsulavaldes.com |
| 674 | excursion (opcional) | — | 1 | Whale Watching 1 June - 30 Nov | All Peninsula | Peninsula valdes | agencia@allpeninsulavaldes.com |
| 675 | excursion (opcional) | — | 1 | Pinguinera + Gaiman 1 Sepiembre a 28 Febrero | All Peninsula | Peninsula valdes | agencia@allpeninsulavaldes.com |

### OD029 · Santiago de Chile Starter Package

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 577 | alojamiento | Hostel | 1 | Hostal Providencia | Hostal Providencia | Hostal providencia | admin@hostalprovidencia.com |
| 582 | alojamiento | Hotel 3* | 1 | Hostal Rio Amazonas | Hostal Rio Amazonas | Hostal rio amazonas | reservas@hostalrioamazonas.cl |
| 582 | alojamiento | Hotel 3* | 2 | Hotel 3* Elisa Cole | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |
| 585 | alojamiento | Hotel 3* | 1 | Hotel Diego de Velazquez | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |
| 585 | alojamiento | Hotel 3* | 2 | NH Santiago | NH | Hotel NH Santiago | gabriela@clmundo.cl |
| 591 | excursion | — | 1 | Bike Tour | Bicicleta Verde | Bicicleta verde | antonio@labicicletaverde.com |
| 592 | traslado | — | 1 | SCL - accommodation | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |

### OD030 · San Pedro de Atacama Explorer

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 796 | alojamiento | Hostel | 1 | San Pedro Backpackers | San Pedro Backpackers | Backpacker San Pedro Hostel | WhatsApp |
| 796 | alojamiento | Hostel | 2 | Aji Verde | Avi Verde | Aji Verde | WhatsApp |
| 801 | alojamiento | — | 1 | Hotel Don Raul | Hotel Don Raul | Hotel don raul | reservas@donraul.cl |
| 801 | alojamiento | — | 2 | La Casa de Don Tomas | La Casa de Don Tomas | Hotel La Casa de Don Tomas | reservas@dontomas.cl |
| 808 | traslado | — | 1 | in CJC - Accommodation in San Pedro de Atacama | Transvipp | TRANSVIP | **sin mail ni WhatsApp** |
| 809 | excursion | — | 1 | Geisers del Tatio | Horizonte Atacama | Horizonte atacama | horizonteatacamareserva@gmail.com |

### OD031 · La Paz Bolivia Starter package

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 1087 | alojamiento | Hostel | 1 | The Adventure Brew Hostel | The Adventure Brew Hostel | Adventure Brew Hostel | WhatsApp |
| 1091 | alojamiento | Budget Hotel | 1 | Hotel Sagarnaga | Imperio Inca | Imperio Inca | WhatsApp |
| 1097 | traslado | — | 1 | La Paz Airport - La Paz Accommodation | Imperio Inca | Imperio Inca | WhatsApp |
| 1098 | excursion | — | 1 | Tiwanaco | Imperio Inca | Imperio Inca | WhatsApp |

### OD032 · Rio Starter Package

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 869 | alojamiento | Hostel | 1 | Cabanacopa Hostel | Local 55 | Rodrigo Perez | perez@local55.com |
| 869 | alojamiento | Hostel | 2 | Ipanema Beach Hostel | Ipanema Beach Hostel | Ipanema Beach Hostel | info@hostelipanemabeach.com |
| 869 | alojamiento | Hostel | 3 | Bamboo Rio Hostel | Bamboo Rio Hostel | Bamboo Hostel Rio | WhatsApp |
| 869 | alojamiento | Hostel | 4 | El Misti Ipanema | El Misti Ipanema | El Misti Hostel Ipanema | info@elmistihostels.com |
| 875 | alojamiento | Hostel | 1 | National Inn Copacabana | Nacional Inn | Nacional inn Copacabana | reservas@nacionalinncopacabana.com.br, rio.lazer@nacionalinn.com |
| 875 | alojamiento | Hostel | 2 | Copacabana Mar Hostel | Copacabana Mar | Copacabana Mar hotel | reserva@copacabanamar.com.br |
| 881 | traslado | — | 1 | GIG - Accommodation in Rio | Buzios Transfers | buzios transfer | buziostransfer@hotmail.com |
| 881 | traslado | — | 2 | GIG - Accommodation in Rio | Alex | Alex | WhatsApp |
| 882 | excursion | — | 1 | Big Dude | Local 55 | Rodrigo Perez | perez@local55.com |

### OD033 · El Chalten Starter Package

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 1029 | alojamiento | Hostel | 1 | Rancho Grande | Chalten Travel | Chalten Travel | agencias@chaltentravel.com |
| 1029 | alojamiento | Hostel | 2 | Pioneros del Valle | Pioneros del Valle | Pioneros del valle | reservas@pionerosdelvalle.com.ar |
| 1029 | alojamiento | Hostel | 3 | Patagonia | Patagonia | Patagonia Hostel El Chalten | patagoniahostel.agencias@gmail.com |
| 1034 | alojamiento | Budget Hotel | 1 | Kau Si Aike | Kau Si Aike | Kau si ake | hosteriakausiaike@gmail.com |
| 1034 | alojamiento | Budget Hotel | 2 | Poincenot | Chalten Travel | Chalten Travel | agencias@chaltentravel.com |
| 1034 | alojamiento | Budget Hotel | 3 | Fitz Roy | Patagonian Group | Hosteria Fitz roy | info@patagoniangroup.com.ar |
| 1034 | alojamiento | Budget Hotel | 4 | Vertical Lodge | Patagonian Group | Hosteria Fitz roy | info@patagoniangroup.com.ar |
| 1034 | alojamiento | Budget Hotel | 5 | El Paraiso | Patagonian Group | Hosteria Fitz roy | info@patagoniangroup.com.ar |
| 1038 | otro (opcional) | — | 1 | 2nd Night at Fitz Camp | Receptivo Chalten | Fitz Camp / Receptivo Chalten | info@receptivochalten.com |
| 1042 | traslado | — | 1 | El Calafate Airport to El Chalten | Chalten Travel | Chalten Travel | agencias@chaltentravel.com |
| 1042 | traslado | — | 2 | El Calafate Airport to El Chalten | Transporte Las Lengas | Las Lengas | info@lengas.com |
| 1043 | bus | — | 1 | El Chalten Bus Station - El Calafate Bus Station | Chalten Travel | Chalten Travel | agencias@chaltentravel.com |

### CH10 · W Trek Standard Self Guided + Puerto Natales (6 nights)

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 1149 | alojamiento | Hostel | 1 | Puma Hostel | Puma Hostel | Puma House | info@pumahouse.com |
| 1149 | alojamiento | Hostel | 2 | Last Hope | Last Hope | Last Hope | hostel.last.hope@gmail.com |
| 1149 | alojamiento | Hostel | 3 | Factoria | Vertice | W trek VERTICE | ventas@vertice.travel |
| 1153 | alojamiento | Hotel 3* | 1 | Big Sur | Big Sur | Hotel big sur | reservas@hotelbigsur.cl |
| 1153 | alojamiento | Hotel 3* | 2 | Loreto Belen | Loreto Belen | LORETO BELEN | reservas@loretobelen.cl |
| 1153 | alojamiento | Hotel 3* | 3 | Darwin | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |
| 1153 | alojamiento | Hotel 3* | 4 | Pristine Patagonia | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |
| 1153 | alojamiento | Hotel 3* | 5 | Vendaval | Vendaval | Hotel Vendaval | oalarcon@hotelvendaval.com |
| 1158 | otro | — | 1 | W Trek Standard | Las Torres | W trek LAS TORRES | carmen.munoz@lastorres.com |

### COMPCH01 · Valparaiso Escapade

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 1592 | alojamiento | Hostel | 1 | La Joya Hostel | La Joya Hostel | La joya hostel | esteban@lajoyahostel.com |
| 1598 | alojamiento | Hotel 3* | 1 | Ibis Valparaiso | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |
| 1598 | alojamiento | Hotel 3* | 2 | Gervasoni | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |
| 1598 | alojamiento | Hotel 3* | 3 | A Contraluz | CL Mundo | Cl mundo | gabriela@clmundo.cl, luzmaria@clmundo.cl |
| 1604 | bus | — | 1 | Santiago - Valparaiso - Santiago | Kupos.cl | — | manual (no se le escribe) |

### COMPBO20 · Overland Tour San Pedro - Uyuni 3 dias / 2 noches en Villamar y en Salt Hostel

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 849 | otro | — | 1 | Overland San Pedro de Atacama to Uyuni | Imperio Inca | Imperio Inca | WhatsApp |

### COMPBR10 · Sao Paulo 2 nights Sample

| Fila | Servicio | Nivel | Opción | Hotel / servicio | Se le pide a | Proveedor del directorio | Contacto |
|---|---|---|---|---|---|---|---|
| 2671 | alojamiento | Hostel | 1 | Fujima Hostel | Fujima Hostel | Fujima Hostel | WhatsApp |
| 2671 | alojamiento | Hostel | 2 | O Hostel GRU | O Hostel GRU | — | **sin resolver** |
| 2676 | alojamiento | — | 1 | Soos Hotel Collection | Sooz Hotel | sooz hotel | saopaulo@soozhotel.com |
| 2676 | alojamiento | — | 2 | Nacionalinn Jaragua Sao Paulo | Nacionalinn | Nacional Inn Jaragua Sao Paulo | rio.lazer@nacionalinn.com |
