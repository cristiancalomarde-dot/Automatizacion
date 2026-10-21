# M3-10 · Diagnóstico de los 6 productos que pidieron las agencias

Lo armé el 2026-10-21, solo leyendo las fuentes: **no escribí en ninguna base** (ni en la de pruebas ni en la real) y no corrí ningún importador.

Leí: el Excel de paquetes vigente (`Construccion de Paquetes 2019 con 3 y 4 estrellas.xls`, hoja "Analisis a Mayo 2026", y su hoja "Readme AI"), los Word de itinerarios (One, Two y Multi Destination, 1 Jun 2026 - 31 Dec 2027), `RutasenBus2020.xls` (hoja "Tours 2027"), el directorio `Proveedores Hi Travel 2026 para IA.xlsx` y las reglas que ya están en `data/*.csv`.

## En corto

- **Los 6 se pueden armar con las fuentes.** Lo que falta son **8 preguntas** (abajo, en una sola lista). Casi todo lo pendiente es de **Uruguay** (ARUY01).
- **Paquetes de un destino nuevos: 4**, más AR34 si confirmás la pregunta 1:
  - **CH11**: W Trek Express + Puerto Natales.
  - **OD014**: El Calafate & El Chaltén full day.
  - **OD040**: Montevideo Starter Package. Lo necesita ARUY01.
  - **COMPUY03**: Extensión a Colonia. Lo necesita ARUY01.
  - **AR34**: en el Excel tiene su propio bloque, así que se puede cargar como un paquete más (pregunta 1).
- **Tours compuestos: 3.**
  - **ARCH33EXP**: es ARCH33 con CH11 en lugar de CH10.
  - **ARBR23**: sale entero de paquetes que ya están cargados (Buenos Aires OD018, Iguazú OD010A, Río OD032).
  - **ARUY01**: Buenos Aires OD018 + Colonia COMPUY03 + Montevideo OD040.
- **Proveedores:** todos los de Patagonia (CH11, OD014, AR34, ARCH33EXP) y los de ARBR23 ya están en el directorio con mail. En Uruguay hay 3 casos sin resolver: Viajero Hostels, Hotel Oxford / Merit Montevideo y Turismo Dcom (pregunta 5).
- **Noches:** en los 6 coinciden el Word, RutasenBus y el Excel. ARCH33EXP tiene 10, ARBR23 11, ARUY01 6, AR34 5, CH11 5 y OD014 4.

## Producto por producto

### CH11 · W-Trek Express + Puerto Natales (5 noches, self guided)

Es como CH10, pero con la W Express de 3 noches en lugar de la W estándar de 4. El Excel lo tiene en su propio bloque ("W Trek Express 3 NTS + Puerto Natales CH11", fila 1303) y el Word lo detalla día por día.

| Noche | Qué | Quién lo reserva |
|---|---|---|
| 1 | Alojamiento en Puerto Natales (antes de la W) | **Hostel:** Puma Hostel / Last Hope / Factoria (Vertice). **Hotel 3\*:** Big Sur / Loreto Belén / Darwin y Pristine (CL Mundo) / Vendaval |
| 2 a 4 | W Trek Express en refugios o carpa | Las Torres |
| 5 | Alojamiento en Puerto Natales (después de la W), con las mismas opciones de hotel | los mismos que la noche 1 |

- Tiene los mismos niveles y proveedores que CH10, todos con mail. Uso la misma regla de noches que me diste para CH10 el 2026-10-09: 1 + 3 + 1.
- Vendido solo no trae traslados (el pasajero llega por su cuenta), igual que CH10.

### OD014 · El Calafate & El Chaltén full day (4 noches)

Es OD013 con una diferencia: en lugar de Torres del Paine trae el **full day a El Chaltén con almuerzo (South Road)**. Tiene los mismos 4 niveles (Hostel, Budget, 3\*, 4\*) y los mismos hoteles y proveedores que OD013, todos con mail.

