# Los traslados de cada paquete según el tour (M1-08)

Generado el 2026-10-22 por la carga de los tours. Dentro de un tour, entre un paquete y el siguiente se viaja en bus: al paquete al que se llega en bus no se le pide el traslado de llegada, y al que se sale en bus no se le pide el de salida. Un traslado de ida y vuelta queda solo del lado que corresponde. El primer paquete conserva la llegada y el último la salida. Iguazú conserva los suyos. Las excepciones que pediste están en `data/traslados-tour.csv` y le ganan a la regla.

El paquete vendido solo sigue con todos sus servicios. Esto vale solo dentro de cada tour.

## CHB31 · Overland San Pedro de Atacama to Uyuni, end in La Paz

Sin cambios: cada paquete pide sus traslados como se vende solo.

## BOCHI04R · OVERLAND UYUNI TO SAN PEDRO DE ATACAMA BEGINNING IN LA PAZ

**Cambian**

- **OD030** · Transfer in CJC - Accommodation in San Pedro de Atacama (Transvipp): cambia de sentido: “Transfer alojamiento en San Pedro de Atacama - aeropuerto de Calama (CJC)” — En este tour el traslado es de salida, de San Pedro al aeropuerto de Calama (data/traslados-tour.csv).

## ARCH31 · Patagonia Highlights

**Se anulan**

- **OD016** · Transfer FTE Airport - El Calafate Accommodation (Chalten Travel): no se pide — Llega en bus desde El Chaltén.
- **OD017** · Bus Punta Arenas - Puerto Natales (Kupos): no se pide — Llega a Puerto Natales en bus desde El Calafate (data/traslados-tour.csv).
- **OD017** · Optiona Transfer PNT Airport - PNT accommodation if requested (Patagonia Planet): no se pide — Llega en bus desde El Calafate.

## ARCH33 · Patagonia, Trekking Paradise with W-Trek

**Se anulan**

- **OD016** · Transfer FTE Airport - El Calafate Accommodation (Chalten Travel): no se pide — Llega en bus desde El Chaltén.

## AR09 · Patagonia Adventure Tour

**Se anulan**

- **OD025** · Transfer REL - accommodation (All Peninsula): no se pide — Llega en bus desde Buenos Aires.
- **OD013** · Transfer Round Trip (Chalten Travel): no se pide — Llega en bus desde Puerto Madryn y sale en bus a Ushuaia.

**De un solo lado**

- **OD018** · Transfer EZE o AEP - Hotel - EZE o AEP (Greeters): solo la llegada — Sale en bus a Puerto Madryn.
- **OD022** · Transfer Round Trip: Rumbo Sur (Rumbo Sur): solo la salida — Llega en bus desde El Calafate.

## BRARCH26 · From Rio de Janeiro to Santiago de Chile

**Se anulan**

- **OD018** · Transfer EZE o AEP - Hotel - EZE o AEP (Greeters): no se pide — Llega en bus desde Iguazú y sale en bus a Mendoza.
- **OD019** · Transfers: Remis Mendoza (Remis Mendoza): no se pide — Llega en bus desde Buenos Aires y sale en bus a Santiago de Chile.
- **OD029** · Transfer SCL - accommodation (CL Mundo): no se pide — Hoy no se pide este traslado en el tour (data/traslados-tour.csv).

**Cambian**

- **OD010A** · Excursion: Paquete Receptvo 105 Premium (Cuenca del Plata): se pide como “Paquete Receptvo 105 Premium con transfer in desde la Rodoviaria de Foz y transfer out a la terminal de buses de Puerto Iguazú” — Llega en bus a Foz y sigue en bus desde Puerto Iguazú (data/traslados-tour.csv).

## 5C01 · 5 Countries: Rio de Janeiro to la Paz

**Se anulan**

