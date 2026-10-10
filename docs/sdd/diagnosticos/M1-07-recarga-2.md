# Recarga del directorio de proveedores (M1-07)

Recargué el directorio desde **Proveedores Hi Travel 2026 para IA.xlsx** (2026-10-10). Leí 257 proveedores: 7 nuevos y 250 que ya estaban (con sus datos al día).

## Qué cambió

- **Nuevo:** Botanica House, proveedor Cuenca del Plata (IGUAZU), mail reservas3@cuencadelplata.com.
- **Nuevo:** La Aldea de la Selva, proveedor Cuenca del Plata (IGUAZU), mail reservas3@cuencadelplata.com.
- **Nuevo:** Glamping Selva Iguazu, proveedor Cuenca del Plata (IGUAZU), mail reservas3@cuencadelplata.com.
- **Nuevo:** Paquetes 105 Premium: Transfer in+out en IGR, Lado Arg, lado Bra (IGUAZU), mail reservas3@cuencadelplata.com.
- **Nuevo:** Paquete 105 Premium desde Foz: Transfer in+out en Foz/Igu, Lado Arg, Lado Bra (IGUAZU), mail reservas3@cuencadelplata.com.
- **Nuevo:** Lado Brasilero Premium (IGUAZU), mail reservas3@cuencadelplata.com.
- **Nuevo:** Lado Argentino Premium (IGUAZU), mail reservas3@cuencadelplata.com.
- **Cambió de nombre:** “Cuenca Del Plata (Analia )” ahora es “El Pueblito, proveedor Cuenca del Plata” (IGUAZU, mismo mail). Lo actualicé; los servicios que lo usaban siguen apuntándole.
- **Cambió el contacto:** Madidi Amazon Lodge (BOLIVIA): antes sin contacto, ahora mail info@madidijungle.com.

## Ya no están en el Excel

Estos 25 están en la base pero ya no en el Excel. **No los borré** (un proveedor que sacás del Excel no se borra solo): decime cuáles borro. Los que dicen “en uso” los usa algún producto; antes de borrarlos hay que pasar esos servicios a otro proveedor.

- [ ] Salar andino (BOLIVIA)
- [ ] calten tour / ALWAYS (CALAFATE)
- [ ] Juan pablo (CALAFATE)
- [ ] Buenavista Chalten (CHALTEN)
- [ ] Chalten Suites (CHALTEN)
- [ ] Chalten Travel (CHALTEN) — **en uso** en OD033
- [ ] Cintia (CHALTEN)
- [ ] Cumbres Nevadas (CHALTEN)
- [ ] Desierto Suites o en NB Mountain (CHALTEN)
- [ ] Hostería Altas Cumbres (CHALTEN)
- [ ] Hosteria Fitz roy (CHALTEN) — **en uso** en OD013, OD016
- [ ] Hotel kaulem (CHALTEN)
- [ ] Kau si ake (CHALTEN)
- [ ] Las Lengas (CHALTEN)
- [ ] Los Cerros Boutique Hotel (CHALTEN)
- [ ] Mermoz (CHALTEN)
- [ ] Panorama aparts (CHALTEN)
- [ ] Patagonia travellers hostel (CHALTEN)
- [ ] Pioneros del valle (CHALTEN)
- [ ] Poincenot (CHALTEN)
- [ ] Posada San Antonio El chalten (CHALTEN)
- [ ] Senderos Apart (CHALTEN)
- [ ] Vertical Lodge (CHALTEN)
- [ ] Cuenca del Plata, (IGUAZU)
- [ ] Cuenca del Plata, + (IGUAZU)

## Borrados con tu OK

- Selina La Paz: no está en el Excel ni volvió a la base.

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

- La sección “CHALTEN” ya no está en el Excel (quedó “EL CHALTEN”), pero sus 20 proveedores siguen en la base: están en “Ya no están en el Excel”. En uso: Chalten Travel, Hosteria Fitz roy.

**El mismo nombre en más de una ciudad** (sin contar las secciones duplicadas): puede ser una cadena con un hotel por ciudad o un proveedor cargado en la sección equivocada.

- Casa De Adobe: PURMAMARCA, SALTA.
- Design Suites: BARILOCHE, CALAFATE.
- Holandes hostel: BRASIL, ILHA GRANDE.
- Rumbo sur: CALAFATE, USHUAIA.

## Después de esta recarga (2026-10-10)

- **Los 25 de "Ya no están en el Excel" se borraron con el OK del owner.** Los 20 de "CHALTEN" eran copias: siguen en "EL CHALTEN". Quedaron en `data/proveedores-borrados.csv`.
- "Cuenca del Plata" y "Cuenca del Plana" del Excel de paquetes apuntan a **El Pueblito, proveedor Cuenca del Plata** (el mismo registro y el mismo mail de antes).
- Equivalencias nuevas que explicó el owner: Chalten Travel (agencias@chaltentravel.com) reserva Rancho Grande, Poincenot, Andino Aparts y Destino Sur, y los buses FTE–CHA–BRC; Patagonian Group (info@patagoniangroup.com.ar) reserva Fitz Roy, Vertical Lodge y El Paraíso en El Chaltén, y Puerto San Julián en El Calafate.
- Se recargaron los paquetes y los tours: los servicios de OD033, OD013 y OD016 quedaron con Chalten Travel y Patagonian Group; los únicos sin resolver siguen siendo los 2 de antes.
