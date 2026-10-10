# Recarga del directorio de proveedores

Recargué el directorio desde **Proveedores Hi Travel 2026 para IA.xlsx** (2026-10-10). Leí 262 proveedores: 5 nuevos y 257 que ya estaban (con sus datos al día).

## Qué cambió

- **Nuevo:** Hosteria Puerto San Julian, proveedor Patagonian Group (CALAFATE), mail info@patagoniangroup.com.ar.
- **Nuevo:** Hosteria Tierra Tehuelche, proveedor Patagonian Group (CALAFATE), mail info@patagoniangroup.com.ar.
- **Nuevo:** Hosteria Glaciares de la Patagonia, proveedor Patagonian Group (CALAFATE), mail info@patagoniangroup.com.ar.
- **Nuevo:** Patagon Hotel, proveedor Patagonian Group (CALAFATE), mail info@patagoniangroup.com.ar.
- **Nuevo:** NH Cordillera (MENDOZA), mail lb.ermocida@minor-hotels.com.
- **Cambió de nombre:** “Vertical Lodge” ahora es “Vertical Lodge, proveedor Patagonian Group” (EL CHALTEN, mismo mail). Lo actualicé; los servicios que lo usaban siguen apuntándole.
- **Cambió de nombre:** “Hosteria Fitz roy” ahora es “Hosteria Fitz roy, proveedor Patagonian Group” (EL CHALTEN, mismo mail). Lo actualicé; los servicios que lo usaban siguen apuntándole.
- **Cambió de nombre:** “Hosteria El Paraiso” ahora es “Hosteria El Paraiso, proveedor Patagonian Group” (EL CHALTEN, mismo mail). Lo actualicé; los servicios que lo usaban siguen apuntándole.
- **Cambió el contacto:** Copacabana Mar hotel (BRASIL): antes mail reserva@copacabanamar.com.br, ahora mail romulo.santos@hotelbb.com, vera.reis@hotelbb.com.

## Ya no están en el Excel

- Ninguno: todo lo que está en la base sigue en el Excel.

## Borrados con tu OK

- Selina La Paz: no está en el Excel ni volvió a la base.
- Salar andino (BOLIVIA): no está en el Excel ni volvió a la base.
- calten tour / ALWAYS (CALAFATE): no está en el Excel ni volvió a la base.
- Juan pablo (CALAFATE): no está en el Excel ni volvió a la base.
- Buenavista Chalten (CHALTEN): no está en el Excel ni volvió a la base.
- Chalten Suites (CHALTEN): no está en el Excel ni volvió a la base.
- Chalten Travel (CHALTEN): no está en el Excel ni volvió a la base.
- Cintia (CHALTEN): no está en el Excel ni volvió a la base.
- Cumbres Nevadas (CHALTEN): no está en el Excel ni volvió a la base.
- Desierto Suites o en NB Mountain (CHALTEN): no está en el Excel ni volvió a la base.
- Hostería Altas Cumbres (CHALTEN): no está en el Excel ni volvió a la base.
- Hosteria Fitz roy (CHALTEN): no está en el Excel ni volvió a la base.
- Hotel kaulem (CHALTEN): no está en el Excel ni volvió a la base.
- Kau si ake (CHALTEN): no está en el Excel ni volvió a la base.
- Las Lengas (CHALTEN): no está en el Excel ni volvió a la base.
- Los Cerros Boutique Hotel (CHALTEN): no está en el Excel ni volvió a la base.
- Mermoz (CHALTEN): no está en el Excel ni volvió a la base.
- Panorama aparts (CHALTEN): no está en el Excel ni volvió a la base.
- Patagonia travellers hostel (CHALTEN): no está en el Excel ni volvió a la base.
- Pioneros del valle (CHALTEN): no está en el Excel ni volvió a la base.
- Poincenot (CHALTEN): no está en el Excel ni volvió a la base.
- Posada San Antonio El chalten (CHALTEN): no está en el Excel ni volvió a la base.
- Senderos Apart (CHALTEN): no está en el Excel ni volvió a la base.
- Vertical Lodge (CHALTEN): no está en el Excel ni volvió a la base.
- Cuenca del Plata, (IGUAZU): no está en el Excel ni volvió a la base.
- Cuenca del Plata, + (IGUAZU): no está en el Excel ni volvió a la base.
- [ ] **Hosteria Fitz roy** (EL CHALTEN) volvió a aparecer en el Excel: no lo cargué (Fila suelta duplicada de "Hosteria Fitz roy, proveedor Patagonian Group" (fila 119 del Excel); el owner pidió borrarla). Si tiene que volver, sacalo de `data/proveedores-borrados.csv`.

## Lo que no cierra

**Sin contacto (26):** no tienen mail ni WhatsApp en el Excel. Si alguno se usa en un producto, ese pedido no se puede mandar.

- Central de Reservas (ARECO)
- Refugio San Martin (BARILOCHE)
- TANGOINN CLUB HOTEL (BARILOCHE)
- Tangoinn Downtown (BARILOCHE)
- Buquebus (BUENOS AIRES)
- Altalaluna Boutique Hotel (CAFAYATE)
- Finca el recreo (CAFAYATE)
- Jorge - Cabalgatas en patios (CAFAYATE)
- Mirador del Valle (CAFAYATE)
- Rochester Calafate (CALAFATE)
- Desierto Suites o en NB Mountain (EL CHALTEN)
- Los Cerros Boutique Hotel (EL CHALTEN)
- Posada San Antonio El chalten (EL CHALTEN)
- Holandes Hostel (ILHA GRANDE)
- Pousada Dom Angelo (PARATY)
- Hosteria aguas coloradas (PURMAMARCA)
- Avis (RENT A CAR)
- Selina salta (SALTA)
- Backpackers San Pedro (SAN PEDRO DE ATACAMA)
- TRANSVIP (SAN PEDRO DE ATACAMA)
- More SP (SAO PAULO)
- Hotel vientonorte (TILCARA)
- Tierra andina (TILCARA)
- Cilene del Faro (USHUAIA)
- El Muelle by DOT Boutique (VILLA LA ANGOSTURA)
- ONA Apart Hotel & Spa (VILLA LA ANGOSTURA)

**Secciones duplicadas:** la misma ciudad escrita de dos formas, cada una con sus proveedores.

- Ninguna.

**El mismo nombre en más de una ciudad** (sin contar las secciones duplicadas): puede ser una cadena con un hotel por ciudad o un proveedor cargado en la sección equivocada.

- Casa De Adobe: PURMAMARCA, SALTA.
- Design Suites: BARILOCHE, CALAFATE.
- Holandes hostel: BRASIL, ILHA GRANDE.
- Rumbo sur: CALAFATE, USHUAIA.
