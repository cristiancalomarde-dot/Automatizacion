# M2-09: los 4 mails de Journaway en el modo prueba

Generado el 2026-10-17 con `npm run probar:mails -- --journaway`, contra la base real (reservas marcadas de prueba). Modelo de la lectura: claude-sonnet-5-5. Gasto de IA de la corrida: US$ 0,0956.

Se compara cada mail con lo que pide la spec (tabla de §3): producto, estado, número de viaje, pax, pasajeros, cada tour con su fecha y su pick up, vuelos, traslados y los hoteles que reserva Journaway (no se piden).

**4 de 4 mails coinciden con lo esperado.**

| Mail | Esperado | Salió | Resultado |
|---|---|---|---|
| A · Iguazu Fall Argentina Side | IGRE01 (recibida) | IGRE01 (recibida) | Coincide |
| B · Iguazu Falls Brazilian Side | IGRE02 (recibida) | IGRE02 (recibida) | Coincide |
| C · All San Pedro 4 days mas San Pedro Extension | SPAP01 (recibida) + SPAP03 (recibida) | SPAP01 (recibida) + SPAP03 (recibida) | Coincide |
| D · San Pedro de Atacama and Uyuni Salt Flats in Tayka Hotels 7N8D | SPAP05 (recibida) | SPAP05 (recibida) | Coincide |

## A · Iguazu Fall Argentina Side

Coincide con lo esperado.

- **IGRE01** · recibida · número de viaje: no vino · 2 pax
  - Partes: IGRE01 2027-06-14 (pick up: Hotel Rafain Centro)
  - Vuelos: ninguno
  - Notas: Journaway lo llama half-day; es el full day
- Gasto de este mail: US$ 0,0161

## B · Iguazu Falls Brazilian Side

Coincide con lo esperado.

- **IGRE02** · recibida · número de viaje: no vino · 2 pax
  - Partes: IGRE02 2027-06-13 (pick up: Hotel Rafain Centro)
  - Vuelos: ninguno
- Gasto de este mail: US$ 0,0159

## C · All San Pedro 4 days mas San Pedro Extension

Coincide con lo esperado.

- **SPAP01** · recibida · número de viaje: 62992 · 2 pax
  - Partes: SPAT01 2027-03-16 · SPAE01 2027-03-16 · SPAE02 2027-03-19 · SPAE03 2027-03-17 · SPAE04 2027-03-17
  - Vuelos: LA156, LA377
  - Notas: Todos los hoteles los reserva Journaway
- **SPAP03** · recibida · número de viaje: 62992 · 2 pax
  - Partes: SPAE07 2027-03-21 · SPAE06 2027-03-20 · SPAE05 2027-03-18 · SPAT01 2027-03-23
  - Vuelos: LA156, LA377
  - Notas: Todos los hoteles los reserva Journaway
- Gasto de este mail: US$ 0,0257

## D · San Pedro de Atacama and Uyuni Salt Flats in Tayka Hotels 7N8D

Coincide con lo esperado.

- **SPAP05** · recibida · número de viaje: no vino · 2 pax
  - Partes: SPAT01 2026-10-11 · SPAE01 2026-10-11 (pick up: Our Habitas Atacama) · SPAE03 2026-10-12 (pick up: Our Habitas Atacama) · SPAE05 2026-10-13 (pick up: Our Habitas Atacama) · SPAE04 2026-10-14 (pick up: Our Habitas Atacama) · SPAT02 2026-10-15 · UYUO01 2026-10-15 (pick up: Tayka del Desierto Hotel / Tayka del Sal Hotel)
  - Vuelos: IB1314, LA5404, LA148, LA2277, LA2484, IB1315
  - Lo que reserva Journaway (no se pide): Hub Providencia, Fauna Hotel, Our Habitas Atacama, MET Hotel, Sonesta Posadas del Inca Lake Titicaca - Puno, Night Bus Peru, Hotel Viza, Saska Boutique
  - Notas: Trae adjuntos: pasaportes (no se leen)
- Gasto de este mail: US$ 0,0377