| Día | Qué | Quién lo reserva |
|---|---|---|
| 1 | Traslado aeropuerto → alojamiento | Chalten Travel (ida y vuelta) |
| 2 | Perito Moreno full day | Chalten Travel |
| 3 | El Chaltén full day con almuerzo | South Road |
| 5 | Traslado alojamiento → aeropuerto | Chalten Travel |

### AR34 · El Chaltén + El Calafate, glaciares y trekking (5 noches)

En el Excel tiene su **propio bloque**, bajo El Calafate ("El Chalten + El Calafate, Glaciers and Trekking AR34", fila 214). Ahí están sus hoteles, sus traslados y su excursión. En RutasenBus no figura como tour. Por eso propongo cargarlo como un paquete más y no como suma de OD033 + OD016 (pregunta 1).

| Noches | Dónde | Hostel | Budget | Hotel 3\* | Hotel 4\* |
|---|---|---|---|---|---|
| 1 a 3 | El Chaltén | Rancho Grande (Chalten Travel) / Pioneros del Valle | Kau Si Aike / Vertical Lodge (Patagonian Group) | Poincenot (Chalten Travel) | Destino Sur (Chalten Travel) |
| 4 y 5 | El Calafate | Hostel del Glaciar Pioneros (Del Glaciar) / Calafate Hostel (Always Glaciers) | Del Glaciar Libertador / Hostería HI (Always Glaciers) / Puerto San Julián (Patagonian Group) | Rincón del Calafate / Sent (Tremun: se pide a cada hotel) | Mirador del Lago / Calafate Parque (Tremun: se pide a cada hotel) |

- **Bus ida y vuelta aeropuerto de El Calafate – El Chaltén – El Calafate ciudad:** Chalten Travel. Cubre la llegada del día 1 y el bus del día 4.
- **Perito Moreno, día 5:** Chalten Travel.
- **Traslado alojamiento → aeropuerto de El Calafate, día 6:** Chalten Travel.
- Todos los proveedores ya están en el directorio con mail.
- El Fitz Camp (upgrade opcional en El Chaltén) aparece en el Word y en los precios, pero no como renglón del bloque: es la pregunta 2.

### ARCH33EXP · Patagonia, Trekking Paradise con W-Trek EXPRESS (10 noches)

Coinciden las tres fuentes: es **ARCH33 con CH11 en lugar de CH10**. RutasenBus tiene la fila ARCH33EXP (fila 330) con OD033, OD016 y CH11. Tiene una noche menos que ARCH33 porque la W Express es más corta.

| Día | Qué | Noches | Quién lo reserva |
|---|---|---|---|
| 1 | **OD033** El Chaltén Starter Package | 3 | transfer de llegada (del paquete) |
| 4 | **OD016** El Calafate Starter Package | 2 | sin transfer: llega en bus desde El Chaltén |
| 6 | Bus El Calafate – Puerto Natales | — | lo emite HI Travel (tarea manual), igual que en ARCH33 |
| 6 | **CH11** W Trek Express + Puerto Natales | 5 | transfer de salida |
| 11 | Bus Puerto Natales – Punta Arenas por Kupos, o a pedido traslado al aeropuerto de Puerto Natales con Patagonia Planet | — | igual que el final de ARCH33 |

- Copio de ARCH33 las reglas que ya me confirmaste:
  - En El Chaltén, el "Hotel 3\*" del tour es el Budget de OD033.
  - La salida de Puerto Natales, que RutasenBus da por incluida en CH11 pero CH11 no trae, la cargo como en ARCH33.
- Los días del Word coinciden con esta secuencia: El Chaltén 1-3, El Calafate 4-5, Puerto Natales día 6, W del 7 al 9, Puerto Natales día 10 y fin el día 11.

### ARBR23 · De Buenos Aires a Río (11 noches)

Sale **entero de lo ya cargado**. Es la primera parte de BRARCH26, pero al revés y terminando en Río. Los costos de RutasenBus son los mismos que en BRARCH26.

