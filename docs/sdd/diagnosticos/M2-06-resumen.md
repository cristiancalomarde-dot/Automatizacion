# Modo prueba (M2-06): resumen

Generado el 2026-10-15 con `npm run probar:mails -- --resumen`.

## La medición

**Revisadas 0 de 23 · faltan 23 por revisar**

Si más del 20% de las reservas revisadas está mal, se frena y no se activa la lectura automática (M2-07).

## Gasto y modelo

- Gasto de IA de las reservas de prueba: **US$ 0,4143** (20 lecturas de mails y 2 propuestas de producto).
- Modelo usado: claude-sonnet-5-5. Instrucciones: lectura-mail.v2.

## Sonnet contra Opus (`npm run eval:lectura`)

El mismo set de evaluación (las fichas que validó el owner), leído por cada modelo. Es el % de aciertos por campo.

| Campo | claude-sonnet-5-5 | claude-opus-5-5 |
|---|---|---|
| tipo | 100% | 66,7% |
| agencia | 100% | 66,7% |
| numero | 100% | 66,7% |
| producto | 100% | 66,7% |
| fechas | 100% | 66,7% |
| pax | 100% | 66,7% |
| vuelos | 100% | 50% |
| **Total** | **100%** | **64,3%** |
| Costo de la corrida | US$ 0,1430 | US$ 0,1996 |
| Instrucciones | lectura-mail.v2 | lectura-mail.v2 |
| Cuándo | 2026-10-14 22:56 UTC | 2026-10-14 22:57 UTC |

El modelo se fija en `src/lib/ia/modelos.ts` con el OK del owner (y se anota en `DECISIONS.md`).

## Las reservas de prueba (23)

| Archivo | Agencia | Número | Producto | Estado | Marca del owner |
|---|---|---|---|---|---|
| Booking Statement 1363612 - 25160515 - vendorcredit.pdf | TourRadar | 1363612 | OD010A | Para revisión | sin marcar |
| Booking Statement 1363612 - 25160515 - vendorcredit.pdf | TourRadar | 1363612 | sin producto | Para revisión | sin marcar |
| Booking Statement 1376833 - 25351215 - vendorbill.pdf | TourRadar | 1376833 | CHB31 | Para revisión | sin marcar |
| Booking Statement 1377583 - 25365166 - vendorbill.pdf | TourRadar | 1377583 | sin producto | Para revisión | sin marcar |
| Booking Statement 1377598 - 25372219 - vendorbill.pdf | TourRadar | 1377598 | AR09 | Para revisión | sin marcar |
| Booking Statement 1383503 - 25500905 - vendorbill.pdf | TourRadar | 1383503 | sin producto | Para revisión | sin marcar |
| Reserva de Cliente Kilroy - Overland uyuni a san pedro saliendo de la paz (reverse).docx | Kilroy | DK1559523/fnie | BOCHI04R | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Aarhus - Rio Starter Package OD032.docx | Kilroy | DK1576836-26196085 | OD032 | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Aarhus -Iguazu Falls Combined OD010D.docx | Kilroy | DK1564627/cafj | OD010D | Recibida | sin marcar |
| Reserva de Cliente Kilroy Copenagiue varias.docx | Kilroy | DK1594100/maga | OD010D | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Copenagiue varias.docx | Kilroy | DK1594100/maga | sin producto | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Copenagiue varias.docx | Kilroy | DK1594100/maga | CHB31 | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Copenahue - Patagonia Trekking Paradise.docx | Kilroy | DK1586168/pela | sin producto | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Copenhague - Overland San Pedro de Atacama to Uyuni end in La Paz CHB31.docx | Kilroy | DK1547743/pela | CHB31 | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Copenhague Overland San Pedro to Uyuni.docx | Kilroy | DK1594392/olha | CHB31 | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Copenhaguen - Patagonia Trekking Paradise ARCH33.docx | Kilroy | DK1576932/emhe | ARCH33 | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Copenhaguen - Patagonia Trekking Paradise ARCH33.docx | Kilroy | DK1576932/emhe | CHB31 | Para revisión | sin marcar |
| Reserva de Cliente Kilroy Olso - Patagonia HIghlights ARCH31.docx | Kilroy | NO1569851/saha | ARCH31 | Para revisión | sin marcar |
| Reserva de Cliente Kilroy UK - 5 Countries 5C01.docx | Kilroy | UK1586142/fagu | 5C01 | Para revisión | sin marcar |
| Kilroy-INBOX-15933.eml | Kilroy | DK1587664/emhe | OD010C | Recibida | sin marcar |
| Kilroy-INBOX-15958.eml | Kilroy | DK1585447/casa | OD010B | Recibida | sin marcar |
| Kilroy-INBOX-15962.eml | Kilroy | DK1593111/mhee | OD010B | Recibida | sin marcar |
| Kilroy-INBOX-15963.eml | Kilroy | DK1593111/mhee | OD030 | Para revisión | sin marcar |