- **OD020** · Transfer EZE o AEP - Hotel - EZE o AEP (Greeters): no se pide — Llega en bus desde Iguazú y sale en bus a Mendoza.
- **OD019** · Transfers: Remis Mendoza (Remis Mendoza): no se pide — Llega en bus desde Buenos Aires y sale en bus a Santiago de Chile.
- **OD029** · Transfer SCL - accommodation (CL Mundo): no se pide — Hoy no se pide este traslado en el tour (data/traslados-tour.csv).
- **OD030** · Transfer in CJC - Accommodation in San Pedro de Atacama (Transvipp): no se pide — Llega en bus desde Valparaíso.

**Cambian**

- **OD010D** · Excursion: Paquete Receptvo 105 Premium x Foz (Cuenca del Plata): se pide como “Paquete Receptvo 105 Premium x Foz con transfer in desde la Rodoviaria de Foz y transfer out a la terminal de buses de Puerto Iguazú” — Llega en bus a Foz y sigue en bus desde Puerto Iguazú (data/traslados-tour.csv).
- **OD031** · Transfer La Paz Airport - La Paz Accommodation (Imperio Inca): se pide como “Transfer terminal de buses de La Paz - alojamiento en La Paz” — Llega en bus desde Uyuni: el traslado es desde la terminal de buses (data/traslados-tour.csv).

**De un solo lado**

- **COMPCH01** · Public Bus Santiago - Valparaiso - Santiago (Kupos.cl): solo la llegada (“Bus Santiago - Valparaíso, solo ida”) — Solo ida: desde Valparaíso el tour sigue en bus a Calama (data/traslados-tour.csv).

## ARCH33EXP · Patagonia, Trekking Paradise with W-Trek EXPRESS

**Se anulan**

- **OD016** · Transfer FTE Airport - El Calafate Accommodation (Chalten Travel): no se pide — Llega en bus desde El Chaltén.

## ARBR23 · From Buenos Aires to RIO

**Cambian**

- **OD010A** · Excursion: Paquete Receptvo 105 Premium (Cuenca del Plata): se pide como “Paquete Receptvo 105 Premium con transfer in desde la terminal de buses de Puerto Iguazú y transfer out a la terminal de buses de Puerto Iguazú” — Llega en bus desde Buenos Aires y sigue en bus a Río desde Puerto Iguazú (data/traslados-tour.csv).
- **OD032** · Transfer GIG - Accommodation in Rio (Buzios Transfers / Alex): cambia de sentido: “Transfer alojamiento en Río - aeropuerto de Río (GIG)” — En este tour el traslado es de salida, del alojamiento al aeropuerto de Río (data/traslados-tour.csv).

**De un solo lado**

- **OD018** · Transfer EZE o AEP - Hotel - EZE o AEP (Greeters): solo la llegada — Sale en bus a Iguazú.

## ARUY01 · Argentina and Uruguay, heart of the River Plate

**Cambian**

- **COMPUY03** · Bus Regular Montevideo Bus Station - Colonia Bus Station (COT online): se pide como “Bus regular Colonia - Montevideo (terminal de buses Tres Cruces)” — En este tour el bus va al revés: de Colonia a Montevideo (data/traslados-tour.csv).
- **OD040** · Regular Transfer MVD Airport - hotel / hostel (Turismo Dcom): cambia de sentido: “Transfer regular alojamiento en Montevideo - aeropuerto de Carrasco (MVD)” — En este tour el traslado es de salida, del alojamiento al aeropuerto de Carrasco (data/traslados-tour.csv).

**De un solo lado**

- **OD018** · Transfer EZE o AEP - Hotel - EZE o AEP (Greeters): solo la llegada — Sale en ferry a Colonia del Sacramento (data/traslados-tour.csv).

## Traslados sin sentido deducido

El texto del Excel no dice si son de llegada, de salida o de ida y vuelta. En el medio de un tour se anulan igual (se llega y se sale en bus); en una punta se dejan enteros. Si querés que se separen, escribí en el Excel de dónde a dónde van (ej. “Transfer MDZ Airport - Accommodation”):

- [ ] **OD019** · Transfers: Remis Mendoza (Remis Mendoza).