| Día | Qué | Noches | Traslados |
|---|---|---|---|
| 1 | **OD018** Buenos Aires, Tango City | 3 | solo la llegada desde Ezeiza (Greeters); a la terminal de buses no hay traslado |
| 4 | Bus Buenos Aires – Puerto Iguazú (nocturno, llega el día 5) | — | lo emite HI Travel (tarea manual) |
| 5 | **OD010A** Iguazú on a Shoestring, lado argentino | 3 | el Paquete Receptivo 105 Premium de Cuenca del Plata, con traslado desde y hacia la terminal de buses de Puerto Iguazú |
| 8 | Bus Puerto Iguazú – Río (nocturno, llega el día 9) | — | lo emite HI Travel (tarea manual) |
| 9 | **OD032** Río Starter Package | 3 | sin traslado desde la terminal (el Word lo excluye); sí el traslado al aeropuerto de Río al final (Buzios Transfers / Alex) |

- Vende Hostel y Budget Hotel. Uso las mismas equivalencias de BRARCH26: en Iguazú y en Río, el Budget del tour es el Hotel 3\* del paquete; en Buenos Aires, el Budget de OD018.
- El traslado de Río en el Excel es solo de llegada ("Transfer GIG - Accommodation"). En ARBR23 se usa al revés, del alojamiento al aeropuerto, como hicimos con San Pedro en BOCHI04R.

### ARUY01 · Argentina y Uruguay, corazón del Río de la Plata (6 noches)

**Tiene 2 paquetes nuevos**, Colonia y Montevideo. Los dos están en el Excel (bloques COL y MVD) y no están cargados. RutasenBus (fila 719) da los componentes OD040, COMPUY03 y OD018, más el ferry. El orden del viaje sale del Word: Buenos Aires → Colonia → Montevideo.

| Día | Qué | Noches | Quién lo reserva |
|---|---|---|---|
| 1 | **OD018** Buenos Aires, Tango City | 3 | solo la llegada desde Ezeiza (Greeters) |
| 4 | Ferry Buenos Aires → Colonia | — | sin proveedor en las fuentes (pregunta 6) |
| 4 | **COMPUY03** Extensión a Colonia | 1 | **Hostel:** Viajero Hostel Colonia / Viajero B&B. **Hotel 3\*:** Viajero B&B superior. Las dos se le piden a "Viajero Hostels" (pregunta 5) |
| 5 | Bus Colonia → Montevideo | — | Excel: "COT online" (pregunta 6). En el Excel el bus está en sentido Montevideo → Colonia; en este tour va al revés |
| 5 | **OD040** Montevideo Starter Package | 2 | **Hostel:** Viajero Hostel (Viajero Hostels). **Hotel 3\*:** Hotel Oxford / Merit Montevideo (sin mail, pregunta 5). City tour del día 6 y traslado al aeropuerto de Carrasco del día 7: Turismo Dcom |

- **Lo nuevo de Uruguay, y qué hace falta de cada uno:**
  - **OD040 Montevideo** (2 noches; existe una versión de 3 noches, OD0403N, que no hace falta):
    - Nivel: confirmar que Oxford / Merit es el Hotel 3\* (pregunta 3).
    - Mail de Hotel Oxford y de Merit Montevideo (pregunta 5).
    - Confirmar que Turismo Dcom es "Dcom Travel" (pregunta 5).
    - En el tour, el traslado del aeropuerto se usa al revés, solo de salida, porque se llega en bus desde Colonia.
  - **COMPUY03 Colonia** (1 noche):
    - Nivel del B&B superior (pregunta 3).
    - Qué hacer con el dorm, que el Word dice que no hay (pregunta 4).
    - A qué contacto de Viajero se le pide (pregunta 5).
    - El bus en sentido Colonia → Montevideo y quién lo compra (pregunta 6).
  - **Ferry Buenos Aires – Colonia:** quién lo compra (pregunta 6).
- OD018 ya está cargado. En este tour lleva solo el traslado de llegada, porque se sale en ferry.