## Qué pasó con cada archivo

Cada uno tiene su reporte en `docs/sdd/diagnosticos/M2-06-mails/`.

| Archivo | Resultado | Reservas | Reporte |
|---|---|---|---|
| Booking Statement 1363612 - 25160515 - vendorcredit.pdf | Leído con IA | 2 | [Booking Statement 1363612 - 25160515 - vendorcredit.md](M2-06-mails/Booking%20Statement%201363612%20-%2025160515%20-%20vendorcredit.md) |
| Booking Statement 1376833 - 25351215 - vendorbill.pdf | Leído con IA | 1 | [Booking Statement 1376833 - 25351215 - vendorbill.md](M2-06-mails/Booking%20Statement%201376833%20-%2025351215%20-%20vendorbill.md) |
| Booking Statement 1377583 - 25365166 - vendorbill.pdf | Leído con IA | 1 | [Booking Statement 1377583 - 25365166 - vendorbill.md](M2-06-mails/Booking%20Statement%201377583%20-%2025365166%20-%20vendorbill.md) |
| Booking Statement 1377598 - 25372219 - vendorbill.pdf | Leído con IA | 1 | [Booking Statement 1377598 - 25372219 - vendorbill.md](M2-06-mails/Booking%20Statement%201377598%20-%2025372219%20-%20vendorbill.md) |
| Booking Statement 1377598 - 25388222 - vendorbill.pdf | Leído con IA | 0 | [Booking Statement 1377598 - 25388222 - vendorbill.md](M2-06-mails/Booking%20Statement%201377598%20-%2025388222%20-%20vendorbill.md) |
| Booking Statement 1383503 - 25500905 - vendorbill.pdf | Leído con IA | 1 | [Booking Statement 1383503 - 25500905 - vendorbill.md](M2-06-mails/Booking%20Statement%201383503%20-%2025500905%20-%20vendorbill.md) |
| Jysk-INBOX-15931.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15931.md](M2-06-mails/Jysk-INBOX-15931.md) |
| Jysk-INBOX-15932.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15932.md](M2-06-mails/Jysk-INBOX-15932.md) |
| Jysk-INBOX-15934.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15934.md](M2-06-mails/Jysk-INBOX-15934.md) |
| Jysk-INBOX-15935.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15935.md](M2-06-mails/Jysk-INBOX-15935.md) |
| Jysk-INBOX-15938.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15938.md](M2-06-mails/Jysk-INBOX-15938.md) |
| Jysk-INBOX-15940.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15940.md](M2-06-mails/Jysk-INBOX-15940.md) |
| Jysk-INBOX-15941.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15941.md](M2-06-mails/Jysk-INBOX-15941.md) |
| Jysk-INBOX-15942.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15942.md](M2-06-mails/Jysk-INBOX-15942.md) |
| Jysk-INBOX-15945.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15945.md](M2-06-mails/Jysk-INBOX-15945.md) |
| Jysk-INBOX-15953.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15953.md](M2-06-mails/Jysk-INBOX-15953.md) |
| Jysk-INBOX-15960.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15960.md](M2-06-mails/Jysk-INBOX-15960.md) |
| Jysk-INBOX-15961.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15961.md](M2-06-mails/Jysk-INBOX-15961.md) |
| Jysk-INBOX-15967.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15967.md](M2-06-mails/Jysk-INBOX-15967.md) |
| Jysk-INBOX-15977.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15977.md](M2-06-mails/Jysk-INBOX-15977.md) |
| Jysk-INBOX-15979.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15979.md](M2-06-mails/Jysk-INBOX-15979.md) |
| Jysk-INBOX-15980.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15980.md](M2-06-mails/Jysk-INBOX-15980.md) |
| Jysk-INBOX-15981.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15981.md](M2-06-mails/Jysk-INBOX-15981.md) |
| Jysk-INBOX-15984.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15984.md](M2-06-mails/Jysk-INBOX-15984.md) |
| Jysk-INBOX-15987.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15987.md](M2-06-mails/Jysk-INBOX-15987.md) |
| Jysk-INBOX-15998.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-15998.md](M2-06-mails/Jysk-INBOX-15998.md) |
| Jysk-INBOX-16001.eml | Jysk no se lee: sus reservas son viajes a medida (decisión del owner) | 0 | [Jysk-INBOX-16001.md](M2-06-mails/Jysk-INBOX-16001.md) |
| Kilroy-INBOX-15930.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15930.md](M2-06-mails/Kilroy-INBOX-15930.md) |
| Kilroy-INBOX-15933.eml | Leído con IA | 1 | [Kilroy-INBOX-15933.md](M2-06-mails/Kilroy-INBOX-15933.md) |
| Kilroy-INBOX-15937.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15937.md](M2-06-mails/Kilroy-INBOX-15937.md) |
| Kilroy-INBOX-15944.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15944.md](M2-06-mails/Kilroy-INBOX-15944.md) |
| Kilroy-INBOX-15949.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15949.md](M2-06-mails/Kilroy-INBOX-15949.md) |
| Kilroy-INBOX-15951.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15951.md](M2-06-mails/Kilroy-INBOX-15951.md) |
| Kilroy-INBOX-15954.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15954.md](M2-06-mails/Kilroy-INBOX-15954.md) |
| Kilroy-INBOX-15955.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15955.md](M2-06-mails/Kilroy-INBOX-15955.md) |
| Kilroy-INBOX-15957.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15957.md](M2-06-mails/Kilroy-INBOX-15957.md) |
| Kilroy-INBOX-15958.eml | Leído con IA | 1 | [Kilroy-INBOX-15958.md](M2-06-mails/Kilroy-INBOX-15958.md) |
| Kilroy-INBOX-15959.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15959.md](M2-06-mails/Kilroy-INBOX-15959.md) |
| Kilroy-INBOX-15962.eml | Leído con IA | 1 | [Kilroy-INBOX-15962.md](M2-06-mails/Kilroy-INBOX-15962.md) |
| Kilroy-INBOX-15963.eml | Leído con IA | 1 | [Kilroy-INBOX-15963.md](M2-06-mails/Kilroy-INBOX-15963.md) |
| Kilroy-INBOX-15965.eml | Es un pedido de cotización, no una reserva (por ahora no se lee) | 0 | [Kilroy-INBOX-15965.md](M2-06-mails/Kilroy-INBOX-15965.md) |
| Kilroy-INBOX-15966.eml | Es un pedido de cotización, no una reserva (por ahora no se lee) | 0 | [Kilroy-INBOX-15966.md](M2-06-mails/Kilroy-INBOX-15966.md) |
| Kilroy-INBOX-15969.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15969.md](M2-06-mails/Kilroy-INBOX-15969.md) |
| Kilroy-INBOX-15991.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15991.md](M2-06-mails/Kilroy-INBOX-15991.md) |
| Kilroy-INBOX-15994.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15994.md](M2-06-mails/Kilroy-INBOX-15994.md) |
| Kilroy-INBOX-15997.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-15997.md](M2-06-mails/Kilroy-INBOX-15997.md) |
| Kilroy-INBOX-16002.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-16002.md](M2-06-mails/Kilroy-INBOX-16002.md) |
| Kilroy-INBOX-16008.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-16008.md](M2-06-mails/Kilroy-INBOX-16008.md) |
| Kilroy-INBOX-16012.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-16012.md](M2-06-mails/Kilroy-INBOX-16012.md) |
| Kilroy-INBOX-16015.eml | Es una respuesta o un reenvío, y su número no es de una reserva cargada | 0 | [Kilroy-INBOX-16015.md](M2-06-mails/Kilroy-INBOX-16015.md) |
| Pedido Proveedor - Beer Hostel OD010A.docx | No es un mail de agencia | 0 | [Pedido Proveedor - Beer Hostel OD010A.md](M2-06-mails/Pedido%20Proveedor%20-%20Beer%20Hostel%20OD010A.md) |
| Pedido Proveedor - Chalten Travel OD016.docx | No es un mail de agencia | 0 | [Pedido Proveedor - Chalten Travel OD016.md](M2-06-mails/Pedido%20Proveedor%20-%20Chalten%20Travel%20OD016.md) |
| Pedido Proveedor - Cuenca del Plata OD010A.docx | No es un mail de agencia | 0 | [Pedido Proveedor - Cuenca del Plata OD010A.md](M2-06-mails/Pedido%20Proveedor%20-%20Cuenca%20del%20Plata%20OD010A.md) |
| Pedido Proveedor - Cuenca del Plata OD010B.docx | No es un mail de agencia | 0 | [Pedido Proveedor - Cuenca del Plata OD010B.md](M2-06-mails/Pedido%20Proveedor%20-%20Cuenca%20del%20Plata%20OD010B.md) |
| Pedido Proveedor - Grupo Summa OD018.docx | No es un mail de agencia | 0 | [Pedido Proveedor - Grupo Summa OD018.md](M2-06-mails/Pedido%20Proveedor%20-%20Grupo%20Summa%20OD018.md) |
| Pedido Proveedor - La Bicicleta Naranja OD018.docx | No es un mail de agencia | 0 | [Pedido Proveedor - La Bicicleta Naranja OD018.md](M2-06-mails/Pedido%20Proveedor%20-%20La%20Bicicleta%20Naranja%20OD018.md) |
| Pedido Proveedor - Milhouse Hostel OD018.docx | No es un mail de agencia | 0 | [Pedido Proveedor - Milhouse Hostel OD018.md](M2-06-mails/Pedido%20Proveedor%20-%20Milhouse%20Hostel%20OD018.md) |
| Pedido Proveedor - Rancho Grande y Chalten Travel OD033.docx | No es un mail de agencia | 0 | [Pedido Proveedor - Rancho Grande y Chalten Travel OD033.md](M2-06-mails/Pedido%20Proveedor%20-%20Rancho%20Grande%20y%20Chalten%20Travel%20OD033.md) |
| Reserva de Cliente Journaway - All San Pedro 4 days mas San Pedro Extension.docx | Journaway entra con M2-09 | 0 | [Reserva de Cliente Journaway - All San Pedro 4 days mas San Pedro Extension.md](M2-06-mails/Reserva%20de%20Cliente%20Journaway%20-%20All%20San%20Pedro%204%20days%20mas%20San%20Pedro%20Extension.md) |
| Reserva de Cliente Journaway - Iguazu Fall Argentina Side.docx | Journaway entra con M2-09 | 0 | [Reserva de Cliente Journaway - Iguazu Fall Argentina Side.md](M2-06-mails/Reserva%20de%20Cliente%20Journaway%20-%20Iguazu%20Fall%20Argentina%20Side.md) |
| Reserva de Cliente Journaway - Iguazu Falls Brazilian Side.docx | Journaway entra con M2-09 | 0 | [Reserva de Cliente Journaway - Iguazu Falls Brazilian Side.md](M2-06-mails/Reserva%20de%20Cliente%20Journaway%20-%20Iguazu%20Falls%20Brazilian%20Side.md) |
| Reserva de Cliente Journaway - San Pedro de Atacama and Uyuni Salt Flats in Tayka Hotels 7N8D SPAP05.docx | Journaway entra con M2-09 | 0 | [Reserva de Cliente Journaway - San Pedro de Atacama and Uyuni Salt Flats in Tayka Hotels 7N8D SPAP05.md](M2-06-mails/Reserva%20de%20Cliente%20Journaway%20-%20San%20Pedro%20de%20Atacama%20and%20Uyuni%20Salt%20Flats%20in%20Tayka%20Hotels%207N8D%20SPAP05.md) |
| Reserva de Cliente Kilroy - Overland uyuni a san pedro saliendo de la paz (reverse).docx | Leído con IA | 1 | [Reserva de Cliente Kilroy - Overland uyuni a san pedro saliendo de la paz (reverse).md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20-%20Overland%20uyuni%20a%20san%20pedro%20saliendo%20de%20la%20paz%20(reverse).md) |
| Reserva de Cliente Kilroy Aarhus - Rio Starter Package OD032.docx | Leído con IA | 1 | [Reserva de Cliente Kilroy Aarhus - Rio Starter Package OD032.md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20Aarhus%20-%20Rio%20Starter%20Package%20OD032.md) |
| Reserva de Cliente Kilroy Aarhus -Iguazu Falls Combined OD010D.docx | Leído con IA | 1 | [Reserva de Cliente Kilroy Aarhus -Iguazu Falls Combined OD010D.md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20Aarhus%20-Iguazu%20Falls%20Combined%20OD010D.md) |
| Reserva de Cliente Kilroy Copenagiue varias.docx | Leído con IA | 3 | [Reserva de Cliente Kilroy Copenagiue varias.md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20Copenagiue%20varias.md) |
| Reserva de Cliente Kilroy Copenahue - Patagonia Trekking Paradise.docx | Leído con IA | 1 | [Reserva de Cliente Kilroy Copenahue - Patagonia Trekking Paradise.md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20Copenahue%20-%20Patagonia%20Trekking%20Paradise.md) |
| Reserva de Cliente Kilroy Copenhague - Overland San Pedro de Atacama to Uyuni end in La Paz CHB31.docx | Leído con IA | 1 | [Reserva de Cliente Kilroy Copenhague - Overland San Pedro de Atacama to Uyuni end in La Paz CHB31.md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20Copenhague%20-%20Overland%20San%20Pedro%20de%20Atacama%20to%20Uyuni%20end%20in%20La%20Paz%20CHB31.md) |
| Reserva de Cliente Kilroy Copenhague Overland San Pedro to Uyuni.docx | Leído con IA | 1 | [Reserva de Cliente Kilroy Copenhague Overland San Pedro to Uyuni.md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20Copenhague%20Overland%20San%20Pedro%20to%20Uyuni.md) |
| Reserva de Cliente Kilroy Copenhaguen - Patagonia Trekking Paradise ARCH33.docx | Leído con IA | 2 | [Reserva de Cliente Kilroy Copenhaguen - Patagonia Trekking Paradise ARCH33.md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20Copenhaguen%20-%20Patagonia%20Trekking%20Paradise%20ARCH33.md) |
| Reserva de Cliente Kilroy Olso - Patagonia HIghlights ARCH31.docx | Leído con IA | 1 | [Reserva de Cliente Kilroy Olso - Patagonia HIghlights ARCH31.md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20Olso%20-%20Patagonia%20HIghlights%20ARCH31.md) |
| Reserva de Cliente Kilroy UK - 5 Countries 5C01.docx | Leído con IA | 1 | [Reserva de Cliente Kilroy UK - 5 Countries 5C01.md](M2-06-mails/Reserva%20de%20Cliente%20Kilroy%20UK%20-%205%20Countries%205C01.md) |