## Inconsistencias entre las fuentes

1. **Excel "para IA" vs. Excel vigente.**
   - La spec cita `… para IA.xlsm`, que es la versión vieja (2026-09-27). Ese archivo **no tiene CH11** y, salvo Iguazú, Mendoza, Ushuaia, El Calafate y CHB31, sus bloques no tienen código.
   - El vigente es el `.xls` (2026-10-10). Así lo dice la spec M1-04c y lo leen los importadores. Usé ese.
2. **AR34: la spec lo trata como tour compuesto, las fuentes como paquete.** Tiene su propio bloque en el Excel y no tiene fila en RutasenBus. Sus hoteles no son los de OD033 + OD016 (pregunta 1).
3. **Colonia sin dorm.** El Word de ARUY01 dice "no dorm available in Colonia, SGL room will be booked". El Excel (COMPUY03) tiene precios de dorm en Viajero Hostel Colonia (pregunta 4).
4. **COMPUY03 en sentido contrario.** En el Excel es una "Extensión a Colonia desde Montevideo", con el bus Montevideo → Colonia. ARUY01 va de Colonia a Montevideo. Es lógico: en el tour el bus se usa al revés. Además, la tarifa del bloque es de 2025-2026 y tiene la nota "ok 2026/27 pero carísimo". Los precios quedan fuera de esta pieza, pero lo aviso.
5. **RutasenBus de ARUY01** pone las columnas en orden Montevideo, Colonia, Buenos Aires. El viaje va al revés, según el Word. No es un problema: RutasenBus no marca el orden (con ARCH33 pasaba lo mismo).
6. **Word, detalles menores** (no cambian el armado):
   - ARBR23 y ARUY01: falta el encabezado "DAY 3" (el texto está pegado al día 2).
   - ARBR23 dice "Igauzu".

## Lo que necesito que me confirmes

1. **AR34: ¿lo cargo como paquete propio o como suma de dos paquetes?**
   - En el Excel, AR34 tiene su bloque, con hoteles distintos de los de OD033 + OD016. Por ejemplo: en El Chaltén, el Hostel es solo Rancho Grande / Pioneros del Valle; el Budget, Kau Si Aike / Vertical Lodge; el 3\*, Poincenot; y hay 4\* (Destino Sur), que OD033 no tiene.
   - **Sugerido: paquete propio**, leído de su bloque (3 noches en El Chaltén + 2 en El Calafate), como CH10 o OD013. Así cada nivel pide exactamente los hoteles del bloque.
   - De dónde sale: Excel fila 214 (bloque AR34). RutasenBus no tiene fila de AR34.
2. **Fitz Camp en AR34.**
   - El Word y los precios de AR34 ofrecen el upgrade a una noche en Fitz Camp, pero el bloque no tiene el renglón del servicio. OD033 sí lo tiene: "Optional: 2nd Night at Fitz Camp. Booking Suplier: Receptivo Chalten".
   - **Sugerido:** agregá ese mismo renglón al bloque AR34 del Excel. Lo cargo como opcional: se pide a Fitz Camp / Receptivo Chaltén (info@receptivochalten.com) solo si la reserva lo trae.
   - Si preferís no agregarlo, una reserva con Fitz Camp se completa a mano.
3. **Categoría de los hoteles de Uruguay.** Dos renglones no dicen la categoría: el de OD040 ("Hotel Oxford Montevideo / Merit Montevideo") y el de COMPUY03 ("Viajero B&B superior Room").
   - **Sugerido: los dos son el Hotel 3\*.** ARUY01 vende Hostel y Hotel 3\*, y cada paquete tiene solo esos dos renglones de alojamiento.
   - De dónde sale: Word y RutasenBus de ARUY01 ("DBL/SGL Hotel 3\*").
4. **Colonia no tiene dorm.** El Word dice que en Colonia no hay dorm y que se reserva habitación SGL. El Excel tiene precio de dorm.
   - **Sugerido:** seguir el Word. Al pasajero que compró Dorm Hostel, en Colonia se le pide a Viajero una habitación SGL (el pedido lo dice: "no hay dorm"). En Buenos Aires y Montevideo sigue en dorm.
5. **Contactos de Uruguay.** Hay tres casos:
   - a. **"Viajero Hostels"** reserva el hostel de Montevideo y los dos niveles de Colonia. En el directorio hay varias filas:
     - "Comercial Cono Sur" (comercialcs@viajerohostels.com), con la nota "tienen en Calafate, Montevideo y Colonia".
     - "Viajero en Colonia." (natalyp@viajerohostels.com), y en la fila de abajo, dfarinati@viajerohostels.com.
     - "Viajero Colonia Posada B&B", con la nota "por wsp" pero sin número.
     - **Sugerido:** Montevideo → Comercial Cono Sur; Colonia (hostel y B&B) → "Viajero en Colonia".
   - b. **Hotel Oxford Montevideo y Merit Montevideo**, el Hotel 3\* de Montevideo: no están en el directorio.
     - **Sugerido:** agregalos con su mail en la sección Montevideo del Excel de proveedores.
     - Si Merit Montevideo usa el mismo mail que Merit San Telmo (recepcionmba@merithoteles.com.ar), decímelo y lo uso.
     - Mientras tanto, esos pedidos salen con aviso de "sin mail".
   - c. **"Turismo Dcom"**, que reserva el traslado del aeropuerto de Montevideo y el city tour: ¿es "Dcom Travel" (operaciones@dcomtravel.com)?
     - **Sugerido: sí.**
     - De dónde sale: Excel fila 1800-1801 y directorio, sección Uruguay.
6. **Ferry Buenos Aires → Colonia y bus Colonia → Montevideo.**
   - RutasenBus tiene la columna "Ferry Bue COL", sin proveedor. Para el bus, el Excel dice "Booking Supplier: COT online" con la nota "(poner en listado de buses)".
   - **Sugerido:** los dos los compra HI Travel a mano, como tarea, sin mail: el ferry en Buquebus (como el Colonia Day Trip de OD020, que ya está como manual) y el bus en COT online (como Kupos).
7. **Días fijos de las excursiones.** Hoy solo OD030 (geysers) y OD031 (Tiwanaco) tienen día fijo. El resto sale con "fecha a coordinar" y aviso. El Word da los días de las excursiones nuevas:
   - OD014: Perito Moreno el día 2 y El Chaltén el día 3.
   - AR34: Perito Moreno el día 5.
   - OD040: city tour de Montevideo el día 2 (el día 6 dentro de ARUY01).
   - **Sugerido:** fijarlos así en `data/dias-servicio.csv` (salvo cambio manual). Para OD013 y los demás ya cargados no cambio nada.
8. **Variantes que menciona el Word y el catálogo no arma.**
   - ARBR23 "se puede hacer al revés" (de Río a Buenos Aires) y tiene un suplemento de vuelo Iguazú–Río en lugar del bus.
   - AR34 se puede empezar en El Calafate y terminar en El Chaltén.
   - **Sugerido:** cargar solo el sentido del Word. Si llega una reserva con la variante, la operadora corrige a mano los borradores, como hoy.

---

## Anexo técnico (para la fase B)

- **Excel:** usar el `.xls` vigente (`RUTA_PAQUETES` de `src/lib/importador-tours/insumos.ts`), no el `.xlsm` que cita la spec.
- **`data/paquetes-piloto.csv`:** agregar CH11 (PNT), OD014 (FTE), OD040 (MVD), COMPUY03 (COL) y, si la pregunta 1 se confirma, AR34 (FTE). Los bloques: CH11 en la fila 1303 (destino "W Trek", igual que CH10), OD014 y AR34 en la fila 214 (FTE), OD040 en la 1785 (MVD) y COMPUY03 en la 1849 (COL).
- **`noches-servicio.csv`:**
  - CH11: alojamiento la noche 1 (1 noche), W Trek Express desde la noche 2 (3 noches) y alojamiento la noche 5 (1 noche), como CH10.
  - AR34: por hotel. Rancho Grande, Pioneros del Valle, Kau Si Aike, Vertical Lodge, Poincenot y Destino Sur: noches 1-3. Hostel del Glaciar Pioneros, Calafate Hostel, Del Glaciar Libertador, Hostería HI, Puerto San Julián, Rincón, Sent, Mirador del Lago y Calafate Parque: noches 4-5.
  - Ojo con AR34: cada renglón de alojamiento junta las opciones de dos ciudades ("3 Nights A / B + 2 Nights C / D. Booking Supplier: X / Y + Z / W"). Tienen que quedar como dos estadías, cada una con su orden de prioridad, no como 4 opciones seguidas.
- **`niveles-confirmados.csv`:**
  - CH11 Hotel 3\*: el mismo texto que la línea de CH10.
  - OD040 "Hotel Oxford Montevideo / Merit Montevideo" y COMPUY03 "Viajero B&B superior Room": Hotel 3\*, si se confirma la pregunta 3.
  - COMPUY03 tiene el tipeo "Accommodaton" y separa con "/ Booking Supplier:". Revisar que el lector lo clasifique bien.
- **`equivalencias-proveedores.csv`:**
  - AR34 está bajo el destino FTE, pero los alias de los hoteles de El Chaltén (Kau Si Aike, Vertical Lodge) están solo para CHA. Hacen falta las equivalentes en FTE, o resolver por destino de la estadía.
  - Uruguay, según la pregunta 5: alias de Viajero Hostels y de Turismo Dcom → Dcom Travel.
  - COT online y Buquebus como `manual`, según la pregunta 6.
- **`categorias-tour.csv`:**
  - ARBR23 → OD032 y OD010A: Budget Hotel = Hotel 3\* (lo mismo que BRARCH26).
  - ARCH33EXP → OD033: Hotel 3\* = Budget Hotel (lo mismo que ARCH33).
- **`tramos-con-proveedor.csv`:** ARCH33EXP, Bus Puerto Natales – Punta Arenas, con Kupos.cl y la alternativa de Patagonia Planet, igual que ARCH33.
- **`traslados-tour.csv`:**
  - ARBR23/OD010A, reemplazar por "Paquete Receptvo 105 Premium con transfer in y out desde/hacia la terminal de buses de Puerto Iguazú".
  - ARBR23/OD032 "GIG - Accommodation in Rio", invertir: alojamiento → aeropuerto GIG.
  - ARUY01/OD040 "MVD Airport - hotel / hostel", invertir: alojamiento → aeropuerto de Carrasco.
  - ARUY01/COMPUY03, bus Montevideo – Colonia: va en sentido Colonia → Montevideo.
- **Lector del Word (`ciudades.ts` / `word.ts`):**
  - No reconoce Colonia ni Montevideo: las estadías salen sin destino.
  - No lee "Ferry from Buenos Aires port to Colonia" como tramo. Los ítems de ARUY01 salen así: 3 BUE, 1 (sin destino), bus (sin ciudades), 2 (sin destino).
  - ARBR23, ARCH33EXP, AR34, CH11 y OD014 se leen bien.
- **Códigos de agencia:**
  - Kilroy (de la spec, mail DK1594177/DK1594100): `HI_ARGENTINA_W_TREK_CH_11-677` → CH11, `HI_ARGENTINA_AR34-677` → AR34, `HI_ARGENTINA_OD014-677` → OD014, `HI_TRAVEL_ARCH_EXP-677` → ARCH33EXP.
  - TourRadar: 275366 → ARCH33EXP, 150104 → ARBR23 ("Buenos Aires to Rio de Janeiro 12 Days"), 317766 → ARUY01 ("Argentina and Uruguay, heart of the River Plate (7 days)").
  - Los de `productos-no-cargados.csv` se borran de ahí al cargarse. CH11 y AR34 no estaban anotados en ese archivo.
